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

export interface MashPhAdvice {
  targetRa: number;
  actualRa: number;
  gap: number; // actual - target; positive = too alkaline
  estimatedPh: number;
  verdict: "too alkaline" | "on target" | "too soft";
  // Correction rules of thumb (only one direction applies):
  acidMaltPct: number | null; // % of grist as acidulated malt to lower pH
  lacticMlPerGal: number | null; // mL of 88% lactic acid per gallon of mash water
  addAlkalinity: boolean; // true if the water is too soft for the grist
}

export function mashPhAdvice(beerSrm: number, waterRa: number): MashPhAdvice {
  const targetRa = targetResidualAlkalinity(beerSrm);
  const gap = Math.round(waterRa - targetRa);
  const estimatedPh = estimateMashPh(beerSrm, waterRa);

  let verdict: MashPhAdvice["verdict"] = "on target";
  if (gap > 40) verdict = "too alkaline";
  else if (gap < -40) verdict = "too soft";

  // Needed pH drop to reach ~5.4. Acidulated malt lowers mash pH by roughly
  // 0.1 per 1% of the grist (Weyermann's own guidance); ~1 mL of 88% lactic
  // acid per gallon of mash water is a comparable drop. Both are rules of
  // thumb — dial in against a meter.
  const phDrop = Math.max(0, estimatedPh - 5.4);
  const acidMaltPct = phDrop > 0.02 ? Math.round((phDrop / 0.1) * 10) / 10 : null;
  const lacticMlPerGal = phDrop > 0.02 ? Math.round((phDrop / 0.1) * 10) / 10 : null;

  return {
    targetRa,
    actualRa: Math.round(waterRa),
    gap,
    estimatedPh,
    verdict,
    acidMaltPct: verdict === "too alkaline" ? acidMaltPct : null,
    lacticMlPerGal: verdict === "too alkaline" ? lacticMlPerGal : null,
    addAlkalinity: verdict === "too soft",
  };
}
