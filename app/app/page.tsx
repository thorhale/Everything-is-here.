import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function HomePage() {
  const recipeCount = await prisma.recipe.count({ where: { isHidden: false } });
  const brewerCount = await prisma.brewer.count();

  return (
    <div>
      <h1>WortHogg</h1>
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
