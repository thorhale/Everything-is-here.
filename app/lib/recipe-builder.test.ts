// The builder sizes the bittering charge from the hop's alpha acid, so the one
// thing it must never do is pick a hop that has none. That used to be
// impossible because every hop in the catalog carried a figure — but several of
// those figures were not published anywhere, and the records that could not be
// sourced now carry no alpha at all. The old code's response to a hop without
// alpha was to use 10%, silently, which sets the IBU of the entire recipe from a
// number nobody measured.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildRecipeSkeleton,
  type CatalogFermentable,
  type CatalogHop,
  type StyleTargets,
} from "./recipe-builder";

const FERMENTABLES: CatalogFermentable[] = [
  { id: "malt-2row-pale", name: "2-Row Pale", ppg: 37, colorLovibond: 2, type: "grain", requiresConversion: false },
  { id: "malt-pilsner", name: "Pilsner", ppg: 37, colorLovibond: 1.6, type: "grain", requiresConversion: false },
  { id: "malt-crystal-40", name: "Crystal 40", ppg: 34, colorLovibond: 40, type: "grain", requiresConversion: false },
];

const hop = (id: string, purpose: string, alphaMin: number | null, alphaMax: number | null): CatalogHop => ({
  id, name: id, purpose, alphaMin, alphaMax, styleTags: [], country: null,
});

const STYLE: StyleTargets = {
  name: "American Pale Ale",
  ogMin: 1.045, ogMax: 1.06, fgMin: 1.01, fgMax: 1.015,
  ibuMin: 30, ibuMax: 45, srmMin: 5, srmMax: 10, abvMin: 4.5, abvMax: 6.2,
};

test("a hop with no published alpha is never chosen to bitter with", () => {
  // "warrior" is the only hop here that carries an alpha; everything the builder
  // would otherwise reach for first has none.
  const cat = [
    hop("magnum-us", "bittering", null, null),
    hop("cascade", "aroma", null, null),
    hop("warrior", "bittering", 15.5, 18),
  ];
  const built = buildRecipeSkeleton(STYLE, FERMENTABLES, cat);
  for (const h of built.hops) assert.equal(h.id, "warrior");
});

test("the catalog's own American picks all have a published alpha", () => {
  // Guards the pairing in pickHops against the data moving underneath it: the
  // American bittering pick was "magnum-us" until that record lost its numbers.
  const hops = ["us", "world"].flatMap(
    (f) => JSON.parse(readFileSync(new URL(`../../data/hops/${f}.json`, import.meta.url), "utf8")).hops
  ) as { id: string; alphaMin?: number; alphaMax?: number }[];
  for (const id of ["warrior", "cascade", "challenger", "east-kent-goldings", "magnum-de", "hallertau-mittelfrueh", "saaz", "styrian-goldings"]) {
    const h = hops.find((x) => x.id === id);
    assert.ok(h, `${id} is missing from the hop catalog`);
    assert.ok(h.alphaMin != null || h.alphaMax != null, `${id} has no published alpha but the builder picks it`);
  }
});

test("a catalog where nothing has an alpha yields no hop schedule rather than a fabricated one", () => {
  const cat = [hop("cascade-argentina", "dual", null, null), hop("magnum-us", "bittering", null, null)];
  const built = buildRecipeSkeleton(STYLE, FERMENTABLES, cat);
  assert.equal(built.hops.length, 0);
});
