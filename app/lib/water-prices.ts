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
