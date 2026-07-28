import Link from "next/link";
import Toolbox from "./Toolbox";

export const metadata = {
  title: "Brewer's Toolbox — WortHogg",
  description:
    "Classic brewing utility calculators: gravity conversion, hydrometer and refractometer correction, ABV, priming and keg carbonation, dilution, and mash temperatures.",
};

export default function ToolsPage() {
  return (
    <div>
      <h1>Brewer&apos;s Toolbox</h1>
      <p style={{ color: "#666" }}>
        The classic ProMash-style utility calculators, in one place — gravity conversions,
        hydrometer and refractometer correction, alcohol and calories, priming and keg
        carbonation, dilution and boil-off, and mash temperatures. Every result updates live.
      </p>
      <Toolbox />
      <p style={{ fontSize: "0.8rem", color: "var(--wh-text-light)", marginTop: "2rem" }}>
        All formulas are the standard, published homebrewing equations (implemented in{" "}
        <code>lib/brewing-calcs.ts</code>) and each is validated against known reference values —
        e.g. 1&nbsp;g gypsum in the <Link href="/water/builder">water tool</Link>, 5&nbsp;gal at
        2.4&nbsp;vols / 68&nbsp;°F ≈ 4.5&nbsp;oz corn sugar here. For full recipes use the{" "}
        <Link href="/calculator">recipe calculator</Link>; for yeast, the{" "}
        <Link href="/pitching">pitching calculator</Link>.
      </p>
    </div>
  );
}
