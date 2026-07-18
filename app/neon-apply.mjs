// Apply the pitching-protocol + clone-count migrations and (optionally) run
// the clone consolidation against Neon over HTTPS. Port 5432 is blocked in
// this sandbox, so - like load-neon.mjs - we use the Neon serverless HTTP
// driver instead of `prisma migrate deploy`.
//
// Usage:
//   NEON_URL=... node neon-apply.mjs              # migrate + dedupe DRY RUN
//   NEON_URL=... node neon-apply.mjs --apply      # migrate + consolidate for real
//
// Migrations are additive and idempotent ("already exists" is tolerated), so
// this is safe to re-run. The destructive step (deleting redundant clone
// rows) only happens with --apply.

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

const URL_ = process.env.NEON_URL;
if (!URL_) {
  console.error("NEON_URL is not set. Export the Neon HTTPS connection string first.");
  process.exit(1);
}
const APPLY = process.argv.includes("--apply");
const sql = neon(URL_);

const MIGRATIONS = [
  "prisma/migrations/20260717000000_add_recipe_pitching_protocol/migration.sql",
  "prisma/migrations/20260717010000_add_recipe_clone_count/migration.sql",
];

async function applyMigrations() {
  for (const path of MIGRATIONS) {
    const ddl = readFileSync(path, "utf8");
    for (let stmt of ddl.split(";")) {
      stmt = stmt.trim();
      if (!stmt) continue;
      try {
        await sql.query(stmt);
      } catch (e) {
        if (!/already exists|duplicate column/i.test(e.message)) {
          console.error(`DDL error in ${path}:`, e.message.slice(0, 120));
          throw e;
        }
      }
    }
    console.log(`applied ${path}`);
  }
}

// --- clone consolidation (mirrors prisma/dedupe.ts, HTTP-driver flavour) ---

const r3 = (n) => (n == null ? "" : Number(n).toFixed(3));
const normTitle = (t) =>
  (t ?? "")
    .toLowerCase()
    .replace(/^\s*copy of\s+/i, "")
    .replace(/\s*\(?copy\)?\s*$/i, "")
    .replace(/[\s\-_]+\d+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();

function fingerprint(rec, ferms, hops, ysts) {
  const f = (ferms.get(rec.id) ?? [])
    .map((x) => `${(x.name || "").toLowerCase().trim()}|${r3(x.amountLb)}|${r3(x.colorLovibond)}`)
    .sort();
  const h = (hops.get(rec.id) ?? [])
    .map((x) => `${(x.name || "").toLowerCase().trim()}|${r3(x.amountOz)}|${r3(x.timeMinutes)}`)
    .sort();
  const y = (ysts.get(rec.id) ?? []).map((x) => (x.name || "").toLowerCase().trim()).sort();
  return JSON.stringify({
    t: normTitle(rec.title),
    s: (rec.styleName ?? "").toLowerCase().trim(),
    b: (rec.batchSizeDisplay ?? "").toLowerCase().replace(/\s+/g, ""),
    og: r3(rec.og),
    fg: r3(rec.fg),
    f,
    h,
    y,
  });
}

function pickCanonical(group, commentCount) {
  return [...group].sort((a, b) => {
    const ca = commentCount.get(a.id) ?? 0;
    const cb = commentCount.get(b.id) ?? 0;
    if (cb !== ca) return cb - ca;
    if (a.sourceTimestamp !== b.sourceTimestamp) return a.sourceTimestamp < b.sourceTimestamp ? -1 : 1;
    if ((b.parseConfidence ?? 0) !== (a.parseConfidence ?? 0)) return (b.parseConfidence ?? 0) - (a.parseConfidence ?? 0);
    return a.slug.length - b.slug.length;
  })[0];
}

function groupBy(rows, key) {
  const m = new Map();
  for (const row of rows) {
    const k = row[key];
    const arr = m.get(k);
    if (arr) arr.push(row);
    else m.set(k, [row]);
  }
  return m;
}

async function dedupe() {
  const recipes = await sql.query(
    'SELECT id, slug, title, "styleName", "batchSizeDisplay", og, fg, "sourceTimestamp", "parseConfidence", "cloneCount" FROM "Recipe"',
  );
  const ferms = groupBy(
    await sql.query('SELECT "recipeId", name, "amountLb", "colorLovibond" FROM "RecipeFermentable"'),
    "recipeId",
  );
  const hops = groupBy(
    await sql.query('SELECT "recipeId", name, "amountOz", "timeMinutes" FROM "RecipeHop"'),
    "recipeId",
  );
  const ysts = groupBy(await sql.query('SELECT "recipeId", name FROM "RecipeYeast"'), "recipeId");
  const commentCount = new Map(
    (await sql.query('SELECT "recipeId", count(*)::int AS c FROM "RecipeComment" GROUP BY "recipeId"')).map(
      (r) => [r.recipeId, r.c],
    ),
  );

  console.log(`${recipes.length} recipes loaded`);

  const groups = new Map();
  for (const rec of recipes) {
    const fp = fingerprint(rec, ferms, hops, ysts);
    const arr = groups.get(fp);
    if (arr) arr.push(rec);
    else groups.set(fp, [rec]);
  }

  const dupeGroups = [...groups.values()].filter((g) => g.length > 1);
  const redundant = dupeGroups.reduce((s, g) => s + g.length - 1, 0);
  console.log(
    `${dupeGroups.length} clone sets found, covering ${redundant} redundant rows ` +
      `(${recipes.length ? ((redundant / recipes.length) * 100).toFixed(1) : "0"}%)`,
  );

  for (const g of dupeGroups.slice(0, 10)) {
    const canon = pickCanonical(g, commentCount);
    const others = g.filter((x) => x.id !== canon.id);
    console.log(`  keep "${canon.slug}" <- ${others.map((o) => o.slug).join(", ")}`);
  }
  if (dupeGroups.length > 10) console.log(`  ... and ${dupeGroups.length - 10} more sets`);

  if (!APPLY) {
    console.log("\nDRY RUN - re-run with --apply to consolidate.");
    return;
  }

  let merged = 0;
  for (const g of dupeGroups) {
    const canon = pickCanonical(g, commentCount);
    const others = g.filter((x) => x.id !== canon.id);
    const ids = others.map((o) => o.id);
    const inList = ids.map((id) => `'${id.replace(/'/g, "''")}'`).join(",");

    await sql.query(`UPDATE "RecipeComment" SET "recipeId" = $1 WHERE "recipeId" IN (${inList})`, [canon.id]);
    await sql.query(`UPDATE "TakedownRequest" SET "recipeId" = $1 WHERE "recipeId" IN (${inList})`, [canon.id]);
    await sql.query(`DELETE FROM "Recipe" WHERE id IN (${inList})`);
    await sql.query(`UPDATE "Recipe" SET "cloneCount" = "cloneCount" + $1 WHERE id = $2`, [
      others.length,
      canon.id,
    ]);

    merged += others.length;
    if (merged % 500 < others.length) console.log(`  ... ${merged} rows consolidated`);
  }
  console.log(`done: consolidated ${merged} rows into ${dupeGroups.length} canonical recipes`);
}

async function main() {
  await applyMigrations();
  await dedupe();
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
