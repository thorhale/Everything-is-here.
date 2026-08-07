export const dynamic = "force-dynamic";

import Link from "next/link";
import { lineageForStrain } from "@/lib/strain-lineages";
import { notFound } from "next/navigation";
import { getStrain } from "@/lib/yeasts-curated";
import { matchGuidelineForStyleName, styleHref } from "@/lib/guidelines";
import { getYeastSubstitutes } from "@/lib/substitutions";
import { assessTemp, tempAtFraction, rangeSummary, schedulesFor } from "@/lib/fermentation-temp";

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

  // The same yeast sold under other names. Built from the producers' own
  // descriptions — see lib/strain-lineages.ts.
  const lineage = await lineageForStrain(strain.id);
  const equivalents = lineage ? lineage.members.filter((m) => m.strainId !== strain.id) : [];

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

  // The strain's published range, turned into what each end of it actually does.
  // Null for the dozen Brett/Lacto/Pedio cultures whose suppliers publish no
  // range — the section simply does not render rather than guessing one.
  const tempRange = { tempMinC: strain.tempMinC, tempMaxC: strain.tempMaxC };
  const summary = rangeSummary(tempRange);
  const schedules = schedulesFor(tempRange);
  const tempBands = summary
    ? {
        summary,
        rows: ([0.1, 0.5, 0.9] as const)
          .map((f) => {
            const t = tempAtFraction(tempRange, f);
            return t == null ? null : assessTemp(tempRange, t);
          })
          .filter((x): x is NonNullable<typeof x> => x != null),
      }
    : null;

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

      {lineage && equivalents.length > 0 && (
        <section
          style={{
            border: "1px solid var(--wh-border)", borderRadius: 8,
            padding: "0.85rem 1rem", background: "var(--wh-bg-soft)", margin: "1rem 0",
          }}
        >
          <h3 style={{ margin: "0 0 0.2rem", fontSize: "1rem" }}>
            Same yeast, different label — the {lineage.label} strain
          </h3>
          <p style={{ fontSize: "0.85rem", color: "var(--wh-text-light)", margin: "0 0 0.6rem" }}>
            {lineage.note}
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {equivalents.map((m) => (
              <li key={m.strainId} style={{ padding: "0.4rem 0", borderTop: "1px solid var(--wh-border)" }}>
                <Link href={`/yeasts/db/${encodeURIComponent(m.strainId)}`} style={{ fontWeight: 600 }}>
                  {m.productCode ? `${m.productCode} · ` : ""}{m.name}
                </Link>
                <span style={{ color: "var(--wh-text-light)", fontSize: "0.85rem" }}>
                  {" "}— {m.lab}
                  {m.labCountry ? `, ${m.labCountry}` : ""}
                  {m.form ? ` · ${m.form}` : ""}
                </span>
                {/* The producer's own words, so the equivalence is checkable
                    rather than asserted. */}
                <div style={{ fontSize: "0.8rem", color: "var(--wh-text-light)", marginTop: "0.15rem" }}>
                  &ldquo;{m.statedBy}&rdquo;{" "}
                  {m.sourceUrl && (
                    <a href={m.sourceUrl} target="_blank" rel="noreferrer">source</a>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p style={{ fontSize: "0.78rem", color: "var(--wh-text-light)", margin: "0.6rem 0 0" }}>
            Each grouping is stated by the producer of that strain, not inferred and not copied
            from anyone&apos;s cross-reference chart. Products described only as a shared style
            (&ldquo;a Bavarian weizen strain&rdquo;) are deliberately not grouped — that is a
            description, not a claim of shared ancestry.
          </p>
        </section>
      )}
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

      {tempBands && (
        <>
          <h3>What temperature does to it</h3>
          <p style={{ fontSize: "0.85rem", color: "var(--wh-text-light)", margin: "0 0 0.6rem" }}>
            {tempBands.summary} Temperature is the largest flavour lever you control with this
            strain, and the supplier&rsquo;s range is not a single setting — it is a dial.
          </p>
          <table>
            <tbody>
              {tempBands.rows.map((b) => (
                <tr key={b.band}>
                  <th style={{ textAlign: "left", whiteSpace: "nowrap", width: 200, verticalAlign: "top" }}>
                    {b.label}
                    <div style={{ fontWeight: 400, color: "var(--wh-text-light)", fontSize: "0.8rem" }}>
                      {b.tempC} °C / {b.tempF} °F
                    </div>
                  </th>
                  <td>
                    <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.85rem" }}>
                      {b.effects.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <h4 style={{ margin: "1rem 0 0.3rem", fontSize: "0.95rem" }}>
            When you are warm matters as much as how warm
          </h4>
          <p style={{ fontSize: "0.85rem", color: "var(--wh-text-light)", margin: "0 0 0.5rem" }}>
            Esters and fusel alcohols are made almost entirely during the first day or two, while
            the yeast is still growing — so holding cool through that window and letting it rise
            afterwards gives a cleaner beer than sitting at the average the whole way. Same average,
            different beer.
          </p>
          <table>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.key}>
                  <th style={{ textAlign: "left", whiteSpace: "nowrap", width: 200, verticalAlign: "top" }}>
                    {s.label}
                    <div style={{ fontWeight: 400, color: "var(--wh-text-light)", fontSize: "0.8rem" }}>
                      grow {s.growthC} °C / {s.growthF} °F
                      {s.finishC !== s.growthC ? `, finish ${s.finishC} °C / ${s.finishF} °F` : ""}
                    </div>
                  </th>
                  <td style={{ fontSize: "0.85rem" }}>
                    {s.outcome}
                    <div style={{ color: "var(--wh-text-light)", marginTop: "0.2rem" }}>
                      Best for: {s.bestFor}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: "0.75rem", color: "var(--wh-text-light)", marginTop: "0.4rem" }}>
            Directions, not magnitudes. Esters and fusel alcohols rise with temperature while
            acetaldehyde and diacetyl fall — measured at industrial scale by Kucharczyk &amp;
            Tuszyński (<em>J. Inst. Brew.</em> 124(3), 2018). The growth-phase point, and a
            same-strain A/B showing it, come from the{" "}
            <a
              href="https://www.maltosefalcons.com/blogs/brewing-techniques-tips/a-guide-to-saisons-and-saison-yeasts"
              target="_blank"
              rel="noreferrer"
            >
              Maltose Falcons saison guide
            </a>
            . How <em>much</em> any of it moves depends on the strain&rsquo;s own genetics, wort
            nitrogen, pitch rate and pressure, so no figure is asserted here. See{" "}
            <Link href="/fermentation">fermentation archetypes</Link>.
          </p>
        </>
      )}

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
