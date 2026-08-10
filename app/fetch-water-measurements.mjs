// Build water profiles from measured government analyses.
//
// WHY THIS EXISTS: the 66 profiles in data/water/profiles.json are curated — a
// historic reconstruction of Burton, a bottler's published panel, a style
// target. All useful, all somebody's summary. Meanwhile the USGS and EPA jointly
// publish the Water Quality Portal: millions of individual laboratory analyses
// of actual water bodies, free, no key, as CSV. A brewer asking "what is
// actually in the water around here" should be answered from measurements, not
// from a table of famous cities.
//
// WHAT THIS DOES NOT DO: replace the historic profiles. Burton upon Trent's
// figures are a reconstruction from the brewing literature and should stay one —
// there is no modern sample of Victorian well water. This adds a separate,
// clearly-labelled set alongside them.
//
// THE ADMISSION RULE, and it is strict: a site is only written out when all six
// brewing ions were measured on the SAME sampling date, and that set balances on
// charge. Partial panels are the failure mode the whole water dataset is built
// to avoid — four ions out of six looks like a profile and silently breaks the
// salt calculator. The portal returns plenty of partial panels, so most
// candidate sites are rejected, and that is the script working.
//
// Usage: node fetch-water-measurements.mjs --state US:19 [--since 2015-01-01] [--limit 40]
import { writeFileSync, mkdirSync } from "node:fs";

const ARG = (k, d) => {
  const i = process.argv.indexOf(k);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const STATE = ARG("--state", "US:19");
const SINCE = ARG("--since", "2015-01-01");
const LIMIT = Number(ARG("--limit", "40"));
const OUT_DIR = "../data/water/measured";

// Portal characteristic names -> our ion keys. These are the exact strings the
// WQP uses; anything else it returns for the same ion is a different analyte.
const IONS = {
  Calcium: "calcium",
  Magnesium: "magnesium",
  Sodium: "sodium",
  Chloride: "chloride",
  Sulfate: "sulfate",
  Bicarbonate: "bicarbonate",
};
const EQ = { calcium: 20.04, magnesium: 12.15, sodium: 22.99, chloride: 35.45, sulfate: 48.03, bicarbonate: 61.02 };
const CATIONS = ["calcium", "magnesium", "sodium"];
const TOLERANCE_PCT = 10;

function csvRows(text) {
  // The portal quotes fields containing commas; a naive split corrupts site
  // names and, worse, shifts every column after them.
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const url =
  "https://www.waterqualitydata.us/data/Result/search?" +
  new URLSearchParams({
    statecode: STATE,
    startDateLo: SINCE.split("-").reverse().join("-"),
    mimeType: "csv",
    zip: "no",
    dataProfile: "resultPhysChem",
  }) +
  Object.keys(IONS).map((c) => `&characteristicName=${encodeURIComponent(c)}`).join("");

console.log(`querying the Water Quality Portal for ${STATE} since ${SINCE}...`);
const res = await fetch(url, { headers: { "User-Agent": "WortHogg/1.0 (brewing water reference)" } });
if (!res.ok) {
  console.error(`FAILED: portal returned ${res.status}`);
  process.exit(1);
}
const rows = csvRows(await res.text());
const head = rows.shift() ?? [];
const col = (n) => head.indexOf(n);
const cSite = col("MonitoringLocationIdentifier");
const cChar = col("CharacteristicName");
const cVal = col("ResultMeasureValue");
const cUnit = col("ResultMeasure/MeasureUnitCode");
const cDate = col("ActivityStartDate");
if ([cSite, cChar, cVal, cUnit, cDate].some((i) => i < 0)) {
  console.error("FAILED: the portal's CSV columns are not what this script expects.");
  process.exit(1);
}

// Group by site AND date: ions measured months apart are not one water.
const samples = new Map();
for (const r of rows) {
  const ion = IONS[r[cChar]];
  const v = Number(r[cVal]);
  if (!ion || !Number.isFinite(v)) continue;
  if (!/^mg\/l$/i.test((r[cUnit] || "").trim())) continue; // never mix units
  const key = `${r[cSite]}|${r[cDate]}`;
  if (!samples.has(key)) samples.set(key, { site: r[cSite], date: r[cDate], ions: {} });
  samples.get(key).ions[ion] = v;
}

const admitted = [];
let partial = 0, unbalanced = 0;
for (const s of samples.values()) {
  if (Object.keys(s.ions).length < 6) { partial++; continue; }
  const cat = CATIONS.reduce((n, k) => n + s.ions[k] / EQ[k], 0);
  const an = ["chloride", "sulfate", "bicarbonate"].reduce((n, k) => n + s.ions[k] / EQ[k], 0);
  const err = cat + an === 0 ? 0 : (Math.abs(cat - an) / ((cat + an) / 2)) * 100;
  if (err > TOLERANCE_PCT) { unbalanced++; continue; }
  admitted.push({ ...s, balancePct: Math.round(err * 10) / 10 });
}
admitted.sort((a, b) => a.balancePct - b.balancePct);

const keep = admitted.slice(0, LIMIT);
mkdirSync(OUT_DIR, { recursive: true });
const file = `${OUT_DIR}/${STATE.replace(":", "-")}.json`;
writeFileSync(
  file,
  JSON.stringify(
    {
      set: `Measured water analyses — ${STATE}`,
      note:
        "Individual laboratory analyses from the Water Quality Portal, published jointly by the " +
        "USGS and EPA. Each entry is one site on one sampling date with all six brewing ions " +
        "measured in mg/L, admitted only if the set balances on charge. These are measurements of " +
        "real water bodies, not curated brewing profiles, and they are not a substitute for a report " +
        "on your own supply — a river is not what comes out of the tap.",
      source: "https://www.waterqualitydata.us/",
      query: { state: STATE, since: SINCE, tolerancePct: TOLERANCE_PCT },
      generated: new Date().toISOString().slice(0, 10),
      sites: keep,
    },
    null,
    1
  ) + "\n"
);

console.log(`${samples.size} site/date groups seen`);
console.log(`  rejected ${partial} for an incomplete ion panel`);
console.log(`  rejected ${unbalanced} for failing charge balance at ${TOLERANCE_PCT}%`);
console.log(`  admitted ${admitted.length}, wrote the best ${keep.length} to ${file}`);
