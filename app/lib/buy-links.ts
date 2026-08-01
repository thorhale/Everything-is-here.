// Buy-link construction for the affiliate scaffold.
//
// Search queries are built at the specificity a homebrewer actually shops at:
//   - fermentable: maltster + variety ("Crisp Maris Otter") — the maltster is
//     substantive because kiln/roast differ, so it defaults ON;
//   - hop: variety + "hops" + coarse region ("Cascade hops US") — buyers know
//     US/NZ/AU, not the farm, so region is as fine as it goes;
//   - yeast: lab + product ("Fermentis SafAle US-05") — already SKU-precise.
// A toggle can loosen the query to just the variety for the price-shopper who
// doesn't care about the maltster or region.
//
// A `deepLink` (a specific matched product URL) always wins when present; that
// is the slot a future product-feed matcher fills. Until then everything falls
// back to the retailer's search, which still sets the affiliate cookie.
import type { Retailer, BuyCategory } from "@/lib/retailers";
import { enabledRetailers } from "@/lib/retailers";

export interface BuyItem {
  cls: Extract<BuyCategory, "fermentable" | "hop" | "yeast">;
  name: string;
  brand?: string | null; // maltster, for fermentables
  country?: string | null; // growing region, for hops
  lab?: string | null; // lab, for yeast
}

export interface BuyQueryOpts {
  includeBrand?: boolean; // maltster on fermentable queries
  includeRegion?: boolean; // region on hop queries
}

export function buyQuery(item: BuyItem, opts: BuyQueryOpts = {}): string {
  const { includeBrand = true, includeRegion = true } = opts;
  const parts: string[] = [];
  if (item.cls === "fermentable") {
    if (includeBrand && item.brand) parts.push(item.brand);
    parts.push(item.name);
  } else if (item.cls === "hop") {
    parts.push(item.name, "hops");
    if (includeRegion && item.country) parts.push(item.country);
  } else {
    if (item.lab) parts.push(item.lab);
    parts.push(item.name);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function buyUrl(retailer: Retailer, query: string, deepLink?: string): string {
  if (deepLink) return deepLink;
  return retailer.searchUrlTemplate
    .replace("{q}", encodeURIComponent(query))
    .replace("{tag}", encodeURIComponent(retailer.affiliateTag));
}

export { enabledRetailers };
