// Step 1 of docs/storage-efficiency.md: replace the redundant `refUrl` text
// column with a `refId` integer on the three ingredient junction tables.
// Reclaims roughly 51 MB — the largest single win, and lossless: the original
// URL rebuilds exactly from this integer plus the parent recipe's
// sourceTimestamp (proved on every ref_url in the parse sample by
// lib/brewtoad-ref.test.ts).
//
// EXPAND / CONTRACT, so the app is never reading a column that does not exist:
//
//   1. node --env-file=.neon.env migrate-refid.mjs expand
//        Adds refId, backfills it from refUrl, verifies, leaves refUrl in place.
//        Safe to run while the current app is live: it only adds a column.
//   2. Deploy the app. Prisma now selects refId (present) and simply ignores
//        the leftover refUrl, which it no longer knows about.
//   3. node --env-file=.neon.env migrate-refid.mjs contract
//        Drops refUrl and reclaims the space, one table at a time.
//
// Never run `contract` before the deploy in step 2 — the running app would be
// selecting a dropped column.
//
// WHY ONE TABLE AT A TIME: VACUUM FULL rewrites a table into a fresh copy
// before dropping the original, so at peak it needs roughly that table's size
// free. Near a storage cap, vacuuming everything at once can fail partway.
// Doing the largest table first frees headroom for the next.
import { neon } from "@neondatabase/serverless";

const URL_ = process.env.NEON_URL || process.env.DATABASE_URL;
if (!URL_) {
  console.error("Set NEON_URL (or DATABASE_URL). Try: node --env-file=.neon.env migrate-refid.mjs expand");
  process.exit(1);
}
const phase = process.argv[2];
if (phase !== "expand" && phase !== "contract" && phase !== "check") {
  console.error("Usage: migrate-refid.mjs <expand|check|contract>");
  process.exit(1);
}

const sql = neon(URL_);

// Largest first, so each table's reclaimed space is available to the next.
const TABLES = ["RecipeFermentable", "RecipeHop", "RecipeYeast"];

// Matches /web/<timestamp>/https://www.brewtoad.com/<path>/<id> and captures
// the id. Anchored, so anything unexpected backfills as NULL rather than as a
// silently wrong number.
const EXTRACT = `NULLIF(substring("refUrl" from '^/web/[0-9]+/https://www\\.brewtoad\\.com/(?:generic-fermentables|hops|yeasts)/([0-9]+)$'), '')::int`;

async function columns(table) {
  const rows = await sql.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
    [table]
  );
  return new Set(rows.map((r) => r.column_name));
}

async function size(table) {
  const [r] = await sql.query(`SELECT pg_size_pretty(pg_total_relation_size($1)) AS s`, [table]);
  return r.s;
}

if (phase === "expand") {
  for (const t of TABLES) {
    const cols = await columns(t);
    if (!cols.has("refUrl")) {
      console.log(`${t}: no refUrl column — already migrated, skipping`);
      continue;
    }
    await sql.query(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "refId" integer`);
    await sql.query(`UPDATE "${t}" SET "refId" = ${EXTRACT} WHERE "refUrl" IS NOT NULL AND "refId" IS NULL`);

    // Verify before anyone drops anything: every non-null refUrl must have
    // produced a refId. A non-zero count here means the URL shape varies in
    // production in a way the sample did not show — stop and look.
    const [chk] = await sql.query(
      `SELECT count(*) FILTER (WHERE "refUrl" IS NOT NULL)                    AS with_url,
              count(*) FILTER (WHERE "refUrl" IS NOT NULL AND "refId" IS NULL) AS unparsed
         FROM "${t}"`
    );
    const unparsed = Number(chk.unparsed);
    console.log(`${t}: ${Number(chk.with_url).toLocaleString()} refUrls, ${unparsed} unparsed  [${await size(t)}]`);
    if (unparsed > 0) {
      const bad = await sql.query(`SELECT "refUrl" FROM "${t}" WHERE "refUrl" IS NOT NULL AND "refId" IS NULL LIMIT 5`);
      console.error(`\n  ABORT: ${unparsed} refUrl values did not match the expected shape. Examples:`);
      for (const b of bad) console.error(`    ${b.refUrl}`);
      console.error(`\n  Do not run "contract" — that would lose these. Widen the pattern first.`);
      process.exit(1);
    }
  }
  console.log("\nexpand complete. Deploy the app, then run: migrate-refid.mjs contract");
} else if (phase === "check") {
  for (const t of TABLES) {
    const cols = await columns(t);
    console.log(`${t}: refUrl=${cols.has("refUrl")} refId=${cols.has("refId")}  [${await size(t)}]`);
  }
} else {
  for (const t of TABLES) {
    const cols = await columns(t);
    if (!cols.has("refId")) {
      console.error(`${t}: no refId column — run "expand" first. Stopping.`);
      process.exit(1);
    }
    const drop = [];
    if (cols.has("refUrl")) drop.push("refUrl");
    // Step 2 of docs/storage-efficiency.md, folded into the same rewrite: the
    // orphaned cuid `id` on the two junction tables. It stopped being a primary
    // key earlier and its last reader (a React list key) now uses sortOrder,
    // which is half the composite key and unique within a recipe. Dropping it
    // here rather than in a separate pass avoids a second VACUUM FULL of the
    // same table — each rewrite needs roughly the table's size free, so doing
    // both columns in one pass halves the peak space this costs.
    if (t !== "RecipeYeast" && cols.has("id")) drop.push("id");

    if (!drop.length) {
      console.log(`${t}: already contracted, skipping`);
      continue;
    }
    const before = await size(t);
    for (const c of drop) await sql.query(`ALTER TABLE "${t}" DROP COLUMN "${c}"`);
    // DROP COLUMN is metadata-only; the bytes come back on rewrite.
    await sql.query(`VACUUM FULL "${t}"`);
    console.log(`${t}: dropped ${drop.join(", ")}   ${before} -> ${await size(t)}`);
  }
  const [db] = await sql.query(`SELECT pg_size_pretty(pg_database_size(current_database())) AS s`);
  console.log(`\ncontract complete. Database now ${db.s}.`);
}
