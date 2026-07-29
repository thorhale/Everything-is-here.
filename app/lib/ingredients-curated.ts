import { prisma } from "@/lib/db";
import { unstable_cache } from "next/cache";
import type { Fermentable, Hop } from "@prisma/client";

export type { Fermentable, Hop };

// The catalogs are small (hundreds of rows), so load once and filter in
// memory — same approach as lib/yeasts-curated.ts.
const getAllFermentables = unstable_cache(
  async () => prisma.fermentable.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }] }),
  ["fermentables-all"],
  { revalidate: 3600 }
);

const getAllHops = unstable_cache(
  async () => prisma.hop.findMany({ orderBy: [{ name: "asc" }] }),
  ["hops-all"],
  { revalidate: 3600 }
);

export interface FermentableFilter {
  category?: string;
  type?: string;
  use?: string;
  brand?: string;
  search?: string;
}

export async function getFermentableCatalog(filter: FermentableFilter = {}): Promise<Fermentable[]> {
  let list = await getAllFermentables();
  if (filter.category) list = list.filter((f) => f.category === filter.category);
  if (filter.type) list = list.filter((f) => f.type === filter.type);
  if (filter.use) list = list.filter((f) => f.uses.includes(filter.use!));
  if (filter.brand) list = list.filter((f) => f.brand === filter.brand);
  if (filter.search) {
    const q = filter.search.toLowerCase();
    list = list.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.brand ?? "").toLowerCase().includes(q) ||
        f.aliases.some((a) => a.toLowerCase().includes(q)) ||
        f.styleTags.some((t) => t.toLowerCase().includes(q))
    );
  }
  return list;
}

export async function getFermentable(id: string): Promise<Fermentable | null> {
  const all = await getAllFermentables();
  return all.find((f) => f.id === decodeURIComponent(id)) ?? null;
}

export interface HopFilter {
  country?: string;
  purpose?: string;
  aroma?: string;
  search?: string;
}

export async function getHopCatalog(filter: HopFilter = {}): Promise<Hop[]> {
  let list = await getAllHops();
  if (filter.country) list = list.filter((h) => h.country === filter.country);
  if (filter.purpose) list = list.filter((h) => h.purpose === filter.purpose);
  if (filter.aroma) {
    const q = filter.aroma.toLowerCase();
    list = list.filter((h) => h.aromaDescriptors.some((a) => a.toLowerCase().includes(q)));
  }
  if (filter.search) {
    const q = filter.search.toLowerCase();
    list = list.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        h.aliases.some((a) => a.toLowerCase().includes(q)) ||
        h.aromaDescriptors.some((a) => a.toLowerCase().includes(q))
    );
  }
  return list;
}

export async function getHop(id: string): Promise<Hop | null> {
  const all = await getAllHops();
  return all.find((h) => h.id === decodeURIComponent(id)) ?? null;
}

export async function getIngredientFacets(): Promise<{
  categories: string[];
  brands: string[];
  uses: string[];
  countries: string[];
  aromas: string[];
}> {
  const [ferms, hops] = await Promise.all([getAllFermentables(), getAllHops()]);
  const categories = new Set<string>();
  const brands = new Set<string>();
  const uses = new Set<string>();
  for (const f of ferms) {
    categories.add(f.category);
    if (f.brand) brands.add(f.brand);
    f.uses.forEach((u) => uses.add(u));
  }
  const countries = new Set<string>();
  const aromas = new Set<string>();
  for (const h of hops) {
    if (h.country) countries.add(h.country);
    h.aromaDescriptors.forEach((a) => aromas.add(a));
  }
  return {
    categories: [...categories].sort(),
    brands: [...brands].sort(),
    uses: [...uses].sort(),
    countries: [...countries].sort(),
    aromas: [...aromas].sort(),
  };
}

// --- Compact picker lists for the recipe calculator ----------------------

export interface FermentablePick {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  type: string;
  ppg: number | null;
  colorLovibond: number | null;
  isGrain: boolean; // efficiency-scaled in the calculator; sugars/extracts are not
  // Everything below drives the unified builder's sugar-mass model, and the
  // low/high figures are what let it show a gravity band for real fruit
  // instead of a falsely precise single number.
  ppgMin: number | null;
  ppgMax: number | null;
  sugarGPer100g: number | null;
  sugarGPer100gMin: number | null;
  sugarGPer100gMax: number | null;
  juiceBrix: number | null;
  juiceBrixMin: number | null;
  juiceBrixMax: number | null;
  juiceYieldPct: number | null;
  titratableAcidityGPerL: number | null;
  phTypical: number | null;
  uses: string[];
}

export const getFermentablePickerList = unstable_cache(
  async (): Promise<FermentablePick[]> => {
    const all = await prisma.fermentable.findMany({ orderBy: [{ name: "asc" }] });
    return all.map((f) => ({
      id: f.id,
      name: f.name,
      brand: f.brand,
      category: f.category,
      type: f.type,
      ppg: f.ppg,
      colorLovibond: f.colorLovibond,
      // Sugars, syrups, extracts, juice and fruit go in at full yield; only
      // mashed grain is scaled by brewhouse efficiency.
      isGrain: f.type === "grain" || (f.type === "adjunct" && f.requiresConversion),
      ppgMin: f.ppgMin,
      ppgMax: f.ppgMax,
      sugarGPer100g: f.sugarGPer100g,
      sugarGPer100gMin: f.sugarGPer100gMin,
      sugarGPer100gMax: f.sugarGPer100gMax,
      juiceBrix: f.juiceBrix,
      juiceBrixMin: f.juiceBrixMin,
      juiceBrixMax: f.juiceBrixMax,
      juiceYieldPct: f.juiceYieldPct,
      titratableAcidityGPerL: f.titratableAcidityGPerL,
      phTypical: f.phTypical,
      uses: f.uses,
    }));
  },
  ["fermentable-picker-list-v2"],
  { revalidate: 3600 }
);

export interface HopPick {
  id: string;
  name: string;
  alpha: number | null; // midpoint %
  purpose: string | null;
  country: string | null;
}

export const getHopPickerList = unstable_cache(
  async (): Promise<HopPick[]> => {
    const all = await prisma.hop.findMany({ orderBy: [{ name: "asc" }] });
    return all.map((h) => ({
      id: h.id,
      name: h.name,
      alpha:
        h.alphaMin != null && h.alphaMax != null
          ? Math.round(((h.alphaMin + h.alphaMax) / 2) * 10) / 10
          : h.alphaMax ?? h.alphaMin ?? null,
      purpose: h.purpose,
      country: h.country,
    }));
  },
  ["hop-picker-list"],
  { revalidate: 3600 }
);
