import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BrewerPage({ params }: Props) {
  const { id } = await params;

  const brewer = await prisma.brewer.findUnique({
    where: { id },
    include: {
      recipes: {
        where: { isHidden: false },
        orderBy: { scrapedAt: "desc" },
      },
    },
  });

  if (!brewer) notFound();

  return (
    <div>
      <h1>{brewer.originalUsername}</h1>
      <p style={{ color: "#666" }}>{brewer.recipes.length} recipe(s) recovered</p>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {brewer.recipes.map((r) => (
          <li key={r.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid #eee" }}>
            <Link href={`/recipes/${r.slug}`}>{r.title ?? r.slug}</Link>
            {r.styleName && <span style={{ color: "#666" }}> · {r.styleName}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
