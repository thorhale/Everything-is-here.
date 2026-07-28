export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { getStrain } from "@/lib/yeasts-curated";
import { matchGuidelineForStyleName, styleHref } from "@/lib/guidelines";
import { getYeastSubstitutes } from "@/lib/substitutions";

interface Props {
  params: Promise<{ id: string }>;
}

async function YeastSubs({ strainId }: { strainId: string }) {
  const { lineage, sameStrain, similar } = await getYeastSubstitutes(strainId);
  if (sameStrain.length === 0 && similar.length === 0) return null;

  const Row = ({ s, note }: { s: { id: string; name: string; form: string; attenuationMin: number | null; attenuationMax: number | null }; note?: string }) => (
    <li key={s.id} style={{ padding: "0.4rem 0", borderBottom: "1px solid var(--wh-border-light)" }}>
      <Link href={`/yeasts/db/${encodeURIComponent(s.id)}`} style={{ fontWeight: 600 }}>{s.name}</Link>
      <div style={{ fontSize: "0.8rem", color: "var(--wh-text-light)" }}>
        {s.form}
        {s.attenuationMin != null && s.attenuationMax != null && ` · ${s.attenuationMin}–${s.attenuationMax}% attenuation`}
        {note ? ` · ${note}` : ""}
      </div>
    </li>
  );

  return (
    <>
      <h3>If you can&apos;t get it</h3>
      {sameStrain.length > 0 && (
        <>
          <p style={{ fontSize: "0.85rem", marginBottom: "0.3rem" }}>
            <strong>Same culture, different label.</strong>{" "}
            {lineage ? lineage.note : "Widely documented as the same or functionally identical strain."}
          </p>
          <ul style={{ listStyle: "none", padding: 0, marginTop: 0 }}>
            {sameStrain.map((s) => <Row key={s.id} s={s} />)}
          </ul>
        </>
      )}
      {similar.length > 0 && (
        <>
          <p style={{ fontSize: "0.85rem", marginBottom: "0.3rem", marginTop: "0.8rem" }}>
            <strong>Comparable strains</strong> — same species, similar attenuation.
          </p>
          <ul style={{ listStyle: "none", padding: 0, marginTop: 0 }}>
            {similar.map((s) => <Row key={s.id} s={s} />)}
          </ul>
        </>
      )}
    </>
  );
}

function range(min: number | null, max: number | null, unit: string): string | null {
  if (min != null && max != null) return `${min}–${max}${unit}`;
  if (max != null) return `${max}${unit}`;
  if (min != null) return `${min}${unit}`;
  return null;
}

export default async function StrainPage({ params }: Props) {
  const { id } = await params;
  const strain = await getStrain(decodeURIComponent(id));
  if (!strain) notFound();

  // Resolve each recommended style to a guideline page when one exists.
  const styleLinks = await Promise.all(
    strain.recommendedStyles.map(async (name) => {
      const g = await matchGuidelineForStyleName(name);
      return { name, href: g ? styleHref(g.category.edition.id, g) : null };
    })
  );

  const att = range(strain.attenuationMin, strain.attenuationMax, "%");
  const tempF = range(strain.tempMinF, strain.tempMaxF, "°F");
  const tempC = range(strain.tempMinC, strain.tempMaxC, "°C");
  const abv = range(strain.alcoholToleranceMin, strain.alcoholToleranceMax, "%");

  const pitchQuery = new URLSearchParams({ strain: strain.id }).toString();

  const specs: [string, string | null][] = [
    ["Lab / brand", strain.lab.name],
    ["Species", strain.species],
    ["Form", strain.form],
    ["Apparent attenuation", att],
    ["Temperature", tempF ? `${tempF}${tempC ? ` (${tempC})` : ""}` : tempC],
    ["Flocculation", strain.flocculation],
    ["Alcohol tolerance", abv],
    ["Cells per unit", strain.cellsPerUnit != null ? `${strain.cellsPerUnit} B / ${strain.unitLabel ?? "unit"}` : null],
    ["Uses", strain.uses.length ? strain.uses.join(", ") : null],
    ["Blend of", strain.isBlend && strain.blendComponents.length ? strain.blendComponents.join(", ") : null],
  ];

  return (
    <div>
      <header className="recipe-header">
        <div>
          <h1>
            {strain.productCode ? `${strain.productCode} · ` : ""}
            {strain.name}
          </h1>
          <p className="flush">
            <Link href={`/yeasts/db?lab=${strain.lab.id}`}>{strain.lab.name}</Link>
            {strain.lab.country ? ` · ${strain.lab.country}` : ""}
          </p>
        </div>
      </header>

      {strain.description && <p>{strain.description}</p>}
      {strain.flavorNotes && (
        <p style={{ color: "var(--wh-text-light)" }}>
          <strong>Flavor:</strong> {strain.flavorNotes}
        </p>
      )}

      <h3>Specifications</h3>
      <table>
        <tbody>
          {specs.filter(([, v]) => v).map(([k, v]) => (
            <tr key={k}>
              <th style={{ textAlign: "left", whiteSpace: "nowrap", width: 200 }}>{k}</th>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {styleLinks.length > 0 && (
        <>
          <h3>Recommended styles</h3>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {styleLinks.map((s) =>
              s.href ? (
                <Link key={s.name} href={s.href} className="wh-style-chip" style={{ textDecoration: "none" }}>
                  {s.name}
                </Link>
              ) : (
                <span key={s.name} className="wh-style-chip">{s.name}</span>
              )
            )}
          </div>
        </>
      )}

      <YeastSubs strainId={strain.id} />

      <p style={{ marginTop: "1.5rem" }}>
        <Link href={`/pitching?${pitchQuery}`} className="wh-btn" style={{ textDecoration: "none" }}>
          Plan a pitch with this yeast →
        </Link>
      </p>

      <p style={{ fontSize: "0.8rem", color: "var(--wh-text-light)", marginTop: "2rem" }}>
        {strain.attribution ?? "Specs from the manufacturer's published data."}{" "}
        <a href={strain.sourceUrl} target="_blank" rel="noreferrer">Manufacturer source</a>. Data is
        transcribed for reference and may differ from the latest batch specs — always confirm on the
        pack. <Link href="/yeasts/db">← Back to the yeast database</Link>
      </p>
    </div>
  );
}
