// Check every diastatic-power figure against the sheet its record cites.
//
// WHY THIS EXISTS: an audit of the 23 diastatic-power figures this catalogue
// held found that 22 of them were not the figure the cited document printed.
//
//   - Briess Goldpils Vienna prints "Diastatic Power (Lintner) 95". The record
//     said 60. Bonlander prints 60; the record said 40. Cherry Wood Smoked
//     prints 90; the record said 40.
//   - Simpsons publishes 47-74 °Lintner for Golden Promise. The record said 120,
//     which is above anything Simpsons prints for any malt they make.
//   - BESTMALZ and Castle both print 250 WK, which is 76 °Lintner. The records
//     said 110, 90 and 65 — three different numbers from one published figure.
//   - Weyermann publishes a diastatic power for exactly ONE malt in a 63-page
//     catalogue, and eight records cited that catalogue for a number.
//   - Crisp's specification sheets carry no diastatic power row at all, and two
//     records cited them for one.
//
// Only Briess Brewers Malt matched. None of it was catchable, because a bare
// Float has nothing to check against: validate-sources can tell you a citation
// resolves, not that the number is inside it. So the maltsters' printed figures
// now live in data/fermentables/maltster-specs.json, each record names the entry
// it came from in diastaticSpecSource, and this compares the two on every run.
//
// EXACT EQUALITY on the published figure, and the derived °Lintner has to
// recompute from it. A tolerance would be a licence to be slightly wrong, and
// "slightly" is how 60 becomes 95 one edit at a time.
//
// Usage: node validate-diastatic.mjs
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIR = new URL("../data/fermentables/", import.meta.url).pathname;
const BUDGET = new URL("./diastatic-budget.json", import.meta.url).pathname;
const SPECS = JSON.parse(readFileSync(join(DIR, "maltster-specs.json"), "utf8"));

// Same relations as lib/diastatic-power.ts, verified in maltster-specs.json
// against Simpsons, who publish all three scales for the same malt.
const wkToLintner = (wk) => (wk + 16) / 3.5;
const iobToLintner = (iob) => wkToLintner(iob * 3.75);

const BASES = new Set([
  "published",
  "published-zero",
  "published-qualitative",
  "process-zero",
  "unmalted",
  "withdrawn-source",
  "unpublished",
]);
// A basis that asserts the ingredient genuinely brings no enzymes must store 0,
// not null: null means "nobody published one", and the conversion check moves in
// the opposite direction on the two.
const MUST_BE_ZERO = new Set(["published-zero", "process-zero", "unmalted"]);
// A basis that asserts nothing is known must NOT store a number.
const MUST_BE_NULL = new Set(["published-qualitative", "unpublished"]);

const records = [];
for (const file of readdirSync(DIR).filter((f) => f.endsWith(".json")).sort()) {
  if (file === "maltster-specs.json") continue;
  const doc = JSON.parse(readFileSync(join(DIR, file), "utf8"));
  for (const r of doc.fermentables ?? []) records.push({ ...r, _file: file });
}

const errors = [];
const counts = {};
let checkedAgainstSheet = 0;

for (const r of records) {
  const id = `${r._file}:${r.id}`;
  const basis = r.diastaticPowerBasis ?? null;
  const dp = r.diastaticPowerLintner ?? null;

  // --- a starch source or a malt must say where it stands -------------------
  const isMalt = r.category === "base-malt" || r.category === "specialty-malt";
  if ((isMalt || r.requiresConversion) && !basis) {
    errors.push(
      `${id}: is a malt or a starch source and has no diastaticPowerBasis. Say whether the figure ` +
        `is published, a declared zero, or genuinely unknown — a blank column cannot tell them apart.`
    );
    continue;
  }
  if (!basis) continue;
  counts[basis] = (counts[basis] ?? 0) + 1;

  if (!BASES.has(basis)) {
    errors.push(`${id}: diastaticPowerBasis "${basis}" is not one of ${[...BASES].join(", ")}`);
    continue;
  }
  if (MUST_BE_ZERO.has(basis) && dp !== 0) {
    errors.push(`${id}: basis "${basis}" asserts no enzymes, so diastaticPowerLintner must be 0, not ${dp}`);
  }
  if (MUST_BE_NULL.has(basis) && dp != null) {
    errors.push(
      `${id}: basis "${basis}" means nothing is published, so diastaticPowerLintner must be null, not ${dp}`
    );
  }
  if (basis === "published" && dp == null) {
    errors.push(`${id}: basis "published" but no diastaticPowerLintner`);
  }
  if (dp != null && (dp < 0 || dp > 400)) {
    errors.push(`${id}: ${dp} °Lintner is outside anything a malt has ever analysed at`);
  }

  // --- a published figure has to name, and match, its sheet -----------------
  if (basis !== "published" && basis !== "published-zero") continue;
  if (!r.diastaticSpecSource) {
    errors.push(`${id}: basis "${basis}" but no diastaticSpecSource naming the entry it came from`);
    continue;
  }
  const cut = r.diastaticSpecSource.indexOf("/");
  const [key, name] = [r.diastaticSpecSource.slice(0, cut), r.diastaticSpecSource.slice(cut + 1)];
  const entry = SPECS.malts[key]?.[name];
  if (!entry) {
    errors.push(`${id}: diastaticSpecSource "${r.diastaticSpecSource}" is not in maltster-specs.json`);
    continue;
  }
  const f = entry.diastaticPower;
  if (!f) {
    errors.push(`${id}: cites ${r.diastaticSpecSource}, which publishes no diastatic power`);
    continue;
  }
  checkedAgainstSheet++;

  if (r.diastaticPowerPublished !== f.published) {
    errors.push(
      `${id}: stores published "${r.diastaticPowerPublished}" but the sheet prints "${f.published}"`
    );
  }
  if (r.diastaticPowerUnit !== f.unit) {
    errors.push(`${id}: stores unit "${r.diastaticPowerUnit}" but the sheet is in "${f.unit}"`);
  }
  if (!!r.diastaticPowerAtLeast !== !!f.atLeast) {
    errors.push(
      `${id}: the sheet prints ${f.atLeast ? "a floor (\">n\")" : "a plain figure"} and the record ` +
        `${r.diastaticPowerAtLeast ? "claims a floor" : "does not"}`
    );
  }

  // --- and the derived °Lintner has to recompute from it --------------------
  const conv = f.unit === "wk" ? wkToLintner : f.unit === "iob" ? iobToLintner : (v) => v;
  let expected;
  if (f.value != null) expected = conv(f.value);
  else if (f.min != null && f.max != null) expected = (conv(f.min) + conv(f.max)) / 2;
  else expected = conv(f.min ?? f.max);
  // maltster-specs rounds its derived °Lintner to one decimal, so allow that
  // much and no more — this is a rounding allowance, not a tolerance.
  if (dp == null || Math.abs(dp - expected) > 0.05) {
    errors.push(
      `${id}: stores ${dp} °Lintner, but "${f.published}" (${f.unit}) works out at ${expected.toFixed(2)}`
    );
  }
  if (f.min != null && f.max != null) {
    if (!(f.min < f.max)) errors.push(`${id}: published range ${f.min}-${f.max} is not ascending`);
    if (r.diastaticPowerMin !== f.min || r.diastaticPowerMax !== f.max) {
      errors.push(
        `${id}: stores range ${r.diastaticPowerMin}-${r.diastaticPowerMax} against the sheet's ${f.min}-${f.max}`
      );
    }
  }
  if (entry.alphaAmylaseDu != null && r.alphaAmylaseDu !== entry.alphaAmylaseDu) {
    errors.push(
      `${id}: stores alpha amylase ${r.alphaAmylaseDu} DU against the sheet's ${entry.alphaAmylaseDu}`
    );
  }
}

// --- the ratchet -----------------------------------------------------------
//
// Records that carry no usable figure because nobody published one. This may
// only ever fall: it falls when a maltster is found who publishes, or when a
// record moves to a maltster who does.
const unknown = (counts["unpublished"] ?? 0) + (counts["published-qualitative"] ?? 0);
const budget = existsSync(BUDGET) ? JSON.parse(readFileSync(BUDGET, "utf8")) : { unknownDiastaticPower: unknown };

console.log("Diastatic power");
console.log("===============");
console.log(`${records.length} fermentables; ${checkedAgainstSheet} figures checked against the sheet they cite.`);
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(22)} ${String(v).padStart(4)}`);
}
console.log("");

let failed = errors.length > 0;
if (errors.length) {
  console.error(`FAIL: ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error("");
}

console.log(`NO PUBLISHED FIGURE: ${unknown} record(s)`);
console.log(`  budget:            ${budget.unknownDiastaticPower}`);
if (unknown > budget.unknownDiastaticPower) {
  failed = true;
  console.error(
    `  REGRESSED by ${unknown - budget.unknownDiastaticPower}. A malt arriving without a diastatic ` +
      `power has to come with the maltster who does publish one, or displace one that does not.`
  );
} else if (unknown < budget.unknownDiastaticPower) {
  console.log(`  improved by ${budget.unknownDiastaticPower - unknown} — ratcheting down.`);
} else {
  console.log("  holding at budget.");
}

if (!failed && unknown < budget.unknownDiastaticPower) {
  writeFileSync(
    BUDGET,
    JSON.stringify(
      {
        unknownDiastaticPower: unknown,
        note:
          "Records carrying no diastatic power because their maltster publishes none — basis " +
          "\"unpublished\" or \"published-qualitative\". May only ever be lowered, by finding a " +
          "maltster who publishes a figure. validate-diastatic.mjs rewrites this the moment it " +
          "improves and fails the build if it rises.",
        updated: new Date().toISOString().slice(0, 10),
      },
      null,
      2
    ) + "\n"
  );
  console.log(`  budget updated to ${unknown}`);
}

if (failed) {
  console.error("FAILED");
  process.exit(1);
}
console.log("\nOK: every published figure matches the sheet its record cites, every derived °Lintner");
console.log("recomputes from the maltster's own printed value, and every malt says where it stands.");
