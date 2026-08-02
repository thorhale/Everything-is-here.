import { prisma } from "@/lib/db";
import { unstable_cache } from "next/cache";
import { getRollups, recipeIdsUsing } from "@/lib/archive-rollups";

// The original site's Styles & Ingredients reference databases weren't
// archived in scrapable form, so these rebuild them by aggregating the
// ingredient rows of every archived recipe: each hop varietal, yeast type,
// fermentable, and maltster, with usage counts and typical specs.
//
// Those aggregates are no longer computed in SQL. The ingredient junction
// tables left Postgres (docs/storage-efficiency.md, tier 3), so the same
// figures are precomputed by app/build-archive-rollups.mjs and read from a
// 1 MB gzipped file. No unstable_cache wrapper is needed any more — the data
// is a static file, decompressed once per process, so there is nothing to
// revalidate.

export async function getHopVarietals() {
  return (await getRollups()).hopVarietals;
}

export async function getYeastTypes() {
  return (await getRollups()).yeastTypes;
}

export async function getFermentables() {
  return (await getRollups()).fermentables;
}

export async function getMaltsters() {
  return (await getRollups()).maltsters;
}

export const getStyles = unstable_cache(
  async () =>
    prisma.recipe.groupBy({
      by: ["styleName"],
      where: { isHidden: false, styleName: { not: null } },
      _count: true,
      orderBy: { _count: { styleName: "desc" } },
    }),
  ["all-styles"],
  { revalidate: 3600 }
);

// Recent recipes using a given ingredient (for the detail pages). The
// ingredient -> recipe ids mapping comes from the rollups; the recipes
// themselves are still rows in Postgres.
async function recipesByIds(ids: string[]) {
  if (!ids.length) return [];
  const rows = await prisma.recipe.findMany({
    where: { id: { in: ids }, isHidden: false },
    include: { brewer: true },
  });
  // Preserve the rollup's ordering (most recently scraped first).
  const rank = new Map(ids.map((id, i) => [id, i]));
  return rows.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
}

export async function recipesUsingHop(name: string, take = 25) {
  return recipesByIds(await recipeIdsUsing("hop", name, take));
}

export async function recipesUsingYeast(name: string, take = 25) {
  return recipesByIds(await recipeIdsUsing("yeast", name, take));
}

export async function recipesUsingFermentable(name: string, take = 25) {
  return recipesByIds(await recipeIdsUsing("fermentable", name, take));
}
