export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/db";
import { srmClass } from "@/components/StatBars";

const PAGE_SIZE = 25;

interface Props {
  searchParams: Promise<{ q?: string; style?: string; page?: string }>;
}

export default async function RecipesPage({ searchParams }: Props) {
  const { q, style, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const where = {
    isHidden: false,
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { styleName: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(style ? { styleName: { equals: style, mode: "insensitive" as const } } : {}),
  };

  const [recipes, total, styles] = await Promise.all([
    prisma.recipe.findMany({
      where,
      orderBy: { scrapedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { brewer: true },
    }),
    prisma.recipe.count({ where }),
    prisma.recipe.groupBy({
      by: ["styleName"],
      where: { isHidden: false, styleName: { not: null } },
      _count: true,
      orderBy: { _count: { styleName: "desc" } },
      take: 20,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <h1>Recipes</h1>
      <form style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by name or style..."
          style={{ flex: 1 }}
        />
        <button type="submit">Search</button>
      </form>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1rem" }}>
        {styles.map((s) => (
          <Link
            key={s.styleName}
            href={`/recipes?style=${encodeURIComponent(s.styleName ?? "")}`}
            className={`wh-style-chip${style === s.styleName ? " active" : ""}`}
          >
            {s.styleName} ({s._count})
          </Link>
        ))}
      </div>

      <p style={{ color: "var(--wh-text-light)" }}>{total.toLocaleString()} recipes found</p>

      <ul style={{ listStyle: "none", padding: 0 }}>
        {recipes.map((r) => (
          <li key={r.id} style={{ padding: "0.75rem 0", borderBottom: "1px solid #eee" }}>
            <span className={`swatch ${srmClass(r.srm)}`} />
            <Link href={`/recipes/${r.slug}`} style={{ fontWeight: 600 }}>
              {r.title ?? r.slug}
            </Link>
            <div style={{ fontSize: "0.85rem", color: "var(--wh-text-light)", marginLeft: 20 }}>
              {r.styleName ?? "Unknown style"}
              {r.abv ? ` · ${r.abv}% ABV` : ""}
              {r.ibu ? ` · ${r.ibu} IBU` : ""}
              {r.brewer ? ` · by ${r.brewer.originalUsername}` : ""}
            </div>
          </li>
        ))}
      </ul>

      <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
        {page > 1 && (
          <Link
            href={`/recipes?${new URLSearchParams({ ...(q ? { q } : {}), ...(style ? { style } : {}), page: String(page - 1) })}`}
          >
            ← Previous
          </Link>
        )}
        <span style={{ color: "var(--wh-text-light)" }}>
          Page {page} of {totalPages.toLocaleString()}
        </span>
        {page < totalPages && (
          <Link
            href={`/recipes?${new URLSearchParams({ ...(q ? { q } : {}), ...(style ? { style } : {}), page: String(page + 1) })}`}
          >
            Next →
          </Link>
        )}
      </div>
    </div>
  );
}
