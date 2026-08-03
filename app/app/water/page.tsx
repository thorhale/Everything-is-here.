export const dynamic = "force-dynamic";

import Link from "next/link";
import { getWaterByKind, residualAlkalinity, sulfateChloride } from "@/lib/water";
import type { WaterProfile } from "@/lib/water";

export const metadata = {
  title: "Water Profiles — WortHogg",
  description:
    "Classic and modern brewing-city water profiles (Burton, Dublin, Munich, Pilsen, Chico, San Diego) plus style targets, with the six brewing ions and derived residual alkalinity and sulfate:chloride balance.",
};

const KIND_LABELS: Record<string, string> = {
  "classic-city": "Classic brewing cities",
  "modern-city": "Modern brewing centers",
  "style-target": "Style targets",
  bottled: "Bottled & purified water",
};
const KIND_ORDER = ["classic-city", "modern-city", "bottled", "style-target"];

function num(v: number | null): string {
  return v == null ? "—" : String(Math.round(v));
}

export default async function WaterPage() {
  const byKind = await getWaterByKind();

  return (
    <div>
      <h1>Water Profiles</h1>
      <p style={{ color: "var(--wh-text-light)" }}>
        The water made the beer. Historic brewing-city profiles and modern targets, in ppm (mg/L),
        with the two numbers that matter derived for you: <strong>residual alkalinity</strong> (how
        hard the water pushes mash pH up — high-RA cities became dark-beer cities) and the{" "}
        <strong>sulfate:chloride balance</strong> (hoppy-and-dry vs malty-and-full).
      </p>
      <p>
        <Link href="/water/builder" className="wh-btn" style={{ textDecoration: "none" }}>
          Open the water / salt calculator →
        </Link>{" "}
        <span style={{ fontSize: "0.85rem", color: "var(--wh-text-light)" }}>
          build any of these profiles from your own water.
        </span>
      </p>

      {KIND_ORDER.filter((k) => byKind[k]?.length).map((kind) => (
        <section key={kind} style={{ marginTop: "1.5rem" }}>
          <h2 style={{ fontSize: "1.15rem" }}>{KIND_LABELS[kind]}</h2>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Profile</th>
                  <th title="Calcium">Ca</th>
                  <th title="Magnesium">Mg</th>
                  <th title="Sodium">Na</th>
                  <th title="Chloride">Cl</th>
                  <th title="Sulfate">SO₄</th>
                  <th title="Bicarbonate">HCO₃</th>
                  <th title="Residual alkalinity">RA</th>
                  <th className="hide-mobile">SO₄:Cl</th>
                </tr>
              </thead>
              <tbody>
                {byKind[kind].map((w: WaterProfile) => {
                  const sc = sulfateChloride(w);
                  return (
                    <tr key={w.id}>
                      <td className="nowrap"><Link href={`/water/${encodeURIComponent(w.id)}`}>{w.name}</Link></td>
                      <td>{num(w.calcium)}</td>
                      <td>{num(w.magnesium)}</td>
                      <td>{num(w.sodium)}</td>
                      <td>{num(w.chloride)}</td>
                      <td>{num(w.sulfate)}</td>
                      <td>{num(w.bicarbonate)}</td>
                      <td>{num(residualAlkalinity(w))}</td>
                      <td className="hide-mobile" style={{ fontSize: "0.8rem" }}>{sc.balance}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section style={{ marginTop: "2rem" }}>
        <h2 style={{ fontSize: "1.15rem" }}>Why so few bottled waters?</h2>
        <p style={{ fontSize: "0.9rem", color: "var(--wh-text-light)" }}>
          Because most brands do not publish enough to brew on. A profile earns a place here only if
          the bottler or its laboratory publishes <strong>all six brewing ions</strong>, and the
          published set <strong>balances on charge</strong> — cations and anions within a few percent
          once converted to milliequivalents, which is what a real analysis does and a partial one
          does not. Half a table is worse than none: the salt calculator would build on the gap and
          be confidently wrong.
        </p>
        <p style={{ fontSize: "0.9rem", color: "var(--wh-text-light)" }}>
          That rules out most of the shelf. Some brands publish only the two or three minerals they
          advertise. Others cannot publish a single figure honestly at all — a great many American
          &ldquo;spring water&rdquo; labels are blended from a rotating set of springs, and the
          bottlers say so themselves, noting that each source may differ in mineral content. There is
          no one number to print. If your brand is not here, ask the bottler for its analysis, or
          start from RO and build the profile you want.
        </p>
      </section>

      <p style={{ fontSize: "0.8rem", color: "var(--wh-text-light)", marginTop: "2rem" }}>
        All values ppm (mg/L). Municipal water varies seasonally and with treatment — these are the
        historical/representative profiles brewers target, not a live tap analysis. Where a bottler
        publishes total alkalinity as CaCO₃ rather than bicarbonate, HCO₃ here is the standard 1.22
        conversion of it, and the profile&rsquo;s note says so.
      </p>
    </div>
  );
}
