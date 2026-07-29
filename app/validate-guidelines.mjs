// Validate every guideline edition file: required keys present, beverage on
// each category drawn from the canonical family list, sourceType from the
// known set, no duplicate (system, year). Run: node validate-guidelines.mjs
// Fails loudly (exit 1) so a bad scrape can't silently mis-file.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "../data/guidelines";
const FAMILIES = new Set(["beer", "wine", "cider", "mead", "spirit", "sake", "fortified", "traditional"]);
const SOURCE_TYPES = new Set(["competition", "legal-standard", "club", "traditional"]);

let errors = 0;
const err = (f, msg) => { console.log(`FAIL ${f}: ${msg}`); errors++; };
const seenSysYear = new Set();
let editions = 0, categories = 0, styles = 0;

for (const file of readdirSync(DIR).filter((x) => x.endsWith(".json")).sort()) {
  let doc;
  try { doc = JSON.parse(readFileSync(join(DIR, file), "utf8")); }
  catch (e) { err(file, `invalid JSON: ${e.message}`); continue; }
  editions++;

  for (const k of ["system", "year", "title", "sourceUrl", "attribution", "categories"]) {
    if (doc[k] == null) err(file, `missing edition key "${k}"`);
  }
  if (typeof doc.year !== "number") err(file, `year must be a number, got ${typeof doc.year}`);
  if (doc.sourceType && !SOURCE_TYPES.has(doc.sourceType)) err(file, `unknown sourceType "${doc.sourceType}"`);

  const key = `${doc.system}-${doc.year}`;
  if (seenSysYear.has(key)) err(file, `duplicate (system, year): ${key}`);
  seenSysYear.add(key);

  if (!Array.isArray(doc.categories)) { err(file, "categories is not an array"); continue; }
  for (const c of doc.categories) {
    categories++;
    if (!c.name) err(file, `category missing name (code ${c.code ?? "?"})`);
    if (!c.beverage) err(file, `category "${c.name}" missing beverage`);
    else if (!FAMILIES.has(c.beverage)) err(file, `category "${c.name}" has unknown beverage "${c.beverage}"`);
    if (!Array.isArray(c.styles) || c.styles.length === 0) err(file, `category "${c.name}" has no styles`);
    for (const s of c.styles ?? []) {
      styles++;
      if (!s.name) err(file, `a style in "${c.name}" is missing a name`);
      // A numeric field, if present, must be a finite number or null.
      for (const nf of ["ogMin", "ogMax", "abvMin", "abvMax", "ibuMin", "ibuMax", "srmMin", "srmMax"]) {
        if (s[nf] != null && typeof s[nf] !== "number") err(file, `style "${s.name}" field ${nf} is not numeric`);
      }
    }
  }
}

console.log(`\n${editions} editions, ${categories} categories, ${styles} styles checked.`);
console.log(errors === 0 ? "OK — all valid." : `${errors} error(s).`);
process.exit(errors === 0 ? 0 : 1);
