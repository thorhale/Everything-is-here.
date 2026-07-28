export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { getWaterProfile, residualAlkalinity, totalHardness, sulfateChloride } from "@/lib/water";

interface Props {
  params: Promise<{ id: string }>;
}

function ppm(v: number | null): string {
  return v == null ? "—" : `${Math.round(v)} ppm`;
}

export default async function WaterDetailPage({ params }: Props) {
  const { id } = await params;
  const w = await getWaterProfile(id);
  if (!w) notFound();

  const ra = residualAlkalinity(w);
  const hardness = totalHardness(w);
  const sc = sulfateChloride(w);

  const ions: [string, string, number | null][] = [
    ["Calcium (Ca²⁺)", "mash pH, yeast health, clarity", w.calcium],
    ["Magnesium (Mg²⁺)", "yeast nutrient; harsh if high", w.magnesium],
    ["Sodium (Na⁺)", "rounds malt; harsh with sulfate", w.sodium],
    ["Chloride (Cl⁻)", "fullness, malt sweetness", w.chloride],
    ["Sulfate (SO₄²⁻)", "hop dryness, crisp bitterness", w.sulfate],
    ["Bicarbonate (HCO₃⁻)", "alkalinity; buffers dark malts", w.bicarbonate],
  ];

  return (
    <div>
      <header className="recipe-header">
        <div>
          <h1>{w.name}</h1>
          <p className="flush">
            {w.kind.replace("-", " ")}
            {w.region ? ` · ${w.region}` : ""}
            {w.country ? `, ${w.country}` : ""}
          </p>
        </div>
      </header>

      {w.description && <p>{w.description}</p>}

      <h3>Ion profile</h3>
      <table>
        <thead>
          <tr><th>Ion</th><th>Concentration</th><th className="hide-mobile">What it does</th></tr>
        </thead>
        <tbody>
          {ions.map(([label, role, v]) => (
            <tr key={label}>
              <td className="nowrap">{label}</td>
              <td className="nowrap">{ppm(v)}</td>
              <td className="hide-mobile" style={{ fontSize: "0.85rem", color: "var(--wh-text-light)" }}>{role}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Derived</h3>
      <table>
        <tbody>
          <tr>
            <th style={{ textAlign: "left", width: 220 }}>Residual alkalinity</th>
            <td>{ra == null ? "—" : `${ra} ppm as CaCO₃`}</td>
          </tr>
          <tr>
            <th style={{ textAlign: "left" }}>Total hardness</th>
            <td>{hardness == null ? "—" : `${hardness} ppm as CaCO₃`}</td>
          </tr>
          <tr>
            <th style={{ textAlign: "left" }}>Sulfate : chloride</th>
            <td>{sc.ratio == null ? "—" : `${sc.ratio === Infinity ? "∞" : sc.ratio} — ${sc.balance}`}</td>
          </tr>
        </tbody>
      </table>
      <p style={{ fontSize: "0.8rem", color: "var(--wh-text-light)" }}>
        Residual alkalinity (Kolbach) predicts how far this water pushes mash pH up: high RA needs
        dark, acidic malts to balance, which is why high-RA cities historically brewed dark. The
        sulfate:chloride ratio is the classic hoppy-vs-malty lever.
      </p>

      {w.bestForStyles.length > 0 && (
        <>
          <h3>Suits</h3>
          <p>{w.bestForStyles.join(", ")}</p>
        </>
      )}

      <p style={{ fontSize: "0.8rem", color: "var(--wh-text-light)", marginTop: "2rem" }}>
        {w.attribution ?? ""}{" "}
        <a href={w.sourceUrl} target="_blank" rel="noreferrer">Source</a>.{" "}
        <Link href="/water">← Back to water profiles</Link>
      </p>
    </div>
  );
}
