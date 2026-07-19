// Structured yeast propagation & pitching guidance, transcribed from the
// Maltose Falcons club article "Yeast Propagation and Maintenance: Principles
// and Practices". This is the reference data the pitching calculator's starter
// model is calibrated against (see lib/pitching/formulas.ts and
// docs/pitching-formulas.md), surfaced here as structured, sourced data
// alongside the strain catalog. Figures are the article's; nothing invented.

export const PROPAGATION_SOURCE = {
  name: "Maltose Falcons — Yeast Propagation and Maintenance: Principles and Practices",
  url: "https://www.maltosefalcons.com/blogs/brewing-techniques-tips/yeast-propagation-and-maintenance-principles-and-practices",
};

// --- Pitching-rate targets ------------------------------------------------
// Million cells per mL of wort. The article gives ranges plus a gravity
// adjustment (higher gravity -> pitch toward the top of the range).
export const PITCH_RATE_TARGETS = [
  { key: "ale", label: "Ales", minMl: 6, maxMl: 10, note: "~0.75 M/mL/°P; pitch higher for high-gravity worts" },
  { key: "lager", label: "Lagers", minMl: 10, maxMl: 15, note: "~1.5 M/mL/°P; pitch higher for high-gravity worts" },
] as const;

// Worked example from the article: a 1.096 OG ale wants ~14–20 M/mL.
export const PITCH_RATE_EXAMPLE = "A 1.096 OG ale calls for roughly 14–20 million cells/mL.";

// --- Package viability ----------------------------------------------------
export const PACKAGE_VIABILITY = [
  {
    kind: "Dry yeast",
    detail: "≈620 million cells/mL rehydrated in 200 mL",
    totalCellsB: 124,
    viabilityPct: 80,
    note: "A single 5 g sachet supplies ~124 billion cells at ~80% viability — often enough for a standard ale without a starter.",
  },
  {
    kind: "Liquid yeast (single smack-pack, unpropagated)",
    detail: "≈60 million cells/mL in ~50 mL",
    totalCellsB: 3,
    viabilityPct: 25,
    note: "Illustrates why liquid packs usually need a starter: relatively few truly viable cells.",
  },
] as const;

// --- Starter agitation methods -------------------------------------------
// Final cell density each method reaches, measured in the article's 500 mL
// starters. These densities are what distinguish the methods in the pitching
// calculator (STARTER_MAX_DENSITY in lib/pitching/formulas.ts).
export interface StarterMethodGuidance {
  key: string;
  name: string;
  densityMlMin: number; // million cells / mL
  densityMlMax: number;
  per500mlMinB: number; // billion cells in a 500 mL starter
  per500mlMaxB: number;
  note?: string;
}

export const STARTER_METHODS: StarterMethodGuidance[] = [
  {
    key: "none",
    name: "No agitation (airlocked)",
    densityMlMin: 12,
    densityMlMax: 24,
    per500mlMinB: 6,
    per500mlMaxB: 12,
    note: "Continuous stirring yields ~10–15× more cells than an airlocked starter, so an unstirred starter grows comparatively little.",
  },
  { key: "shaking", name: "Intermittent shaking", densityMlMin: 60, densityMlMax: 60, per500mlMinB: 30, per500mlMaxB: 30 },
  { key: "aeration", name: "Continuous aeration", densityMlMin: 92, densityMlMax: 92, per500mlMinB: 46, per500mlMaxB: 46 },
  {
    key: "stirPlate",
    name: "Continuous stirring (stir plate)",
    densityMlMin: 180,
    densityMlMax: 360,
    per500mlMinB: 90,
    per500mlMaxB: 180,
    note: "The most productive method; 10–15× the cell count of an airlocked starter.",
  },
];

// --- Starter make-up + conditions ----------------------------------------
export const STARTER_CONDITIONS = {
  gravity: 1.04, // ~1.040 OG wort
  dmePerLiterG: 100, // ≈ 100 g DME per litre for ~1.040
  nutrientPerLiterG: 10, // ~1/2 tsp (~10 g) yeast nutrient per litre
  propagationTempF: 77,
  propagationTempC: 25,
  lagerNote: "Propagate lager strains in the mid-70s °F.",
  o2: { aleMinPpm: 8, aleMaxPpm: 12, lagerMinPpm: 10, lagerMaxPpm: 15 },
} as const;

// --- Viability over storage ----------------------------------------------
// The article frames viability primarily as the packaged/viable fraction
// above (dry ~80%, an unpropagated liquid pack ~25%) rather than a single
// decline rate. Time-based decline for the pitching calculator uses the
// vendor models documented in docs/pitching-formulas.md (Mr Malty ~0.7%/day,
// Wyeast ~20%/month, White Labs' slower linear decline), noted here so the
// two sources aren't conflated.
export const VIABILITY_NOTE =
  "The Maltose Falcons figures describe how many cells in a package are viable (dry ≈80%, an unpropagated liquid pack ≈25%). Time-based viability decline in the pitching calculator uses vendor models (Mr Malty ~0.7%/day, Wyeast ~20%/month, White Labs slower) — see the pitching-formula notes.";
