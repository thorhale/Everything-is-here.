import CalculatorForm from "./CalculatorForm";

export default function CalculatorPage() {
  return (
    <div>
      <h1>Recipe Calculator</h1>
      <p style={{ color: "#666" }}>
        A recreation of BrewToad&apos;s original recipe calculator, using the gravity, Tinseth
        IBU, Morey color, and ABV formulas extracted from the archived site (see{" "}
        <code>docs/calculator-formulas.md</code>). Stats update live as you edit ingredients.
      </p>
      <CalculatorForm />
    </div>
  );
}
