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
};

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
        descriptions. Beer, mead, cider and wine are covered by judging guidelines; spirits and
        traditional fermented drinks, which have none, are covered by their legal standards of
        identity instead.
      </p>
      {["BJCP", "BA", "AWS", "SPIRITS", "FERMENTED"].map((sys) => {
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
