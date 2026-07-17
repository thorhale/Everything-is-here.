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
