export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdditive, getAdditives, ADDITIVE_CATEGORIES } from "@/lib/additives-curated";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const a = await getAdditive(id);
  if (!a) return { title: "Additive not found — WortHogg" };
  return { title: `${a.name} — WortHogg`, description: a.description };
}

export default async function AdditivePage({ params }: Props) {
  const { id } = await params;
  const a = await getAdditive(id);
  if (!a) notFound();

  const cat = ADDITIVE_CATEGORIES.find((c) => c.id === a.category);
  const siblings = (await getAdditives({ category: a.category })).filter((x) => x.id !== a.id).slice(0, 8);

  return (
    <div>
      <p style={{ fontSize: "0.85rem", marginBottom: "0.3rem" }}>
        <Link href="/ingredients">Ingredients</Link> · <Link href="/additives">Additives</Link> ·{" "}
        <Link href={`/additives?category=${a.category}`}>{cat?.label ?? a.category}</Link>
      </p>
      <h1 style={{ marginTop: 0 }}>{a.name}</h1>
      {a.aliases.length > 0 && (
        <p style={{ color: "var(--wh-text-light)", marginTop: "-0.5rem" }}>Also sold as {a.aliases.join(", ")}</p>
      )}

      <p style={{ fontSize: "1.02rem" }}>{a.description}</p>

      <table style={{ width: "100%", maxWidth: 560, fontSize: "0.9rem", margin: "1rem 0" }}>
        <tbody>
          <Row label="Category" value={cat?.label ?? a.category} />
          {a.subtype && <Row label="Type" value={a.subtype} />}
          <Row
            label="Typical dose"
            value={
              a.doseMinGPerL != null && a.doseMaxGPerL != null
                ? `${a.doseMinGPerL}–${a.doseMaxGPerL} ${a.doseUnit ?? "g/L"}`
                : "Not dosed by rate"
            }
          />
          {a.effectPerGramPerLitre != null && (
            <Row
              label="Effect per g/L"
              value={`${a.effectPerGramPerLitre > 0 ? "+" : ""}${a.effectPerGramPerLitre} ${a.effectUnit ?? ""}`}
            />
          )}
          {a.contactTime && <Row label="Contact time" value={a.contactTime} />}
          <Row label="Used in" value={a.uses.map((u) => u[0].toUpperCase() + u.slice(1)).join(", ") || "—"} />
        </tbody>
      </table>

      {a.usageNotes && (
        <>
          <h2 style={{ fontSize: "1.05rem" }}>Using it</h2>
          <p>{a.usageNotes}</p>
        </>
      )}

      {a.cautions && (
        <>
          <h2 style={{ fontSize: "1.05rem" }}>Watch out</h2>
          <p
            style={{
              borderLeft: "3px solid var(--wh-accent)",
              paddingLeft: "0.7rem",
              margin: 0,
            }}
          >
            {a.cautions}
          </p>
        </>
      )}

      <p style={{ marginTop: "1.25rem" }}>
        <Link href="/build" className="wh-style-chip" style={{ textDecoration: "none" }}>
          Plan a batch with this →
        </Link>
      </p>

      {siblings.length > 0 && (
        <>
          <h2 style={{ fontSize: "1.05rem" }}>Others in {cat?.label ?? a.category}</h2>
          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
            {siblings.map((s) => (
              <Link key={s.id} href={`/additives/${encodeURIComponent(s.id)}`} className="wh-style-chip" style={{ textDecoration: "none" }}>
                {s.name}
              </Link>
            ))}
          </div>
        </>
      )}

      <p style={{ fontSize: "0.8rem", color: "var(--wh-text-light)", marginTop: "1.5rem" }}>
        Source: <a href={a.sourceUrl} target="_blank" rel="noreferrer">{a.sourceUrl}</a>
        {a.attribution && <> — {a.attribution}</>}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <th style={{ textAlign: "left", fontWeight: 600, width: "45%" }}>{label}</th>
      <td>{value}</td>
    </tr>
  );
}
