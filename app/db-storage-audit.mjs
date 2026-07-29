// Where is the storage actually going?
//
// Neon's free tier caps a project at 0.5 GB, and that figure counts both live
// data and retained history (WAL). When a project approaches the cap the
// honest first question is not "what can I delete" but "what is actually
// large" — the answer is frequently retained history and dead tuples rather
// than the data itself, and those cost nothing to reclaim.
//
// Reports, largest first: table size, index size, live/dead tuple counts,
// vacuum history, and indexes that have never been used.
//
// Usage: NEON_URL=... node db-storage-audit.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.NEON_URL);
const mb = (bytes) => (Number(bytes) / 1024 / 1024).toFixed(1);
const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);

const tables = await sql.query(`
  SELECT
    c.relname                                        AS table,
    pg_total_relation_size(c.oid)                    AS total_bytes,
    pg_relation_size(c.oid)                          AS heap_bytes,
    pg_indexes_size(c.oid)                           AS index_bytes,
    pg_total_relation_size(c.reltoastrelid)          AS toast_bytes,
    s.n_live_tup                                     AS live_rows,
    s.n_dead_tup                                     AS dead_rows,
    GREATEST(s.last_vacuum, s.last_autovacuum)       AS last_vacuum
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
  WHERE c.relkind = 'r' AND n.nspname = 'public'
  ORDER BY pg_total_relation_size(c.oid) DESC
`);

let total = 0;
let deadTotal = 0;
console.log("\n=== TABLES (largest first) ===");
console.log(
  pad("table", 26) + padL("total", 9) + padL("heap", 9) + padL("toast", 9) +
  padL("indexes", 9) + padL("rows", 10) + padL("dead", 9) + "  last vacuum"
);
for (const t of tables) {
  total += Number(t.total_bytes);
  deadTotal += Number(t.dead_rows ?? 0);
  console.log(
    pad(t.table, 26) +
    padL(mb(t.total_bytes), 9) +
    padL(mb(t.heap_bytes), 9) +
    padL(mb(t.toast_bytes ?? 0), 9) +
    padL(mb(t.index_bytes), 9) +
    padL((t.live_rows ?? 0).toLocaleString(), 10) +
    padL((t.dead_rows ?? 0).toLocaleString(), 9) +
    "  " + (t.last_vacuum ? new Date(t.last_vacuum).toISOString().slice(0, 16) : "never")
  );
}
console.log(`\nTotal across tables: ${mb(total)} MB`);
console.log(`Dead tuples awaiting reclaim: ${deadTotal.toLocaleString()}`);

const [{ dbsize }] = await sql.query(`SELECT pg_database_size(current_database()) AS dbsize`);
console.log(`Database size as Postgres reports it: ${mb(dbsize)} MB`);
console.log(
  "Neon's console figure is usually LARGER than this, because it also counts\n" +
  "retained history (WAL) for the branch's restore window. If the console says\n" +
  "materially more than the number above, the difference is history, and the\n" +
  "cheapest fix is lowering the retention period — no data is lost."
);

console.log("\n=== INDEXES NEVER USED ===");
const idx = await sql.query(`
  SELECT s.relname AS table, s.indexrelname AS index,
         pg_relation_size(s.indexrelid) AS bytes, s.idx_scan
  FROM pg_stat_user_indexes s
  JOIN pg_index i ON i.indexrelid = s.indexrelid
  WHERE s.idx_scan = 0 AND NOT i.indisprimary AND NOT i.indisunique
  ORDER BY pg_relation_size(s.indexrelid) DESC
`);
if (idx.length === 0) {
  console.log("(none — every index has been used at least once)");
} else {
  let idxTotal = 0;
  for (const i of idx) {
    idxTotal += Number(i.bytes);
    console.log(pad(i.index, 44) + padL(mb(i.bytes), 9) + "  on " + i.table);
  }
  console.log(`\nReclaimable by dropping unused indexes: ${mb(idxTotal)} MB`);
  console.log(
    "Caution: 'never used' is measured since the last stats reset, which on a\n" +
    "recently-restarted compute can be very recent. Check the counter has been\n" +
    "running a while before dropping anything."
  );
}

console.log("\n=== LARGEST TEXT COLUMNS (sampled) ===");
const wide = await sql.query(`
  SELECT 'Recipe.notesText' AS col,
         count(*) FILTER (WHERE "notesText" IS NOT NULL) AS populated,
         COALESCE(sum(length("notesText")), 0) AS total_chars,
         COALESCE(max(length("notesText")), 0) AS max_chars
  FROM "Recipe"
`);
for (const w of wide) {
  console.log(
    `${pad(w.col, 26)} populated=${padL(Number(w.populated).toLocaleString(), 9)}` +
    ` total=${padL(mb(w.total_chars), 8)} MB  longest=${Number(w.max_chars).toLocaleString()} chars`
  );
}

console.log(`
=== WHAT TO DO WITH THIS ===
1. If Neon's console figure far exceeds the database size above, the gap is
   retained history. Lower the branch's restore window (Project settings ->
   History retention). Instant, free, loses only the ability to time-travel.
2. Dead tuples are space already allocated but reusable. Plain VACUUM marks
   them reusable without rewriting; it does NOT return space to the OS.
3. VACUUM FULL does return space, but it rewrites each table and needs room
   for a full second copy while it runs. Do NOT run it on the largest table
   while the project is near its storage cap — it can fail partway or push
   you over. Do the small tables first, or lower retention first to buy room.
4. Only after all of that is the archive itself worth touching.
`);
