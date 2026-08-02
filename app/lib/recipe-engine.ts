// One recipe engine for every fermentable.
//
// Beer, cider, wine, mead and a distiller's wash are usually treated as five
// separate calculators because their inputs look different: pounds of malt and
// a mash efficiency, versus litres of juice at a measured Brix, versus
// kilograms of honey, versus whole fruit by the bucket. Underneath they are
// the same arithmetic. Every ingredient does exactly two things:
//
//   1. it contributes some mass of fermentable sugar
//   2. it contributes some volume of liquid (or none, for a dry grain)
//
// and gravity is sugar mass over final volume. Mash efficiency is not a
// special case — it is a yield factor on one class of ingredient. That is the
// whole model, and it is why this file replaces five calculators with one.
//
// The second thing this engine does is refuse to pretend fruit is precise.
// A supermarket apple is somewhere between 9 and 14 g of sugar per 100 g
// depending on cultivar, season and how long it sat in a warehouse; a Zinfandel
// picked over three days can move four degrees Brix. So every sugar figure
// carries a low, typical and high value, and the output is a gravity *band*.
// A measured refractometer reading, when you have one, collapses the band to a
// point — that is what `measuredBrix` is for.

import { POINTS_PER_G_PER_L, sgFromBrix, abvSimple, abvAlternate, fgFromAttenuation } from "@/lib/must";

export type Beverage = "beer" | "cider" | "wine" | "mead" | "spirit";

export const BEVERAGES: { id: Beverage; label: string; blurb: string }[] = [
  { id: "beer", label: "Beer", blurb: "Mashed grain, hops, brewhouse efficiency, IBU and colour." },
  { id: "cider", label: "Cider & Perry", blurb: "Pressed juice or whole fruit. No mash, no efficiency — acid and tannin instead." },
  { id: "wine", label: "Wine", blurb: "Must at a measured Brix. Acid, pH, sulphite and nitrogen are the whole game." },
  { id: "mead", label: "Mead", blurb: "Honey and water. Nitrogen-free, so nutrient scheduling is not optional." },
  { id: "spirit", label: "Spirit wash", blurb: "A wash is only a means to alcohol — strength, yield and cuts are what matter." },
];

/** How an ingredient gives up its sugar. */
export type SugarPath =
  | "mash"        // starch converted in a mash, scaled by brewhouse efficiency
  | "direct"      // sugar, syrup, honey, extract — full yield, no efficiency
  | "whole-fruit" // fruit added to the fermenter as-is
  | "juice";      // pressed or bought juice, at a Brix

export interface EngineIngredient {
  key: string;
  name: string;
  path: SugarPath;
  /** Mass in grams for solids, or volume in litres for liquids. */
  amount: number;
  amountUnit: "g" | "L";

  // --- sugar, by whichever route applies -------------------------------
  ppg?: number | null;              // mash / direct path
  ppgMin?: number | null;
  ppgMax?: number | null;
  sugarGPer100g?: number | null;    // whole-fruit path
  sugarGPer100gMin?: number | null;
  sugarGPer100gMax?: number | null;
  juiceBrix?: number | null;        // juice path
  juiceBrixMin?: number | null;
  juiceBrixMax?: number | null;
  juiceYieldPct?: number | null;    // whole fruit pressed rather than steeped
  /** A refractometer reading overrides every estimate above. */
  measuredBrix?: number | null;

  /** For whole fruit: press it, or steep it whole in the fermenter. */
  fruitHandling?: "pressed" | "whole";

  colorLovibond?: number | null;
  fermentabilityPct?: number | null;
  titratableAcidityGPerL?: number | null;
  phTypical?: number | null;
}

export interface EngineHop {
  key: string;
  name: string;
  amountG: number;
  alphaPct: number;
  timeMin: number;
  isDryHop: boolean;
}

export interface EngineInputs {
  beverage: Beverage;
  batchVolumeL: number;
  /** Only applies to the mash path. Everything else ignores it. */
  efficiencyPct: number;
  attenuationPct: number;
  alcoholTolerancePct?: number | null;
  ingredients: EngineIngredient[];
  hops: EngineHop[];
  boilVolumeL?: number | null;
}

export interface Band {
  low: number;
  typical: number;
  high: number;
}

export interface EngineResult {
  /** Fermentable sugar in grams, as a band. */
  sugarG: Band;
  /** Liquid the ingredients themselves bring, before any top-up water. */
  ingredientVolumeL: number;
  /** Water to add to reach the batch volume; negative means you are over. */
  topUpWaterL: number;
  og: Band;
  fg: Band;
  abv: Band;
  abvAlternate: number;
  brix: Band;
  srm: number | null;
  ibu: number | null;
  /** Weighted must acidity and pH, where the ingredients carry figures. */
  estimatedTaGPerL: number | null;
  estimatedPh: number | null;
  /** True when the band is wide enough that the user should go and measure. */
  uncertain: boolean;
  /** Set when the yeast will hit its ceiling before the sugar runs out. */
  stallsAt: number | null;
  warnings: string[];
}

const band = (low: number, typical: number, high: number): Band => ({ low, typical, high });

/**
 * Sugar contributed by one ingredient, as a low/typical/high band in grams,
 * plus the litres of liquid it brings with it.
 */
function contribution(
  ing: EngineIngredient,
  efficiencyPct: number
): { sugar: Band; volumeL: number } {
  const none = { sugar: band(0, 0, 0), volumeL: 0 };
  if (!(ing.amount > 0)) return none;

  // A measured Brix beats every estimate, for any path that has a Brix.
  const measured = ing.measuredBrix != null && ing.measuredBrix > 0 ? ing.measuredBrix : null;

  switch (ing.path) {
    case "mash":
    case "direct": {
      // PPG is points per pound per gallon; PPG / 46 is the sugar mass
      // fraction, which is the only form the engine cares about.
      const massG = ing.amountUnit === "g" ? ing.amount : ing.amount * 1000;
      const yieldFactor = ing.path === "mash" ? efficiencyPct / 100 : 1;
      const f = (ppg: number | null | undefined) =>
        ppg == null ? 0 : massG * (ppg / 46) * yieldFactor;
      const typical = f(ing.ppg);
      return {
        sugar: band(f(ing.ppgMin ?? ing.ppg), typical, f(ing.ppgMax ?? ing.ppg)),
        // Dry ingredients bring no liquid. Syrups and honey do, but their
        // water is already netted out of the sugar fraction and the volume
        // they add is small relative to a batch — treated as negligible.
        volumeL: 0,
      };
    }

    case "whole-fruit": {
      const massG = ing.amountUnit === "g" ? ing.amount : ing.amount * 1000;
      // Pressed: you get juice at a Brix, times the press yield, and the
      // juice joins the batch volume. Whole: it steeps in the fermenter and
      // gives up most of its sugar over time, and its water joins too.
      if (ing.fruitHandling === "pressed" && ing.juiceYieldPct) {
        const juiceMassG = massG * (ing.juiceYieldPct / 100);
        const b = (brix: number | null | undefined) =>
          brix == null ? 0 : juiceMassG * (brix / 100);
        const brixTyp = measured ?? ing.juiceBrix ?? null;
        const typical = b(brixTyp);
        return {
          sugar: measured
            ? band(typical, typical, typical)
            : band(b(ing.juiceBrixMin ?? ing.juiceBrix), typical, b(ing.juiceBrixMax ?? ing.juiceBrix)),
          // Juice density is close enough to 1 kg/L at these strengths that
          // mass and volume are interchangeable for planning purposes.
          volumeL: juiceMassG / 1000 / (sgFromBrix(brixTyp ?? 12)),
        };
      }
      const s = (per100: number | null | undefined) =>
        per100 == null ? 0 : massG * (per100 / 100);
      const typical = s(ing.sugarGPer100g);
      return {
        sugar: band(s(ing.sugarGPer100gMin ?? ing.sugarGPer100g), typical, s(ing.sugarGPer100gMax ?? ing.sugarGPer100g)),
        // Whole fruit is mostly water and it all ends up in the batch.
        volumeL: (massG * 0.85) / 1000,
      };
    }

    case "juice": {
      const volumeL = ing.amountUnit === "L" ? ing.amount : ing.amount / 1000;
      const massG = volumeL * 1000 * sgFromBrix(measured ?? ing.juiceBrix ?? 12);
      const b = (brix: number | null | undefined) => (brix == null ? 0 : massG * (brix / 100));
      const typical = b(measured ?? ing.juiceBrix);
      return {
        sugar: measured
          ? band(typical, typical, typical)
          : band(b(ing.juiceBrixMin ?? ing.juiceBrix), typical, b(ing.juiceBrixMax ?? ing.juiceBrix)),
        volumeL,
      };
    }
  }
}

/** Tinseth utilisation, as used by the beer calculator. */
export function tinsethUtilisation(boilGravity: number, timeMin: number): number {
  const bigness = 1.65 * 0.000125 ** (boilGravity - 1);
  const timeFactor = (1 - Math.exp(-0.04 * timeMin)) / 4.15;
  return bigness * timeFactor;
}

/**
 * Beer colour (SRM) from a grain bill, via malt colour units and the Morey
 * equation. Exported as the single source of truth so the colour-rebalance
 * solver and computeRecipe cannot disagree. `massG` is grams; colour is
 * degrees Lovibond.
 */
export function srmOfBill(
  items: { colorLovibond: number | null; massG: number }[],
  batchVolumeL: number
): number {
  const galBatch = batchVolumeL / 3.785411784;
  if (galBatch <= 0) return 0;
  let mcu = 0;
  for (const it of items) {
    if (!it.colorLovibond) continue;
    mcu += (it.colorLovibond * (it.massG / 453.59237)) / galBatch;
  }
  return mcu > 0 ? 1.4922 * mcu ** 0.6859 : 0;
}

export function computeRecipe(inputs: EngineInputs): EngineResult {
  const warnings: string[] = [];
  const contributions = inputs.ingredients.map((i) => contribution(i, inputs.efficiencyPct));

  const sugarG = contributions.reduce(
    (acc, c) => band(acc.low + c.sugar.low, acc.typical + c.sugar.typical, acc.high + c.sugar.high),
    band(0, 0, 0)
  );
  const ingredientVolumeL = contributions.reduce((s, c) => s + c.volumeL, 0);
  const batchVolumeL = inputs.batchVolumeL > 0 ? inputs.batchVolumeL : 0;
  const topUpWaterL = batchVolumeL - ingredientVolumeL;

  if (topUpWaterL < 0) {
    warnings.push(
      `Your ingredients alone come to ${ingredientVolumeL.toFixed(1)} L, which is more than the ${batchVolumeL.toFixed(1)} L batch. Either raise the batch size or cut the fruit back.`
    );
  }

  const toSg = (g: number) => (batchVolumeL > 0 ? 1 + (g / batchVolumeL) * POINTS_PER_G_PER_L / 1000 : 1);
  const og = band(toSg(sugarG.low), toSg(sugarG.typical), toSg(sugarG.high));

  const att = inputs.attenuationPct;
  const fgRaw = band(
    fgFromAttenuation(og.low, att),
    fgFromAttenuation(og.typical, att),
    fgFromAttenuation(og.high, att)
  );

  // If the yeast's alcohol ceiling arrives before the sugar runs out, the
  // fermentation stops there and the drink finishes sweet whether you wanted
  // it to or not. This is the single most common surprise in mead.
  let stallsAt: number | null = null;
  const tol = inputs.alcoholTolerancePct ?? null;
  let fg = fgRaw;
  if (tol != null && tol > 0) {
    const ceiling = (o: number) => Math.max(o - tol / 131.25, fgFromAttenuation(o, att));
    const stalled = band(ceiling(og.low), ceiling(og.typical), ceiling(og.high));
    if (stalled.typical > fgRaw.typical + 0.0005) {
      stallsAt = stalled.typical;
      fg = stalled;
      warnings.push(
        `At ${og.typical.toFixed(3)} this must carries more sugar than a ${tol}% ABV yeast can finish. Expect it to stop around ${stalled.typical.toFixed(3)} and taste sweet. That is fine if it is what you want — pick a higher-tolerance strain if it is not.`
      );
    }
  }

  const abv = band(abvSimple(og.low, fg.low), abvSimple(og.typical, fg.typical), abvSimple(og.high, fg.high));

  // --- colour and bitterness, for the drinks that have them -------------
  let srm: number | null = null;
  let ibu: number | null = null;
  if (inputs.beverage === "beer") {
    const galBatch = batchVolumeL / 3.785411784;
    if (galBatch > 0) {
      srm = srmOfBill(
        inputs.ingredients.map((ing) => ({
          colorLovibond: ing.colorLovibond ?? null,
          massG: ing.amountUnit === "g" ? ing.amount : ing.amount * 1000,
        })),
        batchVolumeL
      );

      // Tinseth takes the gravity the hops actually boil in, which is the
      // gravity at the average of pre-boil and post-boil volume.
      const boilL = inputs.boilVolumeL && inputs.boilVolumeL > 0 ? inputs.boilVolumeL : batchVolumeL;
      const avgBoilVolumeL = (boilL + batchVolumeL) / 2;
      const boilGravity = 1 + (sugarG.typical / avgBoilVolumeL) * POINTS_PER_G_PER_L / 1000;
      ibu = inputs.hops.reduce((total, h) => {
        if (h.isDryHop || h.amountG <= 0) return total;
        const mgPerL = (h.alphaPct / 100) * h.amountG * 1000 / batchVolumeL;
        return total + mgPerL * tinsethUtilisation(boilGravity, h.timeMin);
      }, 0);
    }
  }

  // --- must chemistry, volume-weighted ----------------------------------
  let taWeighted = 0;
  let phWeighted = 0;
  let acidVolume = 0;
  inputs.ingredients.forEach((ing, idx) => {
    const v = contributions[idx].volumeL;
    if (v <= 0) return;
    if (ing.titratableAcidityGPerL != null) taWeighted += ing.titratableAcidityGPerL * v;
    if (ing.phTypical != null) phWeighted += ing.phTypical * v;
    acidVolume += v;
  });
  // Top-up water dilutes acidity but barely moves pH — it is unbuffered.
  const estimatedTaGPerL = acidVolume > 0 && batchVolumeL > 0 ? taWeighted / batchVolumeL : null;
  const estimatedPh = acidVolume > 0 ? phWeighted / acidVolume : null;

  if (estimatedPh != null && estimatedPh > 3.8 && inputs.beverage !== "beer") {
    warnings.push(
      `Estimated must pH is around ${estimatedPh.toFixed(2)}. Above about 3.8 the sulphite you would need for real protection becomes impractical, and spoilage organisms are much harder to hold off. Acidify with tartaric or malic before pitching.`
    );
  }
  if (inputs.beverage === "mead" && inputs.ingredients.some((i) => i.path === "direct")) {
    warnings.push(
      "Honey carries essentially no assimilable nitrogen. Without a staggered nutrient schedule expect a sluggish ferment and hydrogen sulphide — see the nutrient plan below."
    );
  }

  const spread = og.high - og.low;
  if (spread > 0.010) {
    warnings.push(
      `The gravity band spans ${og.low.toFixed(3)}–${og.high.toFixed(3)}, because fresh fruit sugar genuinely varies that much. Take a refractometer reading of the actual juice and enter it to collapse this to a single number.`
    );
  }

  return {
    sugarG,
    ingredientVolumeL,
    topUpWaterL,
    og,
    fg,
    abv,
    abvAlternate: abvAlternate(og.typical, fg.typical),
    brix: band(brixOf(og.low), brixOf(og.typical), brixOf(og.high)),
    srm,
    ibu,
    estimatedTaGPerL,
    estimatedPh,
    uncertain: spread > 0.006,
    stallsAt,
    warnings,
  };
}

function brixOf(sg: number): number {
  return -668.962 + 1262.45 * sg - 776.43 * sg ** 2 + 182.94 * sg ** 3;
}

/**
 * Which ingredient categories belong on which beverage's ingredient picker.
 * The catalog is one list; this decides what to show first, not what to allow.
 * Anything can be added to anything — braggot is beer and mead at once, a
 * cyser is cider and mead, and people put stranger things than that in a
 * fermenter.
 */
export const CATEGORY_PRIORITY: Record<Beverage, string[]> = {
  beer: ["base-malt", "specialty-malt", "adjunct-grain", "sugar", "syrup", "extract", "cereal", "fruit", "juice", "honey"],
  cider: ["juice", "fruit", "sugar", "honey", "syrup", "wine-grape"],
  wine: ["wine-grape", "juice", "fruit", "sugar", "honey", "syrup"],
  mead: ["honey", "fruit", "juice", "sugar", "syrup", "wine-grape", "base-malt", "specialty-malt"],
  spirit: ["sugar", "syrup", "base-malt", "adjunct-grain", "cereal", "fruit", "juice", "wine-grape", "honey"],
};

/** The default sugar path for a catalog category. */
export function defaultPath(category: string, type: string): SugarPath {
  if (category === "juice") return "juice";
  if (category === "fruit" || category === "wine-grape") return "whole-fruit";
  if (type === "grain") return "mash";
  if (type === "adjunct") return "mash";
  return "direct";
}
