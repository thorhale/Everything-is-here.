// Inoculation by WEIGHT — the wine/cider/mead standard, distinct from beer's
// cells/mL/°Plato model in lib/pitching/formulas.ts. Active dry wine yeast
// (ADWY) is dosed as grams per hectolitre of must, rehydrated warm before
// pitching.
//
// PROVENANCE: the only committed figure here is the AWRI rehydration standard
// (25 g/hL → a minimum 5×10⁶ viable cells/mL; rehydrate in 5–10× the yeast
// weight of 38–40 °C water). That is a world-class primary source (the
// Australian Wine Research Institute). Cider and mead commonly pitch the same
// active dry wine yeast; where a beverage has no separately-documented rate we
// say so rather than invent one.
//   - AWRI, "Yeast rehydration",
//     https://www.awri.com.au/industry_support/winemaking_resources/wine_fermentation/yeast-rehydration/

export const HL_PER_LITER = 0.01; // 1 hectolitre = 100 litres

// The sourced ADWY standard. Rate in grams of active dry yeast per hectolitre
// of must; the range and the "up to ~2×" note are AWRI's.
export const ADWY_STANDARD = {
  rateGPerHl: 25,
  rateLowGPerHl: 20,
  rateHighGPerHl: 30,
  // AWRI notes up to ~2× the base rate for highly clarified, high-Brix, or
  // high-SO2 musts.
  difficultMustMultiplier: 2,
  targetViableCellsPerMl: 5_000_000,
  rehydrateTempCLow: 38,
  rehydrateTempCHigh: 40,
  rehydrateWaterMultLow: 5,
  rehydrateWaterMultHigh: 10,
  standMinutesLow: 10,
  standMinutesHigh: 15,
  sourceUrl:
    "https://www.awri.com.au/industry_support/winemaking_resources/wine_fermentation/yeast-rehydration/",
} as const;

// Grams of active dry yeast for a must volume at a chosen g/hL rate.
// g = (g/hL) × hL = (g/hL) × (litres / 100).
export function gramsOfYeast(rateGPerHl: number, volumeL: number): number {
  if (rateGPerHl <= 0 || volumeL <= 0) return 0;
  return rateGPerHl * volumeL * HL_PER_LITER;
}

export interface RehydrationWater {
  low: number; // grams (= mL) of water at the low multiplier
  high: number; // grams (= mL) of water at the high multiplier
}

// Rehydration water for a given weight of dry yeast, 5–10× by weight (AWRI).
// Water density ~1 g/mL, so grams and mL are interchangeable here.
export function rehydrationWater(grams: number): RehydrationWater {
  const g = Math.max(0, grams);
  return {
    low: g * ADWY_STANDARD.rehydrateWaterMultLow,
    high: g * ADWY_STANDARD.rehydrateWaterMultHigh,
  };
}

export interface InoculationResult {
  grams: number;
  water: RehydrationWater;
  targetViableCellsPerMl: number;
}

export function computeInoculation(rateGPerHl: number, volumeL: number): InoculationResult {
  const grams = gramsOfYeast(rateGPerHl, volumeL);
  return {
    grams,
    water: rehydrationWater(grams),
    targetViableCellsPerMl: ADWY_STANDARD.targetViableCellsPerMl,
  };
}
