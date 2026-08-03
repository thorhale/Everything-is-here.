// Check every water profile's ions against electroneutrality.
//
// WHY THIS EXISTS: a real water analysis balances. Water is electrically
// neutral, so the positive charge carried by the cations (Ca, Mg, Na, K) has to
// equal the negative charge carried by the anions (HCO3, Cl, SO4, NO3, F) once
// each is converted from mg/L to milliequivalents. A published analysis that
// balances is almost certainly transcribed correctly; one that does not has
// either been mistyped or is missing something substantial.
//
// The failure this guards against is an incomplete ion set, because it does not
// look broken: it looks like a water profile with some low numbers in it, and
// the salt calculator will happily build a recipe on top of it and be wrong.
//
// BUT — and this was overstated when this file was first written — charge
// balance does NOT reliably catch a missing ion. It catches a missing ion only
// when that ion carries a real share of the charge. Delete the sulfate from
// Badoit, whose 1250 ppm bicarbonate dwarfs its 35 ppm sulfate, and the balance
// moves by 0.2%: invisible. So balance is the check for transcription errors and
// for gross inconsistency, and COMPLETENESS is a separate check that has to be
// made separately — every bottled profile must actually carry all six ions.
// Both run below; neither substitutes for the other.
//
// It is a data check, not a chemistry lesson: real analyses drift a few percent
// from unaccounted trace ions and from rounding on the label — bottlers commonly
// round alkalinity to two significant figures, which alone moves the balance a
// couple of percent — so the tolerance is generous and the point is to catch the
// order-of-magnitude miss.
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

// 8%, not the 5% this started at. 5% was a guess, and it was never tested near
// its limit — every profile admitted under it happened to sit at 4.5% or below,
// so it looked strict when it had simply never been challenged. Two things set
// the number honestly. Below: bottlers round alkalinity to two significant
// figures ("150", "85", "22"), and that rounding alone moves a balance by around
// 3%, so anything under about 5% is measuring our arithmetic rather than their
// water. Above: every ion set actually rejected for being partial was out by 20%
// or more, because what those brands omitted was a major ion. 8% sits in the
// gap. It is not load-bearing for completeness — REQUIRED_IONS is.
const TOLERANCE_PCT = 8;
const VARIABLE_TOLERANCE_PCT = 15;

// The check that actually guarantees a full ion set. A bottled profile claims to
// be a published analysis, so all six brewing ions must be present — a null is a
// figure the bottler never gave us, and a profile missing one cannot be brewed
// to no matter how well the rest balances. Zero is a legitimate value here (RO
// water really is zero); absent is not.
const REQUIRED_IONS = ["calcium", "magnesium", "sodium", "chloride", "sulfate", "bicarbonate"];

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
const incomplete = [];
const rows = [];

let skipped = 0;
for (const p of doc.profiles) {
  if (SKIPPED_KINDS.has(p.kind)) {
    skipped++;
    continue;
  }
  if (ENFORCED_KINDS.has(p.kind)) {
    const missing = REQUIRED_IONS.filter((ion) => typeof p[ion] !== "number");
    if (missing.length) {
      incomplete.push(`${p.id}: no published figure for ${missing.join(", ")}`);
    }
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

if (incomplete.length) {
  console.error(`\nFAIL: ${incomplete.length} bottled profile(s) do not carry all six ions:`);
  for (const m of incomplete) console.error(`  ${m}`);
  console.error(
    `  A partial analysis cannot be brewed to, and charge balance will not catch it — a missing ` +
      `minor ion barely moves the balance at all. Get the full published set or drop the profile.`
  );
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
if (rangeProblems.length || incomplete.length) process.exit(1);

const enforcedCount = rows.filter((r) => r.enforced).length;
console.log(
  `\nOK: ${enforcedCount} published analyses balance (${TOLERANCE_PCT}% for a single analysis, ` +
    `${VARIABLE_TOLERANCE_PCT}% for a blended range), all six ions are present on every one of them, ` +
    `and every range is a well-formed pair whose midpoint matches the stored value. ${rows.length} profiles checked, ${skipped} style targets skipped.`
);
