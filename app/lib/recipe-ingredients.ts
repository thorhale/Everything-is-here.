import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";

// The recipe archive's ingredient detail, read from gzipped static shards
// instead of Postgres junction tables. See docs/storage-efficiency.md, tier 3.
//
// Why this is the right shape: the archive is read-only and never changes, and
// the detail page reads exactly one recipe at a time. Held as rows, that was
// 1,092,461 records costing 270 MB — of which only ~98 MB was ingredient data
// and the rest was per-row overhead and indexes. Held as gzipped shards it is
// 14 MB, because gzip sees a whole shard at once and finds the repetition that
// Postgres could not (every value is far below the ~2 KB TOAST threshold, so
// the database never compressed any of it).
//
// Rows are arrays, not objects, so the field names are not repeated a million
// times. The column order below must match export-recipe-ingredients.mjs.

const SHARDS = 1024;
const DIR = join(process.cwd(), "..", "data", "recipes", "ingredients");

/** Which shard a slug lives in. Must match the exporter exactly. */
export function shardFor(slug: string): number {
  const h = createHash("sha1").update(slug).digest();
  return ((h[0] << 2) | (h[1] >> 6)) % SHARDS;
}

export interface RecipeFermentableRow {
  name: string | null;
  amountDisplay: string | null;
  amountLb: number | null;
  percent: string | null;
  maltster: string | null;
  use: string | null;
  ppg: number | null;
  colorLovibond: number | null;
  refId: number | null;
}
export interface RecipeHopRow {
  name: string | null;
  amountDisplay: string | null;
  amountOz: number | null;
  timeDisplay: string | null;
  timeMinutes: number | null;
  use: string | null;
  form: string | null;
  alphaAcidPct: number | null;
  refId: number | null;
}
export interface RecipeYeastRow {
  name: string | null;
  labProduct: string | null;
  attenuationPct: number | null;
  refId: number | null;
}
export interface RecipeMiscRow {
  name: string | null;
  amount: string | null;
  use: string | null;
  time: string | null;
}

export interface RecipeIngredients {
  fermentables: RecipeFermentableRow[];
  hops: RecipeHopRow[];
  yeasts: RecipeYeastRow[];
  miscs: RecipeMiscRow[];
}

const EMPTY: RecipeIngredients = { fermentables: [], hops: [], yeasts: [], miscs: [] };

type Packed = { f?: unknown[][]; h?: unknown[][]; y?: unknown[][]; m?: unknown[][] };

// One decompressed shard per process, kept between requests. A shard is ~70 KB
// of JSON, and recipes in the same shard are unrelated, so this is a small
// bounded cache rather than a growing one.
const cache = new Map<number, Record<string, Packed>>();

async function loadShard(n: number): Promise<Record<string, Packed>> {
  const hit = cache.get(n);
  if (hit) return hit;
  let parsed: Record<string, Packed> = {};
  try {
    const gz = await readFile(join(DIR, `${n.toString(16).padStart(3, "0")}.json.gz`));
    parsed = JSON.parse(gunzipSync(gz).toString("utf8"));
  } catch {
    parsed = {};
  }
  // Bound the cache so a crawler hitting many recipes cannot grow it without
  // limit. 32 shards is ~2 MB decompressed.
  if (cache.size >= 32) cache.clear();
  cache.set(n, parsed);
  return parsed;
}

const s = (v: unknown): string | null => (typeof v === "string" ? v : v == null ? null : String(v));
const n = (v: unknown): number | null => (typeof v === "number" ? v : v == null ? null : Number(v));

export async function getRecipeIngredients(slug: string): Promise<RecipeIngredients> {
  const shard = await loadShard(shardFor(slug));
  const e = shard[slug];
  if (!e) return EMPTY;
  return {
    fermentables: (e.f ?? []).map((r) => ({
      name: s(r[0]), amountDisplay: s(r[1]), amountLb: n(r[2]), percent: s(r[3]),
      maltster: s(r[4]), use: s(r[5]), ppg: n(r[6]), colorLovibond: n(r[7]), refId: n(r[8]),
    })),
    hops: (e.h ?? []).map((r) => ({
      name: s(r[0]), amountDisplay: s(r[1]), amountOz: n(r[2]), timeDisplay: s(r[3]),
      timeMinutes: n(r[4]), use: s(r[5]), form: s(r[6]), alphaAcidPct: n(r[7]), refId: n(r[8]),
    })),
    yeasts: (e.y ?? []).map((r) => ({
      name: s(r[0]), labProduct: s(r[1]), attenuationPct: n(r[2]), refId: n(r[3]),
    })),
    miscs: (e.m ?? []).map((r) => ({
      name: s(r[0]), amount: s(r[1]), use: s(r[2]), time: s(r[3]),
    })),
  };
}
