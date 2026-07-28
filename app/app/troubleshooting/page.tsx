import Link from "next/link";
import { OFF_FLAVORS } from "@/lib/off-flavors";

export const metadata = {
  title: "Troubleshooting & Off-Flavors — WortHogg",
  description:
    "What went wrong and how to fix it: diacetyl, DMS, acetaldehyde, phenolics, oxidation, autolysis, fusels, astringency and more — cause, prevention, and whether it can be salvaged.",
};

export default function TroubleshootingPage() {
  return (
    <div>
      <h1>Troubleshooting &amp; Off-Flavors</h1>
      <p style={{ color: "var(--wh-text-light)" }}>
        The compounds behind the faults you actually taste — what causes each one, how to prevent
        it, and the honest answer to the only question that matters mid-panic:{" "}
        <em>can this batch be saved?</em>
      </p>

      {/* Quick index */}
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", margin: "1rem 0 1.5rem" }}>
        {OFF_FLAVORS.map((f) => (
          <a key={f.id} href={`#${f.id}`} className="wh-style-chip" style={{ textDecoration: "none" }}>
            {f.name}
          </a>
        ))}
      </div>

      {OFF_FLAVORS.map((f) => (
        <section
          key={f.id}
          id={f.id}
          style={{
            border: "1px solid var(--wh-border)",
            borderRadius: 8,
            padding: "1rem 1.15rem",
            marginBottom: "1rem",
            background: "var(--wh-bg-soft)",
            scrollMarginTop: "1rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap" }}>
            <h2 style={{ fontSize: "1.15rem", margin: 0 }}>{f.name}</h2>
            <span style={{ fontSize: "0.78rem", color: "var(--wh-text-light)", fontStyle: "italic" }}>
              {f.compound}
            </span>
          </div>

          <p style={{ margin: "0.4rem 0" }}>{f.aroma}</p>
          {f.threshold && (
            <p style={{ fontSize: "0.8rem", color: "var(--wh-text-light)", margin: "0 0 0.5rem" }}>
              Typical detection threshold: {f.threshold}
            </p>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "1rem", marginTop: "0.6rem" }}>
            <div>
              <h3 style={h3}>Causes</h3>
              <ul style={ul}>{f.causes.map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
            <div>
              <h3 style={h3}>Prevention</h3>
              <ul style={ul}>{f.prevention.map((p) => <li key={p}>{p}</li>)}</ul>
            </div>
          </div>

          <div
            style={{
              marginTop: "0.7rem",
              padding: "0.5rem 0.75rem",
              borderRadius: 6,
              background: f.fix ? "rgba(63,125,63,0.10)" : "rgba(181,80,2,0.10)",
              borderLeft: `3px solid ${f.fix ? "#3f7d3f" : "var(--wh-accent)"}`,
              fontSize: "0.88rem",
            }}
          >
            <strong>{f.fix ? "Can it be saved? " : "Can it be saved? No. "}</strong>
            {f.fix ?? "This one is prevention-only — the change is irreversible."}
          </div>

          {f.appropriateIn && (
            <p style={{ fontSize: "0.82rem", color: "var(--wh-text-light)", marginTop: "0.5rem", marginBottom: 0 }}>
              <strong>Not always a fault:</strong> {f.appropriateIn}
            </p>
          )}

          {f.links && f.links.length > 0 && (
            <p style={{ fontSize: "0.82rem", marginTop: "0.5rem", marginBottom: 0 }}>
              {f.links.map((l, i) => (
                <span key={l.href}>
                  {i > 0 && " · "}
                  <Link href={l.href}>{l.label}</Link>
                </span>
              ))}
            </p>
          )}
        </section>
      ))}

      <p style={{ fontSize: "0.8rem", color: "var(--wh-text-light)", marginTop: "2rem" }}>
        Detection thresholds vary by taster and by beer — a level that ruins a pilsner can be
        invisible in an imperial stout, and several of these compounds are style-defining rather
        than faults. Compiled from standard brewing-science references; use it to form a
        hypothesis, then change one variable at a time.
      </p>
    </div>
  );
}

const h3: React.CSSProperties = { fontSize: "0.85rem", margin: "0 0 0.3rem", textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--wh-text-light)" };
const ul: React.CSSProperties = { margin: 0, paddingLeft: "1.1rem", fontSize: "0.87rem" };
