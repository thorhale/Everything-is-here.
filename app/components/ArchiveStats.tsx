import Link from "next/link";
import type { StyleStatSummary, IngredientUsage, Percentiles } from "@/lib/archive-stats";

// A horizontal band showing the archive's interquartile range and median for a
// stat, optionally overlaid with the guideline's published range so you can see
// at a glance whether real practice sits inside, above, or below spec.
function StatBand({
  label,
  arch,
  specMin,
  specMax,
  scaleMin,
  scaleMax,
  fmt,
}: {
  label: string;
  arch: Percentiles | null;
  specMin?: number | null;
  specMax?: number | null;
  scaleMin: number;
  scaleMax: number;
  fmt: (v: number) => string;
}) {
  if (!arch) return null;
  const span = scaleMax - scaleMin || 1;
  const pos = (v: number) => Math.max(0, Math.min(100, ((v - scaleMin) / span) * 100));
  const hasSpec = specMin != null && specMax != null;

  return (
    <div style={{ marginBottom: "0.7rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: "0.15rem" }}>
        <strong>{label}</strong>
        <span style={{ color: "var(--wh-text-light)" }}>
          archive median <strong style={{ color: "var(--wh-text)" }}>{fmt(arch.median)}</strong>
          {hasSpec && <> · spec {fmt(specMin!)}–{fmt(specMax!)}</>}
        </span>
      </div>
      <div style={{ position: "relative", height: 16, background: "var(--wh-border-light)", borderRadius: 8 }}>
        {/* Guideline range */}
        {hasSpec && (
          <div
            title={`Guideline range ${fmt(specMin!)}–${fmt(specMax!)}`}
            style={{
              position: "absolute", top: 0, bottom: 0,
              left: `${pos(specMin!)}%`, right: `${100 - pos(specMax!)}%`,
              background: "var(--wh-border)", borderRadius: 8,
            }}
          />
        )}
        {/* Archive interquartile range */}
        <div
          title={`Archive middle 50%: ${fmt(arch.p25)}–${fmt(arch.p75)}`}
          style={{
            position: "absolute", top: 3, bottom: 3,
            left: `${pos(arch.p25)}%`, right: `${100 - pos(arch.p75)}%`,
            background: "var(--wh-accent)", opacity: 0.55, borderRadius: 5,
          }}
        />
        {/* Archive median */}
        <div
          style={{
            position: "absolute", top: -1, bottom: -1,
            left: `calc(${pos(arch.median)}% - 1px)`, width: 2,
            background: "var(--wh-deep-red)",
          }}
        />
      </div>
    </div>
  );
}

export function ArchiveStatBands({
  stats,
  spec,
}: {
  stats: StyleStatSummary;
  spec?: {
    ogMin?: number | null; ogMax?: number | null;
    fgMin?: number | null; fgMax?: number | null;
    ibuMin?: number | null; ibuMax?: number | null;
    srmMin?: number | null; srmMax?: number | null;
    abvMin?: number | null; abvMax?: number | null;
  };
}) {
  const g3 = (v: number) => v.toFixed(3);
  const i0 = (v: number) => v.toFixed(0);
  const f1 = (v: number) => `${v.toFixed(1)}%`;
  return (
    <div>
      <StatBand label="OG" arch={stats.og} specMin={spec?.ogMin} specMax={spec?.ogMax} scaleMin={1.02} scaleMax={1.13} fmt={g3} />
      <StatBand label="FG" arch={stats.fg} specMin={spec?.fgMin} specMax={spec?.fgMax} scaleMin={0.995} scaleMax={1.04} fmt={g3} />
      <StatBand label="IBU" arch={stats.ibu} specMin={spec?.ibuMin} specMax={spec?.ibuMax} scaleMin={0} scaleMax={120} fmt={i0} />
      <StatBand label="SRM" arch={stats.srm} specMin={spec?.srmMin} specMax={spec?.srmMax} scaleMin={0} scaleMax={50} fmt={i0} />
      <StatBand label="ABV" arch={stats.abv} specMin={spec?.abvMin} specMax={spec?.abvMax} scaleMin={0} scaleMax={14} fmt={f1} />
      <p style={{ fontSize: "0.72rem", color: "var(--wh-text-light)", marginTop: "0.4rem" }}>
        <span style={{ display: "inline-block", width: 10, height: 8, background: "var(--wh-border)", verticalAlign: "middle" }} /> guideline range ·{" "}
        <span style={{ display: "inline-block", width: 10, height: 8, background: "var(--wh-accent)", opacity: 0.55, verticalAlign: "middle" }} /> archive middle 50% ·{" "}
        <span style={{ display: "inline-block", width: 2, height: 10, background: "var(--wh-deep-red)", verticalAlign: "middle" }} /> archive median
      </p>
    </div>
  );
}

// Ranked ingredient list with a share-of-recipes bar.
export function IngredientUsageList({
  items,
  unit,
  linkBase,
}: {
  items: IngredientUsage[];
  unit?: string;
  linkBase?: (name: string) => string;
}) {
  if (items.length === 0) return null;
  const max = Math.max(...items.map((i) => i.sharePct), 1);
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {items.map((it) => (
        <li key={it.name} style={{ marginBottom: "0.3rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", gap: "0.5rem" }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {linkBase ? <Link href={linkBase(it.name)}>{it.name}</Link> : it.name}
            </span>
            <span style={{ color: "var(--wh-text-light)", whiteSpace: "nowrap" }}>
              {it.sharePct}%{it.avgAmount != null && unit ? ` · ${it.avgAmount} ${unit}` : ""}
            </span>
          </div>
          <div style={{ height: 4, background: "var(--wh-border-light)", borderRadius: 2 }}>
            <div style={{ width: `${(it.sharePct / max) * 100}%`, height: "100%", background: "var(--wh-accent)", opacity: 0.6, borderRadius: 2 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
