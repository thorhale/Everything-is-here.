// Will this mash convert?
//
// Diastatic power is the enzyme supply a grain bill brings to its own starch.
// For an all-malt beer it is rarely the binding constraint. For a bourbon or
// grain-whiskey mash running 70-80% corn it is the whole question: the malt
// fraction has to convert not only itself but every pound of unmalted grain
// beside it, and if it cannot, the distiller gets a low yield and a stuck,
// starchy mash rather than a clean fermentation.
//
// ---------------------------------------------------------------------------
// WHY THERE IS NO SIMPLE PASS/FAIL LINE HERE
//
// The obvious implementation compares a mass-weighted grist DP against "35
// °Lintner", the self-conversion minimum every brewing calculator uses. That
// number is not in this module, and its absence is deliberate.
//
// It was searched for properly. Every source that states it is a forum post, a
// homebrew blog or a wiki; Wikipedia gives 35 with no citation at all, and one
// of the more careful forum threads on the subject is a brewer noting that he
// could not find a scientific reference for it either. Values quoted range from
// 30 to 70 for the same claim. This catalogue's rule is that a number may not
// rest on a tertiary source, and a threshold that decides whether someone's
// mash works is the last place to break it.
//
// So the assessment is built on the one world-class primary document that does
// state how much diastatic power a job needs: the American Malting Barley
// Association's Malting Barley Breeding Guidelines, "Ideal Commercial Malt
// Criteria", revised April 2025. It gives the US industry's target malt
// specification BY END USE, which is exactly the question being asked — and
// critically, its adjunct-brewing and grain-distilling columns are specified
// for malt that has to convert unmalted grain beside it. That is why they are
// higher than the all-malt column, and it is what makes them the right yardstick
// for a grist carrying adjuncts.
//
// The comparison this module makes is therefore not "grist DP vs an invented
// grist minimum". It is: given how much unmalted starch this bill carries, does
// the enzyme-bearing malt in it meet what AMBA specifies for that end use?
// Every threshold traces to a document; none is folklore.
// ---------------------------------------------------------------------------

/**
 * Diastatic power is published on three scales and maltsters do not agree on
 * which. °Lintner (identical to °ASBC) is used throughout this catalogue.
 *
 * The relations are not asserted from a homebrewing table. Simpsons Malt
 * publishes diastatic power for the same malt on all three scales at once,
 * which makes them checkable against a maltster's own analysis: across their
 * eight malts that carry a figure there are 15 (WK, published °Lintner) pairs
 * spanning 75-300 °WK, and this formula reproduces every published °Lintner to
 * within 0.4. The IoB ratio is exact on all four points — 150/40, 244/65,
 * 300/80 and 75/20 are all precisely 3.75. See data/fermentables/maltster-specs.json.
 */
export function wkToLintner(wk: number): number {
  return (wk + 16) / 3.5;
}
export function iobToWk(iob: number): number {
  return iob * 3.75;
}
export function iobToLintner(iob: number): number {
  return wkToLintner(iobToWk(iob));
}

export type EndUse = "all-malt" | "adjunct-brewing" | "grain-distilling";

/**
 * AMBA, Malting Barley Breeding Guidelines — Ideal Commercial Malt Criteria,
 * revised April 2025. Diastatic power in °ASBC, alpha amylase in DU.
 *
 * These are targets for a MALT, not for a finished grist, and they are breeding
 * targets rather than measurements of any particular lot. What they give this
 * module is a sourced answer to "how much enzyme does this job take", published
 * by the body whose members buy the barley.
 */
export const AMBA_MALT_CRITERIA: Record<
  EndUse,
  { label: string; dpMin: number; dpMax: number | null; alphaAmylaseMin: number }
> = {
  "all-malt": { label: "All-malt brewing & distilling", dpMin: 110, dpMax: 150, alphaAmylaseMin: 40 },
  "adjunct-brewing": { label: "Adjunct brewing", dpMin: 140, dpMax: null, alphaAmylaseMin: 50 },
  "grain-distilling": { label: "Grain distilling", dpMin: 200, dpMax: null, alphaAmylaseMin: 75 },
};

/** How a record's diastatic power came to be what it is. See schema.prisma. */
export type DiastaticBasis =
  | "published"
  | "published-zero"
  | "published-qualitative"
  | "process-zero"
  | "unmalted"
  | "withdrawn-source"
  | "unpublished";

/** Bases under which a null or zero means "genuinely brings no enzymes". */
const KNOWN_ZERO: ReadonlySet<string> = new Set(["published-zero", "process-zero", "unmalted"]);

export interface GristItem {
  key: string;
  name: string;
  /** Mass in the grain bill, grams. */
  massG: number;
  diastaticPowerLintner: number | null;
  diastaticPowerBasis: string | null;
  /** Starch that needs enzymes it does not have: flaked maize, rice, raw wheat. */
  requiresConversion?: boolean;
}

export interface ConversionAssessment {
  totalMassG: number;
  /** Mass whose enzyme contribution is known — a published figure or a declared zero. */
  knownMassG: number;
  /** Mass with no published figure and no process that settles it. */
  unknownMassG: number;
  unknownFractionPct: number;
  /** Unmalted starch: real mass, no enzymes, and the reason this check exists. */
  unmaltedMassG: number;
  unmaltedFractionPct: number;
  /** Mass that actually carries enzymes. */
  enzymeBearingMassG: number;
  enzymeBearingFractionPct: number;
  /**
   * Mass-weighted °Lintner across the WHOLE bill, counting anything unknown as
   * zero. A floor, not an estimate: the real figure is this or better, so if the
   * floor is sufficient the answer holds whatever the unknowns turn out to be.
   */
  weightedLintnerFloor: number;
  /** The same weighting over the enzyme-bearing malt alone — what AMBA specifies. */
  maltFractionLintner: number;
  endUse: EndUse;
  criteria: (typeof AMBA_MALT_CRITERIA)[EndUse];
  verdict: "meets" | "short" | "undetermined";
  /** How far the malt fraction is above (+) or below (-) the AMBA floor, °Lintner. */
  headroomLintner: number | null;
  notes: string[];
}

export interface AssessOptions {
  /** Overrides the end use inferred from the bill. */
  endUse?: EndUse;
  /**
   * A dosed exogenous amylase or glucoamylase, if the mash uses one. Most US
   * grain distillers convert this way rather than on malt enzymes.
   */
  dosedEnzyme?: { id: string; name: string; gPerL: number } | null;
}

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

/**
 * Mass-weighted diastatic power across a grain bill.
 *
 * Weighting by mass is the whole of the arithmetic: a pound of 220 °Lintner
 * distillers malt and three pounds of corn average to 55 °Lintner over the four
 * pounds, and that average is what the mash actually has to work with. Items
 * whose figure is unknown are counted as ZERO rather than skipped — skipping
 * them silently raises the average, which is the direction that gets someone a
 * stuck mash.
 */
export function weightedDiastaticPower(items: GristItem[]): number {
  const total = items.reduce((s, i) => s + Math.max(0, i.massG), 0);
  if (total <= 0) return 0;
  const sum = items.reduce((s, i) => s + Math.max(0, i.massG) * (i.diastaticPowerLintner ?? 0), 0);
  return sum / total;
}

/** Does this item bring enzymes, bring none, or is it simply unknown? */
function classify(i: GristItem): "enzymes" | "zero" | "unknown" {
  if (i.diastaticPowerLintner != null) return i.diastaticPowerLintner > 0 ? "enzymes" : "zero";
  if (i.diastaticPowerBasis && KNOWN_ZERO.has(i.diastaticPowerBasis)) return "zero";
  return "unknown";
}

export function assessConversion(items: GristItem[], opts: AssessOptions = {}): ConversionAssessment {
  const bill = items.filter((i) => i.massG > 0);
  const totalMassG = bill.reduce((s, i) => s + i.massG, 0);

  let knownMassG = 0;
  let unknownMassG = 0;
  let unmaltedMassG = 0;
  let enzymeBearingMassG = 0;
  let enzymeWeighted = 0;

  for (const i of bill) {
    const c = classify(i);
    if (c === "unknown") unknownMassG += i.massG;
    else knownMassG += i.massG;
    if (i.diastaticPowerBasis === "unmalted" || (c !== "enzymes" && i.requiresConversion)) {
      unmaltedMassG += i.massG;
    }
    if (c === "enzymes") {
      enzymeBearingMassG += i.massG;
      enzymeWeighted += i.massG * (i.diastaticPowerLintner as number);
    }
  }

  const weightedLintnerFloor = weightedDiastaticPower(bill);
  const maltFractionLintner = enzymeBearingMassG > 0 ? enzymeWeighted / enzymeBearingMassG : 0;

  // The end use picks the AMBA column, and it is taken from what the bill IS
  // rather than from a percentage cutoff this project would have had to invent.
  // Anything with unmalted grain in it is being asked to convert somebody else's
  // starch; whether that is an adjunct beer or a grain spirit is the caller's
  // declared intent, not something to guess from a ratio.
  const endUse: EndUse = opts.endUse ?? (unmaltedMassG > 0 ? "adjunct-brewing" : "all-malt");
  const criteria = AMBA_MALT_CRITERIA[endUse];

  const notes: string[] = [];
  let verdict: ConversionAssessment["verdict"];
  let headroomLintner: number | null = null;

  if (opts.dosedEnzyme) {
    verdict = "meets";
    notes.push(
      `Conversion here is not malt-limited: ${opts.dosedEnzyme.name} is dosed at ` +
        `${opts.dosedEnzyme.gPerL} g/L, which supplies amylase independently of the grist. The ` +
        `diastatic power below still describes what the grain brings on its own, and is worth ` +
        `knowing — an enzyme dose is a second line, not a reason to stop reading the first.`
    );
  } else if (enzymeBearingMassG === 0) {
    verdict = "undetermined";
    notes.push(
      totalMassG > 0 && unknownMassG === totalMassG
        ? "Nothing in this bill has a published diastatic power, so there is no enzyme supply to assess."
        : "No ingredient in this bill carries enzymes. Nothing here can convert starch: add a base " +
          "malt, or dose an amylase."
    );
  } else {
    headroomLintner = maltFractionLintner - criteria.dpMin;
    verdict = headroomLintner >= 0 ? "meets" : "short";
    notes.push(
      `The malt carrying enzymes averages ${maltFractionLintner.toFixed(0)} °Lintner and is ` +
        `${pct(enzymeBearingMassG, totalMassG).toFixed(0)}% of the bill. AMBA's criteria for ` +
        `${criteria.label.toLowerCase()} ask for ${criteria.dpMin}` +
        `${criteria.dpMax ? `-${criteria.dpMax}` : "+"} °ASBC, which is the same scale — so this ` +
        `malt is ${headroomLintner >= 0 ? "at or above" : `${Math.abs(headroomLintner).toFixed(0)} short of`}` +
        ` what the industry specifies for the job.`
    );
    if (unmaltedMassG > 0) {
      notes.push(
        `${pct(unmaltedMassG, totalMassG).toFixed(0)}% of this bill is starch with no enzymes of ` +
          `its own. Across the whole grist the enzyme supply works out at ` +
          `${weightedLintnerFloor.toFixed(0)} °Lintner.`
      );
    }
  }

  if (unknownMassG > 0) {
    notes.push(
      `${pct(unknownMassG, totalMassG).toFixed(0)}% of the bill by weight has no published ` +
        `diastatic power — counted as zero here, so the figures above are a floor rather than an ` +
        `estimate. Weyermann, for one, publishes a number for exactly one malt in its range and a ` +
        `qualitative "enzyme activity" line for the rest.`
    );
  }

  return {
    totalMassG,
    knownMassG,
    unknownMassG,
    unknownFractionPct: pct(unknownMassG, totalMassG),
    unmaltedMassG,
    unmaltedFractionPct: pct(unmaltedMassG, totalMassG),
    enzymeBearingMassG,
    enzymeBearingFractionPct: pct(enzymeBearingMassG, totalMassG),
    weightedLintnerFloor,
    maltFractionLintner,
    endUse,
    criteria,
    verdict,
    headroomLintner,
    notes,
  };
}

/**
 * The smallest fraction of an enzyme malt that brings the malt fraction up to
 * the AMBA floor for an end use — "how much distillers malt do I need in this
 * corn mash?", which is the question a distiller actually asks.
 *
 * Returns the mass in grams to add, or null when the bill already meets the
 * floor or the malt on offer is itself below it.
 */
export function maltToReachTarget(
  items: GristItem[],
  addition: { diastaticPowerLintner: number },
  opts: AssessOptions = {}
): number | null {
  const a = assessConversion(items, opts);
  if (a.verdict === "meets") return null;
  const target = a.criteria.dpMin;
  if (addition.diastaticPowerLintner <= target) return null; // cannot pull the average up

  // Solve (enzymeWeighted + m*dp) / (enzymeMass + m) = target for m.
  const enzymeWeighted = a.maltFractionLintner * a.enzymeBearingMassG;
  const m =
    (target * a.enzymeBearingMassG - enzymeWeighted) / (addition.diastaticPowerLintner - target);
  return m > 0 ? m : null;
}
