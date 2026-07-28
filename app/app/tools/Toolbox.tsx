"use client";

import { useState, type ReactNode } from "react";
import * as calc from "@/lib/brewing-calcs";
import { residualAlkalinity, mashPhAdvice } from "@/lib/mash-ph";

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
  const ra = residualAlkalinity(n(ca), n(mg), n(hco3));
  const a = mashPhAdvice(n(srm), ra);
  const color = a.verdict === "on target" ? "#3f7d3f" : "#b55002";
  return (
    <Card title="Mash pH / alkalinity">
      <Row label="Beer colour (SRM)"><input style={inp} value={srm} onChange={(e) => setSrm(e.target.value)} /></Row>
      <Row label="Water Ca (ppm)"><input style={inp} value={ca} onChange={(e) => setCa(e.target.value)} /></Row>
      <Row label="Water Mg (ppm)"><input style={inp} value={mg} onChange={(e) => setMg(e.target.value)} /></Row>
      <Row label="Water HCO₃ (ppm)"><input style={inp} value={hco3} onChange={(e) => setHco3(e.target.value)} /></Row>
      <Out label="Residual alkalinity" value={`${a.actualRa} ppm`} />
      <Out label="Target RA (for colour)" value={`${a.targetRa} ppm`} />
      <Out label="Estimated mash pH" value={`~${f(a.estimatedPh, 2)}`} />
      <div style={{ fontSize: "0.85rem", fontWeight: 600, color, padding: "0.3rem 0" }}>
        {a.verdict === "on target" && "Water suits this grist."}
        {a.verdict === "too alkaline" && `Too alkaline — add ~${a.acidMaltPct}% acidulated malt, or ~${a.lacticMlPerGal} mL 88% lactic acid per gallon of mash water (or dilute with RO).`}
        {a.verdict === "too soft" && "Too soft for this dark a grist — add alkalinity (baking soda / chalk) to avoid a too-low mash pH."}
      </div>
      <p style={{ fontSize: "0.72rem", color: "var(--wh-text-light)", margin: "0.2rem 0 0" }}>
        Estimate only — confirm with a calibrated pH meter. Based on Palmer&apos;s colour↔RA
        relationship.
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
