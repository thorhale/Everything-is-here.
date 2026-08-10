import { test } from "node:test";
import assert from "node:assert/strict";
import {
  residualAlkalinity,
  targetResidualAlkalinity,
  acidDoses,
  acidMaltDose,
  mashPhAdvice,
  MASH_ACIDS,
  ACID_MALT_LACTIC_FRACTION,
} from "@/lib/mash-ph";

const near = (a: number, b: number, eps = 0.02) =>
  assert.ok(Math.abs(a - b) <= eps, `expected ${b}, got ${a}`);

// --- The chemistry, checked independently of the implementation -----------

test("acid strengths are the published product concentrations", () => {
  const by = (k: string) => MASH_ACIDS.find((a) => a.key === k)!;
  // density x mass fraction / equivalent weight x 1000
  near(by("lactic88").mEqPerMl, (1.209 * 0.88 * 1000) / 90.08, 0.01);
  near(by("phosphoric85").mEqPerMl, (1.685 * 0.85 * 1000) / 97.99, 0.01);
  // The dilute bottle is roughly fourteen times weaker than the concentrated one.
  near(by("phosphoric85").mEqPerMl / by("phosphoric10").mEqPerMl, 13.7, 0.3);
});

test("one mL of 88% lactic neutralises ~156 ppm alkalinity in a gallon", () => {
  // 11.81 mEq x 50.04 mg CaCO3/mEq / 3.785 L = 156 mg/L.
  const [lactic] = acidDoses(156, null);
  near(lactic.mlPerGallon, 1.0, 0.02);
});

test("dose is linear in the alkalinity being removed", () => {
  const a = acidDoses(50, null)[0].mlPerGallon;
  const b = acidDoses(200, null)[0].mlPerGallon;
  near(b / a, 4, 0.01);
});

test("dose scales with water volume, and per-gallon is volume-independent", () => {
  const small = acidDoses(100, 10);
  const big = acidDoses(100, 40);
  near(big[0].mlTotal!, small[0].mlTotal! * 4, 0.2);
  near(big[0].mlPerGallon, small[0].mlPerGallon, 0.001);
});

test("stronger acid means less of it, in proportion to its strength", () => {
  const doses = acidDoses(100, 20);
  const lactic = doses.find((d) => d.key === "lactic88")!;
  const phos85 = doses.find((d) => d.key === "phosphoric85")!;
  const phos10 = doses.find((d) => d.key === "phosphoric10")!;
  assert.ok(phos85.mlTotal! < lactic.mlTotal!, "85% phosphoric is stronger than 88% lactic");
  assert.ok(phos10.mlTotal! > lactic.mlTotal!, "10% phosphoric is much weaker");
  near(phos10.mlTotal! / phos85.mlTotal!, 13.7, 0.3);
});

test("no acid is prescribed when the water is already at or below target", () => {
  assert.deepEqual(acidDoses(0, 20), []);
  assert.deepEqual(acidDoses(-50, 20), []);
});

// --- The regression this file exists for ----------------------------------

test("REGRESSION: the old pH-drop heuristic overdosed by ~3.9x", () => {
  // The previous implementation returned gap/40 mL per gallon, independent of
  // alkalinity and volume. For a 100 ppm gap that was 2.5 mL/gal against a
  // true requirement of about 0.64 — enough to drive a mash well under pH 5.
  for (const gap of [40, 80, 120, 200]) {
    const old = gap / 40;
    const now = acidDoses(gap, null)[0].mlPerGallon;
    near(old / now, 3.9, 0.1);
    assert.ok(now < old, `${gap} ppm: new dose must be smaller than the old one`);
  }
});

// --- Acid malt ------------------------------------------------------------

test("acid malt carries the same equivalents as the liquid acid it replaces", () => {
  const gap = 100;
  const volumeL = 20;
  const malt = acidMaltDose(gap, volumeL, 5)!;
  // mEq needed -> grams of lactic -> grams of malt at 3% lactic by weight.
  const mEq = (gap * volumeL) / 50.04;
  const expected = ((mEq / 1000) * 90.08) / ACID_MALT_LACTIC_FRACTION;
  near(malt.grams, Math.round(expected), 1);
  near(malt.pctOfGrist!, Math.round((expected / 5000) * 1000) / 10, 0.1);
});

test("acid malt needs a volume, and a percentage needs a grist weight", () => {
  assert.equal(acidMaltDose(100, null, 5), null, "no volume -> no dose");
  assert.equal(acidMaltDose(100, 20, null)!.pctOfGrist, null, "no grist -> no percentage");
  assert.ok(acidMaltDose(100, 20, null)!.grams > 0, "grams are still computable");
});

// --- Advice wiring --------------------------------------------------------

test("advice only prescribes acid when the water is too alkaline", () => {
  const alkaline = mashPhAdvice(4, 150, { mashWaterL: 20, gristKg: 5 });
  assert.equal(alkaline.verdict, "too alkaline");
  assert.ok(alkaline.acids.length > 0);
  assert.ok(alkaline.acidMalt != null);

  const soft = mashPhAdvice(30, 0, { mashWaterL: 20 });
  assert.equal(soft.verdict, "too soft");
  assert.deepEqual(soft.acids, []);
  assert.equal(soft.acidMalt, null);
  assert.equal(soft.addAlkalinity, true);

  const onTarget = mashPhAdvice(6, targetResidualAlkalinity(6), { mashWaterL: 20 });
  assert.equal(onTarget.verdict, "on target");
  assert.deepEqual(onTarget.acids, []);
});

test("residual alkalinity is Kolbach", () => {
  // Burton: 275 Ca, 40 Mg, 270 HCO3 -> its huge calcium nearly cancels its alkalinity.
  near(residualAlkalinity(275, 40, 270), 1, 1.5);
  // Pilsen: almost nothing in it either way.
  near(residualAlkalinity(7, 2, 3), -4, 1.5);
});
