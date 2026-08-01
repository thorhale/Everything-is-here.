// Hop bittering-weight adjustment.
//
// The alpha acid printed on the hops you actually bought varies by variety,
// crop year, farm and storage, so the weight that hits a target bitterness is
// not the recipe's nominal weight. The correction is exact and simple: for a
// bittering addition, IBU is proportional to (alpha × mass) with everything
// else held, so to preserve the bitterness at a different alpha you scale the
// mass by assumedAlpha / actualAlpha.
//
// Crucially this applies ONLY to bittering additions. Aroma and late additions
// are there for flavour and aroma; rescaling them to chase IBU changes exactly
// what you added them for, so their weight is left alone. A short addition does
// throw a little bitterness, but you let the bittering charge absorb the whole
// adjustment rather than touch the aroma.

export type AdditionRole = "bittering" | "aroma";

export interface HopAddition {
  name: string;
  amountG: number;
  assumedAlpha: number; // the catalogue midpoint the recipe was designed at
  actualAlpha: number; // what the package says you actually have
  timeMin: number;
  isDryHop: boolean;
}

export interface AdjustedAddition {
  name: string;
  role: AdditionRole;
  originalG: number;
  suggestedG: number; // equals originalG for aroma; rescaled for bittering
  changed: boolean;
  note: string;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * A boil addition at or beyond the threshold (default 60 min) is the bitterness
 * lever; everything shorter, and any dry hop, is treated as aroma and never
 * rescaled.
 */
export function classifyAddition(timeMin: number, isDryHop: boolean, thresholdMin = 60): AdditionRole {
  if (isDryHop) return "aroma";
  return timeMin >= thresholdMin ? "bittering" : "aroma";
}

export function adjustHops(
  additions: HopAddition[],
  thresholdMin = 60
): { additions: AdjustedAddition[]; buyTotals: { name: string; grams: number }[] } {
  const out: AdjustedAddition[] = additions.map((a) => {
    const role = classifyAddition(a.timeMin, a.isDryHop, thresholdMin);
    if (role === "aroma") {
      return {
        name: a.name,
        role,
        originalG: a.amountG,
        suggestedG: a.amountG,
        changed: false,
        note: "Aroma/late addition — weight held so the flavour and aroma you designed stay put.",
      };
    }
    const canAdjust = a.actualAlpha > 0 && a.assumedAlpha > 0;
    if (!canAdjust) {
      return {
        name: a.name,
        role,
        originalG: a.amountG,
        suggestedG: a.amountG,
        changed: false,
        note: "Enter the actual alpha acid from the package to adjust this bittering charge.",
      };
    }
    if (a.actualAlpha === a.assumedAlpha) {
      return {
        name: a.name,
        role,
        originalG: a.amountG,
        suggestedG: a.amountG,
        changed: false,
        note: "Actual alpha matches the recipe — no change needed.",
      };
    }
    const suggestedG = a.amountG * (a.assumedAlpha / a.actualAlpha);
    return {
      name: a.name,
      role,
      originalG: a.amountG,
      suggestedG,
      changed: true,
      note: `Recipe assumed ${a.assumedAlpha}% α, you have ${a.actualAlpha}% — weigh ${round1(
        suggestedG
      )} g (was ${round1(a.amountG)} g) to hold the same bitterness.`,
    };
  });

  // How much of each variety to weigh out / buy: the adjusted bittering weights
  // plus the untouched aroma weights.
  const totals = new Map<string, number>();
  for (const a of out) totals.set(a.name, (totals.get(a.name) ?? 0) + a.suggestedG);
  const buyTotals = [...totals.entries()]
    .map(([name, grams]) => ({ name, grams: round1(grams) }))
    .sort((x, y) => x.name.localeCompare(y.name));

  return { additions: out, buyTotals };
}
