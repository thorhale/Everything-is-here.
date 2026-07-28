import CalculatorForm from "./CalculatorForm";
import { getStrainPickerList } from "@/lib/yeasts-curated";
import { getFermentablePickerList, getHopPickerList } from "@/lib/ingredients-curated";

export const dynamic = "force-dynamic";

export default async function CalculatorPage() {
  const [strains, fermentables, hops] = await Promise.all([
    getStrainPickerList(),
    getFermentablePickerList(),
    getHopPickerList(),
  ]);
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
