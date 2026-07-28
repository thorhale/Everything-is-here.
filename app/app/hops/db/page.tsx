export const dynamic = "force-dynamic";

import Link from "next/link";
import { getHopCatalog, getIngredientFacets } from "@/lib/ingredients-curated";

export const metadata = {
  title: "Hop Database — WortHogg",
  description: "Hop varieties with alpha/beta acids, cohumulone, oil composition, aroma descriptors, and substitutes.",
};

interface Props {
  searchParams: Promise<{ country?: string; purpose?: string; aroma?: string; q?: string }>;
}

export default async function HopDbPage({ searchParams }: Props) {
  const sp = await searchParams;
  const [hops, facets] = await Promise.all([
    getHopCatalog({ country: sp.country, purpose: sp.purpose, aroma: sp.aroma, search: sp.q }),
    getIngredientFacets(),
  ]);

  return (
    <div>
      <h1>Hop Database</h1>
      <p style={{ color: "var(--wh-text-light)" }}>
        Hop varieties with alpha and beta acids, cohumulone, oil breakdown, aroma descriptors, and
        substitutes. Alpha acid varies by crop year — brew to the analysis on your bag.
      </p>

      <form method="get" style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "flex-end", margin: "1rem 0" }}>
        <label style={lbl}>
          Search
          <input type="text" name="q" defaultValue={sp.q ?? ""} placeholder="name or aroma" style={inp} />
        </label>
        <label style={lbl}>
          Origin
          <select name="country" defaultValue={sp.country ?? ""} style={inp}>
            <option value="">any</option>
            {facets.countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label style={lbl}>
          Purpose
          <select name="purpose" defaultValue={sp.purpose ?? ""} style={inp}>
            <option value="">any</option>
            <option value="aroma">aroma</option>
            <option value="bittering">bittering</option>
            <option value="dual">dual</option>
          </select>
        </label>
        <button type="submit" className="wh-btn">Filter</button>
        {(sp.q || sp.country || sp.purpose || sp.aroma) && (
          <Link href="/hops/db" className="wh-btn-secondary" style={{ textDecoration: "none" }}>Clear</Link>
        )}
      </form>

      {sp.aroma && (
        <p style={{ fontSize: "0.9rem" }}>
          Hops with <strong>{sp.aroma}</strong> character. <Link href="/hops/db">clear</Link>
        </p>
      )}

      <p style={{ fontSize: "0.85rem", color: "var(--wh-text-light)" }}>
        {hops.length} variet{hops.length === 1 ? "y" : "ies"}
      </p>

      <table>
        <thead>
          <tr>
            <th>Hop</th>
            <th className="hide-mobile">Origin</th>
            <th>Alpha</th>
            <th className="hide-mobile">Purpose</th>
            <th>Aroma</th>
          </tr>
        </thead>
        <tbody>
          {hops.map((h) => (
            <tr key={h.id}>
              <td className="nowrap"><Link href={`/hops/db/${encodeURIComponent(h.id)}`}>{h.name}</Link></td>
              <td className="hide-mobile nowrap">{h.country}</td>
              <td className="nowrap">
                {h.alphaMin != null && h.alphaMax != null ? `${h.alphaMin}–${h.alphaMax}%` : "—"}
              </td>
              <td className="hide-mobile">{h.purpose}</td>
              <td style={{ fontSize: "0.85rem" }}>{h.aromaDescriptors.slice(0, 4).join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const inp: React.CSSProperties = { padding: "0.3rem", border: "1px solid #ccc", borderRadius: 4 };
const lbl: React.CSSProperties = { display: "flex", flexDirection: "column", fontSize: "0.8rem", gap: "0.2rem" };
