export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { findStyle } from "@/lib/guidelines";
import { srmClass } from "@/components/StatBars";

interface Props {
  params: Promise<{ edition: string; code: string }>;
}

// Marker-less range bar: the style's official min-max band drawn on the
// same scales the recipe stat graphs use.
const SCALES = {
  og: { min: 1, max: 1.15, label: "OG", fmt: (v: number) => v.toFixed(3) },
  fg: { min: 1, max: 1.15, label: "FG", fmt: (v: number) => v.toFixed(3) },
  ibu: { min: 0, max: 120, label: "IBU", fmt: (v: number) => v.toFixed(0) },
  srm: { min: 0, max: 40, label: "SRM", fmt: (v: number) => v.toFixed(0) },
  abv: { min: 1, max: 14, label: "ABV", fmt: (v: number) => `${v}%` },
} as const;

function RangeBar({ stat, lo, hi }: { stat: keyof typeof SCALES; lo: number; hi: number }) {
  const s = SCALES[stat];
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - s.min) / (s.max - s.min)) * 100));
  return (
    <div className="horizontal-bar-graph">
      <div className="bar">
        <div className="range" style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%`, opacity: 0.45 }} />
      </div>
      <div className="value" style={{ fontSize: "0.8rem" }}>
        {s.fmt(lo)}-{s.fmt(hi)}
      </div>
      <div className="label">{s.label}</div>
    </div>
  );
}

const SECTIONS: [string, string][] = [
  ["impression", "Overall Impression"],
  ["aroma", "Aroma"],
  ["appearance", "Appearance"],
  ["flavor", "Flavor"],
  ["mouthfeel", "Mouthfeel"],
  ["comments", "Comments"],
  ["history", "History"],
  ["ingredients", "Characteristic Ingredients"],
  ["comparison", "Style Comparison"],
  ["examples", "Commercial Examples"],
];

export default async function GuidelineStylePage({ params }: Props) {
  const { edition: editionId, code } = await params;
  const style = await findStyle(editionId, code);
  if (!style) notFound();
  const edition = style.category.edition;

  const srmMid = style.srmMin != null && style.srmMax != null ? (style.srmMin + style.srmMax) / 2 : null;

  return (
    <div>
      <header className="recipe-header">
        <figure className={`recipe-color ${srmClass(srmMid)}`} style={{ opacity: srmMid == null ? 0.25 : 1 }} />
        <div>
          <h1>
            {style.code ? `${style.code}. ` : ""}
            {style.name}
          </h1>
          <p className="flush">
            {style.category.name} ·{" "}
            <Link href={`/guidelines/${edition.id}`}>{edition.title}</Link>
          </p>
        </div>
      </header>

      {(style.ogMin != null || style.ibuMin != null || style.abvMin != null) && (
        <div className="recipe-show--stats" style={{ maxWidth: 460, marginBottom: "1.25rem" }}>
          {style.ogMin != null && style.ogMax != null && <RangeBar stat="og" lo={style.ogMin} hi={style.ogMax} />}
          {style.fgMin != null && style.fgMax != null && <RangeBar stat="fg" lo={style.fgMin} hi={style.fgMax} />}
          {style.ibuMin != null && style.ibuMax != null && <RangeBar stat="ibu" lo={style.ibuMin} hi={style.ibuMax} />}
          {style.srmMin != null && style.srmMax != null && <RangeBar stat="srm" lo={style.srmMin} hi={style.srmMax} />}
          {style.abvMin != null && style.abvMax != null && <RangeBar stat="abv" lo={style.abvMin} hi={style.abvMax} />}
        </div>
      )}

      {SECTIONS.map(([key, label]) => {
        const text = (style as unknown as Record<string, string | null>)[key];
        if (!text) return null;
        return (
          <section key={key}>
            <h3>{label}</h3>
            <p style={{ whiteSpace: "pre-wrap" }}>{text}</p>
          </section>
        );
      })}

      <p>
        <Link href={`/recipes?style=${encodeURIComponent(style.name)}`}>
          Browse archived {style.name} recipes →
        </Link>
      </p>
      <p style={{ fontSize: "0.8rem", color: "var(--wh-text-light)", marginTop: "2rem" }}>
        {edition.attribution}{" "}
        <a href={edition.sourceUrl} target="_blank" rel="noreferrer">
          Original source
        </a>
        . <Link href="/takedown">Request removal</Link>
      </p>
    </div>
  );
}
