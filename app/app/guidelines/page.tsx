export const dynamic = "force-dynamic";

import Link from "next/link";
import { getEditions, getBeverageStyleCounts } from "@/lib/guidelines";
import { BEVERAGE_FAMILIES } from "@/lib/beverages";

export const metadata = {
  title: "Style Guidelines — WortHogg",
  description:
    "Pick what you're fermenting — beer, wine, cider, mead, sake, spirits, fortified wine or the world's traditional ferments — and see every relevant style guideline and legal standard.",
};

const SYSTEM_LABELS: Record<string, string> = {
  BJCP: "BJCP",
  BA: "World Beer Cup / GABF (Brewers Association)",
  MF: "Maltose Falcons (homebrew club)",
  AWS: "American Wine Society",
  SPIRITS: "Spirits — Standards of Identity",
  FERMENTED: "Fortified, Aromatised & Traditional",
  BEERLAW: "Beer Law — Purity Laws & Designations",
  SAKE: "Sake — Legal Classification",
  CIDERLAW: "Cider & Perry — Appellations & Law",
  CHINA: "China — Baijiu & Huangjiu (GB standards)",
  KOREA: "Korea — Liquor Tax Act traditions",
  INDIA: "India & South Asia",
  CENTRALASIA: "Mongolia & Central Asia",
  AFRICA: "Africa — indigenous ferments",
  LATAM: "Latin America — maize, agave & cane",
  SEASIA: "Southeast Asia",
  EUROTRAD: "Europe — farmhouse & folk ferments",
  CULTURED: "Cultured & low-alcohol ferments",
};

const SYSTEM_ORDER = [
  "BJCP", "BA", "MF", "AWS", "SPIRITS", "FERMENTED", "BEERLAW", "SAKE", "CIDERLAW",
  "CHINA", "KOREA", "INDIA", "CENTRALASIA", "AFRICA", "LATAM", "SEASIA", "EUROTRAD", "CULTURED",
];

function orderSystems(present: Iterable<string>): string[] {
  const rest = [...present].filter((s) => !SYSTEM_ORDER.includes(s)).sort();
  return [...SYSTEM_ORDER.filter((s) => [...present].includes(s)), ...rest];
}

export default async function GuidelinesPage() {
  const [editions, counts] = await Promise.all([getEditions(), getBeverageStyleCounts()]);
  const bySystem = new Map<string, typeof editions>();
  for (const e of editions) {
    if (!bySystem.has(e.system)) bySystem.set(e.system, []);
    bySystem.get(e.system)!.push(e);
  }

  return (
    <div>
      <h1>Style guidelines</h1>
      <p style={{ color: "var(--wh-text-light)", maxWidth: 720 }}>
        Start with what you&apos;re making. Every family below pulls together the relevant
        guidelines and legal standards from across the world&apos;s sources — competition sheets
        where they exist, statutes and protected designations where they don&apos;t, and the
        ethnographic record for the drinks that answer to neither.
      </p>

      {/* What are you fermenting? */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.9rem", margin: "1.5rem 0 2rem" }}>
        {BEVERAGE_FAMILIES.map((b) => (
          <Link
            key={b.id}
            href={`/guidelines/b/${b.id}`}
            style={{
              textDecoration: "none",
              color: "inherit",
              border: "1px solid var(--wh-border)",
              borderRadius: 10,
              padding: "1rem 1.1rem",
              background: "var(--wh-bg-soft)",
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.15rem", fontWeight: 700 }}>
                <span aria-hidden style={{ marginRight: "0.4rem" }}>{b.emoji}</span>
                {b.label}
              </span>
              <span style={{ fontSize: "0.8rem", color: "var(--wh-accent)", fontWeight: 700, whiteSpace: "nowrap" }}>
                {(counts[b.id] ?? 0).toLocaleString()} styles
              </span>
            </div>
            <span style={{ fontSize: "0.85rem", color: "var(--wh-text-light)" }}>{b.blurb}</span>
          </Link>
        ))}
      </div>

      {/* Browse by source (provenance) */}
      <h2 style={{ fontSize: "1.1rem" }}>Or browse by source</h2>
      <p style={{ color: "var(--wh-text-light)", fontSize: "0.9rem", maxWidth: 720 }}>
        The individual editions, if you want a specific publisher or year — BJCP by edition, the
        Brewers Association&apos;s yearly sets, the Maltose Falcons&apos; club guide, and each legal
        or regional standard.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem", marginTop: "0.75rem" }}>
        {orderSystems(bySystem.keys()).map((sys) => {
          const eds = bySystem.get(sys) ?? [];
          if (!eds.length) return null;
          return (
            <section key={sys} style={{ border: "1px solid var(--wh-border)", borderRadius: 8, padding: "0.7rem 0.85rem" }}>
              <h3 style={{ fontSize: "0.95rem", margin: "0 0 0.4rem" }}>{SYSTEM_LABELS[sys] ?? sys}</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                {eds.map((e) => (
                  <Link key={e.id} href={`/guidelines/${e.id}`} className="wh-style-chip" style={{ textDecoration: "none" }}>
                    {e.year}
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
