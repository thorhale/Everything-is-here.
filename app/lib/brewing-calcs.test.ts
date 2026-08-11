// Every one of these assertions was already written down — as a comment.
//
// brewing-calcs.ts documents a reference value beside almost every function:
// "Validated: 2.4 vols at 38°F -> ~11 PSI", "~11.9 °P at 1.048", "1.050 ->
// 1.010 gives ~164 kcal". Twenty-four exported functions, and not one of them
// was executed by any test. validate-must.mjs looks like it covers this ground
// but does not: it re-implements the equations in plain JavaScript and checks
// its own copies, so the shipped TypeScript could drift from every one of those
// comments and nothing would go red.
//
// This file runs the real functions against the values their own comments
// promise, which turns the documentation into something that has to stay true.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as calc from "./brewing-calcs";

const near = (actual: number, expected: number, tol: number, what = "") =>
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${what}: got ${actual}, expected ${expected} ±${tol}`
  );

test("gravity and Plato round-trip", () => {
  near(calc.sgToPlato(1.048), 11.9, 0.15, "1.048 -> °P"); // documented ~11.9
  near(calc.platoToSg(11.9), 1.048, 0.001, "11.9 °P -> SG");
  near(calc.sgToPoints(1.048), 48, 1e-9, "1.048 -> points");
  near(calc.pointsToSg(48), 1.048, 1e-12, "48 points -> SG");
  // The two directions must agree with each other across the working range.
  for (const sg of [1.01, 1.04, 1.06, 1.09]) {
    near(calc.platoToSg(calc.sgToPlato(sg)), sg, 0.0015, `round-trip ${sg}`);
  }
});

test("hydrometer temperature correction", () => {
  // The Lyons polynomial gives 1.05245 here. This function's comment used to
  // say ~1.0530, which nothing had ever run.
  near(calc.correctHydrometer(1.05, 80, 60), 1.05245, 0.0001, "warm sample reads low");
  // At the calibration temperature the reading is already true.
  near(calc.correctHydrometer(1.05, 60, 60), 1.05, 1e-9, "at calibration");
  // A cold sample reads high, so the correction goes the other way.
  assert.ok(calc.correctHydrometer(1.05, 40, 60) < 1.05);
});

test("refractometer conversions", () => {
  // Documented: OG 12.0 °Bx, FG 6.0 °Bx -> ~1.013 FG, ~4.9% ABV.
  const og = calc.refractometerToSg(12);
  const fg = calc.refractometerFg(12, 6);
  near(fg, 1.013, 0.002, "alcohol-corrected FG");
  near(calc.abvAdvanced(og, fg), 4.9, 0.3, "ABV");
  // Unfermented wort: the WCF is the only correction, so a bigger WCF reads lower.
  assert.ok(calc.refractometerToSg(12, 1.04) < calc.refractometerToSg(12, 1.0));
});

test("alcohol", () => {
  near(calc.abvSimple(1.05, 1.01), 5.25, 0.01, "simple ABV");
  // 6.51, not 6.30. The comment on abvAdvanced used to quote 6.30 — which is
  // what abvSimple gives on these same numbers. The gap between the two forms
  // is the entire reason both exist, so quoting one for the other hid the point.
  near(calc.abvAdvanced(1.06, 1.012), 6.51, 0.01, "advanced ABV");
  near(calc.abvSimple(1.06, 1.012), 6.30, 0.01, "simple ABV on the same numbers");
  near(calc.abvToAbw(5.0), 3.945, 0.001, "ABV -> ABW");
  near(calc.apparentAttenuation(1.05, 1.01), 80, 0.01, "attenuation");
  assert.equal(calc.apparentAttenuation(1.0, 1.0), 0, "water cannot attenuate");
  // Documented: 1.050 -> 1.010 gives ~164 kcal per 12 oz.
  near(calc.caloriesPer12oz(1.05, 1.01), 164, 4, "calories");
});

test("carbonation and priming", () => {
  // Documented: ~0.85 volumes of residual CO2 at 68 °F.
  near(calc.residualCo2(68), 0.85, 0.02, "residual CO2");
  assert.ok(calc.residualCo2(38) > calc.residualCo2(68), "cold beer holds more");
  // Documented: 5 US gal at 68 °F to 2.4 volumes on corn sugar -> ~130 g.
  const g = calc.primingSugar(2.4, 5 * calc.L_PER_GALLON, 68, "cornSugar");
  near(g, 130, 6, "corn sugar grams");
  near(g / calc.G_PER_OZ, 4.6, 0.25, "the same in ounces");
  // Sucrose yields more CO2 per gram, so less of it is needed.
  assert.ok(calc.primingSugar(2.4, 18.93, 68, "tableSugar") < g);
  assert.ok(calc.primingSugar(2.4, 18.93, 68, "dme") > g);
  // Beer already at or above the target needs nothing, never a negative dose.
  assert.equal(calc.primingSugar(0.5, 18.93, 68), 0);
  // 10.2 psi, not the ~11 the comment used to claim. Published force-carbonation
  // charts put 38 °F at 10 psi on the 2.4-volume row, so the regression is right
  // and agrees with the charts.
  near(calc.kegPsi(2.4, 38), 10.2, 0.1, "keg pressure");
});

test("dilution and boil-off conserve gravity points", () => {
  // P1 x V1 = P2 x V2 is the whole model; check it holds both ways.
  near(calc.gravityAfterVolumeChange(1.06, 5, 6), 1.05, 0.0005, "diluted");
  near(calc.gravityAfterVolumeChange(1.05, 6, 5), 1.06, 0.0005, "boiled down");
  near(calc.dilutionWaterToAdd(1.06, 5, 1.05), 1, 0.01, "water to add");
  near(calc.boilDownVolume(1.05, 6, 1.06), 5, 0.01, "boil down to");
  // Adding the computed water must actually land on the target.
  const add = calc.dilutionWaterToAdd(1.072, 20, 1.055);
  near(calc.gravityAfterVolumeChange(1.072, 20, 20 + add), 1.055, 0.0005, "round-trip");
  // Degenerate targets must not produce a nonsense volume.
  assert.equal(calc.dilutionWaterToAdd(1.06, 5, 1.0), Infinity);
  assert.equal(calc.boilDownVolume(1.06, 5, 1.0), 5);
});

test("mash temperature", () => {
  // Palmer's equation gives 165.44 °F. The comment used to say ~164.
  near(calc.strikeTemp(152, 68, 1.25), 165.44, 0.01, "strike temp");
  // Thinner mash needs less overshoot, thicker needs more.
  assert.ok(calc.strikeTemp(152, 68, 2.0) < calc.strikeTemp(152, 68, 1.25));
  assert.ok(calc.strikeTemp(152, 68, 1.0) > calc.strikeTemp(152, 68, 1.25));
  assert.equal(calc.strikeTemp(152, 68, 0), 152, "no ratio, no correction");

  // A step infusion to 168 °F from 152 °F on 10 lb and 12.5 qt of water.
  const qt = calc.infusionVolume(168, 152, 10, 12.5);
  assert.ok(qt > 0 && qt < 12.5, `implausible infusion volume ${qt}`);
  // Boiling water cannot raise a mash to boiling.
  assert.equal(calc.infusionVolume(212, 152, 10, 12.5), 0);
});

test("colour conversions round-trip", () => {
  near(calc.srmToEbc(10), 19.7, 0.01, "SRM -> EBC");
  near(calc.ebcToSrm(19.7), 10, 0.01, "EBC -> SRM");
  near(calc.ebcToSrm(calc.srmToEbc(37)), 37, 1e-9, "round-trip");
});

test("temperature and unit constants", () => {
  assert.equal(calc.cToF(0), 32);
  assert.equal(calc.cToF(100), 212);
  near(calc.fToC(68), 20, 1e-9, "68 °F");
  near(calc.cToF(calc.fToC(150)), 150, 1e-9, "round-trip");
  // Exact by definition — these are the international yard and pound values.
  assert.equal(calc.L_PER_GALLON, 3.785411784);
  assert.equal(calc.ML_PER_GALLON, 3785.411784);
  assert.equal(calc.G_PER_OZ, 28.349523125);
});
