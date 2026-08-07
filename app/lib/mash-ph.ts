// Mash pH guidance.
//
// Honesty note: predicting exact mash pH requires per-malt titratable-acidity
// data that most maltsters don't publish, so anyone claiming three-decimal
// precision from grist colour alone is overselling. What IS robust and public
// is John Palmer's relationship between beer COLOUR and the residual
// alkalinity (RA) that lands mash pH in the good range (~5.2–5.5 room temp):
// pale beers want near-zero or negative RA, dark beers want high RA — which is
// exactly why soft-water cities brewed pale and alkaline-water cities brewed
// dark. This module leads with that RA-target guidance (solid) and offers an
// estimated pH clearly marked as an approximation to confirm with a meter.

// Residual alkalinity (Kolbach), ppm as CaCO3, from the three relevant ions.
export function residualAlkalinity(caPpm: number, mgPpm: number, hco3Ppm: number): number {
  const alkalinity = hco3Ppm * (50 / 61); // HCO3 ppm -> ppm as CaCO3
  return Math.round(alkalinity - (caPpm / 1.4 + mgPpm / 1.7));
}

// Approximate the Palmer "Water" nomograph: the target residual alkalinity
// (ppm as CaCO3) that suits a grist of the given beer colour (SRM). Linear
// approximation of the published curve — pale ales want slightly negative RA,
// stouts want ~150+.
export function targetResidualAlkalinity(beerSrm: number): number {
  return Math.round(beerSrm * 4.8 - 34);
}

// A rough estimated mash pH. Buffering is approximated at ~400 ppm RA per pH
// unit around a balanced target of 5.4. Treat as ±0.1–0.2 and confirm with a
// calibrated meter — this is a sanity check, not a substitute for measuring.
export function estimateMashPh(beerSrm: number, waterRa: number): number {
  const target = targetResidualAlkalinity(beerSrm);
  return Math.round((5.4 + (waterRa - target) / 400) * 100) / 100;
}

// --- Acid corrections -----------------------------------------------------
//
// Acid demand is an EQUIVALENTS problem, not a pH-drop problem. Alkalinity is
// reported in ppm as CaCO3, and one milliequivalent of any monoprotic acid
// neutralises 50.04 mg of it. So the dose follows from three things: how much
// alkalinity has to go, how much water it is in, and how many milliequivalents
// per millilitre the bottle on the shelf actually delivers.
//
// The previous version of this file did none of that. It derived a dose from
// the estimated pH drop alone (`phDrop / 0.1`), which ignores alkalinity and
// volume entirely and — because the pH estimate itself is gap/400 — collapsed
// to gap/40 mL per gallon. That is uniformly about 3.9x more acid than the
// water needs, at every gap size. Over-acidified mash runs thin and tart and
// converts badly, so this was worth getting right.

const MG_CACO3_PER_MEQ = 50.04;
const LITERS_PER_GALLON = 3.785411784;

export interface MashAcid {
  key: string;
  label: string;
  /**
   * Milliequivalents of titratable acid per millilitre of the product as sold.
   * = density (g/mL) x mass fraction / equivalent weight (g/mol) x 1000.
   */
  mEqPerMl: number;
  note?: string;
}

// Phosphoric acid is triprotic, but only its first proton (pKa1 2.15) is spent
// by the time a mash reaches pH 5.4 — the second (pKa2 7.20) is still bound. It
// is therefore treated as monoprotic here, which is what every brewing water
// reference does and what makes these figures comparable to lactic.
export const MASH_ACIDS: MashAcid[] = [
  {
    key: "lactic88",
    label: "88% lactic acid",
    mEqPerMl: (1.209 * 0.88) / 90.08 * 1000, // 11.81
    note: "The homebrew standard. Above roughly 400 ppm of the finished beer it is tasteable as a soft tartness.",
  },
  {
    key: "phosphoric85",
    label: "85% phosphoric acid",
    mEqPerMl: (1.685 * 0.85) / 97.99 * 1000, // 14.62
    note: "Flavour-neutral, and strong — a small overshoot is a large error. Handle with care.",
  },
  {
    key: "phosphoric10",
    label: "10% phosphoric acid",
    mEqPerMl: (1.05 * 0.1) / 97.99 * 1000, // 1.07
    note: "The dilute form sold for homebrewing. Roughly fourteen times weaker than 85%, so it doses in millilitres rather than drops.",
  },
];

// Acidulated (sauermalz) malt carries lactic acid produced on the grain itself.
// Weyermann publishes 2-4% lactic acid by weight; 3% is used here and stated so
// the arithmetic can be checked or re-run against a different maltster's figure.
export const ACID_MALT_LACTIC_FRACTION = 0.03;

export interface AcidDose {
  key: string;
  label: string;
  mlPerGallon: number;
  /** For the whole mash volume, when one is known. */
  mlTotal: number | null;
  note?: string;
}

/**
 * Millilitres of each acid needed to drop residual alkalinity by `gapPpm`
 * (ppm as CaCO3) in `volumeL` litres of water.
 *
 * This sizes the acid to the WATER. It brings residual alkalinity to the target
 * for the grist colour, which is the part that can be calculated honestly. The
 * malt's own buffering then sets the final mash pH, so a meter still decides.
 */
export function acidDoses(gapPpm: number, volumeL?: number | null): AcidDose[] {
  if (gapPpm <= 0) return [];
  const mEqPerLiter = gapPpm / MG_CACO3_PER_MEQ;
  return MASH_ACIDS.map((acid) => {
    const mlPerLiter = mEqPerLiter / acid.mEqPerMl;
    return {
      key: acid.key,
      label: acid.label,
      mlPerGallon: Math.round(mlPerLiter * LITERS_PER_GALLON * 100) / 100,
      mlTotal: volumeL && volumeL > 0 ? Math.round(mlPerLiter * volumeL * 10) / 10 : null,
      note: acid.note,
    };
  });
}

/**
 * Grams of acidulated malt that deliver the same acid as `gapPpm` across
 * `volumeL` litres, and what share of `gristKg` that is.
 *
 * Unlike the liquid acids this genuinely needs the grist weight: a percentage
 * of an unknown grist is not a dose. Returns null rather than guessing.
 */
export function acidMaltDose(
  gapPpm: number,
  volumeL?: number | null,
  gristKg?: number | null
): { grams: number; pctOfGrist: number | null } | null {
  if (gapPpm <= 0 || !volumeL || volumeL <= 0) return null;
  const mEq = (gapPpm * volumeL) / MG_CACO3_PER_MEQ;
  const lacticG = (mEq / 1000) * 90.08;
  const grams = lacticG / ACID_MALT_LACTIC_FRACTION;
  return {
    grams: Math.round(grams),
    pctOfGrist:
      gristKg && gristKg > 0 ? Math.round((grams / (gristKg * 1000)) * 1000) / 10 : null,
  };
}

export interface MashPhAdvice {
  targetRa: number;
  actualRa: number;
  gap: number; // actual - target; positive = too alkaline
  estimatedPh: number;
  verdict: "too alkaline" | "on target" | "too soft";
  /** Sized on equivalents; empty unless the water is too alkaline. */
  acids: AcidDose[];
  /** Null unless the water is too alkaline AND a mash volume was supplied. */
  acidMalt: { grams: number; pctOfGrist: number | null } | null;
  addAlkalinity: boolean; // true if the water is too soft for the grist
}

export interface MashPhOptions {
  /** Litres of mash water. Without it, only per-gallon acid doses are given. */
  mashWaterL?: number | null;
  /** Total grist weight in kg, needed to express acid malt as a percentage. */
  gristKg?: number | null;
}

export function mashPhAdvice(
  beerSrm: number,
  waterRa: number,
  opts: MashPhOptions = {}
): MashPhAdvice {
  const targetRa = targetResidualAlkalinity(beerSrm);
  const gap = Math.round(waterRa - targetRa);
  const estimatedPh = estimateMashPh(beerSrm, waterRa);

  let verdict: MashPhAdvice["verdict"] = "on target";
  if (gap > 40) verdict = "too alkaline";
  else if (gap < -40) verdict = "too soft";

  const tooAlkaline = verdict === "too alkaline";
  return {
    targetRa,
    actualRa: Math.round(waterRa),
    gap,
    estimatedPh,
    verdict,
    acids: tooAlkaline ? acidDoses(gap, opts.mashWaterL) : [],
    acidMalt: tooAlkaline ? acidMaltDose(gap, opts.mashWaterL, opts.gristKg) : null,
    addAlkalinity: verdict === "too soft",
  };
}
