export const dynamic = "force-dynamic";

import Link from "next/link";
import { getFermentables, getMaltsters } from "@/lib/ingredients";

export const metadata = { title: "Fermentables - WortHogg" };

export default async function FermentablesPage() {
  const [ferms, maltsters] = await Promise.all([getFermentables(), getMaltsters()]);

  return (
    <div>
      <h1>Fermentables</h1>
      <div style={{ background: "var(--wh-bg-warm)", border: "1px solid var(--wh-border)", borderRadius: 8, padding: "0.9rem 1.1rem", margin: "0.75rem 0 1.25rem" }}>
        <strong>New: the Fermentable Database.</strong> Malts, adjunct grains, sugars, fruit,
        juice — and the novelty end of the shelf — with extract (PPG), colour, and mash
        requirements. Adjuncts with no brewing datasheet get their PPG derived from the nutrition
        label. <Link href="/fermentables/db">Browse the fermentable database →</Link>
      </div>
      <p style={{ color: "var(--wh-text-light)" }}>
        Below: every malt, extract, sugar, and adjunct used in the archive&apos;s recipes, with the
        maltsters that produced them.
      </p>

      <h3>Malt producers</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1.5rem" }}>
        {maltsters.map((m) => (
          <span key={m.maltster} className="wh-style-chip" title={`${m.products} products`}>
            {m.maltster} ({m.uses.toLocaleString()})
          </span>
        ))}
      </div>

      <h3>Fermentables</h3>
      <table>
        <thead>
          <tr>
            <th>Fermentable</th>
            <th className="hide-mobile">Maltsters</th>
            <th>PPG</th>
            <th>Color</th>
            <th>Used in</th>
          </tr>
        </thead>
        <tbody>
          {ferms.map((f) => (
            <tr key={f.name}>
              <td>
                <Link href={`/fermentables/${encodeURIComponent(f.name)}`}>{f.name}</Link>
              </td>
              <td className="hide-mobile" style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {f.maltsters}
              </td>
              <td>{f.ppg ?? ""}</td>
              <td>{f.color != null ? `${f.color} °L` : ""}</td>
              <td>{f.uses.toLocaleString()} recipes</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
