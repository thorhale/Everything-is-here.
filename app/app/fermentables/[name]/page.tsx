export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { recipesUsingFermentable } from "@/lib/ingredients";
import { RecipeList } from "@/components/RecipeList";

interface Props {
  params: Promise<{ name: string }>;
}

export default async function FermentableDetailPage({ params }: Props) {
  const { name: raw } = await params;
  const name = decodeURIComponent(raw);

  const stats = await prisma.$queryRaw<
    { uses: number; ppg: number | null; color: number | null; maltsters: string | null }[]
  >`
    SELECT count(*)::int AS uses,
           round(avg("ppg")::numeric, 0)::float AS ppg,
           round(avg("colorLovibond")::numeric, 0)::float AS color,
           string_agg(DISTINCT "maltster", ', ')
             FILTER (WHERE "maltster" IS NOT NULL AND "maltster" <> 'Any') AS maltsters
    FROM "RecipeFermentable" WHERE "name" = ${name}`;

  if (!stats[0] || stats[0].uses === 0) notFound();
  const recipes = await recipesUsingFermentable(name);

  return (
    <div>
      <h1>{name}</h1>
      <p style={{ color: "var(--wh-text-light)" }}>
        Used in {stats[0].uses.toLocaleString()} archived recipes
        {stats[0].ppg != null && <> · typical PPG {stats[0].ppg}</>}
        {stats[0].color != null && <> · typical color {stats[0].color} °L</>}
        {stats[0].maltsters && <> · maltsters: {stats[0].maltsters}</>}
      </p>
      <h3>Recent recipes using {name}</h3>
      <RecipeList recipes={recipes} />
      <p>
        <Link href="/fermentables">← All fermentables</Link>
      </p>
    </div>
  );
}
