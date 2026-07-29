export const dynamic = "force-dynamic";

import Link from "next/link";
import { getAdditives, getAdditiveCounts, ADDITIVE_CATEGORIES } from "@/lib/additives-curated";

export const metadata = {
  title: "Additives — WortHogg",
  description:
    "Acids, nutrients, enzymes, finings, tannins, oak, stabilisers and botanicals — with dose rates and what a gram of each actually does.",
};

const USES = ["beer", "cider", "wine", "mead", "spirits"];

export default async function AdditivesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; use?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const [list, counts] = await Promise.all([
    getAdditives({ category: sp.category, use: sp.use, search: sp.q }),
    getAdditiveCounts(),
  ]);

  const grouped = new Map<string, typeof list>();
  for (const a of list) {
    if (!grouped.has(a.category)) grouped.set(a.category, []);
    grouped.get(a.category)!.push(a);
  }

  return (
    <div>
      <h1>Additives</h1>
      <p style={{ color: "var(--wh-text-light)", maxWidth: 720 }}>
        Everything that goes into a fermenter without contributing sugar. These are the inputs that decide whether a
        must ferments cleanly or stalls, whether it is protected or spoils, and whether it clears — and unlike the
        fermentables, most of them are dosed in grams per litre with a measurable effect per gram, which is what lets the{" "}
        <Link href="/build">recipe builder</Link> tell you how much to add rather than merely that a product exists.
      </p>

      <form method="get" style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", margin: "1rem 0" }}>
        <input type="text" name="q" defaultValue={sp.q ?? ""} placeholder="Search additives…" aria-label="Search additives" />
        <select name="category" defaultValue={sp.category ?? ""} aria-label="Category">
          <option value="">All categories</option>
          {ADDITIVE_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label} ({counts[c.id] ?? 0})
            </option>
          ))}
        </select>
        <select name="use" defaultValue={sp.use ?? ""} aria-label="Used for">
          <option value="">Any drink</option>
          {USES.map((u) => (
            <option key={u} value={u}>
              {u[0].toUpperCase() + u.slice(1)}
            </option>
          ))}
        </select>
        <button type="submit">Filter</button>
        {(sp.q || sp.category || sp.use) && <Link href="/additives" className="wh-style-chip">Clear</Link>}
      </form>

      <p style={{ fontSize: "0.85rem", color: "var(--wh-text-light)" }}>
        {list.length} {list.length === 1 ? "entry" : "entries"}
      </p>

      {ADDITIVE_CATEGORIES.filter((c) => grouped.has(c.id)).map((cat) => (
        <section key={cat.id} style={{ marginBottom: "1.75rem" }}>
          <h2 style={{ fontSize: "1.05rem", marginBottom: "0.15rem" }}>{cat.label}</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--wh-text-light)", marginTop: 0 }}>{cat.blurb}</p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: "0.87rem" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Name</th>
                  <th style={{ textAlign: "left" }} className="hide-mobile">Typical dose</th>
                  <th style={{ textAlign: "left" }} className="hide-mobile">Effect per g/L</th>
                  <th style={{ textAlign: "left" }}>What it does</th>
                </tr>
              </thead>
              <tbody>
                {grouped.get(cat.id)!.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/additives/${encodeURIComponent(a.id)}`}>{a.name}</Link>
                      {a.aliases.length > 0 && (
                        <div style={{ fontSize: "0.72rem", color: "var(--wh-text-light)" }}>{a.aliases.join(", ")}</div>
                      )}
                    </td>
                    <td className="nowrap hide-mobile">
                      {a.doseMinGPerL != null && a.doseMaxGPerL != null
                        ? `${a.doseMinGPerL}–${a.doseMaxGPerL} ${a.doseUnit ?? "g/L"}`
                        : "—"}
                    </td>
                    <td className="nowrap hide-mobile">
                      {a.effectPerGramPerLitre != null
                        ? `${a.effectPerGramPerLitre > 0 ? "+" : ""}${a.effectPerGramPerLitre} ${a.effectUnit ?? ""}`
                        : "—"}
                    </td>
                    <td>{a.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {list.length === 0 && <p>Nothing matches that filter.</p>}
    </div>
  );
}
