export const dynamic = "force-dynamic";

import Link from "next/link";
import { getEditions } from "@/lib/guidelines";

export const metadata = { title: "Style Guidelines - WortHogg" };

const SYSTEM_LABELS: Record<string, string> = {
  BJCP: "BJCP Style Guidelines",
  BA: "World Beer Cup / GABF (Brewers Association)",
  AWS: "Wine (American Wine Society)",
};

const SYSTEM_BLURBS: Record<string, string> = {
  BJCP:
    "The Beer Judge Certification Program guidelines used by homebrew competitions. The 2008 and 2015 editions include mead and cider categories.",
  BA:
    "The Brewers Association publishes one guideline set per year - it is the judging basis for both the World Beer Cup® and the Great American Beer Festival®.",
  AWS:
    "The American Wine Society's national amateur competition wine classes, judged on the UC Davis 20-point system.",
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
        Competition style guidelines across iterations - pick a system and an edition to browse
        its categories, vital statistics, and full style descriptions. Beer, mead, cider, and
        wine are all covered.
      </p>
      {["BJCP", "BA", "AWS"].map((sys) => {
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
