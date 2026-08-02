// Reverse index: archetype id -> the guideline categories that map to it.
// Static, bundled, so /fermentation can show usage with no database.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const GDIR = join(HERE, "..", "data", "guidelines");
const OUT = join(HERE, "lib", "generated", "archetype-usage.json");

const usage = {};
for (const f of readdirSync(GDIR).filter((n) => n.endsWith(".json"))) {
  const d = JSON.parse(readFileSync(join(GDIR, f), "utf8"));
  for (const c of d.categories ?? []) {
    if (!c.archetype) continue;
    (usage[c.archetype] ??= new Set()).add(`${d.system}: ${c.name}`);
  }
}
const out = Object.fromEntries(Object.entries(usage).map(([k, v]) => [k, [...v].sort()]));
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out) + "\n");
const total = Object.values(out).reduce((a, v) => a + v.length, 0);
console.log(`build-archetype-usage: ${Object.keys(out).length} archetypes, ${total} category mappings`);
