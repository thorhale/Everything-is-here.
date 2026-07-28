export const dynamic = "force-dynamic";

import Link from "next/link";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

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
        BrewToad shut down on December 31, 2018. WortHogg recovered its recipes from the Internet
        Archive and rebuilt the calculator — then kept going.
      </p>

      {/* Headline numbers */}
      <div style={{ display: "flex", justifyContent: "center", gap: "2.5rem", flexWrap: "wrap", margin: "1.5rem 0" }}>
        <Stat n={c.recipes} label="recipes recovered" href="/recipes" />
        <Stat n={c.brewers} label="brewers" href="/brewers" />
        <Stat n={c.styles} label="styles catalogued" href="/guidelines" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: "1rem" }}>
        <Card
          title="The Archive"
          href="/recipes"
          blurb={`${c.recipes.toLocaleString()} real homebrew recipes. Search by name, style, ingredient, or by the numbers — ABV, IBU, colour, gravity. Export any of them as BeerXML straight into your brewing app.`}
          links={[
            ["Browse recipes", "/recipes"],
            ["Archive insights", "/archive"],
          ]}
        />
        <Card
          title="Calculators"
          href="/calculator"
          blurb="The original recipe calculator rebuilt from BrewToad's own formulas, plus a yeast pitching calculator, a water/salt builder, and a toolbox of the classic utilities — every formula validated against known reference values."
          links={[
            ["Recipe calculator", "/calculator"],
            ["Brewer's toolbox", "/tools"],
            ["Pitching rate", "/pitching"],
            ["Water & salts", "/water/builder"],
          ]}
        />
        <Card
          title="Ingredient databases"
          href="/yeasts/db"
          blurb={`${c.strains} yeast strains, ${c.fermentables} fermentables, ${c.hops} hops and ${c.water} water profiles — every entry sourced to a manufacturer spec sheet or published standard, and wired into the calculators.`}
          links={[
            ["Yeast", "/yeasts/db"],
            ["Fermentables", "/fermentables/db"],
            ["Hops", "/hops/db"],
            ["Water", "/water"],
          ]}
        />
        <Card
          title="Style guidelines"
          href="/guidelines"
          blurb="BJCP, World Beer Cup/GABF and wine guidelines — plus the legal standards of identity for spirits, because Scotch and bourbon have statutes rather than style sheets. Every style generates a starting recipe."
          links={[
            ["All guidelines", "/guidelines"],
            ["Spirits law", "/guidelines/spirits-2024"],
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
        <Card
          title="What brewers actually did"
          href="/archive"
          blurb="Guidelines say what a style should be. The archive shows what a hundred thousand people really brewed — median gravities, the hops and malts that actually turn up, and how closely real beer tracks the official ranges."
          links={[["Archive insights", "/archive"]]}
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
