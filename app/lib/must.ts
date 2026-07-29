// Must chemistry: the wine, cider, mead and spirit side of the calculator.
//
// Beer's numbers come out of the brewhouse — PPG, mash efficiency, IBU. None
// of those exist for a fermented fruit or honey must. What a winemaker or
// meadmaker actually needs to compute is a different set entirely:
//
//   sugar -> gravity -> potential alcohol      (how strong will it be)
//   chaptalisation                             (how much sugar to add)
//   titratable acidity and pH correction       (will it taste balanced, and
//                                               is it safe from spoilage)
//   molecular SO2                              (is it protected)
//   YAN and staggered nutrients                (will the yeast finish)
//   backsweetening and stabilisation           (can I sweeten it safely)
//   blending                                   (Pearson square)
//
// and for a distiller, on top of that: wash strength, expected absolute
// alcohol, cuts, and proofing.
//
// Every formula here is a published standard, not an invention. Sources are
// named at each function. Metric internally; imperial helpers at the bottom.

// ---------------------------------------------------------------------------
// Sugar, Brix and gravity
// ---------------------------------------------------------------------------

// One pound of sucrose in one US gallon reads 1.046, which is 453.59 g in
// 3.7854 L = 119.83 g/L. So one gram of sugar per litre is worth 46 / 119.83
// gravity points. This single constant bridges the beer catalog's PPG figures
// and the wine side's sugar-mass model: PPG = 46 x sugar mass fraction.
export const POINTS_PER_G_PER_L = 46 / (453.592 / 3.78541);
export const SUCROSE_PPG = 46;

export function sgFromSugar(sugarG: number, volumeL: number): number {
  if (volumeL <= 0) return 1;
  return 1 + (sugarG / volumeL) * POINTS_PER_G_PER_L / 1000;
}

export function sugarForSg(targetSg: number, volumeL: number): number {
  return ((targetSg - 1) * 1000 / POINTS_PER_G_PER_L) * volumeL;
}

// Brix is percent sugar by mass. The standard cubic fit used throughout the
// wine industry (Brix -> SG) is accurate to about 0.0002 over 0-30 Brix.
export function sgFromBrix(brix: number): number {
  return 1.0 + 0.0038661 * brix + 1.3488e-5 * brix ** 2 + 4.3074e-8 * brix ** 3;
}

// The ASBC inverse polynomial, the same one already used for Plato elsewhere
// in this codebase. Brix and Plato differ by less than 0.05 across the range
// that matters, so they are used interchangeably here.
export function brixFromSg(sg: number): number {
  return -668.962 + 1262.45 * sg - 776.43 * sg ** 2 + 182.94 * sg ** 3;
}

// Grams of sugar per litre implied by a Brix reading, given the must's own
// density — Brix is mass/mass, and a must at 24 Brix is denser than water.
export function sugarGPerLFromBrix(brix: number): number {
  return brix * 10 * sgFromBrix(brix);
}

// ---------------------------------------------------------------------------
// Alcohol
// ---------------------------------------------------------------------------

/**
 * ABV from gravity drop. The 131.25 factor is the standard homebrew
 * approximation and is good to about ±0.3% up to roughly 1.080. Above that it
 * increasingly under-reads, which matters for mead and high-Brix wine — so
 * `abvAlternate` gives the Cutaia/Berry higher-order fit that holds up better
 * at strength, and both are surfaced in the UI rather than picking a winner.
 */
export function abvSimple(og: number, fg: number): number {
  return (og - fg) * 131.25;
}

export function abvAlternate(og: number, fg: number): number {
  // Widely used high-gravity correction (Hall/Daniels form).
  return ((76.08 * (og - fg)) / (1.775 - og)) * (fg / 0.794);
}

/** Potential alcohol if a must ferments completely dry, from Brix. */
export function potentialAbvFromBrix(brix: number): number {
  return abvSimple(sgFromBrix(brix), 0.996);
}

/** Final gravity from an attenuation figure. */
export function fgFromAttenuation(og: number, apparentAttenuationPct: number): number {
  return 1 + (og - 1) * (1 - apparentAttenuationPct / 100);
}

/**
 * The gravity a fermentation will stop at when the yeast hits its alcohol
 * ceiling before the sugar runs out — the usual outcome for a sweet mead or a
 * high-Brix wine, and the number people are actually asking for when they ask
 * "will this finish dry?".
 */
export function stallGravity(og: number, alcoholTolerancePct: number): number {
  const fgIfDry = 0.996;
  const abvIfDry = abvSimple(og, fgIfDry);
  if (abvIfDry <= alcoholTolerancePct) return fgIfDry;
  return og - alcoholTolerancePct / 131.25;
}

// ---------------------------------------------------------------------------
// Chaptalisation and dilution
// ---------------------------------------------------------------------------

export interface SugarAddition {
  sugarG: number;
  /** Sugar dissolves and takes up space; roughly 0.625 mL per gram of sucrose. */
  volumeIncreaseL: number;
  finalVolumeL: number;
  achievedSg: number;
}

/**
 * Sugar needed to raise a must from its current gravity to a target. Accounts
 * for the volume the dissolved sugar itself adds, which is why this is not
 * simply (target - current) x volume.
 */
export function chaptalise(currentSg: number, targetSg: number, volumeL: number): SugarAddition {
  const VOL_PER_G = 0.000625; // litres per gram of dissolved sucrose
  // Solve: (currentSugar + x) / (V + 0.000625x) = target sugar concentration.
  const currentSugarG = ((currentSg - 1) * 1000 / POINTS_PER_G_PER_L) * volumeL;
  const targetConc = (targetSg - 1) * 1000 / POINTS_PER_G_PER_L; // g/L
  const sugarG = (targetConc * volumeL - currentSugarG) / (1 - targetConc * VOL_PER_G);
  const volumeIncreaseL = Math.max(0, sugarG) * VOL_PER_G;
  const finalVolumeL = volumeL + volumeIncreaseL;
  return {
    sugarG: Math.max(0, sugarG),
    volumeIncreaseL,
    finalVolumeL,
    achievedSg: sgFromSugar(currentSugarG + Math.max(0, sugarG), finalVolumeL),
  };
}

/** Water needed to dilute a must down to a target gravity. */
export function dilutionWaterL(currentSg: number, targetSg: number, volumeL: number): number {
  if (targetSg >= currentSg) return 0;
  return volumeL * ((currentSg - 1) / (targetSg - 1) - 1);
}

// ---------------------------------------------------------------------------
// Acid
// ---------------------------------------------------------------------------

export type AcidType = "tartaric" | "malic" | "citric" | "lactic";

/**
 * Titratable acidity is reported against a reference acid, and the reference
 * differs by region and by drink: tartaric for wine in most of the world,
 * sulphuric in parts of France, malic for cider, lactic for beer. Converting
 * is a matter of equivalent weight.
 */
const EQUIV_WEIGHT: Record<AcidType | "sulfuric", number> = {
  tartaric: 75.0,
  malic: 67.0,
  citric: 64.0,
  lactic: 90.1,
  sulfuric: 49.0,
};

export function convertTa(value: number, from: AcidType | "sulfuric", to: AcidType | "sulfuric"): number {
  return (value / EQUIV_WEIGHT[from]) * EQUIV_WEIGHT[to];
}

export interface AcidAdjustment {
  direction: "add" | "reduce" | "none";
  gramsPerLitre: number;
  totalGrams: number;
  agent: string;
  note: string;
}

/**
 * Acid correction. To a first approximation 1 g/L of a monoprotic addition
 * moves titratable acidity by 1 g/L, and 1 g/L of potassium bicarbonate or
 * calcium carbonate removes about the same. That approximation is the industry
 * working rule; the caveats are real and returned in `note`.
 */
export function adjustAcid(currentTaGPerL: number, targetTaGPerL: number, volumeL: number, agentForAdd: AcidType = "tartaric"): AcidAdjustment {
  const delta = targetTaGPerL - currentTaGPerL;
  if (Math.abs(delta) < 0.1) {
    return { direction: "none", gramsPerLitre: 0, totalGrams: 0, agent: "-", note: "Already within 0.1 g/L of target." };
  }
  if (delta > 0) {
    return {
      direction: "add",
      gramsPerLitre: delta,
      totalGrams: delta * volumeL,
      agent: `${agentForAdd} acid`,
      note: "Add before fermentation where possible. Some tartaric will precipitate as bitartrate during cold stabilisation, so the finished TA will read lower than this.",
    };
  }
  const drop = -delta;
  return {
    direction: "reduce",
    gramsPerLitre: drop,
    totalGrams: drop * volumeL,
    agent: "potassium bicarbonate",
    note:
      drop > 3
        ? "Over 3 g/L of bicarbonate makes a wine taste salty and flat, and the pH rise brings real spoilage risk. Blend or dilute instead of deacidifying this far."
        : "Add after fermentation, then cold stabilise so the tartrate actually drops out. Deacidification acts on tartaric acid, not malic.",
  };
}

// ---------------------------------------------------------------------------
// Sulphur dioxide
// ---------------------------------------------------------------------------

/**
 * Molecular SO2 is the fraction that is actually antimicrobial, and it is set
 * by pH, not by how much you added:
 *
 *   molecular = free / (1 + 10^(pH - 1.81))
 *
 * where 1.81 is the first pKa of sulphurous acid. At pH 3.0 about 6% of free
 * SO2 is molecular; at pH 3.8, well under 1%. This is why a high-pH wine needs
 * several times the free SO2 of a low-pH one for the same protection.
 */
export function molecularSo2(freeSo2MgPerL: number, ph: number): number {
  return freeSo2MgPerL / (1 + 10 ** (ph - 1.81));
}

export function freeSo2Needed(targetMolecularMgPerL: number, ph: number): number {
  return targetMolecularMgPerL * (1 + 10 ** (ph - 1.81));
}

/** Potassium metabisulfite is 57.6% SO2 by weight; the sodium salt is 67.4%. */
export const KMS_SO2_FRACTION = 0.576;
export const SMS_SO2_FRACTION = 0.674;

export interface So2Plan {
  targetMolecular: number;
  requiredFreeSo2MgPerL: number;
  additionMgPerL: number;
  kmsGrams: number;
  campdenTabletsPerGallonEquivalent: number;
  warning: string | null;
}

export function planSo2(
  ph: number,
  volumeL: number,
  currentFreeSo2MgPerL = 0,
  targetMolecular = 0.8
): So2Plan {
  const requiredFree = freeSo2Needed(targetMolecular, ph);
  const addition = Math.max(0, requiredFree - currentFreeSo2MgPerL);
  const kmsGrams = (addition * volumeL) / 1000 / KMS_SO2_FRACTION;
  return {
    targetMolecular,
    requiredFreeSo2MgPerL: requiredFree,
    additionMgPerL: addition,
    kmsGrams,
    // A common 0.44 g tablet delivers roughly 65 mg/L in one US gallon.
    campdenTabletsPerGallonEquivalent: (addition / 65) * (volumeL / 3.78541),
    warning:
      requiredFree > 100
        ? `At pH ${ph.toFixed(2)} you would need ${Math.round(requiredFree)} mg/L free SO2 for ${targetMolecular} mg/L molecular. That is approaching legal total-SO2 limits and will be tasted. Lower the pH with tartaric acid instead — it is the cheaper fix.`
        : null,
  };
}

// ---------------------------------------------------------------------------
// Nitrogen and nutrients
// ---------------------------------------------------------------------------

export type NitrogenDemand = "low" | "medium" | "high";

/**
 * Yeast assimilable nitrogen requirement scales with sugar: the working rule
 * across the wine industry is roughly 10 mg/L of YAN per degree Brix for a
 * medium-demand strain, adjusted for the strain's own appetite. Honey is the
 * pathological case — it is almost nitrogen-free, which is why mead has its
 * own nutrient protocols.
 */
export function yanTarget(brix: number, demand: NitrogenDemand = "medium"): number {
  const factor = demand === "low" ? 8 : demand === "high" ? 12.5 : 10;
  return brix * factor;
}

export interface NutrientPlan {
  targetYan: number;
  deficitYan: number;
  dapGrams: number | null;
  fermaidKGrams: number | null;
  fermaidOGrams: number | null;
  schedule: { when: string; note: string }[];
  note: string;
}

/**
 * DAP is 21.2% nitrogen by weight, so 1 g/L contributes about 212 mg/L YAN.
 * Fermaid K contributes roughly 100 mg/L per g/L. Fermaid O measures around
 * 40 mg/L per g/L by standard assay but supports fermentation as though it
 * delivered several times that, because the nitrogen arrives as amino acids —
 * so its figure is deliberately reported as measured, with the caveat stated.
 */
export function planNutrients(
  brix: number,
  volumeL: number,
  existingYanMgPerL = 0,
  demand: NitrogenDemand = "medium"
): NutrientPlan {
  const target = yanTarget(brix, demand);
  const deficit = Math.max(0, target - existingYanMgPerL);
  return {
    targetYan: target,
    deficitYan: deficit,
    dapGrams: deficit > 0 ? (deficit / 212) * volumeL : null,
    fermaidKGrams: deficit > 0 ? (deficit / 100) * volumeL : null,
    fermaidOGrams: deficit > 0 ? (deficit / 40) * volumeL : null,
    schedule: [
      { when: "At pitch", note: "Rehydration nutrient (Go-Ferm) in the rehydration water only — never in the must." },
      { when: "24 h", note: "First nitrogen addition." },
      { when: "48 h", note: "Second addition." },
      { when: "72 h", note: "Third addition." },
      { when: "1/3 sugar break", note: "Final addition. Past this point yeast lose their nitrogen transporters and later doses are largely wasted." },
    ],
    note:
      "Split the total across the schedule rather than dosing it all at pitch: staggered additions match supply to demand, avoid an ammonia spike, and reduce hydrogen sulphide. The Fermaid O figure is its measured YAN — in practice it performs well above that, which is why the TOSNA protocol's own dose rate is lower than this arithmetic implies.",
  };
}

/**
 * TOSNA — Tailored Organic Staggered Nutrient Additions, the Fermaid-O-only
 * mead protocol. The published rate is about 1 g/L of must in total for a
 * standard-gravity mead, divided into four equal doses at 24 h, 48 h, 72 h and
 * the one-third sugar break, scaled with gravity.
 */
export function tosna(volumeL: number, og: number): { totalGrams: number; perDoseGrams: number; doses: string[] } {
  const gravityScale = Math.max(0.5, (og - 1) / 0.100);
  const totalGrams = 1.0 * volumeL * gravityScale;
  return {
    totalGrams,
    perDoseGrams: totalGrams / 4,
    doses: ["24 hours after pitch", "48 hours", "72 hours", "at the 1/3 sugar break"],
  };
}

// ---------------------------------------------------------------------------
// Backsweetening and blending
// ---------------------------------------------------------------------------

export interface BacksweetenPlan {
  sugarG: number;
  finalSg: number;
  sorbateGrams: number;
  freeSo2Needed: number;
  warning: string;
}

export function planBacksweetening(currentSg: number, targetSg: number, volumeL: number, ph: number): BacksweetenPlan {
  const add = chaptalise(currentSg, targetSg, volumeL);
  return {
    sugarG: add.sugarG,
    finalSg: add.achievedSg,
    // Potassium sorbate at 0.2 g/L is a typical homebrew rate; the US legal
    // ceiling is 300 mg/L.
    sorbateGrams: 0.2 * volumeL,
    freeSo2Needed: freeSo2Needed(0.8, ph),
    warning:
      "Sorbate does not kill yeast and will not stop an active fermentation — it only prevents a finished, racked-clear wine from restarting. It must be paired with adequate free SO2: without it, lactic bacteria convert sorbate into a compound that smells overwhelmingly of crushed geranium leaves, and that fault cannot be removed. Never sorbate a wine intended for malolactic conversion.",
  };
}

/** Pearson square: blend two components to hit a target value. */
export function pearsonSquare(
  aValue: number,
  bValue: number,
  target: number
): { aParts: number; bParts: number; aPct: number; bPct: number } | null {
  if (aValue === bValue) return null;
  const lo = Math.min(aValue, bValue);
  const hi = Math.max(aValue, bValue);
  if (target < lo || target > hi) return null;
  const aParts = Math.abs(target - bValue);
  const bParts = Math.abs(aValue - target);
  const total = aParts + bParts;
  return { aParts, bParts, aPct: (aParts / total) * 100, bPct: (bParts / total) * 100 };
}

// ---------------------------------------------------------------------------
// Distilling
// ---------------------------------------------------------------------------

export interface WashYield {
  washAbv: number;
  absoluteAlcoholL: number;
  /** Realistic collected volume at a given collection strength. */
  expectedCollectionL: number;
  foreshotsML: number;
  heartsEstimateL: number;
  note: string;
}

/**
 * What a wash will actually give. Absolute alcohol is just volume x ABV; the
 * rest is about how much of it you can safely keep.
 *
 * Foreshots are the first fraction off the still and carry acetone, acetate
 * esters and what methanol the wash contains. They are discarded, always. The
 * customary discard is about 50 mL per 20 L of wash for a grain or sugar wash;
 * a pectin-rich fruit wash produces considerably more methanol and calls for a
 * more generous cut.
 */
export function washYield(
  washVolumeL: number,
  washAbvPct: number,
  opts: { stillEfficiencyPct?: number; collectionAbvPct?: number; pectinRich?: boolean } = {}
): WashYield {
  const efficiency = (opts.stillEfficiencyPct ?? 85) / 100;
  const collectionAbv = opts.collectionAbvPct ?? 60;
  const absoluteAlcoholL = washVolumeL * (washAbvPct / 100);
  const recovered = absoluteAlcoholL * efficiency;
  const foreshotsML = (washVolumeL / 20) * (opts.pectinRich ? 100 : 50);
  return {
    washAbv: washAbvPct,
    absoluteAlcoholL,
    expectedCollectionL: recovered / (collectionAbv / 100),
    foreshotsML,
    heartsEstimateL: (recovered * 0.6) / (collectionAbv / 100),
    note: opts.pectinRich
      ? "Pectin-rich fruit — stone fruit, pome fruit, quince — yields more methanol than a grain or sugar wash, because pectin methylesterase liberates methanol from pectin during fermentation. Treat the fruit with pectic enzyme before fermentation and discard a generous foreshots cut. Methanol poisoning causes permanent blindness and death, and it cannot be tasted."
      : "Discard the foreshots without exception. Make cuts by taste and smell across many small collection jars, not by thermometer — the vapour temperature does not tell you where the heads end.",
  };
}

/** US proof is twice ABV. UK proof spirit, historically, was 57.15% ABV. */
export const abvToUsProof = (abv: number) => abv * 2;
export const usProofToAbv = (proof: number) => proof / 2;

export interface ProofingPlan {
  waterToAddL: number;
  finalVolumeL: number;
  note: string;
}

/**
 * Diluting a spirit to bottling strength. The simple V1C1 = V2C2 relation is
 * what everyone uses, but ethanol and water contract on mixing — up to about
 * 3.5% volume loss near 50% ABV — so the true answer is a mass calculation
 * against the TTB gauging tables. For homebrew purposes the simple form is
 * close enough; the note says why it is not exact.
 */
export function proofDown(currentAbv: number, currentVolumeL: number, targetAbv: number): ProofingPlan {
  if (targetAbv >= currentAbv) {
    return { waterToAddL: 0, finalVolumeL: currentVolumeL, note: "Target strength is not below the current strength." };
  }
  const finalVolumeL = (currentVolumeL * currentAbv) / targetAbv;
  return {
    waterToAddL: finalVolumeL - currentVolumeL,
    finalVolumeL,
    note: "Ethanol and water contract when mixed — the finished volume will come out slightly under this figure, by up to about 3.5% near 50% ABV. Add most of the water, then measure with a hydrometer at 20 °C and creep up on the target. Use distilled or de-ionised water: tap water will throw a haze from calcium and magnesium.",
  };
}

/** Angel's share: evaporative loss during barrel maturation. */
export function angelsShare(years: number, annualLossPct: number, startingVolumeL: number): number {
  return startingVolumeL * (1 - annualLossPct / 100) ** years;
}

// ---------------------------------------------------------------------------
// Unit helpers
// ---------------------------------------------------------------------------

export const LB_TO_KG = 0.45359237;
export const GAL_TO_L = 3.785411784;
export const OZ_TO_G = 28.349523125;
export const lbToG = (lb: number) => lb * 453.59237;
export const gToLb = (g: number) => g / 453.59237;
export const galToL = (gal: number) => gal * GAL_TO_L;
export const lToGal = (l: number) => l / GAL_TO_L;
