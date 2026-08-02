import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseRefId, waybackRefUrl, brewtoadRefUrl, type RefKind } from "@/lib/brewtoad-ref";

test("parses the id out of a scraped ref_url", () => {
  assert.equal(
    parseRefId("/web/20181215223250/https://www.brewtoad.com/generic-fermentables/52"),
    52
  );
  assert.equal(parseRefId("/web/20181215223250/https://www.brewtoad.com/hops/7"), 7);
  assert.equal(parseRefId("/web/20181215223250/https://www.brewtoad.com/yeasts/1234"), 1234);
});

test("anything unexpected parses to null rather than a wrong id", () => {
  assert.equal(parseRefId(null), null);
  assert.equal(parseRefId(""), null);
  assert.equal(parseRefId("https://www.brewtoad.com/hops/7"), null); // no wayback prefix
  assert.equal(parseRefId("/web/2018/https://example.com/hops/7"), null); // wrong host
  assert.equal(parseRefId("/web/2018/https://www.brewtoad.com/malts/7"), null); // unknown path
});

test("rebuilds both the archived and the original URL", () => {
  assert.equal(
    waybackRefUrl("fermentable", 52, "20181215223250"),
    "/web/20181215223250/https://www.brewtoad.com/generic-fermentables/52"
  );
  assert.equal(brewtoadRefUrl("hop", 7), "https://www.brewtoad.com/hops/7");
  assert.equal(waybackRefUrl("hop", null, "20181215223250"), null);
  // No timestamp still yields a usable link rather than a broken one.
  assert.equal(waybackRefUrl("yeast", 3, null), "https://www.brewtoad.com/yeasts/3");
});

// The migration only saves space if it is lossless. Prove it on the real scrape
// sample: every ref_url in the corpus must survive parse -> store -> rebuild
// byte-identically, using only the integer and the parent recipe's timestamp.
test("round-trips every ref_url in the parse sample byte-identically", () => {
  const lines = readFileSync(
    new URL("../../data/parsed/m1_sample.jsonl", import.meta.url),
    "utf8"
  )
    .split("\n")
    .filter((l) => l.trim());

  const KINDS: [string, RefKind][] = [
    ["fermentables", "fermentable"],
    ["hops", "hop"],
    ["yeasts", "yeast"],
  ];

  let checked = 0;
  for (const line of lines) {
    const rec = JSON.parse(line);
    const timestamp: string | null = rec.source?.html_timestamp ?? null;
    for (const [key, kind] of KINDS) {
      for (const row of rec.html?.[key] ?? []) {
        const original: string | null = row.ref_url ?? null;
        if (!original) continue;
        const id = parseRefId(original);
        assert.notEqual(id, null, `failed to parse: ${original}`);
        assert.equal(waybackRefUrl(kind, id, timestamp), original);
        checked++;
      }
    }
  }
  assert.ok(checked > 2000, `expected to check the whole sample, only saw ${checked}`);
});
