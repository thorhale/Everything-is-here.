// Curated and archived data, rewritten only when a loader runs, so a render
// per visit bought nothing and kept the Neon compute endpoint awake. Cached
// and revalidated hourly instead.
export const revalidate = 3600;

import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecipeIngredients } from "@/lib/recipe-ingredients";
import { prisma } from "@/lib/db";
import { StatBars, srmClass } from "@/components/StatBars";
import { getStyleRanges } from "@/lib/style-ranges";
import { matchGuidelineForStyleName, styleHref } from "@/lib/guidelines";
import { matchStrainsForStyle, matchStrainForName, strainHref } from "@/lib/yeasts-curated";
import { getWaterProfile, suggestWaterTargetId, residualAlkalinity, sulfateChloride } from "@/lib/water";
import { targetResidualAlkalinity } from "@/lib/mash-ph";
import { StrainGrid } from "@/components/StrainCard";
import { PintGlass } from "@/components/PintGlass";
import { isAdmin } from "@/lib/admin-auth";
import RecipePitching, { type SavedProtocol } from "./RecipePitching";
import type { PitchingFormInitial } from "@/app/pitching/PitchingForm";
import type { PitchRateKey } from "@/lib/pitching/formulas";

interface Props {
  params: Promise<{ slug: string }>;
}

function waybackUrl(url: string, timestamp: string): string {
  return `https://web.archive.org/web/${timestamp}/${url}`;
}

// Parse a free-text batch size like "5 gal", "5.5 gallons", or "20 L" into a
// value + unit for the pitching calculator. Defaults to 5 gal when unknown.
function parseBatchSize(display: string | null): { volume: string; unit: "gal" | "L" } {
  if (display) {
    const match = display.match(/([\d.]+)\s*(l\b|liter|litre|gal|gallon)/i);
    if (match) {
      const unit = /^(l|liter|litre)/i.test(match[2]) ? "L" : "gal";
      return { volume: match[1], unit };
    }
  }
  return { volume: "5", unit: "gal" };
}

// Lagers want a much higher pitch rate; pick a sensible default from the style.
function pitchTypeForStyle(styleName: string | null): PitchRateKey {
  const s = (styleName ?? "").toLowerCase();
  if (/lager|pilsner|pils|bock|schwarz|dunkel|helles|märzen|marzen|oktoberfest/.test(s)) {
    return "lager";
  }
  if (/kölsch|kolsch|altbier|california common|steam|cream ale/.test(s)) {
    return "hybrid";
  }
  return "ale";
}

export default async function RecipeDetailPage({ params }: Props) {
  const { slug } = await params;

  // Ingredients come from the gzipped static shards, not from Postgres — the
  // junction tables left the database (docs/storage-efficiency.md, tier 3).
  // They were 1,092,461 rows costing 270 MB there; they are 14 MB here, and
  // this page only ever needs one recipe's worth.
  const [recipe, ingredients] = await Promise.all([
    prisma.recipe.findUnique({
      where: { slug },
      include: {
        brewer: true,
        comments: true,
        pitchingProtocol: true,
      },
    }),
    getRecipeIngredients(slug),
  ]);

  if (!recipe || recipe.isHidden) {
    notFound();
  }

  const ranges = recipe.styleName ? await getStyleRanges(recipe.styleName) : null;
  const guideline = recipe.styleName ? await matchGuidelineForStyleName(recipe.styleName) : null;
  const admin = await isAdmin();

  // Yeast recommendations for this recipe's style, and a link from each of the
  // recipe's own yeast rows to its matched catalog strain.
  const suggestedYeasts = recipe.styleName
    ? await matchStrainsForStyle(recipe.styleName, { use: "beer", limit: 4 })
    : [];
  // Keyed by position: shard rows carry no synthetic id, and a recipe's yeast
  // list is a fixed ordered array.
  const yeastStrainLinks: (string | null)[] = await Promise.all(
    ingredients.yeasts.map(async (y) => {
      const match = y.name ? await matchStrainForName(y.name) : null;
      return match ? strainHref(match.id) : null;
    }),
  );

  // Water + mash-pH analysis from the recipe's own colour and style.
  const waterTarget = await getWaterProfile(suggestWaterTargetId(recipe.srm, recipe.styleName));
  const targetRa = recipe.srm != null ? targetResidualAlkalinity(recipe.srm) : null;

  const batch = parseBatchSize(recipe.batchSizeDisplay);
  const pitchingDefaults: PitchingFormInitial = {
    volume: batch.volume,
    volumeUnit: batch.unit,
    og: recipe.og != null ? recipe.og.toFixed(3) : undefined,
    pitchType: pitchTypeForStyle(recipe.styleName),
  };
  const savedProtocol: SavedProtocol | null = recipe.pitchingProtocol
    ? { ...recipe.pitchingProtocol, updatedAt: recipe.pitchingProtocol.updatedAt.toISOString() }
    : null;

  return (
    <div>
      <header className="recipe-header">
        <figure className={`recipe-color ${srmClass(recipe.srm)}`}>
          <PintGlass />
        </figure>
        <div className="header-content">
          <h1>{recipe.title ?? recipe.slug}</h1>
          <p className="flush">
            {recipe.styleName && (
              <>
                a{" "}
                <strong>
                  <Link href={`/recipes?style=${encodeURIComponent(recipe.styleName)}`}>
                    {recipe.styleName}
                  </Link>
                </strong>
              </>
            )}
            {recipe.brewer && (
              <span className="author">
                {" "}by{" "}
                <strong>
                  <Link
                    href={`/brewers/${recipe.brewer.id}`}
                    title={`View ${recipe.brewer.originalUsername}'s recipes`}
                  >
                    {recipe.brewer.originalUsername}
                  </Link>
                </strong>
              </span>
            )}
            {guideline && (
              <>
                {" · "}
                <Link href={styleHref(guideline.category.edition.id, guideline)}>
                  Style guidelines
                </Link>
              </>
            )}
          </p>
        </div>
      </header>

      <div className="recipe-show">
        <div className="recipe-show--ingredients">
          <div style={{ fontSize: "0.85rem", color: "var(--wh-text-light)", marginBottom: "1rem" }}>
            {recipe.batchSizeDisplay && <>Batch size: {recipe.batchSizeDisplay} · </>}
            {recipe.boilTimeDisplay && <>Boil time: {recipe.boilTimeDisplay} · </>}
            {recipe.efficiencyDisplay && <>Efficiency: {recipe.efficiencyDisplay}</>}
            {recipe.ibuFormula && <> · IBU formula: {recipe.ibuFormula}</>}
          </div>

          <h3>Fermentables</h3>
          {ingredients.fermentables.length === 0 ? (
            <p style={{ color: "var(--wh-text-light)" }}>None listed.</p>
          ) : (
            <table id="fermentables">
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Amount</th>
                  <th>Fermentable</th>
                  <th className="hide-mobile">Maltster</th>
                  <th>Use</th>
                  <th className="hide-mobile">PPG</th>
                  <th className="hide-mobile">Color</th>
                </tr>
              </thead>
              <tbody>
                {/* The shard stores each recipe's ingredients as an ordered
                    array, so position is the identity — no id column needed.
                    See docs/storage-efficiency.md, tier 3. */}
                {ingredients.fermentables.map((f, i) => (
                  <tr key={i}>
                    <td className="nowrap">
                      <span title={f.percent ?? undefined}>{f.amountDisplay}</span>
                    </td>
                    <td className="nowrap">
                      <span className={`swatch ${srmClass(f.colorLovibond)}`} />
                      {f.name}
                    </td>
                    <td className="nowrap hide-mobile">{f.maltster}</td>
                    <td>{f.use}</td>
                    <td className="hide-mobile">{f.ppg ?? ""}</td>
                    <td className="hide-mobile">
                      {f.colorLovibond != null ? `${f.colorLovibond} °L` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3>Hops</h3>
          {ingredients.hops.length === 0 ? (
            <p style={{ color: "var(--wh-text-light)" }}>None listed.</p>
          ) : (
            <table id="hops">
              <thead>
                <tr>
                  <th>Amount</th>
                  <th>Hop</th>
                  <th>Time</th>
                  <th className="hide-mobile">Use</th>
                  <th className="hide-mobile">Form</th>
                  <th className="hide-mobile">AA</th>
                </tr>
              </thead>
              <tbody>
                {ingredients.hops.map((h, i) => (
                  <tr key={i}>
                    <td className="nowrap">{h.amountDisplay}</td>
                    <td className="nowrap">
                      <Link href={`/hops/${encodeURIComponent(h.name ?? "")}`}>{h.name}</Link>
                    </td>
                    <td className="nowrap">{h.timeDisplay}</td>
                    <td className="hide-mobile">{h.use}</td>
                    <td className="hide-mobile">{h.form}</td>
                    <td className="hide-mobile">
                      {h.alphaAcidPct != null ? `${h.alphaAcidPct}%` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {ingredients.yeasts.length > 0 && (
            <>
              <h3>Yeasts</h3>
              <table id="yeasts">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Lab/Product</th>
                    <th className="hide-mobile">Attenuation</th>
                  </tr>
                </thead>
                <tbody>
                  {ingredients.yeasts.map((y, i) => (
                    <tr key={i}>
                      <td className="nowrap">
                        <Link href={`/yeasts/${encodeURIComponent(y.name ?? "")}`}>{y.name}</Link>
                        {yeastStrainLinks[i] && (
                          <>
                            {" "}
                            <Link
                              href={yeastStrainLinks[i]!}
                              style={{ fontSize: "0.75rem", color: "var(--wh-text-light)" }}
                            >
                              (specs)
                            </Link>
                          </>
                        )}
                      </td>
                      <td>{y.labProduct}</td>
                      <td className="hide-mobile">
                        {y.attenuationPct != null ? `${y.attenuationPct}%` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {recipe.notesText && (
            <>
              <h3>Notes</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>{recipe.notesText}</p>
            </>
          )}

          {recipe.comments.length > 0 && (
            <>
              <h3>Comments</h3>
              <ul style={{ listStyle: "none", padding: 0 }}>
                {recipe.comments.map((c) => (
                  <li key={c.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid #eee" }}>
                    <strong>{c.commenter ?? "anonymous"}</strong>{" "}
                    <span style={{ color: "var(--wh-text-light)", fontSize: "0.8rem" }}>
                      {c.timestampDisplay}
                    </span>
                    <p style={{ margin: "0.25rem 0 0" }}>{c.text}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <aside className="recipe-show--aside">
          <h3>Stats</h3>
          <StatBars
            og={recipe.og}
            fg={recipe.fg}
            ibu={recipe.ibu}
            srm={recipe.srm}
            abv={recipe.abv}
            styleName={recipe.styleName}
            ranges={ranges}
          />
        </aside>
      </div>

      {suggestedYeasts.length > 0 && (
        <section style={{ marginTop: "2rem" }}>
          <h3>Suggested yeasts for {recipe.styleName}</h3>
          <p style={{ fontSize: "0.85rem", color: "var(--wh-text-light)", marginTop: "-0.3rem" }}>
            Strains recommended for this style.{" "}
            <Link href={`/yeasts/db?style=${encodeURIComponent(recipe.styleName ?? "")}`}>
              See all in the yeast database →
            </Link>
          </p>
          <StrainGrid strains={suggestedYeasts} />
        </section>
      )}

      {waterTarget && (
        <section style={{ marginTop: "2rem" }}>
          <h3>Water &amp; mash pH</h3>
          <p style={{ fontSize: "0.85rem", color: "var(--wh-text-light)", marginTop: "-0.3rem" }}>
            {recipe.srm != null ? (
              <>
                At <strong>{recipe.srm.toFixed(0)} SRM</strong>, this beer wants a residual
                alkalinity around <strong>{targetRa} ppm</strong> (Palmer). A good target water is{" "}
                <Link href={`/water/${waterTarget.id}`}>{waterTarget.name}</Link>
                {(() => {
                  const sc = sulfateChloride(waterTarget);
                  const ra = residualAlkalinity(waterTarget);
                  return (
                    <>
                      {" "}(RA {ra ?? "—"} ppm, {sc.balance}).
                    </>
                  );
                })()}{" "}
                <Link href="/water/builder">Build it from your water →</Link>
              </>
            ) : (
              <>
                Suggested target water for this style:{" "}
                <Link href={`/water/${waterTarget.id}`}>{waterTarget.name}</Link>.{" "}
                <Link href="/water/builder">Water calculator →</Link>
              </>
            )}
          </p>
        </section>
      )}

      <RecipePitching
        recipeSlug={recipe.slug}
        defaults={pitchingDefaults}
        saved={savedProtocol}
        yeastName={ingredients.yeasts[0]?.name ?? undefined}
        canEdit={admin}
      />

      <section style={{ marginTop: "2rem" }}>
        <h3>Export</h3>
        <p style={{ fontSize: "0.85rem", color: "var(--wh-text-light)", marginTop: "-0.3rem" }}>
          Download as BeerXML to open in BeerSmith, Brewfather, Brewer&apos;s Friend or any other
          brewing app — optionally rescaled to your batch size.
        </p>
        <p style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <a href={`/recipes/${recipe.slug}/beerxml`} className="wh-btn" style={{ textDecoration: "none" }}>
            BeerXML (as archived)
          </a>
          <a href={`/recipes/${recipe.slug}/beerxml?gal=5`} className="wh-btn-secondary" style={{ textDecoration: "none" }}>
            scaled to 5 gal
          </a>
          <a href={`/recipes/${recipe.slug}/beerxml?gal=10`} className="wh-btn-secondary" style={{ textDecoration: "none" }}>
            10 gal
          </a>
          <a href={`/recipes/${recipe.slug}/beerxml?litres=20`} className="wh-btn-secondary" style={{ textDecoration: "none" }}>
            20 L
          </a>
        </p>
      </section>

      <p style={{ fontSize: "0.8rem", color: "var(--wh-text-light)", marginTop: "2rem" }}>
        Archived from brewtoad.com on {recipe.sourceTimestamp} via the{" "}
        <a href={waybackUrl(recipe.sourceUrl, recipe.sourceTimestamp)} target="_blank" rel="noreferrer">
          Wayback Machine
        </a>
        . <Link href={`/takedown?recipe=${recipe.slug}`}>Request removal</Link>
        {recipe.cloneCount > 0 && (
          <> · Consolidated from {recipe.cloneCount} identical clone{recipe.cloneCount === 1 ? "" : "s"} archived separately.</>
        )}
      </p>
    </div>
  );
}
