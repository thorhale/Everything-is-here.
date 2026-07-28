export const dynamic = "force-dynamic";

import Link from "next/link";
import { getArchiveOverview, getTopStyles, getTopIngredients } from "@/lib/archive-stats";

export const metadata = {
  title: "Archive Insights — WortHogg",
  description:
    "What a hundred thousand homebrewers actually brewed: the most-brewed styles, most-used hops, malts and yeasts across the recovered BrewToad archive.",
};

function Leaderboard({
  title,
  items,
  linkBase,
}: {
  title: string;
  items: { name: string; recipes: number }[];
  linkBase?: (name: string) => string;
}) {
  const max = Math.max(...items.map((i) => i.recipes), 1);
  return (
    <div>
      <h3 style={{ fontSize: "1rem" }}>{title}</h3>
      <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((it, i) => (
          <li key={it.name} style={{ marginBottom: "0.35rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", gap: "0.5rem" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <span style={{ color: "var(--wh-text-light)", marginRight: "0.4rem" }}>{i + 1}.</span>
                {linkBase ? <Link href={linkBase(it.name)}>{it.name}</Link> : it.name}
              </span>
              <span style={{ color: "var(--wh-text-light)", whiteSpace: "nowrap" }}>
                {it.recipes.toLocaleString()}
              </span>
            </div>
            <div style={{ height: 4, background: "var(--wh-border-light)", borderRadius: 2 }}>
              <div style={{ width: `${(it.recipes / max) * 100}%`, height: "100%", background: "var(--wh-accent)", opacity: 0.6, borderRadius: 2 }} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default async function ArchivePage() {
  const [overview, topStyles, topIng] = await Promise.all([
    getArchiveOverview(),
    getTopStyles(20),
    getTopIngredients(15),
  ]);

  return (
    <div>
      <h1>Archive Insights</h1>
      <p style={{ color: "var(--wh-text-light)" }}>
        Style guidelines describe what a beer is supposed to be. This is what people actually
        brewed — aggregated across every recipe recovered from the archive.
      </p>

      <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", margin: "1.25rem 0" }}>
        {[
          ["Recipes", overview.recipes],
          ["Brewers", overview.brewers],
          ["Styles", overview.styles],
        ].map(([label, n]) => (
          <div key={label as string}>
            <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--wh-accent)", lineHeight: 1.1 }}>
              {(n as number).toLocaleString()}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--wh-text-light)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {label as string}
            </div>
          </div>
        ))}
      </div>

      <section>
        <h2 style={{ fontSize: "1.15rem" }}>Most-brewed styles</h2>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Style</th>
                <th>Recipes</th>
                <th className="hide-mobile">Median OG</th>
                <th className="hide-mobile">Median IBU</th>
                <th>Median ABV</th>
              </tr>
            </thead>
            <tbody>
              {topStyles.map((s) => (
                <tr key={s.styleName}>
                  <td>
                    <Link href={`/recipes?style=${encodeURIComponent(s.styleName)}`}>{s.styleName}</Link>
                  </td>
                  <td className="nowrap">{s.recipes.toLocaleString()}</td>
                  <td className="nowrap hide-mobile">{s.medianOg != null ? s.medianOg.toFixed(3) : "—"}</td>
                  <td className="nowrap hide-mobile">{s.medianIbu != null ? s.medianIbu.toFixed(0) : "—"}</td>
                  <td className="nowrap">{s.medianAbv != null ? `${s.medianAbv.toFixed(1)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2 style={{ fontSize: "1.15rem" }}>Most-used ingredients</h2>
        <p style={{ fontSize: "0.85rem", color: "var(--wh-text-light)", marginTop: "-0.3rem" }}>
          Number of recipes containing each ingredient, across the whole archive.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.5rem" }}>
          <Leaderboard title="Hops" items={topIng.hops} linkBase={(n) => `/hops/${encodeURIComponent(n)}`} />
          <Leaderboard title="Fermentables" items={topIng.fermentables} linkBase={(n) => `/fermentables/${encodeURIComponent(n)}`} />
          <Leaderboard title="Yeasts" items={topIng.yeasts} linkBase={(n) => `/yeasts/${encodeURIComponent(n)}`} />
        </div>
      </section>

      <p style={{ fontSize: "0.8rem", color: "var(--wh-text-light)", marginTop: "2rem" }}>
        Figures are medians rather than means — the archive is user-submitted and contains
        outliers that would drag an average around. Per-style detail, including how closely real
        recipes track the official ranges, appears on each{" "}
        <Link href="/guidelines">style guideline</Link> page.
      </p>
    </div>
  );
}
