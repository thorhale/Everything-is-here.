// Export the curated reference databases to a single JSON file.
//
// Why this exists: BrewToad died and took its data with it — that is the whole
// reason this project exists. A committed, self-contained export means the
// yeast/fermentable/hop/water work survives even if this site goes away:
// anyone can clone the repo and have the data, no database required.
//
// This deliberately covers ONLY the curated reference data — our own
// compilation from published manufacturer specs and legal standards. It does
// NOT include the recipe archive, which is community-contributed content
// subject to the takedown policy in docs/legal-notes.md.
//
// Usage: node export-reference.mjs            (reads data/*, no DB needed)
//        node export-reference.mjs --from-db  (reads Neon instead)
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = process.env.OUT || "../data/reference-export.json";
const FROM_DB = process.argv.includes("--from-db");

function readSet(dir, key) {
  const out = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
    const doc = JSON.parse(readFileSync(join(dir, f), "utf8"));
    const rows = doc[key] ?? [];
    for (const row of rows) {
      out.push({ ...row, attribution: row.attribution ?? doc.attribution ?? null });
    }
  }
  return out;
}

function readYeasts(dir) {
  const labs = [];
  const strains = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
    const doc = JSON.parse(readFileSync(join(dir, f), "utf8"));
    labs.push(doc.lab);
    for (const s of doc.strains) {
      strains.push({ ...s, labId: doc.lab.id, attribution: s.attribution ?? doc.attribution ?? null });
    }
  }
  return { labs, strains };
}

// Only the editions we compiled ourselves from primary legal/ethnographic
// sources travel in the export. BJCP, Brewers Association, AWS and the Maltose
// Falcons club guide are somebody else's work — we reproduce them on the site
// with attribution, but we don't hand out a bulk copy, same as the recipe
// archive. The international traditional editions are our own compilations and
// are included.
const OWN_GUIDELINE_SYSTEMS = new Set([
  "SPIRITS", "FERMENTED", "BEERLAW", "SAKE", "CIDERLAW",
  "CHINA", "KOREA", "INDIA", "CENTRALASIA", "AFRICA", "LATAM", "SEASIA", "EUROTRAD", "CULTURED",
  // NORTHAM (North American home, country and improvised ferments) is our own
  // compilation from cooperative-extension bulletins and public-health
  // reporting, so it travels like the other traditional editions. It was
  // missing here purely by oversight.
  "NORTHAM",
]);

// The fermentation archetypes — how yeast is handled for each family of drink,
// each cited to professional documentation. Our own compilation, so it ships
// in the export alongside the traditional guideline editions.
function readArchetypes() {
  const doc = JSON.parse(readFileSync("../data/fermentation/archetypes.json", "utf8"));
  return doc.archetypes ?? [];
}

function readGuidelines(dir) {
  const out = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
    const doc = JSON.parse(readFileSync(join(dir, f), "utf8"));
    if (!OWN_GUIDELINE_SYSTEMS.has(doc.system)) continue;
    out.push(doc);
  }
  return out;
}

async function fromFiles() {
  const { labs, strains } = readYeasts("../data/yeasts");
  return {
    yeastLabs: labs,
    yeastStrains: strains,
    fermentables: readSet("../data/fermentables", "fermentables"),
    hops: readSet("../data/hops", "hops"),
    waterProfiles: readSet("../data/water", "profiles"),
    additives: readSet("../data/additives", "additives"),
    legalStandards: readGuidelines("../data/guidelines"),
    fermentationArchetypes: readArchetypes(),
  };
}

async function fromDb() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.NEON_URL);
  const [yeastLabs, yeastStrains, fermentables, hops, waterProfiles, additives] = await Promise.all([
    sql.query(`SELECT * FROM "YeastLab" ORDER BY "sortOrder", name`),
    sql.query(`SELECT * FROM "YeastStrain" ORDER BY "labId", "sortOrder", name`),
    sql.query(`SELECT * FROM "Fermentable" ORDER BY category, "sortOrder", name`),
    sql.query(`SELECT * FROM "Hop" ORDER BY name`),
    sql.query(`SELECT * FROM "WaterProfile" ORDER BY kind, "sortOrder", name`),
    sql.query(`SELECT * FROM "Additive" ORDER BY category, "sortOrder", name`),
  ]);
  // The guideline tables are normalised across three tables in Neon; the
  // curated JSON is already the shape we want to publish, so read it from disk
  // either way.
  return {
    yeastLabs,
    yeastStrains,
    fermentables,
    hops,
    waterProfiles,
    additives,
    legalStandards: readGuidelines("../data/guidelines"),
    fermentationArchetypes: readArchetypes(),
  };
}

const data = FROM_DB ? await fromDb() : await fromFiles();

const payload = {
  $schema: "https://worthogg.example/reference-export.schema.json",
  generatedAt: new Date().toISOString().slice(0, 10),
  source: "WortHogg curated reference databases",
  license:
    "Compiled from publicly published manufacturer specifications, national/EU legal standards, " +
    "and standard brewing literature. Each record carries its own sourceUrl and attribution — " +
    "check those before redistributing. This export deliberately excludes the recipe archive, " +
    "which is community-contributed content subject to a takedown policy.",
  notes: {
    fermentables:
      "PPG is points per pound per US gallon. Where ppgBasis is 'nutrition', the value is derived " +
      "from the product's Nutrition Facts panel as 46 x (totalCarbG - fiberG) / servingSizeG; the " +
      "inputs are included so the arithmetic can be checked.",
    hops: "Alpha/beta acids vary by crop year and lot — these are typical published ranges, not a lot analysis.",
    water: "All ion values are ppm (mg/L). Municipal supplies vary seasonally; these are historical/representative profiles.",
    yeast: "cellsPerUnit is billions of viable cells per pack/vial/gram.",
    additives:
      "effectPerGramPerLitre is what one gram per litre does to the named metric - signed, so " +
      "deacidifiers are negative. Acids move titratable acidity roughly 1:1; DAP delivers 212 mg/L " +
      "YAN per g/L by stoichiometry. Dose ranges are typical practice, not limits: check your own " +
      "jurisdiction's legal maxima for sulphite and sorbate.",
    legalStandards:
      "Our own summaries of statutory and protected-designation standards (beer purity law, sake " +
      "classification, cider appellations, spirits standards of identity). Summaries, not legal " +
      "advice — check the current instrument for your jurisdiction. Third-party judging " +
      "guidelines (BJCP, Brewers Association, AWS) are deliberately excluded from this export.",
    fermentationArchetypes:
      "How yeast is handled for each family of drink — beer by cells/mL/degree Plato, wine and " +
      "cider by grams per hectolitre, sake and baijiu by starter culture, many traditional drinks " +
      "spontaneously or with no yeast at all. Every numeric figure carries the sourceUrl it came " +
      "from (AWRI, OIV, Scott Laboratories, peer-reviewed literature). Where researchStatus is " +
      "'pending' the approach is described but no figure is asserted — that is a deliberate gap, " +
      "not a missing value to be filled in with a guess. Each guideline category carries an " +
      "'archetype' key naming the record here that governs its ferment.",
  },
  counts: {
    yeastLabs: data.yeastLabs.length,
    yeastStrains: data.yeastStrains.length,
    fermentables: data.fermentables.length,
    hops: data.hops.length,
    waterProfiles: data.waterProfiles.length,
    additives: data.additives.length,
    legalStandardEditions: data.legalStandards.length,
    legalStandardEntries: data.legalStandards.reduce(
      (n, d) => n + d.categories.reduce((m, c) => m + c.styles.length, 0),
      0
    ),
    fermentationArchetypes: data.fermentationArchetypes.length,
    fermentationArchetypesSourced: data.fermentationArchetypes.filter(
      (a) => a.researchStatus === "sourced"
    ).length,
  },
  ...data,
};

writeFileSync(OUT, JSON.stringify(payload, null, 1) + "\n");
console.log(
  `wrote ${OUT}: ` +
    Object.entries(payload.counts).map(([k, v]) => `${v} ${k}`).join(", ")
);
