import CalculatorForm from "./CalculatorForm";
// Picker lists are bundled at build time (build-picker-data.mjs) — no database,
// so this page prerenders fully static and runs offline in the native shell.
import { strainPicks as strains, fermentablePicks as fermentables, hopPicks as hops } from "@/lib/picker-data";

export default function CalculatorPage() {
  return (
    <div>
      <h1>Recipe Calculator</h1>
      <p style={{ color: "#666" }}>
        A recreation of BrewToad&apos;s original recipe calculator, using the gravity, Tinseth
        IBU, Morey color, and ABV formulas extracted from the archived site (see{" "}
        <code>docs/calculator-formulas.md</code>). Stats update live as you edit ingredients.
      </p>
      <CalculatorForm strains={strains} fermentableOptions={fermentables} hopOptions={hops} />
    </div>
  );
}
