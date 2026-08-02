// Estimate what each storage change would reclaim, from measured string
// distributions rather than guesswork.
//
// WHY THIS EXISTS: the obvious answer to "the database is too big" is "turn on
// compression", and for this data that answer is wrong. Postgres only
// compresses a value once it exceeds the TOAST threshold (~2 KB); every column
// in the recipe archive is a short string well under it, so they are stored
// raw and compression never engages. The size is not compressible bulk, it is
// *redundancy* — the same few hundred ingredient names and a reconstructible
// URL repeated across a million rows. Redundancy is removed by restructuring,
// not by zipping.
//
// Measurements come from data/parsed/m1_sample.jsonl (a real scrape sample);
// row counts are the production figures recorded in prisma/schema.prisma and
// the per-recipe ratios measured from the sample. Re-run against the live
// database with neon-space-audit.mjs to check the estimate.
//
// Usage: node storage-savings.mjs
import { readFileSync } from "node:fs";

const SAMPLE = "../data/parsed/m1_sample.jsonl";

// Production row counts. Fermentable/hop counts are stated in
// prisma/schema.prisma; the rest scale from the sample's per-recipe ratio.
const RECIPES = 118_000;
const FERMENTABLES = 513_000;
const HOPS = 453_000;

const MB = 1024 * 1024;

// --- Postgres storage facts used below ------------------------------------
// A short text/varchar value costs its length plus a 1-byte length header.
// int2 = 2 bytes, int4 = 4, float4 = 4, float8 = 8. A NULL costs nothing in
// the row's null bitmap, so a column's cost scales with how often it is
// present. None of these values approach the ~2 KB TOAST threshold, so none of
// them is ever compressed on disk.
const textCost = (avgLen) => avgLen + 1;

const recs = readFileSync(SAMPLE, "utf8")
  .split("\n")
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l));

const child = (key) => recs.flatMap((r) => (r.html ?? {})[key] ?? []);
const ferm = child("fermentables");
const hops = child("hops");
const yeasts = child("yeasts");

const YEASTS = Math.round((yeasts.length / recs.length) * RECIPES);

/** Average length and presence rate of a field across sampled rows. */
function field(rows, name) {
  const vals = rows.map((r) => r[name]).filter((v) => v != null && v !== "");
  if (!vals.length) return { present: 0, avgLen: 0, distinct: 0 };
  const total = vals.reduce((n, v) => n + String(v).length, 0);
  return {
    present: vals.length / rows.length,
    avgLen: total / vals.length,
    distinct: new Set(vals.map(String)).size,
  };
}

const changes = [];
const add = (name, bytes, note) => changes.push({ name, bytes, note });

// --- A. refUrl -> refId ----------------------------------------------------
// Verified against the sample: 100% of ref_urls match
//   /web/<recipe's own sourceTimestamp>/https://www.brewtoad.com/<path>/<id>
// with the timestamp always equal to the recipe's html_timestamp (already
// stored on Recipe) and only three path segments, each implied by which table
// the row lives in. The whole string is reconstructible from one integer.
for (const [label, rows, count] of [
  ["RecipeFermentable.refUrl", ferm, FERMENTABLES],
  ["RecipeHop.refUrl", hops, HOPS],
  ["RecipeYeast.refUrl", yeasts, YEASTS],
]) {
  const f = field(rows, "ref_url");
  const saved = count * f.present * (textCost(f.avgLen) - 4);
  add(`${label} → refId int4`, saved, `avg ${f.avgLen.toFixed(0)} chars, ${(f.present * 100).toFixed(0)}% present`);
}

// --- B. drop the orphaned cuid id columns ---------------------------------
// schema.prisma says these were demoted from primary key and kept only so
// "existing code that reads f.id — React list keys, lookup maps — keeps
// working". (recipeId, sortOrder) is already the identity and makes a perfectly
// good React key.
for (const [label, count] of [
  ["RecipeFermentable.id", FERMENTABLES],
  ["RecipeHop.id", HOPS],
]) {
  add(`drop ${label} (orphaned cuid)`, count * textCost(25), "no longer a key; nothing queries it");
}

// --- C. dictionary-encode the repeated short strings ----------------------
// These are the columns where the same handful of values repeat across every
// row: four values of `use`, three of `form`, a dozen maltsters.
const dict = [
  ["RecipeFermentable.name", ferm, "name", FERMENTABLES, 4],
  ["RecipeFermentable.maltster", ferm, "maltster", FERMENTABLES, 2],
  ["RecipeFermentable.use", ferm, "use", FERMENTABLES, 2],
  ["RecipeHop.name", hops, "name", HOPS, 4],
  ["RecipeHop.use", hops, "use", HOPS, 2],
  ["RecipeHop.form", hops, "form", HOPS, 2],
  ["RecipeHop.timeDisplay", hops, "time_display", HOPS, 2],
  ["RecipeYeast.name", yeasts, "name", YEASTS, 4],
  ["RecipeYeast.labProduct", yeasts, "lab_product", YEASTS, 4],
];
for (const [label, rows, key, count, width] of dict) {
  const f = field(rows, key);
  if (!f.present) continue;
  const saved = count * f.present * (textCost(f.avgLen) - width);
  add(`${label} → lookup id int${width}`, saved, `${f.distinct} distinct in sample, avg ${f.avgLen.toFixed(1)} chars`);
}

// --- D. float8 -> float4 --------------------------------------------------
// Brewing values carry at most four significant digits; float4 holds about
// seven. Realising this needs the columns reordered so the narrower types do
// not just become alignment padding.
const floats = [
  ["Recipe", RECIPES, 6],
  ["RecipeFermentable", FERMENTABLES, 3],
  ["RecipeHop", HOPS, 3],
  ["RecipeYeast", YEASTS, 1],
];
for (const [label, count, n] of floats) {
  add(`${label}: ${n} × float8 → float4`, count * n * 4, "needs column reordering to avoid padding");
}

// --- E/F. derived columns that need not be stored -------------------------
{
  const f = field(ferm, "percent");
  add(
    "RecipeFermentable.percent (derived from amountLb)",
    FERMENTABLES * f.present * textCost(f.avgLen),
    "computable from the bill at render time"
  );
}
add(
  "Recipe.sourceUrl (derived from slug)",
  RECIPES * textCost("https://www.brewtoad.com/recipes/".length + 8),
  "slug is already a column"
);

changes.sort((a, b) => b.bytes - a.bytes);

const total = changes.reduce((n, c) => n + c.bytes, 0);
const pad = Math.max(...changes.map((c) => c.name.length));

console.log(`sample: ${recs.length} recipes → ${ferm.length} fermentables, ${hops.length} hops, ${yeasts.length} yeasts`);
console.log(`scaled to: ${RECIPES.toLocaleString()} recipes, ${FERMENTABLES.toLocaleString()} fermentables, ` +
            `${HOPS.toLocaleString()} hops, ${YEASTS.toLocaleString()} yeasts\n`);
console.log("estimated heap reclaimed per change (indexes shrink on top of this):\n");
for (const c of changes) {
  console.log(`  ${(c.bytes / MB).toFixed(1).padStart(6)} MB  ${c.name.padEnd(pad)}  ${c.note}`);
}
console.log(`\n  ${(total / MB).toFixed(1).padStart(6)} MB  TOTAL`);
console.log(`\nAgainst a 368 MB database on a 512 MB tier, that is ${((total / MB / 368) * 100).toFixed(0)}% of current usage.`);
console.log("Note: none of this comes from compression. Every value here is far below");
console.log("Postgres's ~2 KB TOAST threshold, so none of it is compressed today and");
console.log("enabling LZ4 would change nothing. The size is redundancy, not bulk.");
