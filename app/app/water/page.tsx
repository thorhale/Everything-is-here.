export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  getWaterByKind,
  residualAlkalinity,
  sulfateChloride,
  ionRangesOf,
  formatRange,
} from "@/lib/water";
import type { IonKey } from "@/lib/water";
import { cheapestPerGallon, estimatesByProfile, ageInDays, STALE_DAYS } from "@/lib/water-prices";
import type { WaterPrice, WaterPriceEstimate } from "@/lib/water-prices";
import type { WaterProfile } from "@/lib/water";

export const metadata = {
  title: "Water Profiles — WortHogg",
  description:
    "Classic and modern brewing-city water profiles (Burton, Dublin, Munich, Pilsen, Chico, San Diego) plus style targets, with the six brewing ions and derived residual alkalinity and sulfate:chloride balance.",
};

const KIND_LABELS: Record<string, string> = {
  "classic-city": "Classic brewing cities",
  "modern-city": "Modern brewing centers",
  "style-target": "Style targets",
  bottled: "Bottled & purified water",
};
const KIND_ORDER = ["classic-city", "modern-city", "bottled", "style-target"];

function num(v: number | null): string {
  return v == null ? "—" : String(Math.round(v));
}

// A cell for one ion. Most profiles are a single published figure. A profile
// blended from several springs is a range, and showing only its midpoint would
// assert a measurement nobody took — so the range goes underneath, and the
// midpoint is marked as such rather than left to look like a reading.
function IonCell({ value, range }: { value: number | null; range?: [number, number] }) {
  if (!range) return <td>{num(value)}</td>;
  return (
    <td style={{ lineHeight: 1.25 }}>
      <span style={{ opacity: 0.55 }} title="midpoint of the published range, not a measurement">
        ~{num(value)}
      </span>
      <br />
      <span style={{ fontSize: "0.72rem", whiteSpace: "nowrap" }}>{formatRange(range)}</span>
    </td>
  );
}

// Cost per gallon, with the date it was seen. A price with no date is not a
// price — it moves with the retailer, the region and the week — so the age
// travels with the number and goes grey once it is old enough to distrust.
function PriceCell({ price, estimate }: { price?: WaterPrice; estimate?: WaterPriceEstimate }) {
  // An observed price always wins over an estimate. Where only an estimate
  // exists it is shown in italic with "est." on it, because a guess that looks
  // like a measurement is worse than no number at all.
  if (!price) {
    if (!estimate) return <td style={{ color: "var(--wh-text-light)" }}>—</td>;
    return (
      <td style={{ lineHeight: 1.25, whiteSpace: "nowrap", fontStyle: "italic", opacity: 0.75 }}>
        <span title={`${estimate.basis} Assumes ${estimate.packAssumption}.`}>
          ~${estimate.estimatedPricePerGallonUsd.toFixed(2)}
        </span>
        <br />
        <span style={{ fontSize: "0.7rem", opacity: 0.8 }}>est.</span>
      </td>
    );
  }
  const age = ageInDays(price.observedAt);
  const old = age != null && age > STALE_DAYS;
  return (
    <td style={{ lineHeight: 1.25, whiteSpace: "nowrap" }}>
      <a
        href={price.url}
        rel="nofollow noopener"
        style={{ opacity: old ? 0.5 : 1 }}
        title={`${price.product} — ${price.packDescription} at ${price.seller}`}
      >
        ${price.pricePerGallonUsd.toFixed(2)}
      </a>
      <br />
      <span style={{ fontSize: "0.7rem", opacity: 0.6 }}>
        {price.observedAt}
        {old ? " (old)" : ""}
      </span>
    </td>
  );
}

export default async function WaterPage() {
  const byKind = await getWaterByKind();
  const prices = await cheapestPerGallon();
  const estimates = await estimatesByProfile();

  return (
    <div>
      <h1>Water Profiles</h1>
      <p style={{ color: "var(--wh-text-light)" }}>
        The water made the beer. Historic brewing-city profiles and modern targets, in ppm (mg/L),
        with the two numbers that matter derived for you: <strong>residual alkalinity</strong> (how
        hard the water pushes mash pH up — high-RA cities became dark-beer cities) and the{" "}
        <strong>sulfate:chloride balance</strong> (hoppy-and-dry vs malty-and-full).
      </p>
      <p>
        <Link href="/water/builder" className="wh-btn" style={{ textDecoration: "none" }}>
          Open the water / salt calculator →
        </Link>{" "}
        <span style={{ fontSize: "0.85rem", color: "var(--wh-text-light)" }}>
          build any of these profiles from your own water.
        </span>
      </p>

      {KIND_ORDER.filter((k) => byKind[k]?.length).map((kind) => (
        <section key={kind} style={{ marginTop: "1.5rem" }}>
          <h2 style={{ fontSize: "1.15rem" }}>{KIND_LABELS[kind]}</h2>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Profile</th>
                  <th title="Calcium">Ca</th>
                  <th title="Magnesium">Mg</th>
                  <th title="Sodium">Na</th>
                  <th title="Chloride">Cl</th>
                  <th title="Sulfate">SO₄</th>
                  <th title="Bicarbonate">HCO₃</th>
                  <th title="Residual alkalinity">RA</th>
                  <th className="hide-mobile">SO₄:Cl</th>
                  {kind === "bottled" ? (
                    <th title="Cheapest observed price per US gallon, and the date it was seen">
                      $/gal
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {byKind[kind].map((w: WaterProfile) => {
                  const sc = sulfateChloride(w);
                  const ranges = ionRangesOf(w);
                  const cell = (ion: IonKey) => <IonCell value={w[ion]} range={ranges?.[ion]} />;
                  return (
                    <tr key={w.id}>
                      <td className="nowrap">
                        <Link href={`/water/${encodeURIComponent(w.id)}`}>{w.name}</Link>
                        {ranges ? (
                          <span
                            title="Blended from several springs — the bottler publishes a range, not a figure"
                            style={{ fontSize: "0.7rem", opacity: 0.6, marginLeft: "0.35rem" }}
                          >
                            varies
                          </span>
                        ) : null}
                      </td>
                      {cell("calcium")}
                      {cell("magnesium")}
                      {cell("sodium")}
                      {cell("chloride")}
                      {cell("sulfate")}
                      {cell("bicarbonate")}
                      <td>{num(residualAlkalinity(w))}</td>
                      <td className="hide-mobile" style={{ fontSize: "0.8rem" }}>{sc.balance}</td>
                      {kind === "bottled" ? <PriceCell price={prices.get(w.id)} estimate={estimates.get(w.id)} /> : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section style={{ marginTop: "2rem" }}>
        <h2 style={{ fontSize: "1.15rem" }}>Reading the bottled waters</h2>
        <p style={{ fontSize: "0.9rem", color: "var(--wh-text-light)" }}>
          Every profile here comes from the bottler&rsquo;s own analysis or its laboratory&rsquo;s
          report, and every one is checked two ways before it is listed. It must give{" "}
          <strong>all six brewing ions</strong> — half a table is worse than none, because the salt
          calculator would build on the gap and be confidently wrong. And the set must{" "}
          <strong>balance on charge</strong>: water is electrically neutral, so cations and anions
          have to agree once converted to milliequivalents, and a set that does not agree has been
          mistyped or is missing something large.
        </p>
        <p style={{ fontSize: "0.9rem", color: "var(--wh-text-light)" }}>
          Those are two checks rather than one on purpose. Charge balance is often described as
          catching incomplete data, and it does not: strip the sulfate out of Badoit, whose
          bicarbonate is thirty-five times larger, and the balance shifts by 0.2% — completely
          invisible. Only counting the ions catches that. Between them they are why brands
          publishing just the two or three minerals they advertise are absent here.
        </p>
        <p style={{ fontSize: "0.9rem", color: "var(--wh-text-light)" }}>
          Rows marked <strong>varies</strong> are the awkward ones, and most American spring brands
          are among them. They are not one water: the bottler draws from several springs and its
          report gives a <em>range</em> per ion rather than a figure. The range is the measurement,
          so it is what you see; the pale <code>~</code> number above it is only its midpoint, shown
          so the salt calculator has something to work with, and it is not a reading anyone took.
        </p>
        <p style={{ fontSize: "0.9rem", color: "var(--wh-text-light)" }}>
          Whether that matters depends entirely on how wide the range is.{" "}
          <strong>Poland Spring</strong> and <strong>Ozarka</strong> stay soft and barely alkaline
          across their whole span, so you can treat either as a near-blank slate.{" "}
          <strong>Ice Mountain</strong> swings widely but never stops being hard and alkaline, so
          the style it suits is never in doubt even though the numbers are.{" "}
          <strong>Deer Park</strong> reports alkalinity anywhere from 3 to 160 ppm as CaCO₃ — a
          fiftyfold spread that crosses every decision a brewer would make with it. For that one,
          buy distilled water instead and build from zero.
        </p>
        <p style={{ fontSize: "0.9rem", color: "var(--wh-text-light)" }}>
          Crystal Geyser deserves a note of credit. It bottles from seven springs and, alone among
          the American brands, publishes a <em>separate report for each one</em> instead of a single
          blended range — so its bottles are known waters rather than averages, and five of its
          springs are listed here individually. Check which source is on the label before using the
          numbers.
        </p>
        <p style={{ fontSize: "0.9rem", color: "var(--wh-text-light)" }}>
          <strong>What it costs.</strong> The $/gal column is the cheapest observed price per US
          gallon for that water, with the date it was seen — because a bottled-water price is
          worthless without one. It moves with the retailer, the region, the pack and the week, so
          these are dated observations, not <em>the</em> price, and they go grey once they are more
          than six months old. Cheapest rather than average, because pack sizes for the same water
          differ by threefold: S.Pellegrino is $13.09 a gallon in litre bottles and $21.44 in 250 mL
          ones, and an average of those describes no purchase anyone can actually make. Hover a
          price for the pack it came from.
        </p>
        <p style={{ fontSize: "0.9rem", color: "var(--wh-text-light)" }}>
          The spread is the point. Crystal Geyser in gallon jugs is <strong>$0.88</strong> a gallon;
          Acqua Panna in 250 mL glass is <strong>$23.97</strong>, twenty-seven times more for water
          that is chemically unremarkable. For a five-gallon batch that is the difference between
          $4 and $120 of liquor. Prices marked <em>direct</em> come from the producer&rsquo;s own
          shop and run well above shelf price — treat those as an upper bound.
        </p>
        <p style={{ fontSize: "0.9rem", color: "var(--wh-text-light)" }}>
          Prices shown in <em>italic with &ldquo;est.&rdquo;</em> are a different thing entirely:
          not observations but <strong>estimates</strong> of typical US supermarket cost, made
          because a rough number beats an empty cell when you are budgeting a batch. They are
          deliberately <strong>rounded up</strong>, so you over-budget rather than under. They are
          not sourced, not checkable, and not a substitute for looking at a shelf — US bottled water
          pricing varies by region, chain and week far more than a single figure suggests, and
          thinly distributed imports like Badoit vary most of all. Hover one for what it assumes.
        </p>
        <p style={{ fontSize: "0.9rem", color: "var(--wh-text-light)" }}>
          <strong>Purified brands</strong> divide in two. Aquafina and the distilled water sold by
          Poland Spring, Zephyrhills and Ice Mountain report every mineral as not-detected, which is
          what reverse osmosis and distillation are for — use the RO row above for any of them.
          Dasani, smartwater and Essentia are different: they purify and then add minerals back for
          taste, in amounts their makers describe as proprietary and do not publish. They are not
          blank slates and they cannot be brewed to, so they are not listed.
        </p>
      </section>

      <p style={{ fontSize: "0.8rem", color: "var(--wh-text-light)", marginTop: "2rem" }}>
        All values ppm (mg/L). Municipal water varies seasonally and with treatment — these are the
        historical/representative profiles brewers target, not a live tap analysis. Where a bottler
        publishes total alkalinity as CaCO₃ rather than bicarbonate, HCO₃ here is the standard 1.22
        conversion of it, and the profile&rsquo;s note says so.
      </p>
    </div>
  );
}
