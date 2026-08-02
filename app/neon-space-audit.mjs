// Where the Neon storage is going, and what of it is actually reclaimable.
//
// READ-ONLY. Every statement is a SELECT; this script never writes. Run it
// against production safely:
//
//   node --env-file=.neon.env neon-space-audit.mjs
//   node --env-file=.neon.env neon-space-audit.mjs --fingerprint
//
// The default run is cheap (catalog views only, well under a second). The
// --fingerprint pass rebuilds the prisma/dedupe.ts content fingerprint for
// every recipe to count true duplicates; it costs ~25s of compute, which is
// not free on a metered tier, so it is opt-in rather than default.
//
// Exits 1 when the database exceeds FAIL_PCT of the tier limit, so this can
// gate a deploy the same way app/sources-budget.json ratchets citation debt.
// The point is to find out *before* a loader run fails at 100%.
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.NEON_URL);
const FINGERPRINT = process.argv.includes("--fingerprint");
// Neon's free tier is 512 MiB. Override when the plan changes rather than
// editing the constant, so this keeps working after an upgrade.
const LIMIT = Number(process.env.NEON_LIMIT_MIB || 512) * 1048576;
const WARN_PCT = Number(process.env.NEON_WARN_PCT || 80);
const FAIL_PCT = Number(process.env.NEON_FAIL_PCT || 90);

const pad = (s, n) => String(s).padEnd(n);
const mib = (b) => (Number(b) / 1048576).toFixed(1);
const rule = (n = 74) => console.log("-".repeat(n));

if (!process.env.NEON_URL) {
  console.error("neon-space-audit: NEON_URL is not set. Pass --env-file=.neon.env");
  process.exit(2);
}

// --- Total, against the tier ceiling -----------------------------------
const [{ db, bytes }] = await sql.query(
  `SELECT pg_size_pretty(pg_database_size(current_database())) AS db,
          pg_database_size(current_database()) AS bytes`
);
const pct = (Number(bytes) / LIMIT) * 100;
console.log(`\ndatabase ${db} — ${pct.toFixed(1)}% of ${(LIMIT / 1048576).toFixed(0)} MiB`);
console.log(`headroom ${mib(LIMIT - Number(bytes))} MiB\n`);

// --- Per-table breakdown -----------------------------------------------
const tables = await sql.query(
  `SELECT c.relname AS t,
          pg_size_pretty(pg_total_relation_size(c.oid)) AS total,
          pg_size_pretty(pg_relation_size(c.oid))       AS heap,
          pg_size_pretty(pg_indexes_size(c.oid))        AS idx,
          pg_total_relation_size(c.oid)                 AS bytes
   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r'
     AND pg_total_relation_size(c.oid) > 65536
   ORDER BY pg_total_relation_size(c.oid) DESC`
);
console.log(pad("table", 26) + pad("total", 11) + pad("heap", 11) + pad("indexes", 11) + "share");
rule();
for (const t of tables) {
  const share = (Number(t.bytes) / Number(bytes)) * 100;
  console.log(pad(t.t, 26) + pad(t.total, 11) + pad(t.heap, 11) + pad(t.idx, 11) + `${share.toFixed(1)}%`);
}
rule();

// --- Reclaimable: dead tuples ------------------------------------------
// The data loaders are delete-then-insert, so superseded row versions pile up
// here. Plain VACUUM makes the space reusable in place; only VACUUM FULL (which
// takes an exclusive lock) hands it back to the tier accounting.
const dead = await sql.query(
  `SELECT relname AS t, n_live_tup AS live, n_dead_tup AS dead,
          pg_total_relation_size(relid) AS bytes
   FROM pg_stat_user_tables WHERE n_dead_tup > 0
   ORDER BY n_dead_tup DESC LIMIT 12`
);
let deadBytes = 0;
for (const r of dead) {
  const l = Number(r.live), d = Number(r.dead);
  deadBytes += Number(r.bytes) * (l + d ? d / (l + d) : 0);
}
console.log(`\ndead tuples across ${dead.length} tables: ~${mib(deadBytes)} MiB (VACUUM FULL to return it)`);
for (const r of dead.slice(0, 5)) {
  const l = Number(r.live), d = Number(r.dead);
  const f = l + d ? (d / (l + d)) * 100 : 0;
  console.log("  " + pad(r.t, 24) + pad(`${d.toLocaleString()} dead`, 16) + `${f.toFixed(1)}% of table`);
}

// --- Reclaimable: indexes nothing ever reads ---------------------------
// Primary keys and unique constraints are excluded: they enforce correctness,
// so a zero scan count is not a reason to drop them.
const idx = await sql.query(
  `SELECT s.relname AS t, s.indexrelname AS i,
          pg_size_pretty(pg_relation_size(s.indexrelid)) AS size,
          pg_relation_size(s.indexrelid) AS bytes
   FROM pg_stat_user_indexes s JOIN pg_index x ON x.indexrelid = s.indexrelid
   WHERE s.schemaname = 'public' AND s.idx_scan = 0
     AND NOT x.indisprimary AND NOT x.indisunique
   ORDER BY pg_relation_size(s.indexrelid) DESC`
);
const idxBytes = idx.reduce((a, r) => a + Number(r.bytes), 0);
console.log(`\nnever-scanned indexes: ${idx.length}, ~${mib(idxBytes)} MiB`);
for (const r of idx.slice(0, 5)) console.log("  " + pad(r.t, 24) + pad(r.i, 40) + r.size);
if (idx.length) {
  console.log("  (scan counts reset with the stats; a fresh database makes everything look unused)");
}

// --- Reclaimable: rows that parsed to nothing --------------------------
const [junk] = await sql.query(
  `SELECT count(*) FILTER (WHERE f.n = 0 AND h.n = 0 AND y.n = 0)::bigint AS no_ing,
          count(*) FILTER (WHERE r.og IS NULL AND r.fg IS NULL)::bigint   AS no_grav,
          count(*)::bigint AS total
   FROM "Recipe" r
   LEFT JOIN LATERAL (SELECT count(*) n FROM "RecipeFermentable" x WHERE x."recipeId"=r.id) f ON true
   LEFT JOIN LATERAL (SELECT count(*) n FROM "RecipeHop"         x WHERE x."recipeId"=r.id) h ON true
   LEFT JOIN LATERAL (SELECT count(*) n FROM "RecipeYeast"       x WHERE x."recipeId"=r.id) y ON true`
);
console.log(`\nrecipes with no ingredients: ${Number(junk.no_ing).toLocaleString()}`);
console.log(`recipes with no OG and no FG: ${Number(junk.no_grav).toLocaleString()}`);
console.log(`total recipes: ${Number(junk.total).toLocaleString()}`);

// --- Optional: true duplicate count ------------------------------------
if (FINGERPRINT) {
  const NORM = String.raw`
    btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
      lower(coalesce(r.title,'')), '^\s*copy of\s+',''), '\s*\(?copy\)?\s*$',''),
      '[\s\-_]+[0-9]+\s*$',''), '\s+',' ','g'))`;
  const r3 = (e) => `coalesce(to_char(${e},'FM9999999990.000'),'')`;
  const child = (tbl, alias, cols) => `
    coalesce((SELECT string_agg(x,',' ORDER BY x) FROM (
      SELECT ${cols} AS x FROM "${tbl}" ${alias} WHERE ${alias}."recipeId"=r.id) q),'')`;
  const FP = `
    ${NORM} || '|' || lower(btrim(coalesce(r."styleName",''))) || '|' ||
    regexp_replace(lower(coalesce(r."batchSizeDisplay",'')),'\\s+','','g') || '|' ||
    ${r3("r.og")} || '|' || ${r3("r.fg")} || '|' ||
    ${child("RecipeFermentable", "f", `lower(btrim(f.name))||'|'||${r3('f."amountLb"')}||'|'||${r3('f."colorLovibond"')}`)} || '|' ||
    ${child("RecipeHop", "h", `lower(btrim(h.name))||'|'||${r3('h."amountOz"')}||'|'||${r3('h."timeMinutes"')}`)} || '|' ||
    ${child("RecipeYeast", "y", "lower(btrim(y.name))")}`;

  process.stdout.write("\nfingerprinting recipes (this costs ~25s of compute)... ");
  const t0 = Date.now();
  const [fp] = await sql.query(`
    WITH f AS (SELECT md5(${FP}) AS h FROM "Recipe" r),
         g AS (SELECT h, count(*) n FROM f GROUP BY h)
    SELECT count(*) FILTER (WHERE n > 1)::bigint                AS groups,
           coalesce(sum(n-1) FILTER (WHERE n > 1),0)::bigint    AS redundant,
           coalesce(max(n),0)::bigint                           AS largest,
           sum(n)::bigint                                       AS total FROM g`);
  console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s`);
  const red = Number(fp.redundant), tot = Number(fp.total);
  console.log(`  duplicate groups ${Number(fp.groups).toLocaleString()}, largest ${Number(fp.largest)} copies`);
  console.log(`  redundant rows ${red.toLocaleString()} (${((red / tot) * 100).toFixed(1)}% of ${tot.toLocaleString()})`);
  if (red) console.log("  run `npm run dedupe` for the dry run, then --apply");
} else {
  console.log("\n(pass --fingerprint to also count true duplicate recipes)");
}

// --- Verdict ------------------------------------------------------------
const reclaimable = deadBytes + idxBytes;
console.log(`\ntotal cheaply reclaimable: ~${mib(reclaimable)} MiB of ${mib(bytes)} MiB used`);
if (pct >= FAIL_PCT) {
  console.error(`\nFAIL: ${pct.toFixed(1)}% of the tier limit (threshold ${FAIL_PCT}%).`);
  console.error("Reclaimable space will not save this - the fix is to move or trim data.");
  process.exit(1);
}
if (pct >= WARN_PCT) console.log(`\nWARN: ${pct.toFixed(1)}% of the tier limit (warn at ${WARN_PCT}%).`);
else console.log(`\nOK: ${pct.toFixed(1)}% of the tier limit.`);
