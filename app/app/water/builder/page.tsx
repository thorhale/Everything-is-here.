import Link from "next/link";
// Bundled picker data (build-picker-data.mjs) — no database, fully static,
// and runs offline in the native shell.
import { waterPicks } from "@/lib/picker-data";
import WaterBuilder, { type WaterOption } from "./WaterBuilder";

export const metadata = {
  title: "Water / Salt Calculator — WortHogg",
  description:
    "Build brewing water from a source and a target profile — gypsum, calcium chloride, epsom, salt, baking soda — with live resulting ions, residual alkalinity, and sulfate:chloride balance.",
};

export default function WaterBuilderPage() {
  const options: WaterOption[] = waterPicks.map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.kind,
    ions: {
      calcium: p.calcium ?? 0,
      magnesium: p.magnesium ?? 0,
      sodium: p.sodium ?? 0,
      chloride: p.chloride ?? 0,
      sulfate: p.sulfate ?? 0,
      bicarbonate: p.bicarbonate ?? 0,
    },
  }));

  return (
    <div>
      <h1>Water / Salt Calculator</h1>
      <p style={{ color: "#666" }}>
        Pick a source water (or enter your own report), pick a target from the{" "}
        <Link href="/water">profile library</Link>, and dial in brewing salts — or hit{" "}
        <em>Suggest</em> for a starting point. The resulting ion profile, residual alkalinity, and
        sulfate:chloride balance update live. Salts only add ions; to lower one, dilute with RO.
      </p>
      <WaterBuilder profiles={options} />
      <p style={{ fontSize: "0.8rem", color: "var(--wh-text-light)", marginTop: "2rem" }}>
        Ion contributions are derived from each salt&apos;s molar mass (gypsum → 61.5 ppm Ca per
        gram per US gallon, matching the standard brewing references). This estimates finished-water
        chemistry; it does not model mash pH — pair it with the acidulated-malt or acid additions
        your software of choice recommends. See <Link href="/water">Water Profiles</Link>.
      </p>
    </div>
  );
}
