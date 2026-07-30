export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { getStrain } from "@/lib/yeasts-curated";
import { matchGuidelineForStyleName, styleHref } from "@/lib/guidelines";
import { getYeastSubstitutes } from "@/lib/substitutions";

interface Props {
  params: Promise<{ id: string }>;
}

// What kind of evidence a strain's numbers rest on. Ordered strongest first.
// Kept in step with the tiers in data/sources/curated.json and surfaced at
// /sources.
const SPEC_BASIS: Record<string, { label: string; color: string; blurb: string }> = {
  "vendor-tds": {
    label: "Manufacturer datasheet",
    color: "#1a7f37",
    blurb: "The numbers above are the manufacturer's own published specification for this product.",
  },
  "peer-reviewed": {
    label: "Peer-reviewed",
    color: "#1a7f37",
    blurb:
      "Behaviour described from published research. Species-level papers rarely give brewing specs, so most numeric fields are deliberately blank.",
  },
  regulation: {
    label: "Legal standard",
    color: "#1a7f37",
    blurb: "Taken from a published statute or standard of identity.",
  },
  "club-guide": {
    label: "Club guide",
    color: "#9a6700",
    blurb:
      "Described by an experienced homebrew club's published guide. Good practical detail, but it characterises organisms by flavour and process rather than by measured specs — hence the blank numeric fields.",
  },
  "vendor-web": {
    label: "Manufacturer website",
    color: "#9a6700",
    blurb:
      "From the manufacturer's product page rather than a formal datasheet, so figures may be rounded or abridged.",
  },
};

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

      {/* Provenance. Shown as a block rather than a footnote because "where did
          this number come from" is a fair question to ask of every figure above,
          and a blank spec means nobody published one — not that we lost it. */}
      <section
        style={{
          marginTop: "2rem",
          border: "1px solid var(--wh-border)",
          borderRadius: 8,
          padding: "0.8rem 0.9rem",
          background: "var(--wh-bg-soft)",
          fontSize: "0.82rem",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "0.5rem" }}>
          <strong style={{ fontSize: "0.9rem" }}>Where these figures come from</strong>
          {strain.specBasis && (
            <span
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.03em",
                color: SPEC_BASIS[strain.specBasis]?.color ?? "var(--wh-text-light)",
                border: `1px solid ${SPEC_BASIS[strain.specBasis]?.color ?? "var(--wh-border)"}`,
                borderRadius: 4,
                padding: "0.05rem 0.35rem",
              }}
            >
              {SPEC_BASIS[strain.specBasis]?.label ?? strain.specBasis}
            </span>
          )}
        </div>

        <p style={{ margin: "0.4rem 0 0" }}>
          {strain.specBasis && SPEC_BASIS[strain.specBasis]?.blurb}{" "}
          <a href={strain.sourceUrl} target="_blank" rel="noreferrer">
            {strain.specBasis === "vendor-tds" ? "Manufacturer datasheet" : "Cited source"}
          </a>
          .
        </p>

        {strain.sourceNote && (
          <p style={{ margin: "0.4rem 0 0", color: "var(--wh-text-light)" }}>{strain.sourceNote}</p>
        )}

        <p style={{ margin: "0.4rem 0 0", color: "var(--wh-text-light)" }}>
          {strain.attribution}
        </p>

        <p style={{ margin: "0.5rem 0 0", color: "var(--wh-text-light)" }}>
          Figures are transcribed for reference and may differ from the latest batch specs — always
          confirm on the pack. A blank spec above means no cited source publishes that figure for
          this strain. See <Link href="/sources">Sources &amp; provenance</Link> for how these tiers
          work. <Link href="/yeasts/db">← Back to the yeast database</Link>
        </p>
      </section>
    </div>
  );
}
