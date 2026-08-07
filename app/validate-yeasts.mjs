// Structural checks on the yeast catalog.
//
// WHY THIS EXISTS: the temperature model reads tempMinC/tempMaxC off every
// strain, so those two numbers went from decorative to load-bearing overnight.
// A strain whose Celsius and Fahrenheit disagree, or whose range is inverted,
// would silently produce wrong guidance rather than an error — the page would
// render, confidently, and be wrong about which end of the range is the cool one.
//
// One real defect was already found this way: Wyeast 1084 carried 16 °C against
// a published 62 °F, which is 16.7 °C. A degree, but a degree that had been
// sitting there unnoticed, and exactly the kind of thing that stays unnoticed
// without a check.
//
// Ranges legitimately absent are NOT errors. A dozen Brettanomyces,
// Lactobacillus, Pediococcus and Acetobacter cultures have no supplier-published
// temperature range, and neither attenuation nor flocculation means anything for
// a souring bacterium. Those are reported as coverage, not failed.
//
// Usage: node validate-yeasts.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "../data/yeasts";
// Celsius is usually a rounded conversion of a supplier's Fahrenheit figure (or
// vice versa), so exact agreement is not expected. More than a degree apart
// means somebody typed one of them independently and got it wrong.
const CF_TOLERANCE_F = 1.0;

const cToF = (c) => (c * 9) / 5 + 32;

const strains = [];
for (const file of readdirSync(DIR).filter((f) => f.endsWith(".json")).sort()) {
  const doc = JSON.parse(readFileSync(join(DIR, file), "utf8"));
  // Every .json directly in data/yeasts/ is a lab file — derived data lives in
  // data/yeasts/derived/, which this glob does not descend into. So a file
  // without strains here is a real error, not a different kind of document.
  if (!Array.isArray(doc.strains)) {
    throw new Error(`${file}: no strains array. Derived data belongs in data/yeasts/derived/.`);
  }
  for (const s of doc.strains) strains.push({ ...s, _lab: doc.lab?.id ?? file, _file: file });
}

const errors = [];
const noRange = [];
// Not every source publishes a range. Some give a single optimum — the Maltose
// Falcons guide gives Lactobacillus delbrueckii one figure, "ferment very warm,
// around 98 °F", and no upper bound. Storing that as a minimum with no maximum
// is the honest representation of what was published, so it is coverage rather
// than an error. The temperature model cannot band a point either way and
// correctly declines to assess it.
const singlePoint = [];

for (const s of strains) {
  const id = `${s._lab}/${s.productCode ?? s.id}`;
  const { tempMinC: lo, tempMaxC: hi, tempMinF: loF, tempMaxF: hiF } = s;

  for (const [c, f, which] of [
    [lo, loF, "min"],
    [hi, hiF, "max"],
  ]) {
    if (typeof c === "number" && typeof f === "number" && Math.abs(cToF(c) - f) > CF_TOLERANCE_F) {
      errors.push(
        `${id}: temp${which} disagrees — ${c} °C is ${cToF(c).toFixed(1)} °F, but ${f} °F is stored`
      );
    }
  }

  if (typeof lo === "number" && typeof hi === "number") {
    if (lo > hi) errors.push(`${id}: temperature range is inverted (${lo} > ${hi} °C)`);
    else if (lo === hi) errors.push(`${id}: temperature range has zero width (${lo} °C)`);
  } else if (lo == null && hi == null) {
    noRange.push(`${id} (${s.species ?? "species not stated"})`);
  } else {
    singlePoint.push(`${id} — ${lo ?? hi} °C, published as a single optimum rather than a range`);
  }

  const { attenuationMin: an, attenuationMax: ax } = s;
  if (typeof an === "number" && typeof ax === "number" && an > ax) {
    errors.push(`${id}: attenuation range is inverted (${an} > ${ax})`);
  }
  for (const [v, label] of [
    [an, "attenuationMin"],
    [ax, "attenuationMax"],
  ]) {
    if (typeof v === "number" && (v < 30 || v > 105)) {
      errors.push(`${id}: ${label} of ${v}% is outside anything physically plausible`);
    }
  }

  const { alcoholToleranceMin: vn, alcoholToleranceMax: vx } = s;
  if (typeof vn === "number" && typeof vx === "number" && vn > vx) {
    errors.push(`${id}: alcohol tolerance range is inverted (${vn} > ${vx})`);
  }

  if (!s.sourceUrl) errors.push(`${id}: no sourceUrl — every strain must be checkable`);
}

const withRange = strains.length - noRange.length - singlePoint.length;
console.log(
  `${strains.length} strains. ${withRange} carry a usable temperature range and can be assessed ` +
    `by the fermentation-temperature model; ${noRange.length} cannot.`
);
if (singlePoint.length) {
  console.log(`\nSingle published optimum rather than a range (not an error):`);
  for (const m of singlePoint) console.log(`  ${m}`);
}
if (noRange.length) {
  console.log(`\nNo supplier-published temperature range (not an error — a gap):`);
  for (const m of noRange) console.log(`  ${m}`);
}

if (errors.length) {
  console.error(`\nFAIL: ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log(
  `\nOK: every stated range is the right way round, every C/F pair agrees within ` +
    `${CF_TOLERANCE_F} °F, and every strain cites a source.`
);
