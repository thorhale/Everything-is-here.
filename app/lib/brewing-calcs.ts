// Classic brewing utility calculators — the kind of thing ProMash's Tools menu
// gave you. Every formula here is a published, free, standard homebrewing
// equation; each is validated against known reference values in
// scripts (see the validation note per function). Pure functions, no deps.

// --- Gravity unit conversions --------------------------------------------

// Specific gravity -> degrees Plato (ASBC cubic). ~11.9 °P at 1.048.
export function sgToPlato(sg: number): number {
  return -616.868 + 1111.14 * sg - 630.272 * sg * sg + 135.997 * sg * sg * sg;
}

// Degrees Plato -> specific gravity (inverse relation).
export function platoToSg(plato: number): number {
  return 1 + plato / (258.6 - (plato / 258.2) * 227.1);
}

export function sgToPoints(sg: number): number {
  return (sg - 1) * 1000;
}
export function pointsToSg(points: number): number {
  return 1 + points / 1000;
}

// --- Hydrometer temperature correction -----------------------------------

// A hydrometer reads true only at its calibration temperature. Correct a
// reading taken at `readF` °F, calibrated at `calF` °F (usually 60). Standard
// polynomial (Lyons). Validated: 1.050 read at 80°F, cal 60°F -> ~1.0530.
export function correctHydrometer(measuredSg: number, readF: number, calF = 60): number {
  const f = (t: number) =>
    1.00130346 - 0.000134722124 * t + 0.00000204052596 * t * t - 0.00000000232820948 * t * t * t;
  return measuredSg * (f(readF) / f(calF));
}

// --- Refractometer -------------------------------------------------------

// Refractometers read in Brix but assume a sucrose solution; wort reads a
// little high, corrected by the Wort Correction Factor (WCF, ~1.04). Convert a
// refractometer Brix reading of UNFERMENTED wort to SG.
export function refractometerToSg(brix: number, wcf = 1.04): number {
  return platoToSg(brix / wcf);
}

// Once alcohol is present, a refractometer can't read FG directly — alcohol
// bends light too. Terrill's cubic estimates true FG from the ORIGINAL and
// FINAL refractometer Brix (both raw readings, WCF applied internally).
// Validated: OG 12.0 Bx, FG 6.0 Bx -> ~1.013 FG (~4.9% ABV).
export function refractometerFg(originalBrix: number, finalBrix: number, wcf = 1.04): number {
  const bi = originalBrix / wcf;
  const bf = finalBrix / wcf;
  return (
    1.0 -
    0.0044993 * bi +
    0.011774 * bf +
    0.00027581 * bi * bi -
    0.0012717 * bf * bf -
    0.00000728 * bi * bi * bi +
    0.000063293 * bf * bf * bf
  );
}

// --- Alcohol -------------------------------------------------------------

// Simple ABV — the (OG-FG)*131.25 rule. Fine below ~1.070.
export function abvSimple(og: number, fg: number): number {
  return (og - fg) * 131.25;
}

// Alternate/advanced ABV (Cutaia/Novotný), more accurate at higher gravity.
// Validated: 1.060 -> 1.012 gives ~6.3% ABV.
export function abvAdvanced(og: number, fg: number): number {
  return (76.08 * (og - fg)) / (1.775 - og) * (fg / 0.794);
}

// Alcohol by weight from ABV (ethanol density 0.789).
export function abvToAbw(abv: number): number {
  return abv * 0.789;
}

// Apparent attenuation (%).
export function apparentAttenuation(og: number, fg: number): number {
  if (og <= 1) return 0;
  return ((og - fg) / (og - 1)) * 100;
}

// Calories per 12 oz serving. Standard formula from alcohol-by-weight and real
// extract (both in °Plato). Validated: 1.050 -> 1.010 gives ~164 kcal.
export function caloriesPer12oz(og: number, fg: number): number {
  const ogP = sgToPlato(og);
  const fgP = sgToPlato(fg);
  const re = 0.1808 * ogP + 0.8192 * fgP; // real extract, °P
  const abw = (ogP - re) / (2.0665 - 0.010665 * ogP);
  const cal = (6.9 * abw + 4.0 * (re - 0.1)) * fg * 3.55;
  return Math.round(cal);
}

// --- Carbonation & priming ----------------------------------------------

// CO2 already dissolved in beer at a given temperature (°F). Beer holds more
// CO2 when cold. Validated: ~0.85 volumes at 68°F.
export function residualCo2(beerTempF: number): number {
  return 3.0378 - 0.050062 * beerTempF + 0.00026555 * beerTempF * beerTempF;
}

export type PrimingSugar = "cornSugar" | "tableSugar" | "dme";
// Grams of CO2 produced per gram of priming sugar fermented.
const SUGAR_CO2_YIELD: Record<PrimingSugar, number> = {
  cornSugar: 0.444, // dextrose monohydrate
  tableSugar: 0.5, // sucrose
  dme: 0.4, // dry malt extract (~50-60% fermentable)
};

// Grams of priming sugar to reach `targetVols` in `volumeL` of beer that has
// been sitting at `beerTempF`. Validated: 5 gal, 68°F, 2.4 vols corn sugar
// -> ~130 g (~4.6 oz).
export function primingSugar(
  targetVols: number,
  volumeL: number,
  beerTempF: number,
  sugar: PrimingSugar = "cornSugar"
): number {
  const residual = residualCo2(beerTempF);
  const co2Grams = Math.max(0, targetVols - residual) * 1.96 * volumeL; // 1 vol = 1.96 g/L
  return co2Grams / SUGAR_CO2_YIELD[sugar];
}

// Force-carbonation regulator pressure (PSI) for `vols` at keg temp `tempF`.
// Standard public regression. Validated: 2.4 vols at 38°F -> ~11 PSI.
export function kegPsi(vols: number, tempF: number): number {
  return (
    -16.6999 -
    0.0101059 * tempF +
    0.00116512 * tempF * tempF +
    0.173354 * tempF * vols +
    4.24267 * vols -
    0.0684226 * vols * vols
  );
}

// --- Dilution & boil-off -------------------------------------------------

// Gravity points are conserved when you add or remove water: P1·V1 = P2·V2.
// New gravity after changing volume from `v1` to `v2`.
export function gravityAfterVolumeChange(sg: number, v1: number, v2: number): number {
  if (v2 <= 0) return sg;
  return pointsToSg((sgToPoints(sg) * v1) / v2);
}

// Water to ADD to bring `sg` down to `targetSg` (returns volume in v1's units).
export function dilutionWaterToAdd(sg: number, v1: number, targetSg: number): number {
  const tp = sgToPoints(targetSg);
  if (tp <= 0) return Infinity;
  return (sgToPoints(sg) * v1) / tp - v1;
}

// Volume to BOIL DOWN to, to raise `sg` to `targetSg`.
export function boilDownVolume(sg: number, v1: number, targetSg: number): number {
  const tp = sgToPoints(targetSg);
  if (tp <= 0) return v1;
  return (sgToPoints(sg) * v1) / tp;
}

// --- Mash temperature ----------------------------------------------------

// Strike water temperature (°F) for a single-infusion mash. `ratio` is the
// water:grain ratio in quarts per pound; grain enters at `grainTempF`, target
// mash temp `targetF`. Palmer's formula (0.2 = grain specific heat).
// Validated: 1.25 qt/lb, grain 68°F, target 152°F -> ~164°F strike.
export function strikeTemp(targetF: number, grainTempF: number, ratioQtPerLb: number): number {
  if (ratioQtPerLb <= 0) return targetF;
  return (0.2 / ratioQtPerLb) * (targetF - grainTempF) + targetF;
}

// Volume of boiling (or `infusionTempF`) water to add to step a mash up from
// `currentF` to `targetF`. `grainLb`, existing mash water `mashQt` (quarts).
// Returns quarts to add. Palmer's infusion equation.
export function infusionVolume(
  targetF: number,
  currentF: number,
  grainLb: number,
  mashQt: number,
  infusionTempF = 212
): number {
  const denom = infusionTempF - targetF;
  if (denom <= 0) return 0;
  return ((targetF - currentF) * (0.2 * grainLb + mashQt)) / denom;
}

// --- Colour --------------------------------------------------------------

export function srmToEbc(srm: number): number {
  return srm * 1.97;
}
export function ebcToSrm(ebc: number): number {
  return ebc / 1.97;
}

// --- Small unit helpers --------------------------------------------------

export const ML_PER_GALLON = 3785.411784;
export const L_PER_GALLON = 3.785411784;
export const G_PER_OZ = 28.349523125;
export function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}
export function fToC(f: number): number {
  return ((f - 32) * 5) / 9;
}
