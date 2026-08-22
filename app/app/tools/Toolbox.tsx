"use client";

import { useState, type ReactNode } from "react";
import * as calc from "@/lib/brewing-calcs";
import { residualAlkalinity, mashPhAdvice } from "@/lib/mash-ph";
import {
  assessConversion,
  maltToReachTarget,
  AMBA_MALT_CRITERIA,
  type EndUse,
} from "@/lib/diastatic-power";
import { BEER_LINES, balanceLine, type Tubing } from "@/lib/draft-line";
import {
  BARREL_PRESETS,
  geometryForPreset,
  geometryFromTape,
  totalVolumeM3,
  gaugeFromDipstick,
  gaugeFromFace,
  portHeightForRemaining,
} from "@/lib/barrel";
import { L_PER_GALLON } from "@/lib/units";

function n(s: string): number {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
}
function f(v: number, d = 1): string {
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function Toolbox() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
      <GravityConverter />
      <AlcoholCard />
      <HydrometerCard />
      <RefractometerCard />
      <PrimingCard />
      <KegCard />
      <DilutionCard />
      <StrikeCard />
      <InfusionCard />
      <MashPhCard />
      <ConversionCard />
      <LineBalanceCard />
      <BarrelCard />
      <ColorCard />
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ border: "1px solid var(--wh-border)", borderRadius: 8, padding: "0.9rem 1rem", background: "var(--wh-bg-soft)" }}>
      <h3 style={{ marginTop: 0, fontSize: "1rem" }}>{title}</h3>
      {children}
    </section>
  );
}
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", margin: "0.3rem 0" }}>
      <span>{label}</span>
      {children}
    </label>
  );
}
function Out({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", padding: "0.2rem 0", borderTop: "1px solid var(--wh-border-light)" }}>
      <span style={{ color: "var(--wh-text-light)" }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
const inp: React.CSSProperties = { padding: "0.25rem", border: "1px solid #ccc", borderRadius: 4, width: 90 };

function GravityConverter() {
  const [sg, setSg] = useState("1.048");
  const s = n(sg);
  return (
    <Card title="Gravity converter">
      <Row label="Specific gravity"><input style={inp} value={sg} onChange={(e) => setSg(e.target.value)} /></Row>
      <Out label="Degrees Plato" value={`${f(calc.sgToPlato(s), 2)} °P`} />
      <Out label="Brix (≈ Plato)" value={`${f(calc.sgToPlato(s), 2)} °Bx`} />
      <Out label="Gravity points" value={f(calc.sgToPoints(s), 0)} />
    </Card>
  );
}

function AlcoholCard() {
  const [og, setOg] = useState("1.055");
  const [fg, setFg] = useState("1.012");
  const o = n(og), g = n(fg);
  return (
    <Card title="Alcohol, attenuation & calories">
      <Row label="OG"><input style={inp} value={og} onChange={(e) => setOg(e.target.value)} /></Row>
      <Row label="FG"><input style={inp} value={fg} onChange={(e) => setFg(e.target.value)} /></Row>
      <Out label="ABV (simple)" value={`${f(calc.abvSimple(o, g))}%`} />
      <Out label="ABV (advanced)" value={`${f(calc.abvAdvanced(o, g))}%`} />
      <Out label="Apparent attenuation" value={`${f(calc.apparentAttenuation(o, g), 0)}%`} />
      <Out label="Calories / 12 oz" value={`${calc.caloriesPer12oz(o, g)} kcal`} />
    </Card>
  );
}

function HydrometerCard() {
  const [sg, setSg] = useState("1.050");
  const [t, setT] = useState("80");
  const [cal, setCal] = useState("60");
  return (
    <Card title="Hydrometer temp correction">
      <Row label="Reading (SG)"><input style={inp} value={sg} onChange={(e) => setSg(e.target.value)} /></Row>
      <Row label="Sample temp °F"><input style={inp} value={t} onChange={(e) => setT(e.target.value)} /></Row>
      <Row label="Calibrated °F"><input style={inp} value={cal} onChange={(e) => setCal(e.target.value)} /></Row>
      <Out label="True gravity" value={f(calc.correctHydrometer(n(sg), n(t), n(cal)), 3)} />
    </Card>
  );
}

function RefractometerCard() {
  const [ob, setOb] = useState("12");
  const [fb, setFb] = useState("6.5");
  const [wcf, setWcf] = useState("1.04");
  const og = calc.refractometerToSg(n(ob), n(wcf));
  const fg = calc.refractometerFg(n(ob), n(fb), n(wcf));
  return (
    <Card title="Refractometer → gravity">
      <Row label="Original °Bx"><input style={inp} value={ob} onChange={(e) => setOb(e.target.value)} /></Row>
      <Row label="Final °Bx (in beer)"><input style={inp} value={fb} onChange={(e) => setFb(e.target.value)} /></Row>
      <Row label="Wort corr. factor"><input style={inp} value={wcf} onChange={(e) => setWcf(e.target.value)} /></Row>
      <Out label="OG" value={f(og, 3)} />
      <Out label="FG (alcohol-corrected)" value={f(fg, 3)} />
      <Out label="ABV" value={`${f(calc.abvAdvanced(og, fg))}%`} />
    </Card>
  );
}

function PrimingCard() {
  const [vols, setVols] = useState("2.4");
  const [gal, setGal] = useState("5");
  const [temp, setTemp] = useState("68");
  const [sugar, setSugar] = useState<calc.PrimingSugar>("cornSugar");
  const volL = n(gal) * calc.L_PER_GALLON;
  const grams = calc.primingSugar(n(vols), volL, n(temp), sugar);
  return (
    <Card title="Priming sugar (bottling)">
      <Row label="Target CO₂ vols"><input style={inp} value={vols} onChange={(e) => setVols(e.target.value)} /></Row>
      <Row label="Beer volume (gal)"><input style={inp} value={gal} onChange={(e) => setGal(e.target.value)} /></Row>
      <Row label="Beer temp °F"><input style={inp} value={temp} onChange={(e) => setTemp(e.target.value)} /></Row>
      <Row label="Sugar">
        <select style={{ ...inp, width: 130 }} value={sugar} onChange={(e) => setSugar(e.target.value as calc.PrimingSugar)}>
          <option value="cornSugar">Corn sugar</option>
          <option value="tableSugar">Table sugar</option>
          <option value="dme">DME</option>
        </select>
      </Row>
      <Out label="Residual CO₂" value={`${f(calc.residualCo2(n(temp)), 2)} vols`} />
      <Out label="Add" value={`${f(grams)} g (${f(grams / calc.G_PER_OZ, 2)} oz)`} />
    </Card>
  );
}

function KegCard() {
  const [vols, setVols] = useState("2.4");
  const [temp, setTemp] = useState("38");
  return (
    <Card title="Keg force-carbonation">
      <Row label="Target CO₂ vols"><input style={inp} value={vols} onChange={(e) => setVols(e.target.value)} /></Row>
      <Row label="Keg temp °F"><input style={inp} value={temp} onChange={(e) => setTemp(e.target.value)} /></Row>
      <Out label="Regulator pressure" value={`${f(calc.kegPsi(n(vols), n(temp)))} PSI`} />
    </Card>
  );
}

function DilutionCard() {
  const [sg, setSg] = useState("1.060");
  const [vol, setVol] = useState("5");
  const [target, setTarget] = useState("1.050");
  const add = calc.dilutionWaterToAdd(n(sg), n(vol), n(target));
  const boil = calc.boilDownVolume(n(sg), n(vol), n(target));
  return (
    <Card title="Dilution & boil-off">
      <Row label="Current SG"><input style={inp} value={sg} onChange={(e) => setSg(e.target.value)} /></Row>
      <Row label="Current volume"><input style={inp} value={vol} onChange={(e) => setVol(e.target.value)} /></Row>
      <Row label="Target SG"><input style={inp} value={target} onChange={(e) => setTarget(e.target.value)} /></Row>
      {n(target) < n(sg) ? (
        <Out label="Water to add" value={`${f(add, 2)} (same units)`} />
      ) : (
        <Out label="Boil down to" value={`${f(boil, 2)} (same units)`} />
      )}
    </Card>
  );
}

function StrikeCard() {
  const [target, setTarget] = useState("152");
  const [grain, setGrain] = useState("68");
  const [ratio, setRatio] = useState("1.25");
  return (
    <Card title="Strike water temp">
      <Row label="Target mash °F"><input style={inp} value={target} onChange={(e) => setTarget(e.target.value)} /></Row>
      <Row label="Grain temp °F"><input style={inp} value={grain} onChange={(e) => setGrain(e.target.value)} /></Row>
      <Row label="Ratio qt/lb"><input style={inp} value={ratio} onChange={(e) => setRatio(e.target.value)} /></Row>
      <Out label="Heat strike water to" value={`${f(calc.strikeTemp(n(target), n(grain), n(ratio)))} °F`} />
    </Card>
  );
}

function InfusionCard() {
  const [target, setTarget] = useState("158");
  const [current, setCurrent] = useState("148");
  const [grain, setGrain] = useState("10");
  const [water, setWater] = useState("12.5");
  return (
    <Card title="Infusion step (boiling water)">
      <Row label="Step to °F"><input style={inp} value={target} onChange={(e) => setTarget(e.target.value)} /></Row>
      <Row label="Current mash °F"><input style={inp} value={current} onChange={(e) => setCurrent(e.target.value)} /></Row>
      <Row label="Grain (lb)"><input style={inp} value={grain} onChange={(e) => setGrain(e.target.value)} /></Row>
      <Row label="Mash water (qt)"><input style={inp} value={water} onChange={(e) => setWater(e.target.value)} /></Row>
      <Out label="Add boiling water" value={`${f(calc.infusionVolume(n(target), n(current), n(grain), n(water)))} qt`} />
    </Card>
  );
}

function MashPhCard() {
  const [srm, setSrm] = useState("6");
  const [ca, setCa] = useState("50");
  const [mg, setMg] = useState("8");
  const [hco3, setHco3] = useState("40");
  const [volGal, setVolGal] = useState("7");
  const ra = residualAlkalinity(n(ca), n(mg), n(hco3));
  // Acid demand is equivalents times volume, so mash volume is an input rather
  // than a detail: the same water needs twice the acid for twice the mash.
  const a = mashPhAdvice(n(srm), ra, { mashWaterL: n(volGal) * 3.785411784 });
  const color = a.verdict === "on target" ? "#3f7d3f" : "#b55002";
  return (
    <Card title="Mash pH / alkalinity">
      <Row label="Beer colour (SRM)"><input style={inp} value={srm} onChange={(e) => setSrm(e.target.value)} /></Row>
      <Row label="Water Ca (ppm)"><input style={inp} value={ca} onChange={(e) => setCa(e.target.value)} /></Row>
      <Row label="Water Mg (ppm)"><input style={inp} value={mg} onChange={(e) => setMg(e.target.value)} /></Row>
      <Row label="Water HCO₃ (ppm)"><input style={inp} value={hco3} onChange={(e) => setHco3(e.target.value)} /></Row>
      <Row label="Mash water (gal)"><input style={inp} value={volGal} onChange={(e) => setVolGal(e.target.value)} /></Row>
      <Out label="Residual alkalinity" value={`${a.actualRa} ppm`} />
      <Out label="Target RA (for colour)" value={`${a.targetRa} ppm`} />
      <Out label="Estimated mash pH" value={`~${f(a.estimatedPh, 2)}`} />
      <div style={{ fontSize: "0.85rem", fontWeight: 600, color, padding: "0.3rem 0" }}>
        {a.verdict === "on target" && "Water suits this grist."}
        {a.verdict === "too alkaline" && `Too alkaline by ${a.gap} ppm — acidify the liquor, or dilute with RO.`}
        {a.verdict === "too soft" && "Too soft for this dark a grist — add alkalinity (baking soda / chalk) to avoid a too-low mash pH."}
      </div>
      {a.acids.length > 0 && (
        <table style={{ fontSize: "0.8rem", width: "100%", marginTop: "0.2rem" }}>
          <tbody>
            {a.acids.map((d) => (
              <tr key={d.key}>
                <td style={{ paddingRight: "0.6rem" }}>{d.label}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <strong>{d.mlTotal} mL</strong>{" "}
                  <span style={{ color: "var(--wh-text-light)" }}>({d.mlPerGallon}/gal)</span>
                </td>
              </tr>
            ))}
            {a.acidMalt && (
              <tr>
                <td style={{ paddingRight: "0.6rem" }}>Acidulated malt</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <strong>{a.acidMalt.grams} g</strong>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
      <p style={{ fontSize: "0.72rem", color: "var(--wh-text-light)", margin: "0.2rem 0 0" }}>
        Doses are sized on acid equivalents to bring residual alkalinity to target — the part that
        can be calculated honestly. The malt&apos;s own buffering sets the final number, so confirm
        with a calibrated pH meter. Colour↔RA relationship after Palmer.
      </p>
    </Card>
  );
}

function ColorCard() {
  const [srm, setSrm] = useState("10");
  return (
    <Card title="Colour SRM ↔ EBC">
      <Row label="SRM"><input style={inp} value={srm} onChange={(e) => setSrm(e.target.value)} /></Row>
      <Out label="EBC" value={f(calc.srmToEbc(n(srm)))} />
    </Card>
  );
}

/**
 * Will this mash convert?
 *
 * Deliberately the simplest form of the question: how much malt, at what
 * diastatic power, against how much unmalted grain. A distiller planning a
 * bourbon mash bill wants that answer without building a whole recipe, and it
 * is the one calculation on this page where getting it wrong means the mash
 * does not work at all rather than the beer being a bit off.
 */
function ConversionCard() {
  const [maltKg, setMaltKg] = useState("2");
  const [maltDp, setMaltDp] = useState("140");
  const [adjunctKg, setAdjunctKg] = useState("8");
  const [endUse, setEndUse] = useState<EndUse>("grain-distilling");
  const [addDp, setAddDp] = useState("220");

  const bill = [
    {
      key: "malt",
      name: "Base malt",
      massG: n(maltKg) * 1000,
      diastaticPowerLintner: n(maltDp),
      diastaticPowerBasis: "published",
    },
    {
      key: "adjunct",
      name: "Unmalted grain",
      massG: n(adjunctKg) * 1000,
      diastaticPowerLintner: 0,
      diastaticPowerBasis: "unmalted",
      requiresConversion: true,
    },
  ].filter((i) => i.massG > 0);

  const a = assessConversion(bill, { endUse });
  const need = maltToReachTarget(bill, { diastaticPowerLintner: n(addDp) }, { endUse });
  const criteria = AMBA_MALT_CRITERIA[endUse];

  return (
    <Card title="Will it convert?">
      <Row label="Base malt (kg)">
        <input style={inp} value={maltKg} onChange={(e) => setMaltKg(e.target.value)} />
      </Row>
      <Row label="its °Lintner">
        <input style={inp} value={maltDp} onChange={(e) => setMaltDp(e.target.value)} />
      </Row>
      <Row label="Unmalted grain (kg)">
        <input style={inp} value={adjunctKg} onChange={(e) => setAdjunctKg(e.target.value)} />
      </Row>
      <Row label="End use">
        <select style={inp} value={endUse} onChange={(e) => setEndUse(e.target.value as EndUse)}>
          <option value="all-malt">All-malt</option>
          <option value="adjunct-brewing">Adjunct brewing</option>
          <option value="grain-distilling">Grain distilling</option>
        </select>
      </Row>
      <Out label="Across the whole bill" value={`${f(a.weightedLintnerFloor, 0)} °L`} />
      <Out label="Unmalted" value={`${f(a.unmaltedFractionPct, 0)}%`} />
      <Out
        label={`${criteria.label} needs`}
        value={`${criteria.dpMin}${criteria.dpMax ? `–${criteria.dpMax}` : "+"} °ASBC`}
      />
      <Out
        label="Verdict"
        value={
          a.verdict === "meets"
            ? "Meets it"
            : a.verdict === "short"
              ? `Short by ${f(Math.abs(a.headroomLintner ?? 0), 0)} °L`
              : "No enzyme source"
        }
      />
      {a.verdict === "short" && (
        <>
          <Row label="Swap in a malt at °L">
            <input style={inp} value={addDp} onChange={(e) => setAddDp(e.target.value)} />
          </Row>
          <Out
            label="Add this much of it"
            value={need != null ? `${f(need / 1000, 2)} kg` : "cannot reach it"}
          />
        </>
      )}
      <p style={{ fontSize: "0.75rem", color: "var(--wh-text-light)", marginTop: "0.5rem", marginBottom: 0 }}>
        Measured against AMBA&rsquo;s Ideal Commercial Malt Criteria (rev. April 2025) — the diastatic
        power the US industry asks of a malt for each end use. °ASBC and °Lintner are the same scale.
        The familiar &ldquo;35 °Lintner minimum&rdquo; is not used here: nothing but forum posts
        supports it, and quoted values for the same claim run from 30 to 70.
      </p>
    </Card>
  );
}

/**
 * Balance a beverage line: how many feet of a given line it takes for a keg at
 * serving pressure to pour calm at the faucet.
 *
 * All figures from the Brewers Association Draught Beer Quality Manual (2019):
 * line resistance from its Table 4.1, static resistance at 0.5 psi per foot of
 * rise from the middle of the keg, and its balance identity
 * dynamic = pressure − static. Pressure comes from the Dynamic Henry's Law
 * relation, which reduces exactly to the classic carbonation chart at the
 * chart's stated calibration (4.8% ABV, SG 1.015) and generalises it for
 * higher-ABV, different-gravity beverages and altitude. See lib/draft-line.ts.
 */
function LineBalanceCard() {
  const [vols, setVols] = useState("2.5");
  const [temp, setTemp] = useState("38");
  const [lineIdx, setLineIdx] = useState(0); // 3/16" vinyl — the kegerator default
  const [rise, setRise] = useState("1");
  const [abv, setAbv] = useState("4.8");
  const [sg, setSg] = useState("1.015");
  const [elev, setElev] = useState("0");

  const line = BEER_LINES[lineIdx];
  const r = balanceLine({
    vols: n(vols),
    tempF: n(temp),
    tubing: line.tubing as Tubing,
    size: line.size,
    riseFt: n(rise),
    abvPct: n(abv),
    sg: n(sg),
    elevationFt: n(elev),
  });

  return (
    <Card title="Balance a beverage line">
      <Row label="Target CO₂ vols"><input style={inp} value={vols} onChange={(e) => setVols(e.target.value)} /></Row>
      <Row label="Keg temp °F"><input style={inp} value={temp} onChange={(e) => setTemp(e.target.value)} /></Row>
      <Row label="Beverage line">
        <select style={{ ...inp, width: 150 }} value={lineIdx} onChange={(e) => setLineIdx(Number(e.target.value))}>
          {BEER_LINES.map((l, i) => (
            <option key={i} value={i}>
              {l.size} {l.bore} {l.tubing}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Faucet above keg middle (ft)"><input style={inp} value={rise} onChange={(e) => setRise(e.target.value)} /></Row>
      <Row label="ABV %"><input style={inp} value={abv} onChange={(e) => setAbv(e.target.value)} /></Row>
      <Row label="Final gravity"><input style={inp} value={sg} onChange={(e) => setSg(e.target.value)} /></Row>
      <Row label="Elevation (ft)"><input style={inp} value={elev} onChange={(e) => setElev(e.target.value)} /></Row>
      {"error" in r ? (
        <Out label="Result" value={r.error} />
      ) : (
        <>
          <Out label="Regulator pressure" value={`${f(r.psig)} psig`} />
          {Math.abs(r.psig - r.standardBeerPsig) >= 0.05 && (
            <Out label="…standard-beer chart says" value={`${f(r.standardBeerPsig)} psig`} />
          )}
          <Out label="Gravity (rise) takes" value={`${f(r.staticPsi)} psi`} />
          <Out label="Line must dissipate" value={`${f(r.dynamicPsi)} psi`} />
          <Out label="Line length" value={`${f(r.lengthFt)} ft (${f(r.lengthM)} m)`} />
          <Out label="Beer standing in the line" value={`${f(r.lineVolumeFlOz)} fl oz`} />
          {r.warnings.map((w, i) => (
            <p key={i} style={{ fontSize: "0.78rem", color: "var(--wh-accent)", margin: "0.4rem 0 0" }}>{w}</p>
          ))}
          {r.notes.map((t, i) => (
            <p key={i} style={{ fontSize: "0.75rem", color: "var(--wh-text-light)", margin: "0.4rem 0 0" }}>{t}</p>
          ))}
        </>
      )}
      <p style={{ fontSize: "0.75rem", color: "var(--wh-text-light)", marginTop: "0.5rem", marginBottom: 0 }}>
        Line resistance, the 0.5 psi/ft rise figure (measured from the <em>middle</em> of the keg) and the
        balance arithmetic are the Brewers Association&rsquo;s Draught Beer Quality Manual (2019), whose own
        worked kegerator table the tests reproduce. Pours at the industry target of ~1 gal/min. Resistance
        varies by manufacturer — the manual says so itself — so treat the length as a starting point and
        trim toward foam.
      </p>
    </Card>
  );
}

function BarrelCard() {
  const [presetIdx, setPresetIdx] = useState(0); // 225 L Bordeaux export
  const [inches, setInches] = useState(false);
  const [belly, setBelly] = useState("71");
  const [head, setHead] = useState("58");
  const [height, setHeight] = useState("89");
  const [stave, setStave] = useState("25");
  const [mode, setMode] = useState<"dipstick" | "face">("dipstick");
  const [level, setLevel] = useState("30");
  const [heel, setHeel] = useState("20");

  const custom = presetIdx < 0;
  const toCm = (s: string) => n(s) * (inches ? 2.54 : 1);
  const u = inches ? "in" : "cm";
  const cmOut = (v: number) => (inches ? `${f(v / 2.54, 2)} in` : `${f(v, 1)} cm`);

  const g = custom
    ? geometryFromTape({
        bellyDiaCm: toCm(belly),
        headDiaCm: toCm(head),
        heightCm: toCm(height),
        staveThicknessMm: n(stave),
      })
    : geometryForPreset(BARREL_PRESETS[presetIdx]);
  const valid = g.bilgeRadiusM > 0.01 && g.headRadiusM > 0.005 && g.lengthM > 0.05 && g.headRadiusM <= g.bilgeRadiusM;

  const r = valid
    ? mode === "dipstick"
      ? gaugeFromDipstick(g, toCm(level))
      : gaugeFromFace(g, toCm(level))
    : null;
  const port = valid ? portHeightForRemaining(g, n(heel)) : null;
  const totalL = valid ? totalVolumeM3(g) * 1000 : 0;

  return (
    <Card title="Barrel gauge (Kepler's problem)">
      <Row label="Barrel">
        <select
          style={{ ...inp, width: 170 }}
          value={presetIdx}
          onChange={(e) => setPresetIdx(Number(e.target.value))}
        >
          {BARREL_PRESETS.map((p, i) => (
            <option key={p.id} value={i}>{p.name}</option>
          ))}
          <option value={-1}>Custom (tape measure)</option>
        </select>
      </Row>
      <Row label="Units">
        <select style={{ ...inp, width: 90 }} value={inches ? "in" : "cm"} onChange={(e) => setInches(e.target.value === "in")}>
          <option value="cm">cm</option>
          <option value="in">inches</option>
        </select>
      </Row>
      {custom && (
        <>
          <Row label={`Belly Ø outside (${u})`}><input style={inp} value={belly} onChange={(e) => setBelly(e.target.value)} /></Row>
          <Row label={`Head Ø outside (${u})`}><input style={inp} value={head} onChange={(e) => setHead(e.target.value)} /></Row>
          <Row label={`Head-to-head height (${u})`}><input style={inp} value={height} onChange={(e) => setHeight(e.target.value)} /></Row>
          <Row label="Stave thickness (mm)"><input style={inp} value={stave} onChange={(e) => setStave(e.target.value)} /></Row>
        </>
      )}
      <Row label="Measured on">
        <select style={{ ...inp, width: 170 }} value={mode} onChange={(e) => setMode(e.target.value as "dipstick" | "face")}>
          <option value="dipstick">Dipstick through the bung</option>
          <option value="face">Face, from its bottom edge</option>
        </select>
      </Row>
      <Row label={mode === "dipstick" ? `Wet length on the stick (${u})` : `Liquid height on the face (${u})`}>
        <input style={inp} value={level} onChange={(e) => setLevel(e.target.value)} />
      </Row>
      {!valid || !r ? (
        <Out label="Result" value="Measurements don't make a barrel — check belly ≥ head and thickness." />
      ) : (
        <>
          <Out label="In the barrel" value={`${f(r.volumeL)} L (${f(r.volumeL / L_PER_GALLON)} gal)`} />
          <Out label="Fill" value={`${f(r.fillPct)} % of ${f(r.totalL, 0)} L`} />
          <Out
            label="Same plane on the face"
            value={r.faceHeightM >= 0 ? cmOut(r.faceHeightM * 100) : "below the face circle"}
          />
          <Out label={`1 ${u} of level here ≈`} value={`${f(r.litresPerCm * (inches ? 2.54 : 1))} L`} />
        </>
      )}
      <Row label="Sampling port: heel to keep (L)">
        <input style={inp} value={heel} onChange={(e) => setHeel(e.target.value)} />
      </Row>
      {port &&
        ("error" in port ? (
          <p style={{ fontSize: "0.78rem", color: "var(--wh-accent)", margin: "0.4rem 0 0" }}>{port.error}</p>
        ) : (
          <Out label="Drill on the face, up from its bottom" value={cmOut(port.faceCm)} />
        ))}
      {custom && valid && (
        <p style={{ fontSize: "0.75rem", color: "var(--wh-text-light)", margin: "0.4rem 0 0" }}>
          Tape mode is an uncalibrated estimate: outside measurements minus an assumed {n(stave) || 25} mm of
          oak (model total {f(totalL, 0)} L). If you know what the barrel actually holds, use a preset — or
          calibrate the stick yourself with a bucket, which beats any formula.
        </p>
      )}
      <p style={{ fontSize: "0.75rem", color: "var(--wh-text-light)", marginTop: "0.5rem", marginBottom: 0 }}>
        Johannes Kepler distrusted the gauging rod pricing the wine at his own wedding and answered with{" "}
        <em>Nova stereometria doliorum vinariorum</em> (1615) — the new solid geometry of wine barrels,
        whose slice-and-sum method is a direct ancestor of the calculus Newton and Leibniz later formalised.
        This card does what the book does: the classical parabolic-stave barrel, sliced and summed, checked
        against two independent computer-algebra systems at 50 digits. Coopers bend staves, not parabolas —
        assuming the other classical curve, a circular arc through the same head and bilge, shifts the total
        by 0.12 % (about a quarter-litre on a 227 L cask), which is less than one centimetre of stick, so the
        curve you assume matters far less than how carefully you read the level. Presets take their shape from the cooperage&rsquo;s
        published external dimensions but are calibrated to its <em>nominal</em> volume, because externals
        don&rsquo;t determine capacity — World Cooperage&rsquo;s own sheet lists identical outside dimensions
        for its 225 L and 240 L barrels. Face heights are measured from the bottom edge of the face, not the
        ground, so the answer doesn&rsquo;t change with the rack. Drill sampling ports through the{" "}
        <em>head</em> (the flat face, between the hoops), never through a stave under hoop tension.
      </p>
    </Card>
  );
}
