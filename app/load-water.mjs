// Load water profiles into Neon over HTTPS. Secretless (NEON_URL), idempotent,
// self-provisioning DDL. Mirrors load-yeasts.mjs / load-ingredients.mjs.
import { neon } from "@neondatabase/serverless";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const sql = neon(process.env.NEON_URL);
const DIR = process.env.WATER_DIR || "../data/water";

const lit = (v) => {
  if (v == null) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  return "'" + String(v).replace(/'/g, "''") + "'";
};
const litArr = (a) =>
  !Array.isArray(a) || a.length === 0
    ? "ARRAY[]::TEXT[]"
    : "ARRAY[" + a.map((x) => "'" + String(x).replace(/'/g, "''") + "'").join(",") + "]::TEXT[]";

const DDL = [
  `CREATE TABLE IF NOT EXISTS "WaterProfile" (
    "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "kind" TEXT NOT NULL,
    "country" TEXT, "region" TEXT,
    "calcium" DOUBLE PRECISION, "magnesium" DOUBLE PRECISION, "sodium" DOUBLE PRECISION,
    "chloride" DOUBLE PRECISION, "sulfate" DOUBLE PRECISION, "bicarbonate" DOUBLE PRECISION,
    "description" TEXT, "bestForStyles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "styleTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceUrl" TEXT NOT NULL, "attribution" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS "WaterProfile_kind_idx" ON "WaterProfile"("kind")`,
  `CREATE INDEX IF NOT EXISTS "WaterProfile_name_idx" ON "WaterProfile"("name")`,
];

const COLS = ["id","name","kind","country","region","calcium","magnesium","sodium","chloride","sulfate","bicarbonate","description","bestForStyles","styleTags","sourceUrl","attribution","sortOrder"];

function tuple(w, i, attribution) {
  return "(" + [
    lit(w.id), lit(w.name), lit(w.kind), lit(w.country ?? null), lit(w.region ?? null),
    lit(w.calcium ?? null), lit(w.magnesium ?? null), lit(w.sodium ?? null),
    lit(w.chloride ?? null), lit(w.sulfate ?? null), lit(w.bicarbonate ?? null),
    lit(w.description ?? null), litArr(w.bestForStyles), litArr(w.styleTags),
    lit(w.sourceUrl), lit(w.attribution ?? attribution ?? null), lit(w.sortOrder ?? i),
  ].join(",") + ")";
}

async function run() {
  for (const stmt of DDL) await sql.query(stmt);
  console.log("water table ready");
  const colList = COLS.map((c) => `"${c}"`).join(",");
  for (const f of readdirSync(DIR).filter((x) => x.endsWith(".json")).sort()) {
    const doc = JSON.parse(readFileSync(join(DIR, f), "utf8"));
    const ids = doc.profiles.map((x) => lit(x.id)).join(",");
    await sql.query(`DELETE FROM "WaterProfile" WHERE id IN (${ids})`);
    const rows = doc.profiles.map((x, i) => tuple(x, i, doc.attribution));
    for (let i = 0; i < rows.length; i += 25) {
      await sql.query(`INSERT INTO "WaterProfile" (${colList}) VALUES ${rows.slice(i, i + 25).join(",")}`);
    }
    console.log(`${f}: ${doc.profiles.length}`);
  }
  const [{ c }] = await sql.query(`SELECT count(*)::int AS c FROM "WaterProfile"`);
  console.log(`DONE. ${c} water profiles in Neon.`);
}

run().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
