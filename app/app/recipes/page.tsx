export const dynamic = "force-dynamic";

import Link from "next/link";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { srmClass } from "@/components/StatBars";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 25;

// The style-chip facet is a full-table groupBy; it barely changes, so cache
// it for 5 minutes instead of recomputing per request. The recipe list and
// search results themselves stay live.
const getTopStyles = unstable_cache(
  async () =>
    prisma.recipe.groupBy({
      by: ["styleName"],
      where: { isHidden: false, styleName: { not: null } },
      _count: true,
      orderBy: { _count: { styleName: "desc" } },
      take: 20,
    }),
  ["top-styles"],
  { revalidate: 300 }
);

interface Props {
  searchParams: Promise<{
    q?: string; style?: string; page?: string; sort?: string;
    abvMin?: string; abvMax?: string; ibuMin?: string; ibuMax?: string;
    srmMin?: string; srmMax?: string; ogMin?: string; ogMax?: string;
    hop?: string; malt?: string; yeast?: string;
  }>;
}

function num(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : undefined;
}

// Build a Prisma range filter, omitted entirely when neither bound is set.
function range(min: number | undefined, max: number | undefined) {
  if (min == null && max == null) return undefined;
  return { ...(min != null ? { gte: min } : {}), ...(max != null ? { lte: max } : {}) };
}

const SORTS: Record<string, Prisma.RecipeOrderByWithRelationInput> = {
  newest: { scrapedAt: "desc" },
  abvDesc: { abv: "desc" },
  abvAsc: { abv: "asc" },
  ibuDesc: { ibu: "desc" },
  ibuAsc: { ibu: "asc" },
  srmAsc: { srm: "asc" },
  srmDesc: { srm: "desc" },
};

export default async function RecipesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const sortKey = sp.sort && SORTS[sp.sort] ? sp.sort : "newest";

  const abv = range(num(sp.abvMin), num(sp.abvMax));
  const ibu = range(num(sp.ibuMin), num(sp.ibuMax));
  const srm = range(num(sp.srmMin), num(sp.srmMax));
  const og = range(num(sp.ogMin), num(sp.ogMax));

  const where: Prisma.RecipeWhereInput = {
    isHidden: false,
    ...(sp.q
      ? {
          OR: [
            { title: { contains: sp.q, mode: "insensitive" } },
            { styleName: { contains: sp.q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(sp.style ? { styleName: { equals: sp.style, mode: "insensitive" } } : {}),
    ...(abv ? { abv } : {}),
    ...(ibu ? { ibu } : {}),
    ...(srm ? { srm } : {}),
    ...(og ? { og } : {}),
    // Ingredient filters: recipes containing a matching line item.
    ...(sp.hop ? { hops: { some: { name: { contains: sp.hop, mode: "insensitive" } } } } : {}),
    ...(sp.malt ? { fermentables: { some: { name: { contains: sp.malt, mode: "insensitive" } } } } : {}),
    ...(sp.yeast ? { yeasts: { some: { name: { contains: sp.yeast, mode: "insensitive" } } } } : {}),
  };

  const [recipes, total, styles] = await Promise.all([
    prisma.recipe.findMany({
      where,
      orderBy: [SORTS[sortKey], { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { brewer: true },
    }),
    prisma.recipe.count({ where }),
    getTopStyles(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Preserve every active filter across pagination and chip links.
  const carry: Record<string, string> = {};
  for (const k of ["q","style","sort","abvMin","abvMax","ibuMin","ibuMax","srmMin","srmMax","ogMin","ogMax","hop","malt","yeast"] as const) {
    const v = sp[k];
    if (v) carry[k] = v;
  }
  const pageHref = (p: number) => `/recipes?${new URLSearchParams({ ...carry, page: String(p) })}`;
  const hasFilters = Object.keys(carry).some((k) => k !== "sort");

  return (
    <div>
      <h1>Recipes</h1>
      <p style={{ color: "var(--wh-text-light)", fontSize: "0.9rem" }}>
        Search {total > 0 ? "" : "the "}archive by name, style, ingredient, or by the numbers.
      </p>

      <form method="get" style={{ margin: "1rem 0" }}>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.6rem", flexWrap: "wrap" }}>
          <input type="text" name="q" defaultValue={sp.q} placeholder="Search by name or style..." style={{ flex: "1 1 220px", ...inp }} />
          <select name="sort" defaultValue={sortKey} style={inp}>
            <option value="newest">Newest</option>
            <option value="abvDesc">Strongest</option>
            <option value="abvAsc">Weakest</option>
            <option value="ibuDesc">Most bitter</option>
            <option value="ibuAsc">Least bitter</option>
            <option value="srmDesc">Darkest</option>
            <option value="srmAsc">Palest</option>
          </select>
          <button type="submit" className="wh-btn">Search</button>
        </div>

        {sp.style && <input type="hidden" name="style" value={sp.style} />}

        <details open={hasFilters && !(Object.keys(carry).length === 1 && carry.q)}>
          <summary style={{ cursor: "pointer", fontSize: "0.85rem", color: "var(--wh-link)" }}>
            Filters — ABV, IBU, colour, gravity, ingredients
          </summary>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "0.6rem" }}>
            <RangeField label="ABV %" minName="abvMin" maxName="abvMax" minVal={sp.abvMin} maxVal={sp.abvMax} />
            <RangeField label="IBU" minName="ibuMin" maxName="ibuMax" minVal={sp.ibuMin} maxVal={sp.ibuMax} />
            <RangeField label="SRM" minName="srmMin" maxName="srmMax" minVal={sp.srmMin} maxVal={sp.srmMax} />
            <RangeField label="OG" minName="ogMin" maxName="ogMax" minVal={sp.ogMin} maxVal={sp.ogMax} step="0.001" />
          </div>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "0.6rem" }}>
            <label style={lbl}>Contains hop<input type="text" name="hop" defaultValue={sp.hop} placeholder="Citra" style={inp} /></label>
            <label style={lbl}>Contains fermentable<input type="text" name="malt" defaultValue={sp.malt} placeholder="Munich" style={inp} /></label>
            <label style={lbl}>Contains yeast<input type="text" name="yeast" defaultValue={sp.yeast} placeholder="WLP001" style={inp} /></label>
          </div>
          <div style={{ marginTop: "0.6rem", display: "flex", gap: "0.5rem" }}>
            <button type="submit" className="wh-btn">Apply filters</button>
            {hasFilters && <Link href="/recipes" className="wh-btn-secondary" style={{ textDecoration: "none" }}>Clear all</Link>}
          </div>
        </details>
      </form>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1rem" }}>
        {styles.map((s) => (
          <Link
            key={s.styleName}
            href={`/recipes?${new URLSearchParams({ ...carry, style: s.styleName ?? "" })}`}
            className={`wh-style-chip${sp.style === s.styleName ? " active" : ""}`}
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

      {recipes.length === 0 && (
        <p style={{ color: "var(--wh-text-light)" }}>
          Nothing matched those filters. <Link href="/recipes">Start over →</Link>
        </p>
      )}

      <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
        {page > 1 && <Link href={pageHref(page - 1)}>← Previous</Link>}
        <span style={{ color: "var(--wh-text-light)" }}>
          Page {page} of {totalPages.toLocaleString()}
        </span>
        {page < totalPages && <Link href={pageHref(page + 1)}>Next →</Link>}
      </div>
    </div>
  );
}

function RangeField({
  label, minName, maxName, minVal, maxVal, step,
}: {
  label: string; minName: string; maxName: string;
  minVal?: string; maxVal?: string; step?: string;
}) {
  return (
    <label style={lbl}>
      {label}
      <span style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
        <input type="number" step={step ?? "any"} name={minName} defaultValue={minVal} placeholder="min" style={{ ...inp, width: 74 }} />
        <span style={{ color: "var(--wh-text-light)" }}>–</span>
        <input type="number" step={step ?? "any"} name={maxName} defaultValue={maxVal} placeholder="max" style={{ ...inp, width: 74 }} />
      </span>
    </label>
  );
}

const inp: React.CSSProperties = { padding: "0.3rem", border: "1px solid #ccc", borderRadius: 4 };
const lbl: React.CSSProperties = { display: "flex", flexDirection: "column", fontSize: "0.8rem", gap: "0.2rem" };
