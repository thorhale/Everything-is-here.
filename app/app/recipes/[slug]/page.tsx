export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { StatBars, srmClass } from "@/components/StatBars";
import { getStyleRanges } from "@/lib/style-ranges";
import { PintGlass } from "@/components/PintGlass";

interface Props {
  params: Promise<{ slug: string }>;
}

function waybackUrl(url: string, timestamp: string): string {
  return `https://web.archive.org/web/${timestamp}/${url}`;
}

export default async function RecipeDetailPage({ params }: Props) {
  const { slug } = await params;

  const recipe = await prisma.recipe.findUnique({
    where: { slug },
    include: {
      brewer: true,
      fermentables: { orderBy: { sortOrder: "asc" } },
      hops: { orderBy: { sortOrder: "asc" } },
      yeasts: true,
      miscs: true,
      comments: true,
    },
  });

  if (!recipe || recipe.isHidden) {
    notFound();
  }

  const ranges = recipe.styleName ? await getStyleRanges(recipe.styleName) : null;

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
          {recipe.fermentables.length === 0 ? (
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
                {recipe.fermentables.map((f) => (
                  <tr key={f.id}>
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
          {recipe.hops.length === 0 ? (
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
                {recipe.hops.map((h) => (
                  <tr key={h.id}>
                    <td className="nowrap">{h.amountDisplay}</td>
                    <td className="nowrap">
                      <Link href={`/hops/${encodeURIComponent(h.name)}`}>{h.name}</Link>
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

          {recipe.yeasts.length > 0 && (
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
                  {recipe.yeasts.map((y) => (
                    <tr key={y.id}>
                      <td className="nowrap">
                        <Link href={`/yeasts/${encodeURIComponent(y.name)}`}>{y.name}</Link>
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

      <p style={{ fontSize: "0.8rem", color: "var(--wh-text-light)", marginTop: "2rem" }}>
        Archived from brewtoad.com on {recipe.sourceTimestamp} via the{" "}
        <a href={waybackUrl(recipe.sourceUrl, recipe.sourceTimestamp)} target="_blank" rel="noreferrer">
          Wayback Machine
        </a>
        . <Link href={`/takedown?recipe=${recipe.slug}`}>Request removal</Link>
      </p>
    </div>
  );
}
