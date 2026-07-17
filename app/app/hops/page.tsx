export const dynamic = "force-dynamic";

import Link from "next/link";
import { getHopVarietals } from "@/lib/ingredients";

export const metadata = { title: "Hops - WortHogg" };

export default async function HopsPage() {
  const hops = await getHopVarietals();

  return (
    <div>
      <h1>Hops</h1>
      <p style={{ color: "var(--wh-text-light)" }}>
        Every hop varietal used in the archive&apos;s recipes, with typical alpha acid as
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
