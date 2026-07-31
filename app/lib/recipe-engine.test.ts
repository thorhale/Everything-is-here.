// Tests for the one recipe engine. Run with `npm test` (tsx --test).
//
// The engine is the simulator behind /build: every gravity, ABV, IBU and
// colour the app quotes comes through computeRecipe. It carries no UI and no
// database, so it is pure arithmetic and cheap to pin exactly. These tests
// exist because the math is the kind that drifts silently — a wrong constant
// still returns a plausible-looking number, and nobody notices until a batch
// misses. Anchor values below are computed by hand from the documented
// formulas, not copied from a run of the code they check.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRecipe, type EngineInputs, type EngineIngredient } from "@/lib/recipe-engine";
import { POINTS_PER_G_PER_L } from "@/lib/must";

// A minimal, valid ingredient; each test overrides only what it exercises.
const ing = (o: Partial<EngineIngredient>): EngineIngredient => ({
  key: "k",
  name: "test",
  path: "direct",
  amount: 0,
  amountUnit: "g",
  ...o,
});

const base = (o: Partial<EngineInputs>): EngineInputs => ({
  beverage: "beer",
  batchVolumeL: 10,
  efficiencyPct: 75,
  attenuationPct: 75,
  ingredients: [],
  hops: [],
  ...o,
});

const near = (a: number, b: number, eps = 5e-4, msg?: string) =>
  assert.ok(Math.abs(a - b) <= eps, `${msg ?? ""} expected ${b}, got ${a} (Δ${Math.abs(a - b)})`);

test("direct sugar: OG is sugar mass over volume, no efficiency applied", () => {
  // 1000 g pure sucrose (ppg 46) into 10 L. Sugar = 1000 g exactly.
  // OG = 1 + (1000/10) * POINTS_PER_G_PER_L / 1000.
  const r = computeRecipe(base({ ingredients: [ing({ path: "direct", amount: 1000, ppg: 46 })] }));
  const expectedOg = 1 + (1000 / 10) * POINTS_PER_G_PER_L / 1000;
  near(r.og.typical, expectedOg, 1e-6, "direct OG");
  near(r.sugarG.typical, 1000, 1e-6, "direct sugar mass");
});

test("mash efficiency is a linear yield factor on OG points, nothing more", () => {
  const bill = [ing({ path: "mash", amount: 1000, ppg: 46 })];
  const at75 = computeRecipe(base({ efficiencyPct: 75, ingredients: bill }));
  const at90 = computeRecipe(base({ efficiencyPct: 90, ingredients: bill }));
  // OG *points* must scale exactly with efficiency: (og90-1)/(og75-1) = 90/75.
  const ratio = (at90.og.typical - 1) / (at75.og.typical - 1);
  near(ratio, 90 / 75, 1e-9, "efficiency scales OG points");
});

test("efficiency does not touch a direct-sugar bill", () => {
  const bill = [ing({ path: "direct", amount: 500, ppg: 46 })];
  const lo = computeRecipe(base({ efficiencyPct: 50, ingredients: bill }));
  const hi = computeRecipe(base({ efficiencyPct: 90, ingredients: bill }));
  near(lo.og.typical, hi.og.typical, 1e-9, "direct sugar ignores efficiency");
});

test("ABV is (OG-FG)*131.25 with FG from apparent attenuation", () => {
  const r = computeRecipe(base({ attenuationPct: 75, ingredients: [ing({ path: "direct", amount: 1000, ppg: 46 })] }));
  const og = r.og.typical;
  const fg = 1 + (og - 1) * (1 - 75 / 100); // fgFromAttenuation
  near(r.fg.typical, fg, 1e-6, "FG");
  near(r.abv.typical, (og - fg) * 131.25, 1e-6, "ABV");
});

test("a measured Brix collapses the gravity band to a point", () => {
  const r = computeRecipe(
    base({
      beverage: "wine",
      ingredients: [
        ing({
          path: "juice",
          amount: 10,
          amountUnit: "L",
          juiceBrixMin: 18,
          juiceBrix: 22,
          juiceBrixMax: 26,
          measuredBrix: 24, // a refractometer reading beats the estimate range
        }),
      ],
    })
  );
  near(r.og.low, r.og.high, 1e-9, "measured Brix removes band width");
  assert.equal(r.uncertain, false);
});

test("estimated fruit sugar comes out as a widening band, not a point", () => {
  const r = computeRecipe(
    base({
      beverage: "cider",
      ingredients: [
        ing({
          path: "whole-fruit",
          fruitHandling: "whole",
          amount: 6000, // enough fruit that the 9-14 g/100g spread clears the 0.010 "go measure" band
          sugarGPer100gMin: 9,
          sugarGPer100g: 11.5,
          sugarGPer100gMax: 14, // supermarket-apple spread
        }),
      ],
    })
  );
  assert.ok(r.og.low < r.og.typical && r.og.typical < r.og.high, "band should widen low<typ<high");
  assert.ok(r.uncertain, "a wide fruit band should flag as uncertain");
  assert.ok(r.warnings.some((w) => /refractometer/i.test(w)), "should advise measuring");
});

test("mead stalls when the sugar outruns the yeast's alcohol tolerance", () => {
  // A big honey must, pitched on a 10%-tolerance strain.
  const r = computeRecipe(
    base({
      beverage: "mead",
      attenuationPct: 100,
      alcoholTolerancePct: 10,
      ingredients: [ing({ path: "direct", amount: 3500, ppg: 46 })],
    })
  );
  assert.notEqual(r.stallsAt, null, "should detect a stall");
  // Ceiling FG = OG - tol/131.25 once that sits above the dry FG.
  near(r.fg.typical, r.og.typical - 10 / 131.25, 1e-6, "stalled FG at the alcohol ceiling");
  assert.ok(r.warnings.some((w) => /sweet/i.test(w)), "should warn it finishes sweet");
});

test("mead on honey alone warns about missing nitrogen", () => {
  const r = computeRecipe(
    base({ beverage: "mead", ingredients: [ing({ path: "direct", amount: 2000, ppg: 46 })] })
  );
  assert.ok(r.warnings.some((w) => /nitrogen/i.test(w)), "honey has no assimilable nitrogen");
});

test("ingredient volume exceeding the batch is caught, with negative top-up", () => {
  const r = computeRecipe(
    base({
      beverage: "cider",
      batchVolumeL: 10,
      ingredients: [ing({ path: "juice", amount: 15, amountUnit: "L", juiceBrix: 12 })],
    })
  );
  assert.ok(r.topUpWaterL < 0, "top-up water should be negative when over volume");
  assert.ok(r.warnings.some((w) => /more than/i.test(w)), "should warn you are over batch volume");
});

test("beer: a boil hop makes IBU, a dry hop alone makes none", () => {
  const bill = [ing({ path: "mash", amount: 3000, ppg: 36, colorLovibond: 3 })];
  const boiled = computeRecipe(
    base({ ingredients: bill, hops: [{ key: "h", name: "cascade", amountG: 28, alphaPct: 6, timeMin: 60, isDryHop: false }] })
  );
  const dryOnly = computeRecipe(
    base({ ingredients: bill, hops: [{ key: "h", name: "cascade", amountG: 28, alphaPct: 6, timeMin: 0, isDryHop: true }] })
  );
  assert.ok((boiled.ibu ?? 0) > 0, "a 60-min addition should bitter");
  near(dryOnly.ibu ?? 0, 0, 1e-9, "a dry hop contributes no IBU");
  assert.ok((boiled.srm ?? 0) > 0, "coloured malt should give SRM");
});

test("colour and bitterness stay null for non-beer beverages", () => {
  const r = computeRecipe(
    base({ beverage: "wine", ingredients: [ing({ path: "juice", amount: 10, amountUnit: "L", juiceBrix: 22, colorLovibond: 5 })] })
  );
  assert.equal(r.srm, null, "wine has no SRM");
  assert.equal(r.ibu, null, "wine has no IBU");
});

test("non-beer must above pH 3.8 is flagged for acidification", () => {
  const r = computeRecipe(
    base({ beverage: "wine", ingredients: [ing({ path: "juice", amount: 10, amountUnit: "L", juiceBrix: 22, phTypical: 4.1 })] })
  );
  assert.ok(r.estimatedPh != null && r.estimatedPh > 3.8);
  assert.ok(r.warnings.some((w) => /acidif/i.test(w)), "should tell you to acidify");
});

test("an empty recipe is 1.000 across the board and does not throw", () => {
  const r = computeRecipe(base({}));
  near(r.og.typical, 1, 1e-9);
  near(r.abv.typical, 0, 1e-9);
  assert.equal(r.stallsAt, null);
});
