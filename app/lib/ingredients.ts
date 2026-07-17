import { prisma } from "@/lib/db";
import { unstable_cache } from "next/cache";

// The original site's Styles & Ingredients reference databases weren't
// archived in scrapable form, so these rebuild them by aggregating the
// ingredient rows of every archived recipe: each hop varietal, yeast type,
// fermentable, and maltster, with usage counts and typical specs.

export const getHopVarietals = unstable_cache(
  async () =>
    prisma.$queryRaw<{ name: string; uses: number; alpha: number | null }[]>`
      SELECT "name", count(*)::int AS uses,
             round(avg("alphaAcidPct")::numeric, 1)::float AS alpha
      FROM "RecipeHop"
      WHERE "name" IS NOT NULL AND "name" <> ''
      GROUP BY "name"
      HAVING count(*) >= 5
      ORDER BY count(*) DESC
      LIMIT 500`,
  ["hop-varietals"],
  { revalidate: 3600 }
);

export const getYeastTypes = unstable_cache(
  async () =>
    prisma.$queryRaw<
      { name: string; uses: number; attenuation: number | null; labs: string | null }[]
    >`
      SELECT "name", count(*)::int AS uses,
             round(avg("attenuationPct")::numeric, 1)::float AS attenuation,
             string_agg(DISTINCT "labProduct", ', ') FILTER (WHERE "labProduct" IS NOT NULL) AS labs
      FROM "RecipeYeast"
      WHERE "name" IS NOT NULL AND "name" <> ''
      GROUP BY "name"
      HAVING count(*) >= 5
      ORDER BY count(*) DESC
      LIMIT 500`,
  ["yeast-types"],
  { revalidate: 3600 }
);

export const getFermentables = unstable_cache(
  async () =>
    prisma.$queryRaw<
      { name: string; uses: number; ppg: number | null; color: number | null; maltsters: string | null }[]
    >`
      SELECT "name", count(*)::int AS uses,
             round(avg("ppg")::numeric, 0)::float AS ppg,
             round(avg("colorLovibond")::numeric, 0)::float AS color,
             string_agg(DISTINCT "maltster", ', ')
               FILTER (WHERE "maltster" IS NOT NULL AND "maltster" <> 'Any') AS maltsters
      FROM "RecipeFermentable"
      WHERE "name" IS NOT NULL AND "name" <> ''
      GROUP BY "name"
      HAVING count(*) >= 5
      ORDER BY count(*) DESC
      LIMIT 500`,
  ["fermentables"],
  { revalidate: 3600 }
);

export const getMaltsters = unstable_cache(
  async () =>
    prisma.$queryRaw<{ maltster: string; uses: number; products: number }[]>`
      SELECT "maltster", count(*)::int AS uses, count(DISTINCT "name")::int AS products
      FROM "RecipeFermentable"
      WHERE "maltster" IS NOT NULL AND "maltster" <> '' AND "maltster" <> 'Any'
      GROUP BY "maltster"
      HAVING count(*) >= 5
      ORDER BY count(*) DESC
      LIMIT 100`,
  ["maltsters"],
  { revalidate: 3600 }
);

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

// Recent recipes using a given ingredient (for the detail pages)
export async function recipesUsingHop(name: string, take = 25) {
  return prisma.recipe.findMany({
    where: { isHidden: false, hops: { some: { name } } },
    orderBy: { scrapedAt: "desc" },
    take,
    include: { brewer: true },
  });
}

export async function recipesUsingYeast(name: string, take = 25) {
  return prisma.recipe.findMany({
    where: { isHidden: false, yeasts: { some: { name } } },
    orderBy: { scrapedAt: "desc" },
    take,
    include: { brewer: true },
  });
}

export async function recipesUsingFermentable(name: string, take = 25) {
  return prisma.recipe.findMany({
    where: { isHidden: false, fermentables: { some: { name } } },
    orderBy: { scrapedAt: "desc" },
    take,
    include: { brewer: true },
  });
}
