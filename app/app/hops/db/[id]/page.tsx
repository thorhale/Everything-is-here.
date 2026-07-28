export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { getHop } from "@/lib/ingredients-curated";
import { getHopSubstitutes } from "@/lib/substitutions";

interface Props {
  params: Promise<{ id: string }>;
}

const STRENGTH_LABEL: Record<string, string> = {
  same: "direct swap",
  close: "close",
  similar: "similar",
};

async function SubstituteSection({ hopId, rawList }: { hopId: string; rawList: string[] }) {
  const subs = await getHopSubstitutes(hopId);
  if (subs.length === 0 && rawList.length === 0) return null;
  return (
    <>
      <h3>If you can&apos;t get it</h3>
      {subs.length > 0 ? (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {subs.map((s) => (
            <li key={s.item.id} style={{ padding: "0.4rem 0", borderBottom: "1px solid var(--wh-border-light)" }}>
              <Link href={`/hops/db/${encodeURIComponent(s.item.id)}`} style={{ fontWeight: 600 }}>
                {s.item.name}
              </Link>
              <span className="wh-style-chip" style={{ marginLeft: "0.5rem", fontSize: "0.7rem" }}>
                {STRENGTH_LABEL[s.strength]}
              </span>
              <div style={{ fontSize: "0.8rem", color: "var(--wh-text-light)" }}>
                {s.reason}
                {s.item.alphaMin != null && s.item.alphaMax != null && ` · ${s.item.alphaMin}–${s.item.alphaMax}% AA`}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p>{rawList.join(", ")}</p>
      )}
      <p style={{ fontSize: "0.78rem", color: "var(--wh-text-light)" }}>
        Match bitterness by alpha acid, not by weight — if you swap a 14% AA hop for a 5% one,
        scale the charge up accordingly. The <Link href="/calculator">recipe calculator</Link> will
        show you the new IBU.
      </p>
    </>
  );
}

function range(min: number | null, max: number | null, unit: string): string | null {
  if (min != null && max != null) return min === max ? `${min}${unit}` : `${min}–${max}${unit}`;
  if (max != null) return `${max}${unit}`;
  if (min != null) return `${min}${unit}`;
  return null;
}

export default async function HopDetailPage({ params }: Props) {
  const { id } = await params;
  const h = await getHop(id);
  if (!h) notFound();

  const specs: [string, string | null][] = [
    ["Origin", h.country],
    ["Purpose", h.purpose],
    ["Alpha acid", range(h.alphaMin, h.alphaMax, "%")],
    ["Beta acid", range(h.betaMin, h.betaMax, "%")],
    ["Cohumulone", range(h.cohumuloneMin, h.cohumuloneMax, "% of alpha")],
    ["Total oil", range(h.totalOilMin, h.totalOilMax, " mL/100g")],
    ["Myrcene", h.myrcenePct != null ? `${h.myrcenePct}% of oil` : null],
    ["Humulene", h.humulenePct != null ? `${h.humulenePct}% of oil` : null],
    ["Caryophyllene", h.caryophyllenePct != null ? `${h.caryophyllenePct}% of oil` : null],
    ["Farnesene", h.farnescenePct != null ? `${h.farnescenePct}% of oil` : null],
    ["Breeder", h.breeder],
    ["Released", h.yearReleased != null ? String(h.yearReleased) : null],
  ];

  return (
    <div>
      <header className="recipe-header">
        <div>
          <h1>{h.name}</h1>
          <p className="flush">
            {h.country}
            {h.purpose ? ` · ${h.purpose}` : ""}
            {h.aliases.length ? ` · also ${h.aliases.join(", ")}` : ""}
          </p>
        </div>
      </header>

      {h.description && <p>{h.description}</p>}

      {h.aromaDescriptors.length > 0 && (
        <>
          <h3>Aroma</h3>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {h.aromaDescriptors.map((a) => (
              <Link key={a} href={`/hops/db?aroma=${encodeURIComponent(a)}`} className="wh-style-chip" style={{ textDecoration: "none" }}>
                {a}
              </Link>
            ))}
          </div>
        </>
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
      <p style={{ fontSize: "0.8rem", color: "var(--wh-text-light)" }}>
        Cohumulone is the fraction of alpha acid associated with harsher bitterness — lower
        generally means a smoother bitter charge.
      </p>

      <SubstituteSection hopId={h.id} rawList={h.substitutes} />

      {h.usageNotes && (
        <>
          <h3>Using it</h3>
          <p>{h.usageNotes}</p>
        </>
      )}

      <p style={{ fontSize: "0.8rem", color: "var(--wh-text-light)", marginTop: "2rem" }}>
        {h.attribution ?? ""}{" "}
        <a href={h.sourceUrl} target="_blank" rel="noreferrer">Source</a>.{" "}
        <Link href="/hops/db">← Back to the hop database</Link>
      </p>
    </div>
  );
}
