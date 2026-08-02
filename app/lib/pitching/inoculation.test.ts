import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ADWY_STANDARD,
  computeInoculation,
  gramsOfYeast,
  rehydrationWater,
} from "@/lib/pitching/inoculation";

const near = (a: number, b: number, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) <= eps, `expected ${b}, got ${a}`);

test("g/hL dosing: 25 g/hL into 100 L is 25 g", () => {
  near(gramsOfYeast(25, 100), 25);
});

test("g/hL dosing scales with volume and rate", () => {
  // 25 g/hL into a 23 L homebrew batch → 5.75 g
  near(gramsOfYeast(25, 23), 5.75);
  // double the rate, double the yeast
  near(gramsOfYeast(50, 23), 11.5);
});

test("zero or negative inputs give zero yeast", () => {
  assert.equal(gramsOfYeast(0, 100), 0);
  assert.equal(gramsOfYeast(25, 0), 0);
  assert.equal(gramsOfYeast(-5, 100), 0);
});

test("rehydration water is 5–10× the yeast weight", () => {
  const w = rehydrationWater(10);
  near(w.low, 50);
  near(w.high, 100);
});

test("the Scott Labs high-Brix rate doses more yeast than the standard", () => {
  const std = gramsOfYeast(ADWY_STANDARD.rateGPerHl, 100);
  const high = gramsOfYeast(ADWY_STANDARD.highBrixGPerHl, 100);
  near(std, 25);
  near(high, 35);
  assert.ok(high > std);
});

test("computeInoculation carries the AWRI viable-cell target", () => {
  const r = computeInoculation(ADWY_STANDARD.rateGPerHl, 100);
  near(r.grams, 25);
  assert.equal(r.targetViableCellsPerMl, 5_000_000);
  near(r.water.low, 125);
  near(r.water.high, 250);
});
