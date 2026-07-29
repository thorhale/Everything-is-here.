export const dynamic = "force-dynamic";

import Link from "next/link";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

export const metadata = {
  title: "Ingredients — WortHogg",
  description:
    "Every ingredient database in one place: malts, adjuncts, sugars, honey, fruit, juice, wine grapes, hops, yeast, bacteria, water and additives.",
};

const getCounts = unstable_cache(
  async () => {
    const [fermentableByCat, hops, strains, labs, water, additiveByCat] = await Promise.all([
      prisma.fermentable.groupBy({ by: ["category"], _count: { _all: true } }),
      prisma.hop.count(),
      prisma.yeastStrain.count(),
      prisma.yeastLab.count(),
      prisma.waterProfile.count(),
      prisma.additive.groupBy({ by: ["category"], _count: { _all: true } }),
    ]);
    const ferm: Record<string, number> = {};
    for (const r of fermentableByCat) ferm[r.category] = r._count._all;
    const add: Record<string, number> = {};
    for (const r of additiveByCat) add[r.category] = r._count._all;
    return {
      ferm,
      fermTotal: Object.values(ferm).reduce((a, b) => a + b, 0),
      hops,
      strains,
      labs,
      water,
      add,
      addTotal: Object.values(add).reduce((a, b) => a + b, 0),
    };
  },
  ["ingredient-hub-counts-v1"],
  { revalidate: 3600 }
);

const n = (v: number | undefined) => (v ?? 0).toLocaleString();

export default async function IngredientsPage() {
  const c = await getCounts();

  return (
    <div>
      <h1>Ingredients</h1>
      <p style={{ color: "var(--wh-text-light)", maxWidth: 720 }}>
        Everything that can go in a fermenter, in one place. The same catalog feeds every calculator on the site — pick
        an ingredient here and it carries its extract, colour, acid and source straight into the{" "}
        <Link href="/build">recipe builder</Link>, whether you are making beer, cider, wine, mead or a wash.
      </p>
      <p style={{ color: "var(--wh-text-light)", maxWidth: 720, fontSize: "0.9rem" }}>
        Nothing here is invented. Every record carries its own <code>sourceUrl</code> — a maltster&apos;s spec sheet, a
        published composition table, a legal standard — and where a figure could not be sourced it is left empty rather
        than guessed. Where a value is derived, the inputs travel with it so you can check the arithmetic.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem", margin: "1.5rem 0" }}>
        <Card
          title="Fermentables"
          count={`${n(c.fermTotal)} entries`}
          href="/fermentables/db"
          blurb="Everything that contributes sugar — from Maris Otter through turbinado and Thai coconut sugar to whole fruit and pressed juice."
          rows={[
            ["Base malts", c.ferm["base-malt"], "/fermentables/db?category=base-malt"],
            ["Specialty malts", c.ferm["specialty-malt"], "/fermentables/db?category=specialty-malt"],
            ["Adjunct grains", c.ferm["adjunct-grain"], "/fermentables/db?category=adjunct-grain"],
            ["Cereals & novelty", c.ferm["cereal"], "/fermentables/db?category=cereal"],
            ["Sugars & syrups", (c.ferm["sugar"] ?? 0) + (c.ferm["syrup"] ?? 0), "/fermentables/db?category=sugar"],
            ["Honey", c.ferm["honey"], "/fermentables/db?category=honey"],
            ["Fruit", c.ferm["fruit"], "/fermentables/db?category=fruit"],
            ["Juice & concentrate", c.ferm["juice"], "/fermentables/db?category=juice"],
            ["Wine grapes", c.ferm["wine-grape"], "/fermentables/db?category=wine-grape"],
          ]}
        />

        <Card
          title="Hops"
          count={`${n(c.hops)} varieties`}
          href="/hops/db"
          blurb="Alpha and beta acids, cohumulone, the oil breakdown, aroma descriptors and substitutions — noble through to the newest New Zealand releases."
          rows={[["Browse all hops", c.hops, "/hops/db"]]}
        />

        <Card
          title="Yeast & bacteria"
          count={`${n(c.strains)} strains, ${n(c.labs)} producers`}
          href="/yeasts/db"
          blurb="Beer, wine, cider, mead, sake and distilling strains, plus Brettanomyces, Lactobacillus, Pediococcus and mixed cultures. Searchable by what you are making."
          rows={[
            ["All strains", c.strains, "/yeasts/db"],
            ["Propagation & starters", null, "/yeasts/propagation"],
            ["Pitching calculator", null, "/pitching"],
          ]}
        />

        <Card
          title="Water"
          count={`${n(c.water)} profiles`}
          href="/water"
          blurb="The six brewing ions for classic and modern brewing cities — Burton, Dublin, Pilsen, Munich, Chico, San Diego — plus style targets."
          rows={[
            ["All profiles", c.water, "/water"],
            ["Salt & pH builder", null, "/water/builder"],
          ]}
        />

        <Card
          title="Additives"
          count={`${n(c.addTotal)} entries`}
          href="/additives"
          blurb="Everything that goes in without contributing sugar: acids, nutrients, enzymes, finings, tannins, oak, stabilisers and botanicals — each with what a gram of it actually does."
          rows={[
            ["Acids & deacidifiers", (c.add["acid"] ?? 0) + (c.add["deacidifier"] ?? 0), "/additives?category=acid"],
            ["Nutrients", c.add["nutrient"], "/additives?category=nutrient"],
            ["Enzymes", c.add["enzyme"], "/additives?category=enzyme"],
            ["Finings", c.add["fining"], "/additives?category=fining"],
            ["Tannins & wood", (c.add["tannin"] ?? 0) + (c.add["wood"] ?? 0), "/additives?category=tannin"],
            ["Stabilisers", c.add["stabiliser"], "/additives?category=stabiliser"],
            ["Botanicals & spices", c.add["botanical"], "/additives?category=botanical"],
          ]}
        />

        <Card
          title="Take it with you"
          count="One JSON file"
          href="/data-download"
          blurb="The whole reference compilation as a single download. BrewToad died and took its database with it — it would be daft to build another one nobody can rescue."
          rows={[
            ["Download the data", null, "/data-download"],
            ["Raw JSON endpoint", null, "/data"],
          ]}
        />
      </div>

      <h2 style={{ fontSize: "1.05rem" }}>How the numbers hold together</h2>
      <p style={{ fontSize: "0.9rem", maxWidth: 720 }}>
        Malt is quoted in PPG, fruit in grams of sugar per 100 g, juice and must in degrees Brix, and honey by weight
        with a moisture figure. Those are four different trade conventions for one physical quantity, and they reduce to
        each other through a single identity: <strong>PPG = 46 × sugar mass fraction</strong>, because a pound of sucrose
        in a US gallon reads 1.046. That is what lets one recipe builder handle a grain bill and a fruit press without
        keeping two sets of books.
      </p>
      <p style={{ fontSize: "0.9rem", maxWidth: 720 }}>
        Fruit carries a low, typical and high sugar figure rather than a single value, because that is the honest
        description of a biological product. Cultivar, season, ripeness and how long it sat in a warehouse move apple
        sugar between roughly 9 and 14 g per 100 g. The builder propagates that spread into a gravity band, and a
        refractometer reading collapses it.
      </p>
    </div>
  );
}

function Card({
  title,
  count,
  href,
  blurb,
  rows,
}: {
  title: string;
  count: string;
  href: string;
  blurb: string;
  rows: [string, number | null | undefined, string][];
}) {
  return (
    <section
      style={{
        border: "1px solid var(--wh-border)",
        borderRadius: 8,
        padding: "0.9rem 1rem",
        background: "var(--wh-bg-soft)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <h2 style={{ fontSize: "1.05rem", marginTop: 0, marginBottom: "0.15rem" }}>
        <Link href={href} style={{ textDecoration: "none" }}>
          {title}
        </Link>
      </h2>
      <div style={{ fontSize: "0.78rem", color: "var(--wh-accent)", fontWeight: 700, marginBottom: "0.4rem" }}>{count}</div>
      <p style={{ fontSize: "0.86rem", margin: "0 0 0.6rem", flex: 1 }}>{blurb}</p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.85rem" }}>
        {rows
          .filter(([, v]) => v == null || v > 0)
          .map(([label, value, to]) => (
            <li key={to + label} style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", padding: "0.1rem 0" }}>
              <Link href={to}>{label}</Link>
              {value != null && <span style={{ color: "var(--wh-text-light)" }}>{value.toLocaleString()}</span>}
            </li>
          ))}
      </ul>
    </section>
  );
}
