// Curated and archived data, rewritten only when a loader runs, so a render
// per visit bought nothing and kept the Neon compute endpoint awake. Cached
// and revalidated hourly instead.
export const revalidate = 3600;

import Link from "next/link";
import { statsForName } from "@/lib/archive-rollups";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { recipesUsingYeast } from "@/lib/ingredients";
import { RecipeList } from "@/components/RecipeList";

interface Props {
  params: Promise<{ name: string }>;
}

export default async function YeastDetailPage({ params }: Props) {
  const { name: raw } = await params;
  const name = decodeURIComponent(raw);

  // From the precomputed rollups, not from a junction table — those tables
  // have left Postgres (docs/storage-efficiency.md, tier 3).
  const stats = await statsForName("yeast", name);
  if (!stats) notFound();
  const recipes = await recipesUsingYeast(name);

  return (
    <div>
      <h1>{name}</h1>
      <p style={{ color: "var(--wh-text-light)" }}>
        Used in {stats.recipes.toLocaleString()} archived recipe
        {stats.recipes === 1 ? "" : "s"}
        {/* `recipes` not `uses`: uses counts ingredient ROWS, and a recipe lists
            the same hop several times (bittering, flavour, aroma, dry hop), so
            the row count overstated this by up to 2.5x. */}
        {stats.attenuation != null && <> · typical attenuation {stats.attenuation}%</>}
        {stats.labs && <> · labs: {stats.labs}</>}
      </p>
      <h3>Recent recipes using {name}</h3>
      <RecipeList recipes={recipes} />
      <p>
        <Link href="/yeasts">← All yeasts</Link>
      </p>
    </div>
  );
}
