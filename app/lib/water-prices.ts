import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { unstable_cache } from "next/cache";

// What a gallon of each bottled water costs, so the profiles can be compared on
// money as well as chemistry — which for brewing is not a footnote. A five
// gallon batch built on supermarket spring water is a different proposition at
// $1 a gallon than at $15.
//
// Every observation carries its date, seller, pack and link. A bottled-water
// price without those is not information: it moves with the retailer, the
// region, the pack size and the week.

export interface WaterPrice {
  id: string;
  /** The water profiles this price applies to. A brand may cover several. */
  profileIds: string[];
  brand: string;
  product: string;
  seller: string;
  sellerType: "foodservice-distributor" | "producer-direct" | "retailer";
  packDescription: string;
  volumeGallons: number;
  priceUsd: number;
  pricePerGallonUsd: number;
  observedAt: string;
  url: string;
  note?: string;
}

/** Beyond this, a price is shown but flagged — prices move. */
export const STALE_DAYS = 180;

export const getWaterPrices = unstable_cache(
  async (): Promise<WaterPrice[]> => {
    try {
      const raw = await readFile(join(process.cwd(), "..", "data", "water", "prices.json"), "utf8");
      return (JSON.parse(raw).prices ?? []) as WaterPrice[];
    } catch {
      return [];
    }
  },
  ["water-prices-v1"],
  { revalidate: 3600 }
);

/**
 * The cheapest observed price per gallon for each profile, keyed by profile id.
 *
 * Cheapest rather than average: pack sizes for the same water differ by more
 * than threefold (S.Pellegrino runs $13.09/gal in litre bottles and $21.44 in
 * 250 mL), so an average would describe no purchase anyone could actually make,
 * while the cheapest is a real line on a real invoice.
 */
export async function cheapestPerGallon(): Promise<Map<string, WaterPrice>> {
  const out = new Map<string, WaterPrice>();
  for (const p of await getWaterPrices()) {
    for (const id of p.profileIds) {
      const held = out.get(id);
      if (!held || p.pricePerGallonUsd < held.pricePerGallonUsd) out.set(id, p);
    }
  }
  return out;
}

/** Whole days since the price was seen, or null if the date is unusable. */
export function ageInDays(observedAt: string, now = new Date()): number | null {
  const when = new Date(observedAt);
  if (Number.isNaN(when.getTime())) return null;
  return Math.floor((now.getTime() - when.getTime()) / 86_400_000);
}

// An estimate is a guess, not an observation. It has no seller and no link
// because nobody sold it at this price on a given day — it is a rounded-up
// judgement about typical US supermarket cost, kept in its own list and its own
// type so it can never be read as a checked figure. Deliberately rounded up, so
// a batch is over-budgeted rather than under.
export interface WaterPriceEstimate {
  id: string;
  profileIds: string[];
  brand: string;
  estimatedPricePerGallonUsd: number;
  packAssumption: string;
  basis: string;
  estimatedAt: string;
}

export const getWaterPriceEstimates = unstable_cache(
  async (): Promise<WaterPriceEstimate[]> => {
    try {
      const raw = await readFile(join(process.cwd(), "..", "data", "water", "prices.json"), "utf8");
      return (JSON.parse(raw).estimates ?? []) as WaterPriceEstimate[];
    } catch {
      return [];
    }
  },
  ["water-price-estimates-v1"],
  { revalidate: 3600 }
);

/** Estimate per profile id. Callers must prefer an observed price where one exists. */
export async function estimatesByProfile(): Promise<Map<string, WaterPriceEstimate>> {
  const out = new Map<string, WaterPriceEstimate>();
  for (const e of await getWaterPriceEstimates()) {
    for (const id of e.profileIds) out.set(id, e);
  }
  return out;
}
