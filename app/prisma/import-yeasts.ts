// Local-dev twin of load-yeasts.mjs: loads data/yeasts/*.json into Postgres
// via Prisma (the HTTPS driver in the .mjs only speaks Neon). Idempotent:
// each lab is upserted and its strains replaced. Run: npx tsx prisma/import-yeasts.ts
import { PrismaClient } from "@prisma/client";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();
const DATA_DIR = process.env.YEASTS_DIR || "../data/yeasts";

interface RawStrain {
  id: string;
  productCode?: string | null;
  name: string;
  aliases?: string[];
  form: string;
  species: string;
  uses?: string[];
  recommendedStyles?: string[];
  styleTags?: string[];
  attenuationMin?: number | null;
  attenuationMax?: number | null;
  tempMinF?: number | null;
  tempMaxF?: number | null;
  tempMinC?: number | null;
  tempMaxC?: number | null;
  flocculation?: string | null;
  alcoholToleranceMin?: number | null;
  alcoholToleranceMax?: number | null;
  cellsPerUnit?: number | null;
  unitLabel?: string | null;
  optimalPitchNote?: string | null;
  isBlend?: boolean;
  blendComponents?: string[];
  description?: string | null;
  flavorNotes?: string | null;
  sourceUrl: string;
  attribution?: string | null;
  sortOrder?: number;
}

interface RawDoc {
  lab: { id: string; name: string; country?: string | null; region?: string | null; url?: string | null; description?: string | null; sortOrder?: number };
  attribution?: string;
  strains: RawStrain[];
}

async function main(): Promise<void> {
  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json")).sort();
  for (const f of files) {
    const doc: RawDoc = JSON.parse(readFileSync(join(DATA_DIR, f), "utf8"));
    const { lab } = doc;

    await prisma.yeastLab.upsert({
      where: { id: lab.id },
      update: { name: lab.name, country: lab.country ?? null, region: lab.region ?? null, url: lab.url ?? null, description: lab.description ?? null, sortOrder: lab.sortOrder ?? 0 },
      create: { id: lab.id, name: lab.name, country: lab.country ?? null, region: lab.region ?? null, url: lab.url ?? null, description: lab.description ?? null, sortOrder: lab.sortOrder ?? 0 },
    });

    await prisma.yeastStrain.deleteMany({ where: { labId: lab.id } });
    await prisma.yeastStrain.createMany({
      data: doc.strains.map((s, i) => ({
        id: s.id,
        labId: lab.id,
        productCode: s.productCode ?? null,
        name: s.name,
        aliases: s.aliases ?? [],
        form: s.form,
        species: s.species,
        uses: s.uses ?? [],
        recommendedStyles: s.recommendedStyles ?? [],
        styleTags: s.styleTags ?? [],
        attenuationMin: s.attenuationMin ?? null,
        attenuationMax: s.attenuationMax ?? null,
        tempMinF: s.tempMinF ?? null,
        tempMaxF: s.tempMaxF ?? null,
        tempMinC: s.tempMinC ?? null,
        tempMaxC: s.tempMaxC ?? null,
        flocculation: s.flocculation ?? null,
        alcoholToleranceMin: s.alcoholToleranceMin ?? null,
        alcoholToleranceMax: s.alcoholToleranceMax ?? null,
        cellsPerUnit: s.cellsPerUnit ?? null,
        unitLabel: s.unitLabel ?? null,
        optimalPitchNote: s.optimalPitchNote ?? null,
        isBlend: s.isBlend ?? false,
        blendComponents: s.blendComponents ?? [],
        description: s.description ?? null,
        flavorNotes: s.flavorNotes ?? null,
        sourceUrl: s.sourceUrl,
        attribution: s.attribution ?? doc.attribution ?? null,
        sortOrder: s.sortOrder ?? i,
      })),
    });
    console.log(`${lab.id}: ${doc.strains.length} strains`);
  }
  const total = await prisma.yeastStrain.count();
  console.log(`done: ${total} strains`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
