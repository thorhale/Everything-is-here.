// Client-safe fermentation types and labels — no node:fs/path imports, so
// client components (the pitching workbench) can use them. lib/fermentation.ts
// (server-only, reads the JSON from disk) re-exports these.

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
