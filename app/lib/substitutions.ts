// Ingredient substitution.
//
// "The shop is out of Citra — what else?" Three different problems:
//
//  - HOPS: growers publish substitute lists, already stored on Hop.substitutes.
//    We resolve those names to catalog rows and add aroma-overlap matches.
//  - FERMENTABLES: the same product is sold by every maltster under a
//    different name (Crystal 60 / CaraMunich / Caramalt 60). Equivalence is by
//    category plus colour proximity, which is how brewers actually swap them.
//  - YEAST: many "different" products are the same organism. WLP001, Wyeast
//    1056 and Safale US-05 are all the Chico strain. Those lineage groups are
//    listed explicitly below because no vendor will tell you.

import { prisma } from "@/lib/db";
import { unstable_cache } from "next/cache";
import type { Hop, Fermentable, YeastStrain } from "@prisma/client";

// --- Yeast lineage groups -------------------------------------------------
// Strains widely documented as the same or functionally interchangeable
// culture sold by different labs. Grouped by the common trade name.
export const YEAST_LINEAGES: { name: string; note: string; strainIds: string[] }[] = [
  {
    name: "Chico / American Ale",
    note: "The Sierra Nevada strain. The same organism sold by four labs — clean, neutral, the American ale default.",
    strainIds: ["white-labs-wlp001", "wyeast-1056", "fermentis-us-05", "omega-oyl-004"],
  },
  {
    name: "English Ale (Whitbread-type)",
    note: "Fast, flocculant English strains with closely comparable behaviour.",
    strainIds: ["fermentis-s-04", "white-labs-wlp007", "lallemand-nottingham"],
  },
  {
    name: "Fuller's ESB",
    note: "The Fuller's strain: malty, fruity, extremely flocculant.",
    strainIds: ["white-labs-wlp002", "wyeast-1968"],
  },
  {
    name: "Irish Dry Stout",
    note: "The Guinness-lineage Irish ale strains — near-identical in practice.",
    strainIds: ["white-labs-wlp004", "wyeast-1084"],
  },
  {
    name: "Weihenstephan Weizen",
    note: "The benchmark banana-and-clove wheat strain in liquid and dry form.",
    strainIds: ["wyeast-3068", "white-labs-wlp300", "lallemand-munich-classic", "fermentis-wb-06"],
  },
  {
    name: "German Lager (34/70)",
    note: "Weihenstephan 34/70, the world's most-used lager strain, across formats.",
    strainIds: ["fermentis-w-3470", "wyeast-2124", "lallemand-diamond", "white-labs-wlp830"],
  },
  {
    name: "Kölsch",
    note: "Kölsch/German ale strains; clean with a touch of vinous fruit.",
    strainIds: ["white-labs-wlp029", "fermentis-k-97", "lallemand-koln"],
  },
  {
    name: "Dupont Saison",
    note: "The classic Dupont saison culture — spicy, dry, and famously stall-prone.",
    strainIds: ["wyeast-3724", "white-labs-wlp565"],
  },
  {
    name: "Voss Kveik",
    note: "The Norwegian Voss kveik culture, sold by several labs.",
    strainIds: ["lallemand-voss", "omega-oyl-061"],
  },
  {
    name: "Lutra Kveik",
    note: "Ultra-clean kveik for fast pseudo-lagers.",
    strainIds: ["lallemand-lutra", "omega-oyl-071"],
  },
  {
    name: "Neutral high-tolerance wine/mead",
    note: "Champagne-type bayanus strains: neutral, ferment dry, restart stuck ferments.",
    strainIds: ["lalvin-ec-1118", "red-star-premier-blanc", "red-star-premier-cuvee", "white-labs-wlp715"],
  },
];

export interface Substitute<T> {
  item: T;
  reason: string;
  strength: "same" | "close" | "similar";
}

// --- Hops -----------------------------------------------------------------

export const getHopSubstitutes = unstable_cache(
  async (hopId: string): Promise<Substitute<Hop>[]> => {
    const hop = await prisma.hop.findUnique({ where: { id: hopId } });
    if (!hop) return [];
    const all = await prisma.hop.findMany({ where: { id: { not: hopId } } });

    const out = new Map<string, Substitute<Hop>>();

    // 1. Grower-published substitutes (most authoritative).
    for (const name of hop.substitutes) {
      const match = all.find(
        (h) => h.name.toLowerCase() === name.toLowerCase() || h.aliases.some((a) => a.toLowerCase() === name.toLowerCase())
      );
      if (match) {
        out.set(match.id, { item: match, reason: "listed by the grower as a substitute", strength: "same" });
      }
    }

    // 2. Aroma overlap — hops sharing most descriptors behave similarly late.
    const mine = new Set(hop.aromaDescriptors.map((a) => a.toLowerCase()));
    if (mine.size > 0) {
      for (const h of all) {
        if (out.has(h.id)) continue;
        const shared = h.aromaDescriptors.filter((a) => mine.has(a.toLowerCase())).length;
        if (shared >= 2) {
          out.set(h.id, {
            item: h,
            reason: `shares ${shared} aroma descriptors (${h.aromaDescriptors.filter((a) => mine.has(a.toLowerCase())).join(", ")})`,
            strength: shared >= 3 ? "close" : "similar",
          });
        }
      }
    }

    const rank = { same: 0, close: 1, similar: 2 };
    return [...out.values()].sort((a, b) => rank[a.strength] - rank[b.strength]).slice(0, 8);
  },
  ["hop-substitutes"],
  { revalidate: 3600 }
);

// --- Fermentables ---------------------------------------------------------

export const getFermentableSubstitutes = unstable_cache(
  async (fermentableId: string): Promise<Substitute<Fermentable>[]> => {
    const f = await prisma.fermentable.findUnique({ where: { id: fermentableId } });
    if (!f) return [];
    const all = await prisma.fermentable.findMany({ where: { id: { not: fermentableId } } });

    const out: Substitute<Fermentable>[] = [];
    for (const c of all) {
      if (c.category !== f.category) continue;
      // Colour proximity is the practical test for swapping a specialty malt.
      if (f.colorLovibond != null && c.colorLovibond != null) {
        const diff = Math.abs(c.colorLovibond - f.colorLovibond);
        const tol = Math.max(3, f.colorLovibond * 0.25);
        if (diff <= tol) {
          out.push({
            item: c,
            reason:
              c.brand && f.brand && c.brand !== f.brand
                ? `${c.brand}'s equivalent — ${c.colorLovibond} °L vs ${f.colorLovibond} °L`
                : `same category, ${c.colorLovibond} °L vs ${f.colorLovibond} °L`,
            strength: diff <= tol / 2 ? "same" : "close",
          });
        }
      } else if (f.colorLovibond == null && c.colorLovibond == null) {
        out.push({ item: c, reason: `same category (${c.category})`, strength: "similar" });
      }
    }
    const rank = { same: 0, close: 1, similar: 2 };
    return out.sort((a, b) => rank[a.strength] - rank[b.strength]).slice(0, 8);
  },
  ["fermentable-substitutes"],
  { revalidate: 3600 }
);

// --- Yeast ----------------------------------------------------------------

export interface YeastSubstitutes {
  lineage: { name: string; note: string } | null;
  sameStrain: YeastStrain[]; // documented same culture, different label
  similar: YeastStrain[]; // comparable specs
}

export const getYeastSubstitutes = unstable_cache(
  async (strainId: string): Promise<YeastSubstitutes> => {
    const strain = await prisma.yeastStrain.findUnique({ where: { id: strainId } });
    if (!strain) return { lineage: null, sameStrain: [], similar: [] };

    const group = YEAST_LINEAGES.find((g) => g.strainIds.includes(strainId));
    const sameStrain = group
      ? await prisma.yeastStrain.findMany({
          where: { id: { in: group.strainIds.filter((id) => id !== strainId) } },
        })
      : [];

    // Comparable strains: same species and overlapping attenuation, excluding
    // anything already listed as the same culture.
    const exclude = new Set([strainId, ...sameStrain.map((s) => s.id)]);
    const pool = await prisma.yeastStrain.findMany({ where: { species: strain.species } });
    const similar = pool
      .filter((s) => !exclude.has(s.id))
      .filter((s) => {
        if (strain.attenuationMax == null || s.attenuationMax == null) return false;
        return Math.abs((s.attenuationMax ?? 0) - (strain.attenuationMax ?? 0)) <= 6;
      })
      .filter((s) => s.uses.some((u) => strain.uses.includes(u)))
      .slice(0, 6);

    return {
      lineage: group ? { name: group.name, note: group.note } : null,
      sameStrain,
      similar,
    };
  },
  ["yeast-substitutes"],
  { revalidate: 3600 }
);
