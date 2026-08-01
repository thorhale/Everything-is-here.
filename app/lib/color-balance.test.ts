import { test } from "node:test";
import assert from "node:assert/strict";
import { colorShift, rebalance, type BillItem } from "@/lib/color-balance";
import { srmOfBill } from "@/lib/recipe-engine";

// A 20 L batch: pale base + a dab of crystal. Hand SRM ≈ 10.1 (Morey).
const BATCH = 20;
const bill = (): BillItem[] => [
  { key: "pils", name: "Pilsner", colorLovibond: 2, massG: 4500, isBase: true },
  { key: "c60", name: "Crystal 60", colorLovibond: 60, massG: 500, isBase: false },
];

const near = (a: number, b: number, eps = 0.2) => assert.ok(Math.abs(a - b) <= eps, `expected ${b}, got ${a}`);

test("srmOfBill matches the hand-computed Morey value", () => {
  near(srmOfBill(bill(), BATCH), 10.1, 0.3);
});

test("colorShift reports a darker swap as a positive delta", () => {
  const s = colorShift(bill(), "c60", 90, BATCH); // crystal 60 -> 90
  assert.ok(s.after > s.before);
  assert.ok(s.delta > 0);
});

test("specialty scaling hits a lighter target and leaves the base alone", () => {
  const r = rebalance(bill(), 8, "specialty", BATCH);
  assert.ok(r.reachable);
  near(r.resultSrm, 8, 0.2);
  const base = r.bill.find((b) => b.key === "pils")!;
  const crystal = r.bill.find((b) => b.key === "c60")!;
  assert.equal(base.massG, 4500); // base untouched
  assert.ok(crystal.massG < 500); // specialty scaled down to lighten
});

test("a target below the specialty-free floor is flagged unreachable", () => {
  // With crystal removed the bill still sits ~3.7 SRM, so target 2 is impossible.
  const r = rebalance(bill(), 2, "specialty", BATCH);
  assert.equal(r.reachable, false);
  const crystal = r.bill.find((b) => b.key === "c60")!;
  assert.equal(crystal.massG, 0); // pushed to zero, still not light enough
});

test("inform changes nothing and reports the current colour", () => {
  const original = bill();
  const r = rebalance(original, 6, "inform", BATCH);
  assert.deepEqual(r.bill, original);
  near(r.resultSrm, 10.1, 0.3);
});
