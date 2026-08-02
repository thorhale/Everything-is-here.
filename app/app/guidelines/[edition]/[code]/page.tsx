export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { findStyle } from "@/lib/guidelines";
import { matchStrainsForStyle } from "@/lib/yeasts-curated";
import { StrainGrid } from "@/components/StrainCard";
import { srmClass } from "@/components/StatBars";
import { getFermentableCatalog, getHopCatalog } from "@/lib/ingredients-curated";
import {
  resolveArchiveStyle, getStyleStats, getStyleFermentables, getStyleHops, getStyleYeasts, conformancePct,
} from "@/lib/archive-stats";
import { ArchiveStatBands, IngredientUsageList } from "@/components/ArchiveStats";
import { buildRecipeSkeleton } from "@/lib/recipe-builder";
import { getWaterProfile, suggestWaterTargetId } from "@/lib/water";
import { matchClassicWaterForStyle } from "@/lib/style-water";
import { getArchetypeForCategory, INOCULATION_LABEL } from "@/lib/fermentation";

interface Props {
  params: Promise<{ edition: string; code: string }>;
}

// Marker-less range bar: the style's official min-max band drawn on the
// same scales the recipe stat graphs use.
const SCALES = {
  og: { min: 1, max: 1.15, label: "OG", fmt: (v: number) => v.toFixed(3) },
  fg: { min: 1, max: 1.15, label: "FG", fmt: (v: number) => v.toFixed(3) },
  ibu: { min: 0, max: 120, label: "IBU", fmt: (v: number) => v.toFixed(0) },
  srm: { min: 0, max: 40, label: "SRM", fmt: (v: number) => v.toFixed(0) },
  abv: { min: 1, max: 14, label: "ABV", fmt: (v: number) => `${v}%` },
} as const;

function RangeBar({ stat, lo, hi }: { stat: keyof typeof SCALES; lo: number; hi: number }) {
  const s = SCALES[stat];
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - s.min) / (s.max - s.min)) * 100));
  return (
    <div className="horizontal-bar-graph">
      <div className="bar">
        <div className="range" style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%`, opacity: 0.45 }} />
      </div>
      <div className="value" style={{ fontSize: "0.8rem" }}>
        {s.fmt(lo)}-{s.fmt(hi)}
      </div>
      <div className="label">{s.label}</div>
    </div>
  );
}

const SECTIONS: [string, string][] = [
  ["impression", "Overall Impression"],
  ["aroma", "Aroma"],
  ["appearance", "Appearance"],
  ["flavor", "Flavor"],
  ["mouthfeel", "Mouthfeel"],
  ["comments", "Comments"],
  ["history", "History"],
  ["ingredients", "Characteristic Ingredients"],
  ["comparison", "Style Comparison"],
  ["examples", "Commercial Examples"],
];

export default async function GuidelineStylePage({ params }: Props) {
  const { edition: editionId, code } = await params;
  const style = await findStyle(editionId, code);
  if (!style) notFound();
  const edition = style.category.edition;
  const suggestedYeasts = await matchStrainsForStyle(style.name, { limit: 6 });
  // How this style ferments — the mapped archetype (sourced), resolved by the
  // same key the DB uses. Static lookup, no extra database column.
  const archetype = await getArchetypeForCategory(edition.id, style.category.code);

  // Auto-generated starting recipe from the style's own published targets.
  const [fermCat, hopCat] = await Promise.all([getFermentableCatalog(), getHopCatalog()]);
  const skeleton = buildRecipeSkeleton(
    {
      name: style.name,
      categoryName: style.category.name,
      tags: style.tags,
      beverage: style.category.beverage,
      ogMin: style.ogMin, ogMax: style.ogMax, fgMin: style.fgMin, fgMax: style.fgMax,
      ibuMin: style.ibuMin, ibuMax: style.ibuMax, srmMin: style.srmMin, srmMax: style.srmMax,
      abvMin: style.abvMin, abvMax: style.abvMax,
    },
    fermCat.map((f) => ({ id: f.id, name: f.name, ppg: f.ppg, colorLovibond: f.colorLovibond, type: f.type, requiresConversion: f.requiresConversion })),
    hopCat.map((h) => ({ id: h.id, name: h.name, alphaMin: h.alphaMin, alphaMax: h.alphaMax, purpose: h.purpose, styleTags: h.styleTags, country: h.country })),
  );
  const skeletonWater = skeleton.buildable
    ? await getWaterProfile(suggestWaterTargetId(skeleton.targets.srm, style.name))
    : null;

  // The classic water behind this style's BJCP commercial examples: the city
  // and beer that define it, and why the water works.
  const waterAnchor = matchClassicWaterForStyle(style.name);
  const classicWater = waterAnchor ? await getWaterProfile(waterAnchor.classicCityId) : null;

  // What the archive's brewers actually did for this style.
  const archiveStyle = await resolveArchiveStyle(style.name);
  const archiveStats = archiveStyle ? await getStyleStats(archiveStyle) : null;
  const [archMalts, archHops, archYeasts, ogConform] = archiveStyle
    ? await Promise.all([
        getStyleFermentables(archiveStyle, 8),
        getStyleHops(archiveStyle, 8),
        getStyleYeasts(archiveStyle, 6),
        style.ogMin != null && style.ogMax != null
          ? conformancePct(archiveStyle, "og", style.ogMin, style.ogMax)
          : Promise.resolve(null),
      ])
    : [[], [], [], null];

  const srmMid = style.srmMin != null && style.srmMax != null ? (style.srmMin + style.srmMax) / 2 : null;

  return (
    <div>
      <header className="recipe-header">
        <figure className={`recipe-color ${srmClass(srmMid)}`} style={{ opacity: srmMid == null ? 0.25 : 1 }} />
        <div>
          <h1>
            {style.code ? `${style.code}. ` : ""}
            {style.name}
          </h1>
          <p className="flush">
            {style.category.name} ·{" "}
            <Link href={`/guidelines/${edition.id}`}>{edition.title}</Link>
          </p>
        </div>
      </header>

      {(style.ogMin != null || style.ibuMin != null || style.abvMin != null) && (
        <div className="recipe-show--stats" style={{ maxWidth: 460, marginBottom: "1.25rem" }}>
          {style.ogMin != null && style.ogMax != null && <RangeBar stat="og" lo={style.ogMin} hi={style.ogMax} />}
          {style.fgMin != null && style.fgMax != null && <RangeBar stat="fg" lo={style.fgMin} hi={style.fgMax} />}
          {style.ibuMin != null && style.ibuMax != null && <RangeBar stat="ibu" lo={style.ibuMin} hi={style.ibuMax} />}
          {style.srmMin != null && style.srmMax != null && <RangeBar stat="srm" lo={style.srmMin} hi={style.srmMax} />}
          {style.abvMin != null && style.abvMax != null && <RangeBar stat="abv" lo={style.abvMin} hi={style.abvMax} />}
        </div>
      )}

      {SECTIONS.map(([key, label]) => {
        const text = (style as unknown as Record<string, string | null>)[key];
        if (!text) return null;
        return (
          <section key={key}>
            <h3>{label}</h3>
            <p style={{ whiteSpace: "pre-wrap" }}>{text}</p>
          </section>
        );
      })}

      {archetype && (
        <section>
          <h3>How it ferments</h3>
          <div
            style={{
              border: "1px solid var(--wh-border)",
              borderRadius: 8,
              padding: "0.85rem 1rem",
              background: "var(--wh-bg-soft)",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "0.5rem" }}>
              <strong>{archetype.label}</strong>
              <span
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                  border: "1px solid var(--wh-border)",
                  borderRadius: 4,
                  padding: "0.05rem 0.35rem",
                  color: "var(--wh-text-light)",
                }}
              >
                {INOCULATION_LABEL[archetype.inoculation]}
              </span>
              {archetype.researchStatus === "pending" && (
                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#9a6700" }}>figures pending</span>
              )}
            </div>
            <p style={{ fontSize: "0.9rem", margin: "0.45rem 0 0" }}>{archetype.approach}</p>
            {archetype.standard?.note && (
              <p style={{ fontSize: "0.85rem", margin: "0.5rem 0 0", color: "var(--wh-text-light)" }}>
                <strong>Standard:</strong> {archetype.standard.note}
              </p>
            )}
            <p style={{ fontSize: "0.8rem", margin: "0.6rem 0 0" }}>
              <Link href="/fermentation">Full fermentation reference →</Link>
              {(archetype.inoculation === "cultured" || archetype.inoculation === "starter-culture") && (
                <>
                  {"  ·  "}
                  <Link href="/pitching">Pitching &amp; inoculation →</Link>
                </>
              )}
            </p>
          </div>
        </section>
      )}

      {archiveStats && archiveStats.recipes >= 5 && (
        <section>
          <h3>What brewers actually did</h3>
          <p style={{ fontSize: "0.85rem", color: "var(--wh-text-light)", marginTop: "-0.3rem" }}>
            {archiveStats.recipes.toLocaleString()} archived{" "}
            <Link href={`/recipes?style=${encodeURIComponent(archiveStyle!)}`}>{archiveStyle}</Link>{" "}
            recipes, measured against this guideline&apos;s published range.
            {ogConform != null && (
              <> <strong>{ogConform}%</strong> of them fall inside the spec OG range.</>
            )}
          </p>

          <ArchiveStatBands
            stats={archiveStats}
            spec={{
              ogMin: style.ogMin, ogMax: style.ogMax,
              fgMin: style.fgMin, fgMax: style.fgMax,
              ibuMin: style.ibuMin, ibuMax: style.ibuMax,
              srmMin: style.srmMin, srmMax: style.srmMax,
              abvMin: style.abvMin, abvMax: style.abvMax,
            }}
          />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
            {archMalts.length > 0 && (
              <div>
                <h4 style={{ fontSize: "0.9rem", marginBottom: "0.4rem" }}>Most-used fermentables</h4>
                <IngredientUsageList items={archMalts} unit="lb avg" />
              </div>
            )}
            {archHops.length > 0 && (
              <div>
                <h4 style={{ fontSize: "0.9rem", marginBottom: "0.4rem" }}>Most-used hops</h4>
                <IngredientUsageList items={archHops} unit="oz avg" linkBase={(n) => `/hops/${encodeURIComponent(n)}`} />
              </div>
            )}
            {archYeasts.length > 0 && (
              <div>
                <h4 style={{ fontSize: "0.9rem", marginBottom: "0.4rem" }}>Most-used yeasts</h4>
                <IngredientUsageList items={archYeasts} linkBase={(n) => `/yeasts/${encodeURIComponent(n)}`} />
              </div>
            )}
          </div>
        </section>
      )}

      {skeleton.buildable && (
        <section>
          <h3>Starting recipe</h3>
          <p style={{ fontSize: "0.85rem", color: "var(--wh-text-light)", marginTop: "-0.3rem" }}>
            Auto-generated from this style&apos;s own published targets — a {skeleton.family} skeleton
            for {skeleton.batchSizeGal} gal at {skeleton.efficiencyPct}% efficiency. A starting
            point to adjust, not a finished recipe.
          </p>

          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr><th>Grain bill</th><th>Amount</th><th>%</th></tr>
              </thead>
              <tbody>
                {skeleton.fermentables.map((f) => (
                  <tr key={f.id}>
                    <td><Link href={`/fermentables/db/${encodeURIComponent(f.id)}`}>{f.name}</Link></td>
                    <td className="nowrap">{f.amountLb.toFixed(2)} lb</td>
                    <td className="nowrap">{f.percent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {skeleton.hops.length > 0 && (
            <div style={{ overflowX: "auto", marginTop: "0.75rem" }}>
              <table>
                <thead>
                  <tr><th>Hops</th><th>Amount</th><th>Alpha</th><th>Time</th></tr>
                </thead>
                <tbody>
                  {skeleton.hops.map((h, i) => (
                    <tr key={`${h.id}-${i}`}>
                      <td><Link href={`/hops/db/${encodeURIComponent(h.id)}`}>{h.name}</Link></td>
                      <td className="nowrap">{h.amountOz.toFixed(2)} oz</td>
                      <td className="nowrap">{h.alphaPct}%</td>
                      <td className="nowrap">{h.timeMin} min</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ overflowX: "auto", marginTop: "0.75rem" }}>
            <table>
              <thead>
                <tr><th>Lands at</th><th>OG</th><th>FG</th><th>IBU</th><th>SRM</th><th>ABV</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ color: "var(--wh-text-light)" }}>this recipe</td>
                  <td className="nowrap"><strong>{skeleton.computed.og.toFixed(3)}</strong></td>
                  <td className="nowrap">{skeleton.computed.fg.toFixed(3)}</td>
                  <td className="nowrap">{skeleton.computed.ibu.toFixed(0)}</td>
                  <td className="nowrap">{skeleton.computed.srm.toFixed(1)}</td>
                  <td className="nowrap">{skeleton.computed.abv.toFixed(1)}%</td>
                </tr>
                <tr style={{ color: "var(--wh-text-light)" }}>
                  <td>style range</td>
                  <td className="nowrap">{style.ogMin != null ? `${style.ogMin.toFixed(3)}–${style.ogMax?.toFixed(3)}` : "—"}</td>
                  <td className="nowrap">{style.fgMin != null ? `${style.fgMin.toFixed(3)}–${style.fgMax?.toFixed(3)}` : "—"}</td>
                  <td className="nowrap">{style.ibuMin != null ? `${style.ibuMin}–${style.ibuMax}` : "—"}</td>
                  <td className="nowrap">{style.srmMin != null ? `${style.srmMin}–${style.srmMax}` : "—"}</td>
                  <td className="nowrap">{style.abvMin != null ? `${style.abvMin}–${style.abvMax}%` : "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {waterAnchor && classicWater && (
            <div
              style={{
                fontSize: "0.85rem",
                marginTop: "0.75rem",
                padding: "0.6rem 0.8rem",
                border: "1px solid var(--wh-border)",
                borderRadius: 8,
                background: "var(--wh-bg-soft)",
              }}
            >
              <strong>The classic water:</strong>{" "}
              <Link href={`/water/${classicWater.id}`}>{classicWater.name}</Link> — the water behind{" "}
              <em>{waterAnchor.example}</em> ({waterAnchor.brewery}, {waterAnchor.city}).
              <div style={{ color: "var(--wh-text-light)", marginTop: "0.3rem" }}>{waterAnchor.why}</div>
              {skeletonWater && (
                <div style={{ marginTop: "0.4rem" }}>
                  To brew it from your own tap, aim for the{" "}
                  <Link href={`/water/${skeletonWater.id}`}>{skeletonWater.name}</Link> target —{" "}
                  <Link href="/water/builder">work out the salts →</Link>
                </div>
              )}
            </div>
          )}
          {!waterAnchor && skeletonWater && (
            <p style={{ fontSize: "0.85rem", marginTop: "0.6rem" }}>
              Suggested water: <Link href={`/water/${skeletonWater.id}`}>{skeletonWater.name}</Link>{" "}
              — <Link href="/water/builder">build it →</Link>
            </p>
          )}
          <p style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", fontSize: "0.85rem" }}>
            <a
              href={`/guidelines/${edition.id}/${encodeURIComponent(style.code ?? style.id.slice(edition.id.length + 1))}/beerxml`}
              className="wh-btn"
              style={{ textDecoration: "none" }}
            >
              Download as BeerXML
            </a>
            <Link href="/calculator" className="wh-btn-secondary" style={{ textDecoration: "none" }}>
              Open the recipe calculator →
            </Link>
          </p>
        </section>
      )}

      {suggestedYeasts.length > 0 && (
        <section>
          <h3>Suggested yeasts</h3>
          <p style={{ fontSize: "0.85rem", color: "var(--wh-text-light)", marginTop: "-0.3rem" }}>
            Strains whose makers recommend them for this style.{" "}
            <Link href={`/yeasts/db?style=${encodeURIComponent(style.name)}`}>See all →</Link>
          </p>
          <StrainGrid strains={suggestedYeasts} />
        </section>
      )}

      <p style={{ marginTop: "1.25rem" }}>
        <Link href={`/recipes?style=${encodeURIComponent(style.name)}`}>
          Browse archived {style.name} recipes →
        </Link>
      </p>
      <p style={{ fontSize: "0.8rem", color: "var(--wh-text-light)", marginTop: "2rem" }}>
        {edition.attribution}{" "}
        {/* A style may cite a different document than its edition — the norm in
            the traditional editions, where each style carries its own source. */}
        {style.sourceUrl && style.sourceUrl !== edition.sourceUrl ? (
          <>
            This style&apos;s figures were read out of{" "}
            <a href={style.sourceUrl} target="_blank" rel="noreferrer">
              its own cited source
            </a>
            ; see also the{" "}
            <a href={edition.sourceUrl} target="_blank" rel="noreferrer">
              edition source
            </a>
            .
          </>
        ) : (
          <>
            <a href={edition.sourceUrl} target="_blank" rel="noreferrer">
              Original source
            </a>
            .
          </>
        )}{" "}
        <Link href="/sources">How sources are graded</Link>.{" "}
        <Link href="/takedown">Request removal</Link>
      </p>
    </div>
  );
}
