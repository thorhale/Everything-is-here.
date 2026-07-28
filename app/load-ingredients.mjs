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

const FERM_COLS = ["id","name","aliases","brand","category","type","origin","ppg","yieldPct","colorLovibond","requiresConversion","requiresGelatinization","diastaticPowerLintner","fermentabilityPct","maxBatchPct","ppgBasis","servingSizeG","totalCarbG","fiberG","uses","styleTags","description","flavorNotes","usageNotes","sourceUrl","attribution","sortOrder"];

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

  const [{ f }] = await sql.query(`SELECT count(*)::int AS f FROM "Fermentable"`);
  const [{ h }] = await sql.query(`SELECT count(*)::int AS h FROM "Hop"`);
  console.log(`DONE. ${f} fermentables, ${h} hops in Neon.`);
}

run().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
