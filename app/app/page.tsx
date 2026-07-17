export const dynamic = "force-dynamic";

import Link from "next/link";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

// These full-table counts run on every homepage hit otherwise; the numbers
// only change when new data loads, so a 5-minute cache is plenty fresh.
const getCounts = unstable_cache(
  async () => {
    const [recipeCount, brewerCount] = await Promise.all([
      prisma.recipe.count({ where: { isHidden: false } }),
      prisma.brewer.count(),
    ]);
    return { recipeCount, brewerCount };
  },
  ["home-counts"],
  { revalidate: 300 }
);

export default async function HomePage() {
  const { recipeCount, brewerCount } = await getCounts();

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: "1rem" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/worthogg-logo.png"
          alt="WortHogg"
          style={{ maxWidth: "min(360px, 80%)", height: "auto" }}
        />
      </div>
      <p>
        BrewToad was a free homebrew recipe calculator and recipe-sharing site that shut down
        on December 31, 2018. WortHogg is a community effort to recover its recipes and
        calculator from the Internet Archive Wayback Machine and make them available again for
        free.
      </p>
      <p>
        <strong>{recipeCount.toLocaleString()}</strong> recipes recovered so far from{" "}
        <strong>{brewerCount.toLocaleString()}</strong> brewers, with more being added as the
        recovery process continues.
      </p>
      <p>
        <Link href="/recipes">Browse recipes →</Link>
        {" · "}
        <Link href="/calculator">Use the calculator →</Link>
      </p>
    </div>
  );
}
