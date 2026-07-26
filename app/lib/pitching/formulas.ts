// Yeast pitching-rate + starter-propagation model, in the spirit of Jamil
// Zainasheff's Mr Malty calculator (http://www.mrmalty.com/calc/calc.html).
//
// PROVENANCE: unlike lib/calculator/formulas.ts (a verbatim port of
// BrewToad's archived client-side JS), Mr Malty's pitching math is NOT
// public - the site runs it server-side ("Calculations run on the Mr Malty
// calculation API"). So this file is an INDEPENDENT reconstruction from the
// openly-published homebrewing literature the original is built on:
//   - C. White & J. Zainasheff, "Yeast: The Practical Guide to Beer
//     Fermentation" (2010) - target pitch rates, viable-cell assumptions.
//   - Maltose Falcons, "Yeast Propagation and Maintenance: Principles and
//     Practices" - per-method starter cell densities (the numbers that set
//     STARTER_MAX_DENSITY below) and dry/liquid viable-cell figures.
//   - K. Troester (Braukaiser) - the inoculation-density -> growth-rate fit
//     used as the curve a starter follows toward its density ceiling.
// See docs/pitching-formulas.md for derivation and validation. Treat outputs
// as close approximations, not bit-for-bit reproductions of Mr Malty.

// --- Unit constants -------------------------------------------------------

export const ML_PER_GALLON = 3785.411784;
export const ML_PER_LITER = 1000;

// --- Target pitch rates ---------------------------------------------------

// Million cells per mL per degree Plato. The canonical White/Zainasheff
// professional targets Mr Malty exposes as Ale / Hybrid / Lager. These are
// consistent with the Maltose Falcons ranges (ales ~6-10 M/mL, lagers
// ~10-15 M/mL at typical gravities).
export const PITCH_RATES = {
  ale: 0.75,
  hybrid: 1.0,
  lager: 1.5,
} as const;

export type PitchRateKey = keyof typeof PITCH_RATES;

// --- Gravity -> Plato -----------------------------------------------------

// Standard cubic fit (ASBC). Input is specific gravity (e.g. 1.048).
export function sgToPlato(sg: number): number {
  return -616.868 + 1111.14 * sg - 630.272 * sg * sg + 135.997 * sg * sg * sg;
}

// --- Cells required -------------------------------------------------------

export interface CellsNeededInput {
  volumeMl: number;
  og: number; // specific gravity
  pitchRate: number; // million cells / mL / degree Plato
}

// Result is in BILLION cells: (M cells/mL/P) * P * mL = M cells; /1000 -> B.
export function cellsNeeded({ volumeMl, og, pitchRate }: CellsNeededInput): number {
  if (volumeMl <= 0 || og <= 1) return 0;
  const plato = sgToPlato(og);
  return (pitchRate * plato * volumeMl) / 1000;
}

// --- Viability decay models -----------------------------------------------

// Each model maps an age in days to a surviving-viability fraction [0..1].
export type DecayModelKey = "classic" | "optimistic" | "whiteLabs" | "wyeast";

export const DECAY_MODEL_LABELS: Record<DecayModelKey, string> = {
  classic: "Classic (Mr Malty, ~0.7%/day)",
  optimistic: "Optimistic (slower early decay)",
  whiteLabs: "White Labs (linear, slower)",
  wyeast: "Wyeast (~20%/month)",
};

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

// Fresh, well-handled liquid yeast is assumed ~100% viable at packaging;
// callers start from 1.0 and let the model apply age.
export function viabilityAtAge(days: number, model: DecayModelKey): number {
  const d = Math.max(0, days);
  switch (model) {
    // Mr Malty "classic": roughly linear ~21% loss per month.
    case "classic":
      return clamp01(1 - 0.007 * d);
    // Gentler early decay that flattens toward a floor - matches the
    // "optimistic" curve for yeast that has been kept cold.
    case "optimistic":
      return clamp01(0.5 + 0.5 * Math.exp(-d / 90));
    // White Labs guidance is a slower linear decline (~15%/month).
    case "whiteLabs":
      return clamp01(1 - 0.005 * d);
    // Wyeast's own ~20%/month figure.
    case "wyeast":
      return clamp01(1 - (0.2 * d) / 30);
    default:
      return clamp01(1 - 0.007 * d);
  }
}

// --- Yeast sources --------------------------------------------------------

export type YeastSource = "liquid" | "dry" | "slurry";

// Fresh cell counts / densities from the literature.
export const CELLS_PER_LIQUID_PACK = 100; // billion, per fresh vial / Activator pack
// Maltose Falcons: 5 g dry yeast -> ~124 B at 80% viability ~= 20 B viable/g.
export const CELLS_PER_GRAM_DRY = 20; // billion viable cells per gram of dry yeast
// Billion cells per mL of fully-packed (100% solids) yeast slurry. Real
// slurries are diluted with beer/trub, handled via yeastFraction below.
export const PACKED_SLURRY_DENSITY = 3.5;

export interface LiquidSourceInput {
  source: "liquid";
  packs: number;
  ageDays: number;
  decayModel: DecayModelKey;
  cellsPerPack?: number; // override the 100B default (e.g. from a chosen strain)
}

export interface DrySourceInput {
  source: "dry";
  grams: number;
  ageDays: number;
  decayModel: DecayModelKey;
  cellsPerGram?: number; // override the 20B/g default
}

export interface SlurrySourceInput {
  source: "slurry";
  slurryMl: number;
  yeastFractionPct: number; // % of the slurry volume that is actually yeast
  ageDays: number;
  decayModel: DecayModelKey;
}

export type SourceInput = LiquidSourceInput | DrySourceInput | SlurrySourceInput;

// Billion viable cells available from the chosen source before any starter.
export function cellsFromSource(input: SourceInput): number {
  switch (input.source) {
    case "liquid": {
      const packs = Math.max(0, input.packs);
      const perPack = input.cellsPerPack && input.cellsPerPack > 0 ? input.cellsPerPack : CELLS_PER_LIQUID_PACK;
      return packs * perPack * viabilityAtAge(input.ageDays, input.decayModel);
    }
    case "dry": {
      // Dry yeast decays much more slowly; the age model is applied at a
      // heavily reduced rate (dry yeast keeps well for a year+).
      const grams = Math.max(0, input.grams);
      const perGram = input.cellsPerGram && input.cellsPerGram > 0 ? input.cellsPerGram : CELLS_PER_GRAM_DRY;
      const dryViability = clamp01(
        1 - (1 - viabilityAtAge(input.ageDays, input.decayModel)) * 0.15,
      );
      return grams * perGram * dryViability;
    }
    case "slurry": {
      const ml = Math.max(0, input.slurryMl);
      const fraction = clamp01(input.yeastFractionPct / 100);
      return (
        ml *
        PACKED_SLURRY_DENSITY *
        fraction *
        viabilityAtAge(input.ageDays, input.decayModel)
      );
    }
    default:
      return 0;
  }
}

// --- Starter growth model -------------------------------------------------

export type StarterType =
  | "none"
  | "simple"
  | "simpleO2"
  | "shaking"
  | "aeration"
  | "stirPlate";

export const STARTER_LABELS: Record<StarterType, string> = {
  none: "No starter",
  simple: "Simple (no agitation)",
  simpleO2: "Simple + O2 at start",
  shaking: "Intermittent shaking",
  aeration: "Continuous aeration",
  stirPlate: "Stir plate",
};

// Maximum achievable cell density per method, in BILLION cells per LITRE of
// starter. The shaking / aeration / stir-plate figures are taken directly
// from Maltose Falcons' measured 500 mL starters (60 / 92 / 180-360
// M/mL -> 60 / 92 / 200 B/L; the stir-plate value is kept at the
// conservative low end of the published 180-360 range). Airlocked and
// O2-at-start are set below shaking, consistent with the article's note
// that stirring gives a "10- to 15-fold" larger cell count than an
// airlocked starter. These densities are what distinguish the methods. The
// same figures are published as structured data in lib/propagation-guidance.ts
// (STARTER_METHODS), which the /yeasts/propagation page renders.
export const STARTER_MAX_DENSITY: Record<StarterType, number> = {
  none: 0,
  simple: 20,
  simpleO2: 35,
  shaking: 60,
  aeration: 92,
  stirPlate: 200,
};

// Braukaiser (Troester) inoculation-density fit. `r` is the inoculation
// density in BILLION cells per LITRE of starter; the result is "new cells
// grown per cell pitched" for an ideal well-aerated starter, floored at 0.
// This is the curve a starter follows; the per-method density ceiling above
// is what ultimately caps it.
export function inoculationGrowthRate(r: number): number {
  if (r <= 0) return 0;
  const g = 12.54793776 * Math.pow(r, -0.4594858324) - 0.9994994906;
  return g < 0 ? 0 : g;
}

export interface StarterInput {
  type: StarterType;
  volumeMl: number;
}

export interface StarterResult {
  pitchedCells: number; // billion cells going into the starter
  newCells: number; // billion cells grown
  totalCells: number; // billion cells at the end
  capacityCells: number; // billion cells this method+volume can support
  capped: boolean; // true if growth was limited by the density ceiling
}

// Given the viable cells available and a starter step, return the resulting
// cell count. Growth follows the inoculation-density curve but is capped at
// the method's carrying capacity (density ceiling x volume). A `type` of
// "none" (or zero volume) is a pass-through.
export function growInStarter(availableCells: number, starter: StarterInput): StarterResult {
  const pitched = Math.max(0, availableCells);
  const maxDensity = STARTER_MAX_DENSITY[starter.type];
  const volumeL = starter.volumeMl / ML_PER_LITER;

  if (maxDensity <= 0 || volumeL <= 0 || pitched <= 0) {
    return {
      pitchedCells: pitched,
      newCells: 0,
      totalCells: pitched,
      capacityCells: 0,
      capped: false,
    };
  }

  const density = pitched / volumeL; // billion cells / L pitched into the starter
  const grownPotential = pitched * (1 + inoculationGrowthRate(density));
  const capacity = maxDensity * volumeL;

  // Cannot exceed the density ceiling, and cannot end up below what we
  // pitched (an over-pitched small starter simply doesn't grow).
  const total = Math.max(pitched, Math.min(grownPotential, capacity));
  const capped = grownPotential > capacity && capacity > pitched;

  return {
    pitchedCells: pitched,
    newCells: total - pitched,
    totalCells: total,
    capacityCells: capacity,
    capped,
  };
}

// --- Top-level orchestration ----------------------------------------------

export interface PitchingInputs {
  volumeMl: number;
  og: number;
  pitchRate: number;
  source: SourceInput;
  starter: StarterInput;
}

export interface PitchingResult {
  cellsNeeded: number; // billion
  cellsFromSource: number; // billion, after viability, before starter
  starter: StarterResult;
  cellsAvailable: number; // billion, after starter
  ratio: number; // available / needed
  achievedPitchRate: number; // million cells / mL / degree Plato actually delivered
  sufficient: boolean;
}

export function computePitching(inputs: PitchingInputs): PitchingResult {
  const needed = cellsNeeded({
    volumeMl: inputs.volumeMl,
    og: inputs.og,
    pitchRate: inputs.pitchRate,
  });
  const fromSource = cellsFromSource(inputs.source);
  const starter = growInStarter(fromSource, inputs.starter);
  const available = starter.totalCells;

  const plato = sgToPlato(inputs.og);
  const achievedPitchRate =
    inputs.volumeMl > 0 && plato > 0
      ? (available * 1000) / (inputs.volumeMl * plato)
      : 0;

  return {
    cellsNeeded: needed,
    cellsFromSource: fromSource,
    starter,
    cellsAvailable: available,
    ratio: needed > 0 ? available / needed : 0,
    achievedPitchRate,
    sufficient: available >= needed,
  };
}
