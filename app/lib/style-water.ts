// Style -> classic water, keyed off BJCP's own commercial examples.
//
// The premise: BJCP anchors each style to real commercial beers, and those
// beers taste the way they do partly because of the water where they were
// born. Burton's gypsum is why Bass bites; Dublin's carbonate is why Guinness
// works; Plzen's near-distilled softness is the entire reason pale lager
// exists. So instead of a generic colour-based target, we point a style at the
// actual city and beer behind it, explain the water chemistry, and *also* give
// the practical modern target to brew it from your own tap.
//
// `classicCityId` and `targetId` are WaterProfile ids (data/water/profiles.json).
// Matched most-specific first by style name; falls through to null so callers
// keep their colour-based fallback.

export interface StyleWaterAnchor {
  match: RegExp;
  classicCityId: string;
  example: string;   // the BJCP-style commercial beer
  brewery: string;
  city: string;
  why: string;       // the water-chemistry rationale, 1-2 sentences
  targetId: string;  // practical modern water target to brew toward
}

// prettier-ignore
const ANCHORS: StyleWaterAnchor[] = [
  // --- Czech & German pale lager ---
  { match: /czech (premium )?pale|bohemian pils|czech pils/i, classicCityId: "pilsen",
    example: "Pilsner Urquell", brewery: "Plzeňský Prazdroj", city: "Plzeň, Czechia",
    why: "Plzeň's water is among the softest on earth — near-zero everything. That extreme softness is inseparable from the style: it lets Saaz hops and pale malt speak with no mineral edge, and it is why the world's first golden lager was born here in 1842.",
    targetId: "target-mineral-free" },
  { match: /german pils|north german pils|pilsner/i, classicCityId: "jever-frisia",
    example: "Jever Pilsener", brewery: "Friesisches Brauhaus zu Jever", city: "Jever, Germany",
    why: "Soft water with just enough sulfate to sharpen the hop bite into the famously bone-dry North German Pils. Low alkalinity keeps the pale grist crisp while the modest sulfate drives the lingering, assertive bitterness.",
    targetId: "target-hoppy-lager" },
  { match: /munich helles|helles(?! bock)|münchner helles/i, classicCityId: "munich",
    example: "Augustiner Lagerbier Hell", brewery: "Augustiner-Bräu", city: "Munich, Germany",
    why: "Munich's carbonate-rich water suits its malty lagers. For a pale Helles brewers historically decarbonated it, but the soft-yet-rounded mineral base is what gives the style its gentle, bready fullness rather than a crisp snap.",
    targetId: "target-yellow-balanced" },
  { match: /dortmunder|export/i, classicCityId: "dortmund",
    example: "DAB Original", brewery: "Dortmunder Actien-Brauerei", city: "Dortmund, Germany",
    why: "Dortmund's water is high in everything — calcium, sulfate and bicarbonate all elevated. That unusual balance splits the difference between Pilsen's softness and Munich's carbonate, producing Export's signature: fuller than a Pils, drier than a Helles.",
    targetId: "target-yellow-balanced" },
  // --- Amber & dark lager ---
  { match: /vienna lager/i, classicCityId: "vienna",
    example: "(historic) Schwechater Lager", brewery: "Brauerei Schwechat", city: "Vienna, Austria",
    why: "Moderately hard, moderately alkaline water that supports Vienna's toasty amber malt without stripping it. The carbonate balances the melanoidin-rich grist so the malt stays smooth rather than sharp.",
    targetId: "target-amber-balanced" },
  { match: /märzen|marzen|oktoberfest|festbier/i, classicCityId: "munich",
    example: "Paulaner Oktoberfest Bier", brewery: "Paulaner", city: "Munich, Germany",
    why: "Munich's carbonate water is built for malty amber lagers — it holds mash pH up against the rich Munich-malt grist, keeping the style round, bready and smooth.",
    targetId: "target-amber-balanced" },
  { match: /munich dunkel|dunkel(?! weizen)|dark lager|schwarzbier/i, classicCityId: "munich",
    example: "Ayinger Altbairisch Dunkel", brewery: "Ayinger", city: "Aying, Germany",
    why: "High-carbonate water is the reason dark lager is a Munich style at all: the alkalinity that would wreck a pale beer is exactly balanced by the acidity of dark, kilned malts, letting them ferment cleanly.",
    targetId: "target-brown-balanced" },
  { match: /rauchbier|smoke|kellerbier|franconian|zwickel/i, classicCityId: "bamberg",
    example: "Aecht Schlenkerla Rauchbier Märzen", brewery: "Brauerei Heller-Trum", city: "Bamberg, Germany",
    why: "Franconia's moderately hard, carbonate water underpins Bamberg's dark, malty lagers — enough alkalinity to carry the smoked and Munich malts without turning harsh.",
    targetId: "target-amber-balanced" },
  { match: /bock|doppelbock|eisbock/i, classicCityId: "munich",
    example: "Paulaner Salvator", brewery: "Paulaner", city: "Munich, Germany",
    why: "The carbonate water that suits Munich's dark malts is what lets a Doppelbock pile on kilned malt without the mash going harsh — the alkalinity and the roast cancel out.",
    targetId: "target-brown-balanced" },
  // --- German ales ---
  { match: /kölsch|kolsch/i, classicCityId: "cologne",
    example: "Früh Kölsch", brewery: "Cölner Hofbräu Früh", city: "Cologne, Germany",
    why: "Cologne's moderately hard water gives Kölsch a subtle mineral backbone under its delicate, wine-like fruit — soft enough to stay elegant, firm enough not to taste thin.",
    targetId: "target-yellow-balanced" },
  { match: /altbier|\balt\b/i, classicCityId: "dusseldorf",
    example: "Uerige Alt", brewery: "Zum Uerige", city: "Düsseldorf, Germany",
    why: "Düsseldorf's carbonate water balances Altbier's amber, malty grist while its calcium supports the crisp, firm bitterness that distinguishes the style from its Cologne rival.",
    targetId: "target-amber-balanced" },
  { match: /weiss|weizen|hefeweizen|dunkelweizen|weizenbock/i, classicCityId: "munich",
    example: "Weihenstephaner Hefeweissbier", brewery: "Bayerische Staatsbrauerei Weihenstephan", city: "Freising, Germany",
    why: "Bavaria's soft-to-moderate carbonate water lets the yeast's banana-and-clove character lead. Weissbier is a yeast-driven style, and the low-sulfate water keeps anything sharp or hoppy out of its way.",
    targetId: "target-yellow-balanced" },
  { match: /berliner weisse|berliner/i, classicCityId: "berlin",
    example: "(historic) Berliner Kindl Weisse", brewery: "Berliner Kindl", city: "Berlin, Germany",
    why: "Berlin's low-alkalinity water suits the very pale grist and keeps the lactic tartness clean and dry — no mineral clutter to blunt the acidity that defines the 'Champagne of the North'.",
    targetId: "target-mineral-free" },
  { match: /\bgose\b/i, classicCityId: "goslar",
    example: "(historic) Goslar Gose", brewery: "various", city: "Goslar, Germany",
    why: "Named for the saline Gose river, whose naturally salty water gave the style its signature gentle brininess. The elevated sodium and chloride are the entire point — they balance the coriander and lactic sourness. Modern brewers add salt to recreate what Goslar had in the ground.",
    targetId: "target-yellow-balanced" },
  // --- British ---
  { match: /english ipa|india pale ale.*english|burton/i, classicCityId: "burton-upon-trent",
    example: "Worthington's White Shield", brewery: "Molson Coors (Burton)", city: "Burton upon Trent, UK",
    why: "The most famous brewing water on earth: enormous sulfate from local gypsum sharpens hop bitterness into the crisp, dry 'Burton snap'. Adding gypsum to your water is still called Burtonisation because of this town.",
    targetId: "target-yellow-hoppy" },
  { match: /bitter|esb|english pale|ordinary|special|best bitter/i, classicCityId: "burton-upon-trent",
    example: "Fuller's ESB", brewery: "Fuller's (recipe), Burton character", city: "Burton upon Trent, UK",
    why: "Burton's high-sulfate water is why English bitter finishes dry and mineral-crisp, letting the earthy English hops assert themselves over the caramel malt. Sulfate is the style's defining lever.",
    targetId: "target-yellow-hoppy" },
  { match: /porter/i, classicCityId: "london",
    example: "Fuller's London Porter", brewery: "Fuller's", city: "London, UK",
    why: "London's carbonate-heavy water is the reason porter and stout are London styles: the high alkalinity that ruins a pale beer is neutralised by dark, acidic roasted malts, so the dark grist ferments clean.",
    targetId: "target-brown-balanced" },
  { match: /mild|brown ale|british brown/i, classicCityId: "london",
    example: "(historic) London Dark Mild", brewery: "various", city: "London, UK",
    why: "London's moderately alkaline water carries the caramel and lightly roasted malt of a mild without harshness — the same chemistry that made the city the home of dark beer.",
    targetId: "target-brown-balanced" },
  { match: /dry stout|irish stout|irish extra|foreign extra stout/i, classicCityId: "dublin",
    example: "Guinness Draught", brewery: "St. James's Gate", city: "Dublin, Ireland",
    why: "Dublin's very high carbonate water is what makes dry stout possible: only a big charge of acidic roasted barley can pull the mash pH down into range, and that roast is exactly the style's defining flavour. The water and the style co-evolved.",
    targetId: "target-black-roasty-bitter" },
  { match: /irish red/i, classicCityId: "dublin",
    example: "Smithwick's", brewery: "Smithwick's", city: "Kilkenny / Dublin, Ireland",
    why: "Ireland's carbonate water supports the light roast and caramel of an Irish red, its alkalinity balanced by a touch of roasted barley for the dry finish.",
    targetId: "target-amber-balanced" },
  { match: /scottish|scotch ale|wee heavy|export 80/i, classicCityId: "edinburgh",
    example: "Traquair House Ale", brewery: "Traquair House", city: "Scottish Borders, UK",
    why: "Edinburgh's moderately hard, alkaline water suits the malt-forward Scottish styles — enough carbonate to carry a rich, kilned, faintly caramelised grist without the beer turning sharp or hoppy.",
    targetId: "target-brown-balanced" },
  { match: /barleywine|old ale|strong ale/i, classicCityId: "burton-upon-trent",
    example: "Bass No. 1", brewery: "(historic) Bass", city: "Burton upon Trent, UK",
    why: "Burton's sulfate water gave English barleywines their firm, dry backbone, keeping an enormous malty beer from collapsing into cloying sweetness.",
    targetId: "target-amber-balanced" },
  // --- Belgian ---
  { match: /witbier|wit\b|belgian white/i, classicCityId: "brussels",
    example: "Hoegaarden", brewery: "Hoegaarden", city: "Hoegaarden / Brussels, Belgium",
    why: "The soft-to-moderate water of Brabant keeps witbier delicate, letting the coriander, orange peel and raw-wheat haze lead without any mineral sharpness.",
    targetId: "target-yellow-balanced" },
  { match: /lambic|gueuze|geuze|kriek|fruit lambic/i, classicCityId: "brussels",
    example: "Cantillon Gueuze", brewery: "Brasserie Cantillon", city: "Brussels, Belgium",
    why: "The water of the Zenne valley and Payottenland underpins lambic, but the style is defined by spontaneous fermentation far more than by minerals — a soft, unobtrusive base that stays out of the wild yeast's way.",
    targetId: "target-yellow-balanced" },
  { match: /flanders red|oud bruin|flanders brown|sour red/i, classicCityId: "antwerp",
    example: "Rodenbach Grand Cru", brewery: "Rodenbach", city: "Roeselare, Belgium",
    why: "West Flanders' moderate water supports the amber malt of a Flanders red, its balance leaving room for the oak-aged lactic and acetic sourness that defines the style.",
    targetId: "target-amber-balanced" },
  { match: /trappist|dubbel|tripel|belgian dark strong|belgian golden strong|quad|abbey/i, classicCityId: "antwerp",
    example: "Westmalle Tripel", brewery: "Trappist Abbey of Westmalle", city: "Westmalle, Belgium",
    why: "The soft-to-moderate water of the Antwerp Campine keeps the big Trappist ales clean and drinkable, letting the candi-sugar-dried finish and expressive yeast dominate rather than any mineral character.",
    targetId: "target-yellow-balanced" },
  { match: /saison|farmhouse|bière de garde|biere de garde/i, classicCityId: "brussels",
    example: "Saison Dupont", brewery: "Brasserie Dupont", city: "Tourpes, Hainaut, Belgium",
    why: "Wallonia's moderate water gives saison enough backbone to finish bone-dry and peppery without getting in the way of the farmhouse yeast that carries the style.",
    targetId: "target-yellow-balanced" },
  // --- American & modern ---
  { match: /hazy|new england|neipa|juicy/i, classicCityId: "portland-me",
    example: "The Alchemist Heady Topper", brewery: "The Alchemist", city: "Stowe, Vermont, USA",
    why: "The New England IPA flips the classic lever: chloride is pushed well above sulfate to build a soft, pillowy, almost sweet body that showcases fruity hop oils instead of sharpening bitterness. A high-chloride target is the whole style.",
    targetId: "target-hazy-juicy" },
  { match: /west coast|double ipa|imperial ipa|dipa/i, classicCityId: "san-diego",
    example: "Stone IPA", brewery: "Stone Brewing", city: "San Diego, California, USA",
    why: "West Coast IPA leans hard on sulfate to drive a crisp, dry, assertively bitter finish. San Diego brewers build it up from soft base water — sulfate well above chloride is the defining choice.",
    targetId: "target-yellow-hoppy" },
  { match: /american ipa|\bipa\b/i, classicCityId: "san-diego",
    example: "Ballast Point Sculpin", brewery: "Ballast Point", city: "San Diego, California, USA",
    why: "American IPA is a sulfate-forward style: elevated sulfate over chloride sharpens the citrusy, resinous hops into a dry, snappy bitterness. Start soft and Burtonise toward it.",
    targetId: "target-yellow-hoppy" },
  { match: /american pale ale|\bapa\b|pale ale/i, classicCityId: "chico",
    example: "Sierra Nevada Pale Ale", brewery: "Sierra Nevada", city: "Chico, California, USA",
    why: "The beer that launched American craft. Chico's soft water, nudged toward sulfate, gives the Cascade hops a clean, piney bite without the harshness heavier mineral water would add.",
    targetId: "target-yellow-hoppy" },
  { match: /california common|steam beer/i, classicCityId: "san-francisco",
    example: "Anchor Steam", brewery: "Anchor Brewing", city: "San Francisco, California, USA",
    why: "San Francisco's near-distilled Hetch Hetchy water is a blank canvas, which is exactly why Anchor Steam's toasty malt and woody Northern Brewer hops read so cleanly and precisely.",
    targetId: "target-amber-balanced" },
  { match: /american amber|red ale|amber ale/i, classicCityId: "chico",
    example: "(style) American Amber", brewery: "various", city: "Northern California, USA",
    why: "A balanced sulfate-leaning profile lets an amber ale's caramel malt and citrusy hops share the stage — soft base water tuned toward a slight hop emphasis.",
    targetId: "target-amber-balanced" },
  { match: /american stout|imperial stout|russian imperial/i, classicCityId: "london",
    example: "(historic) Courage Russian Imperial Stout", brewery: "Courage", city: "London, UK",
    why: "Like its London ancestors, a big stout wants some alkalinity to offset the mountain of acidic roasted malt — otherwise the mash pH crashes. Balance the roast against a moderately alkaline, chloride-leaning water.",
    targetId: "target-black-balanced" },
  { match: /baltic porter/i, classicCityId: "tartu-baltic",
    example: "Żywiec Porter", brewery: "Żywiec", city: "Poland / Baltic region",
    why: "The Baltic region's moderately mineralised water carries this strong, cold-fermented dark lager, its balance supporting deep malt without sharpening into harshness.",
    targetId: "target-black-balanced" },
  { match: /american lager|light lager|cream ale|american wheat/i, classicCityId: "san-francisco",
    example: "(style) American Lager", brewery: "various", city: "USA",
    why: "Light American styles want minimal mineral character — soft, low-sulfate, low-chloride water keeps them clean, crisp and neutral, exactly as intended.",
    targetId: "target-mineral-free" },
];

export function matchClassicWaterForStyle(styleName: string | null | undefined): StyleWaterAnchor | null {
  if (!styleName) return null;
  for (const a of ANCHORS) if (a.match.test(styleName)) return a;
  return null;
}

// The classic beers a given city's water anchors — for the city profile page.
export function anchorsForCity(cityId: string): StyleWaterAnchor[] {
  return ANCHORS.filter((a) => a.classicCityId === cityId);
}

export const STYLE_WATER_ANCHOR_COUNT = ANCHORS.length;
