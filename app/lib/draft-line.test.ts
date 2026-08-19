// The draft-line balance, tested against the publisher's own worked numbers.
//
// The acceptance test is DBQM Table 3.3 — the Brewers Association's own
// kegerator balance table at 38 °F — plus both Appendix C worked examples.
// If those reproduce through the real exports, the calculator is doing what
// the industry manual does, not what folklore does.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BEER_LINES,
  STANDARD_BEER,
  STATIC_PSI_PER_FT_RISE,
  abwFractionFromAbv,
  baroPsiaAtElevation,
  balanceLine,
  dispensePsig,
  findLine,
  type BalanceResult,
} from "./draft-line";
import { kegPsi } from "./brewing-calcs";

const near = (actual: number, expected: number, tol: number, what = "") =>
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${what}: got ${actual}, expected ${expected} ±${tol}`
  );

const ok = (r: BalanceResult | { error: string }): BalanceResult => {
  assert.ok(!("error" in r), "error" in r ? r.error : "");
  return r as BalanceResult;
};

// DBQM Table 3.3, "Direct-draw draught system balance at 38°F", transcribed
// exactly as printed: carbonation vols, applied psig, 3/16" vinyl length.
const TABLE_3_3: [number, number, string][] = [
  [2.3, 9.2, `3'3"`],
  [2.4, 10.3, `3'5"`],
  [2.5, 11.3, `3'9"`],
  [2.6, 12.4, `4'2"`],
  [2.7, 13.5, `4'6"`],
  [2.8, 14.5, `4'10"`],
  [2.9, 15.6, `5'7"`],
];
const ftIn = (s: string): number => {
  const m = s.match(/(\d+)'(\d+)"/)!;
  return Number(m[1]) + Number(m[2]) / 12;
};

test("the Dynamic Henry's Law relation reduces exactly to the classic chart constant", () => {
  // 5.16 / (1.015 × (1 + 0.038/0.789)) = 4.850 — the single constant in the
  // Holle/ASBC closed form. This identity is the whole reason the generalised
  // relation is trustworthy: at the 1949 chart's stated calibration (4.8% ABV,
  // SG 1.015, sea level — quoted verbatim in the DBQM) it IS the chart.
  const factor = 5.16 / (STANDARD_BEER.sg * (1 + STANDARD_BEER.abwFraction / 0.789));
  near(factor, 4.85, 0.001, "reduction to the classic constant");
  // And the DBQM's ABV↔ABW pair is self-consistent with the 0.789 density:
  near(abwFractionFromAbv(4.8, 1.015), 0.0373, 0.0008, "4.8% ABV ≈ 3.8% ABW");
});

test("every DBQM Table 3.3 pressure reproduces from the standard-beer relation", () => {
  for (const [vols, psig] of TABLE_3_3) {
    near(dispensePsig({ vols, tempF: 38 }), psig, 0.25, `${vols} vols at 38 °F`);
  }
});

test("DBQM Table 3.3 line lengths reproduce for the self-consistent rows", () => {
  // The manual's lengths follow its own arithmetic — length = psig / 3.0 for
  // 3/16" vinyl with no rise — on five of seven rows. Verified against each
  // printed foot-and-inch figure.
  for (const [vols, , printed] of TABLE_3_3.slice(1, 6)) {
    const r = ok(balanceLine({ vols, tempF: 38, tubing: "vinyl", size: '3/16"', riseFt: 0 }));
    near(r.lengthFt, ftIn(printed), 0.15, `${vols} vols -> ${printed}`);
  }
  // The remaining two rows are the manual's own internal inconsistency, worth
  // pinning so nobody "fixes" the code to match them: it prints 3'3" against
  // 9.2 psig (9.2/3.0 = 3'1") and 5'7" against 15.6 psig (15.6/3.0 = 5'2").
  // Its five middle rows and both Appendix C examples all follow psig/R
  // exactly, so the arithmetic — not the two stray typeset lengths — is what
  // this module implements.
  const first = ok(balanceLine({ vols: 2.3, tempF: 38, tubing: "vinyl", size: '3/16"', riseFt: 0 }));
  near(first.lengthFt, 9.2 / 3.0, 0.15, "row 1 follows the arithmetic");
  assert.ok(Math.abs(first.lengthFt - ftIn(`3'3"`)) > 0.1, "and genuinely differs from the printed 3'3\"");
});

test("DBQM Appendix C worked example: 12 ft rise, 22 psi", () => {
  // "Dynamic resistance = dispensing gas pressure − static resistance =
  //  22 − 6 = 16 lb", supplied by 120 ft of 5/16" barrier @ 0.1 (12 lb) plus
  //  1.3 ft of 3/16" vinyl choker @ 3.0 (4 lb).
  const staticPsi = 12 * STATIC_PSI_PER_FT_RISE;
  near(staticPsi, 6, 1e-9, "static resistance of a 12 ft lift");
  const dynamic = 22 - staticPsi;
  near(dynamic, 16, 1e-9, "dynamic resistance to supply");
  const barrier = findLine("barrier", '5/16"')!;
  const choker = findLine("vinyl", '3/16"')!;
  near(120 * barrier.resistancePsiPerFt + 1.3 * choker.resistancePsiPerFt, 15.9, 0.15, "the manual's own build-out");
});

test("DBQM Appendix C worked example: 10 ft DROP, negative static resistance", () => {
  // "Static resistance = 10 ft. × −0.5 lb./ft. = −5.0 lb. ... Dynamic
  //  resistance required = 11.7 + 5 = 16.7 lb", supplied by 10 ft of 1/4"
  //  barrier (3 lb) plus 4.6 ft of 3/16" vinyl (13.7 lb) = 16.8, which the
  //  manual calls "close enough".
  const staticPsi = -10 * STATIC_PSI_PER_FT_RISE;
  near(staticPsi, -5, 1e-9, "a drop contributes pressure");
  near(11.7 - staticPsi, 16.7, 1e-9, "dynamic resistance required");
  const barrier = findLine("barrier", '1/4"')!;
  const choker = findLine("vinyl", '3/16"')!;
  near(10 * barrier.resistancePsiPerFt + 4.6 * choker.resistancePsiPerFt, 16.8, 0.05, "the manual's build-out");
});

test("agrees with the existing kegPsi regression across the serving range", () => {
  // Two independent published forms of the same chart should not drift apart.
  for (const vols of [2.2, 2.4, 2.6, 2.8]) {
    for (const tempF of [34, 38, 42]) {
      near(dispensePsig({ vols, tempF }), kegPsi(vols, tempF), 0.6, `${vols} vols at ${tempF} °F`);
    }
  }
});

test("the ABV adjustment: direction, magnitude, and honesty", () => {
  const base = { vols: 2.5, tempF: 38 };
  const standard = dispensePsig(base);
  // A 10% ABV dry beverage needs a few percent more absolute pressure —
  // a modest, visible shift, not a dramatic one.
  const strong = dispensePsig({ ...base, abvPct: 10, sg: 1.0 });
  assert.ok(strong > standard - 0.4, "correction is not a big downward swing");
  const strongAbs = strong + 14.7;
  const stdAbs = standard + 14.7;
  const shift = strongAbs / stdAbs - 1;
  assert.ok(shift > -0.01 && shift < 0.06, `net shift ${(shift * 100).toFixed(1)}% stays modest`);
  // At fixed gravity, more alcohol always means more pressure in this model.
  const at5 = dispensePsig({ ...base, abvPct: 5, sg: 1.01 });
  const at12 = dispensePsig({ ...base, abvPct: 12, sg: 1.01 });
  assert.ok(at12 > at5, "monotonic in ABV at fixed gravity");
  // And the result carries the caveat: the balance note names the model and
  // the DBQM's refusal to endorse a number.
  const r = ok(balanceLine({ ...base, abvPct: 10, sg: 1.0, tubing: "vinyl", size: '3/16"', riseFt: 0 }));
  assert.ok(r.notes.some((n) => /declines to quantify|opposing/.test(n)), "the caveat is present");
  near(r.standardBeerPsig, standard, 1e-9, "the standard-beer figure is shown for comparison");
});

test("altitude follows the ASBC convention", () => {
  near(baroPsiaAtElevation(0), 14.7, 1e-9, "sea level");
  near(baroPsiaAtElevation(5280), 14.7 - 2.64, 1e-9, "Denver, ~1 psi per 2000 ft");
  // Less atmosphere on top means the gauge must supply more of the absolute
  // pressure: the regulator reads higher at altitude for the same volumes.
  assert.ok(
    dispensePsig({ vols: 2.5, tempF: 38, elevationFt: 5280 }) > dispensePsig({ vols: 2.5, tempF: 38 }),
    "higher gauge pressure at altitude"
  );
});

test("monotonicity of the balance", () => {
  const base = { tempF: 38, tubing: "vinyl" as const, size: '3/16"', riseFt: 1 };
  const shortLine = ok(balanceLine({ ...base, vols: 2.2 })).lengthFt;
  const longLine = ok(balanceLine({ ...base, vols: 2.8 })).lengthFt;
  assert.ok(longLine > shortLine, "more carbonation, more line");
  const cold = ok(balanceLine({ ...base, vols: 2.5, tempF: 34 })).lengthFt;
  const warm = ok(balanceLine({ ...base, vols: 2.5, tempF: 42 })).lengthFt;
  assert.ok(warm > cold, "warmer keg, more line");
  const flat = ok(balanceLine({ ...base, vols: 2.5, riseFt: 0 })).lengthFt;
  const tall = ok(balanceLine({ ...base, vols: 2.5, riseFt: 4 })).lengthFt;
  assert.ok(tall < flat, "lift spends pressure the line no longer has to");
  const fat = ok(balanceLine({ ...base, vols: 2.5, tubing: "vinyl", size: '1/4"' }));
  assert.ok(fat.lengthFt > flat, "a fatter line needs more feet for the same resistance");
});

test("degenerate inputs warn instead of producing nonsense", () => {
  const impossible = balanceLine({ vols: 2.5, tempF: 38, tubing: "vinyl", size: '3/16"', riseFt: 40 });
  const r = ok(impossible);
  assert.ok(r.warnings.some((w) => /No line length can balance/.test(w)), "unbalanceable lift warns");
  assert.equal(r.lengthFt, 0, "and the length is clamped to zero, not negative");

  // A ½" line at 0.025 psi/ft is the opposite failure: it barely resists, so
  // balancing 11 psi would take ~450 ft of it. That gets a warning too.
  const fireHose = ok(balanceLine({ vols: 2.5, tempF: 38, tubing: "vinyl", size: '1/2"', riseFt: 0 }));
  assert.ok(fireHose.lengthFt > 400, `half-inch demands an absurd run (${fireHose.lengthFt.toFixed(0)} ft)`);
  assert.ok(fireHose.warnings.some((w) => /not a practical balance/.test(w)), "and says so");
  // Whereas a genuinely short balance — low carbonation, cold, tall lift on
  // 3/16" vinyl — computes under a foot of line and warns of gushing.
  const gusher = ok(balanceLine({ vols: 2.0, tempF: 34, tubing: "vinyl", size: '3/16"', riseFt: 4 }));
  assert.ok(gusher.lengthFt > 0 && gusher.lengthFt < 3, `short balance (${gusher.lengthFt.toFixed(2)} ft)`);
  assert.ok(gusher.warnings.some((w) => /too little line|flow-control/.test(w)), "warns of gushing");

  assert.ok("error" in balanceLine({ vols: 0, tempF: 38, tubing: "vinyl", size: '3/16"', riseFt: 0 }));
  assert.ok("error" in balanceLine({ vols: 2.5, tempF: 38, tubing: "vinyl", size: '7/8"', riseFt: 0 }));
});

test("Table 4.1 volumes are physically consistent with the bores", () => {
  // fl oz per foot from pure geometry: π r² × 12 in³, at 0.554 fl oz/in³.
  // The manual's printed fractions should match the tube geometry for the
  // ID-specified lines — a transcription error here would show up as a
  // gross mismatch.
  const flOzPerFt = (idInches: number) => (Math.PI * (idInches / 2) ** 2 * 12) / 1.8047;
  for (const [size, id] of [['3/16"', 3 / 16], ['1/4"', 1 / 4], ['5/16"', 5 / 16], ['3/8"', 3 / 8], ['1/2"', 1 / 2]] as const) {
    const printed = BEER_LINES.find((l) => l.tubing === "vinyl" && l.size === size)!.volumeFlOzPerFt;
    near(printed, flOzPerFt(id), printed * 0.35, `vinyl ${size} volume vs geometry`);
  }
});
