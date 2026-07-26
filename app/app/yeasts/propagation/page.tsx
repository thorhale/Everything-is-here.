import Link from "next/link";
import {
  PROPAGATION_SOURCE,
  PITCH_RATE_TARGETS,
  PITCH_RATE_EXAMPLE,
  PACKAGE_VIABILITY,
  STARTER_METHODS,
  STARTER_CONDITIONS,
  VIABILITY_NOTE,
} from "@/lib/propagation-guidance";

export const metadata = {
  title: "Yeast Propagation Guide — WortHogg",
  description:
    "Structured yeast propagation and pitching guidance — pitch rates, package viability, starter cell densities by agitation method, and starter conditions.",
};

export default function PropagationGuidePage() {
  const c = STARTER_CONDITIONS;
  return (
    <div>
      <h1>Yeast Propagation &amp; Pitching Guide</h1>
      <p style={{ color: "var(--wh-text-light)" }}>
        The reference figures behind the{" "}
        <Link href="/pitching">pitching calculator</Link>, as structured data —
        pitch-rate targets, how many cells are actually in a package, and how big a
        starter each agitation method builds. Numbers are from{" "}
        <a href={PROPAGATION_SOURCE.url} target="_blank" rel="noreferrer">
          the Maltose Falcons yeast-propagation guide
        </a>
        .
      </p>

      <h2>Pitch-rate targets</h2>
      <table>
        <thead>
          <tr><th>Beer</th><th>Cells / mL</th><th>Notes</th></tr>
        </thead>
        <tbody>
          {PITCH_RATE_TARGETS.map((t) => (
            <tr key={t.key}>
              <td>{t.label}</td>
              <td className="nowrap">{t.minMl}–{t.maxMl} M/mL</td>
              <td>{t.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: "0.85rem", color: "var(--wh-text-light)" }}>{PITCH_RATE_EXAMPLE}</p>

      <h2>Cells per package</h2>
      <table>
        <thead>
          <tr><th>Source</th><th>Viable cells</th><th>Viability</th><th>Notes</th></tr>
        </thead>
        <tbody>
          {PACKAGE_VIABILITY.map((p) => (
            <tr key={p.kind}>
              <td>{p.kind}</td>
              <td className="nowrap">~{p.totalCellsB} B</td>
              <td className="nowrap">~{p.viabilityPct}%</td>
              <td>{p.note}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Starter cell density by method</h2>
      <p style={{ fontSize: "0.85rem", color: "var(--wh-text-light)", marginTop: "-0.4rem" }}>
        Measured in 500 mL starters. Higher agitation → more oxygen → more cells.
      </p>
      <table>
        <thead>
          <tr><th>Method</th><th>Density (M/mL)</th><th>Cells in 500 mL</th><th>Notes</th></tr>
        </thead>
        <tbody>
          {STARTER_METHODS.map((m) => (
            <tr key={m.key}>
              <td>{m.name}</td>
              <td className="nowrap">
                {m.densityMlMin === m.densityMlMax ? m.densityMlMin : `${m.densityMlMin}–${m.densityMlMax}`}
              </td>
              <td className="nowrap">
                {m.per500mlMinB === m.per500mlMaxB ? `${m.per500mlMinB} B` : `${m.per500mlMinB}–${m.per500mlMaxB} B`}
              </td>
              <td>{m.note ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Starter make-up &amp; conditions</h2>
      <ul>
        <li>Wort gravity ~{c.gravity.toFixed(3)} (≈{c.dmePerLiterG} g DME per litre).</li>
        <li>~{c.nutrientPerLiterG} g yeast nutrient per litre.</li>
        <li>Propagate at {c.propagationTempF} °F ({c.propagationTempC} °C). {c.lagerNote}</li>
        <li>
          Oxygen at pitching: ales {c.o2.aleMinPpm}–{c.o2.aleMaxPpm} ppm, lagers{" "}
          {c.o2.lagerMinPpm}–{c.o2.lagerMaxPpm} ppm.
        </li>
      </ul>

      <h2>A note on viability</h2>
      <p style={{ color: "var(--wh-text-light)" }}>{VIABILITY_NOTE}</p>

      <p style={{ fontSize: "0.8rem", color: "var(--wh-text-light)", marginTop: "2rem" }}>
        Source:{" "}
        <a href={PROPAGATION_SOURCE.url} target="_blank" rel="noreferrer">{PROPAGATION_SOURCE.name}</a>.
        WortHogg is not affiliated with the Maltose Falcons. See also the{" "}
        <Link href="/yeasts/db">yeast database</Link> and{" "}
        <Link href="/pitching">pitching calculator</Link>.
      </p>
    </div>
  );
}
