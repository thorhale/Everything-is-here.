// Tier 3 of docs/storage-efficiency.md: lift the recipe archive's ingredient
// detail out of Postgres into gzipped static shards.
//
// WHY THIS WORKS WHEN COLUMN COMPRESSION DID NOT: Postgres only compresses a
// value past the ~2 KB TOAST threshold, and every ingredient field is a short
// string well under it — so none of it is compressed in the database. Gzip over
// a whole shard file sees all the repetition at once (the same few hundred malt
// names, "Boil", "Pellet", "60 min") and gets 8.5x. Measured on the parse
// sample: 1,106 bytes/recipe raw, 130 bytes/recipe gzipped.
//
// The archive is read-only and never changes, and the detail page reads exactly
// one recipe at a time — which is what makes a static shard the right shape.
//
// Usage: node --env-file=.neon.env export-recipe-ingredients.mjs
import { neon } from "@neondatabase/serverless";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const URL_ = process.env.NEON_URL || process.env.DATABASE_URL;
if (!URL_) {
  console.error("Set NEON_URL. Try: node --env-file=.neon.env export-recipe-ingredients.mjs");
  process.exit(1);
}
const sql = neon(URL_);

const OUT = "../data/recipes/ingredients";
// 1024 shards keeps each file around 15 KB gzipped / ~30 recipes, so serving one
// recipe decompresses a small file rather than a large one.
const SHARDS = 1024;
const PAGE = 5000;

/** Which shard a slug lives in. Stable, so a rebuild does not reshuffle. */
export function shardFor(slug) {
  const h = createHash("sha1").update(slug).digest();
  return ((h[0] << 2) | (h[1] >> 6)) % SHARDS;
}

const bySlug = new Map();
const touch = (slug) => {
  let e = bySlug.get(slug);
  if (!e) bySlug.set(slug, (e = { f: [], h: [], y: [], m: [] }));
  return e;
};

// Recipe id -> slug, so the child rows can be filed without joining every page.
process.stdout.write("loading recipe slugs... ");
const slugOf = new Map();
for (let off = 0; ; off += PAGE) {
  const rows = await sql.query(
    `SELECT id, slug FROM "Recipe" ORDER BY id LIMIT ${PAGE} OFFSET ${off}`
  );
  for (const r of rows) slugOf.set(r.id, r.slug);
  if (rows.length < PAGE) break;
}
console.log(`${slugOf.size.toLocaleString()} recipes`);

// Array-of-arrays, not objects: repeating JSON keys a million times is exactly
// the redundancy this exercise exists to remove.
const SOURCES = [
  {
    key: "f",
    table: "RecipeFermentable",
    cols: `"recipeId","name","amountDisplay","amountLb","percent","maltster","use","ppg","colorLovibond","refId","sortOrder"`,
    order: `"recipeId","sortOrder"`,
    row: (r) => [r.name, r.amountDisplay, r.amountLb, r.percent, r.maltster, r.use, r.ppg, r.colorLovibond, r.refId],
  },
  {
    key: "h",
    table: "RecipeHop",
    cols: `"recipeId","name","amountDisplay","amountOz","timeDisplay","timeMinutes","use","form","alphaAcidPct","refId","sortOrder"`,
    order: `"recipeId","sortOrder"`,
    row: (r) => [r.name, r.amountDisplay, r.amountOz, r.timeDisplay, r.timeMinutes, r.use, r.form, r.alphaAcidPct, r.refId],
  },
  {
    key: "y",
    table: "RecipeYeast",
    cols: `"recipeId","name","labProduct","attenuationPct","refId"`,
    order: `"recipeId"`,
    row: (r) => [r.name, r.labProduct, r.attenuationPct, r.refId],
  },
  {
    key: "m",
    table: "RecipeMisc",
    cols: `"recipeId","name","amount","use","time"`,
    order: `"recipeId"`,
    row: (r) => [r.name, r.amount, r.use, r.time],
  },
];

for (const s of SOURCES) {
  let n = 0;
  for (let off = 0; ; off += PAGE) {
    const rows = await sql.query(
      `SELECT ${s.cols} FROM "${s.table}" ORDER BY ${s.order} LIMIT ${PAGE} OFFSET ${off}`
    );
    for (const r of rows) {
      const slug = slugOf.get(r.recipeId);
      if (!slug) continue; // orphan row, no parent recipe
      touch(slug)[s.key].push(s.row(r));
    }
    n += rows.length;
    process.stdout.write(`  ${s.table}: ${n.toLocaleString()} rows\r`);
    if (rows.length < PAGE) break;
  }
  console.log(`  ${s.table}: ${n.toLocaleString()} rows`);
}

// Bucket into shards and write.
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const shards = Array.from({ length: SHARDS }, () => ({}));
for (const [slug, e] of bySlug) {
  // Drop empty arrays so absent categories cost nothing.
  const out = {};
  for (const k of ["f", "h", "y", "m"]) if (e[k].length) out[k] = e[k];
  shards[shardFor(slug)][slug] = out;
}

let raw = 0, gz = 0, written = 0;
for (let i = 0; i < SHARDS; i++) {
  const keys = Object.keys(shards[i]);
  if (!keys.length) continue;
  const buf = Buffer.from(JSON.stringify(shards[i]));
  const z = gzipSync(buf, { level: 9 });
  writeFileSync(join(OUT, `${i.toString(16).padStart(3, "0")}.json.gz`), z);
  raw += buf.length;
  gz += z.length;
  written++;
}

const MB = 1048576;
console.log(`\nwrote ${written} shards to ${OUT}`);
console.log(`  recipes covered : ${bySlug.size.toLocaleString()}`);
console.log(`  raw JSON        : ${(raw / MB).toFixed(1)} MB`);
console.log(`  gzipped on disk : ${(gz / MB).toFixed(1)} MB   (${(raw / gz).toFixed(1)}x)`);
console.log(`  replaces ~270 MB of Postgres junction tables`);
