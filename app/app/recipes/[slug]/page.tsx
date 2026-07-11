import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

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
      <h1>{recipe.title ?? recipe.slug}</h1>
      <p style={{ color: "#666" }}>
        {recipe.styleName}
        {recipe.brewer && (
          <>
            {" · by "}
            <Link href={`/brewers/${recipe.brewer.id}`}>{recipe.brewer.originalUsername}</Link>
          </>
        )}
      </p>

      <div style={{ display: "flex", gap: "1.5rem", margin: "1rem 0", flexWrap: "wrap" }}>
        {recipe.og != null && <Stat label="OG" value={recipe.og.toFixed(3)} />}
        {recipe.fg != null && <Stat label="FG" value={recipe.fg.toFixed(3)} />}
        {recipe.abv != null && <Stat label="ABV" value={`${recipe.abv}%`} />}
        {recipe.ibu != null && <Stat label="IBU" value={String(recipe.ibu)} />}
        {recipe.srm != null && <Stat label="SRM" value={String(recipe.srm)} />}
      </div>

      <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "1rem" }}>
        {recipe.batchSizeDisplay && <>Batch size: {recipe.batchSizeDisplay} · </>}
        {recipe.boilTimeDisplay && <>Boil time: {recipe.boilTimeDisplay} · </>}
        {recipe.efficiencyDisplay && <>Efficiency: {recipe.efficiencyDisplay}</>}
      </div>

      <section>
        <h2>Fermentables</h2>
        <IngredientTable
          headers={["Amount", "Name", "Use", "PPG", "Color"]}
          rows={recipe.fermentables.map((f) => [
            f.amountDisplay ?? "",
            f.name,
            f.use ?? "",
            f.ppg != null ? String(f.ppg) : "",
            f.colorLovibond != null ? `${f.colorLovibond} °L` : "",
          ])}
        />
      </section>

      <section>
        <h2>Hops</h2>
        <IngredientTable
          headers={["Amount", "Name", "Time", "Use", "Form", "AA%"]}
          rows={recipe.hops.map((h) => [
            h.amountDisplay ?? "",
            h.name,
            h.timeDisplay ?? "",
            h.use ?? "",
            h.form ?? "",
            h.alphaAcidPct != null ? `${h.alphaAcidPct}%` : "",
          ])}
        />
      </section>

      {recipe.yeasts.length > 0 && (
        <section>
          <h2>Yeast</h2>
          <IngredientTable
            headers={["Name", "Lab/Product", "Attenuation"]}
            rows={recipe.yeasts.map((y) => [
              y.name,
              y.labProduct ?? "",
              y.attenuationPct != null ? `${y.attenuationPct}%` : "",
            ])}
          />
        </section>
      )}

      {recipe.notesText && (
        <section>
          <h2>Notes</h2>
          <p style={{ whiteSpace: "pre-wrap", color: "#333" }}>{recipe.notesText}</p>
        </section>
      )}

      {recipe.comments.length > 0 && (
        <section>
          <h2>Comments</h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {recipe.comments.map((c) => (
              <li key={c.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid #eee" }}>
                <strong>{c.commenter ?? "anonymous"}</strong>{" "}
                <span style={{ color: "#999", fontSize: "0.8rem" }}>{c.timestampDisplay}</span>
                <p style={{ margin: "0.25rem 0 0" }}>{c.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p style={{ fontSize: "0.8rem", color: "#999", marginTop: "2rem" }}>
        Archived from brewtoad.com on {recipe.sourceTimestamp} via the{" "}
        <a href={waybackUrl(recipe.sourceUrl, recipe.sourceTimestamp)} target="_blank" rel="noreferrer">
          Wayback Machine
        </a>
        . <Link href={`/takedown?recipe=${recipe.slug}`}>Request removal</Link>
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: "0.75rem", color: "#999", textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

function IngredientTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  if (rows.length === 0) return <p style={{ color: "#999" }}>None listed.</p>;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "1rem" }}>
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h} style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "0.3rem" }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} style={{ padding: "0.3rem", borderBottom: "1px solid #f0f0f0" }}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
