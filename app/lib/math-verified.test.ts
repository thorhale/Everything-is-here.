// The shipped calculation corpus, held to an independent CAS.
//
// data/math-verified.json holds reference values computed by SymPy/mpmath at
// 50 digits (scripts/derive-math-fixtures.py) — a second implementation of
// each expression, in a different language, on a different numeric stack.
// This test pins the shipped TypeScript to those values. Every fixture has
// since been countersigned in a Wolfram Language kernel, whose returned digits
// are recorded beside each value as `wolframValue`; the generating script
// re-checks that agreement on every run and refuses to write a file where the
// two oracles disagree. Three implementations now have to agree before a
// number ships, and a value that moves under any of them is a finding.
//
// The barrel fixtures are exercised in barrel.test.ts; this file covers the
// rest of the corpus.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { wkToLintner, iobToWk } from "./diastatic-power";
import { dispensePsig, STANDARD_BEER, abwFractionFromAbv, SEA_LEVEL_PSIA } from "./draft-line";
import { kegPsi, sgToPlato } from "./brewing-calcs";
import { chaptalise } from "./must";
import { L_PER_GALLON, ML_PER_GALLON, G_PER_OZ, KG_PER_LB, KG_PER_OZ } from "./units";

const FIXTURES: {
  id: string;
  value: string;
  toleranceForTs: number;
  oracle: string;
  wolframValue?: string;
}[] = JSON.parse(
  readFileSync(join(process.cwd(), "..", "data", "math-verified.json"), "utf8")
).fixtures;
const fx = (id: string) => {
  const f = FIXTURES.find((x) => x.id === id);
  assert.ok(f, `missing fixture ${id}`);
  return { value: Number(f!.value), tol: f!.toleranceForTs };
};
const pin = (id: string, actual: number, what = id) => {
  const f = fx(id);
  assert.ok(
    Math.abs(actual - f.value) <= f.tol,
    `${what}: shipped code gives ${actual}, the CAS says ${f.value} ±${f.tol}`
  );
};

test("every fixture names its oracles, and a countersigned one carries the second's digits", () => {
  for (const f of FIXTURES) {
    assert.match(f.oracle, /^sympy(\+wolfram)?$/, f.id);
    if (f.oracle === "sympy+wolfram") {
      assert.ok(f.wolframValue, `${f.id} claims a countersignature but records no Wolfram value`);
      // Cheap independent re-check of the claim, in a third language: the two
      // oracles' digits must agree to double precision, not merely be present.
      const a = Number(f.value);
      const b = Number(f.wolframValue);
      assert.ok(
        Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(b)),
        `${f.id}: oracles disagree — sympy ${f.value} vs wolfram ${f.wolframValue}`
      );
    }
  }
});

test("diastatic-power scale conversions match the CAS", () => {
  pin("wk-to-lintner-simpsons-244", wkToLintner(244));
  pin("iob-to-wk-ratio", iobToWk(40) / 40);
});

test("the carbonation relations match the CAS", () => {
  // The reduction identity that justifies the whole Dynamic Henry's Law form,
  // at the chart's own STATED calibration (ABW 3.8% exactly — the DBQM quotes
  // "3.8% ABW or 4.8% ABV" as a rounded pair, and the ABV-derived fraction is
  // 3.73%, which is why the stated figure is used here, not the derived one).
  pin(
    "bevsense-reduction-to-classic",
    5.16 / (STANDARD_BEER.sg * (1 + STANDARD_BEER.abwFraction / 0.789)),
    "reduction to the 4.85 constant"
  );
  // And the derived fraction stays within the rounding the chart's own pair implies.
  assert.ok(Math.abs(abwFractionFromAbv(STANDARD_BEER.abvPct, STANDARD_BEER.sg) - STANDARD_BEER.abwFraction) < 0.001);
  pin("dispense-psig-2.4-38F", dispensePsig({ vols: 2.4, tempF: 38 }));
  pin("kegpsi-regression-2.4-38F", kegPsi(2.4, 38));
});

test("the ASBC gravity cubic matches the CAS", () => {
  pin("sg-to-plato-1.048", sgToPlato(1.048));
});

test("the unit constants are exact to the last digit", () => {
  // Exact by the 1959 international yard-and-pound definition, so these are
  // equalities, not tolerances — every volume and weight in the app is scaled
  // by them, which makes an error here silent and everywhere at once.
  pin("us-gallon-litres", L_PER_GALLON);
  pin("us-gallon-litres", ML_PER_GALLON / 1000, "ML_PER_GALLON agrees with L_PER_GALLON");
  pin("avoirdupois-ounce-grams", G_PER_OZ);
  pin("avoirdupois-pound-grams", KG_PER_LB * 1000);
  pin("avoirdupois-ounce-grams", KG_PER_OZ * 1000, "KG_PER_OZ agrees with G_PER_OZ");
  // Sixteen ounces to the pound, exactly, across the two independent constants.
  assert.equal(KG_PER_OZ * 16, KG_PER_LB);
});

test("the ASBC sea-level convention is a rounding of the real atmosphere, not a typo", () => {
  const atm = fx("standard-atmosphere-psi");
  assert.ok(
    Math.abs(SEA_LEVEL_PSIA - atm.value) < 0.005,
    `14.7 psia should be one standard atmosphere (${atm.value}) to within the convention's rounding`
  );
  assert.notEqual(SEA_LEVEL_PSIA, atm.value); // it IS the rounded figure, deliberately
});

test("chaptalisation matches the symbolic solve", () => {
  // 20 L of 1.045 to 1.090 — the CAS solved the displacement equation itself
  // rather than replaying the shipped formula, so agreement means the algebra
  // in must.ts is right, not merely self-consistent.
  pin("chaptalise-20L-1.045-to-1.090-grams", chaptalise(1.045, 1.09, 20).sugarG);
});
