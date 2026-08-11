import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assessConversion,
  weightedDiastaticPower,
  maltToReachTarget,
  wkToLintner,
  iobToWk,
  iobToLintner,
  AMBA_MALT_CRITERIA,
  type GristItem,
} from "./diastatic-power";

const g = (
  key: string,
  massG: number,
  dp: number | null,
  basis: string | null,
  requiresConversion = false
): GristItem => ({ key, name: key, massG, diastaticPowerLintner: dp, diastaticPowerBasis: basis, requiresConversion });

// --- unit conversion -------------------------------------------------------
//
// Checked against Simpsons Malt, who publish the same malt's diastatic power on
// all three scales. These are their printed figures, not derived ones.

test("wkToLintner reproduces Simpsons' own published Lintner figures", () => {
  // Finest Pale Ale Golden Promise: IoB 40-65, °Lintner 47-74, WK 150-244.
  assert.ok(Math.abs(wkToLintner(150) - 47) <= 0.5);
  assert.ok(Math.abs(wkToLintner(244) - 74) <= 0.5);
  // Best Pale Ale / Finest Lager: IoB 40-80, °Lintner 47-90, WK 150-300.
  assert.ok(Math.abs(wkToLintner(300) - 90) <= 0.5);
  // Munich: IoB 20, °Lintner 26, WK 75.
  assert.ok(Math.abs(wkToLintner(75) - 26) <= 0.5);
});

test("the IoB to WK ratio holds on every pair Simpsons publishes", () => {
  // Simpsons prints these four (IoB, WK) pairs. Three are exact at x3.75; the
  // fourth is exact too, and only looks otherwise because Simpsons rounds its
  // own printed WK figure: 65 x 3.75 = 243.75, which they print as 244.
  for (const [iob, wk] of [
    [40, 150],
    [65, 244],
    [80, 300],
    [20, 75],
  ] as const) {
    assert.equal(Math.round(iobToWk(iob)), wk, `IoB ${iob}`);
  }
  assert.equal(iobToWk(40), 150);
  assert.equal(iobToWk(80), 300);
  assert.equal(iobToWk(20), 75);
  assert.ok(Math.abs(iobToLintner(40) - 47) <= 0.5);
});

// --- weighting -------------------------------------------------------------

test("weighting is by mass, and an unknown counts as zero rather than being skipped", () => {
  // 1 kg at 220 °L with 3 kg of corn: 220 / 4 = 55 across the bill.
  const bill = [g("distillers", 1000, 220, "published"), g("corn", 3000, 0, "unmalted", true)];
  assert.equal(weightedDiastaticPower(bill), 55);

  // Replacing the corn's declared zero with an unknown must not raise the
  // average — skipping unknowns is the failure mode that gets someone a stuck mash.
  const withUnknown = [g("distillers", 1000, 220, "published"), g("mystery", 3000, null, "unpublished")];
  assert.equal(weightedDiastaticPower(withUnknown), 55);
});

test("an empty bill is zero, not a division by zero", () => {
  assert.equal(weightedDiastaticPower([]), 0);
  assert.equal(weightedDiastaticPower([g("x", 0, 100, "published")]), 0);
});

// --- the bourbon case, which is the reason this module exists ---------------

test("a 75/15/10 bourbon mash on plain 2-row falls short of AMBA's grain-distilling floor", () => {
  const bill = [
    g("corn", 7500, 0, "unmalted", true),
    g("rye", 1500, 0, "unmalted", true),
    g("2-row", 1000, 140, "published"), // Briess Brewers Malt, the figure it publishes
  ];
  const a = assessConversion(bill, { endUse: "grain-distilling" });

  assert.equal(a.totalMassG, 10000);
  assert.equal(a.unmaltedFractionPct, 90);
  assert.equal(a.enzymeBearingFractionPct, 10);
  assert.equal(a.unknownMassG, 0);
  assert.equal(a.weightedLintnerFloor, 14); // 140 x 0.10
  assert.equal(a.maltFractionLintner, 140);
  // AMBA asks >200 °ASBC of a grain distiller's malt; 140 is 60 short.
  assert.equal(a.verdict, "short");
  assert.equal(a.headroomLintner, 140 - AMBA_MALT_CRITERIA["grain-distilling"].dpMin);
});

test("the same mash on Rahr's High DP distillers malt meets the floor", () => {
  const bill = [
    g("corn", 7500, 0, "unmalted", true),
    g("rye", 1500, 0, "unmalted", true),
    g("high-dp", 1000, 220, "published"), // Rahr High DP Distillers Malt, >220 L
  ];
  const a = assessConversion(bill, { endUse: "grain-distilling" });
  assert.equal(a.verdict, "meets");
  assert.equal(a.headroomLintner, 20);
  assert.equal(a.weightedLintnerFloor, 22);
});

test("maltToReachTarget says how much high-DP malt closes the gap", () => {
  const bill = [
    g("corn", 7500, 0, "unmalted", true),
    g("rye", 1500, 0, "unmalted", true),
    g("2-row", 1000, 140, "published"),
  ];
  const add = maltToReachTarget(bill, { diastaticPowerLintner: 260 }, { endUse: "grain-distilling" });
  assert.ok(add !== null);
  // (140*1000 + 260m) / (1000 + m) = 200  ->  m = 1000
  assert.ok(Math.abs((add as number) - 1000) < 1);

  // Adding a malt that is itself at or below the target can never pull the
  // average up to it, and the function must say so rather than return a number.
  assert.equal(maltToReachTarget(bill, { diastaticPowerLintner: 200 }, { endUse: "grain-distilling" }), null);
  assert.equal(maltToReachTarget(bill, { diastaticPowerLintner: 120 }, { endUse: "grain-distilling" }), null);
});

test("a bill that already meets its target asks for no addition", () => {
  const bill = [g("pale", 5000, 140, "published")];
  assert.equal(maltToReachTarget(bill, { diastaticPowerLintner: 260 }), null);
});

// --- all-malt and crystal --------------------------------------------------

test("crystal and roast count as weight against the enzyme supply, not as unknowns", () => {
  const bill = [
    g("2-row", 4000, 140, "published"),
    g("crystal-60", 500, 0, "process-zero"),
    g("chocolate", 200, 0, "process-zero"),
  ];
  const a = assessConversion(bill);
  assert.equal(a.unknownMassG, 0);
  assert.equal(a.endUse, "all-malt"); // no unmalted starch in it
  assert.equal(a.verdict, "meets"); // 140 clears AMBA's 110 all-malt floor
  assert.ok(Math.abs(a.weightedLintnerFloor - (140 * 4000) / 4700) < 0.01);
  assert.equal(a.maltFractionLintner, 140);
});

test("an unpublished figure is reported as a floor and named as unknown", () => {
  const bill = [
    g("briess-2row", 3000, 140, "published"),
    g("weyermann-pilsner", 2000, null, "published-qualitative"),
  ];
  const a = assessConversion(bill);
  assert.equal(a.unknownMassG, 2000);
  assert.equal(a.unknownFractionPct, 40);
  assert.equal(a.weightedLintnerFloor, 84); // 140 x 0.6, unknown counted as zero
  assert.equal(a.maltFractionLintner, 140); // the known malt's own average
  assert.ok(a.notes.some((n) => n.includes("floor rather than an")));
});

// --- degenerate and dosed cases -------------------------------------------

test("a bill with no enzyme source at all is undetermined, not a pass", () => {
  const a = assessConversion([g("corn", 5000, 0, "unmalted", true)]);
  assert.equal(a.verdict, "undetermined");
  assert.equal(a.maltFractionLintner, 0);
  assert.ok(a.notes.some((n) => n.includes("Nothing here can convert starch")));
});

test("a dosed amylase takes conversion off the malt, and says the DP still matters", () => {
  const bill = [g("corn", 9000, 0, "unmalted", true), g("2-row", 1000, 140, "published")];
  const a = assessConversion(bill, {
    endUse: "grain-distilling",
    dosedEnzyme: { id: "enzyme-amylase", name: "Alpha-amylase", gPerL: 0.3 },
  });
  assert.equal(a.verdict, "meets");
  assert.ok(a.notes.some((n) => n.includes("not malt-limited")));
  // The grain figures are still reported — the dose is a second line, not an erasure.
  assert.equal(a.weightedLintnerFloor, 14);
});

test("end use moves the bar, and it is the caller's declared intent", () => {
  const bill = [g("corn", 3000, 0, "unmalted", true), g("malt", 7000, 150, "published")];
  assert.equal(assessConversion(bill, { endUse: "all-malt" }).verdict, "meets"); // 110 floor
  assert.equal(assessConversion(bill, { endUse: "adjunct-brewing" }).verdict, "meets"); // 140 floor
  assert.equal(assessConversion(bill, { endUse: "grain-distilling" }).verdict, "short"); // 200 floor
  // Inferred rather than declared: unmalted starch present means adjunct brewing.
  assert.equal(assessConversion(bill).endUse, "adjunct-brewing");
});
