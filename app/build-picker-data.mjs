// Bake the calculator picker lists into a static bundle asset.
//
// The four calculator pages (pitching, calculator, water builder, recipe
// builder) each fetched their ingredient/strain/water lists from Neon on
// every request. That data is not dynamic — it originates in committed files
// and only changes when a loader runs — so serving it from the database cost
// a query per visit and made the calculators impossible to run offline.
//
// This reads data/reference-export.json (the committed export of all reference
// data) and emits lib/generated/picker-data.json in the EXACT shapes the picker
// functions returned, applying the same transforms. The calculators then import
// it directly: no query, and it works with no network — which is both the
// server-cost fix and the offline capability the native shell needs to clear
// Apple's "minimum functionality" review.
//
// Regenerate after any loader run:  node build-picker-data.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "data", "reference-export.json");
const OUT = join(HERE, "lib", "generated", "picker-data.json");

const ref = JSON.parse(readFileSync(SRC, "utf8"));
const n = (v) => (v == null ? null : v);

// --- fermentables: mirror getFermentablePickerList ------------------------
const fermentables = [...ref.fermentables]
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((f) => ({
    id: f.id,
    name: f.name,
    brand: n(f.brand),
    category: f.category,
    type: f.type,
    ppg: n(f.ppg),
    colorLovibond: n(f.colorLovibond),
    // Only mashed grain is scaled by brewhouse efficiency; sugars, syrups,
    // extracts, juice and fruit go in at full yield.
    isGrain: f.type === "grain" || (f.type === "adjunct" && !!f.requiresConversion),
    ppgMin: n(f.ppgMin),
    ppgMax: n(f.ppgMax),
    sugarGPer100g: n(f.sugarGPer100g),
    sugarGPer100gMin: n(f.sugarGPer100gMin),
    sugarGPer100gMax: n(f.sugarGPer100gMax),
    juiceBrix: n(f.juiceBrix),
    juiceBrixMin: n(f.juiceBrixMin),
    juiceBrixMax: n(f.juiceBrixMax),
    juiceYieldPct: n(f.juiceYieldPct),
    titratableAcidityGPerL: n(f.titratableAcidityGPerL),
    phTypical: n(f.phTypical),
    uses: n(f.uses) ?? [],
  }));

// --- hops: mirror getHopPickerList ----------------------------------------
const hops = [...ref.hops]
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((h) => ({
    id: h.id,
    name: h.name,
    alpha:
      h.alphaMin != null && h.alphaMax != null
        ? Math.round(((h.alphaMin + h.alphaMax) / 2) * 10) / 10
        : h.alphaMax ?? h.alphaMin ?? null,
    purpose: n(h.purpose),
    country: n(h.country),
  }));

// --- strains: mirror getStrainPickerList (needs the lab-name join) --------
const labName = new Map(ref.yeastLabs.map((l) => [l.id, l.name]));
const strains = [...ref.yeastStrains]
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((s) => ({
    id: s.id,
    name: s.name,
    lab: labName.get(s.labId) ?? "",
    form: s.form ?? "",
    species: n(s.species),
    uses: n(s.uses) ?? [],
    attenuation:
      s.attenuationMin != null && s.attenuationMax != null
        ? Math.round((s.attenuationMin + s.attenuationMax) / 2)
        : s.attenuationMax ?? s.attenuationMin ?? null,
    cellsPerUnit: n(s.cellsPerUnit),
    unitLabel: n(s.unitLabel),
    toleranceMax: s.alcoholToleranceMax ?? s.alcoholToleranceMin ?? null,
  }));

// --- water: mirror getWaterPickerList (kind, then sortOrder, then name) ----
const waters = [...ref.waterProfiles]
  .sort(
    (a, b) =>
      (a.kind ?? "").localeCompare(b.kind ?? "") ||
      (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
      a.name.localeCompare(b.name)
  )
  .map((w) => ({
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

// Guard against a malformed export silently shipping empty pickers.
const counts = { fermentables: fermentables.length, hops: hops.length, strains: strains.length, waters: waters.length };
for (const [k, v] of Object.entries(counts)) {
  if (v === 0) {
    console.error(`build-picker-data: ${k} is empty — reference-export.json is missing or malformed.`);
    process.exit(1);
  }
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify(
    { generated: "by app/build-picker-data.mjs from data/reference-export.json — do not edit", source: ref.generatedAt ?? null, ...{ fermentables, hops, strains, waters } },
    null,
    0
  ) + "\n"
);
console.log(`build-picker-data: ${JSON.stringify(counts)} -> lib/generated/picker-data.json`);
