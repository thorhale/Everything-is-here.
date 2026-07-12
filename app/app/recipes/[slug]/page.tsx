export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { StatBars, srmClass } from "@/components/StatBars";

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

  return (
    <div>
      <h1 style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <span className={`swatch ${srmClass(recipe.srm)}`} style={{ width: 22, height: 22 }} />
        {recipe.title ?? recipe.slug}
      </h1>
      <p style={{ color: "var(--wh-text-light)" }}>
        {recipe.styleName}
        {recipe.brewer && (
          <>
            {" · by "}
            <Link href={`/brewers/${recipe.brewer.id}`}>{recipe.brewer.originalUsername}</Link>
          </>
        )}
      </p>

      <StatBars og={recipe.og} fg={recipe.fg} ibu={recipe.ibu} srm={recipe.srm} abv={recipe.abv} />

      <div style={{ fontSize: "0.85rem", color: "var(--wh-text-light)", marginBottom: "1rem" }}>
        {recipe.batchSizeDisplay && <>Batch size: {recipe.batchSizeDisplay} · </>}
        {recipe.boilTimeDisplay && <>Boil time: {recipe.boilTimeDisplay} · </>}
        {recipe.efficiencyDisplay && <>Efficiency: {recipe.efficiencyDisplay}</>}
        {recipe.ibuFormula && <> · IBU formula: {recipe.ibuFormula}</>}
      </div>

      <section>
        <h2>Fermentables</h2>
        {recipe.fermentables.length === 0 ? (
          <p style={{ color: "var(--wh-text-light)" }}>None listed.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Amount</th>
                <th>Fermentable</th>
                <th>Use</th>
                <th>PPG</th>
                <th>Color</th>
              </tr>
            </thead>
            <tbody>
              {recipe.fermentables.map((f) => (
                <tr key={f.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{f.amountDisplay}</td>
                  <td>
                    <span className={`swatch ${srmClass(f.colorLovibond)}`} />
                    {f.name}
                  </td>
                  <td>{f.use}</td>
                  <td>{f.ppg ?? ""}</td>
                  <td>{f.colorLovibond != null ? `${f.colorLovibond} °L` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>Hops</h2>
        {recipe.hops.length === 0 ? (
          <p style={{ color: "var(--wh-text-light)" }}>None listed.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Amount</th>
                <th>Hop</th>
                <th>Time</th>
                <th>Use</th>
                <th>Form</th>
                <th>AA</th>
              </tr>
            </thead>
            <tbody>
              {recipe.hops.map((h) => (
                <tr key={h.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{h.amountDisplay}</td>
                  <td>{h.name}</td>
                  <td>{h.timeDisplay}</td>
                  <td>{h.use}</td>
                  <td>{h.form}</td>
                  <td>{h.alphaAcidPct != null ? `${h.alphaAcidPct}%` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {recipe.yeasts.length > 0 && (
        <section>
          <h2>Yeasts</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Lab/Product</th>
                <th>Attenuation</th>
              </tr>
            </thead>
            <tbody>
              {recipe.yeasts.map((y) => (
                <tr key={y.id}>
                  <td>{y.name}</td>
                  <td>{y.labProduct}</td>
                  <td>{y.attenuationPct != null ? `${y.attenuationPct}%` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {recipe.notesText && (
        <section>
          <h2>Notes</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{recipe.notesText}</p>
        </section>
      )}

      {recipe.comments.length > 0 && (
        <section>
          <h2>Comments</h2>
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
        </section>
      )}

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
