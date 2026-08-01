// Retailer registry for the "shop this recipe" affiliate links.
//
// DORMANT BY DESIGN. Real programmes are listed so the wiring is exercised, but
// every one ships `enabled: false` with an empty `affiliateTag`, so nothing
// renders anywhere until a genuine tag is added and enabled flipped to true
// (see docs/affiliate.md). The search-URL templates are placeholders to confirm
// against each programme's own link format at approval time.
//
// The homebrew megastores carry ingredients AND equipment under one programme,
// so a single approval covers both the frequent-small (grain, hops, yeast) and
// the rare-large (fermenters, kegs) purchase types.

export type BuyCategory = "fermentable" | "hop" | "yeast" | "equipment";

export interface Retailer {
  id: string;
  name: string;
  network: string | null; // ShareASale | Impact | CJ | AvantLink | Amazon | …
  affiliateTag: string; // empty while dormant
  /** {q} is replaced with the URL-encoded query, {tag} with the affiliate tag. */
  searchUrlTemplate: string;
  categories: BuyCategory[];
  enabled: boolean;
}

export const RETAILERS: Retailer[] = [
  {
    id: "morebeer",
    name: "MoreBeer",
    network: "ShareASale",
    affiliateTag: "",
    searchUrlTemplate: "https://www.morebeer.com/search?q={q}",
    categories: ["fermentable", "hop", "yeast", "equipment"],
    enabled: false,
  },
  {
    id: "adventures-in-homebrewing",
    name: "Adventures in Homebrewing",
    network: "ShareASale",
    affiliateTag: "",
    searchUrlTemplate: "https://www.homebrewing.org/search?q={q}",
    categories: ["fermentable", "hop", "yeast", "equipment"],
    enabled: false,
  },
];

/** Only retailers that are switched on with a real tag ever render. */
export const enabledRetailers = (): Retailer[] =>
  RETAILERS.filter((r) => r.enabled && r.affiliateTag.trim().length > 0);
