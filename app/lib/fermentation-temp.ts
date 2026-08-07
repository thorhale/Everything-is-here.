// What fermentation temperature does to the drink.
//
// WHY THIS EXISTS: every strain in this catalog carries a published temperature
// range, and until now nothing did anything with it. That is a strange gap,
// because temperature is the largest flavour lever a fermenter actually
// controls. The same yeast, the same wort, the same pitch — run at the bottom
// of its range versus the top — makes a recognisably different beer. A brewer
// choosing 18 °C over 22 °C is making a bigger decision than most of the
// ingredient choices the rest of this app helps with.
//
// WHAT THE SCIENCE SUPPORTS. The direction of travel is well established and
// consistent across the literature: as fermentation temperature rises, esters
// and higher (fusel) alcohols increase, while acetaldehyde and vicinal diketones
// — diacetyl and its relatives — decrease. Kucharczyk & Tuszyński measured
// exactly this at industrial scale across 8.5, 10 and 11.5 °C (J. Inst. Brew.
// 124(3), 2018, 230–235), and the mechanism is understood: temperature drives
// yeast growth rate, and growth rate sets the fusel/ester balance.
//
// WHAT IT DOES NOT SUPPORT, and why this module gives no numbers. Ester yield
// is not a function of temperature alone. It depends on the strain's own genetics
// (ATF1/ATF2 expression varies enormously between strains), on wort free amino
// nitrogen, on pitching rate, on dissolved oxygen, on gravity and on top
// pressure. Two strains at the same temperature in the same wort can differ
// several-fold in isoamyl acetate. So a model that turned "20 °C" into
// "3.2 mg/L isoamyl acetate" would be inventing precision that the published
// work does not have, and would be wrong in a way that looks authoritative.
//
// What this module does instead: it says where you are in the strain's OWN
// published range, and what moving within that range does, directionally. That
// is a claim the literature actually supports for any strain. Where a specific
// trial has measured figures, those live in data/fermentation/temperature-trials
// .json and are shown as what that trial measured under its conditions — never
// extrapolated onto your batch.
//
// WHERE TO READ MORE. White & Zainasheff, "Yeast: The Practical Guide to Beer
// Fermentation" (Brewers Publications, 2010) is the standard work on this
// territory and is what the pitching model in lib/pitching/formulas.ts is built
// on. It is deliberately pointed AT rather than quoted: the source registry
// holds the Brewing Elements titles at metadata-only verification, meaning no
// figure is attributed to one of those books unless somebody has opened it and
// cited the page. The claims this module makes therefore rest on sources a
// reader can retrieve — the peer-reviewed trial above, the producers' own strain
// statements, and the Maltose Falcons guides recorded in
// data/fermentation/temperature-trials.json.
//
// Pure computation, no filesystem or database access, so client components can
// import it directly.

export type TempBand = "below" | "cool" | "mid" | "warm" | "above";

export interface StrainTempRange {
  tempMinC: number | null;
  tempMaxC: number | null;
}

export const BAND_LABELS: Record<TempBand, string> = {
  below: "Below the published range",
  cool: "Cool end",
  mid: "Middle",
  warm: "Warm end",
  above: "Above the published range",
};

export interface TempAssessment {
  band: TempBand;
  label: string;
  /** 0 at the bottom of the range, 1 at the top; outside [0,1] when out of range. */
  fraction: number;
  tempC: number;
  tempF: number;
  rangeC: [number, number];
  /** Directional consequences, most important first. */
  effects: string[];
  /** Present only when the temperature is outside the published range. */
  warning: string | null;
}

export const cToF = (c: number) => Math.round((c * 9) / 5 + 32);
export const fToC = (f: number) => ((f - 32) * 5) / 9;

/**
 * Where `tempC` sits in a strain's published range, and what that does.
 *
 * Returns null when the strain has no published range — 12 of the cultures in
 * this catalog are Brettanomyces, Lactobacillus and other non-Saccharomyces
 * organisms whose suppliers give no figure, and inventing one for them would be
 * worse than saying nothing.
 */
export function assessTemp(range: StrainTempRange, tempC: number): TempAssessment | null {
  const { tempMinC: lo, tempMaxC: hi } = range;
  if (lo == null || hi == null || !(hi > lo)) return null;

  const fraction = (tempC - lo) / (hi - lo);
  let band: TempBand;
  if (fraction < 0) band = "below";
  else if (fraction > 1) band = "above";
  else if (fraction < 0.33) band = "cool";
  else if (fraction < 0.67) band = "mid";
  else band = "warm";

  return {
    band,
    label: BAND_LABELS[band],
    fraction: Math.round(fraction * 100) / 100,
    tempC: Math.round(tempC * 10) / 10,
    tempF: cToF(tempC),
    rangeC: [lo, hi],
    effects: EFFECTS[band],
    warning: WARNINGS[band],
  };
}

// The directional consequences. Deliberately worded as directions rather than
// magnitudes: "more esters" is defensible for any strain, "2.4 mg/L more" is not.
const EFFECTS: Record<TempBand, string[]> = {
  below: [
    "Fermentation may stall or never properly start — below the supplier's range the yeast is not guaranteed to perform.",
    "Whatever does ferment will be very clean, but expect it to be slow and to finish high.",
    "Diacetyl and acetaldehyde are slowest to clean up down here, so a cold finish can leave both behind.",
  ],
  cool: [
    "Fewest esters — the cleanest, crispest expression this strain offers.",
    "Fewest fusel alcohols, so no hot or solvent-like alcohol character.",
    "More acetaldehyde and diacetyl to clear, so give it time at the end rather than crashing early.",
    "Slower, and more likely to finish a point or two higher than the strain's stated attenuation.",
  ],
  mid: [
    "The balance the supplier designed the strain around, and the safest place to start.",
    "Moderate ester production — present but not dominant.",
    "Reliable attenuation and a predictable timeline.",
  ],
  warm: [
    "Most esters — fruity, and for Belgian and weizen strains this is where the character lives.",
    "More fusel alcohols, which read as warming at best and solventy at worst.",
    "Faster, and diacetyl and acetaldehyde clean up more readily.",
    "Higher attenuation, and a drier finish than the same beer run cool.",
  ],
  above: [
    "Fusel alcohols rise sharply — hot, solvent-like, and they do not age out on any useful timescale.",
    "Esters can tip past fruity into nail-varnish.",
    "Risk of the yeast stressing, dropping out early and leaving the ferment stuck.",
  ],
};

const WARNINGS: Record<TempBand, string | null> = {
  below: "Colder than the supplier's published minimum.",
  cool: null,
  mid: null,
  warm: null,
  above: "Hotter than the supplier's published maximum — the usual cause of hot, solventy homebrew.",
};

/**
 * The temperature at a given position in the range. `0` is the bottom, `1` the
 * top. Used to offer "cool / middle / warm" presets without hard-coding numbers
 * that only make sense for one strain.
 */
export function tempAtFraction(range: StrainTempRange, fraction: number): number | null {
  const { tempMinC: lo, tempMaxC: hi } = range;
  if (lo == null || hi == null || !(hi > lo)) return null;
  return Math.round((lo + (hi - lo) * fraction) * 10) / 10;
}

// --- WHEN you are warm, not just how warm --------------------------------
//
// A single temperature is an incomplete description of a ferment, and this is
// the refinement that matters most. Esters and higher alcohols are made
// overwhelmingly during active yeast GROWTH — the first couple of days — because
// growth rate is what sets the fusel/ester balance. After growth finishes, the
// same temperature does something quite different: it speeds up diacetyl and
// acetaldehyde cleanup without adding much ester.
//
// So two ferments that both average 20 °C can come out unalike. Held at 18 °C
// through the growth phase and then allowed to free-rise, a beer is markedly
// cleaner than one pitched straight in at 22 °C, even if both finish in the same
// place. The Maltose Falcons saison guide puts it plainly — the balance of
// esters and phenols is generated "by controlling the temperature early during
// the lag phase when the yeast are reproducing" — and reports the A/B: WLP565
// taken straight to 85 °F gave deep, dry, black-peppery spice, while the same
// strain started cool and allowed to rise gave fruit and cherries with subdued
// spice.
//
// This is also why the app declines to turn a temperature into a number. A
// quantitative model would need the whole profile, not one reading.

export type ScheduleKey = "cool-then-rise" | "steady-mid" | "warm-throughout";

export interface Schedule {
  key: ScheduleKey;
  label: string;
  /** Where in the strain's range to sit during active growth, then afterwards. */
  growthFraction: number;
  finishFraction: number;
  outcome: string;
  bestFor: string;
}

export const SCHEDULES: Schedule[] = [
  {
    key: "cool-then-rise",
    label: "Cool through growth, then free-rise",
    growthFraction: 0.15,
    finishFraction: 0.85,
    outcome:
      "The cleanest result the strain can give while still finishing dry. Holding the growth phase cool suppresses ester and fusel formation where it actually happens; letting it rise afterwards clears diacetyl and acetaldehyde without putting the esters back.",
    bestFor: "Clean ales and lagers, and any beer where you want the malt or hops rather than the yeast.",
  },
  {
    key: "steady-mid",
    label: "Steady, mid-range",
    growthFraction: 0.5,
    finishFraction: 0.5,
    outcome:
      "The strain as its supplier characterises it — moderate esters, predictable timing, no surprises in either direction.",
    bestFor: "A first run with an unfamiliar strain, and most everyday brewing.",
  },
  {
    key: "warm-throughout",
    label: "Warm from the start",
    growthFraction: 0.85,
    finishFraction: 0.9,
    outcome:
      "Maximum ester and phenol expression, because growth happens hot. Fastest, driest and most characterful — and the point at which fusel alcohols become a real risk if the strain is not built for it.",
    bestFor: "Saison, weizen and Belgian strains, where the yeast character is the beer.",
  },
];

export interface ScheduleForStrain extends Schedule {
  growthC: number;
  growthF: number;
  finishC: number;
  finishF: number;
}

/** The three common strategies, expressed in this strain's own temperatures. */
export function schedulesFor(range: StrainTempRange): ScheduleForStrain[] {
  return SCHEDULES.map((s) => {
    const growthC = tempAtFraction(range, s.growthFraction);
    const finishC = tempAtFraction(range, s.finishFraction);
    return growthC == null || finishC == null
      ? null
      : { ...s, growthC, growthF: cToF(growthC), finishC, finishF: cToF(finishC) };
  }).filter((x): x is ScheduleForStrain => x != null);
}

/**
 * A one-line summary of what the strain's range offers, for catalog pages where
 * there is no temperature input to respond to.
 */
export function rangeSummary(range: StrainTempRange): string | null {
  const { tempMinC: lo, tempMaxC: hi } = range;
  if (lo == null || hi == null || !(hi > lo)) return null;
  const span = hi - lo;
  const swing =
    span >= 10
      ? "an unusually wide range — this strain is a different beer at each end"
      : span >= 6
        ? "enough range to shift the ester character noticeably"
        : "a narrow range, so temperature is less of a lever here than with most strains";
  return `${lo}–${hi} °C (${cToF(lo)}–${cToF(hi)} °F): ${swing}.`;
}
