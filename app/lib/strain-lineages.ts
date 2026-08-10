import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { unstable_cache } from "next/cache";

// Which commercial products are the same underlying yeast. Chico is sold as
// WLP001, Wyeast 1056, SafAle US-05 and Omega OYL-004 at once, so a brewer
// holding one of them is holding all four.
//
// Built by app/build-strain-lineages.mjs from the producers' own product
// descriptions — the same manufacturer tech sheets this project already cites
// for every strain. Each membership carries the sentence that asserts it and
// the URL it came from, so a reader can check the claim rather than trust it.

export interface LineageMember {
  strainId: string;
  productCode: string | null;
  name: string;
  lab: string | null;
  labId: string | null;
  labCountry: string | null;
  form: string | null;
  species: string | null;
  /** The producer's own sentence naming the lineage. */
  statedBy: string;
  sourceUrl: string | null;
}

export interface Lineage {
  id: string;
  label: string;
  note: string;
  members: LineageMember[];
}

export const getLineages = unstable_cache(
  async (): Promise<Lineage[]> => {
    try {
      const raw = await readFile(join(process.cwd(), "..", "data", "yeasts", "derived", "lineages.json"), "utf8");
      return (JSON.parse(raw).groups ?? []) as Lineage[];
    } catch {
      return [];
    }
  },
  ["strain-lineages-v1"],
  { revalidate: 3600 }
);

/** The lineage a strain belongs to, or null if it stands alone. */
export async function lineageForStrain(strainId: string): Promise<Lineage | null> {
  const all = await getLineages();
  return all.find((g) => g.members.some((m) => m.strainId === strainId)) ?? null;
}

/** The other products that are the same yeast as this one. */
export async function equivalentsOf(strainId: string): Promise<LineageMember[]> {
  const g = await lineageForStrain(strainId);
  return g ? g.members.filter((m) => m.strainId !== strainId) : [];
}
