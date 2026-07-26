"use client";

import { useId, useMemo, useState } from "react";
import { computeStats, type CalcFermentable, type CalcHop } from "@/lib/calculator/formulas";
import { StatBars, srmClass } from "@/components/StatBars";

interface FermentableRow {
  key: string;
  name: string;
  amountLb: string;
  ppg: string;
  colorLovibond: string;
  isGrain: boolean;
}

interface HopRow {
  key: string;
  name: string;
  amountOz: string;
  alphaPct: string;
  timeMin: string;
  isDryHop: boolean;
}

let rowCounter = 0;
function nextKey(): string {
  rowCounter += 1;
  return `row-${rowCounter}`;
}

const DEFAULT_FERMENTABLES: FermentableRow[] = [
  { key: nextKey(), name: "2-Row Brewers Malt", amountLb: "10", ppg: "37", colorLovibond: "2", isGrain: true },
];

const DEFAULT_HOPS: HopRow[] = [
  { key: nextKey(), name: "Cascade", amountOz: "1", alphaPct: "5.5", timeMin: "60", isDryHop: false },
];

function toNum(s: string): number {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
}

export interface StrainPick {
  id: string;
  name: string;
  lab: string;
  attenuation: number | null;
}

export default function CalculatorForm({ strains }: { strains?: StrainPick[] }) {
  const formId = useId();
  const [batchSizeGal, setBatchSizeGal] = useState("5");
  const [efficiencyPct, setEfficiencyPct] = useState("75");
  const [attenuationPct, setAttenuationPct] = useState("75");
  const [strainId, setStrainId] = useState("");
  const [fermentables, setFermentables] = useState<FermentableRow[]>(DEFAULT_FERMENTABLES);
  const [hops, setHops] = useState<HopRow[]>(DEFAULT_HOPS);

  const stats = useMemo(() => {
    const calcFermentables: CalcFermentable[] = fermentables.map((f) => ({
      amountLb: toNum(f.amountLb),
      ppg: toNum(f.ppg),
      isGrain: f.isGrain,
    }));
    const calcHops: CalcHop[] = hops.map((h) => ({
      amountOz: toNum(h.amountOz),
      alphaPct: toNum(h.alphaPct),
      timeMin: toNum(h.timeMin),
      isDryHop: h.isDryHop,
    }));
    return computeStats({
      batchSizeGal: toNum(batchSizeGal),
      efficiencyPct: toNum(efficiencyPct),
      attenuationPct: toNum(attenuationPct),
      fermentables: calcFermentables,
      hops: calcHops,
      fermentableColors: fermentables.map((f) => ({
        colorLovibond: toNum(f.colorLovibond),
        amountLb: toNum(f.amountLb),
      })),
    });
  }, [batchSizeGal, efficiencyPct, attenuationPct, fermentables, hops]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "1rem" }}>
        <span className={`swatch ${srmClass(stats.srm)}`} style={{ width: 28, height: 28 }} />
        <span style={{ color: "var(--wh-text-light)", fontSize: "0.85rem" }}>
          Estimated beer color
        </span>
      </div>
      <StatBars og={stats.og} fg={stats.fg} ibu={stats.ibu} srm={stats.srm} abv={stats.abv} />

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        <Field label="Batch size (gal)" id={`${formId}-batch`} value={batchSizeGal} onChange={setBatchSizeGal} />
        <Field label="Efficiency (%)" id={`${formId}-eff`} value={efficiencyPct} onChange={setEfficiencyPct} />
        <Field label="Yeast attenuation (%)" id={`${formId}-atten`} value={attenuationPct} onChange={setAttenuationPct} />
        {strains && strains.length > 0 && (
          <label htmlFor={`${formId}-strain`} style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem", gap: "0.25rem" }}>
            Yeast (fills attenuation)
            <select
              id={`${formId}-strain`}
              value={strainId}
              onChange={(e) => {
                const sid = e.target.value;
                setStrainId(sid);
                const st = strains.find((s) => s.id === sid);
                if (st?.attenuation != null) setAttenuationPct(String(st.attenuation));
              }}
              style={{ padding: "0.3rem", border: "1px solid #ccc", borderRadius: 4, minWidth: 200 }}
            >
              <option value="">— choose a strain —</option>
              {strains.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.lab}){s.attenuation != null ? ` · ${s.attenuation}%` : ""}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <section>
        <h2>Fermentables</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "0.5rem" }}>
          <thead>
            <tr>
              {["Name", "Amount (lb)", "PPG", "Color (°L)", "Grain?", ""].map((h) => (
                <th key={h} style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "0.3rem" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fermentables.map((row) => (
              <tr key={row.key}>
                <td style={{ padding: "0.2rem" }}>
                  <input
                    value={row.name}
                    onChange={(e) => updateRow(setFermentables, row.key, { name: e.target.value })}
                    style={inputStyle}
                  />
                </td>
                <td style={{ padding: "0.2rem" }}>
                  <input
                    value={row.amountLb}
                    onChange={(e) => updateRow(setFermentables, row.key, { amountLb: e.target.value })}
                    style={{ ...inputStyle, width: 70 }}
                  />
                </td>
                <td style={{ padding: "0.2rem" }}>
                  <input
                    value={row.ppg}
                    onChange={(e) => updateRow(setFermentables, row.key, { ppg: e.target.value })}
                    style={{ ...inputStyle, width: 60 }}
                  />
                </td>
                <td style={{ padding: "0.2rem" }}>
                  <input
                    value={row.colorLovibond}
                    onChange={(e) => updateRow(setFermentables, row.key, { colorLovibond: e.target.value })}
                    style={{ ...inputStyle, width: 60 }}
                  />
                </td>
                <td style={{ padding: "0.2rem", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={row.isGrain}
                    onChange={(e) => updateRow(setFermentables, row.key, { isGrain: e.target.checked })}
                  />
                </td>
                <td>
                  <button type="button" onClick={() => removeRow(setFermentables, row.key)} style={removeBtnStyle}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          onClick={() =>
            setFermentables((rows) => [
              ...rows,
              { key: nextKey(), name: "", amountLb: "0", ppg: "37", colorLovibond: "2", isGrain: true },
            ])
          }
          style={addBtnStyle}
        >
          + Add fermentable
        </button>
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Hops</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "0.5rem" }}>
          <thead>
            <tr>
              {["Name", "Amount (oz)", "Alpha (%)", "Time (min)", "Dry hop?", ""].map((h) => (
                <th key={h} style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "0.3rem" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hops.map((row) => (
              <tr key={row.key}>
                <td style={{ padding: "0.2rem" }}>
                  <input
                    value={row.name}
                    onChange={(e) => updateRow(setHops, row.key, { name: e.target.value })}
                    style={inputStyle}
                  />
                </td>
                <td style={{ padding: "0.2rem" }}>
                  <input
                    value={row.amountOz}
                    onChange={(e) => updateRow(setHops, row.key, { amountOz: e.target.value })}
                    style={{ ...inputStyle, width: 70 }}
                  />
                </td>
                <td style={{ padding: "0.2rem" }}>
                  <input
                    value={row.alphaPct}
                    onChange={(e) => updateRow(setHops, row.key, { alphaPct: e.target.value })}
                    style={{ ...inputStyle, width: 60 }}
                  />
                </td>
                <td style={{ padding: "0.2rem" }}>
                  <input
                    value={row.timeMin}
                    onChange={(e) => updateRow(setHops, row.key, { timeMin: e.target.value })}
                    style={{ ...inputStyle, width: 60 }}
                  />
                </td>
                <td style={{ padding: "0.2rem", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={row.isDryHop}
                    onChange={(e) => updateRow(setHops, row.key, { isDryHop: e.target.checked })}
                  />
                </td>
                <td>
                  <button type="button" onClick={() => removeRow(setHops, row.key)} style={removeBtnStyle}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          onClick={() =>
            setHops((rows) => [
              ...rows,
              { key: nextKey(), name: "", amountOz: "0", alphaPct: "5", timeMin: "60", isDryHop: false },
            ])
          }
          style={addBtnStyle}
        >
          + Add hop
        </button>
      </section>
    </div>
  );
}

function updateRow<T extends { key: string }>(
  setRows: React.Dispatch<React.SetStateAction<T[]>>,
  key: string,
  patch: Partial<T>,
): void {
  setRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
}

function removeRow<T extends { key: string }>(
  setRows: React.Dispatch<React.SetStateAction<T[]>>,
  key: string,
): void {
  setRows((rows) => rows.filter((r) => r.key !== key));
}

function Field({
  label,
  id,
  value,
  onChange,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label htmlFor={id} style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem", gap: "0.25rem" }}>
      {label}
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, width: 100 }} />
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "0.3rem",
  border: "1px solid #ccc",
  borderRadius: 4,
  width: "100%",
};

const addBtnStyle: React.CSSProperties = {
  padding: "0.4rem 0.8rem",
  border: "1px solid #3a2a1a",
  background: "#fff",
  color: "#3a2a1a",
  borderRadius: 4,
  cursor: "pointer",
};

const removeBtnStyle: React.CSSProperties = {
  border: "none",
  background: "none",
  color: "#c00",
  cursor: "pointer",
};
