// Load the yeast/culture database into Neon over HTTPS (port 5432 is blocked
// in the build sandbox). Secretless: reads NEON_URL. Idempotent: each lab is
// replaced wholesale (delete cascades its strains, then re-insert). Creates
// the two Yeast tables if missing, so it can run before prisma migrate ever
// touches production.
import { neon } from "@neondatabase/serverless";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const sql = neon(process.env.NEON_URL);
const DATA_DIR = process.env.YEASTS_DIR || "../data/yeasts";

const lit = (v) => {
  if (v == null) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return "'" + String(v).replace(/'/g, "''") + "'";
};

// Postgres TEXT[] literal, e.g. ARRAY['a','b']::TEXT[] (or empty array).
const litArr = (a) => {
  if (!Array.isArray(a) || a.length === 0) return "ARRAY[]::TEXT[]";
  return "ARRAY[" + a.map((x) => "'" + String(x).replace(/'/g, "''") + "'").join(",") + "]::TEXT[]";
};

const DDL = [
  `CREATE TABLE IF NOT EXISTS "YeastLab" (
    "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "country" TEXT, "region" TEXT,
    "url" TEXT, "description" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS "YeastLab_country_idx" ON "YeastLab"("country")`,
  `CREATE TABLE IF NOT EXISTS "YeastStrain" (
    "id" TEXT PRIMARY KEY,
    "labId" TEXT NOT NULL REFERENCES "YeastLab"("id") ON DELETE CASCADE,
    "productCode" TEXT, "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "form" TEXT NOT NULL, "species" TEXT NOT NULL,
    "uses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendedStyles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "styleTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attenuationMin" DOUBLE PRECISION, "attenuationMax" DOUBLE PRECISION,
    "tempMinF" DOUBLE PRECISION, "tempMaxF" DOUBLE PRECISION,
    "tempMinC" DOUBLE PRECISION, "tempMaxC" DOUBLE PRECISION,
    "flocculation" TEXT,
    "alcoholToleranceMin" DOUBLE PRECISION, "alcoholToleranceMax" DOUBLE PRECISION,
    "cellsPerUnit" DOUBLE PRECISION, "unitLabel" TEXT, "optimalPitchNote" TEXT,
    "isBlend" BOOLEAN NOT NULL DEFAULT FALSE,
    "blendComponents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT, "flavorNotes" TEXT, "sourceUrl" TEXT NOT NULL,
    "attribution" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS "YeastStrain_labId_idx" ON "YeastStrain"("labId")`,
  `CREATE INDEX IF NOT EXISTS "YeastStrain_name_idx" ON "YeastStrain"("name")`,
  `CREATE INDEX IF NOT EXISTS "YeastStrain_species_idx" ON "YeastStrain"("species")`,
];

// Column order for the strain insert (must match the value tuple below).
const STRAIN_COLS = [
  "id", "labId", "productCode", "name", "aliases", "form", "species", "uses",
  "recommendedStyles", "styleTags", "attenuationMin", "attenuationMax",
  "tempMinF", "tempMaxF", "tempMinC", "tempMaxC", "flocculation",
  "alcoholToleranceMin", "alcoholToleranceMax", "cellsPerUnit", "unitLabel",
  "optimalPitchNote", "isBlend", "blendComponents", "description", "flavorNotes",
  "sourceUrl", "attribution", "sortOrder",
];

function strainTuple(s, labId, i, attribution) {
  return "(" + [
    lit(s.id), lit(labId), lit(s.productCode ?? null), lit(s.name),
    litArr(s.aliases), lit(s.form), lit(s.species), litArr(s.uses),
    litArr(s.recommendedStyles), litArr(s.styleTags),
    lit(s.attenuationMin ?? null), lit(s.attenuationMax ?? null),
    lit(s.tempMinF ?? null), lit(s.tempMaxF ?? null),
    lit(s.tempMinC ?? null), lit(s.tempMaxC ?? null),
    lit(s.flocculation ?? null),
    lit(s.alcoholToleranceMin ?? null), lit(s.alcoholToleranceMax ?? null),
    lit(s.cellsPerUnit ?? null), lit(s.unitLabel ?? null),
    lit(s.optimalPitchNote ?? null), lit(s.isBlend ?? false),
    litArr(s.blendComponents), lit(s.description ?? null),
    lit(s.flavorNotes ?? null), lit(s.sourceUrl),
    lit(s.attribution ?? attribution ?? null), lit(s.sortOrder ?? i),
  ].join(",") + ")";
}

async function run() {
  for (const stmt of DDL) await sql.query(stmt);
  console.log("yeast tables ready");

  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json")).sort();
  for (const f of files) {
    const doc = JSON.parse(readFileSync(join(DATA_DIR, f), "utf8"));
    const lab = doc.lab;
    await sql.query(`DELETE FROM "YeastLab" WHERE id = ${lit(lab.id)}`);
    await sql.query(
      `INSERT INTO "YeastLab" ("id","name","country","region","url","description","sortOrder")
       VALUES (${lit(lab.id)}, ${lit(lab.name)}, ${lit(lab.country ?? null)}, ${lit(lab.region ?? null)}, ${lit(lab.url ?? null)}, ${lit(lab.description ?? null)}, ${lit(lab.sortOrder ?? 0)})`
    );
    const rows = doc.strains.map((s, i) => strainTuple(s, lab.id, i, doc.attribution));
    const colList = STRAIN_COLS.map((c) => `"${c}"`).join(",");
    for (let i = 0; i < rows.length; i += 40) {
      await sql.query(`INSERT INTO "YeastStrain" (${colList}) VALUES ${rows.slice(i, i + 40).join(",")}`);
    }
    console.log(`${lab.id}: ${rows.length} strains`);
  }
  const [{ c }] = await sql.query(`SELECT count(*)::int AS c FROM "YeastStrain"`);
  const [{ l }] = await sql.query(`SELECT count(*)::int AS l FROM "YeastLab"`);
  console.log(`DONE. ${l} labs, ${c} strains in Neon.`);
}

run().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
