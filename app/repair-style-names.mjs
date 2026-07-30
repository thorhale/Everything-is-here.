// Repairs Recipe.styleName values that are recipe titles rather than styles.
//
// BrewToad page titles read "<title>, a <Style> homebrew beer recipe | Brewtoad",
// but a recipe with a SUBTITLE produced two separators:
//
//   "Honey Saison, a Rosemary Saison Variant, a Saison homebrew beer recipe |"
//
// The old parser was non-greedy from the left and only accepted "a", so it
// stopped at the first separator and took everything after it as the style —
// giving styleName values like "Rosemary Saison Variant, a Saison". Each one
// then showed up on /styles as its own bogus style with exactly one recipe,
// sitting under legitimate styles that all have 154+.
//
// scraper/parse/html_parser.py is fixed so a re-parse cannot reintroduce this.
// This script repairs the rows already loaded, taking the same interpretation:
// the style is the FINAL ", a/an <Style>" segment.
//
// Idempotent, and safe to run against a clean database — it selects only rows
// still matching the broken shape, and reports when there are none.
//
// Run:  node --env-file=.neon.env repair-style-names.mjs [--apply]
// Without --apply it prints the plan and changes nothing.

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.NEON_URL);
const APPLY = process.argv.includes("--apply");

// Matches a styleName carrying an embedded ", a " / ", an " separator. Real BJCP
// style names in this archive never contain one — verified against all 69
// distinct values, of which 63 are legitimate and none match.
const BROKEN = ", an? [A-Za-z]";

function realStyle(styleName) {
  const parts = styleName.split(/,\s*an?\s+/);
  return parts[parts.length - 1].trim();
}

const rows = await sql.query(
  `SELECT slug, title, "styleName" FROM "Recipe" WHERE "styleName" ~* $1 ORDER BY "styleName"`,
  [BROKEN]
);

if (rows.length === 0) {
  console.log("No corrupted styleName values found. Nothing to do.");
  process.exit(0);
}

console.log(`Found ${rows.length} recipe(s) with a corrupted styleName:\n`);
const plan = rows.map((r) => ({ slug: r.slug, from: r.styleName, to: realStyle(r.styleName) }));
for (const p of plan) {
  console.log(`  ${p.slug}`);
  console.log(`    ${JSON.stringify(p.from)}  ->  ${JSON.stringify(p.to)}`);
}

// Show whether each target style already exists, so a repair that would mint a
// brand-new one-recipe style is visible rather than silent. "American IPA" is
// the known case: it is a real BJCP style name but has no other recipes in this
// archive, which says something about the scrape's style coverage rather than
// about the repair.
const targets = [...new Set(plan.map((p) => p.to))];
console.log("\nTarget styles, and whether the archive already has them:");
for (const t of targets) {
  const [{ c }] = await sql.query(`SELECT count(*)::int AS c FROM "Recipe" WHERE "styleName" = $1`, [t]);
  console.log(`  ${t}: ${c} existing recipe(s)${c === 0 ? "  <- will become a new one-recipe style" : ""}`);
}

if (!APPLY) {
  console.log("\nDry run. Re-run with --apply to write these changes.");
  process.exit(0);
}

let n = 0;
for (const p of plan) {
  await sql.query(`UPDATE "Recipe" SET "styleName" = $1 WHERE slug = $2 AND "styleName" = $3`, [
    p.to,
    p.slug,
    p.from,
  ]);
  n += 1;
}

const [{ c: left }] = await sql.query(
  `SELECT count(*)::int AS c FROM "Recipe" WHERE "styleName" ~* $1`,
  [BROKEN]
);
const [{ d }] = await sql.query(
  `SELECT count(DISTINCT "styleName")::int AS d FROM "Recipe" WHERE "styleName" IS NOT NULL`
);
console.log(`\nUpdated ${n} recipe(s). Corrupted rows remaining: ${left}. Distinct styles now: ${d}.`);
