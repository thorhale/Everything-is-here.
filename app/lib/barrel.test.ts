// The barrel gauge, held to the CAS oracle and to its own exact identities.
//
// The reference values in data/math-verified.json were computed by a second
// implementation in a different language on a different numeric stack —
// SymPy symbolically and mpmath at 50 digits (scripts/derive-math-fixtures.py).
// If this module's Simpson integrator drifts from those, the tests go red.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BARREL_PRESETS,
  geometryForPreset,
  geometryFromTape,
  totalVolumeM3,
  partialVolumeM3,
  gaugeFromDipstick,
  gaugeFromFace,
  portHeightForRemaining,
  type BarrelGeometry,
} from "./barrel";

const near = (actual: number, expected: number, tol: number, what = "") =>
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${what}: got ${actual}, expected ${expected} ±${tol}`
  );

const FIXTURES: { id: string; value: string; toleranceForTs: number }[] = JSON.parse(
  readFileSync(join(process.cwd(), "..", "data", "math-verified.json"), "utf8")
).fixtures;
const fx = (id: string) => {
  const f = FIXTURES.find((x) => x.id === id);
  assert.ok(f, `missing fixture ${id}`);
  return { value: Number(f!.value), tol: f!.toleranceForTs };
};

// The canonical barrel the fixtures were derived for.
const CANON: BarrelGeometry = { lengthM: 0.8, bilgeRadiusM: 0.32, headRadiusM: 0.26 };

test("closed-form total matches the CAS derivation", () => {
  const f = fx("barrel-canonical-total-m3");
  near(totalVolumeM3(CANON), f.value, f.tol, "canonical barrel total");
  // Degenerate cylinder: R_h = R_b must give exactly πLr².
  const cyl: BarrelGeometry = { lengthM: 1, bilgeRadiusM: 0.5, headRadiusM: 0.5 };
  near(totalVolumeM3(cyl), Math.PI * 0.25, 1e-12, "cylinder degenerate case");
});

test("partial volumes reproduce the 50-digit quadrature at every pinned fill", () => {
  for (const frac of ["0.1", "0.25", "0.5", "0.75", "0.9"]) {
    const f = fx(`barrel-canonical-fill-${frac}`);
    const h = Number(frac) * 2 * CANON.bilgeRadiusM;
    near(partialVolumeM3(CANON, h), f.value, f.tol, `fill fraction ${frac}`);
  }
});

test("exact identities: empty, full, and half-full is exactly half", () => {
  assert.equal(partialVolumeM3(CANON, 0), 0, "empty");
  near(partialVolumeM3(CANON, 2 * CANON.bilgeRadiusM), totalVolumeM3(CANON), 1e-12, "full");
  // Every cross-section is a circle centred on the axis, so the axis plane
  // halves each one — and therefore the whole barrel — exactly.
  near(partialVolumeM3(CANON, CANON.bilgeRadiusM), totalVolumeM3(CANON) / 2, 1e-9, "half");
  // Monotone in between.
  let prev = -1;
  for (let i = 0; i <= 20; i++) {
    const v = partialVolumeM3(CANON, (i / 20) * 2 * CANON.bilgeRadiusM);
    assert.ok(v >= prev, `fill curve dipped at step ${i}`);
    prev = v;
  }
});

test("every preset calibrates to its cooperage's nominal volume", () => {
  for (const p of BARREL_PRESETS) {
    const g = geometryForPreset(p);
    near(totalVolumeM3(g) * 1000, p.nominalL, 0.01, p.id);
    // And the calibrated internals stay physically inside the published externals.
    assert.ok(g.bilgeRadiusM * 200 < p.extBellyDiaCm, `${p.id}: bilge inside the staves`);
    assert.ok(g.headRadiusM * 200 < p.extHeadDiaCm, `${p.id}: head inside the staves`);
    assert.ok(g.headRadiusM < g.bilgeRadiusM, `${p.id}: a barrel, not a reverse barrel`);
  }
});

test("dipstick and face measurements of the same plane agree exactly", () => {
  const g = geometryForPreset(BARREL_PRESETS[0]);
  const offsetCm = (g.bilgeRadiusM - g.headRadiusM) * 100;
  for (const faceCm of [5, 15, 30, 45]) {
    const viaFace = gaugeFromFace(g, faceCm);
    const viaStick = gaugeFromDipstick(g, faceCm + offsetCm);
    near(viaFace.volumeL, viaStick.volumeL, 1e-9, `face ${faceCm} cm`);
    near(viaFace.bilgeHeightM, viaStick.bilgeHeightM, 1e-12, "same plane");
  }
});

test("the 225 L preset behaves like a 225 L barrel", () => {
  const g = geometryForPreset(BARREL_PRESETS[0]);
  // Stick reading at the axis: exactly half the barrel.
  const half = gaugeFromDipstick(g, g.bilgeRadiusM * 100);
  near(half.volumeL, 112.5, 0.01, "half-full is 112.5 L");
  near(half.fillPct, 50, 0.01, "fill percent");
  // Sensitivity mid-barrel is a few litres per cm — the scale of a real cask,
  // and the number the card quotes as its error bar.
  assert.ok(half.litresPerCm > 3 && half.litresPerCm < 6, `L/cm mid-fill: ${half.litresPerCm}`);
  // A dry stick and a drowned stick clamp to the ends.
  assert.equal(gaugeFromDipstick(g, 0).volumeL, 0);
  near(gaugeFromDipstick(g, 500).volumeL, 225, 0.01, "over-long reading clamps to full");
});

test("the sampling-port helper round-trips and refuses the impossible", () => {
  const g = geometryForPreset(BARREL_PRESETS[0]);
  const r = portHeightForRemaining(g, 20);
  assert.ok(!("error" in r), "20 L heel is reachable on the face");
  if (!("error" in r)) {
    // Drilling at that height and letting the liquid fall to the port must
    // leave exactly the requested heel.
    near(gaugeFromFace(g, r.faceCm).volumeL, 20, 0.05, "round-trip");
    assert.ok(r.faceCm > 0 && r.faceCm < g.headRadiusM * 200, "on the face");
  }
  // A heel bigger than the barrel, or nothing at all, is an error not a number.
  assert.ok("error" in portHeightForRemaining(g, 0));
  assert.ok("error" in portHeightForRemaining(g, 10000));
  // A tiny heel sits below the face circle on a barrel whose bilge stands
  // proud of the head — the helper explains rather than extrapolating.
  const tiny = portHeightForRemaining(g, 0.5);
  if ("error" in tiny) assert.match(tiny.error, /below the bottom of the face/);
});

test("the choice of stave curve is worth the 0.117% the card claims", () => {
  // The card tells the reader that assuming a circular-arc stave instead of the
  // parabolic one moves the answer by about a tenth of a percent. That is a
  // factual claim about this geometry, so it is held to the CAS rather than
  // asserted in prose: the arc through the same head and bilge radii, by the
  // sagitta relation R = ((Rb-Rh)^2 + (L/2)^2) / (2(Rb-Rh)).
  const { lengthM: L, bilgeRadiusM: Rb, headRadiusM: Rh } = CANON;
  const sag = Rb - Rh;
  const R = (sag * sag + (L / 2) ** 2) / (2 * sag);
  const n = 4000;
  const dx = L / n;
  const at = (x: number) => Math.PI * (Rb - R + Math.sqrt(R * R - x * x)) ** 2;
  let sum = at(-L / 2) + at(L / 2);
  for (let i = 1; i < n; i++) sum += at(-L / 2 + i * dx) * (i % 2 === 0 ? 2 : 4);
  const circular = (sum * dx) / 3;

  const parabolic = totalVolumeM3(CANON);
  const spreadPct = (100 * (circular - parabolic)) / parabolic;
  const f = fx("barrel-stave-profile-model-spread-pct");
  near(spreadPct, f.value, f.tol, "circular-vs-parabolic model spread");
  // And the headline the copy rests on: a quarter of a litre on a 227 L cask,
  // which is less than one centimetre of dipstick.
  assert.ok((circular - parabolic) * 1000 < 0.3, "model spread under 0.3 L");
});

test("tape-measure mode produces a plausible barrel from published externals", () => {
  // The Barrel Mill's 53-gallon externals with its ~1 inch staves should land
  // within a few percent of 53 gallons — tape mode is uncalibrated, so this is
  // a sanity corridor, not an equality.
  const g = geometryFromTape({
    bellyDiaCm: 25.5 * 2.54,
    headDiaCm: 20.625 * 2.54,
    heightCm: 35 * 2.54,
    staveThicknessMm: 25.4,
  });
  const litres = totalVolumeM3(g) * 1000;
  near(litres, 53 * 3.785411784, 20, `uncalibrated tape estimate: ${litres.toFixed(1)} L`);
  // Thicker staves must mean less barrel.
  const thick = geometryFromTape({ bellyDiaCm: 64.8, headDiaCm: 52.4, heightCm: 88.9, staveThicknessMm: 30 });
  const thin = geometryFromTape({ bellyDiaCm: 64.8, headDiaCm: 52.4, heightCm: 88.9, staveThicknessMm: 20 });
  assert.ok(totalVolumeM3(thick) < totalVolumeM3(thin));
});
