"use client";

import { useId, useMemo, useState } from "react";
import { ADWY_STANDARD, computeInoculation } from "@/lib/pitching/inoculation";

type VolumeUnit = "gal" | "L";
const L_PER_GALLON = 3.785411784;

function toNum(s: string): number {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
}

function fmt(n: number, digits = 1): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

// Active dry wine yeast (ADWY) inoculation-by-weight calculator — the wine /
// cider / mead standard. Dosing rate and rehydration protocol are the sourced
// AWRI figures (see lib/pitching/inoculation.ts).
export default function InoculationForm() {
  const id = useId();
  const [volume, setVolume] = useState("23");
  const [volumeUnit, setVolumeUnit] = useState<VolumeUnit>("L");
  const [rate, setRate] = useState(String(ADWY_STANDARD.rateGPerHl));
  const [difficult, setDifficult] = useState(false);

  const result = useMemo(() => {
    const volumeL = toNum(volume) * (volumeUnit === "gal" ? L_PER_GALLON : 1);
    const effectiveRate = toNum(rate) * (difficult ? ADWY_STANDARD.difficultMustMultiplier : 1);
    return { volumeL, effectiveRate, ...computeInoculation(effectiveRate, volumeL) };
  }, [volume, volumeUnit, rate, difficult]);

  return (
    <div>
      <div style={resultCardStyle}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem" }}>
          <Stat label="Active dry yeast" value={`${fmt(result.grams)} g`} emphasize />
          <Stat
            label="Rehydration water"
            value={`${fmt(result.water.low, 0)}–${fmt(result.water.high, 0)} mL`}
          />
          <Stat
            label="At"
            value={`${ADWY_STANDARD.rehydrateTempCLow}–${ADWY_STANDARD.rehydrateTempCHigh} °C`}
          />
          <Stat
            label="Target viable cells"
            value={`${(result.targetViableCellsPerMl / 1e6).toFixed(0)}×10⁶ /mL`}
          />
        </div>
        <p style={{ margin: "0.75rem 0 0", fontSize: "0.9rem", color: "var(--wh-text-light)" }}>
          Sprinkle {fmt(result.grams)} g of active dry wine yeast onto{" "}
          {fmt(result.water.low, 0)}–{fmt(result.water.high, 0)} mL of{" "}
          {ADWY_STANDARD.rehydrateTempCLow}–{ADWY_STANDARD.rehydrateTempCHigh} °C water
          (5–10× the yeast weight), stand {ADWY_STANDARD.standMinutesLow}–
          {ADWY_STANDARD.standMinutesHigh} min, then inoculate the must.
        </p>
      </div>

      <section style={{ marginTop: "1.5rem" }}>
        <h2 style={sectionHeadStyle}>Must</h2>
        <div style={rowStyle}>
          <Field label="Volume" id={`${id}-vol`} value={volume} onChange={setVolume} width={80} />
          <label htmlFor={`${id}-unit`} style={labelStyle}>
            Unit
            <select
              id={`${id}-unit`}
              value={volumeUnit}
              onChange={(e) => setVolumeUnit(e.target.value as VolumeUnit)}
              style={{ ...inputStyle, width: "auto" }}
            >
              <option value="L">liters</option>
              <option value="gal">gallons</option>
            </select>
          </label>
          <label htmlFor={`${id}-rate`} style={labelStyle}>
            Rate (g/hL)
            <select
              id={`${id}-rate`}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              style={{ ...inputStyle, width: "auto" }}
            >
              <option value={String(ADWY_STANDARD.rateLowGPerHl)}>
                {ADWY_STANDARD.rateLowGPerHl} (low)
              </option>
              <option value={String(ADWY_STANDARD.rateGPerHl)}>
                {ADWY_STANDARD.rateGPerHl} (AWRI standard)
              </option>
              <option value={String(ADWY_STANDARD.rateHighGPerHl)}>
                {ADWY_STANDARD.rateHighGPerHl} (high)
              </option>
              <option value={String(ADWY_STANDARD.highBrixGPerHl)}>
                {ADWY_STANDARD.highBrixGPerHl} (over {ADWY_STANDARD.highBrixThresholdBx} °Bx, Scott Labs)
              </option>
            </select>
          </label>
        </div>
        <label style={{ ...radioLabelStyle, marginTop: "0.85rem" }}>
          <input type="checkbox" checked={difficult} onChange={(e) => setDifficult(e.target.checked)} />
          Difficult must (highly clarified, high-Brix, or high-SO₂) — up to ~2× rate
        </label>
      </section>

      <p style={{ fontSize: "0.8rem", color: "var(--wh-text-light)", marginTop: "1.5rem" }}>
        Rate and rehydration protocol from the Australian Wine Research
        Institute: an inoculum of 0.25 g/L (25 g/hL) to reach a minimum
        5×10⁶ viable cells/mL, rehydrated in 5–10× its weight of 38–40 °C water.
        Cider and mead that pitch active dry wine yeast use the same protocol —
        Scott Laboratories give the same 25 g/hL standard dose and{" "}
        {ADWY_STANDARD.highBrixGPerHl} g/hL above {ADWY_STANDARD.highBrixThresholdBx} °Bx.{" "}
        <a href={ADWY_STANDARD.sourceUrl} target="_blank" rel="noreferrer">
          awri.com.au
        </a>{" "}
        ·{" "}
        <a href={ADWY_STANDARD.highBrixSourceUrl} target="_blank" rel="noreferrer">
          scottlabsltd.com
        </a>
      </p>
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

const rowStyle: React.CSSProperties = { display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" };
const labelStyle: React.CSSProperties = { display: "flex", flexDirection: "column", fontSize: "0.85rem", gap: "0.25rem" };
const inputStyle: React.CSSProperties = { padding: "0.3rem", border: "1px solid #ccc", borderRadius: 4 };
const sectionHeadStyle: React.CSSProperties = { fontSize: "1.05rem", marginBottom: "0.5rem" };
const radioLabelStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.9rem", cursor: "pointer" };
const resultCardStyle: React.CSSProperties = {
  background: "var(--wh-bg-soft)",
  border: "1px solid var(--wh-border)",
  borderRadius: 8,
  padding: "1rem 1.25rem",
  marginTop: "1rem",
};
