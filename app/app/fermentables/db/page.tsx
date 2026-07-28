export const dynamic = "force-dynamic";

import Link from "next/link";
import { getFermentableCatalog, getIngredientFacets } from "@/lib/ingredients-curated";

export const metadata = {
  title: "Fermentable Database — WortHogg",
  description:
    "Malts, adjunct grains, sugars, syrups, fruit, juice, and novelty adjuncts with extract (PPG), colour, and mash requirements.",
};

interface Props {
  searchParams: Promise<{ category?: string; use?: string; q?: string; brand?: string }>;
}

const CATEGORY_LABELS: Record<string, string> = {
  "base-malt": "Base malts",
  "specialty-malt": "Specialty malts",
  "adjunct-grain": "Adjunct grains",
  sugar: "Sugars",
  syrup: "Syrups",
  fruit: "Fruit",
  juice: "Juice",
  cereal: "Cereal & novelty",
  extract: "Extracts",
  other: "Flavourings",
};

export default async function FermentableDbPage({ searchParams }: Props) {
  const sp = await searchParams;
  const [items, facets] = await Promise.all([
    getFermentableCatalog({ category: sp.category, use: sp.use, brand: sp.brand, search: sp.q }),
    getIngredientFacets(),
  ]);

  return (
    <div>
      <h1>Fermentable Database</h1>
      <p style={{ color: "var(--wh-text-light)" }}>
        Everything you can ferment — malts and adjunct grains through sugars, fruit, juice, and
        the novelty end of the shelf. Extract (PPG) comes from maltster datasheets where they
        exist, and is derived from Nutrition Facts panels where they don&apos;t.{" "}
        <Link href="/fermentables/db/method">How the numbers are derived →</Link>
      </p>

      <form method="get" style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "flex-end", margin: "1rem 0" }}>
        {sp.category && <input type="hidden" name="category" value={sp.category} />}
        <label style={lbl}>
          Search
          <input type="text" name="q" defaultValue={sp.q ?? ""} placeholder="name, brand, tag" style={inp} />
        </label>
        <label style={lbl}>
          Used for
          <select name="use" defaultValue={sp.use ?? ""} style={inp}>
            <option value="">any</option>
            {facets.uses.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
        <label style={lbl}>
          Brand
          <select name="brand" defaultValue={sp.brand ?? ""} style={inp}>
            <option value="">any</option>
            {facets.brands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <button type="submit" className="wh-btn">Filter</button>
        {(sp.q || sp.use || sp.brand) && (
          <Link href={sp.category ? `/fermentables/db?category=${sp.category}` : "/fermentables/db"} className="wh-btn-secondary" style={{ textDecoration: "none" }}>Clear</Link>
        )}
      </form>

      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <Chip label="All" href="/fermentables/db" active={!sp.category} />
        {facets.categories.map((c) => (
          <Chip key={c} label={CATEGORY_LABELS[c] ?? c} href={`/fermentables/db?category=${c}`} active={sp.category === c} />
        ))}
      </div>

      <p style={{ fontSize: "0.85rem", color: "var(--wh-text-light)" }}>
        {items.length} fermentable{items.length === 1 ? "" : "s"}
      </p>

      <table>
        <thead>
          <tr>
            <th>Fermentable</th>
            <th className="hide-mobile">Category</th>
            <th>PPG</th>
            <th>Colour</th>
            <th className="hide-mobile">Notes</th>
          </tr>
        </thead>
        <tbody>
          {items.map((f) => (
            <tr key={f.id}>
              <td>
                <Link href={`/fermentables/db/${encodeURIComponent(f.id)}`}>{f.name}</Link>
                {f.brand && <span style={{ color: "var(--wh-text-light)", fontSize: "0.8rem" }}> · {f.brand}</span>}
              </td>
              <td className="hide-mobile">{CATEGORY_LABELS[f.category] ?? f.category}</td>
              <td className="nowrap">{f.ppg != null ? f.ppg.toFixed(1) : "—"}</td>
              <td className="nowrap">{f.colorLovibond != null ? `${f.colorLovibond} °L` : "—"}</td>
              <td className="hide-mobile" style={{ fontSize: "0.8rem", color: "var(--wh-text-light)" }}>
                {f.ppgBasis === "nutrition" && "from label · "}
                {f.requiresConversion && "needs mash"}
                {f.fermentabilityPct === 0 && "unfermentable"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Chip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link href={href} className="wh-style-chip" style={{ textDecoration: "none", background: active ? "var(--wh-accent)" : undefined, color: active ? "#fff" : undefined, borderColor: active ? "var(--wh-accent)" : undefined }}>
      {label}
    </Link>
  );
}

const inp: React.CSSProperties = { padding: "0.3rem", border: "1px solid #ccc", borderRadius: 4 };
const lbl: React.CSSProperties = { display: "flex", flexDirection: "column", fontSize: "0.8rem", gap: "0.2rem" };
