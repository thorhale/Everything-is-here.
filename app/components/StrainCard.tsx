import Link from "next/link";
import { strainHref, type StrainWithLab } from "@/lib/yeasts-curated";

function attRange(s: StrainWithLab): string | null {
  if (s.attenuationMin != null && s.attenuationMax != null) return `${s.attenuationMin}–${s.attenuationMax}%`;
  if (s.attenuationMax != null) return `${s.attenuationMax}%`;
  return null;
}

function tempRange(s: StrainWithLab): string | null {
  if (s.tempMinF != null && s.tempMaxF != null) return `${s.tempMinF}–${s.tempMaxF}°F`;
  return null;
}

// One strain rendered as a compact card. Used in the catalog grid and in the
// "suggested yeasts" sections on style / recipe pages.
export function StrainCard({ strain }: { strain: StrainWithLab }) {
  const att = attRange(strain);
  const temp = tempRange(strain);
  return (
    <Link
      href={strainHref(strain.id)}
      style={{
        display: "block",
        border: "1px solid var(--wh-border)",
        borderRadius: 8,
        padding: "0.75rem 0.9rem",
        textDecoration: "none",
        color: "inherit",
        background: "var(--wh-bg-soft)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "baseline" }}>
        <strong style={{ color: "var(--wh-link)" }}>
          {strain.productCode ? `${strain.productCode} ` : ""}
          {strain.name}
        </strong>
        <span style={{ fontSize: "0.75rem", color: "var(--wh-text-light)", whiteSpace: "nowrap" }}>
          {strain.lab.name}
        </span>
      </div>
      <div style={{ fontSize: "0.78rem", color: "var(--wh-text-light)", marginTop: "0.15rem", fontStyle: "italic" }}>
        {strain.species}
      </div>
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.45rem" }}>
        {strain.form && <Spec label={strain.form} />}
        {att && <Spec label={`ATT ${att}`} />}
        {temp && <Spec label={temp} />}
        {strain.flocculation && <Spec label={`floc ${strain.flocculation}`} />}
        {strain.isBlend && <Spec label="blend" />}
      </div>
      {strain.uses.length > 0 && (
        <div style={{ fontSize: "0.72rem", color: "var(--wh-text-light)", marginTop: "0.4rem" }}>
          {strain.uses.join(" · ")}
        </div>
      )}
    </Link>
  );
}

function Spec({ label }: { label: string }) {
  return (
    <span
      style={{
        fontSize: "0.72rem",
        background: "var(--wh-bg-warm)",
        border: "1px solid var(--wh-border-light)",
        borderRadius: 4,
        padding: "0.05rem 0.4rem",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

// A responsive grid of strain cards.
export function StrainGrid({ strains }: { strains: StrainWithLab[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        gap: "0.75rem",
      }}
    >
      {strains.map((s) => (
        <StrainCard key={s.id} strain={s} />
      ))}
    </div>
  );
}
