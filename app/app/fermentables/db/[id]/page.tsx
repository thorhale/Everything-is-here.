export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { getFermentable } from "@/lib/ingredients-curated";
import { srmClass } from "@/components/StatBars";
import { SUCROSE_PPG } from "@/lib/fermentable-math";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function FermentableDetailPage({ params }: Props) {
  const { id } = await params;
  const f = await getFermentable(id);
  if (!f) notFound();

  const specs: [string, string | null][] = [
    ["Category", f.category],
    ["Type", f.type],
    ["Brand", f.brand],
    ["Origin", f.origin],
    ["Extract (PPG)", f.ppg != null ? `${f.ppg.toFixed(1)} points/lb/gal` : null],
    ["Yield vs sucrose", f.ppg != null ? `${((f.ppg / SUCROSE_PPG) * 100).toFixed(1)}%` : null],
    ["Colour", f.colorLovibond != null ? `${f.colorLovibond} °L` : null],
    ["Diastatic power", f.diastaticPowerLintner != null ? `${f.diastaticPowerLintner} °Lintner` : null],
    ["Fermentability", f.fermentabilityPct != null ? `${f.fermentabilityPct}%` : null],
    ["Suggested max", f.maxBatchPct != null ? `${f.maxBatchPct}% of grist` : null],
    ["Uses", f.uses.length ? f.uses.join(", ") : null],
  ];

  const derived = f.ppgBasis === "nutrition" && f.servingSizeG != null && f.totalCarbG != null;

  return (
    <div>
      <header className="recipe-header">
        <figure className={`recipe-color ${srmClass(f.colorLovibond)}`} style={{ opacity: f.colorLovibond == null ? 0.25 : 1 }} />
        <div>
          <h1>{f.name}</h1>
          <p className="flush">
            {f.brand ? `${f.brand} · ` : ""}
            {f.category}
          </p>
        </div>
      </header>

      {f.description && <p>{f.description}</p>}
      {f.flavorNotes && (
        <p style={{ color: "var(--wh-text-light)" }}>
          <strong>Flavour:</strong> {f.flavorNotes}
        </p>
      )}

      {(f.requiresConversion || f.requiresGelatinization || f.fermentabilityPct === 0) && (
        <div style={{ background: "var(--wh-bg-warm)", border: "1px solid var(--wh-border)", borderRadius: 8, padding: "0.75rem 1rem", margin: "1rem 0", fontSize: "0.9rem" }}>
          {f.fermentabilityPct === 0 && <div><strong>Unfermentable.</strong> Raises gravity and stays in the finished beer as sweetness and body — it does not produce alcohol.</div>}
          {f.requiresGelatinization && <div><strong>Needs a cereal mash.</strong> The starch must be cooked to gelatinise before enzymes can reach it.</div>}
          {f.requiresConversion && !f.requiresGelatinization && <div><strong>Needs conversion.</strong> No enzymes of its own — mash alongside a diastatic base malt.</div>}
        </div>
      )}

      <h3>Specifications</h3>
      <table>
        <tbody>
          {specs.filter(([, v]) => v).map(([k, v]) => (
            <tr key={k}>
              <th style={{ textAlign: "left", width: 200, whiteSpace: "nowrap" }}>{k}</th>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {derived && (
        <>
          <h3>How this PPG was derived</h3>
          <p style={{ fontSize: "0.9rem" }}>
            No brewing datasheet exists for this ingredient, so its extract is computed from the
            Nutrition Facts panel. Pure sucrose is {SUCROSE_PPG} PPG, and anything else contributes
            in proportion to its fermentable-carbohydrate fraction:
          </p>
          <pre style={{ background: "var(--wh-bg-soft)", border: "1px solid var(--wh-border)", borderRadius: 6, padding: "0.75rem", overflowX: "auto", fontSize: "0.85rem" }}>
{`serving size      ${f.servingSizeG} g
total carbohydrate ${f.totalCarbG} g
dietary fibre      ${f.fiberG ?? 0} g   (not fermentable, subtracted)

available carb = ${f.totalCarbG} - ${f.fiberG ?? 0} = ${(f.totalCarbG! - (f.fiberG ?? 0)).toFixed(1)} g
fraction       = ${(f.totalCarbG! - (f.fiberG ?? 0)).toFixed(1)} / ${f.servingSizeG} = ${((f.totalCarbG! - (f.fiberG ?? 0)) / f.servingSizeG!).toFixed(3)}
PPG            = ${SUCROSE_PPG} x ${((f.totalCarbG! - (f.fiberG ?? 0)) / f.servingSizeG!).toFixed(3)} = ${f.ppg?.toFixed(1)}`}
          </pre>
          <p style={{ fontSize: "0.85rem", color: "var(--wh-text-light)" }}>
            This is <em>potential</em> extract. {f.requiresConversion ? "Because this is a starch, reaching it requires enzymatic conversion in the mash." : "Being sugar-based, it is directly available to the yeast."}
          </p>
        </>
      )}

      {f.usageNotes && (
        <>
          <h3>Using it</h3>
          <p>{f.usageNotes}</p>
        </>
      )}

      <p style={{ fontSize: "0.8rem", color: "var(--wh-text-light)", marginTop: "2rem" }}>
        {f.attribution ?? ""}{" "}
        <a href={f.sourceUrl} target="_blank" rel="noreferrer">Source</a>.{" "}
        <Link href="/fermentables/db">← Back to the fermentable database</Link>
      </p>
    </div>
  );
}
