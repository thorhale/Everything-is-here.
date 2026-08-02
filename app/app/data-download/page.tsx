import Link from "next/link";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const metadata = {
  title: "Download the data — WortHogg",
  description:
    "The curated yeast, fermentable, hop and water reference databases as a single JSON file. Free to download, use, and mirror.",
};

async function counts(): Promise<Record<string, number> | null> {
  try {
    const raw = await readFile(join(process.cwd(), "..", "data", "reference-export.json"), "utf8");
    return JSON.parse(raw).counts ?? null;
  } catch {
    return null;
  }
}

export default async function DataDownloadPage() {
  const c = await counts();

  return (
    <div>
      <h1>Download the data</h1>
      <p style={{ color: "var(--wh-text-light)" }}>
        BrewToad shut down and took its database with it. That is the entire reason this project
        exists — so it would be daft to build another dataset nobody can rescue. Everything below
        is one JSON file. Take it, mirror it, build on it.
      </p>

      <p style={{ margin: "1.25rem 0" }}>
        <a href="/data" className="wh-btn" style={{ textDecoration: "none" }} download="worthogg-reference.json">
          Download reference data (JSON)
        </a>
      </p>

      {c && (
        <table>
          <thead>
            <tr><th>Dataset</th><th>Records</th><th className="hide-mobile">What&apos;s in it</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><Link href="/yeasts/db">Yeast strains</Link></td>
              <td className="nowrap">{c.yeastStrains}</td>
              <td className="hide-mobile">Attenuation, temperature, flocculation, alcohol tolerance, cells per pack, recommended styles, blend components</td>
            </tr>
            <tr>
              <td>Yeast labs</td>
              <td className="nowrap">{c.yeastLabs}</td>
              <td className="hide-mobile">Producer, country, region</td>
            </tr>
            <tr>
              <td><Link href="/fermentables/db">Fermentables</Link></td>
              <td className="nowrap">{c.fermentables}</td>
              <td className="hide-mobile">PPG, colour, diastatic power, mash requirements, fermentability — plus the nutrition-panel inputs for every derived value</td>
            </tr>
            <tr>
              <td><Link href="/hops/db">Hops</Link></td>
              <td className="nowrap">{c.hops}</td>
              <td className="hide-mobile">Alpha/beta acids, cohumulone, oil breakdown, aroma descriptors, substitutes</td>
            </tr>
            <tr>
              <td><Link href="/water">Water profiles</Link></td>
              <td className="nowrap">{c.waterProfiles}</td>
              <td className="hide-mobile">The six brewing ions in ppm for classic and modern brewing cities, plus style targets</td>
            </tr>
            <tr>
              <td><Link href="/guidelines">Legal standards</Link></td>
              <td className="nowrap">{c.legalStandardEntries}</td>
              <td className="hide-mobile">Our own summaries of beer purity law, sake classification, cider appellations and spirits standards of identity — {c.legalStandardEditions} editions</td>
            </tr>
            <tr>
              <td><Link href="/fermentation">Fermentation archetypes</Link></td>
              <td className="nowrap">{c.fermentationArchetypes}</td>
              <td className="hide-mobile">
                How yeast is handled for every family of drink — cells/mL for beer, g/hL for wine
                and cider, starter cultures for sake and baijiu, spontaneous or none for many
                traditional drinks. {c.fermentationArchetypesSourced} of {c.fermentationArchetypes}{" "}
                cited to professional documentation
              </td>
            </tr>
          </tbody>
        </table>
      )}

      <h2 style={{ fontSize: "1.1rem" }}>What you&apos;re getting</h2>
      <p>
        Every record carries its own <code>sourceUrl</code> and attribution, pointing at the
        manufacturer spec sheet, legal standard, or published reference it was transcribed from.
        Nothing here is invented — where a figure could not be sourced it is <code>null</code>
        rather than guessed.
      </p>
      <p>
        Derived values say so. Fermentables with <code>ppgBasis: &quot;nutrition&quot;</code> have
        their extract computed from a Nutrition Facts panel as{" "}
        <code>46 × (totalCarbG − fiberG) / servingSizeG</code>, and the inputs travel with the
        record so you can check the arithmetic yourself.
      </p>

      <h2 style={{ fontSize: "1.1rem" }}>What you&apos;re not getting</h2>
      <p>
        The recipe archive is <strong>not</strong> included. Those are community-contributed
        recipes preserved for archival purposes and subject to a{" "}
        <Link href="/takedown">removal policy</Link> — bulk-redistributing them would undercut our
        ability to honour takedown requests. Individual recipes can be exported one at a time as
        BeerXML from their own pages.
      </p>
      <p>
        Neither are the BJCP, Brewers Association or American Wine Society style guidelines. Those
        are somebody else&apos;s copyrighted work; we reproduce them{" "}
        <Link href="/guidelines">on the site</Link> with attribution, but handing out a bulk copy
        is a different thing. The legal-standards editions in the table above are our own
        compilation from primary sources and are included.
      </p>

      <h2 style={{ fontSize: "1.1rem" }}>Using it</h2>
      <p style={{ fontSize: "0.9rem" }}>
        The file is also committed in the repository at{" "}
        <code>data/reference-export.json</code>, so cloning the repo gets you the data with no
        database and no network call. Regenerate it with{" "}
        <code>node app/export-reference.mjs</code>.
      </p>
      <p style={{ fontSize: "0.9rem", color: "var(--wh-text-light)" }}>
        Served with permissive CORS, so you can fetch it straight from a browser app. Please check
        each record&apos;s own attribution before republishing — the compilation is ours, but the
        underlying specifications belong to their publishers.
      </p>
    </div>
  );
}
