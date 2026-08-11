// The pitching maths, run against the published targets it is built on.
//
// Seven exported functions, none of them previously executed by a test. This is
// the calculator a brewer trusts to tell them whether one vial is enough, and
// under-pitching is the single most common cause of a stuck or estery
// fermentation — so "it compiles" was not a good enough guarantee.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as p from "./formulas";

const near = (actual: number, expected: number, tol: number, what = "") =>
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${what}: got ${actual}, expected ${expected} ±${tol}`
  );

test("cells needed follows the White/Zainasheff rates", () => {
  // 5 US gal (18927 mL) of 1.048 wort is 11.9 °P.
  const volumeMl = 5 * p.ML_PER_GALLON;
  const ale = p.cellsNeeded({ volumeMl, og: 1.048, pitchRate: p.PITCH_RATES.ale });
  const lager = p.cellsNeeded({ volumeMl, og: 1.048, pitchRate: p.PITCH_RATES.lager });
  // 0.75 M/mL/°P x 11.9 °P x 18927 mL = 169 billion cells.
  near(ale, 169, 4, "ale pitch, billion cells");
  // A lager wants twice the ale rate.
  near(lager / ale, p.PITCH_RATES.lager / p.PITCH_RATES.ale, 1e-9, "lager vs ale");
  // Roughly one fresh 100 B vial for an ale, two for a lager — the sanity check
  // every brewer does in their head.
  assert.ok(ale > 100 && ale < 200);
  assert.ok(lager > 300 && lager < 400);
  // Degenerate inputs must be zero, not NaN or negative.
  assert.equal(p.cellsNeeded({ volumeMl: 0, og: 1.048, pitchRate: 0.75 }), 0);
  assert.equal(p.cellsNeeded({ volumeMl, og: 1.0, pitchRate: 0.75 }), 0);
  // Higher gravity needs more cells, always.
  assert.ok(
    p.cellsNeeded({ volumeMl, og: 1.09, pitchRate: 0.75 }) >
      p.cellsNeeded({ volumeMl, og: 1.048, pitchRate: 0.75 })
  );
});

test("viability decays with age, monotonically, and stays in [0,1]", () => {
  for (const model of ["classic", "optimistic", "whiteLabs", "wyeast"] as const) {
    near(p.viabilityAtAge(0, model), 1, 1e-9, `${model} fresh`);
    let previous = 1;
    for (const days of [7, 30, 90, 180, 365, 1000]) {
      const v = p.viabilityAtAge(days, model);
      assert.ok(v >= 0 && v <= 1, `${model} at ${days} d out of range: ${v}`);
      assert.ok(v <= previous + 1e-9, `${model} viability rose from ${previous} to ${v}`);
      previous = v;
    }
  }
  // The classic Mr Malty model is ~0.7%/day, so a six-month-old vial is well
  // under half viable — the reason a starter exists.
  assert.ok(p.viabilityAtAge(180, "classic") < 0.5);
  // Wyeast's ~20%/month is faster than White Labs' slower linear model.
  assert.ok(p.viabilityAtAge(60, "wyeast") < p.viabilityAtAge(60, "whiteLabs"));
});

test("cells from each source", () => {
  // A fresh vial is the 100 B reference.
  near(p.cellsFromSource({ source: "liquid", packs: 1, ageDays: 0, decayModel: "classic" }), 100, 1e-9, "fresh vial");
  near(p.cellsFromSource({ source: "liquid", packs: 2, ageDays: 0, decayModel: "classic" }), 200, 1e-9, "two vials");
  // An 11.5 g sachet at 20 B/g is ~230 B — why one sachet over-pitches a
  // small ale and a vial does not.
  near(p.cellsFromSource({ source: "dry", grams: 11.5, ageDays: 0, decayModel: "classic" }), 230, 1e-9, "one dry sachet");
  // Dry yeast keeps far better than liquid: same age, much less loss.
  const age = 180;
  const dry = p.cellsFromSource({ source: "dry", grams: 10, ageDays: age, decayModel: "classic" }) / 200;
  const liquid = p.cellsFromSource({ source: "liquid", packs: 1, ageDays: age, decayModel: "classic" }) / 100;
  assert.ok(dry > liquid, `dry (${dry}) should outlast liquid (${liquid})`);
  // Slurry: 500 mL at 25% yeast, fresh = 500 x 3.5 x 0.25 = 437.5 B.
  near(
    p.cellsFromSource({ source: "slurry", slurryMl: 500, yeastFractionPct: 25, ageDays: 0, decayModel: "classic" }),
    437.5, 1e-9, "half a litre of 25% slurry"
  );
  // Nonsense inputs give zero, never a negative cell count.
  assert.equal(p.cellsFromSource({ source: "liquid", packs: -3, ageDays: 0, decayModel: "classic" }), 0);
  assert.equal(p.cellsFromSource({ source: "slurry", slurryMl: 500, yeastFractionPct: 0, ageDays: 0, decayModel: "classic" }), 0);
});

test("starter growth is bounded by the method's carrying capacity", () => {
  const r = p.growInStarter(100, { type: "stirPlate", volumeMl: 2000 });
  assert.ok(r.totalCells > r.pitchedCells, "a starter should grow cells");
  assert.equal(r.totalCells, r.pitchedCells + r.newCells, "the parts must sum");
  assert.ok(r.totalCells <= r.capacityCells + 1e-6, "growth cannot exceed capacity");

  // A tiny starter pitched with a huge cell count cannot grow — the density is
  // already past the ceiling, and the honest answer is "no growth", not a
  // negative one. Note `capped` is deliberately FALSE here: it means "growth
  // ran into the ceiling", and there was no growth to limit. The caller tells
  // this case apart by comparing totalCells against capacityCells.
  const crowded = p.growInStarter(1000, { type: "stirPlate", volumeMl: 100 });
  assert.equal(crowded.newCells, 0, "no growth in an over-pitched starter");
  assert.equal(crowded.totalCells, 1000, "and no cells lost either");
  assert.equal(crowded.capped, false, "nothing was capped, because nothing grew");
  assert.ok(crowded.capacityCells < crowded.pitchedCells, "already past the ceiling");

  // Capped IS set when growth genuinely runs into the ceiling on the way up.
  const hitsCeiling = p.growInStarter(20, { type: "simple", volumeMl: 2000 });
  assert.ok(hitsCeiling.capped, "growth limited by the density ceiling");
  near(hitsCeiling.totalCells, hitsCeiling.capacityCells, 1e-9, "stops exactly at capacity");

  // No starter is a pass-through, not a loss.
  const none = p.growInStarter(150, { type: "none", volumeMl: 0 });
  assert.equal(none.totalCells, 150);
  assert.equal(none.newCells, 0);
  // Nothing pitched, nothing grown.
  assert.equal(p.growInStarter(0, { type: "stirPlate", volumeMl: 2000 }).totalCells, 0);

  // A stir plate does better than a still starter of the same size.
  const stirred = p.growInStarter(100, { type: "stirPlate", volumeMl: 2000 }).totalCells;
  const still = p.growInStarter(100, { type: "none", volumeMl: 2000 }).totalCells;
  assert.ok(stirred >= still);
});

test("growth rate falls as inoculation density rises", () => {
  assert.equal(p.inoculationGrowthRate(0), 0, "no inoculation, no defined rate");
  assert.ok(p.inoculationGrowthRate(25) > p.inoculationGrowthRate(100), "denser pitch grows less");
  assert.ok(p.inoculationGrowthRate(1e6) >= 0, "never negative, however dense");
});

test("computePitching ties the pieces together", () => {
  const result = p.computePitching({
    volumeMl: 5 * p.ML_PER_GALLON,
    og: 1.048,
    pitchRate: p.PITCH_RATES.ale,
    source: { source: "liquid", packs: 1, ageDays: 0, decayModel: "classic" },
    starter: { type: "none", volumeMl: 0 },
  });
  near(result.cellsNeeded, 169, 4, "cells needed");
  near(result.cellsAvailable, 100, 1e-9, "one fresh vial");
  assert.ok(result.cellsAvailable < result.cellsNeeded, "one vial under-pitches a 1.048 ale");

  // Add a stir-plate starter and it should close the gap.
  const withStarter = p.computePitching({
    volumeMl: 5 * p.ML_PER_GALLON,
    og: 1.048,
    pitchRate: p.PITCH_RATES.ale,
    source: { source: "liquid", packs: 1, ageDays: 0, decayModel: "classic" },
    starter: { type: "stirPlate", volumeMl: 2000 },
  });
  assert.ok(withStarter.cellsAvailable > result.cellsAvailable, "the starter grew cells");
});
