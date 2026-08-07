import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assessTemp,
  tempAtFraction,
  rangeSummary,
  cToF,
  fToC,
} from "@/lib/fermentation-temp";

// A typical clean ale strain: Wyeast 1056, 16–22 °C.
const ALE = { tempMinC: 16, tempMaxC: 22 };

test("bands follow position in the strain's own range", () => {
  assert.equal(assessTemp(ALE, 14)!.band, "below");
  assert.equal(assessTemp(ALE, 16)!.band, "cool");
  assert.equal(assessTemp(ALE, 17)!.band, "cool");
  assert.equal(assessTemp(ALE, 19)!.band, "mid");
  assert.equal(assessTemp(ALE, 21)!.band, "warm");
  assert.equal(assessTemp(ALE, 24)!.band, "above");
});

test("bands are relative to the strain, not to absolute temperature", () => {
  // 20 °C is the warm end for a lager strain and the cool-ish middle for a
  // saison. The whole point of banding is that it moves with the organism.
  const lager = { tempMinC: 9, tempMaxC: 15 };
  const saison = { tempMinC: 20, tempMaxC: 35 };
  assert.equal(assessTemp(lager, 20)!.band, "above");
  assert.equal(assessTemp(saison, 20)!.band, "cool");
  assert.equal(assessTemp(ALE, 20)!.band, "mid");
});

test("fraction is 0 at the bottom and 1 at the top", () => {
  assert.equal(assessTemp(ALE, 16)!.fraction, 0);
  assert.equal(assessTemp(ALE, 22)!.fraction, 1);
  assert.equal(assessTemp(ALE, 19)!.fraction, 0.5);
  assert.ok(assessTemp(ALE, 25)!.fraction > 1);
  assert.ok(assessTemp(ALE, 12)!.fraction < 0);
});

test("no published range means no assessment, not a guessed one", () => {
  // A dozen Brett/Lacto/Pedio cultures have no supplier figure. Inventing one
  // would be worse than staying quiet.
  assert.equal(assessTemp({ tempMinC: null, tempMaxC: null }, 20), null);
  assert.equal(assessTemp({ tempMinC: 20, tempMaxC: null }, 20), null);
  assert.equal(assessTemp({ tempMinC: 22, tempMaxC: 18 }, 20), null, "inverted range is unusable");
  assert.equal(assessTemp({ tempMinC: 20, tempMaxC: 20 }, 20), null, "zero-width range is unusable");
});

test("out-of-range temperatures carry a warning, in-range ones do not", () => {
  assert.ok(assessTemp(ALE, 26)!.warning);
  assert.ok(assessTemp(ALE, 10)!.warning);
  assert.equal(assessTemp(ALE, 19)!.warning, null);
});

test("the direction of travel matches the literature", () => {
  // Esters and fusels rise with temperature; VDK and acetaldehyde fall.
  const cool = assessTemp(ALE, 16.5)!.effects.join(" ").toLowerCase();
  const warm = assessTemp(ALE, 21.5)!.effects.join(" ").toLowerCase();
  assert.ok(cool.includes("fewest esters"), "cool end should promise fewer esters");
  assert.ok(warm.includes("most esters"), "warm end should promise more esters");
  assert.ok(cool.includes("more acetaldehyde"), "cool end leaves more acetaldehyde to clear");
  assert.ok(warm.includes("clean up more readily"), "warm end clears VDK faster");
});

test("presets land inside the range", () => {
  assert.equal(tempAtFraction(ALE, 0), 16);
  assert.equal(tempAtFraction(ALE, 1), 22);
  assert.equal(tempAtFraction(ALE, 0.5), 19);
  assert.equal(tempAtFraction({ tempMinC: null, tempMaxC: null }, 0.5), null);
});

test("range summary reflects how much lever the strain gives you", () => {
  assert.match(rangeSummary({ tempMinC: 20, tempMaxC: 35 })!, /unusually wide/);
  assert.match(rangeSummary(ALE)!, /shift the ester character/);
  assert.match(rangeSummary({ tempMinC: 18, tempMaxC: 21 })!, /narrow range/);
  assert.equal(rangeSummary({ tempMinC: null, tempMaxC: null }), null);
});

test("unit conversion round-trips", () => {
  assert.equal(cToF(0), 32);
  assert.equal(cToF(100), 212);
  assert.equal(cToF(20), 68);
  assert.ok(Math.abs(fToC(68) - 20) < 1e-9);
  assert.ok(Math.abs(fToC(cToF(18)) - 18) < 0.6);
});
