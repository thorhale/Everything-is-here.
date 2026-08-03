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
const ENFORCED_KINDS = new Set(["bottled"]);
const SKIPPED_KINDS = new Set(["style-target"]);
const TOLERANCE_PCT = 5;

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
  rows.push({ id: p.id, kind: p.kind, cat, an, errPct, enforced });
  if (enforced && errPct > TOLERANCE_PCT) {
    failures.push({ id: p.id, cat, an, errPct });
  }
}

const width = Math.max(...rows.map((r) => r.id.length));
for (const kind of [...new Set(rows.map((r) => r.kind))]) {
  const group = rows.filter((r) => r.kind === kind);
  console.log(`\n${kind}${group[0].enforced ? " (enforced)" : " (reported only)"}`);
  for (const r of group.sort((a, b) => b.errPct - a.errPct)) {
    const flag = r.errPct > TOLERANCE_PCT ? (r.enforced ? " FAIL" : " cation-heavy") : "";
    console.log(
      `  ${r.id.padEnd(width)}  cations ${r.cat.toFixed(2).padStart(7)} meq  ` +
        `anions ${r.an.toFixed(2).padStart(7)} meq  off by ${r.errPct.toFixed(1).padStart(5)}%${flag}`
    );
  }
}

if (failures.length) {
  console.error(`\nFAIL: ${failures.length} published analysis/analyses do not balance:`);
  for (const f of failures) {
    console.error(
      `  ${f.id}: ${f.cat.toFixed(2)} meq of cations against ${f.an.toFixed(2)} meq of anions ` +
        `(${f.errPct.toFixed(1)}% apart). Either a figure is mistyped or the published ion set is ` +
        `incomplete — do not ship a partial analysis as a brewing profile.`
    );
  }
  process.exit(1);
}

const enforcedCount = rows.filter((r) => r.enforced).length;
console.log(
  `\nOK: ${enforcedCount} published analyses balance within ${TOLERANCE_PCT}% ` +
    `(${rows.length} profiles checked, ${skipped} style targets skipped).`
);
