// Local-dev twin of load-guidelines.mjs: loads data/guidelines/*.json into
// the local Postgres via Prisma (the HTTPS driver in the .mjs only speaks
// Neon). Usage: npx tsx prisma/import-guidelines.ts
import { PrismaClient } from "@prisma/client";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();
const str = (v: unknown): string | null =>
  v == null ? null : Array.isArray(v) ? v.join(", ") : String(v);
const DATA_DIR = process.env.GUIDELINES_DIR || "../data/guidelines";

async function main() {
  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json")).sort();
  for (const f of files) {
    const doc = JSON.parse(readFileSync(join(DATA_DIR, f), "utf8"));
    const eid = `${doc.system.toLowerCase()}-${doc.year}`;
    await prisma.guidelineEdition.deleteMany({ where: { id: eid } });
    await prisma.guidelineEdition.create({
      data: {
        id: eid,
        system: doc.system,
        year: doc.year,
        title: doc.title,
        sourceUrl: doc.sourceUrl,
        attribution: doc.attribution,
      },
    });
    let styles = 0;
    for (let ci = 0; ci < doc.categories.length; ci++) {
      const c = doc.categories[ci];
      const cid = `${eid}-c${ci}`;
      await prisma.guidelineCategory.create({
        data: { id: cid, editionId: eid, code: c.code, name: c.name, sortOrder: ci },
      });
      await prisma.guidelineStyle.createMany({
        data: c.styles.map((s: Record<string, unknown>, si: number) => ({
          id: `${cid}-s${si}`,
          categoryId: cid,
          sortOrder: si,
          code: (s.code as string) ?? null,
          name: s.name as string,
          ogMin: (s.ogMin as number) ?? null, ogMax: (s.ogMax as number) ?? null,
          fgMin: (s.fgMin as number) ?? null, fgMax: (s.fgMax as number) ?? null,
          ibuMin: (s.ibuMin as number) ?? null, ibuMax: (s.ibuMax as number) ?? null,
          srmMin: (s.srmMin as number) ?? null, srmMax: (s.srmMax as number) ?? null,
          abvMin: (s.abvMin as number) ?? null, abvMax: (s.abvMax as number) ?? null,
          impression: str(s.impression), aroma: str(s.aroma),
          appearance: str(s.appearance), flavor: str(s.flavor),
          mouthfeel: str(s.mouthfeel), comments: str(s.comments),
          history: str(s.history), ingredients: str(s.ingredients),
          comparison: str(s.comparison), examples: str(s.examples),
          tags: str(s.tags),
        })),
      });
      styles += c.styles.length;
    }
    console.log(`${eid}: ${doc.categories.length} categories, ${styles} styles`);
  }
  console.log("done:", await prisma.guidelineStyle.count(), "styles total");
}

main().finally(() => prisma.$disconnect());
