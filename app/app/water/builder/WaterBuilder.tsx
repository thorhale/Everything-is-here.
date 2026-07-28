"use client";

import { useMemo, useState } from "react";
import {
  SALTS,
  IonKeys,
  applySalts,
  suggestSalts,
  LITERS_PER_GALLON,
  type Ions,
  type IonKey,
} from "@/lib/water-salts";

export interface WaterOption {
  id: string;
  name: string;
  kind: string;
  ions: Partial<Ions>;
}

const ION_LABELS: Record<IonKey, string> = {
  calcium: "Ca",
  magnesium: "Mg",
  sodium: "Na",
  chloride: "Cl",
  sulfate: "SO₄",
  bicarbonate: "HCO₃",
};

function toNum(s: string): number {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
}
function ri(source: Partial<Ions>): number | null {
  const alk = (source.bicarbonate ?? 0) * (50 / 61);
  return Math.round(alk - ((source.calcium ?? 0) / 1.4 + (source.magnesium ?? 0) / 1.7));
}
function so4cl(w: Partial<Ions>): string {
  const cl = w.chloride ?? 0;
  const so4 = w.sulfate ?? 0;
  if (cl <= 0 && so4 <= 0) return "—";
  if (cl <= 0) return "∞ (dry)";
  const r = so4 / cl;
  const label = r >= 2 ? "hoppy" : r >= 1.3 ? "bal-hoppy" : r >= 0.8 ? "balanced" : r >= 0.5 ? "bal-malty" : "malty";
  return `${(Math.round(r * 100) / 100)} · ${label}`;
}

export default function WaterBuilder({ profiles }: { profiles: WaterOption[] }) {
  const sources = [{ id: "ro", name: "RO / distilled (zero)", kind: "", ions: {} as Partial<Ions> }, ...profiles];
  const targets = profiles;

  const [sourceId, setSourceId] = useState("ro");
  const [targetId, setTargetId] = useState(profiles.find((p) => p.kind === "style-target")?.id ?? profiles[0]?.id ?? "");
  const [volume, setVolume] = useState("5");
  const [unit, setUnit] = useState<"gal" | "L">("gal");
  const [sourceIons, setSourceIons] = useState<Record<IonKey, string>>(() => blankIons());
  const [grams, setGrams] = useState<Record<string, string>>({});

  function blankIons(): Record<IonKey, string> {
    return { calcium: "0", magnesium: "0", sodium: "0", chloride: "0", sulfate: "0", bicarbonate: "0" };
  }

  const volumeL = toNum(volume) * (unit === "gal" ? LITERS_PER_GALLON : 1);
  const src: Partial<Ions> = Object.fromEntries(IonKeys.map((k) => [k, toNum(sourceIons[k])])) as Ions;
  const target = targets.find((t) => t.id === targetId)?.ions ?? {};
  const gramsNum = Object.fromEntries(SALTS.map((s) => [s.key, toNum(grams[s.key] ?? "")]));

  const result = useMemo(() => applySalts(src, gramsNum, volumeL), [sourceIons, grams, volumeL]);

  function loadSource(id: string) {
    setSourceId(id);
    const s = sources.find((x) => x.id === id);
    if (!s) return;
    setSourceIons({
      calcium: String(s.ions.calcium ?? 0),
      magnesium: String(s.ions.magnesium ?? 0),
      sodium: String(s.ions.sodium ?? 0),
      chloride: String(s.ions.chloride ?? 0),
      sulfate: String(s.ions.sulfate ?? 0),
      bicarbonate: String(s.ions.bicarbonate ?? 0),
    });
  }

  function doSuggest() {
    const s = suggestSalts(src, target, volumeL);
    setGrams(Object.fromEntries(SALTS.map((salt) => [salt.key, s.grams[salt.key] ? String(s.grams[salt.key]) : ""])));
  }

  const suggestion = useMemo(() => suggestSalts(src, target, volumeL), [sourceIons, targetId, volumeL]);

  return (
    <div>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "1rem" }}>
        <label style={lbl}>
          Source water
          <select value={sourceId} onChange={(e) => loadSource(e.target.value)} style={inp}>
            {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label style={lbl}>
          Target
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)} style={inp}>
            {targets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label style={lbl}>
          Volume
          <input value={volume} onChange={(e) => setVolume(e.target.value)} style={{ ...inp, width: 70 }} />
        </label>
        <label style={lbl}>
          Unit
          <select value={unit} onChange={(e) => setUnit(e.target.value as "gal" | "L")} style={inp}>
            <option value="gal">gallons</option>
            <option value="L">liters</option>
          </select>
        </label>
      </div>

      {/* Editable source ions */}
      <h3 style={{ fontSize: "1rem" }}>Source ions (ppm) — edit for your own water report</h3>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        {IonKeys.map((k) => (
          <label key={k} style={{ ...lbl, fontSize: "0.75rem" }}>
            {ION_LABELS[k]}
            <input
              value={sourceIons[k]}
              onChange={(e) => setSourceIons((s) => ({ ...s, [k]: e.target.value }))}
              style={{ ...inp, width: 64 }}
            />
          </label>
        ))}
      </div>

      {/* Salt additions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <h3 style={{ fontSize: "1rem", margin: 0 }}>Salt additions (grams)</h3>
        <button type="button" className="wh-btn" onClick={doSuggest}>Suggest additions →</button>
      </div>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", margin: "0.75rem 0 1rem" }}>
        {SALTS.map((salt) => (
          <label key={salt.key} style={{ ...lbl, fontSize: "0.78rem" }} title={salt.note ?? ""}>
            {salt.name} <span style={{ color: "var(--wh-text-light)" }}>{salt.formula}</span>
            <input
              value={grams[salt.key] ?? ""}
              placeholder={suggestion.grams[salt.key] ? `≈${suggestion.grams[salt.key]}` : "0"}
              onChange={(e) => setGrams((g) => ({ ...g, [salt.key]: e.target.value }))}
              style={{ ...inp, width: 84 }}
            />
          </label>
        ))}
      </div>

      {/* Result vs target */}
      <h3 style={{ fontSize: "1rem" }}>Resulting profile</h3>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr><th>Ion</th><th>Source</th><th>Added</th><th>Result</th><th>Target</th><th>Δ</th></tr>
          </thead>
          <tbody>
            {IonKeys.map((k) => {
              const res = result[k];
              const tgt = target[k];
              const delta = tgt != null ? Math.round((res - tgt)) : null;
              return (
                <tr key={k}>
                  <td className="nowrap">{ION_LABELS[k]}</td>
                  <td>{Math.round(src[k] ?? 0)}</td>
                  <td>{Math.round(res - (src[k] ?? 0))}</td>
                  <td><strong>{Math.round(res)}</strong></td>
                  <td>{tgt != null ? Math.round(tgt) : "—"}</td>
                  <td style={{ color: delta == null ? undefined : Math.abs(delta) <= 15 ? "#3f7d3f" : "#b55002" }}>
                    {delta == null ? "—" : delta > 0 ? `+${delta}` : delta}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: "0.85rem", color: "var(--wh-text-light)" }}>
        Residual alkalinity: <strong>{ri(result)}</strong> ppm as CaCO₃ · Sulfate:chloride balance:{" "}
        <strong>{so4cl(result)}</strong>
      </p>

      {suggestion.shortfalls.length > 0 && (
        <p style={{ fontSize: "0.85rem", color: "var(--wh-accent)" }}>
          Note: {suggestion.shortfalls.join("; ")}. Salts only add ions — to lower one, dilute with
          RO/distilled water; to lower alkalinity, use acid.
        </p>
      )}
    </div>
  );
}

const inp: React.CSSProperties = { padding: "0.3rem", border: "1px solid #ccc", borderRadius: 4 };
const lbl: React.CSSProperties = { display: "flex", flexDirection: "column", fontSize: "0.8rem", gap: "0.2rem" };
