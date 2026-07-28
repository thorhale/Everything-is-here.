export const dynamic = "force-dynamic";

import Link from "next/link";
import { getHopVarietals } from "@/lib/ingredients";

export const metadata = { title: "Hops - WortHogg" };

export default async function HopsPage() {
  const hops = await getHopVarietals();

  return (
    <div>
      <h1>Hops</h1>
      <div style={{ background: "var(--wh-bg-warm)", border: "1px solid var(--wh-border)", borderRadius: 8, padding: "0.9rem 1.1rem", margin: "0.75rem 0 1.25rem" }}>
        <strong>New: the Hop Database.</strong> Varieties with alpha/beta acids, cohumulone, oil
        composition, aroma descriptors, and substitutes.{" "}
        <Link href="/hops/db">Browse the hop database →</Link>
      </div>
      <p style={{ color: "var(--wh-text-light)" }}>
        Below: every hop varietal used in the archive&apos;s recipes, with typical alpha acid as
        brewers actually entered it.
      </p>
      <table>
        <thead>
          <tr>
            <th>Hop</th>
            <th>Typical AA</th>
            <th>Used in</th>
          </tr>
        </thead>
        <tbody>
          {hops.map((h) => (
            <tr key={h.name}>
              <td>
                <Link href={`/hops/${encodeURIComponent(h.name)}`}>{h.name}</Link>
              </td>
              <td>{h.alpha != null ? `${h.alpha}%` : ""}</td>
              <td>{h.uses.toLocaleString()} recipes</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
