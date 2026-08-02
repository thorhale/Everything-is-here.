// Final step of docs/storage-efficiency.md tier 3: drop the ingredient junction
// tables, now that nothing reads them.
//
// This is irreversible and removes ~270 MB, so it does nothing without an
// explicit --confirm. The default is a dry run that checks every precondition
// and reports what it would do.
//
// Unlike the earlier column work, this needs no VACUUM FULL and no spare
// headroom: DROP TABLE removes the files outright, so the space comes back
// immediately.
//
// ORDER MATTERS. Run this only AFTER the branch that stops querying these
// tables is deployed. Until then the live app still selects from them.
//
// Usage:
//   node --env-file=.neon.env drop-junction-tables.mjs            # dry run
//   node --env-file=.neon.env drop-junction-tables.mjs --confirm  # do it
import { neon } from "@neondatabase/serverless";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";

const URL_ = process.env.NEON_URL || process.env.DATABASE_URL;
if (!URL_) {
  console.error("Set NEON_URL. Try: node --env-file=.neon.env drop-junction-tables.mjs");
  process.exit(1);
}
const CONFIRM = process.argv.includes("--confirm");
const sql = neon(URL_);

const SHARD_DIR = "../data/recipes/ingredients";
const ROLLUPS = "../data/recipes/archive-rollups.json.gz";
const TABLES = ["RecipeFermentable", "RecipeHop", "RecipeYeast", "RecipeMisc"];

const shardFor = (slug) => {
  const h = createHash("sha1").update(slug).digest();
  return ((h[0] << 2) | (h[1] >> 6)) % 1024;
};
const readShard = (n) =>
  JSON.parse(gunzipSync(readFileSync(`${SHARD_DIR}/${n.toString(16).padStart(3, "0")}.json.gz`)).toString());

let fatal = 0;
const fail = (m) => { console.error(`  FAIL  ${m}`); fatal++; };
const ok = (m) => console.log(`  ok    ${m}`);

console.log("preflight\n");

// 1. The replacement data must exist.
if (!existsSync(SHARD_DIR)) fail(`${SHARD_DIR} missing — run export-recipe-ingredients.mjs`);
else {
  const n = readdirSync(SHARD_DIR).filter((f) => f.endsWith(".json.gz")).length;
  if (n < 1000) fail(`only ${n} shards present, expected 1024`);
  else ok(`${n} ingredient shards present`);
}
if (!existsSync(ROLLUPS)) fail(`${ROLLUPS} missing — run build-archive-rollups.mjs`);
else ok("archive rollups present");

// 2. Spot-check that the shards actually agree with the database, right now,
//    on real rows. Cheap insurance against dropping the source of truth in
//    favour of a stale or partial export.
if (!fatal) {
  const sample = await sql.query(
    `SELECT id, slug FROM "Recipe" WHERE "isHidden" = false ORDER BY random() LIMIT 50`
  );
  let mismatches = 0, compared = 0;
  for (const r of sample) {
    const entry = readShard(shardFor(r.slug))[r.slug] ?? {};
    for (const [table, key] of [
      ["RecipeFermentable", "f"], ["RecipeHop", "h"], ["RecipeYeast", "y"],
    ]) {
      const [{ n }] = await sql.query(
        `SELECT count(*)::int AS n FROM "${table}" WHERE "recipeId" = $1`, [r.id]
      );
      const got = (entry[key] ?? []).length;
      compared++;
      if (n !== got) { mismatches++; if (mismatches <= 5) console.error(`        ${r.slug} ${table}: db ${n}, shard ${got}`); }
    }
  }
  if (mismatches) fail(`${mismatches}/${compared} row-count checks disagree — the export is stale, re-run export-recipe-ingredients.mjs`);
  else ok(`${compared} row-count checks across 50 random recipes all agree`);
}

// 3. Report what would go.
const sizes = [];
for (const t of TABLES) {
  const [row] = await sql.query(
    `SELECT to_regclass($1) IS NOT NULL AS present,
            COALESCE(pg_size_pretty(pg_total_relation_size(to_regclass($1))), '-') AS sz`,
    [`"${t}"`]
  );
  sizes.push({ t, ...row });
}
const [db] = await sql.query(`SELECT pg_size_pretty(pg_database_size(current_database())) AS s`);
console.log(`\ndatabase is ${db.s}; these would be dropped:`);
for (const s of sizes) console.log(`  ${String(s.sz).padStart(9)}  ${s.t}${s.present ? "" : "  (already gone)"}`);

if (fatal) {
  console.error(`\n${fatal} precondition(s) failed. Nothing was dropped.`);
  process.exit(1);
}

if (!CONFIRM) {
  console.log("\nDRY RUN — nothing dropped. Re-run with --confirm once this branch is deployed.");
  console.log("Deploy first: until then the live app still selects from these tables.");
  process.exit(0);
}

for (const { t, present } of sizes) {
  if (!present) continue;
  await sql.query(`DROP TABLE IF EXISTS "${t}" CASCADE`);
  console.log(`dropped ${t}`);
}
const [after] = await sql.query(`SELECT pg_size_pretty(pg_database_size(current_database())) AS s`);
console.log(`\ndatabase: ${db.s} -> ${after.s}`);
