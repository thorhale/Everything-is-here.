// Deriving brewing extract values (PPG) for adjuncts from nutrition-facts
// data.
//
// Commercial malts publish a yield/extract figure, but the long tail of things
// homebrewers and distillers actually ferment - rice, cereal, candy, fruit,
// juice, jam, syrup, palm sugar - do not. What they DO have is a Nutrition
// Facts panel, which is enough to compute a defensible PPG.
//
// The reference point: pure sucrose contributes 46 gravity points per pound
// per gallon (1.046 from 1 lb in 1 gal). Anything else contributes in
// proportion to its fermentable-carbohydrate fraction by weight:
//
//     PPG = 46 x (available carbohydrate grams / total grams)
//
// "Available carbohydrate" = total carbohydrate minus dietary fibre, since
// fibre (cellulose, pectin, inulin) is not fermentable by brewing yeast and
// contributes no gravity. Sugar alcohols are likewise excluded when declared.
//
// IMPORTANT: this yields the *potential* extract. Whether you can actually
// reach it depends on the carbohydrate's form:
//   - Simple sugars (sucrose, glucose, fructose) are directly fermentable.
//   - Starch (rice, corn, oats, cereal) must be gelatinised and enzymatically
//     converted - a cereal mash, or mashing with a high-diastatic base malt.
//     The `requiresConversion` flag on a fermentable records this.
// A number here is a ceiling, not a promise.

export const SUCROSE_PPG = 46;

export interface NutritionPanel {
  servingSizeG: number; // grams per serving (use the gram figure, not "1 cup")
  totalCarbG: number; // "Total Carbohydrate" per serving
  fiberG?: number; // "Dietary Fiber" per serving - subtracted, not fermentable
  sugarAlcoholG?: number; // declared polyols - not fermentable by brewing yeast
}

// Fraction of the material, by weight, that is fermentable-capable carbohydrate.
export function availableCarbFraction(n: NutritionPanel): number {
  if (!(n.servingSizeG > 0)) return 0;
  const available = n.totalCarbG - (n.fiberG ?? 0) - (n.sugarAlcoholG ?? 0);
  if (available <= 0) return 0;
  return Math.min(1, available / n.servingSizeG);
}

// Potential extract in points per pound per gallon.
export function ppgFromNutrition(n: NutritionPanel): number {
  return SUCROSE_PPG * availableCarbFraction(n);
}

// Yield as a percentage of sucrose - the "fine grind dry basis"-style figure
// malt datasheets quote, on the same scale.
export function yieldPctFromPpg(ppg: number): number {
  return (ppg / SUCROSE_PPG) * 100;
}

// Gravity contribution of `lb` pounds of a fermentable in `gal` gallons, at a
// given mash/extraction efficiency (sugars and syrups go in at 100%).
export function gravityContribution(ppg: number, lb: number, gal: number, efficiencyPct = 100): number {
  if (!(gal > 0)) return 0;
  return (ppg * lb * (efficiencyPct / 100)) / gal;
}

// --- Liquids -------------------------------------------------------------

// Juice, wort, and must are usually characterised by gravity or Brix rather
// than a nutrition panel. 1 degree Brix ~ 1% sugar by weight; the standard
// approximation SG ~ 1 + (brix / 258.6 - ...) is overkill here, so use the
// common linear form good to ~1.090.
export function brixToSg(brix: number): number {
  return 1 + brix / (258.6 - (brix / 258.2) * 227.1);
}

export function sgToBrix(sg: number): number {
  return (((182.4601 * sg - 775.6821) * sg + 1262.7794) * sg) - 669.5622;
}

// PPG of a liquid adjunct (juice, syrup) from its own specific gravity. A
// liquid at SG 1.050 replacing water contributes 50 points per gallon used;
// expressed per POUND, scale by the liquid's weight per gallon.
export function ppgFromLiquidSg(sg: number): number {
  const pointsPerGallon = (sg - 1) * 1000;
  const lbPerGallon = 8.345 * sg; // water is 8.345 lb/gal
  return lbPerGallon > 0 ? pointsPerGallon / lbPerGallon : 0;
}

// --- Colour --------------------------------------------------------------

// Malt Colour Units -> SRM (Morey), matching lib/calculator/formulas.ts.
export function mcuToSrm(mcu: number): number {
  return 1.4922 * Math.pow(mcu, 0.6859);
}

// A worked example kept as documentation and a sanity check: granulated white
// sugar is essentially pure sucrose (100 g serving, 100 g carb, no fibre), so
// this must return 46.
export const SUCROSE_CHECK: NutritionPanel = { servingSizeG: 100, totalCarbG: 100, fiberG: 0 };
