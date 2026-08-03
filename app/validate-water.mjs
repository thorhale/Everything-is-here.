// Check every water profile's ions against electroneutrality.
//
// WHY THIS EXISTS: a real water analysis balances. Water is electrically
// neutral, so the positive charge carried by the cations (Ca, Mg, Na, K) has to
// equal the negative charge carried by the anions (HCO3, Cl, SO4, NO3, F) once
// each is converted from mg/L to milliequivalents. A published analysis that
// balances is almost certainly transcribed correctly; one that does not is
// either mistyped or — far more commonly — incomplete, because a brand
// published four of its ions and left the rest off the label.
//
// That second case is the one that bites. An incomplete ion set does not look
// broken: it looks like a water profile with some low numbers in it, and the
// salt calculator will happily build a recipe on top of it and be wrong. This
// check is what stopped several big brands going into data/water/profiles.json
// on partial figures.
//
// It is a data check, not a chemistry lesson: real analyses drift a few percent
// from unaccounted trace ions and from rounding on the label, so the tolerance
// is generous and the point is to catch the order-of-magnitude miss.
//
// Usage: node validate-water.mjs
import { readFileSync } from "node:fs";

const PROFILES = "../data/water/profiles.json";

// Equivalent weight = molar mass / |charge|, in mg per milliequivalent.
const CATIONS = { calcium: 20.04, magnesium: 12.15, sodium: 22.99, potassium: 39.1 };
const ANIONS = { bicarbonate: 61.02, chloride: 35.45, sulfate: 48.03, nitrate: 62.0, fluoride: 19.0 };

// Three tiers, because "does this balance?" only means something for figures
// that claim to be a measurement:
//
//   enforced — bottled waters. Each one is a bottler's or lab's published
//     analysis of an actual water, so it must balance or we have transcribed it
//     wrong or shipped an incomplete ion set. This is the gate.
//   reported — the historic and modern city profiles. These are representative
//     figures from the brewing literature, rounded and reconstructed rather
//     than a single lab report, and they list only the six brewing ions —
//     potassium, nitrate and silica are simply absent. They come out
//     systematically cation-heavy as a result. Printed for information; a big
//     gap is worth a look but is not by itself an error in our copy of them.
//   skipped — style targets. A target is a goal, not a water: it describes the
//     ions you are aiming to have, and several deliberately carry zero
//     bicarbonate. Charge balance is not a meaningful question to ask of one.
//
// Ranged profiles sit inside the enforced tier but on a looser leash. A brand
// blended from several springs publishes a min and a max per ion, and the
// midpoints we store are arithmetic across samples that never co-occurred — the
// lowest calcium and the lowest chloride come from different bottles, so there
// is no reason for the midpoints to balance exactly. A gross error still shows
// up, which is what we want the check for; a few percent of drift does not mean
// anything. The check that really holds them honest is the midpoint check
// further down: every stored value must be the midpoint of its published range.
const ENFORCED_KINDS = new Set(["bottled"]);
const SKIPPED_KINDS = new Set(["style-target"]);
const TOLERANCE_PCT = 5;
const VARIABLE_TOLERANCE_PCT = 15;

function meq(row, table) {
  let total = 0;
  for (const [key, eqWeight] of Object.entries(table)) {
    const v = row[key];
    if (typeof v === "number") total += v / eqWeight;
  }
  return total;
}

const doc = JSON.parse(readFileSync(PROFILES, "utf8"));
const failures = [];
const rangeProblems = [];
const rows = [];

let skipped = 0;
for (const p of doc.profiles) {
  if (SKIPPED_KINDS.has(p.kind)) {
    skipped++;
    continue;
  }
  const cat = meq(p, CATIONS);
  const an = meq(p, ANIONS);
  const sum = cat + an;
  // A blank slate (RO/distilled) is all zeroes and balances trivially; treating
  // 0/0 as a 100% error would fail the one profile we are surest about.
  const errPct = sum === 0 ? 0 : (Math.abs(cat - an) / (sum / 2)) * 100;
  const enforced = ENFORCED_KINDS.has(p.kind);
  const limit = p.variable ? VARIABLE_TOLERANCE_PCT : TOLERANCE_PCT;
  rows.push({ id: p.id, kind: p.kind, cat, an, errPct, enforced, variable: !!p.variable, limit });
  if (enforced && errPct > limit) {
    failures.push({ id: p.id, cat, an, errPct, limit });
  }

  // The check that actually matters for a ranged profile: the stored value must
  // be the midpoint of the published range, and the range must be the right way
  // round. Getting this wrong would put a number on the page that the bottler
  // never measured, which is the exact failure this whole file exists to stop.
  if (p.variable) {
    if (!p.ionRanges) {
      rangeProblems.push(`${p.id}: marked variable but carries no ionRanges`);
      continue;
    }
    for (const [ion, range] of Object.entries(p.ionRanges)) {
      if (!Array.isArray(range) || range.length !== 2) {
        rangeProblems.push(`${p.id}.${ion}: range is not a [min, max] pair`);
        continue;
      }
      const [lo, hi] = range;
      if (!(lo <= hi)) {
        rangeProblems.push(`${p.id}.${ion}: range [${lo}, ${hi}] is inverted`);
        continue;
      }
      const stored = p[ion];
      if (typeof stored !== "number") {
        rangeProblems.push(`${p.id}.${ion}: has a range but no stored value`);
        continue;
      }
      const expected = (lo + hi) / 2;
      if (Math.abs(stored - expected) > 0.01) {
        rangeProblems.push(
          `${p.id}.${ion}: stored ${stored} is not the midpoint of [${lo}, ${hi}] (expected ${expected})`
        );
      }
    }
  } else if (p.ionRanges) {
    rangeProblems.push(`${p.id}: carries ionRanges but is not marked variable`);
  }
}

const width = Math.max(...rows.map((r) => r.id.length));
for (const kind of [...new Set(rows.map((r) => r.kind))]) {
  const group = rows.filter((r) => r.kind === kind);
  console.log(`\n${kind}${group[0].enforced ? " (enforced)" : " (reported only)"}`);
  for (const r of group.sort((a, b) => b.errPct - a.errPct)) {
    const flag = r.errPct > r.limit ? (r.enforced ? " FAIL" : " cation-heavy") : "";
    const tag = r.variable ? " [range]" : "";
    console.log(
      `  ${r.id.padEnd(width)}  cations ${r.cat.toFixed(2).padStart(7)} meq  ` +
        `anions ${r.an.toFixed(2).padStart(7)} meq  off by ${r.errPct.toFixed(1).padStart(5)}%${tag}${flag}`
    );
  }
}

if (rangeProblems.length) {
  console.error(`\nFAIL: ${rangeProblems.length} problem(s) with published ion ranges:`);
  for (const m of rangeProblems) console.error(`  ${m}`);
}

if (failures.length) {
  console.error(`\nFAIL: ${failures.length} published analysis/analyses do not balance:`);
  for (const f of failures) {
    console.error(
      `  ${f.id}: ${f.cat.toFixed(2)} meq of cations against ${f.an.toFixed(2)} meq of anions ` +
        `(${f.errPct.toFixed(1)}% apart, limit ${f.limit}%). Either a figure is mistyped or the published ion set is ` +
        `incomplete — do not ship a partial analysis as a brewing profile.`
    );
  }
  process.exit(1);
}
if (rangeProblems.length) process.exit(1);

const enforcedCount = rows.filter((r) => r.enforced).length;
console.log(
  `\nOK: ${enforcedCount} published analyses balance (${TOLERANCE_PCT}% for a single analysis, ` +
    `${VARIABLE_TOLERANCE_PCT}% for a blended range), and every range is a well-formed pair whose ` +
    `midpoint matches the stored value. ${rows.length} profiles checked, ${skipped} style targets skipped.`
);
