// Recreation of BrewToad's horizontal stat bar-graphs. Scale ranges are the
// ones the original recipe_editor.js used for these same graphs:
// OG/FG 1-1.15, IBU 0-120, SRM 0-40, ABV 1-14 (docs/calculator-formulas.md).

const SCALES = {
  og: { min: 1, max: 1.15, format: (v: number) => v.toFixed(3) },
  fg: { min: 1, max: 1.15, format: (v: number) => v.toFixed(3) },
  ibu: { min: 0, max: 120, format: (v: number) => v.toFixed(0) },
  srm: { min: 0, max: 40, format: (v: number) => v.toFixed(0) },
  abv: { min: 1, max: 14, format: (v: number) => `${v.toFixed(1)}%` },
} as const;

export type StatKey = keyof typeof SCALES;

function clampPct(value: number, min: number, max: number): number {
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

export function StatBar({ stat, value }: { stat: StatKey; value: number }) {
  const scale = SCALES[stat];
  const pct = clampPct(value, scale.min, scale.max);
  return (
    <div className="horizontal-bar-graph">
      <div className="value">{scale.format(value)}</div>
      <div className="label">{stat.toUpperCase()}</div>
      <div className="bar">
        <div className="marker" style={{ left: `${pct}%` }} />
      </div>
    </div>
  );
}

export function StatBars({
  og,
  fg,
  ibu,
  srm,
  abv,
}: {
  og?: number | null;
  fg?: number | null;
  ibu?: number | null;
  srm?: number | null;
  abv?: number | null;
}) {
  return (
    <div style={{ margin: "1rem 0 1.5rem" }}>
      {og != null && <StatBar stat="og" value={og} />}
      {fg != null && <StatBar stat="fg" value={fg} />}
      {ibu != null && <StatBar stat="ibu" value={ibu} />}
      {srm != null && <StatBar stat="srm" value={srm} />}
      {abv != null && <StatBar stat="abv" value={abv} />}
    </div>
  );
}

export function srmClass(srm: number | null | undefined): string {
  if (srm == null) return "srm0";
  const n = Math.max(0, Math.min(40, Math.round(srm)));
  return `srm${n}`;
}
