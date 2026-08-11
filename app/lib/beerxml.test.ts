// BeerXML export, and specifically the escaping nobody was checking.
//
// The sanitiser in esc() strips the control characters that would make the XML
// unparseable. Until now its character class was written with RAW control bytes
// embedded in the source — valid JavaScript, but it made the whole file read as
// binary to grep and to `file`, and any formatter or copy-paste that normalised
// those bytes would have silently disarmed the one function whose entire job is
// removing them. The class is now written as \u escapes, and these tests make
// the behaviour enforceable rather than merely readable.
//
// Recipe titles in this archive are user-supplied and recovered from scraped
// HTML, so ampersands, angle brackets and stray control bytes are not
// hypothetical inputs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { toBeerXml, xmlFilename, scaleRecipe, type XmlRecipe } from "./beerxml";

const recipe = (over: Partial<XmlRecipe> = {}): XmlRecipe => ({
  name: "Test Ale",
  batchSizeGal: 5,
  fermentables: [{ name: "Pale Malt", amountLb: 10, ppg: 37, colorLovibond: 2 }],
  hops: [{ name: "Cascade", amountOz: 1, alphaPct: 5.5, timeMin: 60, use: "Boil" }],
  yeasts: [{ name: "US-05", attenuationPct: 81 }],
  ...over,
});

test("XML metacharacters are escaped, not emitted raw", () => {
  const xml = toBeerXml(recipe({ name: `Bob & Sons <"Best"> Bitter` }));
  assert.ok(xml.includes("Bob &amp; Sons &lt;&quot;Best&quot;&gt; Bitter"), xml.slice(0, 400));
  // The raw forms must not survive inside the element we just wrote.
  const nameEl = xml.match(/<NAME>(.*?)<\/NAME>/)?.[1] ?? "";
  assert.ok(!/[<>"]/.test(nameEl), `unescaped metacharacter in ${nameEl}`);
  assert.ok(!/&(?!amp;|lt;|gt;|quot;)/.test(nameEl), `bare ampersand in ${nameEl}`);
});

test("control characters are stripped, which is the point of the escape class", () => {
  // Every character the class covers, built by code point so this test cannot
  // itself smuggle raw control bytes into the repository.
  const controls = [
    ...Array.from({ length: 9 }, (_, i) => i), // 0x00-0x08
    0x0b, 0x0c, // vertical tab, form feed
    ...Array.from({ length: 18 }, (_, i) => i + 0x0e), // 0x0e-0x1f
  ].map((c) => String.fromCharCode(c)).join("");

  const xml = toBeerXml(recipe({ name: `A${controls}B`, brewer: `X${controls}Y` }));
  assert.ok(xml.includes("<NAME>AB</NAME>"), "name should come through with the controls gone");
  assert.ok(xml.includes("<BREWER>XY</BREWER>"), "brewer too");
  for (const c of controls) {
    assert.ok(!xml.includes(c), `U+${c.charCodeAt(0).toString(16).padStart(4, "0")} survived`);
  }
});

test("tab, newline and carriage return are kept — they are legal in XML", () => {
  // The class deliberately spares 0x09, 0x0a and 0x0d. Stripping them would
  // mangle multi-line recipe notes for no reason.
  const xml = toBeerXml(recipe({ notes: "line one\nline two\twith a tab" }));
  assert.ok(xml.includes("line one\nline two\twith a tab"), "whitespace should survive");
});

test("the document is well formed and carries the recipe", () => {
  const xml = toBeerXml(recipe());
  assert.ok(xml.startsWith("<?xml"), "declaration first");
  assert.ok(xml.includes("<RECIPES>") && xml.includes("</RECIPES>"), "root element");
  assert.ok(xml.includes("Pale Malt") && xml.includes("Cascade") && xml.includes("US-05"));
  // Every opened tag closes. A crude check, but it catches the failure that
  // matters: an unescaped character breaking the tree.
  const opened = [...xml.matchAll(/<([A-Z_]+)>/g)].map((m) => m[1]);
  const closed = [...xml.matchAll(/<\/([A-Z_]+)>/g)].map((m) => m[1]);
  assert.deepEqual(opened.sort(), closed.sort(), "tags must balance");
});

test("scaleRecipe scales the ingredients and the batch, not the percentages", () => {
  const doubled = scaleRecipe(recipe(), 2);
  assert.equal(doubled.batchSizeGal, 10);
  assert.equal(doubled.fermentables[0].amountLb, 20);
  assert.equal(doubled.hops[0].amountOz, 2);
  // Alpha acid and attenuation are properties of the ingredient, not amounts.
  assert.equal(doubled.hops[0].alphaPct, 5.5);
  assert.equal(doubled.yeasts[0].attenuationPct, 81);
  // Scaling by one changes nothing.
  assert.deepEqual(scaleRecipe(recipe(), 1), recipe());
});

test("xmlFilename is filesystem-safe and never empty", () => {
  assert.equal(xmlFilename("Bob & Sons <Best> Bitter"), "bob-sons-best-bitter.xml");
  assert.equal(xmlFilename("///"), "recipe.xml", "a name with nothing usable still gets a file");
  assert.equal(xmlFilename(""), "recipe.xml");
  assert.ok(!/[^a-z0-9.-]/.test(xmlFilename("Åle über 100% — v2.0")), "no unsafe characters");
  assert.ok(xmlFilename("x".repeat(200)).length <= 64, "bounded length");
});
