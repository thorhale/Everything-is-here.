// The shipped must-chemistry code, run against published reference values.
//
// validate-must.mjs already checks these equations — but it checks a SECOND,
// hand-written copy of them in plain JavaScript, not the TypeScript the site
// actually runs. Its header says "agreement means the TypeScript is right
// rather than merely self-consistent", and that was never quite true: nothing
// compared the two, so lib/must.ts could have drifted from its twin without a
// single test going red.
//
// This file closes that. Same published values, run through the real exports.
// Keeping both is worth it: validate-must.mjs proves the EQUATIONS match the
// literature, and this proves the CODE matches the equations.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as must from "./must";

const near = (actual: number, expected: number, tol: number, what = "") =>
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${what}: got ${actual}, expected ${expected} ±${tol}`
  );

test("Brix to specific gravity, against the oenological tables", () => {
  near(must.sgFromBrix(0), 1.0, 0.0001, "water");
  near(must.sgFromBrix(10), 1.04, 0.0005, "10 Brix");
  near(must.sgFromBrix(15), 1.0611, 0.0005, "15 Brix");
  near(must.sgFromBrix(20), 1.0829, 0.0005, "20 Brix");
  near(must.sgFromBrix(22), 1.0919, 0.0006, "22 Brix, typical white harvest");
  near(must.sgFromBrix(24), 1.101, 0.0007, "24 Brix, typical red harvest");
  near(must.sgFromBrix(30), 1.1295, 0.0012, "30 Brix, ice cider");
  // brixFromSg is the inverse and must agree with it.
  for (const b of [5, 12, 22, 28]) near(must.brixFromSg(must.sgFromBrix(b)), b, 0.15, `round-trip ${b}`);
});

test("sugar mass to gravity: 1 lb sucrose in 1 US gallon reads 1.046", () => {
  near(must.sgFromSugar(453.592, 3.78541), 1.046, 0.0005, "the defining case");
  near(must.sgFromSugar(1000, 20), 1.0192, 0.0005, "1 kg in 20 L");
  assert.equal(must.sgFromSugar(100, 0), 1, "no volume, no gravity");
  // sugarForSg inverts it.
  near(must.sugarForSg(1.046, 3.78541), 453.592, 1, "inverse");
  near(must.sugarGPerLFromBrix(22), 1.0919 * 220, 3, "22 Brix in g/L");
});

test("alcohol", () => {
  near(must.abvSimple(1.055, 1.014), 5.38, 0.02, "simple");
  // 22 Brix fermented to 0.996 is about 12.6%; 24 Brix to 0.995 about 14.0%.
  near(must.abvSimple(must.sgFromBrix(22), 0.996), 12.6, 0.3, "22 Brix dry");
  near(must.abvSimple(must.sgFromBrix(24), 0.995), 14.0, 0.3, "24 Brix dry");
  // The alternate form runs higher at strength — that is why it exists.
  assert.ok(must.abvAlternate(1.11, 1.0) > must.abvSimple(1.11, 1.0));
  near(must.potentialAbvFromBrix(22), 12.6, 0.6, "potential ABV from Brix");
  near(must.fgFromAttenuation(1.055, 75), 1.01375, 0.0005, "FG at 75% attenuation");
  // A yeast that quits at 12% leaves sugar behind in a 1.120 must.
  assert.ok(must.stallGravity(1.12, 12) > 1.0);
});

test("chaptalisation accounts for the volume the sugar itself adds", () => {
  // Raising 20 L from 1.045 to 1.090. Ignoring the ~0.625 mL/g the sugar
  // occupies under-doses by about 15%, which is the trap this function exists
  // to avoid: 2.34 kg is the naive answer, 2.75 kg is the right one.
  const plan = must.chaptalise(1.045, 1.09, 20);
  near(plan.sugarG / 1000, 2.75, 0.05, "sugar required, kg");
  near(plan.finalVolumeL, 21.72, 0.05, "resulting volume, L");
  near(must.sgFromSugar(must.sugarForSg(1.045, 20) + plan.sugarG, plan.finalVolumeL), 1.09, 0.0005, "lands on target");
  // Asking to go DOWN is not chaptalisation. Sugar cannot lower a gravity, so
  // the honest answer is no addition, never a negative one that would read as
  // "remove 2 kg of sugar".
  assert.ok(must.chaptalise(1.09, 1.045, 20).sugarG <= 0, "no negative dose");
  // Water is the tool for that direction: 20 L of 1.090 down to 1.045 roughly
  // doubles the volume, because gravity points are conserved.
  const water = must.dilutionWaterL(1.09, 1.045, 20);
  near(water, 20, 1.5, "water to dilute 1.090 to 1.045");
});

test("sulfur dioxide follows the pKa 1.81 relation", () => {
  near(must.molecularSo2(30, 3.4), 0.75, 0.03, "30 mg/L free at pH 3.4");
  near(must.freeSo2Needed(0.8, 3.2), 20.4, 1.0, "free needed at pH 3.2");
  near(must.freeSo2Needed(0.8, 3.5), 40, 2.0, "free needed at pH 3.5");
  near(must.freeSo2Needed(0.8, 3.8), 79, 3.0, "free needed at pH 3.8");
  // Molecular fraction against the published table. Popular summaries quote
  // "3% at pH 3.5" and "1.5% at pH 4.0"; those are wrong — they correspond to
  // pH 3.32 and 3.63. These are what the winemaking tables actually print.
  near(must.molecularSo2(100, 3.0), 6.06, 0.05, "6.06% at pH 3.0");
  near(must.molecularSo2(100, 3.5), 2.0, 0.05, "2.00% at pH 3.5");
  near(must.molecularSo2(100, 4.0), 0.64, 0.05, "0.64% at pH 4.0");
  // The two are inverses of each other at any pH.
  near(must.freeSo2Needed(must.molecularSo2(45, 3.45), 3.45), 45, 1e-9, "round-trip");
});

test("nitrogen", () => {
  // DAP is (NH4)2HPO4, MW 132.06 with 2 N at 14.007 — 21.2% N by mass, so
  // 1 g/L supplies 212 mg/L of YAN.
  near(must.yanTarget(24, "medium"), 240, 1, "24 Brix, medium demand");
  assert.ok(must.yanTarget(24, "high") > must.yanTarget(24, "medium"), "high demand asks more");
  assert.ok(must.yanTarget(24, "low") < must.yanTarget(24, "medium"), "low demand asks less");
});

test("acid conversions between the reference acids", () => {
  // 4 g/L as sulfuric is 6.12 g/L as tartaric — the standard factor between
  // the EU and US ways of reporting the same titration.
  near(must.convertTa(4, "sulfuric", "tartaric"), 6.12, 0.02, "sulfuric -> tartaric");
  near(must.convertTa(6.12, "tartaric", "sulfuric"), 4, 0.02, "and back");
  near(must.convertTa(5, "tartaric", "tartaric"), 5, 1e-9, "identity");
});

test("distilling", () => {
  assert.equal(must.abvToUsProof(40), 80);
  assert.equal(must.usProofToAbv(80), 40);
  // Proofing 5 L of 70% down to 40% gives 8.75 L — alcohol is conserved.
  const p = must.proofDown(70, 5, 40);
  near(p.finalVolumeL, 8.75, 0.01, "final volume");
  near(p.waterToAddL, 3.75, 0.01, "water added");
  // 2%/yr for 12 years leaves 156.9 L of an original 200.
  near(must.angelsShare(12, 2, 200), 156.9, 0.5, "angel's share");
  assert.equal(must.angelsShare(0, 2, 200), 200, "no time, no loss");
});

test("unit helpers are exact", () => {
  assert.equal(must.LB_TO_KG, 0.45359237);
  assert.equal(must.GAL_TO_L, 3.785411784);
  assert.equal(must.OZ_TO_G, 28.349523125);
  near(must.lbToG(1), 453.59237, 1e-9, "lb -> g");
  near(must.gToLb(453.59237), 1, 1e-12, "g -> lb");
  near(must.galToL(1), 3.785411784, 1e-12, "gal -> L");
  near(must.lToGal(3.785411784), 1, 1e-12, "L -> gal");
});
