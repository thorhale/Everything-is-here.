// Draft-line balancing: how long the beverage line has to be so that a keg at
// serving pressure pours calm at the faucet.
//
// An unbalanced line is the classic kegerator fault. Too little line resistance
// and the beer arrives with pressure still to shed — it sheds it in the glass,
// as foam. Too much and the pour slows to a dribble. The line's job is to use
// up the dispensing pressure on the way to the faucet, at the industry's target
// flow of roughly 1 gal/min (2 fl oz/sec).
//
// EVERY NUMBER HERE IS FROM A NAMED DOCUMENT, both retrieved and read in full:
//
// [DBQM]  Brewers Association, "Draught Beer Quality Manual", 4th ed. (2019).
//         cdn.brewersassociation.org/wp-content/uploads/2019/03/13094643/
//         Draught-Beer-Quality-Manual-2019.pdf
//         - Table 4.1: dynamic resistance (lb/ft) and internal volume
//           (fl oz/ft) by tubing type and diameter, with the manual's own
//           caveat: "Restriction values may vary, depending on manufacturer."
//         - Static resistance: 0.5 lb per foot of rise, measured from the
//           MIDDLE of the keg to the faucet ("a full keg will contain about
//           2½ ft. of beer, we recommend measuring from the middle"), and
//           NEGATIVE when the faucet sits below the keg — its own worked
//           example runs 10 ft of drop as −5 lb.
//         - The balance identity its Appendix C examples use, exactly:
//           dynamic resistance = dispensing pressure − static resistance.
//           There is no separate "residual at the faucet" term.
//         - Table 3.3: a worked kegerator table at 38 °F (vols → psig →
//           3/16" vinyl length) — reproduced by the tests in
//           draft-line.test.ts.
// [DHL]   R. O'Leary (BevSense LLC), "Method of Analysis for correcting
//         dissolved CO2 content for Specific Gravity and Alcohol variations
//         in beer — Creating a Dynamic Henry's Law Equation" (2008, rev.
//         2019). beveragesensors.com/wp-content/uploads/
//         bevsense-methods-of-analysis-for-correcting-co2-content.pdf
//         - The carbonation relation with alcohol, gravity and barometric
//           pressure as variables (its Equation 3.0/4.0):
//             V = 5.16 (Pgauge + Pbaro) / [(°F + 12.4) · SG · (1 + ABW/0.789)]
//         - It reduces EXACTLY to the classic single-constant form
//           V = 4.85 (psig + 14.7)/(°F + 12.4) (Holle, "A Handbook of Basic
//           Brewing Calculations", MBAA) at the 1949 ASBC chart calibration:
//           5.16 / (1.015 × (1 + 0.038/0.789)) = 4.850. The DBQM states that
//           calibration verbatim: "Values assume sea-level altitude, beer
//           specific gravity of 1.015, and beer alcohol content at 3.8% ABW
//           or 4.8% ABV."
//         - The ASBC altitude convention it quotes: about 1 psi per 2,000 ft
//           above sea level.
//
// THE ABV ADJUSTMENT, honestly stated. The user-facing question is "does my
// 10% beverage need different treatment than a 5% beer?", and the industry's
// own manual REFUSES to give a number: the DBQM says CO2 is more soluble in
// ethanol, that dissolved solids push the other way, and that the net "is hard
// to calculate ... due to the opposing effects". The Dynamic Henry's Law model
// above is the citable quantification: it treats the beverage's makeup through
// SG and ABW, reduces exactly to the standard chart at the standard beer, and
// its direction (higher ABV at a given gravity → slightly more pressure for
// the same volumes → a slightly longer line) agrees with measured solubility
// in real high-alcohol beverages (champagne's Henry coefficient is well below
// water's at the same temperature). The correction is small — a 10% ABV dry
// beverage runs ~3–4% more absolute pressure than the standard beer — and the
// UI presents it as the model's figure with the DBQM's caveat alongside, not
// as settled physics.

// --- Table 4.1: beer line materials and their resistance --------------------

export type Tubing = "vinyl" | "barrier" | "stainless";

export interface LineSpec {
  tubing: Tubing;
  /** Nominal diameter as printed, e.g. "3/16\"". */
  size: string;
  /** ID for vinyl and barrier; stainless is specified by OD in the manual. */
  bore: "ID" | "OD";
  /** Dynamic resistance, lb (psi) per foot, at the standard ~1 gal/min flow. */
  resistancePsiPerFt: number;
  /** Internal volume, fl oz per foot — what the line itself holds. */
  volumeFlOzPerFt: number;
}

/** DBQM Table 4.1, transcribed row for row (geometry-extracted from the PDF). */
export const BEER_LINES: LineSpec[] = [
  { tubing: "vinyl", size: '3/16"', bore: "ID", resistancePsiPerFt: 3.0, volumeFlOzPerFt: 1 / 6 },
  { tubing: "vinyl", size: '1/4"', bore: "ID", resistancePsiPerFt: 0.85, volumeFlOzPerFt: 1 / 3 },
  { tubing: "vinyl", size: '5/16"', bore: "ID", resistancePsiPerFt: 0.4, volumeFlOzPerFt: 1 / 2 },
  { tubing: "vinyl", size: '3/8"', bore: "ID", resistancePsiPerFt: 0.2, volumeFlOzPerFt: 3 / 4 },
  { tubing: "vinyl", size: '1/2"', bore: "ID", resistancePsiPerFt: 0.025, volumeFlOzPerFt: 4 / 3 },
  { tubing: "barrier", size: '1/4"', bore: "ID", resistancePsiPerFt: 0.3, volumeFlOzPerFt: 1 / 3 },
  { tubing: "barrier", size: '5/16"', bore: "ID", resistancePsiPerFt: 0.1, volumeFlOzPerFt: 1 / 2 },
  { tubing: "barrier", size: '3/8"', bore: "ID", resistancePsiPerFt: 0.06, volumeFlOzPerFt: 3 / 4 },
  { tubing: "stainless", size: '1/4"', bore: "OD", resistancePsiPerFt: 1.2, volumeFlOzPerFt: 1 / 6 },
  { tubing: "stainless", size: '5/16"', bore: "OD", resistancePsiPerFt: 0.3, volumeFlOzPerFt: 1 / 3 },
  { tubing: "stainless", size: '3/8"', bore: "OD", resistancePsiPerFt: 0.12, volumeFlOzPerFt: 1 / 2 },
];

export function findLine(tubing: Tubing, size: string): LineSpec | undefined {
  return BEER_LINES.find((l) => l.tubing === tubing && l.size === size);
}

// --- The manual's fixed conventions ----------------------------------------

/** Static resistance per foot the faucet sits ABOVE the middle of the keg. */
export const STATIC_PSI_PER_FT_RISE = 0.5;

/** The industry target pour: 1 gal/min, i.e. 2 fl oz per second. */
export const TARGET_FLOW_GAL_PER_MIN = 1;

/** The 1949 ASBC chart's stated calibration — the "standard beer". */
export const STANDARD_BEER = { abwFraction: 0.038, abvPct: 4.8, sg: 1.015 };

/** Sea-level barometric pressure, psia. */
export const SEA_LEVEL_PSIA = 14.7;

/** ~1 psi per 2,000 ft of elevation — the ASBC convention as quoted in [DHL]. */
export function baroPsiaAtElevation(elevationFt: number): number {
  return SEA_LEVEL_PSIA - Math.max(0, elevationFt) / 2000;
}

/**
 * ABV (v/v %) to ABW mass fraction. Ethanol is 0.789 g/mL — the same density
 * constant the Dynamic Henry's Law model uses — so per litre of beverage,
 * mass of ethanol = ABV% × 7.89 g and mass of beverage = SG × 1000 g.
 */
export function abwFractionFromAbv(abvPct: number, sg: number): number {
  if (!(sg > 0)) return 0;
  return (abvPct / 100) * (0.789 / sg);
}

// --- Carbonation pressure ---------------------------------------------------

export interface BeverageSpec {
  /** Target carbonation, volumes of CO2. */
  vols: number;
  /** Serving temperature, °F. */
  tempF: number;
  /** Alcohol by volume, %. Defaults to the standard beer's 4.8. */
  abvPct?: number;
  /** Finished specific gravity. Defaults to the standard beer's 1.015. */
  sg?: number;
  /** Elevation above sea level, ft. Defaults to 0. */
  elevationFt?: number;
}

/**
 * Gauge pressure (psig) holding `vols` at `tempF` — the Dynamic Henry's Law
 * relation inverted for pressure:
 *
 *   Pgauge = vols × (°F + 12.4) × SG × (1 + ABW/0.789) / 5.16 − Pbaro
 *
 * At the standard beer this IS the classic chart: the tests reproduce the
 * DBQM's own kegerator table from it to within a tenth of a psi.
 */
export function dispensePsig(b: BeverageSpec): number {
  const sg = b.sg ?? STANDARD_BEER.sg;
  const abw = abwFractionFromAbv(b.abvPct ?? STANDARD_BEER.abvPct, sg);
  const baro = baroPsiaAtElevation(b.elevationFt ?? 0);
  return (b.vols * (b.tempF + 12.4) * sg * (1 + abw / 0.789)) / 5.16 - baro;
}

// --- The balance ------------------------------------------------------------

export interface BalanceInput extends BeverageSpec {
  tubing: Tubing;
  size: string;
  /** Faucet height above the MIDDLE of the keg, ft. Negative for a drop. */
  riseFt: number;
}

export interface BalanceResult {
  /** Regulator setting: gauge pressure holding the target carbonation. */
  psig: number;
  /** Same figure for the standard 4.8% / 1.015 beer, so the ABV delta shows. */
  standardBeerPsig: number;
  /** Gravity's share: rise × 0.5, negative on a drop. */
  staticPsi: number;
  /** What the line itself must dissipate: psig − static. */
  dynamicPsi: number;
  lengthFt: number;
  lengthM: number;
  /** What that much line holds — the first pour stands in it, warming. */
  lineVolumeFlOz: number;
  line: LineSpec;
  warnings: string[];
  notes: string[];
}

const FT_TO_M = 0.3048;

export function balanceLine(input: BalanceInput): BalanceResult | { error: string } {
  const line = findLine(input.tubing, input.size);
  if (!line) return { error: `No Table 4.1 entry for ${input.tubing} ${input.size}` };
  if (!(input.vols > 0)) return { error: "Carbonation must be above zero volumes." };

  const psig = dispensePsig(input);
  const standardBeerPsig = dispensePsig({ ...input, abvPct: undefined, sg: undefined });
  const staticPsi = input.riseFt * STATIC_PSI_PER_FT_RISE;
  // The manual's own identity, used verbatim in its Appendix C examples:
  // dynamic resistance = dispensing gas pressure − static resistance.
  const dynamicPsi = psig - staticPsi;
  const lengthFt = dynamicPsi / line.resistancePsiPerFt;

  const warnings: string[] = [];
  const notes: string[] = [];

  if (psig <= 0) {
    warnings.push(
      `At ${input.tempF.toFixed(0)} °F the target of ${input.vols} volumes needs no applied ` +
        `pressure at all (${psig.toFixed(1)} psig) — the beverage would shed gas rather than hold it. ` +
        `Serve colder or accept higher carbonation.`
    );
  }
  if (dynamicPsi <= 0 && psig > 0) {
    warnings.push(
      `The ${input.riseFt.toFixed(1)} ft of lift consumes the entire ${psig.toFixed(1)} psig ` +
        `by itself (${staticPsi.toFixed(1)} psi of static resistance). No line length can balance ` +
        `this — lower the faucet relative to the keg, or raise the serving pressure by chilling colder.`
    );
  }
  if (lengthFt > 0 && lengthFt < 3) {
    warnings.push(
      `${lengthFt.toFixed(1)} ft is too little line to pour well — short lines gush. Use a ` +
        `higher-resistance line (3/16" vinyl is the usual choker) or a flow-control faucet, which ` +
        `is the manual's own remedy for highly carbonated beverages.`
    );
  }
  if (lengthFt > 50) {
    warnings.push(
      `${lengthFt.toFixed(0)} ft of ${input.tubing} ${line.size} is not a practical balance — the ` +
        `line barely resists, so it would take that whole run to spend the pressure. Use a ` +
        `higher-resistance line (3/16" or 1/4" vinyl for a kegerator), or split the run into ` +
        `low-resistance barrier tubing plus a short 3/16" choker, which is how long-draw systems do it.`
    );
  } else if (lengthFt > 25 && input.tubing === "vinyl") {
    notes.push(
      `${lengthFt.toFixed(0)} ft of vinyl is a long run — long-draw systems switch to barrier ` +
        `tubing for the distance and add a short 3/16" vinyl choker at the tower to make up the ` +
        `resistance (DBQM ch. 4).`
    );
  }
  const abv = input.abvPct ?? STANDARD_BEER.abvPct;
  if (Math.abs(psig - standardBeerPsig) >= 0.05) {
    notes.push(
      `The alcohol/gravity correction moves the pressure ${psig > standardBeerPsig ? "up" : "down"} ` +
        `${Math.abs(psig - standardBeerPsig).toFixed(1)} psi from the standard-beer chart (which is ` +
        `calibrated for 4.8% ABV at SG 1.015). This is the BevSense Dynamic Henry's Law figure; the ` +
        `Draught Beer Quality Manual itself declines to quantify the net alcohol effect — it notes ` +
        `ethanol raises CO2 solubility while dissolved solids lower it — so treat the correction as ` +
        `the best available model, not settled physics.`
    );
  } else if (abv >= 8) {
    notes.push(
      `At ${abv}% ABV with this gravity, the model's correction happens to cancel to nearly ` +
        `nothing — the ethanol and density terms offset, which is exactly the opposing-effects ` +
        `situation the Draught Beer Quality Manual describes.`
    );
  }
  notes.push(
    `Balanced for the industry target pour of ~1 gal/min (2 fl oz/sec). The line itself holds ` +
      `${(lengthFt * line.volumeFlOzPerFt).toFixed(1)} fl oz — the first pour after a quiet spell ` +
      `has been sitting in it.`
  );

  return {
    psig,
    standardBeerPsig,
    staticPsi,
    dynamicPsi,
    lengthFt: Math.max(0, lengthFt),
    lengthM: Math.max(0, lengthFt) * FT_TO_M,
    lineVolumeFlOz: Math.max(0, lengthFt) * line.volumeFlOzPerFt,
    line,
    warnings,
    notes,
  };
}
