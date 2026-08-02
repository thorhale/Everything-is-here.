// Archive Intelligence — what 117,000 homebrewers actually did.
//
// The reference databases tell you what a style is SUPPOSED to be. This
// module tells you what people actually brewed, by aggregating the archived
// recipe corpus: per-style gravity/bitterness/colour distributions and the
// ingredients that really show up, with the share of recipes using each.
//
// Percentiles (not just means) matter here: the archive is user-submitted and
// contains outliers — a "Specialty Beer" at 1.180 OG will drag an average
// around, while the median and quartiles describe the real centre of practice.

import { prisma } from "@/lib/db";
import { unstable_cache } from "next/cache";
import { getRollups, styleIngredients, type IngredientUsage } from "@/lib/archive-rollups";

export interface StyleStatSummary {
  styleName: string;
  recipes: number;
  og: Percentiles | null;
  fg: Percentiles | null;
  ibu: Percentiles | null;
  srm: Percentiles | null;
  abv: Percentiles | null;
}

export interface Percentiles {
  p25: number;
  median: number;
  p75: number;
}

interface RawStyleStats {
  recipes: number;
  og_p25: number | null; og_med: number | null; og_p75: number | null;
  fg_p25: number | null; fg_med: number | null; fg_p75: number | null;
  ibu_p25: number | null; ibu_med: number | null; ibu_p75: number | null;
  srm_p25: number | null; srm_med: number | null; srm_p75: number | null;
  abv_p25: number | null; abv_med: number | null; abv_p75: number | null;
}

function pct(p25: number | null, med: number | null, p75: number | null): Percentiles | null {
  if (med == null) return null;
  return { p25: p25 ?? med, median: med, p75: p75 ?? med };
}

// Per-style distribution of the archive's own recorded stats.
export const getStyleStats = unstable_cache(
  async (styleName: string): Promise<StyleStatSummary | null> => {
    const rows = await prisma.$queryRaw<RawStyleStats[]>`
      SELECT count(*)::int AS recipes,
        percentile_cont(0.25) WITHIN GROUP (ORDER BY og)  FILTER (WHERE og IS NOT NULL)  AS og_p25,
        percentile_cont(0.50) WITHIN GROUP (ORDER BY og)  FILTER (WHERE og IS NOT NULL)  AS og_med,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY og)  FILTER (WHERE og IS NOT NULL)  AS og_p75,
        percentile_cont(0.25) WITHIN GROUP (ORDER BY fg)  FILTER (WHERE fg IS NOT NULL)  AS fg_p25,
        percentile_cont(0.50) WITHIN GROUP (ORDER BY fg)  FILTER (WHERE fg IS NOT NULL)  AS fg_med,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY fg)  FILTER (WHERE fg IS NOT NULL)  AS fg_p75,
        percentile_cont(0.25) WITHIN GROUP (ORDER BY ibu) FILTER (WHERE ibu IS NOT NULL) AS ibu_p25,
        percentile_cont(0.50) WITHIN GROUP (ORDER BY ibu) FILTER (WHERE ibu IS NOT NULL) AS ibu_med,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY ibu) FILTER (WHERE ibu IS NOT NULL) AS ibu_p75,
        percentile_cont(0.25) WITHIN GROUP (ORDER BY srm) FILTER (WHERE srm IS NOT NULL) AS srm_p25,
        percentile_cont(0.50) WITHIN GROUP (ORDER BY srm) FILTER (WHERE srm IS NOT NULL) AS srm_med,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY srm) FILTER (WHERE srm IS NOT NULL) AS srm_p75,
        percentile_cont(0.25) WITHIN GROUP (ORDER BY abv) FILTER (WHERE abv IS NOT NULL) AS abv_p25,
        percentile_cont(0.50) WITHIN GROUP (ORDER BY abv) FILTER (WHERE abv IS NOT NULL) AS abv_med,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY abv) FILTER (WHERE abv IS NOT NULL) AS abv_p75
      FROM "Recipe"
      WHERE "isHidden" = false AND "styleName" = ${styleName}`;
    const r = rows[0];
    if (!r || r.recipes === 0) return null;
    return {
      styleName,
      recipes: r.recipes,
      og: pct(r.og_p25, r.og_med, r.og_p75),
      fg: pct(r.fg_p25, r.fg_med, r.fg_p75),
      ibu: pct(r.ibu_p25, r.ibu_med, r.ibu_p75),
      srm: pct(r.srm_p25, r.srm_med, r.srm_p75),
      abv: pct(r.abv_p25, r.abv_med, r.abv_p75),
    };
  },
  ["archive-style-stats"],
  { revalidate: 3600 }
);

export type { IngredientUsage };

// The fermentables that actually appear in a style, ranked by how many of the
// style's recipes use them.
// Per-style ingredient usage. Precomputed by app/build-archive-rollups.mjs
// now that the junction tables have left Postgres — see
// docs/storage-efficiency.md, tier 3. Shape and ordering are unchanged: most
// used first, with the share of that style's recipes and the average amount.
export async function getStyleFermentables(styleName: string, limit = 10): Promise<IngredientUsage[]> {
  return styleIngredients("f", styleName, limit);
}

export async function getStyleHops(styleName: string, limit = 10): Promise<IngredientUsage[]> {
  return styleIngredients("h", styleName, limit);
}

export async function getStyleYeasts(styleName: string, limit = 8): Promise<IngredientUsage[]> {
  return styleIngredients("y", styleName, limit);
}

export const resolveArchiveStyle = unstable_cache(
  async (styleName: string): Promise<string | null> => {
    const exact = await prisma.recipe.findFirst({
      where: { isHidden: false, styleName: { equals: styleName, mode: "insensitive" } },
      select: { styleName: true },
    });
    if (exact?.styleName) return exact.styleName;
    // Fall back to the most-used archive style containing a meaningful token.
    const rows = await prisma.$queryRaw<{ styleName: string; c: number }[]>`
      SELECT "styleName", count(*)::int AS c
      FROM "Recipe"
      WHERE "isHidden" = false AND "styleName" IS NOT NULL
        AND ("styleName" ILIKE ${"%" + styleName + "%"} OR ${styleName} ILIKE '%' || "styleName" || '%')
      GROUP BY "styleName" ORDER BY count(*) DESC LIMIT 1`;
    return rows[0]?.styleName ?? null;
  },
  ["archive-style-resolve"],
  { revalidate: 3600 }
);

// --- Archive-wide leaderboards (the /archive insights page) ---------------

export const getArchiveOverview = unstable_cache(
  async () => {
    const [totals] = await prisma.$queryRaw<{ recipes: number; brewers: number; styles: number }[]>`
      SELECT (SELECT count(*)::int FROM "Recipe" WHERE "isHidden" = false) AS recipes,
             (SELECT count(*)::int FROM "Brewer") AS brewers,
             (SELECT count(DISTINCT "styleName")::int FROM "Recipe" WHERE "isHidden" = false AND "styleName" IS NOT NULL) AS styles`;
    return totals;
  },
  ["archive-overview"],
  { revalidate: 3600 }
);

export interface RankedStyle {
  styleName: string;
  recipes: number;
  medianOg: number | null;
  medianIbu: number | null;
  medianAbv: number | null;
}

export const getTopStyles = unstable_cache(
  async (limit = 25): Promise<RankedStyle[]> =>
    prisma.$queryRaw<RankedStyle[]>`
      SELECT "styleName",
             count(*)::int AS recipes,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY og)  FILTER (WHERE og IS NOT NULL)  AS "medianOg",
             percentile_cont(0.5) WITHIN GROUP (ORDER BY ibu) FILTER (WHERE ibu IS NOT NULL) AS "medianIbu",
             percentile_cont(0.5) WITHIN GROUP (ORDER BY abv) FILTER (WHERE abv IS NOT NULL) AS "medianAbv"
      FROM "Recipe"
      WHERE "isHidden" = false AND "styleName" IS NOT NULL
      GROUP BY "styleName"
      ORDER BY count(*) DESC
      LIMIT ${limit}`,
  ["archive-top-styles"],
  { revalidate: 3600 }
);

export interface RankedIngredient {
  name: string;
  recipes: number;
}

export async function getTopIngredients(limit = 20) {
  const r = await getRollups();
  const rank = (m: Record<string, number>): RankedIngredient[] =>
    Object.entries(m)
      .map(([name, recipes]) => ({ name, recipes }))
      .sort((a, b) => b.recipes - a.recipes)
      .slice(0, limit);
  return {
    hops: rank(r.recipeCounts.hop),
    fermentables: rank(r.recipeCounts.fermentable),
    yeasts: rank(r.recipeCounts.yeast),
  };
}

// How the archive's real distribution compares to a guideline's published
// range: the share of archived examples that actually fall inside spec.
export async function conformancePct(
  styleName: string,
  field: "og" | "fg" | "ibu" | "srm" | "abv",
  min: number,
  max: number
): Promise<number | null> {
  const col = { og: "og", fg: "fg", ibu: "ibu", srm: "srm", abv: "abv" }[field];
  const rows = await prisma.$queryRawUnsafe<{ inside: number; total: number }[]>(
    `SELECT count(*) FILTER (WHERE "${col}" BETWEEN $2 AND $3)::int AS inside,
            count(*) FILTER (WHERE "${col}" IS NOT NULL)::int AS total
     FROM "Recipe" WHERE "isHidden" = false AND "styleName" = $1`,
    styleName, min, max
  );
  const r = rows[0];
  if (!r || r.total === 0) return null;
  return Math.round((r.inside / r.total) * 100);
}
