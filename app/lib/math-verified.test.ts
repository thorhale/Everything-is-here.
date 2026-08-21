// The shipped calculation corpus, held to an independent CAS.
//
// data/math-verified.json holds reference values computed by SymPy/mpmath at
// 50 digits (scripts/derive-math-fixtures.py) — a second implementation of
// each expression, in a different language, on a different numeric stack.
// This test pins the shipped TypeScript to those values. When the Wolfram
// connector is available the same expressions get countersigned there; the
// values do not change, or a changed value is a finding.
//
// The barrel fixtures are exercised in barrel.test.ts; this file covers the
// rest of the corpus.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { wkToLintner, iobToWk } from "./diastatic-power";
import { dispensePsig, STANDARD_BEER, abwFractionFromAbv } from "./draft-line";
import { kegPsi, sgToPlato } from "./brewing-calcs";
import { chaptalise } from "./must";

const FIXTURES: { id: string; value: string; toleranceForTs: number; oracle: string }[] = JSON.parse(
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

test("every fixture names its oracle, so the Wolfram countersigning has somewhere to land", () => {
  for (const f of FIXTURES) {
    assert.match(f.oracle, /^sympy(\+wolfram)?$/, f.id);
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

test("chaptalisation matches the symbolic solve", () => {
  // 20 L of 1.045 to 1.090 — the CAS solved the displacement equation itself
  // rather than replaying the shipped formula, so agreement means the algebra
  // in must.ts is right, not merely self-consistent.
  pin("chaptalise-20L-1.045-to-1.090-grams", chaptalise(1.045, 1.09, 20).sugarG);
});
