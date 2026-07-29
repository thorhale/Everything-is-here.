export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { getStylesByBeverage, styleHref } from "@/lib/guidelines";
import { beverageFamily, BEVERAGE_FAMILIES } from "@/lib/beverages";

type Props = { params: Promise<{ beverage: string }> };

export async function generateMetadata({ params }: Props) {
  const { beverage } = await params;
  const fam = beverageFamily(beverage);
  if (!fam) return { title: "Guidelines — WortHogg" };
  return { title: `${fam.label} guidelines — WortHogg`, description: fam.blurb };
}

const SOURCE_BADGE: Record<string, { label: string; bg: string }> = {
  competition: { label: "Judging guideline", bg: "#2f6f4f" },
  "legal-standard": { label: "Legal standard", bg: "#6f4f2f" },
  club: { label: "Homebrew club", bg: "#4f2f6f" },
  traditional: { label: "Traditional / ethnographic", bg: "#555" },
};

export default async function BeverageGuidelinesPage({ params }: Props) {
  const { beverage } = await params;
  const fam = beverageFamily(beverage);
  if (!fam) notFound();

  const groups = await getStylesByBeverage(beverage);
  const total = groups.reduce((n, g) => n + g.categories.reduce((m, c) => m + c.styles.length, 0), 0);

  return (
    <div>
      <p style={{ fontSize: "0.85rem", marginBottom: "0.3rem" }}>
        <Link href="/guidelines">Style guidelines</Link> · what are you fermenting?
      </p>
      <h1 style={{ marginTop: 0 }}>
        <span aria-hidden style={{ marginRight: "0.5rem" }}>{fam.emoji}</span>
        {fam.label}
      </h1>
      <p style={{ color: "var(--wh-text-light)", maxWidth: 720 }}>{fam.blurb}</p>
      <p style={{ color: "var(--wh-text-light)", fontSize: "0.85rem" }}>
        {total.toLocaleString()} styles across {groups.length} {groups.length === 1 ? "source" : "sources"}.
        {fam.buildable && (
          <> Building one? <Link href="/build">Open the recipe builder →</Link></>
        )}
      </p>

      {/* Sibling beverages, for quick switching */}
      <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", margin: "0.75rem 0 1.5rem" }}>
        {BEVERAGE_FAMILIES.map((b) => (
          <Link
            key={b.id}
            href={`/guidelines/b/${b.id}`}
            className="wh-style-chip"
            style={{
              textDecoration: "none",
              fontWeight: b.id === fam.id ? 700 : 400,
              border: b.id === fam.id ? "2px solid var(--wh-accent)" : "1px solid var(--wh-border)",
            }}
          >
            {b.emoji} {b.label}
          </Link>
        ))}
      </div>

      {groups.length === 0 && <p>No styles catalogued for this family yet.</p>}

      {groups.map((g) => {
        const badge = SOURCE_BADGE[g.edition.sourceType ?? "traditional"] ?? SOURCE_BADGE.traditional;
        return (
          <section key={g.edition.id} style={{ marginBottom: "2rem" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap" }}>
              <h2 style={{ fontSize: "1.1rem", margin: "0" }}>
                <Link href={`/guidelines/${g.edition.id}`}>{g.edition.title}</Link>
              </h2>
              <span
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  color: "#fff",
                  background: badge.bg,
                  borderRadius: 4,
                  padding: "0.08rem 0.4rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                }}
              >
                {badge.label}
              </span>
              <span style={{ fontSize: "0.8rem", color: "var(--wh-text-light)" }}>{g.edition.year}</span>
            </div>

            {g.categories.map((c) => (
              <div key={c.id} style={{ marginTop: "0.6rem" }}>
                <h3 style={{ fontSize: "0.92rem", margin: "0 0 0.25rem", color: "var(--wh-text-light)" }}>
                  {c.code ? `${c.code}. ` : ""}{c.name}
                </h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                  {c.styles.map((s) => (
                    <Link
                      key={s.id}
                      href={styleHref(g.edition.id, s)}
                      className="wh-style-chip"
                      style={{ textDecoration: "none" }}
                      title={s.abvMin != null && s.abvMax != null ? `${s.abvMin}–${s.abvMax}% ABV` : undefined}
                    >
                      {s.code ? `${s.code} ` : ""}{s.name}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
