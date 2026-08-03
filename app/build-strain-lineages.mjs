// Group commercial yeast strains that are the same underlying yeast sold by
// different producers — Chico is WLP001, Wyeast 1056, SafAle US-05 and Omega
// OYL-004 all at once.
//
// WHERE THE AUTHORITY COMES FROM: each producer says so itself, in its own
// product description, and the sentence that says it is quoted here with the
// source URL. Nothing is inferred and no third party's cross-reference chart is
// copied. Mr Malty's Yeast Strain Finder covers the same ground and states that
// it is "compiled from manufacturer tech sheets and cross-references" — those
// tech sheets are already this project's primary sources for all 91 strains, so
// this derives from them directly rather than reproducing someone's compilation
// (the same reason BJCP guideline text is linked here, never redistributed).
//
// TWO RULES KEEP THIS HONEST:
//
//  1. A lineage must be NAMED by the producer. "Bavarian weizen strain" is a
//     style descriptor, not a claim of shared ancestry — Wyeast 3068, WLP300 and
//     LalBrew Munich Classic all say something like it and are not the same
//     yeast. Only a specific origin (Chico, Fuller's, Weihenstephan 34/70)
//     counts.
//  2. Members must share a species. "Weihenstephan" names an institution that
//     supplies both a lager yeast (34/70, S. pastorianus) and a wheat yeast
//     (3068, S. cerevisiae). Those are different organisms and grouping them
//     would be flatly wrong.
//
// Usage: node build-strain-lineages.mjs
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "../data/yeasts";
const OUT = "../data/yeasts/lineages.json";

const LINEAGES = [
  {
    id: "chico",
    label: "Chico",
    note:
      "The Californian ale strain, named for Sierra Nevada's home town. Clean, " +
      "hop-accentuating and highly attenuative — the most widely resold ale yeast in the world.",
    pattern: /\bChico\b/i,
  },
  {
    id: "fullers",
    label: "Fuller's",
    note:
      "The Fuller's ESB strain: very flocculant, malty and fruity, leaving body and " +
      "residual sweetness. Flocculates so hard it may need rousing to finish.",
    pattern: /Fuller/i,
  },
  {
    id: "weihenstephan-3470",
    label: "Weihenstephan 34/70",
    note:
      "The Weihenstephan 34/70 lager strain, the most-used lager yeast in commercial " +
      "brewing worldwide. Clean, balanced and cold-tolerant.",
    pattern: /34\/70/i,
  },
  {
    id: "westmalle",
    label: "Westmalle / Trappist high gravity",
    note: "The Trappist high-gravity strain associated with Westmalle.",
    pattern: /Westmalle/i,
  },
];

const strains = [];
for (const f of readdirSync(DIR).filter((n) => n.endsWith(".json") && n !== "lineages.json")) {
  const doc = JSON.parse(readFileSync(join(DIR, f), "utf8"));
  const lab = doc.lab ?? {};
  for (const s of doc.strains ?? []) strains.push({ s, lab });
}

/** The sentence in the maker's own text that names the lineage. */
function statedBy(text, pattern) {
  const sentences = text.split(/(?<=[.!?])\s+/);
  return (sentences.find((x) => pattern.test(x)) ?? text).trim();
}

// RULE 3, learned the hard way: producers mention other strains to CONTRAST
// with them. SafLager S-23 is described as "slightly more estery/fruity than
// 34/70" — a statement that it is a different yeast, which a bare keyword match
// read as membership. Grouping those would tell a brewer to substitute S-23 for
// W-34/70 and get a different beer.
//
// So a mention only counts when it is not sitting in a comparison.
const CONTRAST = /\b(than|unlike|versus|vs\.?|compared\s+(?:to|with)|differs?\s+from|distinct\s+from|not)\b/i;

function isContrastive(sentence, pattern) {
  const m = pattern.exec(sentence);
  if (!m) return false;
  // Look at the words immediately before the mention — "more X than 34/70"
  // puts the comparison word right in front of it.
  const before = sentence.slice(0, m.index);
  return CONTRAST.test(before.split(/[,;]/).pop() ?? before);
}

const groups = [];
for (const lineage of LINEAGES) {
  const members = [];
  for (const { s, lab } of strains) {
    const text = [s.description, s.notes, s.summary].filter(Boolean).join(" ");
    if (!text || !lineage.pattern.test(text)) continue;
    const sentence = statedBy(text, lineage.pattern);
    if (isContrastive(sentence, lineage.pattern)) {
      console.warn(
        `  ! ${lineage.label}: excluded ${s.productCode} — its own text contrasts with the ` +
          `lineage rather than claiming it: "${sentence}"`
      );
      continue;
    }
    members.push({
      strainId: s.id,
      productCode: s.productCode ?? null,
      name: s.name,
      lab: lab.name ?? null,
      labId: lab.id ?? null,
      labCountry: lab.country ?? null,
      form: s.form ?? null,
      species: s.species ?? null,
      statedBy: sentence,
      sourceUrl: s.sourceUrl ?? null,
    });
  }

  // Rule 2: one species per group. If a pattern pulled in more than one, keep
  // the majority species and report the rest rather than asserting a false
  // equivalence.
  const bySpecies = new Map();
  for (const m of members) bySpecies.set(m.species, [...(bySpecies.get(m.species) ?? []), m]);
  if (bySpecies.size > 1) {
    const [keep, ...rejected] = [...bySpecies.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [sp, list] of rejected) {
      console.warn(
        `  ! ${lineage.label}: excluded ${list.length} ${sp} strain(s) — ` +
          `${list.map((m) => m.productCode).join(", ")} — different species from ${keep[0]}`
      );
    }
    members.length = 0;
    members.push(...keep[1]);
  }

  // A group of one is not a grouping.
  if (members.length < 2) {
    if (members.length === 1) console.warn(`  · ${lineage.label}: only 1 member, skipped`);
    continue;
  }

  members.sort((a, b) => (a.lab ?? "").localeCompare(b.lab ?? ""));
  groups.push({ id: lineage.id, label: lineage.label, note: lineage.note, members });
}

const payload = {
  note:
    "Commercial yeast strains that are the same underlying yeast sold by different " +
    "producers. Every membership is asserted by the producer of that strain in its own " +
    "product description, and the sentence saying so is quoted with its source URL. " +
    "Nothing is inferred; no third-party cross-reference chart was copied. A lineage must " +
    "be named specifically (Chico, Fuller's, 34/70) — a style descriptor such as 'Bavarian " +
    "weizen strain' is not a claim of shared ancestry — and all members must share a species.",
  generated: new Date().toISOString().slice(0, 10),
  groups,
};

writeFileSync(OUT, JSON.stringify(payload, null, 1) + "\n");
console.log(`\nwrote ${OUT}: ${groups.length} lineages`);
for (const g of groups) {
  console.log(`  ${g.label} (${g.members[0].species}) — ${g.members.length} products`);
  for (const m of g.members) console.log(`      ${(m.productCode ?? "").padEnd(10)} ${m.lab}`);
}
