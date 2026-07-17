import { prisma } from "@/lib/db";
import { unstable_cache } from "next/cache";

// BrewToad drew a shaded "expected range" band for the recipe's style behind
// each stat marker, from its styles database. That database wasn't archived
// in a scrapable form, so we recreate the bands empirically: the 10th-90th
// percentile of each stat across every archived recipe of the same style.
export interface StyleRanges {
  og: [number, number] | null;
  fg: [number, number] | null;
  ibu: [number, number] | null;
  srm: [number, number] | null;
  abv: [number, number] | null;
}

interface RangeRow {
  n: number;
  og_lo: number | null; og_hi: number | null;
  fg_lo: number | null; fg_hi: number | null;
  ibu_lo: number | null; ibu_hi: number | null;
  srm_lo: number | null; srm_hi: number | null;
  abv_lo: number | null; abv_hi: number | null;
}

const MIN_SAMPLE = 20;

export const getStyleRanges = unstable_cache(
  async (styleName: string): Promise<StyleRanges | null> => {
    const rows = await prisma.$queryRaw<RangeRow[]>`
      SELECT count(*)::int AS n,
        percentile_cont(0.1) WITHIN GROUP (ORDER BY "og")  AS og_lo,
        percentile_cont(0.9) WITHIN GROUP (ORDER BY "og")  AS og_hi,
        percentile_cont(0.1) WITHIN GROUP (ORDER BY "fg")  AS fg_lo,
        percentile_cont(0.9) WITHIN GROUP (ORDER BY "fg")  AS fg_hi,
        percentile_cont(0.1) WITHIN GROUP (ORDER BY "ibu") AS ibu_lo,
        percentile_cont(0.9) WITHIN GROUP (ORDER BY "ibu") AS ibu_hi,
        percentile_cont(0.1) WITHIN GROUP (ORDER BY "srm") AS srm_lo,
        percentile_cont(0.9) WITHIN GROUP (ORDER BY "srm") AS srm_hi,
        percentile_cont(0.1) WITHIN GROUP (ORDER BY "abv") AS abv_lo,
        percentile_cont(0.9) WITHIN GROUP (ORDER BY "abv") AS abv_hi
      FROM "Recipe"
      WHERE "styleName" = ${styleName} AND "isHidden" = false`;
    const r = rows[0];
    if (!r || r.n < MIN_SAMPLE) return null;
    const pair = (lo: number | null, hi: number | null): [number, number] | null =>
      lo != null && hi != null && hi > lo ? [Number(lo), Number(hi)] : null;
    return {
      og: pair(r.og_lo, r.og_hi),
      fg: pair(r.fg_lo, r.fg_hi),
      ibu: pair(r.ibu_lo, r.ibu_hi),
      srm: pair(r.srm_lo, r.srm_hi),
      abv: pair(r.abv_lo, r.abv_hi),
    };
  },
  ["style-ranges"],
  { revalidate: 3600 }
);
