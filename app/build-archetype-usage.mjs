// Reverse index: archetype id -> the guideline categories that map to it.
// Static, bundled, so /fermentation can show usage with no database.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const GDIR = join(HERE, "..", "data", "guidelines");
const OUT = join(HERE, "lib", "generated", "archetype-usage.json");
// Forward map keyed exactly the way the DB keys a category — editionId
// (`${system.toLowerCase()}-${year}`) + category code — so the guideline
// style page can look up its ferment archetype with no database column.
const OUT_CAT = join(HERE, "lib", "generated", "category-archetype.json");

const usage = {};
const catMap = {};
for (const f of readdirSync(GDIR).filter((n) => n.endsWith(".json"))) {
  const d = JSON.parse(readFileSync(join(GDIR, f), "utf8"));
  const editionId = `${String(d.system).toLowerCase()}-${d.year}`;
  for (const c of d.categories ?? []) {
    if (!c.archetype) continue;
    (usage[c.archetype] ??= new Set()).add(`${d.system}: ${c.name}`);
    if (c.code != null) catMap[`${editionId}|${c.code}`] = c.archetype;
  }
}
const out = Object.fromEntries(Object.entries(usage).map(([k, v]) => [k, [...v].sort()]));
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out) + "\n");
writeFileSync(OUT_CAT, JSON.stringify(catMap) + "\n");
const total = Object.values(out).reduce((a, v) => a + v.length, 0);
console.log(
  `build-archetype-usage: ${Object.keys(out).length} archetypes, ${total} category mappings, ${Object.keys(catMap).length} category keys`
);
