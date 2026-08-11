// The canonical "what am I fermenting?" vocabulary, shared by the recipe
// builder (/build) and the style-guidelines section.
//
// The builder's own Beverage type (lib/recipe-engine.ts) is the 5-member
// subset that has actual sugar/volume/gravity math: beer, cider, wine, mead,
// spirit. The guideline section needs a wider net — sake and the rice wines,
// the fortified/aromatised wines, and the whole world of indigenous ferments
// that don't fit any of those. Those extra families are `buildable: false`:
// they get a guideline landing but not (yet) a calculator path.
//
// Keeping both features pointed at one list is the point — the ids here are
// the same strings the builder uses for the overlapping five.

export type BeverageFamily =
  | "beer"
  | "cider"
  | "wine"
  | "mead"
  | "spirit"
  | "sake"
  | "fortified"
  | "traditional";

export interface BeverageFamilyDef {
  id: BeverageFamily;
  label: string;
  blurb: string;
  emoji: string;
  /** True when the recipe builder at /build has a calculator path for it. */
  buildable: boolean;
}

export const BEVERAGE_FAMILIES: BeverageFamilyDef[] = [
  { id: "beer", label: "Beer", emoji: "🍺", buildable: true,
    blurb: "Mashed grain and hops. Judging guidelines (BJCP, Brewers Association, the Maltose Falcons) plus the purity laws that dictate what may legally be called beer." },
  { id: "wine", label: "Wine", emoji: "🍷", buildable: true,
    blurb: "Grape must. Amateur competition classes and the appellation law behind the world's wine regions." },
  { id: "cider", label: "Cider & Perry", emoji: "🍏", buildable: true,
    blurb: "Apple and pear. Where the legal minimum (a UK cider need only be 35% juice) and the traditional AOC product diverge hardest." },
  { id: "mead", label: "Mead", emoji: "🍯", buildable: true,
    blurb: "Honey and water. Traditional, fruited, spiced and historical — plus honey wines from tej to the braggot border with beer." },
  { id: "sake", label: "Sake & Rice Wine", emoji: "🍶", buildable: false,
    blurb: "Rice ferments: Japanese sake by its legal grades, Chinese huangjiu, Korean makgeolli and cheongju, and their kin." },
  { id: "spirit", label: "Spirits & Distillates", emoji: "🥃", buildable: true,
    blurb: "Distilled everything — whisky, rum, agave, brandy, gin, baijiu, soju, feni, arkhi — defined by binding legal standards of identity rather than judging sheets." },
  { id: "fortified", label: "Fortified & Aromatised Wine", emoji: "🍾", buildable: false,
    blurb: "Port, sherry, madeira, marsala, vermouth — wines strengthened or aromatised, under their protected designations." },
  { id: "traditional", label: "Traditional & Regional Ferments", emoji: "🌍", buildable: false,
    blurb: "The planet's indigenous drinks: pulque, chicha, umqombothi, airag, kombucha and the rest — most with no statute, described from ethnographic and industry sources." },
];

const BY_ID = new Map(BEVERAGE_FAMILIES.map((b) => [b.id, b]));

export function beverageFamily(id: string): BeverageFamilyDef | undefined {
  return BY_ID.get(id as BeverageFamily);
}

