// Brewing water chemistry helpers, over the WaterProfile catalog.
//
// A brewing water profile is six ions in ppm (mg/L): calcium, magnesium,
// sodium, chloride, sulfate, and bicarbonate. From those, brewers care about
// two derived numbers:
//   - Residual Alkalinity (RA): how much the water pushes mash pH up. High RA
//     needs dark, acidic malts to balance — which is exactly why dark-beer
//     cities (Dublin, Munich) have high-RA water and pale-beer cities (Pilsen)
//     have almost none.
//   - Sulfate:chloride ratio: the classic "hoppy vs malty" balance lever.
//     Sulfate accentuates hop bitterness/dryness; chloride accentuates malt
//     fullness/sweetness.

import { prisma } from "@/lib/db";
import { unstable_cache } from "next/cache";
import type { WaterProfile } from "@prisma/client";

export type { WaterProfile };

// Residual alkalinity in ppm as CaCO3 (Kolbach). Alkalinity from bicarbonate,
// minus the pH-lowering effect of calcium and magnesium hardness.
export function residualAlkalinity(w: {
  calcium?: number | null;
  magnesium?: number | null;
  bicarbonate?: number | null;
}): number | null {
  if (w.bicarbonate == null && w.calcium == null && w.magnesium == null) return null;
  const alkalinity = (w.bicarbonate ?? 0) * (50 / 61); // HCO3 ppm -> ppm as CaCO3
  const ca = w.calcium ?? 0;
  const mg = w.magnesium ?? 0;
  return Math.round(alkalinity - (ca / 1.4 + mg / 1.7));
}

// Total hardness in ppm as CaCO3.
export function totalHardness(w: { calcium?: number | null; magnesium?: number | null }): number | null {
  if (w.calcium == null && w.magnesium == null) return null;
  return Math.round((w.calcium ?? 0) * 2.497 + (w.magnesium ?? 0) * 4.118);
}

export interface SulfateChloride {
  ratio: number | null;
  balance: string; // human label
}

export function sulfateChloride(w: { sulfate?: number | null; chloride?: number | null }): SulfateChloride {
  const so4 = w.sulfate ?? 0;
  const cl = w.chloride ?? 0;
  if (cl <= 0 && so4 <= 0) return { ratio: null, balance: "—" };
  if (cl <= 0) return { ratio: Infinity, balance: "very hoppy / dry" };
  const ratio = so4 / cl;
  let balance: string;
  if (ratio >= 2) balance = "hoppy / dry";
  else if (ratio >= 1.3) balance = "balanced-hoppy";
  else if (ratio >= 0.8) balance = "balanced";
  else if (ratio >= 0.5) balance = "balanced-malty";
  else balance = "malty / full";
  return { ratio: Math.round(ratio * 100) / 100, balance };
}

export const getWaterProfiles = unstable_cache(
  async () => prisma.waterProfile.findMany({ orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }] }),
  ["water-profiles"],
  { revalidate: 3600 }
);

export async function getWaterProfile(id: string): Promise<WaterProfile | null> {
  const all = await getWaterProfiles();
  return all.find((w) => w.id === decodeURIComponent(id)) ?? null;
}

export async function getWaterByKind(): Promise<Record<string, WaterProfile[]>> {
  const all = await getWaterProfiles();
  const out: Record<string, WaterProfile[]> = {};
  for (const w of all) (out[w.kind] ??= []).push(w);
  return out;
}

export interface WaterPick {
  id: string;
  name: string;
  kind: string;
  calcium: number;
  magnesium: number;
  sodium: number;
  chloride: number;
  sulfate: number;
  bicarbonate: number;
}

// Compact list for the recipe builder's client-side water panel.
export const getWaterPickerList = unstable_cache(
  async (): Promise<WaterPick[]> => {
    const all = await getWaterProfiles();
    return all.map((w) => ({
      id: w.id,
      name: w.name,
      kind: w.kind,
      calcium: w.calcium ?? 0,
      magnesium: w.magnesium ?? 0,
      sodium: w.sodium ?? 0,
      chloride: w.chloride ?? 0,
      sulfate: w.sulfate ?? 0,
      bicarbonate: w.bicarbonate ?? 0,
    }));
  },
  ["water-picker-list"],
  { revalidate: 3600 }
);

// Suggest a style-target water profile for a beer from its colour (SRM) and
// style name. Hop-forward and hazy styles override the colour-based default.
export function suggestWaterTargetId(srm: number | null, styleName: string | null): string {
  const s = (styleName ?? "").toLowerCase();
  if (/hazy|new england|neipa|juicy/.test(s)) return "target-hazy-juicy";
  if (/ipa|pale ale|west coast|bitter/.test(s)) return "target-yellow-hoppy";
  if (/dry stout|irish stout|foreign extra/.test(s)) return "target-black-roasty-bitter";
  const c = srm ?? 5;
  if (c < 8) return "target-yellow-balanced";
  if (c < 17) return "target-amber-balanced";
  if (c < 30) return "target-brown-balanced";
  return "target-black-balanced";
}
