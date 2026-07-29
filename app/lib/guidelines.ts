import { prisma } from "@/lib/db";
import { unstable_cache } from "next/cache";

// Editions grouped for the picker. BA editions are the judging basis for
// both the World Beer Cup and GABF, so they're presented under that label.
export const getEditions = unstable_cache(
  async () =>
    prisma.guidelineEdition.findMany({
      orderBy: [{ system: "asc" }, { year: "desc" }],
    }),
  ["guideline-editions"],
  { revalidate: 3600 }
);

export const getEdition = unstable_cache(
  async (id: string) =>
    prisma.guidelineEdition.findUnique({
      where: { id },
      include: {
        categories: {
          orderBy: { sortOrder: "asc" },
          include: { styles: { orderBy: { sortOrder: "asc" } } },
        },
      },
    }),
  ["guideline-edition"],
  { revalidate: 3600 }
);

// Style count per beverage family, for the "what am I fermenting?" landing.
export const getBeverageStyleCounts = unstable_cache(
  async (): Promise<Record<string, number>> => {
    const cats = await prisma.guidelineCategory.findMany({
      select: { beverage: true, _count: { select: { styles: true } } },
    });
    const out: Record<string, number> = {};
    for (const c of cats) {
      const b = c.beverage ?? "traditional";
      out[b] = (out[b] ?? 0) + c._count.styles;
    }
    return out;
  },
  ["guideline-beverage-counts-v1"],
  { revalidate: 3600 }
);

export interface BeverageEditionGroup {
  edition: { id: string; system: string; year: number; title: string; sourceType: string | null; sourceUrl: string; attribution: string };
  categories: {
    id: string;
    code: string | null;
    name: string;
    styles: { id: string; code: string | null; name: string; abvMin: number | null; abvMax: number | null }[];
  }[];
}

// All styles for a beverage, grouped by their source edition (provenance).
export const getStylesByBeverage = unstable_cache(
  async (beverage: string): Promise<BeverageEditionGroup[]> => {
    const cats = await prisma.guidelineCategory.findMany({
      where: { beverage },
      orderBy: [{ editionId: "asc" }, { sortOrder: "asc" }],
      include: {
        edition: true,
        styles: { orderBy: { sortOrder: "asc" }, select: { id: true, code: true, name: true, abvMin: true, abvMax: true } },
      },
    });
    const byEdition = new Map<string, BeverageEditionGroup>();
    for (const c of cats) {
      if (!byEdition.has(c.editionId)) {
        const e = c.edition;
        byEdition.set(c.editionId, {
          edition: { id: e.id, system: e.system, year: e.year, title: e.title, sourceType: e.sourceType, sourceUrl: e.sourceUrl, attribution: e.attribution },
          categories: [],
        });
      }
      byEdition.get(c.editionId)!.categories.push({ id: c.id, code: c.code, name: c.name, styles: c.styles });
    }
    // Competition first, then legal standards, then club, then traditional;
    // within a rank, newest year first.
    const rank = (t: string | null) => (t === "competition" ? 0 : t === "legal-standard" ? 1 : t === "club" ? 2 : 3);
    return [...byEdition.values()].sort(
      (a, b) =>
        rank(a.edition.sourceType) - rank(b.edition.sourceType) ||
        b.edition.year - a.edition.year ||
        a.edition.system.localeCompare(b.edition.system)
    );
  },
  ["guideline-styles-by-beverage-v1"],
  { revalidate: 3600 }
);

// Resolve a style within an edition by its code ("21A") or id suffix.
export async function findStyle(editionId: string, key: string) {
  const decoded = decodeURIComponent(key);
  return prisma.guidelineStyle.findFirst({
    where: {
      category: { editionId },
      OR: [{ code: { equals: decoded, mode: "insensitive" } }, { id: `${editionId}-${decoded}` }],
    },
    include: { category: { include: { edition: true } } },
  });
}

export function styleHref(editionId: string, style: { id: string; code: string | null }): string {
  const key = style.code ?? style.id.slice(editionId.length + 1);
  return `/guidelines/${editionId}/${encodeURIComponent(key)}`;
}

// Best guideline match for a recipe's styleName: the archive's style
// vocabulary is BrewToad-era BJCP, so prefer BJCP 2015, then other BJCP,
// then the newest BA edition.
export const matchGuidelineForStyleName = unstable_cache(
  async (styleName: string) => {
    const matches = await prisma.guidelineStyle.findMany({
      where: { name: { equals: styleName, mode: "insensitive" } },
      include: { category: { include: { edition: true } } },
      take: 20,
    });
    if (!matches.length) return null;
    const rank = (m: (typeof matches)[number]) => {
      const e = m.category.edition;
      if (e.id === "bjcp-2015") return 0;
      if (e.system === "BJCP") return 1;
      return 2 + (3000 - e.year) / 1000;
    };
    matches.sort((a, b) => rank(a) - rank(b));
    return matches[0];
  },
  ["guideline-style-match"],
  { revalidate: 3600 }
);
