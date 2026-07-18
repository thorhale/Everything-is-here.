// Consolidate BrewToad "clone" duplicates.
//
// BrewToad's "make a clone" button created a brand-new recipe (its own slug)
// that is a byte-identical copy of the original - same title, style, stats,
// and ingredient list. The Wayback import stores each as its own row, so the
// archive carries many identical copies. This script fingerprints every
// recipe by its *content* (not slug) and folds each set of identical clones
// into one canonical row, reassigning any comments / takedown requests first
// so nothing is lost, then deleting the redundant rows (their child
// fermentables/hops/yeasts cascade away).
//
// Usage:
//   tsx prisma/dedupe.ts            # DRY RUN - reports what it would do
//   tsx prisma/dedupe.ts --apply    # actually consolidate
//
// The fingerprint is deliberately strict (normalized title + style + batch +
// OG/FG + full sorted ingredient lists), so only genuine copies collapse;
// two different brewers' distinct recipes will not be merged.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");

function r3(n: number | null | undefined): string {
  return n == null ? "" : n.toFixed(3);
}

function normTitle(title: string | null): string {
  return (title ?? "")
    .toLowerCase()
    .replace(/^\s*copy of\s+/i, "")
    .replace(/\s*\(?copy\)?\s*$/i, "")
    .replace(/[\s\-_]+\d+\s*$/, "") // trailing "-2", " 3", "_4"
    .replace(/\s+/g, " ")
    .trim();
}

interface RecipeForFp {
  id: string;
  slug: string;
  title: string | null;
  styleName: string | null;
  batchSizeDisplay: string | null;
  og: number | null;
  fg: number | null;
  sourceTimestamp: string;
  parseConfidence: number;
  cloneCount: number;
  fermentables: { name: string; amountLb: number | null; colorLovibond: number | null }[];
  hops: { name: string; amountOz: number | null; timeMinutes: number | null }[];
  yeasts: { name: string }[];
  _count: { comments: number };
}

function fingerprint(rec: RecipeForFp): string {
  const ferms = rec.fermentables
    .map((f) => `${f.name.toLowerCase().trim()}|${r3(f.amountLb)}|${r3(f.colorLovibond)}`)
    .sort();
  const hops = rec.hops
    .map((h) => `${h.name.toLowerCase().trim()}|${r3(h.amountOz)}|${r3(h.timeMinutes)}`)
    .sort();
  const yeasts = rec.yeasts.map((y) => y.name.toLowerCase().trim()).sort();
  return JSON.stringify({
    t: normTitle(rec.title),
    s: (rec.styleName ?? "").toLowerCase().trim(),
    b: (rec.batchSizeDisplay ?? "").toLowerCase().replace(/\s+/g, ""),
    og: r3(rec.og),
    fg: r3(rec.fg),
    ferms,
    hops,
    yeasts,
  });
}

// Prefer the row that carries the most history: most comments, then the
// earliest snapshot, then highest parse confidence, then the shortest slug
// (originals rarely have a numeric suffix).
function pickCanonical(group: RecipeForFp[]): RecipeForFp {
  return [...group].sort((a, b) => {
    if (b._count.comments !== a._count.comments) return b._count.comments - a._count.comments;
    if (a.sourceTimestamp !== b.sourceTimestamp) return a.sourceTimestamp < b.sourceTimestamp ? -1 : 1;
    if (b.parseConfidence !== a.parseConfidence) return b.parseConfidence - a.parseConfidence;
    return a.slug.length - b.slug.length;
  })[0];
}

async function main(): Promise<void> {
  const recipes = (await prisma.recipe.findMany({
    select: {
      id: true,
      slug: true,
      title: true,
      styleName: true,
      batchSizeDisplay: true,
      og: true,
      fg: true,
      sourceTimestamp: true,
      parseConfidence: true,
      cloneCount: true,
      fermentables: { select: { name: true, amountLb: true, colorLovibond: true } },
      hops: { select: { name: true, amountOz: true, timeMinutes: true } },
      yeasts: { select: { name: true } },
      _count: { select: { comments: true } },
    },
  })) as RecipeForFp[];

  console.log(`${recipes.length} recipes loaded`);

  const groups = new Map<string, RecipeForFp[]>();
  for (const rec of recipes) {
    const fp = fingerprint(rec);
    const arr = groups.get(fp);
    if (arr) arr.push(rec);
    else groups.set(fp, [rec]);
  }

  const dupeGroups = [...groups.values()].filter((g) => g.length > 1);
  const redundant = dupeGroups.reduce((sum, g) => sum + g.length - 1, 0);

  console.log(
    `${dupeGroups.length} clone sets found, covering ${redundant} redundant rows ` +
      `(${recipes.length ? ((redundant / recipes.length) * 100).toFixed(1) : "0"}% of the table)`,
  );

  if (dupeGroups.length === 0) {
    return;
  }

  // Show a sample so a human can sanity-check before applying.
  for (const g of dupeGroups.slice(0, 10)) {
    const canonical = pickCanonical(g);
    const others = g.filter((x) => x.id !== canonical.id);
    console.log(
      `  keep "${canonical.slug}" (${canonical._count.comments} comments) ` +
        `<- ${others.map((o) => o.slug).join(", ")}`,
    );
  }
  if (dupeGroups.length > 10) console.log(`  ... and ${dupeGroups.length - 10} more sets`);

  if (!APPLY) {
    console.log("\nDRY RUN - re-run with --apply to consolidate.");
    return;
  }

  let merged = 0;
  for (const g of dupeGroups) {
    const canonical = pickCanonical(g);
    const others = g.filter((x) => x.id !== canonical.id);
    const otherIds = others.map((o) => o.id);

    await prisma.$transaction([
      // Preserve discussion + legal history by moving it onto the survivor.
      prisma.recipeComment.updateMany({
        where: { recipeId: { in: otherIds } },
        data: { recipeId: canonical.id },
      }),
      prisma.takedownRequest.updateMany({
        where: { recipeId: { in: otherIds } },
        data: { recipeId: canonical.id },
      }),
      // Child fermentables/hops/yeasts cascade-delete with the row.
      prisma.recipe.deleteMany({ where: { id: { in: otherIds } } }),
      prisma.recipe.update({
        where: { id: canonical.id },
        data: { cloneCount: canonical.cloneCount + others.length },
      }),
    ]);

    merged += others.length;
    if (merged % 500 < others.length) console.log(`  ... ${merged} rows consolidated`);
  }

  console.log(`done: consolidated ${merged} redundant rows into ${dupeGroups.length} canonical recipes`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
