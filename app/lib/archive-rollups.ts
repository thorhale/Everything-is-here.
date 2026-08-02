import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

// Precomputed aggregates over the recipe archive's ingredients, replacing the
// cross-recipe SQL that used to run against the junction tables. Built by
// app/build-archive-rollups.mjs. See docs/storage-efficiency.md, tier 3.
//
// Freshness costs nothing here: every query this replaces was already wrapped
// in unstable_cache with a 1-hour revalidate, because the archive is static —
// BrewToad shut down in 2018 and the data has not changed since.

export interface NamedUse { name: string; uses: number }
export interface HopVarietal extends NamedUse { alpha: number | null }
export interface YeastType extends NamedUse { attenuation: number | null; labs: string | null }
export interface FermentableRollup extends NamedUse { ppg: number | null; color: number | null; maltsters: string | null }
export interface MaltsterRollup { maltster: string; uses: number; products: number }
/** [name, recipes, sharePct, avgAmount] */
type StyleRow = [string, number, number, number | null];

export interface ArchiveRollups {
  generated: string;
  hopVarietals: HopVarietal[];
  yeastTypes: YeastType[];
  fermentables: FermentableRollup[];
  maltsters: MaltsterRollup[];
  recipeCounts: Record<"hop" | "fermentable" | "yeast", Record<string, number>>;
  styleTotals: Record<string, number>;
  styles: Record<string, { f?: StyleRow[]; h?: StyleRow[]; y?: StyleRow[] }>;
  usedBy: Record<"hop" | "fermentable" | "yeast", Record<string, string[]>>;
}

const EMPTY: ArchiveRollups = {
  generated: "", hopVarietals: [], yeastTypes: [], fermentables: [], maltsters: [],
  recipeCounts: { hop: {}, fermentable: {}, yeast: {} },
  styleTotals: {}, styles: {}, usedBy: { hop: {}, fermentable: {}, yeast: {} },
};

let cached: ArchiveRollups | null = null;

/** The whole rollup set. ~1 MB gzipped, decompressed once per process. */
export async function getRollups(): Promise<ArchiveRollups> {
  if (cached) return cached;
  try {
    const gz = await readFile(join(process.cwd(), "..", "data", "recipes", "archive-rollups.json.gz"));
    cached = JSON.parse(gunzipSync(gz).toString("utf8")) as ArchiveRollups;
  } catch {
    cached = EMPTY;
  }
  return cached;
}

export interface IngredientUsage {
  name: string;
  recipes: number;
  sharePct: number;
  avgAmount: number | null;
}

const toUsage = (rows: StyleRow[] | undefined, limit: number): IngredientUsage[] =>
  (rows ?? []).slice(0, limit).map(([name, recipes, sharePct, avgAmount]) => ({
    name, recipes, sharePct, avgAmount,
  }));

export async function styleIngredients(
  kind: "f" | "h" | "y",
  styleName: string,
  limit: number
): Promise<IngredientUsage[]> {
  const r = await getRollups();
  return toUsage(r.styles[styleName]?.[kind], limit);
}

export async function recipeIdsUsing(
  kind: "hop" | "fermentable" | "yeast",
  name: string,
  take = 25
): Promise<string[]> {
  const r = await getRollups();
  return (r.usedBy[kind]?.[name] ?? []).slice(0, take);
}
