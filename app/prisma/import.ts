// Import scraper output (data/parsed/*.jsonl, one ParsedRecipe-shaped JSON
// object per line - see scraper/pipeline.py) into Postgres per schema.prisma.
//
// Usage: tsx prisma/import.ts [path/to/recipes.jsonl]
// Idempotent: upserts by slug, safe to re-run against a growing file while
// the scraper is still appending (M2 runs for a long time).

import { PrismaClient } from "@prisma/client";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

const prisma = new PrismaClient();

const NUM_RE = /-?\d+\.?\d*/;

function num(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.match(NUM_RE);
  return m ? parseFloat(m[0]) : null;
}

const KG_TO_LB = 2.20462;
const G_TO_OZ = 0.035274;

function weightLb(s: string | null | undefined): number | null {
  const v = num(s);
  if (v === null) return null;
  return s && /kg/i.test(s) ? v * KG_TO_LB : v;
}

function weightOz(s: string | null | undefined): number | null {
  const v = num(s);
  if (v === null) return null;
  return s && /\bg\b/i.test(s) ? v * G_TO_OZ : v;
}

interface ParsedHtmlFermentable {
  amount_display: string | null;
  percent: string | null;
  name: string;
  maltster: string | null;
  use: string | null;
  ppg: string | null;
  color_lovibond: string | null;
  ref_url: string | null;
}

interface ParsedHtmlHop {
  amount_display: string | null;
  name: string;
  time_display: string | null;
  use: string | null;
  form: string | null;
  alpha_acid: string | null;
  ref_url: string | null;
}

interface ParsedHtmlYeast {
  name: string;
  lab_product: string | null;
  attenuation: string | null;
  ref_url: string | null;
}

interface ParsedHtmlComment {
  comment_id: string | null;
  commenter: string | null;
  commenter_profile_url: string | null;
  timestamp_display: string | null;
  text: string;
  parent_comment_id: string | null;
}

interface ParsedHtml {
  slug: string;
  title: string | null;
  style: string | null;
  og: string | null;
  fg: string | null;
  ibu: string | null;
  srm: string | null;
  abv: string | null;
  batch_size_display: string | null;
  boil_time_display: string | null;
  efficiency_display: string | null;
  ibu_formula: string | null;
  notes_text: string | null;
  fermentables: ParsedHtmlFermentable[];
  hops: ParsedHtmlHop[];
  yeasts: ParsedHtmlYeast[];
  comments: ParsedHtmlComment[];
  parse_warnings: string[];
}

interface ParsedXml {
  brewer: string | null;
}

interface ScrapedRecord {
  slug: string;
  status: string;
  source: {
    html_url: string;
    html_timestamp: string;
    xml_url: string | null;
    xml_timestamp: string | null;
  };
  html: ParsedHtml;
  xml: ParsedXml | null;
  parse_confidence: number;
}

async function getOrCreateBrewer(username: string | null): Promise<string | null> {
  if (!username) return null;
  const brewer = await prisma.brewer.upsert({
    where: { originalUsername: username },
    update: {},
    create: { originalUsername: username },
  });
  return brewer.id;
}

async function importRecord(rec: ScrapedRecord): Promise<void> {
  const { html, xml, source } = rec;
  const brewerId = await getOrCreateBrewer(xml?.brewer ?? null);

  await prisma.recipe.upsert({
    where: { slug: rec.slug },
    update: {},
    create: {
      slug: rec.slug,
      title: html.title,
      styleName: html.style,
      og: num(html.og),
      fg: num(html.fg),
      ibu: num(html.ibu),
      srm: num(html.srm),
      abv: num(html.abv),
      ibuFormula: html.ibu_formula,
      batchSizeDisplay: html.batch_size_display,
      boilTimeDisplay: html.boil_time_display,
      efficiencyDisplay: html.efficiency_display,
      notesText: html.notes_text,
      brewerId,
      sourceUrl: source.html_url,
      sourceTimestamp: source.html_timestamp,
      parseSource: source.xml_url ? "html+xml_crossvalidated" : "html",
      parseConfidence: rec.parse_confidence,
      fermentables: {
        create: html.fermentables.map((f, i) => ({
          name: f.name,
          amountDisplay: f.amount_display,
          amountLb: weightLb(f.amount_display),
          percent: f.percent,
          maltster: f.maltster,
          use: f.use,
          ppg: num(f.ppg),
          colorLovibond: num(f.color_lovibond),
          refUrl: f.ref_url,
          sortOrder: i,
        })),
      },
      hops: {
        create: html.hops.map((h, i) => ({
          name: h.name,
          amountDisplay: h.amount_display,
          amountOz: weightOz(h.amount_display),
          timeDisplay: h.time_display,
          timeMinutes: num(h.time_display),
          use: h.use,
          form: h.form,
          alphaAcidPct: num(h.alpha_acid),
          refUrl: h.ref_url,
          sortOrder: i,
        })),
      },
      yeasts: {
        create: html.yeasts.map((y) => ({
          name: y.name,
          labProduct: y.lab_product,
          attenuationPct: num(y.attenuation),
          refUrl: y.ref_url,
        })),
      },
      comments: {
        create: html.comments.map((c) => ({
          originalCommentId: c.comment_id,
          commenter: c.commenter,
          commenterProfileUrl: c.commenter_profile_url,
          timestampDisplay: c.timestamp_display,
          text: c.text,
          parentCommentId: c.parent_comment_id,
        })),
      },
    },
  });
}

async function main(): Promise<void> {
  const path = process.argv[2] ?? "../data/parsed/recipes_full.jsonl";
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });

  let imported = 0;
  let skipped = 0;
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let rec: ScrapedRecord;
    try {
      rec = JSON.parse(trimmed);
    } catch {
      skipped++;
      continue; // tolerate a truncated last line from a killed scraper process
    }
    if (rec.status !== "ok") {
      skipped++;
      continue;
    }
    try {
      await importRecord(rec);
      imported++;
    } catch (err) {
      console.error(`failed to import ${rec.slug}:`, err);
      skipped++;
    }
    if ((imported + skipped) % 500 === 0) {
      console.log(`  ... ${imported} imported, ${skipped} skipped`);
    }
  }
  console.log(`done: ${imported} imported, ${skipped} skipped`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
