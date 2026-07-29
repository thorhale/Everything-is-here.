import { prisma } from "@/lib/db";
import { unstable_cache } from "next/cache";
import type { Additive } from "@prisma/client";

export type { Additive };

const getAll = unstable_cache(
  async () => prisma.additive.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }] }),
  ["additives-all"],
  { revalidate: 3600 }
);

export const ADDITIVE_CATEGORIES: { id: string; label: string; blurb: string }[] = [
  { id: "acid", label: "Acids", blurb: "Raising titratable acidity and dropping pH — the difference between a must that ferments and one that spoils." },
  { id: "deacidifier", label: "Deacidifiers", blurb: "Taking acid out, for the cold-climate and hybrid musts that arrive with far too much of it." },
  { id: "nutrient", label: "Nutrients", blurb: "Yeast assimilable nitrogen and the vitamins and sterols that come with it. Honey and juice are both short." },
  { id: "enzyme", label: "Enzymes", blurb: "Pectin, starch and glucan — the polysaccharides standing between you and a clear, fully-attenuated drink." },
  { id: "fining", label: "Finings", blurb: "Dropping haze, protein, polyphenol and yeast out of suspension." },
  { id: "tannin", label: "Tannins", blurb: "Structure and grip, and colour stabilisation in reds. The thing dessert-apple cider is missing." },
  { id: "wood", label: "Wood", blurb: "Oak and its alternatives — species, toast level, and the formats that get you there in weeks rather than years." },
  { id: "stabiliser", label: "Stabilisers", blurb: "Sulphite, sorbate and tartrate control: keeping a finished drink finished." },
  { id: "botanical", label: "Botanicals & spices", blurb: "Juniper, coriander, vanilla, cacao — the flavourings, with the safety notes that some of them genuinely need." },
];

export interface AdditiveFilter {
  category?: string;
  use?: string;
  search?: string;
}

export async function getAdditives(filter: AdditiveFilter = {}): Promise<Additive[]> {
  let list = await getAll();
  if (filter.category) list = list.filter((a) => a.category === filter.category);
  if (filter.use) list = list.filter((a) => a.uses.includes(filter.use!));
  if (filter.search) {
    const q = filter.search.toLowerCase();
    list = list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.aliases.some((x) => x.toLowerCase().includes(q)) ||
        (a.subtype ?? "").toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q)
    );
  }
  return list;
}

export async function getAdditive(id: string): Promise<Additive | null> {
  const all = await getAll();
  return all.find((a) => a.id === decodeURIComponent(id)) ?? null;
}

/**
 * The additives that carry a quantified effect — the ones the calculator can
 * actually dose rather than merely list.
 */
export async function getDosableAdditives(metric: string): Promise<Additive[]> {
  const all = await getAll();
  return all.filter((a) => a.effectMetric === metric && a.effectPerGramPerLitre != null);
}

export async function getAdditiveCounts(): Promise<Record<string, number>> {
  const all = await getAll();
  const out: Record<string, number> = {};
  for (const a of all) out[a.category] = (out[a.category] ?? 0) + 1;
  return out;
}
