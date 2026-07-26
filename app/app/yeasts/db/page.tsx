export const dynamic = "force-dynamic";

import Link from "next/link";
import { getStrains, getFacets, getLabs } from "@/lib/yeasts-curated";
import { StrainGrid } from "@/components/StrainCard";

export const metadata = {
  title: "Yeast Database — WortHogg",
  description:
    "A sourced database of brewing, winemaking, mead, cider, and distilling yeasts and cultures. Search by use case, style, species, or brand.",
};

interface Props {
  searchParams: Promise<{ use?: string; style?: string; lab?: string; species?: string; form?: string; q?: string }>;
}

const USE_LABELS: Record<string, string> = {
  beer: "Beer", wine: "Wine", mead: "Mead", cider: "Cider",
  whiskey: "Whiskey", rum: "Rum", moonshine: "Moonshine/Neutral",
  neutral: "Neutral spirit", sake: "Sake", wild: "Wild/Sour",
};

export default async function YeastDbPage({ searchParams }: Props) {
  const sp = await searchParams;
  const filter = {
    use: sp.use, style: sp.style, lab: sp.lab, species: sp.species, form: sp.form, search: sp.q,
  };
  const [strains, facets, labs] = await Promise.all([getStrains(filter), getFacets(), getLabs()]);

  const activeUse = sp.use;

  return (
    <div>
      <h1>Yeast Database</h1>
      <p style={{ color: "var(--wh-text-light)" }}>
        A sourced catalog of alcohol-producing yeasts and cultures — beer, wine, mead, cider,
        and spirits — with the attenuation, temperature, flocculation, and pitch data the
        calculators use. Every strain links to its manufacturer source.
      </p>

      {/* Search + species/form filters (GET form) */}
      <form method="get" style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "flex-end", margin: "1rem 0" }}>
        {sp.use && <input type="hidden" name="use" value={sp.use} />}
        {sp.style && <input type="hidden" name="style" value={sp.style} />}
        <label style={{ display: "flex", flexDirection: "column", fontSize: "0.8rem", gap: "0.2rem" }}>
          Search
          <input type="text" name="q" defaultValue={sp.q ?? ""} placeholder="name, code, species, brand" style={inp} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", fontSize: "0.8rem", gap: "0.2rem" }}>
          Form
          <select name="form" defaultValue={sp.form ?? ""} style={inp}>
            <option value="">any</option>
            {facets.forms.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", fontSize: "0.8rem", gap: "0.2rem" }}>
          Species
          <select name="species" defaultValue={sp.species ?? ""} style={inp}>
            <option value="">any</option>
            {facets.species.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", fontSize: "0.8rem", gap: "0.2rem" }}>
          Brand
          <select name="lab" defaultValue={sp.lab ?? ""} style={inp}>
            <option value="">any</option>
            {labs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <button type="submit" className="wh-btn">Filter</button>
        {(sp.q || sp.form || sp.species || sp.lab || sp.style) && (
          <Link href={sp.use ? `/yeasts/db?use=${sp.use}` : "/yeasts/db"} className="wh-btn-secondary" style={{ textDecoration: "none" }}>
            Clear
          </Link>
        )}
      </form>

      {/* Use-case chips */}
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
        <UseChip label="All" href="/yeasts/db" active={!activeUse} />
        {facets.uses.map((u) => (
          <UseChip key={u} label={USE_LABELS[u] ?? u} href={`/yeasts/db?use=${u}`} active={activeUse === u} />
        ))}
      </div>

      {sp.style && (
        <p style={{ fontSize: "0.9rem" }}>
          Showing yeasts recommended for <strong>{sp.style}</strong>.{" "}
          <Link href="/yeasts/db">clear</Link>
        </p>
      )}

      <p style={{ fontSize: "0.85rem", color: "var(--wh-text-light)", margin: "0.5rem 0 1rem" }}>
        {strains.length} strain{strains.length === 1 ? "" : "s"}
      </p>

      {strains.length === 0 ? (
        <p style={{ color: "var(--wh-text-light)" }}>No strains match those filters.</p>
      ) : (
        <StrainGrid strains={strains} />
      )}
    </div>
  );
}

function UseChip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className="wh-style-chip"
      style={{
        textDecoration: "none",
        background: active ? "var(--wh-accent)" : undefined,
        color: active ? "#fff" : undefined,
        borderColor: active ? "var(--wh-accent)" : undefined,
      }}
    >
      {label}
    </Link>
  );
}

const inp: React.CSSProperties = { padding: "0.3rem", border: "1px solid #ccc", borderRadius: 4 };
