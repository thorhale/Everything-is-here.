export const dynamic = "force-dynamic";

import Link from "next/link";
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

  const stats = await prisma.$queryRaw<
    { uses: number; attenuation: number | null; labs: string | null }[]
  >`
    SELECT count(*)::int AS uses,
           round(avg("attenuationPct")::numeric, 1)::float AS attenuation,
           string_agg(DISTINCT "labProduct", ', ') FILTER (WHERE "labProduct" IS NOT NULL) AS labs
    FROM "RecipeYeast" WHERE "name" = ${name}`;

  if (!stats[0] || stats[0].uses === 0) notFound();
  const recipes = await recipesUsingYeast(name);

  return (
    <div>
      <h1>{name}</h1>
      <p style={{ color: "var(--wh-text-light)" }}>
        Used in {stats[0].uses.toLocaleString()} archived recipes
        {stats[0].attenuation != null && <> · typical attenuation {stats[0].attenuation}%</>}
        {stats[0].labs && <> · {stats[0].labs}</>}
      </p>
      <h3>Recent recipes using {name}</h3>
      <RecipeList recipes={recipes} />
      <p>
        <Link href="/yeasts">← All yeasts</Link>
      </p>
    </div>
  );
}
