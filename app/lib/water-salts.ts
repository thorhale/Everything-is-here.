// Brewing salt additions: moving source water toward a target profile.
//
// Each brewing salt contributes a known amount of specific ions. The figures
// below are ppm (mg/L) added by dissolving ONE GRAM of the salt in ONE LITRE
// of water, derived from molar masses (e.g. gypsum CaSO4·2H2O, MW 172.17:
// calcium is 40.08/172.17 = 23.28% by mass, so 1 g/L adds 232.8 ppm Ca).
// Divide by 3.78541 to get the more familiar "per gram per US gallon" values
// (gypsum → 61.5 ppm Ca, matching every brewing reference).
//
// Salts can only ADD ions. Lowering an ion means diluting with RO/distilled
// water; lowering alkalinity means acid, not salt. This module is honest about
// that: the "suggest" solver never pretends it can subtract.

export const IonKeys = ["calcium", "magnesium", "sodium", "chloride", "sulfate", "bicarbonate"] as const;
export type IonKey = (typeof IonKeys)[number];
export type Ions = Record<IonKey, number>;

export interface SaltDef {
  key: string;
  name: string;
  formula: string;
  // ppm added per gram dissolved per litre of water.
  perGramPerLiter: Partial<Ions>;
  note?: string;
}

export const SALTS: SaltDef[] = [
  { key: "gypsum", name: "Gypsum", formula: "CaSO₄·2H₂O", perGramPerLiter: { calcium: 232.8, sulfate: 557.7 } },
  { key: "calciumChloride", name: "Calcium Chloride", formula: "CaCl₂·2H₂O", perGramPerLiter: { calcium: 272.6, chloride: 482.3 }, note: "Dihydrate. The flaked form is hygroscopic — weigh fresh." },
  { key: "epsom", name: "Epsom Salt", formula: "MgSO₄·7H₂O", perGramPerLiter: { magnesium: 98.6, sulfate: 389.7 } },
  { key: "tableSalt", name: "Table Salt", formula: "NaCl", perGramPerLiter: { sodium: 393.4, chloride: 606.5 }, note: "Use non-iodised, anti-caking-free canning/pickling salt." },
  { key: "bakingSoda", name: "Baking Soda", formula: "NaHCO₃", perGramPerLiter: { sodium: 273.7, bicarbonate: 726.4 } },
  { key: "chalk", name: "Chalk", formula: "CaCO₃", perGramPerLiter: { calcium: 400.4, bicarbonate: 610.0 }, note: "Dissolves poorly in water — only really goes into solution in the acidic mash, and even then unreliably. Prefer baking soda for alkalinity." },
];

export const LITERS_PER_GALLON = 3.785411784;

export function zeroIons(): Ions {
  return { calcium: 0, magnesium: 0, sodium: 0, chloride: 0, sulfate: 0, bicarbonate: 0 };
}

// Resulting ion profile from a source water plus salt additions (grams) in a
// given water volume (litres).
export function applySalts(source: Partial<Ions>, gramsBySalt: Record<string, number>, volumeL: number): Ions {
  const out: Ions = { ...zeroIons(), ...source } as Ions;
  if (volumeL <= 0) return out;
  for (const salt of SALTS) {
    const g = gramsBySalt[salt.key] ?? 0;
    if (g <= 0) continue;
    for (const [ion, ppmPerGperL] of Object.entries(salt.perGramPerLiter) as [IonKey, number][]) {
      out[ion] += (g * ppmPerGperL) / volumeL;
    }
  }
  for (const k of IonKeys) out[k] = Math.round(out[k] * 10) / 10;
  return out;
}

export interface SaltSuggestion {
  grams: Record<string, number>;
  shortfalls: string[]; // ions we could not reach by addition alone
}

// A pragmatic greedy starting point (not a unique solution — the system is
// under-determined and addition-only). Fill magnesium, sulfate, chloride, and
// alkalinity deficits from the obvious salts, then top up calcium. Always
// shown against the live resulting profile so the brewer can fine-tune.
export function suggestSalts(source: Partial<Ions>, target: Partial<Ions>, volumeL: number): SaltSuggestion {
  const grams: Record<string, number> = {};
  const shortfalls: string[] = [];
  if (volumeL <= 0) return { grams, shortfalls };

  const src: Ions = { ...zeroIons(), ...source } as Ions;
  const deficit = (ion: IonKey) => Math.max(0, (target[ion] ?? src[ion]) - src[ion]);

  // Track ions added so we don't double-count.
  const added: Ions = zeroIons();
  const addSalt = (key: string, g: number) => {
    if (g <= 0) return;
    grams[key] = (grams[key] ?? 0) + g;
    const def = SALTS.find((s) => s.key === key)!;
    for (const [ion, ppm] of Object.entries(def.perGramPerLiter) as [IonKey, number][]) {
      added[ion] += (g * ppm) / volumeL;
    }
  };
  const remaining = (ion: IonKey) => Math.max(0, deficit(ion) - added[ion]);

  // 1. Magnesium via epsom (also contributes sulfate).
  const mgDef = deficit("magnesium");
  if (mgDef > 0) addSalt("epsom", (mgDef * volumeL) / SALTS.find((s) => s.key === "epsom")!.perGramPerLiter.magnesium!);

  // 2. Remaining sulfate via gypsum (also contributes calcium).
  const so4Rem = remaining("sulfate");
  if (so4Rem > 0) addSalt("gypsum", (so4Rem * volumeL) / SALTS.find((s) => s.key === "gypsum")!.perGramPerLiter.sulfate!);

  // 3. Chloride via calcium chloride (also contributes calcium).
  const clRem = remaining("chloride");
  if (clRem > 0) addSalt("calciumChloride", (clRem * volumeL) / SALTS.find((s) => s.key === "calciumChloride")!.perGramPerLiter.chloride!);

  // 4. Alkalinity via baking soda (also contributes sodium).
  const hco3Rem = remaining("bicarbonate");
  if (hco3Rem > 0) addSalt("bakingSoda", (hco3Rem * volumeL) / SALTS.find((s) => s.key === "bakingSoda")!.perGramPerLiter.bicarbonate!);

  // 5. Any remaining sodium via table salt (adds chloride — only if chloride has headroom).
  const naRem = remaining("sodium");
  if (naRem > 0 && remaining("chloride") <= 0 && deficit("chloride") === 0) {
    // adding NaCl would overshoot chloride; leave it and report.
    shortfalls.push("sodium (adding table salt would overshoot chloride)");
  } else if (naRem > 0) {
    addSalt("tableSalt", (naRem * volumeL) / SALTS.find((s) => s.key === "tableSalt")!.perGramPerLiter.sodium!);
  }

  // 6. Report calcium we could not reach without overshooting an anion.
  if (remaining("calcium") > 5) {
    shortfalls.push(`calcium (~${Math.round(remaining("calcium"))} ppm short — add gypsum or CaCl₂ if the matching anion has room)`);
  }

  for (const k of Object.keys(grams)) grams[k] = Math.round(grams[k] * 100) / 100;
  return { grams, shortfalls };
}
