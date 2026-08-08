// Check every hop record against the merchant document it cites.
//
// WHY THIS EXISTS: an audit of the hop catalog found that 81 of 99 records
// disagreed with the document named in their own sourceUrl. Not by rounding —
// Sterling was stored at 0.6-1.0 mL/100 g total oil where the Haas page it
// cited prints 1.3-1.9; Fuggle's myrcene was stored at 40% where both merchants
// print 25-30; Contessa's alpha had been three times the published figure. The
// numbers were plausible and the citations looked fine, so nothing surfaced it.
//
// The failure was structural, not clerical. A citation is only worth anything if
// something checks that the cited document still says what the record claims,
// and nothing did. So the merchant sheets are now transcribed into
// data/hops/merchant-specs.json, each record names the exact entry it came from
// in specSource, and this compares the two on every run. A record can no longer
// drift from its source without the build going red.
//
// EXACT EQUALITY, deliberately. A tolerance would be a licence to be slightly
// wrong, and "slightly" is how 0.6-1.0 passes for 1.3-1.9 one edit at a time.
// The stored value either is what the sheet prints or it is not.
//
// Records with no specSource are allowed, but only if they hold no brewing
// values at all. That is the shape for a regional crop nobody publishes an
// analysis of — Cascade grown in Argentina, US-grown Tettnanger. The one thing
// that is never allowed is numbers with no document behind them.
//
// Usage: node validate-hops.mjs

import { readFileSync } from "node:fs";

const D = new URL("../data/hops/", import.meta.url).pathname;
const specs = JSON.parse(readFileSync(D + "merchant-specs.json", "utf8"));

// field in merchant-specs -> the pair of columns it lands in
const FIELDS = [
  ["alpha", "alphaMin", "alphaMax"],
  ["beta", "betaMin", "betaMax"],
  ["cohumulone", "cohumuloneMin", "cohumuloneMax"],
  ["totalOil", "totalOilMin", "totalOilMax"],
  ["myrcene", "myrceneMin", "myrceneMax"],
  ["humulene", "humuleneMin", "humuleneMax"],
  ["caryophyllene", "caryophylleneMin", "caryophylleneMax"],
  ["farnesene", "farneseneMin", "farneseneMax"],
];

/**
 * A published field to the [min, max] a record should hold.
 * {value:n} is a merchant printing one figure, not a range — stored as n-n.
 * {max,atMost} is "<n", a detection limit — stored as 0-n, never as n.
 * {min,atLeast} is ">n", which has no upper bound, so nothing can be stored.
 */
function bounds(f) {
  if (!f) return null;
  if (f.value != null) return [f.value, f.value];
  if (f.atMost) return [0, f.max];
  if (f.atLeast) return null;
  return [f.min, f.max];
}

const errors = [];
const warnings = [];
let checked = 0, fieldsChecked = 0, unsourced = 0;

for (const file of ["us.json", "world.json"]) {
  const doc = JSON.parse(readFileSync(D + file, "utf8"));
  for (const hop of doc.hops) {
    const where = `${file}:${hop.id}`;
    const held = FIELDS.filter(([, a, b]) => hop[a] != null || hop[b] != null);

    if (!hop.specSource) {
      unsourced++;
      if (held.length) {
        errors.push(
          `${where}: holds ${held.map(([f]) => f).join(", ")} but names no specSource. ` +
            `A number with no document behind it is the thing this file exists to prevent.`
        );
      }
      if (hop.sourceUrl) {
        errors.push(`${where}: has no specSource but still carries a sourceUrl (${hop.sourceUrl}).`);
      }
      if (!hop.attribution) {
        errors.push(`${where}: holds no source and does not say why.`);
      }
      continue;
    }

    const cut = hop.specSource.indexOf(":");
    const srcId = hop.specSource.slice(0, cut);
    const key = hop.specSource.slice(cut + 1);
    const source = specs.sources[srcId];
    const entry = specs.varieties[srcId]?.[key];
    if (!source) {
      errors.push(`${where}: specSource names "${srcId}", which is not a source in merchant-specs.json.`);
      continue;
    }
    if (!entry) {
      errors.push(`${where}: ${srcId} does not carry an entry "${key}".`);
      continue;
    }
    checked++;

    const url = entry.url ?? source.url;
    if (hop.sourceUrl !== url) {
      errors.push(`${where}: sourceUrl is ${hop.sourceUrl}\n      but its spec came from ${url}`);
    }

    for (const [field, minK, maxK] of FIELDS) {
      const want = bounds(entry[field]);
      const have = hop[minK] != null && hop[maxK] != null ? [hop[minK], hop[maxK]] : null;
      if (want == null && have == null) continue;
      if (want == null) {
        errors.push(
          `${where}: holds ${field} ${have[0]}-${have[1]}, but ${srcId} does not publish a usable ` +
            `${field} for ${key}.` + (entry.refused?.[field] ? ` It was refused: ${entry.refused[field]}` : "")
        );
        continue;
      }
      if (have == null) {
        // The publisher has a figure and the record does not. Not an error —
        // a record may legitimately be sparser than its source — but worth
        // seeing, because it is usually just an unfinished import.
        warnings.push(`${where}: ${srcId} publishes ${field} ${want[0]}-${want[1]} and the record omits it.`);
        continue;
      }
      fieldsChecked++;
      if (have[0] !== want[0] || have[1] !== want[1]) {
        errors.push(
          `${where}: ${field} is ${have[0]}-${have[1]} but ${srcId} prints ${want[0]}-${want[1]} for ${key}.`
        );
      }
      if (have[0] > have[1]) errors.push(`${where}: ${field} range is inverted (${have[0]} > ${have[1]}).`);
    }
  }
}

// A source nobody cites is dead weight in the evidence file; say so rather than
// letting merchant-specs.json quietly become an unused scrape.
const citedSources = new Set();
for (const file of ["us.json", "world.json"]) {
  for (const hop of JSON.parse(readFileSync(D + file, "utf8")).hops) {
    if (hop.specSource) citedSources.add(hop.specSource.slice(0, hop.specSource.indexOf(":")));
  }
}

console.log("Hop specification audit");
console.log("=======================");
console.log(`records checked against a merchant document: ${checked}`);
console.log(`records deliberately holding no source:      ${unsourced}`);
console.log(`individual figures compared:                 ${fieldsChecked}`);
for (const [id, s] of Object.entries(specs.sources)) {
  const n = Object.keys(specs.varieties[id] ?? {}).length;
  console.log(`  ${citedSources.has(id) ? "used" : "UNUSED"}  ${id}: ${n} varieties — ${s.publisher}`);
}
console.log("");

if (warnings.length) {
  console.log(`INCOMPLETE (${warnings.length}) — the source publishes a figure the record does not hold:`);
  for (const w of warnings.slice(0, 30)) console.log("  - " + w);
  if (warnings.length > 30) console.log(`  ... and ${warnings.length - 30} more`);
  console.log("");
}

if (errors.length) {
  console.error(`FAILURES (${errors.length}):`);
  for (const e of errors) console.error("  - " + e);
  console.error("\nFAILED");
  process.exit(1);
}
console.log("PASSED — every stored figure matches the document its record cites.");
