// Check that the URLs this project cites still resolve.
//
// WHY THIS EXISTS: every number in data/ is supposed to be checkable, and a
// citation that 404s is not checkable — it is an assertion with a dead footnote.
// Link rot is invisible without a check like this: the data file still looks
// perfectly well sourced, and nobody notices until a reader clicks through.
//
// It found the first round of damage. Manufacturers restructure their sites
// without redirects, and roughly half the yeast catalog's citations had gone
// dead that way — Wyeast moved /strain/ to /product/, White Labs retired its
// numeric yeast-single endpoint, and Omega, Red Star, Lallemand Wine and
// Mangrove Jack's dropped their old product paths entirely.
//
// NOT a build gate, and deliberately so. The web breaking is not a defect in
// this repository, a publisher's bot-blocking is not rot, and a check that
// fails the build every time a vendor reorganises would simply get disabled.
// It reports; a human decides. Exit code is non-zero only with --strict.
//
// Usage: node check-source-links.mjs [--strict] [--only=yeasts] [--json]
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "../data";
const ARGS = process.argv.slice(2);
const STRICT = ARGS.includes("--strict");
const AS_JSON = ARGS.includes("--json");
const ONLY = ARGS.find((a) => a.startsWith("--only="))?.slice(7) ?? null;
// Concurrency was 10, and that turned out to make this tool lie. A full run
// reported 99 URLs as "fetch failed"; spot-checking them one at a time, four in
// five answered 200. The failures were the network refusing a burst, not
// documents that had gone away — and a link checker that cries wolf on a
// quarter of the corpus is one nobody reads, which is the same way an
// un-ratcheted budget stops meaning anything.
//
// So: fewer in flight, and a transient failure is retried with a pause before it
// is believed. A 404 is a fact and is taken at face value; a connection reset is
// an opinion and gets a second and third ask.
//
// This makes a full run slow — minutes, not seconds. That is the right trade for
// something whose whole job is to be believed, but it is why --only=<area> exists
// and why a whole-repo run wants a generous timeout or a background shell.
const CONCURRENCY = 4;
const TIMEOUT_MS = 25_000;
const RETRIES = 2;
const RETRY_PAUSE_MS = 1_500;

// A 403 is usually a publisher refusing robots, not a missing document —
// Wiley and ScienceDirect do this to every automated request. Reporting those
// as rot would bury the real 404s in noise, so they are called out separately.
const BOT_BLOCKED = new Set([401, 403, 429]);

/** Walk data/ and collect every sourceUrl with the file and record it came from. */
function collect(dir, out = new Map()) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      collect(path, out);
      continue;
    }
    if (!entry.endsWith(".json")) continue;
    if (ONLY && !path.includes(ONLY)) continue;
    let doc;
    try {
      doc = JSON.parse(readFileSync(path, "utf8"));
    } catch {
      continue; // a malformed file is validate-*'s problem, not ours
    }
    walk(doc, path, out, null);
  }
  return out;
}

function walk(node, file, out, label) {
  if (Array.isArray(node)) {
    for (const x of node) walk(x, file, out, label);
    return;
  }
  if (!node || typeof node !== "object") return;
  const name = node.productCode ?? node.id ?? node.name ?? label;
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === "string" && /^https?:\/\//.test(value) && /url/i.test(key)) {
      if (!out.has(value)) out.set(value, []);
      out.get(value).push(`${file.replace(ROOT + "/", "")}:${name ?? key}`);
    } else if (value && typeof value === "object") {
      walk(value, file, out, name);
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function attempt(url) {
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    // HEAD first: cheaper, and most hosts answer it. Some reject HEAD outright
    // with 405 while serving GET perfectly well, so fall through on anything
    // that is not a clean answer rather than trusting the first reply.
    let res = await fetch(url, { method: "HEAD", redirect: "follow", signal: control.signal });
    if (res.status === 405 || res.status === 501 || res.status >= 500) {
      res = await fetch(url, { method: "GET", redirect: "follow", signal: control.signal });
    }
    return { status: res.status, finalUrl: res.url };
  } catch (err) {
    return { status: 0, error: err?.name === "AbortError" ? "timeout" : String(err?.message ?? err) };
  } finally {
    clearTimeout(timer);
  }
}

async function probe(url) {
  let last;
  for (let i = 0; i <= RETRIES; i++) {
    last = await attempt(url);
    // A status code is an answer, even an unwelcome one — only a failure to get
    // any answer at all is worth asking again about.
    if (last.status !== 0) return i > 0 ? { ...last, retried: i } : last;
    if (i < RETRIES) await sleep(RETRY_PAUSE_MS * (i + 1));
  }
  return { ...last, retried: RETRIES };
}

const cited = collect(ROOT);
const urls = [...cited.keys()].sort();
const results = [];
let cursor = 0;
await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, urls.length) }, async () => {
    while (cursor < urls.length) {
      const url = urls[cursor++];
      results.push({ url, refs: cited.get(url), ...(await probe(url)) });
    }
  })
);

const ok = results.filter((r) => r.status >= 200 && r.status < 400);
const blocked = results.filter((r) => BOT_BLOCKED.has(r.status));
const dead = results.filter((r) => r.status === 404 || r.status === 410);
const broken = results.filter(
  (r) => !ok.includes(r) && !blocked.includes(r) && !dead.includes(r)
);

if (AS_JSON) {
  console.log(JSON.stringify({ ok: ok.length, blocked, dead, broken }, null, 1));
} else {
  const cites = (r) => r.refs.length;
  const line = (r) =>
    `  ${String(r.status || r.error).padEnd(7)} ${String(cites(r)).padStart(3)} cite(s)  ${r.url}`;

  if (dead.length) {
    console.log(`\nGONE — ${dead.length} URL(s) return 404/410:`);
    for (const r of dead.sort((a, b) => cites(b) - cites(a))) {
      console.log(line(r));
      console.log(`          ${r.refs.slice(0, 4).join(", ")}${r.refs.length > 4 ? ` +${r.refs.length - 4} more` : ""}`);
    }
  }
  if (broken.length) {
    console.log(`\nERRORING — ${broken.length} URL(s) neither resolved nor 404'd:`);
    for (const r of broken.sort((a, b) => cites(b) - cites(a))) console.log(line(r));
  }
  if (blocked.length) {
    console.log(`\nBOT-BLOCKED — ${blocked.length} URL(s). The document probably exists;`);
    console.log(`the publisher refuses automated requests. Check these by hand, do not "fix" them:`);
    for (const r of blocked) console.log(line(r));
  }

  const deadCites = dead.reduce((n, r) => n + cites(r), 0);
  const totalCites = results.reduce((n, r) => n + cites(r), 0);
  console.log(
    `\n${results.length} distinct URLs across ${totalCites} citations: ` +
      `${ok.length} live, ${dead.length} gone, ${broken.length} erroring, ${blocked.length} bot-blocked.`
  );
  if (deadCites) {
    console.log(
      `${deadCites} citation(s) point at a document that is no longer there — those numbers ` +
        `are currently unverifiable by a reader.`
    );
  }
}

if (STRICT && (dead.length || broken.length)) process.exit(1);
