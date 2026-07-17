export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { recipesUsingHop } from "@/lib/ingredients";
import { RecipeList } from "@/components/RecipeList";

interface Props {
  params: Promise<{ name: string }>;
}

export default async function HopDetailPage({ params }: Props) {
  const { name: raw } = await params;
  const name = decodeURIComponent(raw);

  const stats = await prisma.$queryRaw<
    { uses: number; alpha: number | null; forms: string | null }[]
  >`
    SELECT count(*)::int AS uses,
           round(avg("alphaAcidPct")::numeric, 1)::float AS alpha,
           string_agg(DISTINCT "form", ', ') FILTER (WHERE "form" IS NOT NULL) AS forms
    FROM "RecipeHop" WHERE "name" = ${name}`;

  if (!stats[0] || stats[0].uses === 0) notFound();
  const recipes = await recipesUsingHop(name);

  return (
    <div>
      <h1>{name}</h1>
      <p style={{ color: "var(--wh-text-light)" }}>
        Used in {stats[0].uses.toLocaleString()} archived recipes
        {stats[0].alpha != null && <> · typical alpha acid {stats[0].alpha}%</>}
        {stats[0].forms && <> · forms: {stats[0].forms}</>}
      </p>
      <h3>Recent recipes using {name}</h3>
      <RecipeList recipes={recipes} />
      <p>
        <Link href="/hops">← All hops</Link>
      </p>
    </div>
  );
}
