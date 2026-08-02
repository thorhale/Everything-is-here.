// Precompute every cross-recipe aggregate over the ingredient junction tables,
// so those tables can leave Postgres (docs/storage-efficiency.md, tier 3).
//
// Per-recipe reads are served by the gzipped shards; these are the queries that
// go the other way — "which hops appear in American IPAs", "how many recipes use
// Maris Otter". They cannot be answered from a per-recipe shard, so they are
// computed once here and shipped as static JSON.
//
// This costs nothing in freshness: every one of these queries was already
// wrapped in unstable_cache with a 1-hour revalidate, because the archive is
// static. It has not changed since BrewToad shut down in 2018.
//
// Usage: node --env-file=.neon.env build-archive-rollups.mjs
import { neon } from "@neondatabase/serverless";
import { gzipSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const URL_ = process.env.NEON_URL || process.env.DATABASE_URL;
if (!URL_) {
  console.error("Set NEON_URL. Try: node --env-file=.neon.env build-archive-rollups.mjs");
  process.exit(1);
}
const sql = neon(URL_);
const OUT_DIR = "../data/recipes";

const q = async (label, text) => {
  const rows = await sql.query(text);
  console.log(`  ${label}: ${rows.length.toLocaleString()} rows`);
  return rows;
};

// --- global ingredient catalogues (lib/ingredients.ts) ---------------------
const hopVarietals = await q("hop varietals", `
  SELECT "name", count(*)::int AS uses,
         round(avg("alphaAcidPct")::numeric,1)::float AS alpha
    FROM "RecipeHop" WHERE "name" IS NOT NULL AND "name" <> ''
   GROUP BY "name" HAVING count(*) >= 5
   ORDER BY count(*) DESC LIMIT 500`);

const yeastTypes = await q("yeast types", `
  SELECT "name", count(*)::int AS uses,
         round(avg("attenuationPct")::numeric,1)::float AS attenuation,
         string_agg(DISTINCT "labProduct", ', ') FILTER (WHERE "labProduct" IS NOT NULL) AS labs
    FROM "RecipeYeast" WHERE "name" IS NOT NULL AND "name" <> ''
   GROUP BY "name" HAVING count(*) >= 5
   ORDER BY count(*) DESC LIMIT 500`);

const fermentables = await q("fermentables", `
  SELECT "name", count(*)::int AS uses,
         round(avg("ppg")::numeric,0)::float AS ppg,
         round(avg("colorLovibond")::numeric,0)::float AS color,
         string_agg(DISTINCT "maltster", ', ')
           FILTER (WHERE "maltster" IS NOT NULL AND "maltster" <> 'Any') AS maltsters
    FROM "RecipeFermentable" WHERE "name" IS NOT NULL AND "name" <> ''
   GROUP BY "name" HAVING count(*) >= 5
   ORDER BY count(*) DESC LIMIT 500`);

const maltsters = await q("maltsters", `
  SELECT "maltster", count(*)::int AS uses, count(DISTINCT "name")::int AS products
    FROM "RecipeFermentable"
   WHERE "maltster" IS NOT NULL AND "maltster" <> '' AND "maltster" <> 'Any'
   GROUP BY "maltster" HAVING count(*) >= 5
   ORDER BY count(*) DESC LIMIT 100`);

// --- "how many recipes use this ingredient" (lib/archive-stats.ts) ---------
const recipeCounts = {};
for (const [key, table] of [["hop", "RecipeHop"], ["fermentable", "RecipeFermentable"], ["yeast", "RecipeYeast"]]) {
  const rows = await q(`${key} recipe counts`, `
    SELECT "name", count(DISTINCT "recipeId")::int AS recipes
      FROM "${table}" WHERE "name" IS NOT NULL AND "name" <> ''
     GROUP BY "name" HAVING count(DISTINCT "recipeId") >= 2`);
  recipeCounts[key] = Object.fromEntries(rows.map((r) => [r.name, r.recipes]));
}

// --- per-style ingredient usage (the "what brewers actually did" panels) ---
// Computed for every style at once rather than per request. Keeping the top 10
// matches the largest limit any caller asks for; callers slice further down.
const TOP = 10;
const styleTotals = Object.fromEntries(
  (await q("style recipe totals", `
     SELECT "styleName", count(*)::int AS n FROM "Recipe"
      WHERE "isHidden" = false AND "styleName" IS NOT NULL AND "styleName" <> ''
      GROUP BY "styleName"`)).map((r) => [r.styleName, r.n])
);

const styles = {};
for (const [key, table, amtCol] of [
  ["f", "RecipeFermentable", `round(avg(c."amountLb")::numeric,2)::float`],
  ["h", "RecipeHop", `round(avg(c."amountOz")::numeric,2)::float`],
  ["y", "RecipeYeast", `NULL::float`],
]) {
  const rows = await q(`per-style ${table}`, `
    SELECT * FROM (
      SELECT r."styleName" AS style, c."name" AS name,
             count(DISTINCT c."recipeId")::int AS recipes,
             ${amtCol} AS avg_amount,
             row_number() OVER (PARTITION BY r."styleName" ORDER BY count(DISTINCT c."recipeId") DESC, c."name") AS rn
        FROM "${table}" c
        JOIN "Recipe" r ON r.id = c."recipeId"
       WHERE r."isHidden" = false AND r."styleName" IS NOT NULL AND r."styleName" <> ''
         AND c."name" IS NOT NULL AND c."name" <> ''
       GROUP BY r."styleName", c."name"
    ) t WHERE rn <= ${TOP}`);
  for (const r of rows) {
    const total = styleTotals[r.style] ?? 0;
    ((styles[r.style] ??= {})[key] ??= []).push([
      r.name,
      r.recipes,
      total > 0 ? Math.round((r.recipes / total) * 100) : 0,
      r.avg_amount,
    ]);
  }
}

// --- per-name stats, for the /hops/[name] etc. detail pages ---------------
// Every name, not just the top 500 the catalogue pages show — those pages must
// resolve any ingredient a recipe mentions, however rare.
//
// `uses` is the row count and `recipes` the distinct-recipe count, and they are
// very different: hops get added several times per recipe (bittering, flavour,
// aroma, dry hop), so Citra shows 29,387 rows across only 11,759 recipes. The
// pages were printing the row count under the label "archived recipes",
// overstating by up to 2.5x. Both numbers are carried here so the label can be
// honest.
const nameStats = {};
for (const [key, table, extra] of [
  ["hop", "RecipeHop",
   `round(avg("alphaAcidPct")::numeric,1)::float AS alpha,
    string_agg(DISTINCT "form", ', ') FILTER (WHERE "form" IS NOT NULL) AS forms`],
  ["yeast", "RecipeYeast",
   `round(avg("attenuationPct")::numeric,1)::float AS attenuation,
    string_agg(DISTINCT "labProduct", ', ') FILTER (WHERE "labProduct" IS NOT NULL) AS labs`],
  ["fermentable", "RecipeFermentable",
   `round(avg("ppg")::numeric,0)::float AS ppg,
    round(avg("colorLovibond")::numeric,0)::float AS color,
    string_agg(DISTINCT "maltster", ', ') FILTER (WHERE "maltster" IS NOT NULL AND "maltster" <> 'Any') AS maltsters`],
]) {
  const rows = await q(`${key} per-name stats`, `
    SELECT "name", count(*)::int AS uses, count(DISTINCT "recipeId")::int AS recipes, ${extra}
      FROM "${table}" WHERE "name" IS NOT NULL AND "name" <> ''
     GROUP BY "name"`);
  const m = {};
  for (const r of rows) {
    const { name, ...rest } = r;
    m[name] = rest;
  }
  nameStats[key] = m;
}

// --- reverse index: ingredient name -> recipe ids -------------------------
// Backs "recipes using Cascade" on the ingredient pages, which today is a
// Prisma `some:` subquery against the junction table. 25 is the largest `take`
// any caller uses. Recipe itself stays in Postgres, so ids are enough.
const usedBy = {};
for (const [key, table] of [["hop", "RecipeHop"], ["fermentable", "RecipeFermentable"], ["yeast", "RecipeYeast"]]) {
  const rows = await q(`${key} -> recipes`, `
    SELECT name, id FROM (
      SELECT name, id, row_number() OVER (PARTITION BY name ORDER BY scraped DESC, id) AS rn
        FROM (
          -- DISTINCT first: a recipe can list the same ingredient several times
          -- (a hop at 60 min and again at 5), and those are one recipe, not two.
          SELECT DISTINCT c."name" AS name, r.id AS id, r."scrapedAt" AS scraped
            FROM "${table}" c
            JOIN "Recipe" r ON r.id = c."recipeId"
           WHERE r."isHidden" = false AND c."name" IS NOT NULL AND c."name" <> ''
        ) d
    ) t WHERE rn <= 25`);
  const m = {};
  for (const r of rows) (m[r.name] ??= []).push(r.id);
  usedBy[key] = m;
}

const payload = {
  generated: new Date().toISOString().slice(0, 10),
  usedBy,
  nameStats,
  note:
    "Precomputed aggregates over the recipe archive's ingredients. The archive is " +
    "static (BrewToad shut down in 2018), so these never go stale. Regenerate with " +
    "app/build-archive-rollups.mjs. Per-style arrays are [name, recipes, sharePct, avgAmount].",
  hopVarietals,
  yeastTypes,
  fermentables,
  maltsters,
  recipeCounts,
  styleTotals,
  styles,
};

mkdirSync(OUT_DIR, { recursive: true });
const raw = Buffer.from(JSON.stringify(payload));
const gz = gzipSync(raw, { level: 9 });
writeFileSync(`${OUT_DIR}/archive-rollups.json.gz`, gz);
console.log(
  `\nwrote ${OUT_DIR}/archive-rollups.json.gz — ${(raw.length / 1048576).toFixed(1)} MB raw, ` +
    `${(gz.length / 1048576).toFixed(2)} MB gzipped, ${Object.keys(styles).length} styles`
);
