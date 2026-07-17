// Recreation of BrewToad's horizontal stat bar-graphs, matching the original
// markup: .bar > (.range + .marker), then .value, then .label. Scale ranges
// are the ones the original recipe_editor.js used for these same graphs:
// OG/FG 1-1.15, IBU 0-120, SRM 0-40, ABV 1-14 (docs/calculator-formulas.md).
// Balance (BU:GU) rides a 0-1 scale like the original's sixth graph.
import type { StyleRanges } from "@/lib/style-ranges";

const SCALES = {
  og: { min: 1, max: 1.15, format: (v: number) => v.toFixed(3) },
  fg: { min: 1, max: 1.15, format: (v: number) => v.toFixed(3) },
  ibu: { min: 0, max: 120, format: (v: number) => v.toFixed(0) },
  srm: { min: 0, max: 40, format: (v: number) => v.toFixed(0) },
  abv: { min: 1, max: 14, format: (v: number) => `${v.toFixed(1)}%` },
  balance: { min: 0, max: 1, format: (v: number) => v.toFixed(2) },
} as const;

export type StatKey = keyof typeof SCALES;

const LABELS: Record<StatKey, string> = {
  og: "OG",
  fg: "FG",
  ibu: "IBU",
  srm: "SRM",
  abv: "ABV",
  balance: "Balance",
};

function clampPct(value: number, min: number, max: number): number {
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

function balanceTitle(v: number): string {
  if (v < 0.3) return "Very Malty";
  if (v < 0.44) return "Malty";
  if (v < 0.53) return "Balanced";
  if (v < 0.75) return "Hoppy";
  return "Very Hoppy";
}

export function StatBar({
  stat,
  value,
  range,
}: {
  stat: StatKey;
  value: number;
  range?: [number, number] | null;
}) {
  const scale = SCALES[stat];
  const pct = clampPct(value, scale.min, scale.max);
  return (
    <div className="horizontal-bar-graph">
      <div className="bar">
        {range && (
          <div
            className="range"
            style={{
              left: `${clampPct(range[0], scale.min, scale.max)}%`,
              right: `${100 - clampPct(range[1], scale.min, scale.max)}%`,
            }}
          />
        )}
        <div className="marker" style={{ "--marker-left": `${pct}%` } as React.CSSProperties} />
      </div>
      <div className="value" title={stat === "balance" ? balanceTitle(value) : undefined}>
        {scale.format(value)}
      </div>
      <div className="label">{LABELS[stat]}</div>
    </div>
  );
}

export function StatBars({
  og,
  fg,
  ibu,
  srm,
  abv,
  styleName,
  ranges,
}: {
  og?: number | null;
  fg?: number | null;
  ibu?: number | null;
  srm?: number | null;
  abv?: number | null;
  styleName?: string | null;
  ranges?: StyleRanges | null;
}) {
  // BU:GU balance ratio, the original's sixth graph
  const balance = og != null && ibu != null && og > 1 ? ibu / ((og - 1) * 1000) : null;

  const inRange = (v: number | null | undefined, r?: [number, number] | null) =>
    v == null || !r || (v >= r[0] && v <= r[1]);
  const conforms =
    ranges != null &&
    inRange(og, ranges.og) &&
    inRange(fg, ranges.fg) &&
    inRange(ibu, ranges.ibu) &&
    inRange(srm, ranges.srm) &&
    inRange(abv, ranges.abv);

  return (
    <div className="recipe-show--stats">
      {og != null && <StatBar stat="og" value={og} range={ranges?.og} />}
      {fg != null && <StatBar stat="fg" value={fg} range={ranges?.fg} />}
      {ibu != null && <StatBar stat="ibu" value={ibu} range={ranges?.ibu} />}
      {srm != null && <StatBar stat="srm" value={srm} range={ranges?.srm} />}
      {abv != null && <StatBar stat="abv" value={abv} range={ranges?.abv} />}
      {balance != null && <StatBar stat="balance" value={balance} />}
      {styleName && ranges && (
        <p>
          <small>
            Recipe {conforms ? "conforms" : "does not conform"} to the typical range of
            archived <strong>{styleName}</strong> recipes.
          </small>
        </p>
      )}
    </div>
  );
}

export function srmClass(srm: number | null | undefined): string {
  if (srm == null) return "srm0";
  const n = Math.max(0, Math.min(40, Math.round(srm)));
  return `srm${n}`;
}
