// Check the bottled-water price observations.
//
// WHY THIS EXISTS: a price is only as good as its date and its arithmetic. Both
// go wrong quietly. Cost per gallon is derived from a pack price and a pack
// volume, so a mis-typed pack size produces a per-gallon figure that looks
// perfectly reasonable and is wrong by a factor of two — there is no charge
// balance to catch it here, so the derivation is simply recomputed. And a price
// with no date, or a stale one, is worse than no price: it invites a purchasing
// decision on a number that has since moved.
//
// This deliberately does NOT fail on staleness. Prices going out of date is
// normal and expected, not a defect in the data — the honest response is to
// label them old, not to refuse to build. It fails only on things that are
// actually wrong: bad arithmetic, a price pointing at a water that does not
// exist, a missing date or source.
//
// Usage: node validate-prices.mjs
import { readFileSync } from "node:fs";

const PRICES = "../data/water/prices.json";
const PROFILES = "../data/water/profiles.json";
const STALE_DAYS = 180;

const doc = JSON.parse(readFileSync(PRICES, "utf8"));
const profileIds = new Set(JSON.parse(readFileSync(PROFILES, "utf8")).profiles.map((p) => p.id));

const errors = [];
const stale = [];
const seen = new Set();
const today = new Date();

for (const p of doc.prices) {
  const where = p.id ?? p.product ?? "(unidentified entry)";

  if (!p.id) errors.push(`${where}: no id`);
  else if (seen.has(p.id)) errors.push(`${p.id}: duplicate id`);
  else seen.add(p.id);

  for (const field of ["brand", "product", "seller", "packDescription", "url", "observedAt"]) {
    if (!p[field]) errors.push(`${where}: missing ${field}`);
  }

  // Every price must attach to a water we actually hold a profile for, or the
  // page has a cost with nothing to compare it against.
  if (!Array.isArray(p.profileIds) || p.profileIds.length === 0) {
    errors.push(`${where}: no profileIds`);
  } else {
    for (const id of p.profileIds) {
      if (!profileIds.has(id)) errors.push(`${where}: profileId "${id}" is not a water profile`);
    }
  }

  // The derivation, recomputed rather than trusted.
  if (!(p.volumeGallons > 0)) {
    errors.push(`${where}: volumeGallons must be positive, got ${p.volumeGallons}`);
  } else if (!(p.priceUsd > 0)) {
    errors.push(`${where}: priceUsd must be positive, got ${p.priceUsd}`);
  } else {
    const expected = Math.round((p.priceUsd / p.volumeGallons) * 100) / 100;
    if (Math.abs((p.pricePerGallonUsd ?? NaN) - expected) > 0.011) {
      errors.push(
        `${where}: pricePerGallonUsd is ${p.pricePerGallonUsd}, but ` +
          `$${p.priceUsd} / ${p.volumeGallons} gal = $${expected}`
      );
    }
  }

  const when = new Date(p.observedAt);
  if (Number.isNaN(when.getTime())) {
    errors.push(`${where}: observedAt "${p.observedAt}" is not a date`);
  } else {
    const days = Math.floor((today - when) / 86400000);
    if (days < 0) errors.push(`${where}: observedAt is in the future`);
    else if (days > STALE_DAYS) stale.push(`${p.id}: observed ${days} days ago (${p.observedAt})`);
  }
}

const withPrice = new Set(doc.prices.flatMap((p) => p.profileIds ?? []));
const bottled = JSON.parse(readFileSync(PROFILES, "utf8")).profiles.filter((p) => p.kind === "bottled");
const missing = bottled.filter((p) => !withPrice.has(p.id));

const byGal = [...doc.prices].sort((a, b) => a.pricePerGallonUsd - b.pricePerGallonUsd);
console.log(`${doc.prices.length} price observations, cheapest first:\n`);
for (const p of byGal) {
  console.log(
    `  $${p.pricePerGallonUsd.toFixed(2).padStart(6)}/gal  ${p.observedAt}  ` +
      `${p.brand.padEnd(30)} ${p.packDescription}`
  );
}

console.log(
  `\nCoverage: ${bottled.length - missing.length} of ${bottled.length} bottled waters priced.`
);
if (missing.length) {
  console.log(`  no price yet: ${missing.map((p) => p.id).join(", ")}`);
}
if (stale.length) {
  console.log(`\nStale (older than ${STALE_DAYS} days) — re-observe before relying on these:`);
  for (const m of stale) console.log(`  ${m}`);
}

if (errors.length) {
  console.error(`\nFAIL: ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log("\nOK: every price recomputes from its pack, carries a date and a source, and names a real water.");
