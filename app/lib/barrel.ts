// Kepler's problem: how much wine is in the barrel?
//
// In 1613 Johannes Kepler watched a wine merchant price the barrels at his own
// wedding by poking a gauging rod through the bung and reading one diagonal
// length, and did not believe a single number could measure every barrel shape.
// Working out when it could — and how solids of revolution should be measured
// at all — became "Nova stereometria doliorum vinariorum" (1615), the new solid
// geometry of wine barrels, whose slicing-into-indivisibles method is a direct
// ancestor of the integral calculus Newton and Leibniz later formalised. This
// module does exactly what that book does: slice the barrel and add up the
// slices.
//
// THE MODEL. A cask is a solid of revolution with a parabolic stave profile —
// the classical gauging approximation:
//
//     r(x) = R_h + (R_b − R_h)(1 − (2x/L)²),  x ∈ [−L/2, L/2]
//
// head radius R_h at each end, bilge radius R_b at the middle. Its total
// volume has a closed form, derived and verified symbolically (SymPy, this
// repo: scripts/derive-math-fixtures.py; degenerates to πLR_b² for a cylinder):
//
//     V = πL(8R_b² + 4R_b·R_h + 3R_h²) / 15
//
// PARTIAL VOLUME. The barrel rests on its bilge; the liquid surface is a
// horizontal plane at height h above the lowest point of the bilge. Every
// cross-section is a circle centred on the barrel's axis (which sits at height
// R_b), so the slice at position x is a circular segment of radius r(x) and
// local depth h − (R_b − r(x)). No tidy closed form exists, so the segment
// areas are integrated by Simpson's rule and the result is pinned, at five
// fill levels, to 50-digit quadrature fixtures in data/math-verified.json.
// Exact identities hold by construction and are tested: V(0)=0, V(2R_b)=total,
// and V(R_b) = total/2 exactly, because circles are symmetric about the axis.
//
// ONE PLANE, TWO MEASUREMENTS. The dipstick through the bung (top of the
// bilge, mid-length) reads h directly: wet length from the lowest point of the
// bilge. A height y measured on the FACE of the barrel — from the bottom of
// the head circle, e.g. to a drilled sampling port — is the same plane at
// h = y + (R_b − R_h), since the head circle's lowest point sits (R_b − R_h)
// above the bilge's. Face heights are measured from the bottom of the face,
// not from the ground, deliberately: the face-bottom datum is intrinsic to the
// barrel, while the ground datum changes with every rack and cradle.
//
// CALIBRATION, honestly. Cooperages publish EXTERNAL dimensions, and outside
// measurements under-determine the inside: World Cooperage's own dimension
// sheet lists identical externals (head Ø58, belly Ø71, height 89 cm) for BOTH
// its 240 L and 225 L barrels. So a preset trusts the maker's NOMINAL volume:
// the external dimensions fix the barrel's proportions (R_h/R_b and the
// length-to-diameter ratio), and the model is scaled so its total equals the
// nominal. What a preset then answers — "how full is my 225 L barrel at this
// dipstick reading" — is anchored to the number the cooperage stands behind.
// Custom mode takes tape measurements instead, subtracts a stated stave
// thickness, and reports the model's own total. Either way the card quotes the
// sensitivity (litres per cm of stick) so nobody mistakes a gauging model for
// a laboratory instrument.

import { L_PER_GALLON } from "@/lib/units";

// --- Presets, each from a fetched cooperage document ------------------------

export interface BarrelPreset {
  id: string;
  name: string;
  /** The volume the cooperage sells it as — what the model is calibrated to. */
  nominalL: number;
  /** External dimensions as published, cm. */
  extHeadDiaCm: number;
  extBellyDiaCm: number;
  extHeightCm: number;
  bungDiaMm: number | null;
  source: string;
  attribution: string;
}

export const BARREL_PRESETS: BarrelPreset[] = [
  {
    id: "wc-225-bordeaux-export",
    name: "225 L wine barrel (Bordeaux export size)",
    nominalL: 225,
    extHeadDiaCm: 58,
    extBellyDiaCm: 71,
    extHeightCm: 89,
    bungDiaMm: 50,
    source: "https://www.worldcooperage.com/wp-content/uploads/2020/06/World-Cooperage-Barrel-Dimensions-2020.pdf",
    attribution:
      "World Cooperage barrel dimensions sheet: head Ø 58 cm, belly Ø 71 cm, height 89 cm, bung Ø 50 mm.",
  },
  {
    id: "wc-240",
    name: "240 L wine barrel",
    nominalL: 240,
    extHeadDiaCm: 58,
    extBellyDiaCm: 71,
    extHeightCm: 89,
    bungDiaMm: 50,
    source: "https://www.worldcooperage.com/wp-content/uploads/2020/06/World-Cooperage-Barrel-Dimensions-2020.pdf",
    attribution:
      "World Cooperage barrel dimensions sheet. Note its externals are IDENTICAL to the 225 L barrel's — " +
      "the cooperage's own sheet is the proof that outside measurements cannot determine capacity, " +
      "which is why presets calibrate to nominal volume.",
  },
  {
    id: "wc-200",
    name: "200 L wine barrel",
    nominalL: 200,
    extHeadDiaCm: 54,
    extBellyDiaCm: 65,
    extHeightCm: 89,
    bungDiaMm: 50,
    source: "https://www.worldcooperage.com/wp-content/uploads/2020/06/World-Cooperage-Barrel-Dimensions-2020.pdf",
    attribution: "World Cooperage barrel dimensions sheet: head Ø 54 cm, belly Ø 65 cm, height 89 cm.",
  },
  {
    id: "tbm-53-gallon-whiskey",
    name: '53 gal American whiskey barrel',
    nominalL: 53 * L_PER_GALLON, // 200.6 L
    extHeadDiaCm: 20.625 * 2.54, // 20 5/8"
    extBellyDiaCm: 25.5 * 2.54, // 25 1/2"
    extHeightCm: 35 * 2.54, // 35"
    bungDiaMm: null, // tapered oak bung; no diameter published
    source: "https://thebarrelmill.com/barrels/",
    attribution:
      'The Barrel Mill (Avon, Minnesota) 53-gallon barrel specification: height 35", bilge 25 1/2", ' +
      'head diameter 20 5/8", tapered oak bung.',
  },
];

// --- Geometry ---------------------------------------------------------------

/** Internal barrel geometry the maths runs on. All metres. */
export interface BarrelGeometry {
  lengthM: number;
  bilgeRadiusM: number;
  headRadiusM: number;
}

/** Closed form: V = πL(8R_b² + 4R_b·R_h + 3R_h²)/15. CAS-verified. */
export function totalVolumeM3(g: BarrelGeometry): number {
  const { lengthM: L, bilgeRadiusM: Rb, headRadiusM: Rh } = g;
  return (Math.PI * L * (8 * Rb * Rb + 4 * Rb * Rh + 3 * Rh * Rh)) / 15;
}

/**
 * Internal length as a fraction of external height. Two head thicknesses plus
 * the chime (the stave overhang past the head) at each end — roughly 3.5 cm a
 * side on a wine barrel. The calibrated presets are nearly insensitive to this
 * (nominal volume re-fixes the radii); it matters for custom tape measurements
 * and is surfaced there as an explicit assumption, not buried.
 */
export const INTERNAL_LENGTH_FRACTION = 0.92;

/**
 * A preset's working geometry: proportions from the cooperage's external
 * dimensions, scale from its nominal volume.
 */
export function geometryForPreset(p: BarrelPreset): BarrelGeometry {
  const ratio = p.extHeadDiaCm / p.extBellyDiaCm; // R_h/R_b, preserved
  const lengthM = (p.extHeightCm / 100) * INTERNAL_LENGTH_FRACTION;
  // Solve V(R_b) = nominal with R_h = ratio·R_b:
  // nominal = πL·R_b²(8 + 4ρ + 3ρ²)/15  ⇒  R_b = √(15·nominal / (πL(8+4ρ+3ρ²)))
  const k = 8 + 4 * ratio + 3 * ratio * ratio;
  const bilgeRadiusM = Math.sqrt((15 * (p.nominalL / 1000)) / (Math.PI * lengthM * k));
  return { lengthM, bilgeRadiusM, headRadiusM: ratio * bilgeRadiusM };
}

/** Custom geometry from tape measurements of the outside, all in cm. */
export function geometryFromTape(input: {
  bellyDiaCm: number;
  headDiaCm: number;
  heightCm: number;
  /** Stave/head wood thickness. French wine barrels run 22–27 mm; American
   * whiskey barrels about 25 mm (1"). Default 25 mm, stated in the UI. */
  staveThicknessMm?: number;
}): BarrelGeometry {
  const t = (input.staveThicknessMm ?? 25) / 1000;
  return {
    lengthM: (input.heightCm / 100) * INTERNAL_LENGTH_FRACTION,
    bilgeRadiusM: Math.max(0.01, input.bellyDiaCm / 200 - t),
    headRadiusM: Math.max(0.01, input.headDiaCm / 200 - t),
  };
}

/**
 * Liquid volume (m³) at height h (m) above the lowest point of the bilge,
 * barrel horizontal. Simpson's rule over the axial direction; each slice is a
 * circular segment. Pinned to 50-digit quadrature fixtures at five fills.
 */
export function partialVolumeM3(g: BarrelGeometry, hM: number, steps = 400): number {
  const { lengthM: L, bilgeRadiusM: Rb, headRadiusM: Rh } = g;
  const h = Math.min(Math.max(hM, 0), 2 * Rb);
  if (h <= 0) return 0;
  if (h >= 2 * Rb) return totalVolumeM3(g);

  const segArea = (r: number, depth: number): number => {
    if (depth <= 0) return 0;
    if (depth >= 2 * r) return Math.PI * r * r;
    return r * r * Math.acos((r - depth) / r) - (r - depth) * Math.sqrt(2 * r * depth - depth * depth);
  };
  const slice = (u: number): number => {
    const r = Rh + (Rb - Rh) * (1 - (2 * u / L) ** 2);
    return segArea(r, h - (Rb - r));
  };

  // Simpson over [-L/2, L/2]; even step count enforced.
  const n = steps % 2 === 0 ? steps : steps + 1;
  const dx = L / n;
  let sum = slice(-L / 2) + slice(L / 2);
  for (let i = 1; i < n; i++) sum += slice(-L / 2 + i * dx) * (i % 2 === 0 ? 2 : 4);
  return (sum * dx) / 3;
}

// --- The two measuring modes, and the port helper ---------------------------

export interface GaugeResult {
  volumeL: number;
  totalL: number;
  fillPct: number;
  /** How much one cm of level is worth at this fill — the honest error bar. */
  litresPerCm: number;
  /** The plane's height above the bilge bottom, m (what a dipstick reads). */
  bilgeHeightM: number;
  /** The same plane on the face, above the bottom of the head circle, m.
   * Negative means the surface is below the face circle entirely. */
  faceHeightM: number;
}

function gauge(g: BarrelGeometry, hM: number): GaugeResult {
  const totalM3 = totalVolumeM3(g);
  const vM3 = partialVolumeM3(g, hM);
  const dh = 0.001; // one millimetre
  const slope = (partialVolumeM3(g, hM + dh) - partialVolumeM3(g, Math.max(0, hM - dh))) / (hM <= dh ? dh : 2 * dh);
  return {
    volumeL: vM3 * 1000,
    totalL: totalM3 * 1000,
    fillPct: (vM3 / totalM3) * 100,
    litresPerCm: slope * 1000 * 0.01,
    bilgeHeightM: Math.min(Math.max(hM, 0), 2 * g.bilgeRadiusM),
    faceHeightM: hM - (g.bilgeRadiusM - g.headRadiusM),
  };
}

/** Dipstick through the bung: wet length measured from the bilge bottom. */
export function gaugeFromDipstick(g: BarrelGeometry, wetCm: number): GaugeResult {
  return gauge(g, wetCm / 100);
}

/** Height on the FACE, measured from the bottom of the head circle. */
export function gaugeFromFace(g: BarrelGeometry, faceCm: number): GaugeResult {
  return gauge(g, faceCm / 100 + (g.bilgeRadiusM - g.headRadiusM));
}

/**
 * Where on the face to drill a sampling port so that `remainingL` litres sit
 * below it — i.e. you can sample until that much is left. Returns the height
 * in cm above the bottom of the face circle, by bisection on the monotone
 * fill curve, or an explanation when no face height can hold that volume
 * (the plane would sit below the head circle: the volume fits entirely in the
 * belly below face level).
 */
export function portHeightForRemaining(
  g: BarrelGeometry,
  remainingL: number
): { faceCm: number; bilgeCm: number } | { error: string } {
  const totalL = totalVolumeM3(g) * 1000;
  if (!(remainingL > 0) || remainingL >= totalL) {
    return { error: `Remaining volume must be between 0 and the barrel's ${totalL.toFixed(0)} L.` };
  }
  let lo = 0;
  let hi = 2 * g.bilgeRadiusM;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (partialVolumeM3(g, mid) * 1000 < remainingL) lo = mid;
    else hi = mid;
  }
  const h = (lo + hi) / 2;
  const faceM = h - (g.bilgeRadiusM - g.headRadiusM);
  if (faceM < 0) {
    return {
      error:
        `${remainingL.toFixed(0)} L sits below the bottom of the face circle — the surface at that ` +
        `volume is only ${(h * 100).toFixed(1)} cm up the bilge, under the head entirely. Drill at the ` +
        `very bottom of the face and about ${(partialVolumeM3(g, g.bilgeRadiusM - g.headRadiusM) * 1000).toFixed(0)} L ` +
        `will still be unreachable below the port.`,
    };
  }
  return { faceCm: faceM * 100, bilgeCm: h * 100 };
}
