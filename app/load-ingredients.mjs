// Load the fermentable + hop catalogs into Neon over HTTPS (port 5432 is
// blocked in the build sandbox). Secretless: reads NEON_URL. Idempotent: each
// data file's rows are replaced wholesale. Creates the two tables if missing
// so it can run before prisma migrate touches production.
import { neon } from "@neondatabase/serverless";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const sql = neon(process.env.NEON_URL);
const FERM_DIR = process.env.FERMENTABLES_DIR || "../data/fermentables";
const HOPS_DIR = process.env.HOPS_DIR || "../data/hops";
const ADD_DIR = process.env.ADDITIVES_DIR || "../data/additives";

const lit = (v) => {
  if (v == null) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return "'" + String(v).replace(/'/g, "''") + "'";
};
const litArr = (a) =>
  !Array.isArray(a) || a.length === 0
    ? "ARRAY[]::TEXT[]"
    : "ARRAY[" + a.map((x) => "'" + String(x).replace(/'/g, "''") + "'").join(",") + "]::TEXT[]";

const DDL = [
  `CREATE TABLE IF NOT EXISTS "Fermentable" (
    "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "brand" TEXT, "category" TEXT NOT NULL, "type" TEXT NOT NULL, "origin" TEXT,
    "ppg" DOUBLE PRECISION, "yieldPct" DOUBLE PRECISION, "colorLovibond" DOUBLE PRECISION,
    "requiresConversion" BOOLEAN NOT NULL DEFAULT FALSE,
    "requiresGelatinization" BOOLEAN NOT NULL DEFAULT FALSE,
    "diastaticPowerLintner" DOUBLE PRECISION, "fermentabilityPct" DOUBLE PRECISION,
    "maxBatchPct" DOUBLE PRECISION, "ppgBasis" TEXT,
    "servingSizeG" DOUBLE PRECISION, "totalCarbG" DOUBLE PRECISION, "fiberG" DOUBLE PRECISION,
    "uses" TEXT[] DEFAULT ARRAY[]::TEXT[], "styleTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT, "flavorNotes" TEXT, "usageNotes" TEXT,
    "sourceUrl" TEXT NOT NULL, "attribution" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS "Fermentable_category_idx" ON "Fermentable"("category")`,
  `CREATE INDEX IF NOT EXISTS "Fermentable_name_idx" ON "Fermentable"("name")`,
  `CREATE INDEX IF NOT EXISTS "Fermentable_brand_idx" ON "Fermentable"("brand")`,
  // The sugar-mass columns arrived after the table did, so add them
  // idempotently rather than requiring a migration to have run first.
  ...[
    ["ppgMin", "DOUBLE PRECISION"], ["ppgMax", "DOUBLE PRECISION"],
    ["pfundColorMm", "DOUBLE PRECISION"],
    ["sugarGPer100g", "DOUBLE PRECISION"], ["sugarGPer100gMin", "DOUBLE PRECISION"],
    ["sugarGPer100gMax", "DOUBLE PRECISION"],
    ["juiceBrix", "DOUBLE PRECISION"], ["juiceBrixMin", "DOUBLE PRECISION"],
    ["juiceBrixMax", "DOUBLE PRECISION"], ["juiceYieldPct", "DOUBLE PRECISION"],
    ["moisturePct", "DOUBLE PRECISION"],
    ["titratableAcidityGPerL", "DOUBLE PRECISION"],
    ["titratableAcidityMinGPerL", "DOUBLE PRECISION"],
    ["titratableAcidityMaxGPerL", "DOUBLE PRECISION"],
    ["dominantAcid", "TEXT"], ["phTypical", "DOUBLE PRECISION"],
    ["phMin", "DOUBLE PRECISION"], ["phMax", "DOUBLE PRECISION"],
    ["pectinLevel", "TEXT"], ["tanninLevel", "TEXT"], ["fruitGroup", "TEXT"],
    ["species", "TEXT"], ["grapeColor", "TEXT"],
  ].map(([col, type]) => `ALTER TABLE "Fermentable" ADD COLUMN IF NOT EXISTS "${col}" ${type}`),
  `CREATE INDEX IF NOT EXISTS "Fermentable_fruitGroup_idx" ON "Fermentable"("fruitGroup")`,
  `CREATE TABLE IF NOT EXISTS "Additive" (
    "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" TEXT NOT NULL, "subtype" TEXT,
    "uses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "doseMinGPerL" DOUBLE PRECISION, "doseMaxGPerL" DOUBLE PRECISION, "doseUnit" TEXT,
    "effectMetric" TEXT, "effectPerGramPerLitre" DOUBLE PRECISION, "effectUnit" TEXT,
    "contactTime" TEXT, "description" TEXT NOT NULL, "usageNotes" TEXT, "cautions" TEXT,
    "sourceUrl" TEXT NOT NULL, "attribution" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS "Additive_category_idx" ON "Additive"("category")`,
  `CREATE INDEX IF NOT EXISTS "Additive_name_idx" ON "Additive"("name")`,
  `CREATE TABLE IF NOT EXISTS "Hop" (
    "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[], "country" TEXT, "purpose" TEXT,
    "alphaMin" DOUBLE PRECISION, "alphaMax" DOUBLE PRECISION,
    "betaMin" DOUBLE PRECISION, "betaMax" DOUBLE PRECISION,
    "cohumuloneMin" DOUBLE PRECISION, "cohumuloneMax" DOUBLE PRECISION,
    "totalOilMin" DOUBLE PRECISION, "totalOilMax" DOUBLE PRECISION,
    "myrcenePct" DOUBLE PRECISION, "humulenePct" DOUBLE PRECISION,
    "caryophyllenePct" DOUBLE PRECISION, "farnescenePct" DOUBLE PRECISION,
    "aromaDescriptors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "substitutes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "styleTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "breeder" TEXT, "yearReleased" INTEGER, "description" TEXT, "usageNotes" TEXT,
    "sourceUrl" TEXT NOT NULL, "attribution" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS "Hop_country_idx" ON "Hop"("country")`,
  `CREATE INDEX IF NOT EXISTS "Hop_name_idx" ON "Hop"("name")`,
  `CREATE INDEX IF NOT EXISTS "Hop_purpose_idx" ON "Hop"("purpose")`,
];

const FERM_COLS = ["id","name","aliases","brand","category","type","origin","ppg","yieldPct","colorLovibond","requiresConversion","requiresGelatinization","diastaticPowerLintner","fermentabilityPct","maxBatchPct","ppgBasis","servingSizeG","totalCarbG","fiberG","uses","styleTags","description","flavorNotes","usageNotes","sourceUrl","attribution","sortOrder",
  "ppgMin","ppgMax","pfundColorMm","sugarGPer100g","sugarGPer100gMin","sugarGPer100gMax","juiceBrix","juiceBrixMin","juiceBrixMax","juiceYieldPct","moisturePct","titratableAcidityGPerL","titratableAcidityMinGPerL","titratableAcidityMaxGPerL","dominantAcid","phTypical","phMin","phMax","pectinLevel","tanninLevel","fruitGroup","species","grapeColor"];

const ADD_COLS = ["id","name","aliases","category","subtype","uses","doseMinGPerL","doseMaxGPerL","doseUnit","effectMetric","effectPerGramPerLitre","effectUnit","contactTime","description","usageNotes","cautions","sourceUrl","attribution","sortOrder"];

const HOP_COLS = ["id","name","aliases","country","purpose","alphaMin","alphaMax","betaMin","betaMax","cohumuloneMin","cohumuloneMax","totalOilMin","totalOilMax","myrcenePct","humulenePct","caryophyllenePct","farnescenePct","aromaDescriptors","substitutes","styleTags","breeder","yearReleased","description","usageNotes","sourceUrl","attribution","sortOrder"];

function fermTuple(f, i, attribution) {
  return "(" + [
    lit(f.id), lit(f.name), litArr(f.aliases), lit(f.brand ?? null), lit(f.category), lit(f.type),
    lit(f.origin ?? null), lit(f.ppg ?? null), lit(f.yieldPct ?? null), lit(f.colorLovibond ?? null),
    lit(f.requiresConversion ?? false), lit(f.requiresGelatinization ?? false),
    lit(f.diastaticPowerLintner ?? null), lit(f.fermentabilityPct ?? null), lit(f.maxBatchPct ?? null),
    lit(f.ppgBasis ?? null), lit(f.servingSizeG ?? null), lit(f.totalCarbG ?? null), lit(f.fiberG ?? null),
    litArr(f.uses), litArr(f.styleTags), lit(f.description ?? null), lit(f.flavorNotes ?? null),
    lit(f.usageNotes ?? null), lit(f.sourceUrl), lit(f.attribution ?? attribution ?? null), lit(f.sortOrder ?? i),
    lit(f.ppgMin ?? null), lit(f.ppgMax ?? null), lit(f.pfundColorMm ?? null),
    lit(f.sugarGPer100g ?? null), lit(f.sugarGPer100gMin ?? null), lit(f.sugarGPer100gMax ?? null),
    lit(f.juiceBrix ?? null), lit(f.juiceBrixMin ?? null), lit(f.juiceBrixMax ?? null),
    lit(f.juiceYieldPct ?? null), lit(f.moisturePct ?? null),
    lit(f.titratableAcidityGPerL ?? null), lit(f.titratableAcidityMinGPerL ?? null),
    lit(f.titratableAcidityMaxGPerL ?? null), lit(f.dominantAcid ?? null),
    lit(f.phTypical ?? null), lit(f.phMin ?? null), lit(f.phMax ?? null),
    lit(f.pectinLevel ?? null), lit(f.tanninLevel ?? null), lit(f.fruitGroup ?? null),
    lit(f.species ?? null), lit(f.grapeColor ?? null),
  ].join(",") + ")";
}

function addTuple(a, i, attribution) {
  return "(" + [
    lit(a.id), lit(a.name), litArr(a.aliases), lit(a.category), lit(a.subtype ?? null),
    litArr(a.uses), lit(a.doseMinGPerL ?? null), lit(a.doseMaxGPerL ?? null), lit(a.doseUnit ?? null),
    lit(a.effectMetric ?? null), lit(a.effectPerGramPerLitre ?? null), lit(a.effectUnit ?? null),
    lit(a.contactTime ?? null), lit(a.description), lit(a.usageNotes ?? null), lit(a.cautions ?? null),
    lit(a.sourceUrl), lit(a.attribution ?? attribution ?? null), lit(a.sortOrder ?? i),
  ].join(",") + ")";
}

function hopTuple(h, i, attribution) {
  return "(" + [
    lit(h.id), lit(h.name), litArr(h.aliases), lit(h.country ?? null), lit(h.purpose ?? null),
    lit(h.alphaMin ?? null), lit(h.alphaMax ?? null), lit(h.betaMin ?? null), lit(h.betaMax ?? null),
    lit(h.cohumuloneMin ?? null), lit(h.cohumuloneMax ?? null),
    lit(h.totalOilMin ?? null), lit(h.totalOilMax ?? null),
    lit(h.myrcenePct ?? null), lit(h.humulenePct ?? null),
    lit(h.caryophyllenePct ?? null), lit(h.farnescenePct ?? null),
    litArr(h.aromaDescriptors), litArr(h.substitutes), litArr(h.styleTags),
    lit(h.breeder ?? null), lit(h.yearReleased ?? null), lit(h.description ?? null),
    lit(h.usageNotes ?? null), lit(h.sourceUrl), lit(h.attribution ?? attribution ?? null), lit(h.sortOrder ?? i),
  ].join(",") + ")";
}

async function insertBatched(table, cols, rows) {
  const colList = cols.map((c) => `"${c}"`).join(",");
  for (let i = 0; i < rows.length; i += 25) {
    await sql.query(`INSERT INTO "${table}" (${colList}) VALUES ${rows.slice(i, i + 25).join(",")}`);
  }
}

async function run() {
  for (const stmt of DDL) await sql.query(stmt);
  console.log("fermentable + hop tables ready");

  for (const f of readdirSync(FERM_DIR).filter((x) => x.endsWith(".json")).sort()) {
    const doc = JSON.parse(readFileSync(join(FERM_DIR, f), "utf8"));
    const ids = doc.fermentables.map((x) => lit(x.id)).join(",");
    await sql.query(`DELETE FROM "Fermentable" WHERE id IN (${ids})`);
    await insertBatched("Fermentable", FERM_COLS, doc.fermentables.map((x, i) => fermTuple(x, i, doc.attribution)));
    console.log(`fermentables/${f}: ${doc.fermentables.length}`);
  }

  for (const f of readdirSync(HOPS_DIR).filter((x) => x.endsWith(".json")).sort()) {
    const doc = JSON.parse(readFileSync(join(HOPS_DIR, f), "utf8"));
    const ids = doc.hops.map((x) => lit(x.id)).join(",");
    await sql.query(`DELETE FROM "Hop" WHERE id IN (${ids})`);
    await insertBatched("Hop", HOP_COLS, doc.hops.map((x, i) => hopTuple(x, i, doc.attribution)));
    console.log(`hops/${f}: ${doc.hops.length}`);
  }

  for (const f of readdirSync(ADD_DIR).filter((x) => x.endsWith(".json")).sort()) {
    const doc = JSON.parse(readFileSync(join(ADD_DIR, f), "utf8"));
    const ids = doc.additives.map((x) => lit(x.id)).join(",");
    await sql.query(`DELETE FROM "Additive" WHERE id IN (${ids})`);
    await insertBatched("Additive", ADD_COLS, doc.additives.map((x, i) => addTuple(x, i, doc.attribution)));
    console.log(`additives/${f}: ${doc.additives.length}`);
  }

  // Delete-and-reinsert only touches ids that are still in the files, so an
  // id that gets renamed leaves an orphan row behind that no page will ever
  // show and no file explains. Prune anything the data files no longer claim.
  for (const [table, dir, key] of [
    ["Fermentable", FERM_DIR, "fermentables"],
    ["Hop", HOPS_DIR, "hops"],
    ["Additive", ADD_DIR, "additives"],
  ]) {
    const known = readdirSync(dir)
      .filter((x) => x.endsWith(".json"))
      .flatMap((x) => JSON.parse(readFileSync(join(dir, x), "utf8"))[key].map((r) => lit(r.id)));
    const orphans = await sql.query(`SELECT id FROM "${table}" WHERE id NOT IN (${known.join(",")})`);
    if (orphans.length > 0) {
      await sql.query(`DELETE FROM "${table}" WHERE id NOT IN (${known.join(",")})`);
      console.log(`pruned ${orphans.length} stale ${table} row(s): ${orphans.map((o) => o.id).join(", ")}`);
    }
  }

  const [{ f }] = await sql.query(`SELECT count(*)::int AS f FROM "Fermentable"`);
  const [{ h }] = await sql.query(`SELECT count(*)::int AS h FROM "Hop"`);
  const [{ a }] = await sql.query(`SELECT count(*)::int AS a FROM "Additive"`);
  console.log(`DONE. ${f} fermentables, ${h} hops, ${a} additives in Neon.`);
}

run().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
