// Offline-first picker lists for the calculators.
//
// These are the same four lists the calculator pages used to fetch from Neon,
// baked into the bundle at build time by app/build-picker-data.mjs. Importing
// from here instead of the async DB helpers means the calculators run with no
// query and no network — the server-cost fix and the offline capability in one.
//
// The data changes only when a loader runs; regenerate with
// `node build-picker-data.mjs` and the diff to lib/generated/picker-data.json
// is committed alongside the data change.
import data from "@/lib/generated/picker-data.json";
import type { FermentablePick, HopPick } from "@/lib/ingredients-curated";
import type { StrainPick } from "@/lib/yeasts-curated";
import type { WaterPick } from "@/lib/water";

export const fermentablePicks: FermentablePick[] = data.fermentables as FermentablePick[];
export const hopPicks: HopPick[] = data.hops as HopPick[];
export const strainPicks: StrainPick[] = data.strains as StrainPick[];
export const waterPicks: WaterPick[] = data.waters as WaterPick[];
