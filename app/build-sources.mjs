// Builds data/sources/registry.json: every source the datasets cite, classified
// by data/sources/curated.json, joined against where it is actually used and
// whether the records leaning on it carry numeric specifications.
//
// The registry is generated, not hand-written, so it cannot drift from the data.
// Curation lives in curated.json; usage comes from a scan. Run after changing
// any dataset:  node build-sources.mjs
//
// A host that curated.json does not classify is a hard error. Adding a citation
// to a new domain therefore has to be a deliberate act with a stated
// reliability, which is the whole point.

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const DATA = new URL("../data/", import.meta.url).pathname;
const ROOT = new URL("../", import.meta.url).pathname;
const CURATED = join(DATA, "sources/curated.json");
const OUT = join(DATA, "sources/registry.json");

// Scanned datasets only. Snapshots and parsed scrapes are raw archive material,
// and reference-export is generated output.
const SKIP_DIRS = new Set(["snapshots", "parsed", "sources"]);
const SKIP_FILES = new Set(["reference-export.json"]);

// Numbers that describe a record's place in the UI or its identity, not a
// measured property. A record carrying only these is not making a factual claim.
const NON_SPEC_KEYS = new Set([
  "sortOrder", "order", "index", "version", "year", "edition", "editionYear",
  "count", "id", "sequence", "rank", "displayOrder",
]);

function walkFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) out.push(...walkFiles(p));
    } else if (entry.endsWith(".json") && !SKIP_FILES.has(entry)) {
      out.push(p);
    }
  }
  return out;
}

// A "record" is any object that cites a source. We report whether that object
// (not its children) carries numeric specs, because that is what determines
// how strong its citation has to be.
function hasNumericSpec(obj) {
  for (const [k, v] of Object.entries(obj)) {
    if (NON_SPEC_KEYS.has(k)) continue;
    if (typeof v === "number" && Number.isFinite(v)) return true;
    // Arrays of numbers count too (ion profiles, ranges).
    if (Array.isArray(v) && v.some((x) => typeof x === "number" && Number.isFinite(x))) return true;
  }
  return false;
}

const URL_KEYS = new Set(["sourceUrl", "mirrorUrl"]);

function collect(node, file, acc, labelHint) {
  if (Array.isArray(node)) {
    for (const v of node) collect(v, file, acc, labelHint);
    return;
  }
  if (!node || typeof node !== "object") return;

  const label = node.id ?? node.name ?? node.code ?? labelHint ?? null;
  const urls = [];
  for (const k of URL_KEYS) {
    const v = node[k];
    if (typeof v === "string" && v.startsWith("http")) urls.push(v);
  }
  if (urls.length) {
    const numeric = hasNumericSpec(node);
    for (const u of urls) {
      acc.push({ url: u, file, record: label, numeric, basis: node.specBasis ?? null });
    }
  }
  for (const [k, v] of Object.entries(node)) {
    if (URL_KEYS.has(k)) continue;
    collect(v, file, acc, label);
  }
}

function hostOf(u) {
  try { return new globalThis.URL(u).host; } catch { return null; }
}

// A citation is a deep link if it names a document or record rather than an
// organisation: two or more path segments, or a query string, or a file
// extension. "https://briess.com/" is not provenance.
function isDeepLink(u) {
  let p;
  try { p = new globalThis.URL(u); } catch { return false; }
  const segs = p.pathname.split("/").filter(Boolean);
  if (p.search) return true;
  if (segs.length >= 2) return true;
  if (segs.length === 1 && /\.(pdf|htm|html|aspx|php|json|csv|xlsx?)$/i.test(segs[0])) return true;
  return false;
}

const curated = JSON.parse(readFileSync(CURATED, "utf8"));
const publishers = new Map(curated.publishers.map((p) => [p.host, p]));
const documents = new Map();
for (const d of curated.documents) {
  documents.set(d.url, d);
  if (d.mirrorUrl) documents.set(d.mirrorUrl, { ...d, isMirror: true });
}

const citations = [];
for (const f of walkFiles(DATA)) {
  let parsed;
  try { parsed = JSON.parse(readFileSync(f, "utf8")); } catch { continue; }
  collect(parsed, relative(ROOT, f), citations);
}

const problems = [];
const byUrl = new Map();
for (const c of citations) {
  if (!byUrl.has(c.url)) byUrl.set(c.url, { url: c.url, citations: 0, numericCitations: 0, usedIn: new Set(), records: [] });
  const e = byUrl.get(c.url);
  e.citations += 1;
  if (c.numeric) e.numericCitations += 1;
  e.usedIn.add(c.file);
  if (e.records.length < 12) e.records.push(c.record);
}

const sources = [];
for (const e of [...byUrl.values()].sort((a, b) => b.citations - a.citations)) {
  const host = hostOf(e.url);
  const pub = publishers.get(host);
  if (!pub) {
    problems.push(`UNCLASSIFIED HOST  ${host}  (${e.citations} citations, e.g. ${e.url})`);
    continue;
  }
  const doc = documents.get(e.url);
  sources.push({
    id: doc?.id ?? null,
    url: e.url,
    host,
    title: doc?.title ?? null,
    publisher: doc?.publisher ?? pub.name,
    authors: doc?.authors ?? null,
    year: doc?.year ?? null,
    kind: doc?.kind ?? pub.kind,
    reliability: doc?.reliability ?? pub.reliability,
    verification: doc?.verification ?? "unverified",
    deepLink: isDeepLink(e.url),
    supports: doc?.supports ?? null,
    doesNotSupport: doc?.doesNotSupport ?? null,
    accessed: doc?.accessed ?? null,
    note: doc?.note ?? pub.note ?? null,
    citations: e.citations,
    numericCitations: e.numericCitations,
    usedIn: [...e.usedIn].sort(),
    exampleRecords: e.records.filter(Boolean),
  });
}

// Curated documents that no dataset cites. Without this, a document entry that
// nothing links to is dropped on the floor: its `supports` / `doesNotSupport`
// notes never reach registry.json and never reach /sources, so the reasoning
// for rejecting a source disappears silently. These are exactly the entries
// worth keeping visible — a source consulted and found wanting, the conflicting
// figure that was deliberately not merged, the bibliography a future check
// would start from. Carried as `background` so they cannot be mistaken for
// sources the data actually rests on.
const background = [];
for (const d of curated.documents) {
  if (byUrl.has(d.url)) continue;
  if (d.mirrorUrl && byUrl.has(d.mirrorUrl)) continue;
  const host = hostOf(d.url);
  if (!publishers.has(host)) {
    problems.push(`UNCLASSIFIED HOST  ${host}  (curated document "${d.id}", cited by nothing)`);
    continue;
  }
  background.push({
    id: d.id,
    url: d.url,
    host,
    title: d.title,
    publisher: d.publisher ?? publishers.get(host).name,
    authors: d.authors ?? null,
    year: d.year ?? null,
    kind: d.kind,
    reliability: d.reliability,
    verification: d.verification ?? "unverified",
    deepLink: isDeepLink(d.url),
    supports: d.supports ?? null,
    doesNotSupport: d.doesNotSupport ?? null,
    accessed: d.accessed ?? null,
  });
}

const totals = {
  distinctSources: sources.length,
  backgroundDocuments: background.length,
  citations: sources.reduce((a, s) => a + s.citations, 0),
  numericCitations: sources.reduce((a, s) => a + s.numericCitations, 0),
  // The debt figures. These are what the audit gates on.
  numericOnShallowLink: sources.filter((s) => s.numericCitations > 0 && !s.deepLink)
    .reduce((a, s) => a + s.numericCitations, 0),
  numericOnTertiary: sources.filter((s) => s.numericCitations > 0 && s.reliability === "tertiary")
    .reduce((a, s) => a + s.numericCitations, 0),
  fullTextVerified: sources.filter((s) => s.verification === "full-text").length,
  backgroundFullTextVerified: background.filter((s) => s.verification === "full-text").length,
  byReliability: sources.reduce((a, s) => { a[s.reliability] = (a[s.reliability] ?? 0) + s.citations; return a; }, {}),
};

if (problems.length) {
  console.error("build-sources: cannot classify every citation\n");
  for (const p of problems) console.error("  " + p);
  console.error("\nAdd these hosts to data/sources/curated.json with a stated reliability.");
  process.exit(1);
}

writeFileSync(
  OUT,
  JSON.stringify(
    {
      generated: "by app/build-sources.mjs — do not edit; edit data/sources/curated.json",
      reliabilityRules: curated.reliabilityRules,
      citationRules: curated.citationRules,
      totals,
      sources,
      background,
    },
    null,
    2
  ) + "\n"
);

console.log(`build-sources: ${totals.distinctSources} sources, ${totals.citations} citations`);
console.log(`  by reliability: ${JSON.stringify(totals.byReliability)}`);
console.log(`  full-text verified sources: ${totals.fullTextVerified}`);
console.log(`  numeric claims on a shallow link: ${totals.numericOnShallowLink}`);
console.log(`  numeric claims on a tertiary source: ${totals.numericOnTertiary}`);
console.log(`  background documents (curated, cited by nothing): ${totals.backgroundDocuments}`);
console.log(`  -> ${relative(ROOT, OUT)}`);
