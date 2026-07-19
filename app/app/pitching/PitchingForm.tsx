"use client";

import { useId, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  computePitching,
  DECAY_MODEL_LABELS,
  ML_PER_GALLON,
  ML_PER_LITER,
  PITCH_RATES,
  STARTER_LABELS,
  type DecayModelKey,
  type PitchingResult,
  type PitchRateKey,
  type SourceInput,
  type StarterType,
  type YeastSource,
} from "@/lib/pitching/formulas";

type VolumeUnit = "gal" | "L";

export interface PitchingFormInitial {
  volume?: string;
  volumeUnit?: VolumeUnit;
  og?: string;
  pitchType?: PitchRateKey;
  source?: YeastSource;
  decayModel?: DecayModelKey;
  ageDays?: string;
  packs?: string;
  grams?: string;
  slurryMl?: string;
  yeastFractionPct?: string;
  starterType?: StarterType;
  starterMl?: string;
}

// The full set of raw (string) inputs, exposed to an optional footer so a
// host (e.g. the recipe page) can persist the exact protocol.
export interface PitchingFormState {
  volume: string;
  volumeUnit: VolumeUnit;
  og: string;
  pitchType: PitchRateKey;
  source: YeastSource;
  decayModel: DecayModelKey;
  ageDays: string;
  packs: string;
  grams: string;
  slurryMl: string;
  yeastFractionPct: string;
  starterType: StarterType;
  starterMl: string;
}

function toNum(s: string): number {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
}

function fmt(n: number, digits = 0): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export interface StrainPick {
  id: string;
  name: string;
  lab: string;
  form: string;
  uses: string[];
  attenuation: number | null;
  cellsPerUnit: number | null;
  unitLabel: string | null;
}

export default function PitchingForm({
  initial,
  compact = false,
  footer,
  strains,
  initialStrainId,
}: {
  initial?: PitchingFormInitial;
  compact?: boolean;
  footer?: (state: PitchingFormState, result: PitchingResult) => ReactNode;
  strains?: StrainPick[];
  initialStrainId?: string;
}) {
  const id = useId();

  // Selected catalog strain (optional): drives source form + cell-count preset.
  const [strainId, setStrainId] = useState(initialStrainId ?? "");
  const selectedStrain = strains?.find((s) => s.id === strainId) ?? null;

  // Batch
  const [volume, setVolume] = useState(initial?.volume ?? "5");
  const [volumeUnit, setVolumeUnit] = useState<VolumeUnit>(initial?.volumeUnit ?? "gal");
  const [og, setOg] = useState(initial?.og ?? "1.048");
  const [pitchType, setPitchType] = useState<PitchRateKey>(initial?.pitchType ?? "ale");

  // Source
  const [source, setSource] = useState<YeastSource>(
    initial?.source ?? (strains?.find((s) => s.id === (initialStrainId ?? ""))?.form === "dry" ? "dry" : "liquid"),
  );
  const [decayModel, setDecayModel] = useState<DecayModelKey>(initial?.decayModel ?? "classic");
  const [ageDays, setAgeDays] = useState(initial?.ageDays ?? "30");
  const [packs, setPacks] = useState(initial?.packs ?? "1");
  const [grams, setGrams] = useState(initial?.grams ?? "11.5");
  const [slurryMl, setSlurryMl] = useState(initial?.slurryMl ?? "500");
  const [yeastFractionPct, setYeastFractionPct] = useState(initial?.yeastFractionPct ?? "75");

  // Starter
  const [starterType, setStarterType] = useState<StarterType>(initial?.starterType ?? "stirPlate");
  const [starterMl, setStarterMl] = useState(initial?.starterMl ?? "2000");

  const result = useMemo(() => {
    const volumeMl =
      toNum(volume) * (volumeUnit === "gal" ? ML_PER_GALLON : ML_PER_LITER);

    // A chosen strain with a matching form supplies a per-product cell count.
    const strainCells =
      selectedStrain && selectedStrain.cellsPerUnit && selectedStrain.form === source
        ? selectedStrain.cellsPerUnit
        : undefined;

    let sourceInput: SourceInput;
    if (source === "liquid") {
      sourceInput = { source: "liquid", packs: toNum(packs), ageDays: toNum(ageDays), decayModel, cellsPerPack: strainCells };
    } else if (source === "dry") {
      sourceInput = { source: "dry", grams: toNum(grams), ageDays: toNum(ageDays), decayModel, cellsPerGram: strainCells };
    } else {
      sourceInput = {
        source: "slurry",
        slurryMl: toNum(slurryMl),
        yeastFractionPct: toNum(yeastFractionPct),
        ageDays: toNum(ageDays),
        decayModel,
      };
    }

    return computePitching({
      volumeMl,
      og: toNum(og),
      pitchRate: PITCH_RATES[pitchType],
      source: sourceInput,
      starter: { type: starterType, volumeMl: toNum(starterMl) },
    });
  }, [
    volume,
    volumeUnit,
    og,
    pitchType,
    source,
    decayModel,
    ageDays,
    packs,
    grams,
    slurryMl,
    yeastFractionPct,
    starterType,
    starterMl,
    selectedStrain,
  ]);

  const ratioPct = result.cellsNeeded > 0 ? result.ratio * 100 : 0;
  const barColor = result.sufficient ? "#3f7d3f" : "#b55002";

  return (
    <div>
      {/* Results summary */}
      <div style={resultCardStyle}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem" }}>
          <Stat label="Cells needed" value={`${fmt(result.cellsNeeded)} B`} />
          <Stat
            label={starterType === "none" ? "Cells available" : "After starter"}
            value={`${fmt(result.cellsAvailable)} B`}
            emphasize
          />
          <Stat label="From source" value={`${fmt(result.cellsFromSource)} B`} />
          <Stat label="Pitch rate hit" value={`${fmt(result.achievedPitchRate, 2)} M/mL/°P`} />
        </div>

        <div style={{ marginTop: "0.9rem" }}>
          <div style={pitchBarTrackStyle}>
            <div
              style={{
                ...pitchBarFillStyle,
                width: `${Math.min(ratioPct, 100)}%`,
                background: barColor,
              }}
            />
            <span style={pitchBarTargetStyle} title="Target (100%)" />
          </div>
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem", color: barColor, fontWeight: 600 }}>
            {result.cellsNeeded <= 0
              ? "Enter a batch volume and gravity to begin."
              : result.sufficient
                ? `On target — ${fmt(ratioPct)}% of the cells you need.`
                : `Underpitched — only ${fmt(ratioPct)}% of the cells you need.`}
          </p>
        </div>
      </div>

      {/* Batch */}
      <section style={{ marginTop: compact ? "1rem" : "1.5rem" }}>
        <h2 style={sectionHeadStyle}>Batch</h2>
        <div style={rowStyle}>
          <Field label="Volume" id={`${id}-vol`} value={volume} onChange={setVolume} width={80} />
          <Select
            label="Unit"
            id={`${id}-unit`}
            value={volumeUnit}
            onChange={(v) => setVolumeUnit(v as VolumeUnit)}
            options={[
              { value: "gal", label: "gallons" },
              { value: "L", label: "liters" },
            ]}
          />
          <Field label="Original gravity" id={`${id}-og`} value={og} onChange={setOg} width={90} />
          <Select
            label="Fermentation"
            id={`${id}-type`}
            value={pitchType}
            onChange={(v) => setPitchType(v as PitchRateKey)}
            options={[
              { value: "ale", label: `Ale (${PITCH_RATES.ale})` },
              { value: "hybrid", label: `Hybrid (${PITCH_RATES.hybrid})` },
              { value: "lager", label: `Lager (${PITCH_RATES.lager})` },
            ]}
          />
        </div>
      </section>

      {/* Optional: pick a catalog strain to preset form + cell count */}
      {strains && strains.length > 0 && (
        <section style={{ marginTop: "1.25rem" }}>
          <label htmlFor={`${id}-strain`} style={labelStyle}>
            Yeast strain (optional — presets form &amp; cell count)
            <select
              id={`${id}-strain`}
              value={strainId}
              onChange={(e) => {
                const sid = e.target.value;
                setStrainId(sid);
                const st = strains.find((s) => s.id === sid);
                if (st) setSource(st.form === "dry" ? "dry" : "liquid");
              }}
              style={{ ...inputStyle, minWidth: 260 }}
            >
              <option value="">— none —</option>
              {strains.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.lab})
                </option>
              ))}
            </select>
          </label>
          {selectedStrain?.cellsPerUnit && (
            <p style={{ fontSize: "0.8rem", color: "var(--wh-text-light)", marginTop: "0.4rem" }}>
              Using {selectedStrain.cellsPerUnit} B cells per {selectedStrain.unitLabel ?? "unit"} from
              the catalog.
            </p>
          )}
        </section>
      )}

      {/* Yeast source */}
      <section style={{ marginTop: "1.5rem" }}>
        <h2 style={sectionHeadStyle}>Yeast source</h2>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          {(
            [
              ["liquid", "Liquid (vial / pack)"],
              ["dry", "Dry yeast"],
              ["slurry", "Slurry (repitch)"],
            ] as [YeastSource, string][]
          ).map(([val, label]) => (
            <label key={val} style={radioLabelStyle}>
              <input
                type="radio"
                name={`${id}-source`}
                checked={source === val}
                onChange={() => setSource(val)}
              />
              {label}
            </label>
          ))}
        </div>

        <div style={rowStyle}>
          {source === "liquid" && (
            <Field label="Number of packs" id={`${id}-packs`} value={packs} onChange={setPacks} width={90} />
          )}
          {source === "dry" && (
            <Field label="Grams" id={`${id}-grams`} value={grams} onChange={setGrams} width={90} />
          )}
          {source === "slurry" && (
            <>
              <Field label="Slurry (mL)" id={`${id}-slurry`} value={slurryMl} onChange={setSlurryMl} width={90} />
              <Field
                label="Yeast solids (%)"
                id={`${id}-fraction`}
                value={yeastFractionPct}
                onChange={setYeastFractionPct}
                width={90}
              />
            </>
          )}
          <Field label="Age (days)" id={`${id}-age`} value={ageDays} onChange={setAgeDays} width={90} />
          <Select
            label="Viability model"
            id={`${id}-decay`}
            value={decayModel}
            onChange={(v) => setDecayModel(v as DecayModelKey)}
            options={(Object.keys(DECAY_MODEL_LABELS) as DecayModelKey[]).map((k) => ({
              value: k,
              label: DECAY_MODEL_LABELS[k],
            }))}
          />
        </div>
      </section>

      {/* Starter */}
      <section style={{ marginTop: "1.5rem" }}>
        <h2 style={sectionHeadStyle}>Starter / propagation</h2>
        {source === "dry" && starterType !== "none" && (
          <p style={{ fontSize: "0.85rem", color: "var(--wh-text-light)", marginTop: 0 }}>
            Note: dry yeast doesn&apos;t need a starter — a starter just depletes
            the sterols and glycogen built in during production. Rehydrate at
            ~95&nbsp;°F instead.
          </p>
        )}
        <div style={rowStyle}>
          <Select
            label="Method"
            id={`${id}-starter`}
            value={starterType}
            onChange={(v) => setStarterType(v as StarterType)}
            options={(Object.keys(STARTER_LABELS) as StarterType[]).map((k) => ({
              value: k,
              label: STARTER_LABELS[k],
            }))}
          />
          {starterType !== "none" && (
            <Field
              label="Starter size (mL)"
              id={`${id}-startervol`}
              value={starterMl}
              onChange={setStarterMl}
              width={100}
            />
          )}
          {starterType !== "none" && result.starter.newCells > 0 && (
            <div style={{ alignSelf: "flex-end", fontSize: "0.85rem", color: "var(--wh-text-light)" }}>
              +{fmt(result.starter.newCells)} B grown
            </div>
          )}
        </div>
        {starterType !== "none" && result.starter.capped && (
          <p style={{ fontSize: "0.8rem", color: "var(--wh-text-light)", marginTop: "0.5rem" }}>
            Growth is capped by this method&apos;s cell density — a larger
            starter, more agitation, or a second step would grow more.
          </p>
        )}
      </section>

      {footer?.(
        {
          volume,
          volumeUnit,
          og,
          pitchType,
          source,
          decayModel,
          ageDays,
          packs,
          grams,
          slurryMl,
          yeastFractionPct,
          starterType,
          starterMl,
        },
        result,
      )}
    </div>
  );
}

function Stat({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: "0.75rem", color: "var(--wh-text-light)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
        {label}
      </div>
      <div style={{ fontSize: emphasize ? "1.5rem" : "1.25rem", fontWeight: 700, color: emphasize ? "var(--wh-accent)" : "var(--wh-text)" }}>
        {value}
      </div>
    </div>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  width = 100,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  width?: number;
}) {
  return (
    <label htmlFor={id} style={labelStyle}>
      {label}
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, width }} />
    </label>
  );
}

function Select({
  label,
  id,
  value,
  onChange,
  options,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label htmlFor={id} style={labelStyle}>
      {label}
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  gap: "1rem",
  flexWrap: "wrap",
  alignItems: "flex-end",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  fontSize: "0.85rem",
  gap: "0.25rem",
};

const inputStyle: React.CSSProperties = {
  padding: "0.3rem",
  border: "1px solid #ccc",
  borderRadius: 4,
};

const sectionHeadStyle: React.CSSProperties = {
  fontSize: "1.05rem",
  marginBottom: "0.5rem",
};

const radioLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.4rem",
  fontSize: "0.9rem",
  cursor: "pointer",
};

const resultCardStyle: React.CSSProperties = {
  background: "var(--wh-bg-soft)",
  border: "1px solid var(--wh-border)",
  borderRadius: 8,
  padding: "1rem 1.25rem",
  marginTop: "1rem",
};

const pitchBarTrackStyle: React.CSSProperties = {
  position: "relative",
  height: 12,
  background: "var(--wh-border-light)",
  borderRadius: 6,
  overflow: "hidden",
};

const pitchBarFillStyle: React.CSSProperties = {
  height: "100%",
  borderRadius: 6,
  transition: "width 0.15s ease",
};

const pitchBarTargetStyle: React.CSSProperties = {
  position: "absolute",
  top: -2,
  right: 0,
  width: 2,
  height: 16,
  background: "var(--wh-text)",
};
