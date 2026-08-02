import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { unstable_cache } from "next/cache";
import type { Archetype } from "./fermentation-types";

// Server-side access to data/fermentation/archetypes.json — how
// yeast/fermentation is handled by archetype, mapped from the guideline
// categories. Read from disk (like the source registry) because it is committed
// data, not database state. Numeric figures are present only where a
// world-class professional source is cited; the rest are described with
// researchStatus "pending". Types and labels live in ./fermentation-types so
// client components can import them without pulling in node:fs.
export type {
  Archetype,
  FermentationStandard,
  Inoculation,
} from "./fermentation-types";
export { INOCULATION_LABEL } from "./fermentation-types";

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

// Resolve the fermentation archetype for a guideline category by the same key
// the database uses (editionId + category code), via the static map generated
// by build-archetype-usage.mjs. No DB column required.
export async function getArchetypeForCategory(
  editionId: string,
  code: string | null | undefined
): Promise<Archetype | null> {
  if (!code) return null;
  const { default: catMap } = await import("./generated/category-archetype.json");
  const id = (catMap as Record<string, string>)[`${editionId}|${code}`];
  return id ? getArchetype(id) : null;
}
