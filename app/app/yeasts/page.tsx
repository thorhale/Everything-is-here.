export const dynamic = "force-dynamic";

import Link from "next/link";
import { getYeastTypes } from "@/lib/ingredients";

export const metadata = { title: "Yeasts - WortHogg" };

export default async function YeastsPage() {
  const yeasts = await getYeastTypes();

  return (
    <div>
      <h1>Yeasts</h1>
      <p style={{ color: "var(--wh-text-light)" }}>
        Every yeast used in the archive&apos;s recipes, with labs/products and typical
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
