// Reclaim the refUrl data (~46 MB) WITHOUT waiting for a deploy.
//
// The contract phase of migrate-refid.mjs cannot run yet, because it drops
// columns the currently-deployed Prisma client still selects. But refUrl is a
// special case: nothing in the application ever reads its VALUE — grep for
// `refUrl` and the only hits are the two loaders that write it. Prisma just
// needs the column to exist.
//
// So: drop the column (releasing its data), then immediately re-add it empty.
// An all-NULL column costs essentially nothing, because NULLs live in the row's
// null bitmap rather than in the row body. The deployed app keeps working, and
// the bytes come back. refId already holds every id — verified 0 unparsed
// across all 970,000 rows before this runs, and re-verified below.
//
// The primary key is dropped and rebuilt around the rewrite: VACUUM FULL needs
// roughly the table's size free to write its copy, and releasing the index is
// what guarantees that room.
//
// Usage: node --env-file=.neon.env reclaim-refurl.mjs
import { neon } from "@neondatabase/serverless";

const URL_ = process.env.NEON_URL || process.env.DATABASE_URL;
if (!URL_) {
  console.error("Set NEON_URL. Try: node --env-file=.neon.env reclaim-refurl.mjs");
  process.exit(1);
}
const sql = neon(URL_);

const mb = async () => {
  const [r] = await sql.query(`SELECT pg_database_size(current_database())::bigint AS b`);
  return +(Number(r.b) / 1048576).toFixed(1);
};
const tsz = async (t) => {
  const [r] = await sql.query(
    `SELECT pg_size_pretty(pg_total_relation_size(('"' || $1 || '"')::regclass)) AS s`, [t]);
  return r.s;
};

const TABLES = [
  { t: "RecipeFermentable", pk: `"recipeId","sortOrder"` },
  { t: "RecipeHop", pk: `"recipeId","sortOrder"` },
];

console.log(`start: ${await mb()} MB`);

for (const { t, pk } of TABLES) {
  // Refuse to drop anything unless every refUrl has already been captured as a
  // refId. This is the check that stopped the first migration attempt from
  // nulling 349,000 rows.
  const [chk] = await sql.query(
    `SELECT count(*) FILTER (WHERE "refUrl" IS NOT NULL AND "refId" IS NULL)::int AS unparsed,
            count("refId")::int AS ids
       FROM "${t}"`
  );
  if (chk.unparsed > 0) {
    console.error(`ABORT ${t}: ${chk.unparsed} refUrls have no refId. Run migrate-refid.mjs expand first.`);
    process.exit(1);
  }

  const before = await tsz(t);
  await sql.query(`ALTER TABLE "${t}" DROP COLUMN IF EXISTS "refUrl"`);
  await sql.query(`ALTER TABLE "${t}" ADD COLUMN "refUrl" text`);
  await sql.query(`ALTER TABLE "${t}" DROP CONSTRAINT IF EXISTS "${t}_pkey"`);
  await sql.query(`VACUUM FULL "${t}"`);
  await sql.query(`ALTER TABLE "${t}" ADD CONSTRAINT "${t}_pkey" PRIMARY KEY (${pk})`);

  const [dup] = await sql.query(
    `SELECT count(*)::int AS n FROM (SELECT "recipeId","sortOrder" FROM "${t}" GROUP BY 1,2 HAVING count(*)>1) x`
  );
  console.log(
    `  ${t}: ${before} -> ${await tsz(t)}   ${chk.ids.toLocaleString()} refIds kept, ${dup.n} dupes   db ${await mb()} MB`
  );
}

console.log(`\ndone: ${await mb()} MB`);
console.log("The empty refUrl columns disappear for good in migrate-refid.mjs contract, after the deploy.");
