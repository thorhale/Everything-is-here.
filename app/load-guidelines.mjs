// Load the style-guidelines archive into Neon over HTTPS (port 5432 is
// blocked in the build sandbox). Secretless: reads NEON_URL env. Idempotent:
// each edition is replaced wholesale (delete + insert). Creates the three
// Guideline tables if missing, so it can run before prisma migrate ever
// touches production.
import { neon } from "@neondatabase/serverless";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const sql = neon(process.env.NEON_URL);
const DATA_DIR = process.env.GUIDELINES_DIR || "../data/guidelines";

const lit = (v) => {
  if (v == null) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (Array.isArray(v)) v = v.join(", ");
  return "'" + String(v).replace(/'/g, "''") + "'";
};

const DDL = [
  `CREATE TABLE IF NOT EXISTS "GuidelineEdition" (
    "id" TEXT PRIMARY KEY, "system" TEXT NOT NULL, "year" INTEGER NOT NULL,
    "title" TEXT NOT NULL, "sourceUrl" TEXT NOT NULL, "attribution" TEXT NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "GuidelineEdition_system_year_key" ON "GuidelineEdition"("system", "year")`,
  `CREATE TABLE IF NOT EXISTS "GuidelineCategory" (
    "id" TEXT PRIMARY KEY,
    "editionId" TEXT NOT NULL REFERENCES "GuidelineEdition"("id") ON DELETE CASCADE,
    "code" TEXT, "name" TEXT NOT NULL, "sortOrder" INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS "GuidelineCategory_editionId_idx" ON "GuidelineCategory"("editionId")`,
  `CREATE TABLE IF NOT EXISTS "GuidelineStyle" (
    "id" TEXT PRIMARY KEY,
    "categoryId" TEXT NOT NULL REFERENCES "GuidelineCategory"("id") ON DELETE CASCADE,
    "code" TEXT, "name" TEXT NOT NULL, "sortOrder" INTEGER NOT NULL,
    "ogMin" DOUBLE PRECISION, "ogMax" DOUBLE PRECISION,
    "fgMin" DOUBLE PRECISION, "fgMax" DOUBLE PRECISION,
    "ibuMin" DOUBLE PRECISION, "ibuMax" DOUBLE PRECISION,
    "srmMin" DOUBLE PRECISION, "srmMax" DOUBLE PRECISION,
    "abvMin" DOUBLE PRECISION, "abvMax" DOUBLE PRECISION,
    "impression" TEXT, "aroma" TEXT, "appearance" TEXT, "flavor" TEXT,
    "mouthfeel" TEXT, "comments" TEXT, "history" TEXT, "ingredients" TEXT,
    "comparison" TEXT, "examples" TEXT, "tags" TEXT)`,
  `CREATE INDEX IF NOT EXISTS "GuidelineStyle_categoryId_idx" ON "GuidelineStyle"("categoryId")`,
  `CREATE INDEX IF NOT EXISTS "GuidelineStyle_name_idx" ON "GuidelineStyle"("name")`,
  // Added after the tables existed; provision idempotently so the loader works
  // before `prisma migrate` runs.
  `ALTER TABLE "GuidelineEdition" ADD COLUMN IF NOT EXISTS "sourceType" TEXT`,
  `ALTER TABLE "GuidelineCategory" ADD COLUMN IF NOT EXISTS "beverage" TEXT`,
  // Per-style provenance. An edition-level sourceUrl is not enough once an
  // edition carries styles drawn from different documents, which is the norm
  // for the traditional editions where each style has its own citation.
  `ALTER TABLE "GuidelineStyle" ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT`,
  `CREATE INDEX IF NOT EXISTS "GuidelineCategory_beverage_idx" ON "GuidelineCategory"("beverage")`,
];

// Minimal beverage inference mirroring lib/beverages.ts, for any category a
// data file leaves untagged. Category-level: one edition can span several
// beverages (BJCP: beer+mead+cider; FERMENTED: fortified+rice+agave).
function inferBeverage(system, code, name) {
  const sys = (system || "").toUpperCase();
  const c = (code || "").toUpperCase();
  const n = (name || "").toLowerCase();
  if (/\bmead\b|honey wine|melomel|cyser|pyment|metheglin|braggot/.test(n)) return "mead";
  if (/\bcider\b|\bperry\b|sidra|sagardo|apfelwein|poir/.test(n)) return "cider";
  if (/fortified|aromatis|vermouth|\bport\b|sherry|madeira|marsala/.test(n)) return "fortified";
  if (/sake|seishu|\brice\b|huangjiu|makgeolli|cheongju|takju|yakju/.test(n)) return "sake";
  if (/spirit|whisk|brandy|\brum\b|agave|tequila|mezcal|baijiu|soju|distill|liqueur|\bgin\b|vodka/.test(n)) return "spirit";
  if (sys === "BJCP") return c.startsWith("M") ? "mead" : c.startsWith("C") ? "cider" : "beer";
  if (sys === "BA" || sys === "BEERLAW" || sys === "MF") return "beer";
  if (sys === "AWS") return "wine";
  if (sys === "SPIRITS") return "spirit";
  if (sys === "SAKE") return "sake";
  if (sys === "CIDERLAW") return "cider";
  return "traditional";
}

const TEXT_FIELDS = [
  "impression", "aroma", "appearance", "flavor", "mouthfeel",
  "comments", "history", "ingredients", "comparison", "examples", "tags",
  // Must stay in this list. A style's sourceUrl is what app/build-sources.mjs
  // audits its numbers against, so if the loader drops it the provenance gate
  // passes on a citation the running site never actually has.
  "sourceUrl",
];
const NUM_FIELDS = [
  "ogMin", "ogMax", "fgMin", "fgMax", "ibuMin", "ibuMax",
  "srmMin", "srmMax", "abvMin", "abvMax",
];

async function run() {
  for (const stmt of DDL) await sql.query(stmt);
  console.log("guideline tables ready");

  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json")).sort();
  const loadedEids = [];
  for (const f of files) {
    const doc = JSON.parse(readFileSync(join(DATA_DIR, f), "utf8"));
    const eid = `${doc.system.toLowerCase()}-${doc.year}`;
    loadedEids.push(eid);
    await sql.query(`DELETE FROM "GuidelineEdition" WHERE id = ${lit(eid)}`);
    await sql.query(
      `INSERT INTO "GuidelineEdition" ("id","system","year","title","sourceType","sourceUrl","attribution")
       VALUES (${lit(eid)}, ${lit(doc.system)}, ${doc.year}, ${lit(doc.title)}, ${lit(doc.sourceType ?? null)}, ${lit(doc.sourceUrl)}, ${lit(doc.attribution)})`
    );
    const catRows = [];
    const styleRows = [];
    doc.categories.forEach((c, ci) => {
      const cid = `${eid}-c${ci}`;
      const bev = c.beverage ?? inferBeverage(doc.system, c.code, c.name);
      catRows.push(`(${lit(cid)}, ${lit(eid)}, ${lit(c.code)}, ${lit(c.name)}, ${lit(bev)}, ${ci})`);
      c.styles.forEach((s, si) => {
        const nums = NUM_FIELDS.map((k) => lit(s[k])).join(",");
        const texts = TEXT_FIELDS.map((k) => lit(s[k])).join(",");
        styleRows.push(`(${lit(`${cid}-s${si}`)}, ${lit(cid)}, ${lit(s.code)}, ${lit(s.name)}, ${si}, ${nums}, ${texts})`);
      });
    });
    await sql.query(
      `INSERT INTO "GuidelineCategory" ("id","editionId","code","name","beverage","sortOrder") VALUES ${catRows.join(",")}`
    );
    for (let i = 0; i < styleRows.length; i += 40) {
      await sql.query(
        `INSERT INTO "GuidelineStyle" ("id","categoryId","code","name","sortOrder",${NUM_FIELDS.map((k) => `"${k}"`).join(",")},${TEXT_FIELDS.map((k) => `"${k}"`).join(",")})
         VALUES ${styleRows.slice(i, i + 40).join(",")}`
      );
    }
    console.log(`${eid}: ${catRows.length} categories, ${styleRows.length} styles`);
  }

  // Prune editions no longer present in the data files — e.g. when an
  // edition's year is corrected, its old `system-year` id would otherwise
  // linger. Cascades to its categories and styles.
  const keep = loadedEids.map(lit).join(",");
  const orphans = await sql.query(`SELECT id FROM "GuidelineEdition" WHERE id NOT IN (${keep})`);
  if (orphans.length) {
    await sql.query(`DELETE FROM "GuidelineEdition" WHERE id NOT IN (${keep})`);
    console.log(`pruned ${orphans.length} stale edition(s): ${orphans.map((o) => o.id).join(", ")}`);
  }

  const [{ c }] = await sql.query(`SELECT count(*)::int AS c FROM "GuidelineStyle"`);
  console.log("DONE. total guideline styles in Neon:", c);
}

run().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
