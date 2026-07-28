// Off-flavour reference.
//
// The compounds behind the faults brewers actually taste, with the chemistry
// that causes them and the process changes that fix them. Threshold figures
// are the commonly cited sensory detection thresholds in beer — they vary by
// taster and by beer style (a threshold that is a fault in a pilsner may be
// appropriate in a weissbier), so they indicate order of magnitude, not a
// pass/fail line.

export interface OffFlavor {
  id: string;
  name: string;
  compound: string;
  aroma: string; // what it smells/tastes like
  threshold?: string;
  causes: string[];
  prevention: string[];
  fix: string | null; // null = cannot be fixed after the fact
  appropriateIn?: string; // styles where it is a feature, not a fault
  links?: { label: string; href: string }[];
}

export const OFF_FLAVORS: OffFlavor[] = [
  {
    id: "diacetyl",
    name: "Diacetyl",
    compound: "2,3-butanedione",
    aroma: "Butter, butterscotch, movie-theatre popcorn; a slick, coating mouthfeel.",
    threshold: "~0.1 mg/L (very low — most people detect it easily)",
    causes: [
      "Yeast pitched too cold or in insufficient quantity, so fermentation stalls before cleanup.",
      "Beer crashed or racked off the yeast before it could reabsorb the precursor.",
      "Bacterial contamination (Pediococcus and some Lactobacillus produce it in quantity).",
    ],
    prevention: [
      "Pitch enough healthy yeast — underpitching is the single most common cause.",
      "Hold a diacetyl rest: let the beer free-rise a few degrees near the end of fermentation and hold 2–3 days before crashing.",
      "Don't rack or cold-crash until gravity is stable and the rest is complete.",
    ],
    fix: "Often reversible: warm the beer back to fermentation temperature with the yeast still in contact and give it 2–3 days. If it's bacterial in origin, it isn't fixable.",
    appropriateIn: "Low levels are traditional in some English ales and Czech pale lagers.",
    links: [
      { label: "Pitching rate calculator", href: "/pitching" },
      { label: "Yeast database", href: "/yeasts/db" },
    ],
  },
  {
    id: "dms",
    name: "DMS",
    compound: "Dimethyl sulfide",
    aroma: "Cooked sweetcorn, creamed corn, cooked cabbage, tomato juice.",
    threshold: "~30–50 µg/L",
    causes: [
      "Pilsner and other very pale malts are high in SMM, the DMS precursor, which converts on heating.",
      "Boiling with the lid on, or too gently — DMS is volatile and must be driven off.",
      "Slow chilling: DMS keeps forming above ~80 °C, so a long cooldown re-accumulates it.",
    ],
    prevention: [
      "Boil vigorously and uncovered for at least 60 minutes — 90 with heavily Pilsner-malt grists.",
      "Chill fast from boiling to pitching temperature.",
      "Don't leave hot wort standing covered.",
    ],
    fix: "Not really fixable after packaging. A vigorous re-boil would drive it off but ruins the beer otherwise.",
    links: [{ label: "Pilsner malt", href: "/fermentables/db" }],
  },
  {
    id: "acetaldehyde",
    name: "Acetaldehyde",
    compound: "Acetaldehyde",
    aroma: "Green apple, fresh-cut pumpkin, latex paint.",
    threshold: "~10–20 mg/L",
    causes: [
      "Beer packaged before fermentation truly finished — acetaldehyde is the intermediate yeast converts into ethanol.",
      "Yeast removed from the beer too early.",
      "Oxidation of ethanol in packaged beer, or Acetobacter contamination.",
    ],
    prevention: [
      "Let fermentation genuinely complete: stable gravity across several days, not a calendar date.",
      "Leave the beer on the yeast for a few extra days after terminal gravity.",
      "Pitch adequate healthy yeast so fermentation finishes cleanly.",
    ],
    fix: "Usually yes if it's just young beer — give it more time on the yeast at fermentation temperature.",
  },
  {
    id: "phenolic",
    name: "Phenolic / Medicinal",
    compound: "4-vinyl guaiacol, chlorophenols",
    aroma: "Clove and pepper (yeast-derived), or plastic, Band-Aid, smoke, mouthwash (contamination or chlorine).",
    causes: [
      "POF+ yeast strains — including all weissbier and most Belgian strains — produce clove-like 4VG deliberately.",
      "Chlorinated water reacting with phenols to form chlorophenols, which taste of plastic at vanishingly low levels.",
      "Wild yeast contamination in a beer that should be clean.",
      "Over-sparging or too-high sparge water pH, extracting husk tannins.",
    ],
    prevention: [
      "Treat chlorinated tap water — one Campden tablet per 20 gallons neutralises chloramine.",
      "Never use chlorine-based sanitisers on anything that touches cooled wort.",
      "Keep sparge water below ~76 °C and mash pH in range to avoid tannin extraction.",
    ],
    fix: "Chlorophenol is not fixable. Yeast-derived clove character is a style feature, not a fault.",
    appropriateIn: "Essential in weissbier, saison, and most Belgian styles.",
    links: [
      { label: "Water profiles", href: "/water" },
      { label: "Mash pH tool", href: "/tools" },
    ],
  },
  {
    id: "oxidation",
    name: "Oxidation",
    compound: "trans-2-nonenal and other carbonyls",
    aroma: "Wet cardboard, stale paper, sherry, dulled hop aroma, darkened colour.",
    threshold: "~0.1 µg/L for trans-2-nonenal",
    causes: [
      "Oxygen introduced after fermentation — splashing during transfer, headspace in the keg or bottle.",
      "Hot-side aeration in some cases, though its significance is debated.",
      "Warm storage, which accelerates every staling reaction.",
    ],
    prevention: [
      "Aerate wort before pitching only. After fermentation begins, treat oxygen as the enemy.",
      "Transfer gently, closed if possible; purge kegs with CO₂.",
      "Store cold. Staling roughly doubles in rate for every 10 °C warmer.",
    ],
    fix: "No. Oxidation is irreversible — this is a prevention-only fault.",
  },
  {
    id: "autolysis",
    name: "Autolysis",
    compound: "Yeast cell breakdown products",
    aroma: "Rubber, burnt tyre, brothy, meaty, Marmite.",
    causes: [
      "Beer left on a large, dead yeast cake too long, especially warm.",
      "High-gravity or high-alcohol beer stressing yeast to death.",
      "Excessive pressure on the yeast bed in tall vessels.",
    ],
    prevention: [
      "Rack off the primary yeast cake within a few weeks for ordinary-gravity beer.",
      "Keep the beer cold once fermentation is complete.",
      "Pitch appropriately for high-gravity worts so the yeast isn't stressed to begin with.",
    ],
    fix: "No. Once the cells have lysed the compounds are in the beer.",
  },
  {
    id: "fusel",
    name: "Fusel alcohols",
    compound: "Higher alcohols — isoamyl, propanol, butanol",
    aroma: "Hot, solventy, nail-polish; a burning finish. Associated with harsher hangovers.",
    causes: [
      "Fermentation too warm — the single biggest driver.",
      "Underpitching, forcing heavy yeast growth.",
      "Very high-gravity wort with inadequate yeast health or nutrients.",
    ],
    prevention: [
      "Control fermentation temperature, especially during the first 72 hours when most growth happens.",
      "Pitch adequate healthy yeast.",
      "For big beers, use a proper starter and yeast nutrient.",
    ],
    fix: "Long conditioning mellows fusels somewhat as they esterify, but it cannot be undone quickly.",
    links: [{ label: "Pitching rate calculator", href: "/pitching" }],
  },
  {
    id: "astringency",
    name: "Astringency / Tannin",
    compound: "Polyphenols and tannins",
    aroma: "Drying, puckering, tea-like; a grainy, rough finish rather than a flavour as such.",
    causes: [
      "Sparging with water above ~76 °C or at pH above ~6, extracting husk tannins.",
      "Over-sparging — running the last, thin, high-pH runnings into the kettle.",
      "Crushing grain too finely and shredding husks.",
      "Prolonged contact with large amounts of dark roasted malt.",
    ],
    prevention: [
      "Keep sparge water at or below 76 °C and check runoff pH and gravity — stop by about 1.010.",
      "Set the mill gap to crack the kernel while leaving the husk intact.",
      "Consider cold-steeping dark grains for smoother roast character.",
    ],
    fix: "No practical fix after the fact.",
    links: [{ label: "Mash pH tool", href: "/tools" }],
  },
  {
    id: "sulfur",
    name: "Sulfur",
    compound: "Hydrogen sulfide (H₂S), SO₂",
    aroma: "Rotten egg, struck match, burnt rubber.",
    causes: [
      "Normal lager fermentation — many lager strains produce H₂S transiently.",
      "Yeast stress: nutrient-poor wort, especially high-adjunct or all-sugar musts.",
      "Some wine strains under nitrogen deficiency (notably in mead and fruit wine).",
    ],
    prevention: [
      "Provide adequate yeast nutrient, particularly in mead, cider, and high-sugar worts.",
      "Pitch healthy yeast at the right rate and temperature.",
    ],
    fix: "Usually resolves itself. Sulfur scrubs out with continued fermentation and conditioning; lagering clears it.",
    appropriateIn: "Low-level sulfur is normal and expected in fresh lager.",
    links: [{ label: "Yeast database", href: "/yeasts/db" }],
  },
  {
    id: "sour",
    name: "Unintended Sourness",
    compound: "Lactic and acetic acid",
    aroma: "Tart, vinegary, sharp; possibly haze or a pellicle on the surface.",
    causes: [
      "Lactobacillus or Pediococcus infection from inadequate sanitation.",
      "Acetobacter, which requires oxygen — it turns ethanol into acetic acid (vinegar).",
      "Cross-contamination from equipment previously used for a deliberately soured beer.",
    ],
    prevention: [
      "Rigorous sanitation of everything touching cooled wort.",
      "Replace scratched plastic and worn tubing — biofilms hide in scratches.",
      "Keep a separate set of soft equipment for sour projects.",
    ],
    fix: "No. But consider whether it is actually pleasant — many great beers began as accidents.",
    appropriateIn: "Deliberate in Berliner weisse, gose, lambic, and Flanders reds.",
    links: [{ label: "Wild & sour yeast", href: "/yeasts/db?use=wild" }],
  },
  {
    id: "light-struck",
    name: "Light-struck / Skunky",
    compound: "3-methyl-2-butene-1-thiol (MBT)",
    aroma: "Skunk spray — chemically almost identical to the real thing.",
    threshold: "~4 ng/L (one of the lowest detection thresholds known)",
    causes: [
      "Riboflavin-mediated photodegradation of iso-alpha acids from hops, triggered by UV and blue light.",
      "Clear and green glass provide almost no protection; brown glass helps considerably.",
    ],
    prevention: [
      "Package in brown glass, cans, or kegs.",
      "Keep beer out of sunlight and away from fluorescent light.",
      "Beers hopped with reduced (tetra/hexa) hop extracts are immune — this is how clear-bottle brands survive.",
    ],
    fix: "No. It forms in minutes of direct sunlight and cannot be removed.",
  },
  {
    id: "acetic",
    name: "Solvent / Acetate",
    compound: "Ethyl acetate",
    aroma: "Nail polish remover, solvent, pear drops at low levels.",
    causes: [
      "High fermentation temperature.",
      "Wild yeast or bacterial contamination.",
      "Very high-gravity fermentation with stressed yeast.",
    ],
    prevention: [
      "Control fermentation temperature and pitch adequately.",
      "Maintain sanitation to exclude wild yeast.",
    ],
    fix: "Conditioning helps a little; largely a prevention issue.",
    appropriateIn: "Low-level pear-drop ester is normal in some Belgian ales and English strains.",
  },
];

export function getOffFlavor(id: string): OffFlavor | undefined {
  return OFF_FLAVORS.find((f) => f.id === id);
}
