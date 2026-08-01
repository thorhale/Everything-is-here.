// This page reads data/sources/registry.json off disk and never touches the
// database, and that file only changes when a deploy ships a new one. Forcing a
// dynamic render per request bought nothing and cost a server render each hit,
// so it is prerendered and revalidated instead.
export const revalidate = 3600;

import Link from "next/link";
import {
  getSourceRegistry,
  groupByReliability,
  formatCitation,
  kindLabel,
  RELIABILITY_LABEL,
  type Source,
  type BackgroundDocument,
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

/**
 * A source that was read but that nothing in the data cites. Rendered without
 * citation counts, because the point of the entry is the reasoning — what it
 * was checked for and why its figures were not used.
 */
function BackgroundRow({ s }: { s: BackgroundDocument }) {
  return (
    <li style={{ padding: "0.7rem 0", borderBottom: "1px solid var(--wh-border)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "0.45rem" }}>
        <a href={s.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
          {s.title ?? s.publisher}
        </a>
        <Badge>{kindLabel(s.kind)}</Badge>
        <Badge color={VERIFICATION_COLOR[s.verification]}>{s.verification}</Badge>
        <Badge>{RELIABILITY_LABEL[s.reliability]}</Badge>
      </div>
      <div style={{ fontSize: "0.82rem", color: "var(--wh-text-light)", marginTop: "0.15rem" }}>
        {formatCitation(s)}
        {s.accessed && ` — accessed ${s.accessed}`}
      </div>
      {s.supports && (
        <p style={{ fontSize: "0.85rem", margin: "0.4rem 0 0" }}>
          <strong>Read for:</strong> {s.supports}
        </p>
      )}
      {s.doesNotSupport && (
        <p style={{ fontSize: "0.85rem", margin: "0.25rem 0 0", color: "var(--wh-text-light)" }}>
          <strong>Not used for:</strong> {s.doesNotSupport}
        </p>
      )}
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
  const background = reg.background ?? [];
  // The canonical reference books are on record as the standard the app builds
  // toward — a different thing from a source that was read and set aside. Split
  // them out so they are not filed under "nothing rests on it".
  const referenceStandard = background.filter((s) => s.kind === "book");
  const otherBackground = background.filter((s) => s.kind !== "book");
  const groups = groupByReliability(reg.sources);

  return (
    <div>
      <h1>Sources</h1>
      <p style={{ color: "var(--wh-text-light)", maxWidth: 760 }}>
        Every figure in WortHogg&apos;s ingredient, water and style data traces back to something you
        can go and read — a maltster&apos;s spec sheet, a hop merchant&apos;s data, a government
        standard, a peer-reviewed paper. This is the full account of what the data is built on.
      </p>
      <p style={{ maxWidth: 760, fontSize: "0.95rem", marginTop: "0.75rem" }}>
        <strong>{totals.distinctSources.toLocaleString()}</strong> sources across{" "}
        <strong>{totals.citations.toLocaleString()}</strong> citations, graded by how close each one
        is to the measurement.
      </p>

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

      {/* The canonical works the app is built toward. */}
      {referenceStandard.length > 0 && (
        <section style={{ marginTop: "2rem" }}>
          <h2 style={{ fontSize: "1.1rem" }}>The reference standard</h2>
          <p style={{ color: "var(--wh-text-light)", maxWidth: 760, fontSize: "0.9rem" }}>
            The authoritative technical works this project treats as the standard for its subject
            areas. They are on the record here, but no figure is <em>sourced</em> to one of them: a
            number is only ever cited to a book once someone has opened it and can cite the page,
            and until then verification stays <em>metadata-only</em>. That is deliberate — a citation
            to a book nobody read is the exact thing this page exists to rule out. In the meantime
            the primary measurements these works synthesise — the yeast producers&apos; spec sheets,
            the maltsters&apos; and hop merchants&apos; data, the water analyses — are cited directly
            in the bibliography above.
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {referenceStandard.map((s) => (
              <BackgroundRow key={s.url} s={s} />
            ))}
          </ul>
        </section>
      )}

      {/* Read-and-set-aside sources. Kept visible so the reasoning survives. */}
      {otherBackground.length > 0 && (
        <section style={{ marginTop: "2rem" }}>
          <h2 style={{ fontSize: "1.1rem" }}>Consulted, but nothing rests on it</h2>
          <p style={{ color: "var(--wh-text-light)", maxWidth: 760, fontSize: "0.9rem" }}>
            {otherBackground.length} document{otherBackground.length === 1 ? "" : "s"} that{" "}
            {otherBackground.length === 1 ? "was" : "were"} read and registered but that no figure in
            the data cites. Some describe rather than measure; some print a number this project
            declined to use, usually because a better source disagreed. They are listed because a
            set-aside source is part of the provenance record — deleting it would erase the reason a
            figure is <em>not</em> in the data, which is often the more useful half of the account.
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {otherBackground.map((s) => (
              <BackgroundRow key={s.url} s={s} />
            ))}
          </ul>
        </section>
      )}

      <p style={{ marginTop: "2rem", fontSize: "0.85rem", color: "var(--wh-text-light)" }}>
        Third-party style guideline text (BJCP, Brewers Association, American Wine Society, Maltose
        Falcons) belongs to its publishers and is linked rather than redistributed — see{" "}
        <Link href="/guidelines">Style guidelines</Link> and{" "}
        <Link href="/data-download">Download the data</Link>.
      </p>
    </div>
  );
}
