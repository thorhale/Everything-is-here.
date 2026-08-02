"use client";

import { useState } from "react";
import Link from "next/link";
import PitchingForm, { type StrainPick } from "./PitchingForm";
import InoculationForm from "./InoculationForm";
import { INOCULATION_LABEL, type Archetype } from "@/lib/fermentation-types";
import type { PitchRateKey } from "@/lib/pitching/formulas";

// Which fermentation families feed each guidance tab. Beer and wine have
// working calculators; the rest are sourced guidance (no single pitch number
// applies, or the standard is a technique rather than a rate).
type Mode = "beer" | "wine" | "sake" | "spirit" | "wild";

const MODES: { id: Mode; label: string }[] = [
  { id: "beer", label: "Beer" },
  { id: "wine", label: "Wine, cider & mead" },
  { id: "sake", label: "Sake & rice" },
  { id: "spirit", label: "Spirits" },
  { id: "wild", label: "Spontaneous & traditional" },
];

const MODE_FAMILIES: Record<Exclude<Mode, "beer" | "wine">, string[]> = {
  sake: ["sake"],
  spirit: ["spirit"],
  wild: ["traditional"],
};

function host(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function GuidanceCard({ a }: { a: Archetype }) {
  const s = a.standard;
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
      {a.specialHandling?.length ? (
        <ul style={{ fontSize: "0.82rem", margin: "0.35rem 0 0", paddingLeft: "1.1rem" }}>
          {a.specialHandling.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      ) : null}
      {(a.standard?.sourceUrl || a.sourceUrl) && (
        <div style={{ fontSize: "0.75rem", color: "var(--wh-text-light)", marginTop: "0.5rem" }}>
          Source:{" "}
          <a href={a.standard?.sourceUrl ?? a.sourceUrl} target="_blank" rel="noreferrer">
            {host(a.standard?.sourceUrl ?? a.sourceUrl ?? "")}
          </a>
        </div>
      )}
    </li>
  );
}

export default function PitchingWorkbench({
  strains,
  initialStrainId,
  initialBeer,
  archetypes,
}: {
  strains: StrainPick[];
  initialStrainId?: string;
  initialBeer?: { pitchType: PitchRateKey };
  archetypes: Archetype[];
}) {
  const [mode, setMode] = useState<Mode>("beer");

  const guidance =
    mode === "beer" || mode === "wine"
      ? []
      : archetypes.filter((a) => MODE_FAMILIES[mode].includes(a.family));

  return (
    <div>
      <div
        role="tablist"
        aria-label="Beverage"
        style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1rem" }}
      >
        {MODES.map((m) => {
          const active = m.id === mode;
          return (
            <button
              key={m.id}
              role="tab"
              aria-selected={active}
              onClick={() => setMode(m.id)}
              style={{
                padding: "0.4rem 0.85rem",
                borderRadius: 6,
                border: "1px solid var(--wh-border)",
                background: active ? "var(--wh-accent)" : "var(--wh-bg-soft)",
                color: active ? "#fff" : "var(--wh-text)",
                fontWeight: active ? 700 : 500,
                fontSize: "0.9rem",
                cursor: "pointer",
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {mode === "beer" && (
        <PitchingForm strains={strains} initialStrainId={initialStrainId} initial={initialBeer} />
      )}

      {mode === "wine" && <InoculationForm />}

      {mode !== "beer" && mode !== "wine" && (
        <div>
          <p style={{ color: "var(--wh-text-light)", maxWidth: 720 }}>
            {mode === "sake" &&
              "Rice beverages don't pitch a single yeast the way beer does — a starter culture saccharifies the grain and a separate yeast ferments. Here is how each is handled, sourced to professional documentation."}
            {mode === "spirit" &&
              "Distillers ferment for flavour, not clean neutrality — strain and temperature are chosen to develop or suppress congeners that carry through the still. The rate matters less than the choice."}
            {mode === "wild" &&
              "Many traditional drinks add no cultured yeast at all: they ferment spontaneously on ambient or back-slopped microbiota. There is no pitch rate to calculate — the craft is in the conditions."}
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: "1rem 0 0" }}>
            {guidance.map((a) => (
              <GuidanceCard key={a.id} a={a} />
            ))}
          </ul>
          <p style={{ marginTop: "1rem", fontSize: "0.85rem", color: "var(--wh-text-light)" }}>
            The full archetype reference — every family, with the guideline
            categories each covers — is on the{" "}
            <Link href="/fermentation">fermentation &amp; yeast handling</Link> page.
          </p>
        </div>
      )}
    </div>
  );
}
