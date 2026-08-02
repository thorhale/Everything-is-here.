import type { Metadata } from "next";
import Link from "next/link";
import PitchingWorkbench from "./PitchingWorkbench";
// Picker data is baked into the bundle (build-picker-data.mjs), so this reads
// no database. The page stays dynamic only because it honours a ?strain= param.
import { strainPicks } from "@/lib/picker-data";
import { getArchetypes } from "@/lib/fermentation";

export const metadata: Metadata = {
  title: "Yeast Pitching & Inoculation — WortHogg",
  description:
    "How much yeast to pitch, for every kind of ferment — beer by cells/mL, wine and cider by grams per hectolitre, plus sourced guidance for sake, spirits and spontaneous ferments.",
};

interface Props {
  searchParams: Promise<{ strain?: string }>;
}

export default async function PitchingPage({ searchParams }: Props) {
  const { strain: strainId } = await searchParams;
  const strains = strainPicks;
  const archetypes = await getArchetypes();
  const chosen = strainId ? strainPicks.find((s) => s.id === strainId) ?? null : null;
  const initialBeer = chosen?.uses.includes("beer")
    ? { pitchType: (chosen.species ?? "").toLowerCase().includes("pastorianus") ? ("lager" as const) : ("ale" as const) }
    : undefined;

  return (
    <div>
      <h1>Yeast Pitching &amp; Inoculation</h1>
      <p style={{ color: "#666", maxWidth: 760 }}>
        Every kind of ferment doses yeast differently. Beer is pitched by viable
        cells per mL per degree Plato; wine, cider and mead by grams of active
        dry yeast per hectolitre; sake runs a starter culture plus a separate
        yeast; distillers and spontaneous ferments are chosen and conditioned
        rather than rate-calculated. Pick a beverage below. See{" "}
        <Link href="/fermentation">fermentation &amp; yeast handling</Link> for
        the full sourced reference.
      </p>

      <PitchingWorkbench
        strains={strains}
        initialStrainId={strainId}
        initialBeer={initialBeer}
        archetypes={archetypes}
      />

      <p style={{ fontSize: "0.8rem", color: "var(--wh-text-light)", marginTop: "2rem" }}>
        The beer model is an independent reconstruction of the classic Mr Malty
        calculator, whose pitching math is not public (it runs server-side) —
        built from the published homebrewing literature it&apos;s based on:
        White &amp; Zainasheff&apos;s <em>Yeast</em> for target rates and
        viable-cell counts, the{" "}
        <a
          href="https://www.maltosefalcons.com/blogs/brewing-techniques-tips/yeast-propagation-and-maintenance-principles-and-practices"
          target="_blank"
          rel="noreferrer"
        >
          Maltose Falcons yeast-propagation guide
        </a>{" "}
        for per-method starter cell densities, and Kai Troester&apos;s
        (Braukaiser) growth experiments for the starter curve. The wine/cider
        inoculation rate is the AWRI rehydration standard. Treat results as close
        approximations. WortHogg is not affiliated with Mr Malty.
      </p>
    </div>
  );
}
