import { prisma } from "@/lib/db";
import { unstable_cache } from "next/cache";
import type { YeastStrain, YeastLab } from "@prisma/client";

export type Strain = YeastStrain;
export type Lab = YeastLab;

// All labs, ordered for browsing.
export const getLabs = unstable_cache(
  async () => prisma.yeastLab.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ["yeast-labs"],
  { revalidate: 3600 }
);

// Every strain with its lab. The catalog is small (hundreds of rows), so we
// load once and filter/rank in memory - simpler and lets us do fuzzy style
// matching that would be awkward in SQL.
const getAllStrains = unstable_cache(
  async () =>
    prisma.yeastStrain.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { lab: true },
    }),
  ["yeast-strains-all"],
  { revalidate: 3600 }
);

export type StrainWithLab = Awaited<ReturnType<typeof getAllStrains>>[number];

export async function getStrain(id: string): Promise<StrainWithLab | null> {
  const all = await getAllStrains();
  return all.find((s) => s.id === id) ?? null;
}

export function strainHref(id: string): string {
  return `/yeasts/db/${encodeURIComponent(id)}`;
}

export interface StrainFilter {
  use?: string;
  lab?: string;
  species?: string;
  form?: string;
  style?: string;
  search?: string;
}

// Tokens shared for style/name normalization. Very common words are dropped
// so a match must share a meaningful token (e.g. "stout", "saison"), not just
// "ale" or "beer".
const STOP = new Set(["ale", "beer", "style", "the", "and", "a", "of", "wine"]);
function tokens(s: string): Set<string> {
  return new Set(
    s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w))
  );
}

// Score how well a strain's recommendedStyles/styleTags fit a style name.
function styleFitScore(styleName: string, strain: Strain): number {
  const target = tokens(styleName);
  if (target.size === 0) return 0;
  let best = 0;
  for (const rec of strain.recommendedStyles) {
    let n = 0;
    for (const t of tokens(rec)) if (target.has(t)) n++;
    if (n > best) best = n;
  }
  // Tags contribute a smaller signal.
  let tagHits = 0;
  for (const tag of strain.styleTags) if (target.has(tag.toLowerCase())) tagHits++;
  return best * 2 + tagHits;
}

export async function getStrains(filter: StrainFilter = {}): Promise<StrainWithLab[]> {
  let list = await getAllStrains();
  if (filter.use) list = list.filter((s) => s.uses.includes(filter.use!));
  if (filter.lab) list = list.filter((s) => s.labId === filter.lab);
  if (filter.form) list = list.filter((s) => s.form === filter.form);
  if (filter.species) {
    const q = filter.species.toLowerCase();
    list = list.filter((s) => s.species.toLowerCase().includes(q));
  }
  if (filter.search) {
    const q = filter.search.toLowerCase();
    list = list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.productCode ?? "").toLowerCase().includes(q) ||
        s.species.toLowerCase().includes(q) ||
        s.lab.name.toLowerCase().includes(q) ||
        s.aliases.some((a) => a.toLowerCase().includes(q))
    );
  }
  if (filter.style) {
    const scored = list
      .map((s) => ({ s, score: styleFitScore(filter.style!, s) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    list = scored.map((x) => x.s);
  }
  return list;
}

// Distinct facet values for building filter UIs.
export async function getFacets(): Promise<{ uses: string[]; species: string[]; forms: string[] }> {
  const all = await getAllStrains();
  const uses = new Set<string>();
  const species = new Set<string>();
  const forms = new Set<string>();
  for (const s of all) {
    s.uses.forEach((u) => uses.add(u));
    species.add(s.species);
    forms.add(s.form);
  }
  return {
    uses: [...uses].sort(),
    species: [...species].sort(),
    forms: [...forms].sort(),
  };
}

// The bridge from a style (BJCP/recipe) to ranked suggested yeasts.
export async function matchStrainsForStyle(
  styleName: string,
  opts: { use?: string; limit?: number } = {}
): Promise<StrainWithLab[]> {
  if (!styleName?.trim()) return [];
  let list = await getAllStrains();
  if (opts.use) list = list.filter((s) => s.uses.includes(opts.use!));
  const scored = list
    .map((s) => ({ s, score: styleFitScore(styleName, s) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.s.sortOrder - b.s.sortOrder);
  return scored.slice(0, opts.limit ?? 6).map((x) => x.s);
}

// Bridge a scraped RecipeYeast.name (e.g. "WLP001", "Wyeast 1056 American
// Ale", "Safale US-05") to a curated strain, if one matches.
export async function matchStrainForName(name: string): Promise<StrainWithLab | null> {
  if (!name?.trim()) return null;
  const q = name.toLowerCase();
  const all = await getAllStrains();
  // Prefer a product-code hit (most specific), then a name/alias hit.
  const byCode = all.find((s) => s.productCode && q.includes(s.productCode.toLowerCase()));
  if (byCode) return byCode;
  return (
    all.find(
      (s) => q.includes(s.name.toLowerCase()) || s.aliases.some((a) => q.includes(a.toLowerCase()))
    ) ?? null
  );
}

export interface StrainPick {
  id: string;
  name: string;
  lab: string;
  form: string;
  uses: string[];
  attenuation: number | null; // midpoint %
  cellsPerUnit: number | null;
  unitLabel: string | null;
}

// Compact list for the calculators (attenuation autofill + pitch presets).
export const getStrainPickerList = unstable_cache(
  async (): Promise<StrainPick[]> => {
    const all = await prisma.yeastStrain.findMany({
      orderBy: [{ name: "asc" }],
      include: { lab: { select: { name: true } } },
    });
    return all.map((s) => ({
      id: s.id,
      name: s.name,
      lab: s.lab.name,
      form: s.form,
      uses: s.uses,
      attenuation:
        s.attenuationMin != null && s.attenuationMax != null
          ? Math.round((s.attenuationMin + s.attenuationMax) / 2)
          : s.attenuationMax ?? s.attenuationMin ?? null,
      cellsPerUnit: s.cellsPerUnit,
      unitLabel: s.unitLabel,
    }));
  },
  ["yeast-picker-list"],
  { revalidate: 3600 }
);
