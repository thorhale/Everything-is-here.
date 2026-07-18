import type { Metadata } from "next";
import PitchingForm from "./PitchingForm";

export const metadata: Metadata = {
  title: "Yeast Pitching Rate Calculator — WortHogg",
  description:
    "Work out how much yeast to pitch, and how to build a starter to hit the target — for liquid vials/packs, dry yeast, or repitched slurry.",
};

export default function PitchingPage() {
  return (
    <div>
      <h1>Yeast Pitching Rate Calculator</h1>
      <p style={{ color: "#666" }}>
        How many healthy cells does your batch need, and how do you get there
        from a vial, a dry pack, or last batch&apos;s slurry? Enter your batch
        details and yeast source below. A reconstruction of the classic Mr Malty
        calculator — see the note at the bottom for how the numbers are derived.
      </p>
      <PitchingForm />

      <p style={{ fontSize: "0.8rem", color: "var(--wh-text-light)", marginTop: "2rem" }}>
        Mr Malty&apos;s pitching math is not public (it runs server-side), so
        this is an independent reconstruction from the published homebrewing
        literature it&apos;s built on — White &amp; Zainasheff&apos;s{" "}
        <em>Yeast</em> for target rates and viable-cell counts, the{" "}
        <a
          href="https://www.maltosefalcons.com/blogs/brewing-techniques-tips/yeast-propagation-and-maintenance-principles-and-practices"
          target="_blank"
          rel="noreferrer"
        >
          Maltose Falcons yeast-propagation guide
        </a>{" "}
        for per-method starter cell densities, and Kai Troester&apos;s
        (Braukaiser) growth experiments for the starter curve. Treat the
        results as close approximations. WortHogg is not affiliated with Mr
        Malty.
      </p>
    </div>
  );
}
