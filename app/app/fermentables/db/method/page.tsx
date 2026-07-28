import Link from "next/link";
import { SUCROSE_PPG } from "@/lib/fermentable-math";

export const metadata = { title: "How adjunct PPG is derived — WortHogg" };

export default function MethodPage() {
  return (
    <div>
      <h1>Deriving extract from a Nutrition Facts panel</h1>
      <p style={{ color: "var(--wh-text-light)" }}>
        Maltsters publish extract figures. The long tail of what people actually ferment —
        breakfast cereal, palm sugar, arborio rice, marshmallows, mango — does not have a brewing
        datasheet. It does have a nutrition label, and that is enough.
      </p>

      <h2>The reference point</h2>
      <p>
        Pure sucrose contributes <strong>{SUCROSE_PPG} gravity points per pound per gallon</strong>{" "}
        — one pound of table sugar in one gallon of water gives 1.046. Every other fermentable
        contributes in proportion to how much of its weight is fermentable carbohydrate:
      </p>
      <pre style={pre}>PPG = {SUCROSE_PPG} × (available carbohydrate ÷ total weight)</pre>

      <h2>Reading the panel</h2>
      <p>
        <strong>Available carbohydrate = total carbohydrate − dietary fibre − sugar alcohols.</strong>{" "}
        Fibre (cellulose, pectin, inulin) and polyols are not fermentable by brewing yeast and
        contribute no gravity, so they come out. Use the gram serving weight, not &ldquo;1 cup&rdquo;.
      </p>
      <pre style={pre}>
{`Fruity Pebbles
  serving 36 g · total carb 33 g · fibre 0 g
  → 46 × (33 ÷ 36) = 42.2 PPG

Long grain white rice
  serving 100 g · total carb 80 g · fibre 1.3 g
  → 46 × (78.7 ÷ 100) = 36.2 PPG

Coconut palm sugar
  serving 100 g · total carb 94 g · fibre 1 g
  → 46 × (93 ÷ 100) = 42.6 PPG`}
      </pre>

      <h2>The catch: potential vs achievable</h2>
      <p>
        A derived PPG is a <em>ceiling</em>, not a promise. What you actually get depends on the
        form the carbohydrate is in:
      </p>
      <ul>
        <li>
          <strong>Simple sugars</strong> (sucrose, glucose, fructose — candy, syrup, palm sugar,
          juice) are directly fermentable. You get essentially the full number.
        </li>
        <li>
          <strong>Starch</strong> (rice, corn, oats, cereal, potato) has to be gelatinised and
          enzymatically converted before yeast can touch it. Mash it with a high-diastatic base
          malt, and cereal-mash the raw grains first. Entries that need this are flagged
          &ldquo;needs mash&rdquo; and &ldquo;needs a cereal mash&rdquo;.
        </li>
        <li>
          <strong>Fibre-heavy fruit</strong> gives a low PPG per pound, and that is correct — most
          of the weight is water. You add raspberries for aroma and colour, not gravity.
        </li>
      </ul>

      <h2>Things the label will not tell you</h2>
      <ul>
        <li>
          <strong>Fat wrecks foam.</strong> Peanut butter, sandwich cookies, and coated cereals
          carry fat that destroys head retention and can go rancid. The PPG may look fine; the
          beer will not.
        </li>
        <li>
          <strong>Lactose is a trap.</strong> It has a perfectly respectable 35 PPG but brewing
          yeast cannot ferment it at all — it raises OG and FG equally. That is the point of it
          in a milk stout, but it means the calculator&apos;s ABV needs the fermentability figure,
          not just PPG.
        </li>
        <li>
          <strong>Colour is not on the label.</strong> Lovibond values here are typical
          observed values, not derived.
        </li>
      </ul>

      <p style={{ fontSize: "0.85rem", color: "var(--wh-text-light)", marginTop: "2rem" }}>
        Implemented in <code>lib/fermentable-math.ts</code>; every derived entry stores its serving
        size, carbohydrate, and fibre so the arithmetic can be checked.{" "}
        <Link href="/fermentables/db">← Back to the fermentable database</Link>
      </p>
    </div>
  );
}

const pre: React.CSSProperties = {
  background: "var(--wh-bg-soft)",
  border: "1px solid var(--wh-border)",
  borderRadius: 6,
  padding: "0.75rem",
  overflowX: "auto",
  fontSize: "0.85rem",
};
