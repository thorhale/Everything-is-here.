// Provenance audit. Exits non-zero when the datasets make a claim their
// citations cannot support.
//
// Run:  node build-sources.mjs && node validate-sources.mjs
//
// Two classes of finding, deliberately treated differently:
//
//   HARD FAILURES are never acceptable and have no budget. A number resting on
//   an encyclopedia article, a citation to a domain nobody has classified, a
//   record with specs and no source at all, a source claiming a verification
//   level it has no document for. These fail the build outright.
//
//   BUDGETED DEBT is the large inherited problem: ~350 numeric claims citing a
//   publisher's homepage rather than the specific datasheet the number came
//   from. Those numbers are mostly real — a maltster's PPG did come from the
//   maltster — but a homepage is not a traceable citation, and I cannot
//   re-source several hundred rows in one pass without pretending to a
//   thoroughness I have not applied. So the count is committed to
//   sources-budget.json and this script fails if it goes UP, and rewrites the
//   file downward the moment it goes DOWN. The debt can only shrink, and it
//   shrinks without anyone remembering to record it. That is a ratchet, not an
//   excuse: the number is visible in CI and every dataset change must hold the
//   line or improve it.

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const REG = new URL("../data/sources/registry.json", import.meta.url).pathname;
const BUDGET = new URL("./sources-budget.json", import.meta.url).pathname;

const reg = JSON.parse(readFileSync(REG, "utf8"));
const hard = [];
const warn = [];

// --- Hard rule 1: a number may never rest on a tertiary source. ------------
for (const s of reg.sources) {
  if (s.numericCitations > 0 && s.reliability === "tertiary") {
    hard.push(
      `numeric claim on a ${s.reliability} source (${s.numericCitations}x): ${s.url}\n` +
        `      used by: ${s.exampleRecords.join(", ") || s.usedIn.join(", ")}\n` +
        `      fix: cite the measurement's publisher, or null the numbers.`
    );
  }
}

// --- Hard rule 2: a claimed verification level needs a retrievable document.
for (const s of reg.sources) {
  if (s.verification === "full-text" && !s.deepLink) {
    hard.push(`claims full-text verification but the URL is not a document: ${s.url}`);
  }
  if (s.verification !== "unverified" && !s.id) {
    hard.push(`claims verification "${s.verification}" but has no curated document entry: ${s.url}`);
  }
}

// --- Hard rule 3: a curated document must state what it does and doesn't hold.
for (const s of reg.sources) {
  if (s.id && !s.supports) {
    hard.push(`curated document "${s.id}" does not state what it supports: ${s.url}`);
  }
}

// --- Budgeted: numeric claims on a shallow (homepage-level) link. ----------
const shallowNumeric = reg.totals.numericOnShallowLink;
const worstOffenders = reg.sources
  .filter((s) => s.numericCitations > 0 && !s.deepLink)
  .sort((a, b) => b.numericCitations - a.numericCitations)
  .slice(0, 10);

// --- Informational: how much of the corpus has actually been read. ---------
const verified = reg.sources.filter((s) => s.verification === "full-text");
const metaOnly = reg.sources.filter((s) => s.verification === "metadata-only");

const budget = existsSync(BUDGET)
  ? JSON.parse(readFileSync(BUDGET, "utf8"))
  : { numericOnShallowLink: shallowNumeric, note: "baseline recorded on first run" };

let failed = false;

console.log("Provenance audit");
console.log("================");
console.log(`sources:            ${reg.totals.distinctSources}`);
console.log(`citations:          ${reg.totals.citations}  (${reg.totals.numericCitations} back numeric claims)`);
console.log(`by reliability:     ${JSON.stringify(reg.totals.byReliability)}`);
console.log(`read in full:       ${verified.length}  (${metaOnly.length} metadata-only)`);
console.log("");

if (hard.length) {
  failed = true;
  console.error(`HARD FAILURES (${hard.length}) — these have no budget:`);
  for (const h of hard) console.error("  - " + h);
  console.error("");
} else {
  console.log("HARD FAILURES: none.");
  console.log("  No numeric claim rests on an encyclopedia article; every claimed");
  console.log("  verification level has a retrievable document behind it.");
  console.log("");
}

console.log(`BUDGETED DEBT: ${shallowNumeric} numeric claims cite a publisher homepage`);
console.log(`  budget:      ${budget.numericOnShallowLink}`);
if (shallowNumeric > budget.numericOnShallowLink) {
  failed = true;
  console.error(`  REGRESSED by ${shallowNumeric - budget.numericOnShallowLink}. New numeric data must cite a specific document.`);
} else if (shallowNumeric < budget.numericOnShallowLink) {
  console.log(`  improved by ${budget.numericOnShallowLink - shallowNumeric} — ratcheting the budget down to match.`);
} else {
  console.log("  holding at budget.");
}
console.log("  worst offenders:");
for (const s of worstOffenders) {
  console.log(`    ${String(s.numericCitations).padStart(4)}  ${s.url}`);
  console.log(`          ${s.usedIn.join(", ")}`);
}
console.log("");

// The ratchet closes itself. An improvement that has to be committed by hand is
// an improvement that gets forgotten, and the debt then drifts back up to
// whatever the stale ceiling still allows. So a genuine improvement rewrites the
// budget on the spot: the number can only ever fall, and a later regression
// fails against the better figure rather than the old one. --no-update-budget
// opts out when a purely read-only check is wanted (CI on a pull request, say).
const improved = shallowNumeric < budget.numericOnShallowLink;
const mayUpdate =
  !hard.length &&
  shallowNumeric <= budget.numericOnShallowLink &&
  !process.argv.includes("--no-update-budget") &&
  (improved || process.argv.includes("--update-budget"));

if (mayUpdate) {
  writeFileSync(
    BUDGET,
    JSON.stringify(
      {
        numericOnShallowLink: shallowNumeric,
        note:
          "Ratchet baseline for numeric claims citing a publisher homepage rather than a specific document. " +
          "May only ever be lowered. Lower it by replacing homepage citations with deep links to the datasheet, " +
          "standard or record the figure actually came from. validate-sources.mjs lowers this " +
          "automatically whenever the count improves, so the ratchet cannot be forgotten.",
        updated: new Date().toISOString().slice(0, 10),
      },
      null,
      2
    ) + "\n"
  );
  console.log(`budget updated to ${shallowNumeric}`);
}

if (failed) {
  console.error("FAILED");
  process.exit(1);
}
console.log("PASSED");
