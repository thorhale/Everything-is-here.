import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { unstable_cache } from "next/cache";

// Typed access to data/fermentation/archetypes.json — how yeast/fermentation is
// handled by archetype, mapped from the guideline categories. Read from disk
// (like the source registry) because it is committed data, not database state.
// Numeric figures are present only where a world-class professional source is
// cited; the rest are described with researchStatus "pending".

export interface FermentationStandard {
  metric: string;
  value?: number;
  rangeLow?: number;
  rangeHigh?: number;
  targetViableCellsPerMl?: number;
  rehydrateTempCLow?: number;
  rehydrateTempCHigh?: number;
  note?: string;
  sourceUrl?: string;
}

export type Inoculation = "cultured" | "starter-culture" | "spontaneous" | "none";

export interface Archetype {
  id: string;
  label: string;
  family: string;
  inoculation: Inoculation;
  saccharification: string;
  organisms: string[];
  approach: string;
  standard?: FermentationStandard;
  specialHandling?: string[];
  comparison?: string;
  researchStatus: "sourced" | "pending";
  sourceUrl?: string;
}

export const INOCULATION_LABEL: Record<Inoculation, string> = {
  cultured: "Pitched cultured yeast",
  "starter-culture": "Starter culture (kōji / qū / nuruk / ragi / SCOBY)",
  spontaneous: "Spontaneous (wild, no pitch)",
  none: "No yeast added",
};

export const getArchetypes = unstable_cache(
  async (): Promise<Archetype[]> => {
    try {
      const raw = await readFile(join(process.cwd(), "..", "data", "fermentation", "archetypes.json"), "utf8");
      return (JSON.parse(raw).archetypes ?? []) as Archetype[];
    } catch {
      return [];
    }
  },
  ["fermentation-archetypes-v1"],
  { revalidate: 3600 }
);

export async function getArchetype(id: string): Promise<Archetype | null> {
  const all = await getArchetypes();
  return all.find((a) => a.id === id) ?? null;
}
