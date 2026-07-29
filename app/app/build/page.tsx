import Link from "next/link";
import BuilderForm from "./BuilderForm";
import { getFermentablePickerList, getHopPickerList } from "@/lib/ingredients-curated";
import { getStrainPickerList } from "@/lib/yeasts-curated";
import { getWaterPickerList } from "@/lib/water";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Recipe builder — WortHogg",
  description:
    "One recipe builder for beer, cider, wine, mead and spirit washes. Every ingredient from one database, and fruit priced as the range it really is.",
};

export default async function BuildPage() {
  const [fermentables, hops, strains, waters] = await Promise.all([
    getFermentablePickerList(),
    getHopPickerList(),
    getStrainPickerList(),
    getWaterPickerList(),
  ]);

  return (
    <div>
      <h1>Recipe builder</h1>
      <p style={{ color: "var(--wh-text-light)", maxWidth: 720 }}>
        One builder, every fermentable. Beer, cider, wine, mead and a distiller&apos;s wash are normally five separate
        calculators, because their inputs look different — pounds of malt against litres of juice against kilograms of
        honey. Underneath they are the same sum: <strong>sugar in, divided by volume</strong>. Mash efficiency is not a
        special case, it is a yield factor on one kind of ingredient.
      </p>
      <p style={{ color: "var(--wh-text-light)", maxWidth: 720, fontSize: "0.9rem" }}>
        The one thing this will not do is pretend fruit is precise. A supermarket apple runs anywhere from 9 to 14 g of
        sugar per 100 g depending on cultivar, season and how long it sat in a warehouse, and a Zinfandel block picked
        over three days can move four degrees Brix. So the gravity comes out as a band, not a number — and if you have a
        refractometer reading, entering it collapses the band to a point.
      </p>

      <BuilderForm fermentables={fermentables} hops={hops} strains={strains} waters={waters} />

      <p style={{ fontSize: "0.85rem" }}>
        Looking for the original BrewToad calculator, rebuilt from its own archived formulas? That is still at{" "}
        <Link href="/calculator">/calculator</Link>. Everything that goes in the fermenter without contributing sugar —
        acids, nutrients, enzymes, finings, oak — is catalogued under{" "}
        <Link href="/additives">additives</Link>.
      </p>
    </div>
  );
}
