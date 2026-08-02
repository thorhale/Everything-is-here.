import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyAddition, adjustHops, type HopAddition } from "@/lib/hop-adjust";

const near = (a: number, b: number, eps = 0.05) =>
  assert.ok(Math.abs(a - b) <= eps, `expected ${b}, got ${a}`);

test("classification: long boil is bittering, short and dry are aroma", () => {
  assert.equal(classifyAddition(60, false), "bittering");
  assert.equal(classifyAddition(90, false), "bittering");
  assert.equal(classifyAddition(10, false), "aroma");
  assert.equal(classifyAddition(0, true), "aroma"); // dry hop
  assert.equal(classifyAddition(60, true), "aroma"); // dry hop always aroma
});

test("a bittering charge rescales inversely with actual alpha", () => {
  const additions: HopAddition[] = [
    { name: "Cascade", amountG: 50, assumedAlpha: 5.5, actualAlpha: 6.2, timeMin: 60, isDryHop: false },
  ];
  const { additions: out } = adjustHops(additions);
  assert.equal(out[0].role, "bittering");
  assert.ok(out[0].changed);
  near(out[0].suggestedG, 50 * (5.5 / 6.2)); // 44.35 g — less hop for higher alpha
});

test("aroma additions are never rescaled, even at a different alpha", () => {
  const additions: HopAddition[] = [
    { name: "Cascade", amountG: 28, assumedAlpha: 5.5, actualAlpha: 8.0, timeMin: 10, isDryHop: false },
  ];
  const { additions: out } = adjustHops(additions);
  assert.equal(out[0].role, "aroma");
  assert.equal(out[0].changed, false);
  assert.equal(out[0].suggestedG, 28);
});

test("buy totals sum adjusted bittering + untouched aroma per variety", () => {
  const additions: HopAddition[] = [
    { name: "Cascade", amountG: 50, assumedAlpha: 5.5, actualAlpha: 5.5, timeMin: 60, isDryHop: false }, // no change
    { name: "Cascade", amountG: 28, assumedAlpha: 5.5, actualAlpha: 5.5, timeMin: 10, isDryHop: false }, // aroma
  ];
  const { buyTotals } = adjustHops(additions);
  assert.equal(buyTotals.length, 1);
  near(buyTotals[0].grams, 78);
});

test("no adjustment when actual alpha is missing or equal", () => {
  const additions: HopAddition[] = [
    { name: "Magnum", amountG: 30, assumedAlpha: 12, actualAlpha: 0, timeMin: 60, isDryHop: false },
    { name: "Magnum", amountG: 30, assumedAlpha: 12, actualAlpha: 12, timeMin: 60, isDryHop: false },
  ];
  const { additions: out } = adjustHops(additions);
  assert.equal(out[0].changed, false); // missing actual
  assert.equal(out[1].changed, false); // equal
});
