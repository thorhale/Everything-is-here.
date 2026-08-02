// A static route, so `revalidate` would make Next prerender it at build time,
// where there is no database. Rendered per request instead; the detail routes
// that carry the real DB load are the ones cached.
export const dynamic = "force-dynamic";

import Link from "next/link";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { BEVERAGE_FAMILIES } from "@/lib/beverages";

// Full-table counts run on every homepage hit otherwise; the numbers only
// change when new data loads, so a 5-minute cache is plenty fresh.
const getCounts = unstable_cache(
  async () => {
    const [recipes, brewers, styles, strains, fermentables, hops, water] = await Promise.all([
      prisma.recipe.count({ where: { isHidden: false } }),
      prisma.brewer.count(),
      prisma.guidelineStyle.count(),
      prisma.yeastStrain.count(),
      prisma.fermentable.count(),
      prisma.hop.count(),
      prisma.waterProfile.count(),
    ]);
    return { recipes, brewers, styles, strains, fermentables, hops, water };
  },
  ["home-counts-v2"],
  { revalidate: 300 }
);

export default async function HomePage() {
  const c = await getCounts();

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/worthogg-logo.png"
          alt="WortHogg"
          style={{ maxWidth: "min(360px, 80%)", height: "auto" }}
        />
      </div>

      <p style={{ textAlign: "center", fontSize: "1.05rem", maxWidth: 640, margin: "0 auto 0.5rem" }}>
        Plan and calculate any ferment — beer, wine, cider, mead, sake, spirits and the world&apos;s
        traditional drinks — with sourced ingredient data and honest math.
      </p>

      {/* What are you making today? — the front door to the builder. */}
      <h2 style={{ textAlign: "center", fontSize: "1.15rem", marginTop: "1.5rem" }}>
        What are you making today?
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "0.6rem",
          maxWidth: 760,
          margin: "0.5rem auto 0",
        }}
      >
        {BEVERAGE_FAMILIES.map((f) => (
          <Link
            key={f.id}
            href={f.buildable ? `/build?beverage=${f.id}` : `/guidelines/b/${f.id}`}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.2rem",
              textAlign: "center",
              padding: "0.85rem 0.5rem",
              border: "1px solid var(--wh-border)",
              borderRadius: 10,
              background: "var(--wh-bg-soft)",
              textDecoration: "none",
            }}
          >
            <span style={{ fontSize: "1.8rem", lineHeight: 1 }}>{f.emoji}</span>
            <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{f.label}</span>
            <span style={{ fontSize: "0.72rem", color: "var(--wh-text-light)" }}>
              {f.buildable ? "Build a recipe" : "Browse styles"}
            </span>
          </Link>
        ))}
      </div>

      {/* Headline numbers */}
      <div style={{ display: "flex", justifyContent: "center", gap: "2.5rem", flexWrap: "wrap", margin: "2rem 0 1.5rem" }}>
        <Stat n={c.recipes} label="recipes in the archive" href="/recipes" />
        <Stat n={c.brewers} label="brewers" href="/brewers" />
        <Stat n={c.styles} label="styles catalogued" href="/guidelines" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: "1rem" }}>
        <Card
          title="The Archive"
          href="/recipes"
          blurb={`${c.recipes.toLocaleString()} real homebrew recipes. Search by name, style, ingredient, or by the numbers — ABV, IBU, colour, gravity. Export any of them as BeerXML straight into your brewing app.`}
          links={[["Browse recipes", "/recipes"]]}
        />
        <Card
          title="Calculators"
          href="/build"
          blurb="One recipe builder for every ferment — beer, cider, wine, mead, spirit washes and more — because underneath they are all sugar divided by volume. Plus pitching rate, water and salts, and the classic utilities, every formula validated against published reference values."
          links={[
            ["Recipe builder", "/build"],
            ["Brewer's toolbox", "/tools"],
            ["Pitching rate", "/pitching"],
            ["Water & salts", "/water/builder"],
          ]}
        />
        <Card
          title="Ingredient databases"
          href="/ingredients"
          blurb={`${c.strains} yeast strains, ${c.fermentables} fermentables, ${c.hops} hops and ${c.water} water profiles, plus the acids, nutrients, enzymes and oak — all in one place, every entry sourced, and all of it wired into the calculators.`}
          links={[
            ["All ingredients", "/ingredients"],
            ["Fermentables", "/fermentables/db"],
            ["Yeast", "/yeasts/db"],
            ["Hops", "/hops/db"],
            ["Additives", "/additives"],
            ["Download it all", "/data-download"],
          ]}
        />
        <Card
          title="Style guidelines"
          href="/guidelines"
          blurb="Pick what you're fermenting — beer, wine, cider, mead, sake, spirits or the world's traditional ferments — and see every relevant guideline and legal standard, from BJCP and the Maltose Falcons to Chinese baijiu law and Mongolian milk liquor."
          links={[
            ["All guidelines", "/guidelines"],
            ["Spirits", "/guidelines/b/spirit"],
            ["Sake & rice wine", "/guidelines/b/sake"],
            ["Traditional & regional", "/guidelines/b/traditional"],
          ]}
        />
        <Card
          title="Reference"
          href="/troubleshooting"
          blurb="What went wrong and whether it can be saved: diacetyl, DMS, oxidation, fusels and the rest — with causes, prevention, and an honest verdict on each. Plus yeast propagation and starter guidance."
          links={[
            ["Troubleshooting", "/troubleshooting"],
            ["Propagation guide", "/yeasts/propagation"],
          ]}
        />
      </div>

      <p style={{ fontSize: "0.8rem", color: "var(--wh-text-light)", marginTop: "2rem", textAlign: "center" }}>
        Free, unofficial, and unaffiliated with the original BrewToad. Recipes are
        community-contributed historical content, attributed where known —{" "}
        <Link href="/takedown">request removal</Link>.
      </p>
    </div>
  );
}

function Stat({ n, label, href }: { n: number; label: string; href: string }) {
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit", textAlign: "center" }}>
      <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--wh-accent)", lineHeight: 1.1 }}>
        {n.toLocaleString()}
      </div>
      <div style={{ fontSize: "0.78rem", color: "var(--wh-text-light)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
    </Link>
  );
}

function Card({
  title,
  blurb,
  href,
  links,
}: {
  title: string;
  blurb: string;
  href: string;
  links: [string, string][];
}) {
  return (
    <section
      style={{
        border: "1px solid var(--wh-border)",
        borderRadius: 8,
        padding: "1rem 1.1rem",
        background: "var(--wh-bg-soft)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <h2 style={{ fontSize: "1.05rem", marginTop: 0, marginBottom: "0.4rem" }}>
        <Link href={href} style={{ textDecoration: "none" }}>{title}</Link>
      </h2>
      <p style={{ fontSize: "0.88rem", margin: "0 0 0.7rem", flex: 1 }}>{blurb}</p>
      <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
        {links.map(([label, to]) => (
          <Link key={to} href={to} className="wh-style-chip" style={{ textDecoration: "none" }}>
            {label}
          </Link>
        ))}
      </div>
    </section>
  );
}
