export const dynamic = "force-dynamic";

import Link from "next/link";
import { getOrigins, type OriginItem } from "@/lib/origins";
import { langProps } from "@/lib/script";

export const metadata = {
  title: "By place of origin — WortHogg",
  description:
    "The hops, water profiles, yeast producers and malts of the reference library, organised by the country they come from and sorted alphabetically.",
};

function Column({ title, items, more }: { title: string; items: OriginItem[]; more?: string }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 style={{ fontSize: "0.85rem", margin: "0 0 0.3rem", textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--wh-text-light)" }}>
        {title} <span style={{ fontWeight: 400 }}>({items.length})</span>
      </h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.88rem", lineHeight: 1.6 }}>
        {items.map((i) => (
          <li key={i.href}>
            <Link href={i.href} {...langProps(i.name)}>{i.name}</Link>
            {i.detail && <span style={{ color: "var(--wh-text-light)" }}> — {i.detail}</span>}
          </li>
        ))}
      </ul>
      {more && (
        <p style={{ fontSize: "0.8rem", margin: "0.3rem 0 0" }}>
          <Link href={more}>All →</Link>
        </p>
      )}
    </div>
  );
}

export default async function OriginsPage() {
  const countries = await getOrigins();
  const total = countries.reduce((n, c) => n + c.total, 0);

  return (
    <div>
      <h1>By place of origin</h1>
      <p style={{ color: "var(--wh-text-light)", maxWidth: 760 }}>
        Brewing is regional before it is anything else — Saaz hops, Pilsen water and a Czech lager
        yeast are one fact told three ways. This is the reference library read by country instead of
        by category: {total.toLocaleString()} entries across {countries.length} countries, each list
        alphabetical.
      </p>
      <p style={{ fontSize: "0.85rem", color: "var(--wh-text-light)", maxWidth: 760 }}>
        Sorted with a locale-aware collator, so accented names file under their base letter rather
        than after Z. Country spellings are normalised — the datasets were curated separately and
        &ldquo;USA&rdquo;, &ldquo;US&rdquo; and &ldquo;United States&rdquo; all appeared.
      </p>

      <nav style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", margin: "1.25rem 0" }}>
        {countries.map((c) => (
          <a
            key={c.country}
            href={`#c-${encodeURIComponent(c.country)}`}
            style={{
              fontSize: "0.85rem", padding: "0.15rem 0.55rem",
              border: "1px solid var(--wh-border)", borderRadius: 6, textDecoration: "none",
            }}
          >
            {c.country} <span style={{ color: "var(--wh-text-light)" }}>{c.total}</span>
          </a>
        ))}
      </nav>

      {countries.map((c) => (
        <section
          key={c.country}
          id={`c-${encodeURIComponent(c.country)}`}
          style={{ borderTop: "1px solid var(--wh-border)", paddingTop: "0.9rem", marginTop: "1.25rem" }}
        >
          <h2 style={{ fontSize: "1.15rem", margin: "0 0 0.6rem" }}>{c.country}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.25rem" }}>
            <Column title="Hops" items={c.hops} more="/hops/db" />
            <Column title="Water" items={c.water} more="/water" />
            <Column title="Yeast producers" items={c.yeastLabs} more="/yeasts/db" />
            <Column title="Malts & fermentables" items={c.fermentables} more="/fermentables/db" />
          </div>
        </section>
      ))}

      <p style={{ marginTop: "2rem", fontSize: "0.85rem", color: "var(--wh-text-light)", maxWidth: 760 }}>
        Style guidelines are organised by region on the{" "}
        <Link href="/guidelines">guidelines</Link> page, which carries editions for China, Korea,
        Japan, India, Central Asia, Africa, Latin America, Southeast Asia, Europe and North America.
        Fermentables whose origin names several wine regions rather than one country are left off
        this page and kept on their own entries.
      </p>
    </div>
  );
}
