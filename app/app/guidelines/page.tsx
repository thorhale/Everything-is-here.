export const dynamic = "force-dynamic";

import Link from "next/link";
import { getEditions } from "@/lib/guidelines";

export const metadata = { title: "Style Guidelines - WortHogg" };

const SYSTEM_LABELS: Record<string, string> = {
  BJCP: "BJCP Style Guidelines",
  BA: "World Beer Cup / GABF (Brewers Association)",
  AWS: "Wine (American Wine Society)",
  SPIRITS: "Spirits — Legal Definitions & Standards of Identity",
  FERMENTED: "Fortified, Aromatised & Traditional Fermented",
  BEERLAW: "Beer Law — Purity Laws & Protected Designations",
  SAKE: "Sake (Seishu) — Legal Classification",
  CIDERLAW: "Cider & Perry — Appellations & Legal Standards",
};

const SYSTEM_BLURBS: Record<string, string> = {
  BJCP:
    "The Beer Judge Certification Program guidelines used by homebrew competitions. The 2008 and 2015 editions include mead and cider categories.",
  BA:
    "The Brewers Association publishes one guideline set per year - it is the judging basis for both the World Beer Cup® and the Great American Beer Festival®.",
  AWS:
    "The American Wine Society's national amateur competition wine classes, judged on the UC Davis 20-point system.",
  SPIRITS:
    "Distilled spirits have no judging guidelines - but they do have binding legal definitions. These are the actual statutory standards of identity: the Scotch Whisky Regulations, US 27 CFR, EU 2019/787, Mexico's NOM standards and the AOC decrees.",
  FERMENTED:
    "Fortified and aromatised wines under their protected designations, plus traditional fermented beverages - sake, huangjiu, pulque, palm wine, tej - that fall outside every Western judging guideline.",
  BEERLAW:
    "What may legally be called beer, and where the recipe is dictated by statute: the German purity law and its tax bands, Kolsch and Munchner Bier, Ceske pivo, Trappist and lambic, US 26 U.S.C. 5052, and Japan's malt-ratio classes.",
  SAKE:
    "Japan's National Tax Agency labelling standard has the force of tax law. The eight special designations are defined by rice polishing ratio, koji proportion and alcohol addition - plus the starter methods, treatments and geographical indications.",
  CIDERLAW:
    "Cider is where legal minimum and traditional practice diverge most: a UK cider need only be 35% juice, while an AOC Pays d'Auge must be whole-juice, keeved and bottle-conditioned. Both are here, with the Spanish DOPs and Quebec's ice cider.",
};

// Curated display order for the systems we know about; anything new that turns
// up in the database is appended rather than silently dropped.
const SYSTEM_ORDER = ["BJCP", "BA", "AWS", "SPIRITS", "FERMENTED", "BEERLAW", "SAKE", "CIDERLAW"];

function orderSystems(present: Iterable<string>): string[] {
  const rest = [...present].filter((s) => !SYSTEM_ORDER.includes(s)).sort();
  return [...SYSTEM_ORDER, ...rest];
}

export default async function GuidelinesPage() {
  const editions = await getEditions();
  const bySystem = new Map<string, typeof editions>();
  for (const e of editions) {
    if (!bySystem.has(e.system)) bySystem.set(e.system, []);
    bySystem.get(e.system)!.push(e);
  }

  return (
    <div>
      <h1>Style Guidelines Archive</h1>
      <p style={{ color: "var(--wh-text-light)" }}>
        Pick a system and an edition to browse its categories, vital statistics, and full style
        descriptions. Beer, mead, cider and wine are covered by judging guidelines; spirits, sake
        and the traditional ferments, which have none, are covered by their legal standards of
        identity instead — and because beer and cider have both, they get both.
      </p>
      {orderSystems(bySystem.keys()).map((sys) => {
        const eds = bySystem.get(sys) ?? [];
        if (!eds.length) return null;
        return (
          <section key={sys} style={{ marginBottom: "1.5rem" }}>
            <h2>{SYSTEM_LABELS[sys] ?? sys}</h2>
            <p style={{ color: "var(--wh-text-light)", fontSize: "0.9rem" }}>{SYSTEM_BLURBS[sys]}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {eds.map((e) => (
                <Link key={e.id} href={`/guidelines/${e.id}`} className="wh-style-chip">
                  {e.year}
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
