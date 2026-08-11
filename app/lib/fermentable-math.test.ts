// The nutrition-label extract model, run against real panels.
//
// This is how every fruit, juice, syrup, cereal and candy in the catalogue gets
// a PPG — 290-odd of the 317 fermentables — and none of it was executed by a
// test. The detail pages print the arithmetic for the user to check; this makes
// sure the arithmetic they are shown is the arithmetic that ran.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fm from "./fermentable-math";

const near = (actual: number, expected: number, tol: number, what = "") =>
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${what}: got ${actual}, expected ${expected} ±${tol}`
  );

test("pure sucrose is the 46 PPG reference point", () => {
  assert.equal(fm.SUCROSE_PPG, 46);
  // 100 g of table sugar is 100 g of carbohydrate and no fibre.
  near(fm.ppgFromNutrition({ servingSizeG: 100, totalCarbG: 100 }), 46, 1e-9, "sucrose");
  near(fm.availableCarbFraction({ servingSizeG: 100, totalCarbG: 100 }), 1, 1e-9, "fraction");
  near(fm.yieldPctFromPpg(46), 100, 1e-9, "yield vs sucrose");
});

test("fibre and polyols are subtracted because yeast cannot ferment them", () => {
  // A dried fig: 100 g, 63.9 g carbohydrate, 9.8 g fibre -> 54.1 g available.
  const fig = { servingSizeG: 100, totalCarbG: 63.9, fiberG: 9.8 };
  near(fm.availableCarbFraction(fig), 0.541, 0.0005, "fig fraction");
  near(fm.ppgFromNutrition(fig), 24.9, 0.1, "fig PPG");
  // Ignoring the fibre would overstate it by nearly five points.
  assert.ok(fm.ppgFromNutrition({ servingSizeG: 100, totalCarbG: 63.9 }) - fm.ppgFromNutrition(fig) > 4);
  // Declared sugar alcohols come off too.
  near(
    fm.ppgFromNutrition({ servingSizeG: 100, totalCarbG: 100, sugarAlcoholG: 50 }),
    23, 1e-9, "half polyol"
  );
});

test("nothing fermentable yields nothing, and nothing goes negative", () => {
  assert.equal(fm.ppgFromNutrition({ servingSizeG: 100, totalCarbG: 0 }), 0, "no carbohydrate");
  // Fibre exceeding total carbohydrate is a mislabelled panel, not a negative PPG.
  assert.equal(fm.ppgFromNutrition({ servingSizeG: 100, totalCarbG: 5, fiberG: 9 }), 0, "fibre > carb");
  assert.equal(fm.ppgFromNutrition({ servingSizeG: 0, totalCarbG: 50 }), 0, "no serving size");
  // And the fraction can never exceed 1, whatever a panel claims.
  assert.equal(fm.availableCarbFraction({ servingSizeG: 10, totalCarbG: 50 }), 1, "clamped");
});

test("Brix and gravity round-trip", () => {
  near(fm.brixToSg(0), 1, 1e-9, "water");
  near(fm.brixToSg(12), 1.0483, 0.0015, "12 Brix");
  near(fm.brixToSg(22), 1.0919, 0.003, "22 Brix");
  for (const b of [5, 12, 20, 25]) near(fm.sgToBrix(fm.brixToSg(b)), b, 0.2, `round-trip ${b}`);
  // A liquid adjunct's PPG is per POUND of the liquid, not per gallon of it.
  // A gallon of 1.046 juice carries 46 points but weighs 8.73 lb, so it is
  // worth 5.27 points per pound — an eighth of sugar's 46, because it is mostly
  // water. Reading this figure as if it were 46 would overstate a juice-heavy
  // cider eightfold.
  near(fm.ppgFromLiquidSg(1.046), 5.27, 0.02, "1.046 juice, per pound");
  near(fm.ppgFromLiquidSg(1.0) , 0, 1e-9, "water carries nothing");
  assert.ok(fm.ppgFromLiquidSg(1.09) > fm.ppgFromLiquidSg(1.046), "denser juice is worth more");
});

test("gravity contribution scales with mass, and with efficiency on the mash path", () => {
  // The classic check: 10 lb at 37 PPG into 5 gal at 75% efficiency is 55.5 points.
  near(fm.gravityContribution(37, 10, 5, 75), 55.5, 0.01, "10 lb 2-row");
  // Sugars go in at full yield.
  near(fm.gravityContribution(46, 1, 1, 100), 46, 1e-9, "1 lb sucrose in 1 gal");
  // Doubling the grain doubles the points; doubling the volume halves them.
  near(fm.gravityContribution(37, 20, 5, 75), 111, 0.02, "double the grain");
  near(fm.gravityContribution(37, 10, 10, 75), 27.75, 0.01, "double the volume");
  assert.equal(fm.gravityContribution(37, 10, 0, 75), 0, "no volume, no gravity");
});

test("colour: Morey's fit from malt colour units", () => {
  // MCU is colour x weight / volume; Morey's curve is sub-linear, so a bill of
  // twice the MCU is well short of twice the SRM. That flattening is the whole
  // reason a black beer is not 100 SRM.
  near(fm.mcuToSrm(0), 0, 1e-9, "nothing is colourless");
  const low = fm.mcuToSrm(10);
  const high = fm.mcuToSrm(20);
  assert.ok(high < low * 2, `Morey should flatten: ${low} -> ${high}`);
  assert.ok(high > low, "but still increase");
  near(fm.mcuToSrm(10), 6.9, 0.4, "10 MCU");
});
