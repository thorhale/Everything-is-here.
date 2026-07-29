// Style -> starting recipe skeleton.
//
// Given a style's published stat ranges (OG/FG/IBU/SRM/ABV from any guideline
// edition) plus the fermentable/hop catalogs, assemble a reasonable STARTING
// recipe: a grain bill scaled to hit the target gravity, specialty malts for
// colour, a hop schedule sized to the target IBU (Tinseth), and slots for the
// suggested yeast and water (filled by the page from the other databases).
//
// This is a starting point a brewer then tweaks — not a definitive recipe.
// The generated bill is run back through the real calculator so the page can
// show where it actually lands versus the style range.

import { computeStats, type CalcFermentable, type CalcHop } from "@/lib/calculator/formulas";

export interface CatalogFermentable {
  id: string;
  name: string;
  ppg: number | null;
  colorLovibond: number | null;
  type: string; // grain | sugar | extract | fruit | adjunct
  requiresConversion: boolean;
}
export interface CatalogHop {
  id: string;
  name: string;
  alphaMin: number | null;
  alphaMax: number | null;
  purpose: string | null;
  styleTags: string[];
  country: string | null;
}

export interface StyleTargets {
  name: string;
  categoryName?: string;
  /** Guideline tags, if any — used to spot entries that aren't brewable styles. */
  tags?: string | null;
  /** Stored beverage family (lib/beverages.ts). When present it's authoritative
   *  — only `beer` gets a grain bill — and beats the name-regex fallback. */
  beverage?: string | null;
  ogMin: number | null;
  ogMax: number | null;
  fgMin: number | null;
  fgMax: number | null;
  ibuMin: number | null;
  ibuMax: number | null;
  srmMin: number | null;
  srmMax: number | null;
  abvMin: number | null;
  abvMax: number | null;
}

export interface BuiltFermentable {
  id: string;
  name: string;
  ppg: number;
  colorLovibond: number;
  isGrain: boolean;
  amountLb: number;
  percent: number;
}
export interface BuiltHop {
  id: string;
  name: string;
  alphaPct: number;
  amountOz: number;
  timeMin: number;
}
export interface RecipeSkeleton {
  buildable: boolean;
  reason?: string;
  family: string;
  batchSizeGal: number;
  efficiencyPct: number;
  attenuationPct: number;
  fermentables: BuiltFermentable[];
  hops: BuiltHop[];
  targets: { og: number | null; fg: number | null; ibu: number | null; srm: number | null; abv: number | null };
  computed: { og: number; fg: number; ibu: number; srm: number; abv: number };
}

// Entries whose fermentable is fruit, honey, rice or cane rather than malt, and
// entries that are reference material rather than a style at all. Braggot is
// deliberately absent — it really is part malt.
const NON_MALT: [RegExp, string][] = [
  [/\bcider|\bperry\b|sidra|sagardo|apfelwein|poir[ée]|apple ?wine|scrumpy|keev/i, "cider or perry"],
  [/\bmead\b|melomel|cyser|pyment|metheglin|hydromel|kij[oō]|honey wine|\btej\b/i, "honey wine"],
  [/sake|seishu|junmai|ginjo|honjozo|doburoku|amazake|nihonshu|makgeolli|huangjiu|\bsoju\b/i, "a rice ferment"],
  [/whisk|bourbon|\brum\b|rhum|cacha[çc]a|tequila|mezcal|brandy|cognac|armagnac|calvados|\bgin\b|vodka|absinthe|aquavit|liqueur|baijiu|shochu|moonshine|eau-de-vie|grappa|pisco|raicilla|bacanora|arrack/i, "a distilled spirit"],
  [/\bwine\b|vinifera|riesling|chardonnay|cabernet|merlot|pinot|syrah|zinfandel|muscat|port\b|sherry|madeira|marsala|vermouth|ros[ée]\b/i, "wine"],
  [/pulque|tepache|palm wine|kumis|airag/i, "a traditional ferment"],
];

// Human labels for the non-beer beverage families, for the suppress message.
const BEVERAGE_REASON: Record<string, string> = {
  wine: "wine — the gravity comes from grape must, not a mash",
  cider: "cider or perry — the gravity comes from fruit juice, not a mash",
  mead: "a honey wine — the gravity comes from honey, not a mash",
  sake: "a rice ferment — built on koji and rice rather than a malt mash",
  spirit: "a distilled spirit, defined by a legal standard rather than a grain bill",
  fortified: "a fortified or aromatised wine, not a malt beverage",
  traditional: "a traditional ferment — its sugars come from fruit, sap, honey, milk or unmalted grain rather than a mash",
};

/** Returns a reason string when a grain bill would be meaningless, else null. */
function classifyNonMalt(style: StyleTargets): string | null {
  const tags = style.tags ?? "";
  if (/\breference\b/.test(tags)) {
    return "This entry is reference material — a tax band, a labelling rule, a protected designation — rather than a brewable style, so there is nothing to size a grain bill against.";
  }
  // The stored beverage classification is authoritative when present: only
  // beer gets a grain bill. This is more robust than name-matching (a Tequila
  // or Junmai page can't slip through) and it's why the guideline pages pass
  // the category's beverage down.
  if (style.beverage) {
    if (style.beverage === "beer") return null;
    const what = BEVERAGE_REASON[style.beverage] ?? "not a malt beverage";
    return `This is ${what}, so the grain-bill builder doesn't apply.`;
  }
  // Fallback for entries without a stored beverage: infer from the name.
  const s = `${style.name} ${style.categoryName ?? ""}`;
  for (const [re, what] of NON_MALT) {
    if (re.test(s)) {
      return `This is ${what}, not a malt beverage — the gravity comes from fruit, honey, rice or cane rather than from a mash, so the grain-bill builder doesn't apply.`;
    }
  }
  return null;
}

const mid = (a: number | null, b: number | null): number | null => {
  if (a != null && b != null) return (a + b) / 2;
  return a ?? b ?? null;
};

// A grist template is a list of roles (fermentable ids) with target percentages.
interface GristPart {
  id: string;
  pct: number;
}
interface Template {
  family: string;
  grist: GristPart[];
  hop: "american" | "english" | "german-noble" | "czech-noble" | "belgian";
  aroma: boolean; // add a late aroma addition
}

// Detect a style family from its name/category and colour, then return a grist
// template + hop character. Ordered most-specific first.
function detectTemplate(style: StyleTargets, srm: number): Template {
  const s = `${style.name} ${style.categoryName ?? ""}`.toLowerCase();
  const T = (family: string, grist: GristPart[], hop: Template["hop"], aroma = false): Template => ({ family, grist, hop, aroma });

  if (/hazy|new england|neipa|juicy/.test(s))
    return T("Hazy IPA", [{ id: "malt-2row-pale", pct: 70 }, { id: "malt-wheat-pale", pct: 15 }, { id: "adjunct-flaked-oats", pct: 15 }], "american", true);
  if (/double ipa|imperial ipa|dipa/.test(s))
    return T("Double IPA", [{ id: "malt-2row-pale", pct: 90 }, { id: "sugar-sucrose", pct: 6 }, { id: "malt-crystal-40", pct: 4 }], "american", true);
  if (/\bipa\b|india pale/.test(s))
    return T("IPA", [{ id: "malt-2row-pale", pct: 90 }, { id: "malt-crystal-40", pct: 7 }, { id: "malt-munich-light", pct: 3 }], "american", true);
  if (/pale ale/.test(s) && /american|west coast/.test(s))
    return T("American Pale Ale", [{ id: "malt-2row-pale", pct: 90 }, { id: "malt-crystal-40", pct: 10 }], "american", true);
  if (/dry stout|irish stout/.test(s))
    return T("Dry Stout", [{ id: "malt-maris-otter", pct: 72 }, { id: "adjunct-flaked-barley", pct: 10 }, { id: "malt-roasted-barley", pct: 10 }, { id: "malt-chocolate", pct: 8 }], "english");
  if (/imperial stout|impy|russian imperial/.test(s))
    return T("Imperial Stout", [{ id: "malt-2row-pale", pct: 74 }, { id: "malt-munich-light", pct: 8 }, { id: "malt-roasted-barley", pct: 7 }, { id: "malt-chocolate", pct: 7 }, { id: "malt-crystal-60", pct: 4 }], "american");
  if (/stout/.test(s))
    return T("Stout", [{ id: "malt-maris-otter", pct: 74 }, { id: "malt-crystal-60", pct: 8 }, { id: "malt-roasted-barley", pct: 8 }, { id: "malt-chocolate", pct: 10 }], "english");
  if (/porter/.test(s))
    return T("Porter", [{ id: "malt-maris-otter", pct: 72 }, { id: "malt-munich-light", pct: 10 }, { id: "malt-crystal-60", pct: 8 }, { id: "malt-chocolate", pct: 10 }], "english");
  if (/brown ale|brown/.test(s))
    return T("Brown Ale", [{ id: "malt-maris-otter", pct: 80 }, { id: "malt-crystal-60", pct: 10 }, { id: "malt-chocolate", pct: 4 }, { id: "malt-munich-light", pct: 6 }], "english");
  if (/mild/.test(s))
    return T("Mild", [{ id: "malt-maris-otter", pct: 85 }, { id: "malt-crystal-60", pct: 9 }, { id: "malt-chocolate", pct: 2 }, { id: "malt-munich-light", pct: 4 }], "english");
  if (/esb|extra special|strong bitter/.test(s))
    return T("ESB", [{ id: "malt-maris-otter", pct: 88 }, { id: "malt-crystal-60", pct: 10 }, { id: "sugar-sucrose", pct: 2 }], "english");
  if (/bitter|english pale ale/.test(s))
    return T("Bitter", [{ id: "malt-maris-otter", pct: 92 }, { id: "malt-crystal-40", pct: 8 }], "english");
  if (/amber|red ale/.test(s))
    return T("Amber Ale", [{ id: "malt-2row-pale", pct: 82 }, { id: "malt-crystal-60", pct: 12 }, { id: "malt-munich-light", pct: 6 }], "american");
  if (/hefe|weiss|weizen|wheat beer|witbier|wit\b|white/.test(s))
    return T("Wheat Beer", [{ id: "malt-wheat-pale", pct: 55 }, { id: "malt-pilsner", pct: 45 }], "german-noble");
  if (/saison|farmhouse/.test(s))
    return T("Saison", [{ id: "malt-pilsner", pct: 80 }, { id: "malt-wheat-pale", pct: 10 }, { id: "sugar-sucrose", pct: 10 }], "belgian");
  if (/tripel|golden strong/.test(s))
    return T("Belgian Tripel", [{ id: "malt-pilsner", pct: 88 }, { id: "sugar-sucrose", pct: 12 }], "belgian");
  if (/dubbel/.test(s))
    return T("Belgian Dubbel", [{ id: "malt-pilsner", pct: 80 }, { id: "malt-munich-light", pct: 8 }, { id: "malt-special-b", pct: 5 }, { id: "sugar-candi-syrup-d180", pct: 7 }], "belgian");
  if (/quad|dark strong/.test(s))
    return T("Belgian Dark Strong", [{ id: "malt-pilsner", pct: 78 }, { id: "malt-munich-light", pct: 7 }, { id: "malt-special-b", pct: 5 }, { id: "sugar-candi-syrup-d180", pct: 10 }], "belgian");
  if (/belgian|abbey|blonde/.test(s))
    return T("Belgian Ale", [{ id: "malt-pilsner", pct: 90 }, { id: "sugar-sucrose", pct: 10 }], "belgian");
  if (/kölsch|kolsch/.test(s))
    return T("Kölsch", [{ id: "malt-pilsner", pct: 90 }, { id: "malt-wheat-pale", pct: 10 }], "german-noble");
  if (/bock|doppelbock/.test(s))
    return T("Bock", [{ id: "malt-munich-light", pct: 80 }, { id: "malt-pilsner", pct: 15 }, { id: "malt-carafa-ii", pct: 5 }], "german-noble");
  if (/dunkel|munich dark|schwarz/.test(s))
    return T("Dark Lager", [{ id: "malt-munich-light", pct: 82 }, { id: "malt-pilsner", pct: 12 }, { id: "malt-carafa-ii", pct: 6 }], "german-noble");
  if (/vienna|märzen|marzen|oktoberfest/.test(s))
    return T("Vienna/Märzen", [{ id: "malt-vienna", pct: 55 }, { id: "malt-munich-light", pct: 30 }, { id: "malt-pilsner", pct: 15 }], "german-noble");
  if (/helles|munich helles/.test(s))
    return T("Helles", [{ id: "malt-pilsner", pct: 92 }, { id: "malt-munich-light", pct: 8 }], "german-noble");
  if (/czech|bohemian/.test(s))
    return T("Czech Lager", [{ id: "malt-pilsner", pct: 95 }, { id: "malt-crystal-20", pct: 5 }], "czech-noble");
  if (/pils|pilsner/.test(s))
    return T("Pilsner", [{ id: "malt-pilsner", pct: 100 }], "german-noble");
  if (/lager|cream ale|blonde/.test(s))
    return T("Pale Lager", [{ id: "malt-pilsner", pct: 90 }, { id: "malt-munich-light", pct: 10 }], "german-noble");

  // Fallback by colour.
  if (srm >= 30) return T("Dark Ale", [{ id: "malt-2row-pale", pct: 78 }, { id: "malt-crystal-60", pct: 8 }, { id: "malt-chocolate", pct: 8 }, { id: "malt-munich-light", pct: 6 }], "american");
  if (srm >= 15) return T("Amber Ale", [{ id: "malt-2row-pale", pct: 82 }, { id: "malt-crystal-60", pct: 12 }, { id: "malt-munich-light", pct: 6 }], "american");
  if (srm >= 7) return T("Pale Ale", [{ id: "malt-2row-pale", pct: 90 }, { id: "malt-crystal-40", pct: 10 }], "american", true);
  return T("Pale Ale", [{ id: "malt-2row-pale", pct: 100 }], "american", true);
}

// Pick a bittering + optional aroma hop for the family from the catalog.
function pickHops(hopCat: CatalogHop[], hopStyle: Template["hop"]): { bittering: CatalogHop; aroma: CatalogHop } | null {
  const byId = (id: string) => hopCat.find((h) => h.id === id);
  const map: Record<Template["hop"], [string, string]> = {
    american: ["magnum-us", "cascade"],
    english: ["challenger", "east-kent-goldings"],
    "german-noble": ["magnum-de", "hallertau-mittelfrueh"],
    "czech-noble": ["magnum-de", "saaz"],
    belgian: ["magnum-de", "styrian-goldings"],
  };
  const [bId, aId] = map[hopStyle];
  const bittering = byId(bId) ?? hopCat.find((h) => h.purpose === "bittering") ?? hopCat[0];
  const aroma = byId(aId) ?? hopCat.find((h) => h.purpose === "aroma") ?? bittering;
  return bittering && aroma ? { bittering, aroma } : null;
}

function alphaOf(h: CatalogHop): number {
  if (h.alphaMin != null && h.alphaMax != null) return (h.alphaMin + h.alphaMax) / 2;
  return h.alphaMax ?? h.alphaMin ?? 10;
}

// Tinseth utilisation for a given boil time (min) and average boil gravity.
function tinsethUtil(timeMin: number, avgGravity: number): number {
  const bigness = 1.65 * Math.pow(0.000125, avgGravity - 1);
  const timeFactor = (1 - Math.exp(-0.04 * timeMin)) / 4.15;
  return bigness * timeFactor;
}

export interface BuildOptions {
  batchSizeGal?: number;
  efficiencyPct?: number;
  attenuationPct?: number;
}

export function buildRecipeSkeleton(
  style: StyleTargets,
  fermCat: CatalogFermentable[],
  hopCat: CatalogHop[],
  opts: BuildOptions = {}
): RecipeSkeleton {
  const batchSizeGal = opts.batchSizeGal ?? 5;
  const efficiencyPct = opts.efficiencyPct ?? 72;
  const attenuationPct = opts.attenuationPct ?? 76;

  const og = mid(style.ogMin, style.ogMax);
  const ibu = mid(style.ibuMin, style.ibuMax);
  const srm = mid(style.srmMin, style.srmMax) ?? 6;

  const empty: RecipeSkeleton = {
    buildable: false,
    family: "",
    batchSizeGal,
    efficiencyPct,
    attenuationPct,
    fermentables: [],
    hops: [],
    targets: { og, fg: mid(style.fgMin, style.fgMax), ibu, srm: mid(style.srmMin, style.srmMax), abv: mid(style.abvMin, style.abvMax) },
    computed: { og: 1, fg: 1, ibu: 0, srm: 0, abv: 0 },
  };

  if (og == null || og <= 1) {
    return { ...empty, reason: "This guideline doesn't publish a numeric gravity target for this style, so a grain bill can't be sized automatically." };
  }

  // Several editions carry entries that have a real gravity range but are not
  // brewed from malt at all — BJCP's cider categories, the sake designations,
  // the cider appellations — and a few that are reference material rather than
  // a style (tax bands, labelling rules). A malt grist and a hop schedule would
  // be nonsense for any of them, so bail before the template lookup.
  const nonMalt = classifyNonMalt(style);
  if (nonMalt) return { ...empty, reason: nonMalt };

  const template = detectTemplate(style, srm);
  empty.family = template.family;

  // Resolve grist roles to catalog fermentables; renormalise if any are missing.
  const parts = template.grist
    .map((p) => ({ ...p, ferm: fermCat.find((fc) => fc.id === p.id) }))
    .filter((p) => p.ferm) as (GristPart & { ferm: CatalogFermentable })[];
  if (parts.length === 0) return { ...empty, reason: "Required base malts aren't in the catalog." };
  const pctSum = parts.reduce((s, p) => s + p.pct, 0);

  // Effective points-per-pound of the grist: grain scaled by efficiency, sugar
  // at full yield. Solve total weight to hit the target OG.
  const effPpg = (fc: CatalogFermentable): number => {
    const ppg = fc.ppg ?? 34;
    const isGrainLike = fc.type === "grain" || (fc.type === "adjunct" && fc.requiresConversion);
    return ppg * (isGrainLike ? efficiencyPct / 100 : 1);
  };
  const weightedPpg = parts.reduce((s, p) => s + (p.pct / pctSum) * effPpg(p.ferm), 0);
  const targetPoints = (og - 1) * 1000 * batchSizeGal;
  const totalLb = weightedPpg > 0 ? targetPoints / weightedPpg : 0;

  const fermentables: BuiltFermentable[] = parts.map((p) => {
    const pct = (p.pct / pctSum) * 100;
    const lb = (p.pct / pctSum) * totalLb;
    const isGrain = p.ferm.type === "grain" || (p.ferm.type === "adjunct" && p.ferm.requiresConversion);
    return {
      id: p.ferm.id,
      name: p.ferm.name,
      ppg: p.ferm.ppg ?? 34,
      colorLovibond: p.ferm.colorLovibond ?? 2,
      isGrain,
      amountLb: Math.round(lb * 100) / 100,
      percent: Math.round(pct),
    };
  });

  // Hops: size to the target IBU (default ~25 if none published). Split ~65/35
  // between a 60-min bittering charge and a late aroma addition (hoppy styles).
  const targetIbu = ibu ?? 25;
  const hops: BuiltHop[] = [];
  const picked = pickHops(hopCat, template.hop);
  if (picked) {
    const avgGravity = 1 + (og - 1) * 0.9; // rough average boil gravity
    const bAlpha = alphaOf(picked.bittering);
    const aAlpha = alphaOf(picked.aroma);
    const wantAroma = template.aroma;
    const bitterShare = wantAroma ? 0.65 : 1;

    // IBU per oz for an addition: alpha * util * 75 / batchGal.
    const ibuPerOz = (alpha: number, time: number) => (alpha * tinsethUtil(time, avgGravity) * 75) / batchSizeGal;

    const bOz = ibuPerOz(bAlpha, 60) > 0 ? (targetIbu * bitterShare) / ibuPerOz(bAlpha, 60) : 0;
    hops.push({ id: picked.bittering.id, name: picked.bittering.name, alphaPct: Math.round(bAlpha * 10) / 10, amountOz: Math.round(bOz * 100) / 100, timeMin: 60 });
    if (wantAroma) {
      const aOz = ibuPerOz(aAlpha, 15) > 0 ? (targetIbu * 0.35) / ibuPerOz(aAlpha, 15) : 0;
      hops.push({ id: picked.aroma.id, name: picked.aroma.name, alphaPct: Math.round(aAlpha * 10) / 10, amountOz: Math.round(aOz * 100) / 100, timeMin: 15 });
      // A flavour/aroma-only late addition (0 IBU credit, for character).
      hops.push({ id: picked.aroma.id, name: picked.aroma.name, alphaPct: Math.round(aAlpha * 10) / 10, amountOz: 1, timeMin: 5 });
    }
  }

  // Run it back through the real calculator.
  const calcFerms: CalcFermentable[] = fermentables.map((fr) => ({ amountLb: fr.amountLb, ppg: fr.ppg, isGrain: fr.isGrain }));
  const calcHops: CalcHop[] = hops.map((h) => ({ amountOz: h.amountOz, alphaPct: h.alphaPct, timeMin: h.timeMin, isDryHop: false }));
  const stats = computeStats({
    batchSizeGal,
    efficiencyPct,
    attenuationPct,
    fermentables: calcFerms,
    hops: calcHops,
    fermentableColors: fermentables.map((fr) => ({ colorLovibond: fr.colorLovibond, amountLb: fr.amountLb })),
  });

  return {
    buildable: true,
    family: template.family,
    batchSizeGal,
    efficiencyPct,
    attenuationPct,
    fermentables,
    hops,
    targets: { og, fg: mid(style.fgMin, style.fgMax), ibu, srm: mid(style.srmMin, style.srmMax), abv: mid(style.abvMin, style.abvMax) },
    computed: stats,
  };
}
