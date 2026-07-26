export const dynamic = "force-dynamic";

import Link from "next/link";
import { getYeastTypes } from "@/lib/ingredients";

export const metadata = { title: "Yeasts - WortHogg" };

export default async function YeastsPage() {
  const yeasts = await getYeastTypes();

  return (
    <div>
      <h1>Yeasts</h1>
      <div
        style={{
          background: "var(--wh-bg-warm)",
          border: "1px solid var(--wh-border)",
          borderRadius: 8,
          padding: "0.9rem 1.1rem",
          margin: "0.75rem 0 1.25rem",
        }}
      >
        <strong>New: the Yeast Database.</strong> A sourced catalog of brewing, wine, mead,
        cider, and distilling strains with attenuation, temperature, and pitch specs — searchable
        by use case and style.{" "}
        <Link href="/yeasts/db">Browse the full yeast database →</Link>
      </div>
      <p style={{ color: "var(--wh-text-light)" }}>
        Below: every yeast used in the archive&apos;s recipes, with labs/products and typical
        attenuation as brewers entered it.
      </p>
      <table>
        <thead>
          <tr>
            <th>Yeast</th>
            <th className="hide-mobile">Labs/Products</th>
            <th>Attenuation</th>
            <th>Used in</th>
          </tr>
        </thead>
        <tbody>
          {yeasts.map((y) => (
            <tr key={y.name}>
              <td>
                <Link href={`/yeasts/${encodeURIComponent(y.name)}`}>{y.name}</Link>
              </td>
              <td className="hide-mobile" style={{ maxWidth: 340, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {y.labs}
              </td>
              <td>{y.attenuation != null ? `${y.attenuation}%` : ""}</td>
              <td>{y.uses.toLocaleString()} recipes</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
