export const revalidate = 3600;

import Link from "next/link";
import { getArchetypes, INOCULATION_LABEL, type Archetype } from "@/lib/fermentation";
import usage from "@/lib/generated/archetype-usage.json";

const USAGE = usage as Record<string, string[]>;

export const metadata = {
  title: "Fermentation & yeast handling — WortHogg",
  description:
    "How yeast is handled for every kind of ferment — beer, wine, cider, mead, sake, spirits and the world's traditional drinks — sourced to professional documentation, with honest gaps where a figure is not yet documented.",
};

const FAMILY_ORDER = ["beer", "wine", "fortified", "cider", "mead", "sake", "spirit", "traditional"];
const FAMILY_LABEL: Record<string, string> = {
  beer: "Beer",
  wine: "Wine",
  fortified: "Fortified",
  cider: "Cider",
  mead: "Mead",
  sake: "Sake & rice / kōji-qū-nuruk-ragi",
  spirit: "Spirits & distillates",
  traditional: "Traditional & regional",
};

function host(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Card({ a }: { a: Archetype }) {
  const s = a.standard;
  const cats = USAGE[a.id] ?? [];
  return (
    <li style={{ border: "1px solid var(--wh-border)", borderRadius: 8, padding: "0.85rem 1rem", marginBottom: "0.7rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "0.5rem" }}>
        <strong style={{ fontSize: "1rem" }}>{a.label}</strong>
        <span
          style={{
            fontSize: "0.68rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            border: "1px solid var(--wh-border)",
            borderRadius: 4,
            padding: "0.05rem 0.35rem",
            color: "var(--wh-text-light)",
          }}
        >
          {INOCULATION_LABEL[a.inoculation]}
        </span>
        {a.researchStatus === "pending" && (
          <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#9a6700" }}>figures pending</span>
        )}
      </div>

      <p style={{ fontSize: "0.88rem", margin: "0.45rem 0 0" }}>{a.approach}</p>

      {s && (
        <div style={{ margin: "0.55rem 0 0", padding: "0.5rem 0.7rem", background: "var(--wh-bg-soft)", borderRadius: 6, fontSize: "0.85rem" }}>
          <strong>Standard:</strong>{" "}
          {s.value != null && (
            <>
              {s.value}
              {s.rangeLow != null && s.rangeHigh != null ? ` (${s.rangeLow}–${s.rangeHigh})` : ""} {s.metric}
            </>
          )}
          {s.note && <div style={{ color: "var(--wh-text-light)", marginTop: "0.25rem" }}>{s.note}</div>}
        </div>
      )}

      {a.organisms?.length > 0 && (
        <p style={{ fontSize: "0.8rem", color: "var(--wh-text-light)", margin: "0.4rem 0 0" }}>
          <strong>Organisms:</strong> {a.organisms.join("; ")}
        </p>
      )}
      {a.specialHandling?.length ? (
        <ul style={{ fontSize: "0.82rem", margin: "0.35rem 0 0", paddingLeft: "1.1rem" }}>
          {a.specialHandling.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      ) : null}
      {a.comparison && (
        <p style={{ fontSize: "0.82rem", color: "var(--wh-text-light)", margin: "0.4rem 0 0", fontStyle: "italic" }}>
          {a.comparison}
        </p>
      )}

      {cats.length > 0 && (
        <details style={{ marginTop: "0.5rem" }}>
          <summary style={{ fontSize: "0.78rem", color: "var(--wh-text-light)", cursor: "pointer" }}>
            Maps to {cats.length} guideline {cats.length === 1 ? "category" : "categories"}
          </summary>
          <div style={{ fontSize: "0.78rem", color: "var(--wh-text-light)", marginTop: "0.35rem", lineHeight: 1.5 }}>
            {cats.join(" · ")}
          </div>
        </details>
      )}

      <div style={{ fontSize: "0.75rem", color: "var(--wh-text-light)", marginTop: "0.5rem" }}>
        {a.standard?.sourceUrl && (
          <>
            Source:{" "}
            <a href={a.standard.sourceUrl} target="_blank" rel="noreferrer">
              {host(a.standard.sourceUrl)}
            </a>
            {a.sourceUrl && a.sourceUrl !== a.standard.sourceUrl ? " · " : ""}
          </>
        )}
        {a.sourceUrl && (
          <a href={a.sourceUrl} target="_blank" rel="noreferrer">
            {host(a.sourceUrl)}
          </a>
        )}
        {!a.standard?.sourceUrl && !a.sourceUrl && "Professional source to be secured before any figure is committed."}
      </div>
    </li>
  );
}

export default async function FermentationPage() {
  const archetypes = await getArchetypes();
  const byFamily = FAMILY_ORDER.map((f) => ({ family: f, items: archetypes.filter((a) => a.family === f) })).filter(
    (g) => g.items.length > 0
  );
  const sourced = archetypes.filter((a) => a.researchStatus === "sourced").length;

  return (
    <div>
      <h1>Fermentation &amp; yeast handling</h1>
      <p style={{ color: "var(--wh-text-light)", maxWidth: 760 }}>
        Yeast is handled completely differently across the world&apos;s drinks — wine is dosed by
        weight, sake runs kōji and a separate yeast in parallel, distillers tune esters, and many
        traditional drinks are spontaneous or add no yeast at all. This is how each is done, organised
        by fermentation archetype so every style in the{" "}
        <Link href="/guidelines">guidelines</Link> maps to one.
      </p>
      <p style={{ maxWidth: 760, fontSize: "0.9rem" }}>
        Every numeric figure here is cited to world-class professional documentation — research
        institutes, industry bodies, peer-reviewed literature, manufacturer handbooks. Where that
        source has not yet been secured, the approach is described and the figure is marked{" "}
        <em>pending</em> rather than guessed. {sourced} of {archetypes.length} archetypes are sourced
        so far; the rest are mapped and in progress.
      </p>

      {byFamily.map((g) => (
        <section key={g.family} style={{ marginTop: "1.5rem" }}>
          <h2 style={{ fontSize: "1.1rem" }}>{FAMILY_LABEL[g.family] ?? g.family}</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {g.items.map((a) => (
              <Card key={a.id} a={a} />
            ))}
          </ul>
        </section>
      ))}

      <p style={{ marginTop: "2rem", fontSize: "0.85rem", color: "var(--wh-text-light)" }}>
        Beer pitch-rate math is in the <Link href="/pitching">pitching calculator</Link>. Provenance
        for every source is on the <Link href="/sources">sources</Link> page.
      </p>
    </div>
  );
}
