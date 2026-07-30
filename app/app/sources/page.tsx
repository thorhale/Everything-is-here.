export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  getSourceRegistry,
  groupByReliability,
  weakNumericCitations,
  formatCitation,
  kindLabel,
  RELIABILITY_LABEL,
  type Source,
} from "@/lib/sources";

export const metadata = {
  title: "Sources — WortHogg",
  description:
    "Every source behind WortHogg's ingredient, water and style data, what each one does and does not support, and an honest account of where the citations are still too weak.",
};

const VERIFICATION_NOTE: Record<string, string> = {
  "full-text": "Document retrieved and the figures read out of it.",
  "metadata-only": "Existence and title confirmed; figures taken from abstract or search summary, not full text.",
  unverified: "Citation inherited from earlier work and not yet checked against the document.",
};

const VERIFICATION_COLOR: Record<string, string> = {
  "full-text": "#1a7f37",
  "metadata-only": "#9a6700",
  unverified: "var(--wh-text-light)",
};

function Badge({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      style={{
        fontSize: "0.7rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.03em",
        color: color ?? "var(--wh-text-light)",
        border: `1px solid ${color ?? "var(--wh-border)"}`,
        borderRadius: 4,
        padding: "0.05rem 0.35rem",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function SourceRow({ s }: { s: Source }) {
  return (
    <li style={{ padding: "0.7rem 0", borderBottom: "1px solid var(--wh-border)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "0.45rem" }}>
        <a href={s.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
          {s.title ?? s.publisher}
        </a>
        <Badge>{kindLabel(s.kind)}</Badge>
        <Badge color={VERIFICATION_COLOR[s.verification]}>{s.verification}</Badge>
        {!s.deepLink && <Badge color="#9a6700">homepage only</Badge>}
        <span style={{ marginLeft: "auto", fontSize: "0.8rem", color: "var(--wh-text-light)", whiteSpace: "nowrap" }}>
          {s.citations} citation{s.citations === 1 ? "" : "s"}
          {s.numericCitations > 0 && `, ${s.numericCitations} numeric`}
        </span>
      </div>

      {s.title && (
        <div style={{ fontSize: "0.82rem", color: "var(--wh-text-light)", marginTop: "0.15rem" }}>
          {formatCitation(s)}
          {s.accessed && ` — accessed ${s.accessed}`}
        </div>
      )}

      {s.supports && (
        <p style={{ fontSize: "0.85rem", margin: "0.4rem 0 0" }}>
          <strong>Supports:</strong> {s.supports}
        </p>
      )}
      {s.doesNotSupport && (
        <p style={{ fontSize: "0.85rem", margin: "0.25rem 0 0", color: "var(--wh-text-light)" }}>
          <strong>Does not support:</strong> {s.doesNotSupport}
        </p>
      )}
      {s.note && (
        <p style={{ fontSize: "0.8rem", margin: "0.25rem 0 0", color: "var(--wh-text-light)", fontStyle: "italic" }}>
          {s.note}
        </p>
      )}
      <div style={{ fontSize: "0.75rem", color: "var(--wh-text-light)", marginTop: "0.3rem", wordBreak: "break-word" }}>
        {s.usedIn.join(" · ")}
      </div>
    </li>
  );
}

export default async function SourcesPage() {
  const reg = await getSourceRegistry();

  if (!reg) {
    return (
      <div>
        <h1>Sources</h1>
        <p>
          The source registry could not be read. It is generated from the datasets by{" "}
          <code>app/build-sources.mjs</code> and committed to{" "}
          <code>data/sources/registry.json</code>.
        </p>
      </div>
    );
  }

  const { totals } = reg;
  const groups = groupByReliability(reg.sources);
  const weak = weakNumericCitations(reg.sources);
  const weakCount = weak.reduce((a, s) => a + s.numericCitations, 0);
  const strongPct = totals.numericCitations
    ? Math.round(((totals.numericCitations - weakCount) / totals.numericCitations) * 100)
    : 0;

  return (
    <div>
      <h1>Sources</h1>
      <p style={{ color: "var(--wh-text-light)", maxWidth: 760 }}>
        Every figure in WortHogg&apos;s ingredient, water and style data should be traceable to
        something you can go and read. This page is the account of that — including the parts that
        do not yet meet the standard, because a citation that points at a company&apos;s front page
        is not provenance, it is the appearance of provenance, and hiding that would be worse than
        having it.
      </p>

      {/* The numbers, including the unflattering one. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "0.75rem",
          margin: "1.5rem 0",
        }}
      >
        {[
          { n: totals.distinctSources.toLocaleString(), l: "distinct sources" },
          { n: totals.citations.toLocaleString(), l: "citations in the data" },
          { n: totals.numericCitations.toLocaleString(), l: "backing a number" },
          { n: `${strongPct}%`, l: "of numbers cite a specific document", good: strongPct >= 60 },
          { n: weakCount.toLocaleString(), l: "numbers citing only a homepage", bad: true },
        ].map((s) => (
          <div
            key={s.l}
            style={{
              border: "1px solid var(--wh-border)",
              borderRadius: 8,
              padding: "0.75rem 0.85rem",
              background: "var(--wh-bg-soft)",
            }}
          >
            <div
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                color: s.bad ? "#9a6700" : s.good ? "#1a7f37" : "var(--wh-accent)",
              }}
            >
              {s.n}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--wh-text-light)" }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* How the tiers work. */}
      <h2 style={{ fontSize: "1.1rem" }}>What the tiers mean</h2>
      <dl style={{ maxWidth: 760, fontSize: "0.88rem" }}>
        {(["primary", "secondary", "tertiary"] as const).map((t) => (
          <div key={t} style={{ marginBottom: "0.5rem" }}>
            <dt style={{ fontWeight: 700 }}>{RELIABILITY_LABEL[t]}</dt>
            <dd style={{ margin: "0 0 0 0", color: "var(--wh-text-light)" }}>{reg.reliabilityRules[t]}</dd>
          </div>
        ))}
      </dl>
      <p style={{ maxWidth: 760, fontSize: "0.88rem", background: "var(--wh-bg-soft)", border: "1px solid var(--wh-border)", borderRadius: 8, padding: "0.7rem 0.85rem" }}>
        <strong>The rule the build enforces:</strong> {reg.citationRules.numericClaim}{" "}
        A dataset change that breaks this rule fails <code>app/validate-sources.mjs</code>, so it
        cannot land.
      </p>

      {/* Known gaps — deliberately above the bibliography. */}
      <h2 style={{ fontSize: "1.1rem", marginTop: "2rem" }}>Where this is still weak</h2>
      <p style={{ color: "var(--wh-text-light)", maxWidth: 760, fontSize: "0.9rem" }}>
        {weakCount.toLocaleString()} numeric claims cite a publisher&apos;s homepage rather than the
        specific datasheet, standard or record the number came from. These figures are mostly real —
        a maltster&apos;s extract potential did come from the maltster — but &quot;mostly real&quot;
        is not traceable, and you should treat anything below as unverified until its citation names
        a document. The count is committed to <code>app/sources-budget.json</code> as a ratchet: the
        build fails if it goes up, so it can only shrink.
      </p>
      <table style={{ fontSize: "0.85rem" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Publisher</th>
            <th style={{ textAlign: "right" }}>Numbers resting on it</th>
            <th style={{ textAlign: "left" }}>Datasets affected</th>
          </tr>
        </thead>
        <tbody>
          {weak.slice(0, 20).map((s) => (
            <tr key={s.url}>
              <td>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.publisher}
                </a>
              </td>
              <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.numericCitations}</td>
              <td style={{ color: "var(--wh-text-light)", fontSize: "0.78rem" }}>
                {s.usedIn.map((f) => f.replace(/^data\//, "")).join(", ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* The bibliography proper. */}
      <h2 style={{ fontSize: "1.1rem", marginTop: "2rem" }}>The bibliography</h2>
      <p style={{ color: "var(--wh-text-light)", maxWidth: 760, fontSize: "0.9rem" }}>
        Grouped by tier, ordered by how much of the data leans on each one. Sources marked{" "}
        <em>full-text</em> were retrieved and the figures read out of them; <em>metadata-only</em>{" "}
        means the document was confirmed to exist and say roughly this, but the numbers came from an
        abstract rather than the paper.
      </p>
      {groups.map((g) => (
        <section key={g.tier} style={{ marginTop: "1.25rem" }}>
          <h3 style={{ fontSize: "1rem", margin: "0 0 0.25rem" }}>
            {RELIABILITY_LABEL[g.tier]} <span style={{ color: "var(--wh-text-light)", fontWeight: 400 }}>({g.sources.length})</span>
          </h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {g.sources.map((s) => (
              <SourceRow key={s.url} s={s} />
            ))}
          </ul>
        </section>
      ))}

      <p style={{ marginTop: "2rem", fontSize: "0.85rem", color: "var(--wh-text-light)" }}>
        Third-party style guideline text (BJCP, Brewers Association, American Wine Society, Maltose
        Falcons) belongs to its publishers and is linked rather than redistributed — see{" "}
        <Link href="/guidelines">Style guidelines</Link> and{" "}
        <Link href="/data-download">Download the data</Link>.
      </p>
    </div>
  );
}
