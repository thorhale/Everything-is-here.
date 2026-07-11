// BrewToad's recipe calculator formulas, ported from scraper/calculator.py
// (itself extracted verbatim from the archived /assets/recipe_editor.js -
// see docs/calculator-formulas.md for the derivation and golden-set
// validation). Keep both implementations in sync if either changes.

export interface CalcFermentable {
  amountLb: number;
  ppg: number;
  isGrain: boolean; // efficiency-scaled and skipped for "Extract" recipes when true
}

export interface CalcHop {
  amountOz: number;
  alphaPct: number;
  timeMin: number;
  isDryHop: boolean;
}

export interface CalcInputs {
  batchSizeGal: number;
  efficiencyPct: number;
  attenuationPct: number;
  fermentables: CalcFermentable[];
  hops: CalcHop[];
  fermentableColors: { colorLovibond: number; amountLb: number }[];
  recipeType?: "All Grain" | "Extract";
  boilSizeGal?: number;
}

function gravityAt(volumeGal: number, inputs: CalcInputs): number {
  if (volumeGal <= 0) return 1.0;
  let total = 0;
  for (const f of inputs.fermentables) {
    if (inputs.recipeType === "Extract" && f.isGrain) continue;
    let pc = f.ppg * f.amountLb;
    if (f.isGrain) pc *= inputs.efficiencyPct / 100;
    total += pc * (1 / volumeGal);
  }
  return total / 1000 + 1;
}

export function og(inputs: CalcInputs): number {
  return gravityAt(inputs.batchSizeGal, inputs);
}

function avgBoilGravity(inputs: CalcInputs): number {
  const boilSize = inputs.boilSizeGal ?? inputs.batchSizeGal;
  return gravityAt((boilSize + inputs.batchSizeGal) / 2, inputs);
}

export function fg(ogValue: number, attenuationPct: number): number {
  return 1 + (ogValue - 1) * (1 - attenuationPct / 100);
}

export function abv(ogValue: number, fgValue: number): number {
  return (ogValue - fgValue) * 131;
}

export function ibu(inputs: CalcInputs): number {
  if (inputs.batchSizeGal <= 0) return 0;
  const avgGravity = avgBoilGravity(inputs);
  const bignessFactor = 1.65 * Math.pow(0.000125, avgGravity - 1);
  let total = 0;
  for (const h of inputs.hops) {
    if (h.isDryHop) continue;
    const aauEquiv = h.amountOz * (h.alphaPct / 100) * 100;
    const timeFactor = (1 - Math.exp(-0.04 * h.timeMin)) / 4.15;
    const utilization = bignessFactor * timeFactor;
    total += (aauEquiv * utilization * 75) / inputs.batchSizeGal;
  }
  return total;
}

export function srm(inputs: CalcInputs): number {
  if (inputs.batchSizeGal <= 0) return 0;
  const mcu =
    inputs.fermentableColors.reduce((sum, f) => sum + f.colorLovibond * f.amountLb, 0) /
    inputs.batchSizeGal;
  return 1.4922 * Math.pow(mcu, 0.6859);
}

export interface RecipeStats {
  og: number;
  fg: number;
  abv: number;
  ibu: number;
  srm: number;
}

export function computeStats(inputs: CalcInputs): RecipeStats {
  const ogValue = og(inputs);
  const fgValue = fg(ogValue, inputs.attenuationPct);
  return {
    og: ogValue,
    fg: fgValue,
    abv: abv(ogValue, fgValue),
    ibu: ibu(inputs),
    srm: srm(inputs),
  };
}
