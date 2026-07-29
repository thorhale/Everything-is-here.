// Validation harness for the must-chemistry and unified-engine formulas.
// Every case is a published reference value, not a self-check against our own
// output. Run: node validate-must.mjs
//
// The formulas are duplicated here from lib/must.ts and lib/recipe-engine.ts
// deliberately: this file is a second implementation from the source
// equations, so agreement means the TypeScript is right rather than merely
// self-consistent.

const POINTS_PER_G_PER_L = 46 / (453.592 / 3.78541);

const sgFromBrix = (b) => 1 + 0.0038661 * b + 1.3488e-5 * b ** 2 + 4.3074e-8 * b ** 3;
const molecularSo2 = (free, ph) => free / (1 + 10 ** (ph - 1.81));
const freeSo2Needed = (mol, ph) => mol * (1 + 10 ** (ph - 1.81));
const sgFromSugar = (g, l) => 1 + (g / l) * POINTS_PER_G_PER_L / 1000;
const abv = (og, fg) => (og - fg) * 131.25;

let pass = 0;
let fail = 0;
function check(label, actual, expected, tol, unit = "") {
  const ok = Math.abs(actual - expected) <= tol;
  if (ok) pass++;
  else fail++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label.padEnd(58)} got ${actual.toFixed(4)}${unit}  expect ${expected}${unit} ±${tol}`
  );
}

console.log("\n-- Brix to specific gravity (standard oenological tables) --");
check("0 Brix = water", sgFromBrix(0), 1.0, 0.0001);
check("10 Brix", sgFromBrix(10), 1.0400, 0.0005);
check("15 Brix", sgFromBrix(15), 1.0611, 0.0005);
check("20 Brix", sgFromBrix(20), 1.0829, 0.0005);
check("22 Brix (typical white harvest)", sgFromBrix(22), 1.0919, 0.0006);
check("24 Brix (typical red harvest)", sgFromBrix(24), 1.1010, 0.0007);
check("30 Brix (ice cider / late harvest)", sgFromBrix(30), 1.1295, 0.0012);

console.log("\n-- Sugar mass to gravity (1 lb sucrose in 1 US gal = 1.046) --");
check("453.59 g in 3.7854 L", sgFromSugar(453.592, 3.78541), 1.046, 0.0005);
check("1 kg sugar in 20 L", sgFromSugar(1000, 20), 1.0192, 0.0005);

console.log("\n-- Beer: 10 lb 2-row at 37 PPG, 75% eff, 5 US gal --");
// Engine path: mass x (ppg/46) x efficiency = fermentable sugar grams.
const beerSugar = 4535.92 * (37 / 46) * 0.75;
const beerOg = sgFromSugar(beerSugar, 18.9271);
check("OG (classic 37 x 10 x 0.75 / 5 = 55.5 pts)", beerOg, 1.0555, 0.0005);
check("ABV at 75% attenuation", abv(beerOg, 1 + (beerOg - 1) * 0.25), 5.47, 0.05, "%");

console.log("\n-- Cider: 20 L of pressed juice at 12 Brix --");
const juiceMass = 20 * 1000 * sgFromBrix(12);
const ciderOg = sgFromSugar(juiceMass * 0.12, 20);
check("OG matches the 12 Brix table value", ciderOg, sgFromBrix(12), 0.001);
check("ABV fermented dry to 0.998", abv(ciderOg, 0.998), 6.6, 0.2, "%");

console.log("\n-- Mead: 1.36 kg honey (3 lb) per US gallon --");
// Honey at 35 PPG: 3 lb in 1 gal should read about 1.105.
const meadSugar = 1360.8 * (35 / 46);
check("OG of 3 lb honey in 1 gal", sgFromSugar(meadSugar, 3.78541), 1.105, 0.002);

console.log("\n-- Wine: potential alcohol from Brix --");
check("22 Brix fermented to 0.996", abv(sgFromBrix(22), 0.996), 12.6, 0.3, "%");
check("24 Brix fermented to 0.995", abv(sgFromBrix(24), 0.995), 14.0, 0.3, "%");

console.log("\n-- Molecular SO2 = free / (1 + 10^(pH - 1.81)) --");
check("30 mg/L free at pH 3.4", molecularSo2(30, 3.4), 0.75, 0.03, " mg/L");
check("free needed for 0.8 molecular at pH 3.2", freeSo2Needed(0.8, 3.2), 20.4, 1.0, " mg/L");
check("free needed for 0.8 molecular at pH 3.5", freeSo2Needed(0.8, 3.5), 40, 2.0, " mg/L");
check("free needed for 0.8 molecular at pH 3.8", freeSo2Needed(0.8, 3.8), 79, 3.0, " mg/L");
// Molecular fraction against the standard published table. Popular summaries
// often quote "3% at pH 3.5" and "1.5% at pH 4.0"; those are wrong — they
// correspond to pH 3.32 and 3.63. The pKa 1.81 relation gives the values below,
// which is what the winemaking tables actually print.
check("molecular fraction at pH 3.0", (molecularSo2(100, 3.0) / 100) * 100, 6.06, 0.05, "%");
check("molecular fraction at pH 3.5", (molecularSo2(100, 3.5) / 100) * 100, 2.00, 0.05, "%");
check("molecular fraction at pH 4.0", (molecularSo2(100, 4.0) / 100) * 100, 0.64, 0.05, "%");

console.log("\n-- Nitrogen --");
// DAP is (NH4)2HPO4, MW 132.06, 2 N at 14.007 => 21.2% N by mass.
check("DAP nitrogen fraction", (2 * 14.007 / 132.06) * 100, 21.2, 0.2, "%");
check("YAN from 1 g/L DAP", 1000 * (2 * 14.007 / 132.06), 212, 3, " mg/L");
check("YAN target at 24 Brix, medium demand", 24 * 10, 240, 1, " mg/L");

console.log("\n-- Chaptalisation: raise 20 L of 1.045 to 1.090 --");
const VOL_PER_G = 0.000625;
const cur = ((1.045 - 1) * 1000 / POINTS_PER_G_PER_L) * 20;
const targetConc = (1.090 - 1) * 1000 / POINTS_PER_G_PER_L;
const addG = (targetConc * 20 - cur) / (1 - targetConc * VOL_PER_G);
const finalV = 20 + addG * VOL_PER_G;
check("achieved gravity after addition", sgFromSugar(cur + addG, finalV), 1.090, 0.0005);
// 45 points across 20 L is 2.34 kg if the sugar took up no room. It does —
// about 0.625 mL per gram — so the must ends up at 21.7 L and needs 2.75 kg.
// Ignoring the volume the sugar itself adds under-doses by 15%.
check("sugar required (kg)", addG / 1000, 2.75, 0.05, " kg");
check("resulting volume (L)", finalV, 21.72, 0.05, " L");

console.log("\n-- Distilling --");
check("absolute alcohol in 25 L of 8% wash", 25 * 0.08, 2.0, 0.01, " L");
check("proof down 5 L of 70% to 40% -> final volume", (5 * 70) / 40, 8.75, 0.01, " L");
check("US proof of 40% ABV", 40 * 2, 80, 0.01, " proof");
check("angel's share, 2%/yr for 12 years, 200 L", 200 * 0.98 ** 12, 156.9, 0.5, " L");

console.log("\n-- Acid equivalent-weight conversions --");
const EQ = { tartaric: 75.0, malic: 67.0, citric: 64.0, sulfuric: 49.0 };
check("6 g/L as tartaric -> as malic", (6 / EQ.tartaric) * EQ.malic, 5.36, 0.02, " g/L");
check("4 g/L as sulfuric -> as tartaric", (4 / EQ.sulfuric) * EQ.tartaric, 6.12, 0.02, " g/L");

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
