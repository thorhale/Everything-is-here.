"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  computeRecipe,
  defaultPath,
  BEVERAGES,
  CATEGORY_PRIORITY,
  type Beverage,
  type EngineIngredient,
  type EngineHop,
  type SugarPath,
  type Band,
} from "@/lib/recipe-engine";
import {
  planSo2,
  planNutrients,
  tosna,
  adjustAcid,
  chaptalise,
  washYield,
  proofDown,
  brixFromSg,
} from "@/lib/must";
import type { FermentablePick } from "@/lib/ingredients-curated";
import type { WaterPick } from "@/lib/water";
import { SALTS, suggestSalts, applySalts, zeroIons, IonKeys, type Ions } from "@/lib/water-salts";
import { residualAlkalinity, mashPhAdvice } from "@/lib/mash-ph";
import { adjustHops } from "@/lib/hop-adjust";
import { rebalance, type BillItem, type RebalanceMethod } from "@/lib/color-balance";
import ShopThisRecipe from "@/components/ShopThisRecipe";
import type { BuyItem } from "@/lib/buy-links";

export interface HopPick {
  id: string;
  name: string;
  alpha: number | null;
  country?: string | null;
}
export interface StrainPick {
  id: string;
  name: string;
  lab: string;
  attenuation: number | null;
  toleranceMax?: number | null;
  uses?: string[];
}

interface Row {
  key: string;
  fermentableId: string;
  name: string;
  category: string;
  type: string;
  path: SugarPath;
  fruitHandling: "pressed" | "whole";
  amount: string;
  amountUnit: "g" | "kg" | "lb" | "oz" | "L";
  measuredBrix: string;
  pick: FermentablePick | null;
}

interface HopRow {
  key: string;
  name: string;
  amountG: string;
  alphaPct: string; // the ACTUAL alpha (editable); assumedAlpha holds the recipe's
  assumedAlpha: number | null; // catalogue midpoint the addition was designed at
  country: string | null; // growing region, for the buy list
  timeMin: string;
  isDryHop: boolean;
}

// Yeast is grouped by what it's FOR, not by the beverage you happen to be
// building — a distiller can pitch a wine or ale yeast, a mead can take a
// Champagne strain, and so on. You pick the use first, then the strain; "All
// yeast" drops the filter entirely so nothing is off-limits.
const YEAST_USE_GROUPS: { id: string; label: string; uses: string[] }[] = [
  { id: "beer", label: "Beer (ale & lager)", uses: ["beer"] },
  { id: "wine", label: "Wine", uses: ["wine"] },
  { id: "cider", label: "Cider", uses: ["cider"] },
  { id: "mead", label: "Mead", uses: ["mead"] },
  { id: "distilling", label: "Distilling / spirits", uses: ["whiskey", "rum", "moonshine", "neutral"] },
  { id: "wild", label: "Wild / mixed culture", uses: ["wild"] },
];
const DEFAULT_YEAST_USE: Record<Beverage, string> = {
  beer: "beer",
  cider: "cider",
  wine: "wine",
  mead: "mead",
  spirit: "distilling",
};
function strainInGroup(uses: string[] | undefined, groupId: string): boolean {
  if (!groupId) return true; // "" = all yeast
  const g = YEAST_USE_GROUPS.find((x) => x.id === groupId);
  if (!g) return true;
  return (uses ?? []).some((u) => g.uses.includes(u));
}

let counter = 0;
const nextKey = () => `r${++counter}`;

const num = (s: string): number => {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
};

const TO_GRAMS: Record<Row["amountUnit"], number> = { g: 1, kg: 1000, lb: 453.59237, oz: 28.349523125, L: 1 };

/** Starting points that show what each beverage's arithmetic actually looks like. */
const PRESETS: Record<Beverage, { volumeL: number; efficiency: number; attenuation: number; tolerance: number }> = {
  beer: { volumeL: 20, efficiency: 72, attenuation: 75, tolerance: 12 },
  cider: { volumeL: 20, efficiency: 100, attenuation: 98, tolerance: 14 },
  wine: { volumeL: 20, efficiency: 100, attenuation: 98, tolerance: 16 },
  mead: { volumeL: 20, efficiency: 100, attenuation: 95, tolerance: 18 },
  spirit: { volumeL: 25, efficiency: 100, attenuation: 98, tolerance: 18 },
};

export default function BuilderForm({
  fermentables,
  hops,
  strains,
  waters,
}: {
  fermentables: FermentablePick[];
  hops: HopPick[];
  strains: StrainPick[];
  waters: WaterPick[];
}) {
  // Multi-select: which drinks' calculators are showing. An empty set means
  // "show everything" — so not choosing a category gives you every calculator
  // at once, one or two narrows it, and any combination (beer+mead = braggot)
  // is a hybrid. The engine treats all of it as sugar over volume regardless.
  const [selected, setSelected] = useState<Beverage[]>(["beer"]);
  const [volumeL, setVolumeL] = useState("20");
  const [efficiency, setEfficiency] = useState("72");
  const [attenuation, setAttenuation] = useState("75");
  const [tolerance, setTolerance] = useState("12");
  const [useTolerance, setUseTolerance] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [hopRows, setHopRows] = useState<HopRow[]>([]);
  const [boilVolumeL, setBoilVolumeL] = useState("26");
  const [selectedStrainId, setSelectedStrainId] = useState("");
  const [yeastUse, setYeastUse] = useState<string>("beer"); // "" = all yeast

  // Hop α-adjust + malt-colour rebalance controls
  const [bitterThreshold, setBitterThreshold] = useState("60"); // min boil = "bittering"
  const [targetSrm, setTargetSrm] = useState(""); // "" = no colour target set
  const [colorNote, setColorNote] = useState("");

  // Honour ?beverage=… from the "what are you making today?" links on the home
  // page. Read client-side on mount so /build stays statically rendered.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("beverage");
    if (p && BEVERAGES.some((b) => b.id === p)) {
      setSelected([p as Beverage]);
      applyPreset(p as Beverage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Water panel (beer only): source tap -> target profile -> salt additions.
  const [sourceWaterId, setSourceWaterId] = useState(""); // "" = RO / distilled
  const [targetWaterId, setTargetWaterId] = useState("");

  // Must-chemistry panel inputs
  const [measuredPh, setMeasuredPh] = useState("");
  const [measuredTa, setMeasuredTa] = useState("");
  const [targetTa, setTargetTa] = useState("6.5");
  const [targetSg, setTargetSg] = useState("");
  const [nitrogenDemand, setNitrogenDemand] = useState<"low" | "medium" | "high">("medium");

  // Spirit panel
  const [stillEfficiency, setStillEfficiency] = useState("85");
  const [collectionAbv, setCollectionAbv] = useState("60");
  const [targetProofAbv, setTargetProofAbv] = useState("40");

  function applyPreset(b: Beverage) {
    const p = PRESETS[b];
    setVolumeL(String(p.volumeL));
    setEfficiency(String(p.efficiency));
    setAttenuation(String(p.attenuation));
    setTolerance(String(p.tolerance));
    // Default the yeast filter to this drink's usual family, but leave it free.
    setYeastUse(DEFAULT_YEAST_USE[b]);
    setSelectedStrainId("");
  }

  function toggleBeverage(b: Beverage) {
    const next = selected.length === 0 ? [b] : selected.includes(b) ? selected.filter((x) => x !== b) : [...selected, b];
    setSelected(next);
    // Only stomp the batch presets when it collapses to a single drink; a
    // hybrid or "everything" view leaves your numbers alone.
    if (next.length === 1) applyPreset(next[0]);
  }

  function addRow(id: string) {
    const pick = fermentables.find((f) => f.id === id);
    if (!pick) return;
    const path = defaultPath(pick.category, pick.type);
    setRows((r) => [
      ...r,
      {
        key: nextKey(),
        fermentableId: pick.id,
        name: pick.name,
        category: pick.category,
        type: pick.type,
        path,
        fruitHandling: pick.juiceYieldPct ? "pressed" : "whole",
        amount: path === "juice" ? "10" : pick.category === "honey" ? "3" : "1",
        amountUnit: path === "juice" ? "L" : "kg",
        measuredBrix: "",
        pick,
      },
    ]);
  }

  const updateRow = (key: string, patch: Partial<Row>) =>
    setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  // Section visibility derives from the selected set. Empty set = show all.
  const showAll = selected.length === 0;
  const has = (b: Beverage) => showAll || selected.includes(b);
  const isBeer = has("beer");
  const isSpirit = has("spirit");
  const showMust = has("cider") || has("wine") || has("mead") || has("spirit");
  const primary: Beverage = selected[0] ?? "beer";
  // The engine wants one beverage: use beer whenever the beer sections show (so
  // IBU/SRM compute), otherwise the primary selection (so must-chem fires).
  const beverage: Beverage = isBeer ? "beer" : primary;

  const engine = useMemo(() => {
    const ingredients: EngineIngredient[] = rows.map((r) => {
      const p = r.pick;
      const isLitres = r.amountUnit === "L";
      return {
        key: r.key,
        name: r.name,
        path: r.path,
        amount: isLitres ? num(r.amount) : num(r.amount) * TO_GRAMS[r.amountUnit],
        amountUnit: isLitres ? "L" : "g",
        ppg: p?.ppg ?? null,
        ppgMin: p?.ppgMin ?? null,
        ppgMax: p?.ppgMax ?? null,
        sugarGPer100g: p?.sugarGPer100g ?? null,
        sugarGPer100gMin: p?.sugarGPer100gMin ?? null,
        sugarGPer100gMax: p?.sugarGPer100gMax ?? null,
        juiceBrix: p?.juiceBrix ?? null,
        juiceBrixMin: p?.juiceBrixMin ?? null,
        juiceBrixMax: p?.juiceBrixMax ?? null,
        juiceYieldPct: p?.juiceYieldPct ?? null,
        measuredBrix: r.measuredBrix ? num(r.measuredBrix) : null,
        fruitHandling: r.fruitHandling,
        colorLovibond: p?.colorLovibond ?? null,
        titratableAcidityGPerL: p?.titratableAcidityGPerL ?? null,
        phTypical: p?.phTypical ?? null,
      };
    });
    const engineHops: EngineHop[] = hopRows.map((h) => ({
      key: h.key,
      name: h.name,
      amountG: num(h.amountG),
      alphaPct: num(h.alphaPct),
      timeMin: num(h.timeMin),
      isDryHop: h.isDryHop,
    }));
    return computeRecipe({
      beverage,
      batchVolumeL: num(volumeL),
      efficiencyPct: num(efficiency),
      attenuationPct: num(attenuation),
      alcoholTolerancePct: useTolerance ? num(tolerance) : null,
      ingredients,
      hops: engineHops,
      boilVolumeL: num(boilVolumeL),
    });
  }, [beverage, volumeL, efficiency, attenuation, tolerance, useTolerance, rows, hopRows, boilVolumeL]);

  const vol = num(volumeL);
  const ph = measuredPh ? num(measuredPh) : engine.estimatedPh;
  const ta = measuredTa ? num(measuredTa) : engine.estimatedTaGPerL;

  // --- hop bittering-weight adjustment ------------------------------------
  const hopAdjust = useMemo(
    () =>
      adjustHops(
        hopRows.map((h) => ({
          name: h.name,
          amountG: num(h.amountG),
          assumedAlpha: h.assumedAlpha ?? num(h.alphaPct),
          actualAlpha: num(h.alphaPct),
          timeMin: num(h.timeMin),
          isDryHop: h.isDryHop,
        })),
        num(bitterThreshold) || 60
      ),
    [hopRows, bitterThreshold]
  );
  const hasBitteringChange = hopAdjust.additions.some((a) => a.changed);

  // --- malt-colour bill (grain rows) --------------------------------------
  const colorBill: BillItem[] = useMemo(
    () =>
      rows
        .filter((r) => r.pick && (r.pick.colorLovibond != null || r.type === "grain"))
        .map((r) => ({
          key: r.key,
          name: r.name,
          colorLovibond: r.pick?.colorLovibond ?? null,
          massG: num(r.amount) * TO_GRAMS[r.amountUnit],
          isBase: r.pick?.category === "base-malt",
        })),
    [rows]
  );

  // Write a rebalanced bill's masses back onto the ingredient rows.
  function applyBill(bill: BillItem[]) {
    setRows((rs) =>
      rs.map((r) => {
        const b = bill.find((x) => x.key === r.key);
        if (!b) return r;
        const amt = b.massG / TO_GRAMS[r.amountUnit];
        return { ...r, amount: String(Math.round(amt * 100) / 100) };
      })
    );
  }

  function doRebalance(method: RebalanceMethod) {
    const t = num(targetSrm);
    if (!(t > 0)) {
      setColorNote("Enter a target SRM first.");
      return;
    }
    let opts: { lighterBaseKey?: string } | undefined;
    if (method === "swap-base") {
      const bases = colorBill.filter((b) => b.isBase);
      const lightest = bases.length
        ? bases.reduce((a, b) => ((b.colorLovibond ?? 0) < (a.colorLovibond ?? 0) ? b : a), bases[0])
        : null;
      opts = lightest ? { lighterBaseKey: lightest.key } : undefined;
    }
    const res = rebalance(colorBill, t, method, vol, opts);
    if (method !== "inform" && method !== "custom") applyBill(res.bill);
    setColorNote(res.note);
  }

  // --- "shop this recipe" list (dormant until a retailer is enabled) ------
  const buyItems: BuyItem[] = useMemo(() => {
    const items: BuyItem[] = [];
    for (const r of rows) if (r.name) items.push({ cls: "fermentable", name: r.name, brand: r.pick?.brand ?? null });
    for (const h of hopRows) if (h.name) items.push({ cls: "hop", name: h.name, country: h.country });
    const strain = strains.find((s) => s.id === selectedStrainId);
    if (strain) items.push({ cls: "yeast", name: strain.name, lab: strain.lab });
    return items;
  }, [rows, hopRows, strains, selectedStrainId]);

  // --- water treatment (beer) ---------------------------------------------
  // Salt volume is treated as the batch volume for a first pass — mash plus
  // sparge is close enough to size the additions, and the panel says so.
  const sourceWater = waters.find((w) => w.id === sourceWaterId) ?? null;
  const targetWater = waters.find((w) => w.id === targetWaterId) ?? null;
  const waterVol = vol > 0 ? vol : 20;
  const water = useMemo(() => {
    if (!targetWater) return null;
    const source: Partial<Ions> = sourceWater ? pickIons(sourceWater) : {};
    const target = pickIons(targetWater);
    const plan = suggestSalts(source, target, waterVol);
    const result = applySalts(source, plan.grams, waterVol);
    const ra = residualAlkalinity(result.calcium, result.magnesium, result.bicarbonate);
    const so4 = result.sulfate;
    const cl = result.chloride;
    const ratio = cl > 0 ? so4 / cl : so4 > 0 ? Infinity : null;
    return { source, target, plan, result, ra, ratio };
  }, [sourceWater, targetWater, waterVol]);
  const phAdvice =
    isBeer && water && engine.srm != null ? mashPhAdvice(engine.srm, water.ra) : null;
  // Colour-based default target so the picker isn't a blank stare.
  const suggestedTargetId = isBeer
    ? engine.srm == null || engine.srm < 8
      ? "target-yellow-balanced"
      : engine.srm < 17
        ? "target-amber-balanced"
        : engine.srm < 30
          ? "target-brown-balanced"
          : "target-black-balanced"
    : null;

  const so2 = ph != null && vol > 0 ? planSo2(ph, vol, 0, 0.8) : null;
  const nutrients = vol > 0 && engine.og.typical > 1.001
    ? planNutrients(brixFromSg(engine.og.typical), vol, 0, nitrogenDemand)
    : null;
  const tosnaPlan = has("mead") && vol > 0 && engine.og.typical > 1.001 ? tosna(vol, engine.og.typical) : null;
  const acidPlan = ta != null && vol > 0 ? adjustAcid(ta, num(targetTa), vol) : null;
  const chapt = targetSg && vol > 0 && engine.og.typical > 1 ? chaptalise(engine.og.typical, num(targetSg), vol) : null;
  const spirit = isSpirit && vol > 0
    ? washYield(vol, engine.abv.typical, {
        stillEfficiencyPct: num(stillEfficiency),
        collectionAbvPct: num(collectionAbv),
        pectinRich: rows.some((r) => ["pome", "stone"].includes(r.category) || r.category === "fruit"),
      })
    : null;
  const proof = spirit && spirit.expectedCollectionL > 0
    ? proofDown(num(collectionAbv), spirit.expectedCollectionL, num(targetProofAbv))
    : null;

  // Catalog grouped so the beverage you picked surfaces its own ingredients
  // first — without hiding anything, because braggot exists.
  const grouped = useMemo(() => {
    const order = CATEGORY_PRIORITY[beverage];
    const byCat = new Map<string, FermentablePick[]>();
    for (const f of fermentables) {
      if (!byCat.has(f.category)) byCat.set(f.category, []);
      byCat.get(f.category)!.push(f);
    }
    const keys = [...byCat.keys()].sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
    });
    return keys.map((k) => ({ category: k, items: byCat.get(k)! }));
  }, [fermentables, beverage]);

  // Filtered by the chosen yeast use, NOT by the beverage — any yeast is fair
  // game for any drink.
  const relevantStrains = useMemo(
    () => strains.filter((s) => strainInGroup(s.uses, yeastUse)),
    [strains, yeastUse]
  );

  return (
    <div>
      {/* ---------------------------------------------------- beverage --- */}
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
        {BEVERAGES.map((b) => {
          const on = !showAll && selected.includes(b.id);
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => toggleBeverage(b.id)}
              className="wh-style-chip"
              style={{
                cursor: "pointer",
                border: on ? "2px solid var(--wh-accent)" : "1px solid var(--wh-border)",
                fontWeight: on ? 700 : 400,
              }}
            >
              {b.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setSelected([])}
          className="wh-style-chip"
          style={{
            cursor: "pointer",
            border: showAll ? "2px solid var(--wh-accent)" : "1px solid var(--wh-border)",
            fontWeight: showAll ? 700 : 400,
          }}
        >
          Everything
        </button>
      </div>
      <p style={{ fontSize: "0.85rem", color: "var(--wh-text-light)", marginTop: 0 }}>
        {showAll
          ? "Every calculator at once. Tap a drink to focus, combine a few for a hybrid (beer + mead = braggot), or leave it open."
          : selected.length === 1
          ? BEVERAGES.find((b) => b.id === selected[0])!.blurb
          : `A hybrid: ${selected.map((id) => BEVERAGES.find((b) => b.id === id)!.label).join(" + ")}. All their ingredients and stats are in play.`}
      </p>

      {/* Always-visible live stats, Brewfather-style: they follow you down the
          form and update as you edit. */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          display: "flex",
          gap: "1.4rem",
          flexWrap: "wrap",
          alignItems: "center",
          padding: "0.55rem 0.75rem",
          marginBottom: "0.85rem",
          background: "var(--wh-bg-soft)",
          border: "1px solid var(--wh-border)",
          borderTop: "3px solid var(--wh-accent)",
          borderRadius: 8,
        }}
      >
        {/* OG/FG/ABV are universal; the rest are what each drink actually cares
            about — IBU/SRM for beer, starting Brix + acid + pH for a must. */}
        <StatMini label="OG" value={engine.og.typical.toFixed(3)} />
        <StatMini label="FG" value={engine.fg.typical.toFixed(3)} />
        <StatMini label="ABV" value={`${engine.abv.typical.toFixed(1)}%`} />
        {isBeer && engine.ibu != null && <StatMini label="IBU" value={engine.ibu.toFixed(0)} />}
        {isBeer && engine.srm != null && (
          <StatMini label="SRM" value={engine.srm.toFixed(1)} swatch={srmToHex(engine.srm)} />
        )}
        {showMust && <StatMini label="°Bx" value={engine.brix.typical.toFixed(1)} />}
        {showMust && ta != null && <StatMini label="TA g/L" value={ta.toFixed(1)} />}
        {showMust && ph != null && <StatMini label="pH" value={ph.toFixed(2)} />}
      </div>

      {/* ------------------------------------------------------- batch --- */}
      <fieldset style={FS}>
        <legend style={LEG}>Batch</legend>
        <div style={GRID}>
          <Field label="Volume (L)" value={volumeL} onChange={setVolumeL} />
          {isBeer && <Field label="Mash efficiency (%)" value={efficiency} onChange={setEfficiency} />}
          {isBeer && <Field label="Boil volume (L)" value={boilVolumeL} onChange={setBoilVolumeL} />}
          <Field label="Apparent attenuation (%)" value={attenuation} onChange={setAttenuation} />
          <label style={{ fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
            <span style={{ color: "var(--wh-text-light)" }}>Yeast use</span>
            <select
              value={yeastUse}
              onChange={(e) => {
                setYeastUse(e.target.value);
                setSelectedStrainId("");
              }}
            >
              <option value="">All yeast</option>
              {YEAST_USE_GROUPS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
            <span style={{ color: "var(--wh-text-light)" }}>Yeast strain</span>
            <select
              value={selectedStrainId}
              onChange={(e) => {
                setSelectedStrainId(e.target.value);
                const s = relevantStrains.find((x) => x.id === e.target.value);
                if (!s) return;
                if (s.attenuation != null) setAttenuation(String(s.attenuation));
                if (s.toleranceMax != null) {
                  setTolerance(String(s.toleranceMax));
                  setUseTolerance(true);
                }
              }}
            >
              <option value="">Pick a strain…</option>
              {relevantStrains.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.lab})
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
            <span style={{ color: "var(--wh-text-light)" }}>Alcohol tolerance (%)</span>
            <span style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
              <input type="checkbox" checked={useTolerance} onChange={(e) => setUseTolerance(e.target.checked)} />
              <input
                type="number"
                value={tolerance}
                onChange={(e) => setTolerance(e.target.value)}
                disabled={!useTolerance}
                style={{ width: "5rem" }}
              />
            </span>
          </label>
        </div>
        {showMust && !isBeer && (
          <p style={{ fontSize: "0.78rem", color: "var(--wh-text-light)", margin: "0.5rem 0 0" }}>
            There is no mash and no brewhouse efficiency here — nothing is being converted from starch, so every gram of
            sugar in the ingredients is a gram of sugar in the fermenter.
          </p>
        )}
      </fieldset>

      {/* ------------------------------------------------- ingredients --- */}
      <fieldset style={FS}>
        <legend style={LEG}>Fermentables</legend>
        <select value="" onChange={(e) => e.target.value && addRow(e.target.value)} style={{ maxWidth: "100%" }}>
          <option value="">Add from the ingredient database…</option>
          {grouped.map((g) => (
            <optgroup key={g.category} label={CATEGORY_LABELS[g.category] ?? g.category}>
              {g.items.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                  {f.brand ? ` — ${f.brand}` : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        {rows.length === 0 && (
          <p style={{ fontSize: "0.85rem", color: "var(--wh-text-light)" }}>
            Nothing added yet. Every ingredient in the database is available to every beverage — the list is just sorted
            so the ones you probably want come first. A braggot needs malt and honey; a cyser needs apples and honey.
          </p>
        )}

        <div style={{ overflowX: "auto" }}>
          {rows.length > 0 && (
            <table style={{ width: "100%", fontSize: "0.85rem" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Ingredient</th>
                  <th>Amount</th>
                  <th>How it goes in</th>
                  <th>Measured °Bx</th>
                  <th>Sugar</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isFruit = r.path === "whole-fruit";
                  const canPress = isFruit && r.pick?.juiceYieldPct != null;
                  const hasBrix = r.path === "juice" || (isFruit && r.fruitHandling === "pressed");
                  return (
                    <tr key={r.key}>
                      <td>
                        <Link href={`/fermentables/db/${encodeURIComponent(r.fermentableId)}`}>{r.name}</Link>
                        <div style={{ fontSize: "0.72rem", color: "var(--wh-text-light)" }}>
                          {CATEGORY_LABELS[r.category] ?? r.category}
                        </div>
                      </td>
                      <td className="nowrap">
                        <input
                          type="number"
                          step="0.1"
                          value={r.amount}
                          onChange={(e) => updateRow(r.key, { amount: e.target.value })}
                          style={{ width: "4.5rem" }}
                        />
                        <select
                          value={r.amountUnit}
                          onChange={(e) => updateRow(r.key, { amountUnit: e.target.value as Row["amountUnit"] })}
                        >
                          {(r.path === "juice" ? (["L"] as const) : (["kg", "g", "lb", "oz"] as const)).map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {canPress ? (
                          <select
                            value={r.fruitHandling}
                            onChange={(e) => updateRow(r.key, { fruitHandling: e.target.value as "pressed" | "whole" })}
                          >
                            <option value="pressed">Pressed for juice</option>
                            <option value="whole">Whole, in the fermenter</option>
                          </select>
                        ) : (
                          <span style={{ color: "var(--wh-text-light)" }}>{PATH_LABELS[r.path]}</span>
                        )}
                      </td>
                      <td>
                        {hasBrix ? (
                          <input
                            type="number"
                            step="0.1"
                            placeholder={r.pick?.juiceBrix ? String(r.pick.juiceBrix) : "—"}
                            value={r.measuredBrix}
                            onChange={(e) => updateRow(r.key, { measuredBrix: e.target.value })}
                            style={{ width: "4.5rem" }}
                          />
                        ) : (
                          <span style={{ color: "var(--wh-text-light)" }}>n/a</span>
                        )}
                      </td>
                      <td className="nowrap" style={{ fontSize: "0.78rem", color: "var(--wh-text-light)" }}>
                        {rowSugarLabel(r)}
                      </td>
                      <td>
                        <button type="button" onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))}>
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {rows.some((r) => r.path === "whole-fruit" && r.fruitHandling === "pressed") && (
          <p style={{ fontSize: "0.78rem", color: "var(--wh-text-light)", marginBottom: 0 }}>
            <strong>Pressed</strong> uses the fruit&apos;s juice yield and the juice&apos;s Brix, and the juice counts
            toward your batch volume. <strong>Whole</strong> assumes the fruit steeps in the fermenter and gives up its
            sugar over time — more sugar recovered, but the fruit&apos;s water joins the batch too.
          </p>
        )}
      </fieldset>

      {/* -------------------------------------------------------- hops --- */}
      {isBeer && (
        <fieldset style={FS}>
          <legend style={LEG}>Hops</legend>
          <select
            value=""
            onChange={(e) => {
              const h = hops.find((x) => x.id === e.target.value);
              if (!h) return;
              setHopRows((r) => [
                ...r,
                {
                  key: nextKey(),
                  name: h.name,
                  amountG: "28",
                  alphaPct: String(h.alpha ?? 5),
                  assumedAlpha: h.alpha ?? null,
                  country: h.country ?? null,
                  timeMin: "60",
                  isDryHop: false,
                },
              ]);
            }}
          >
            <option value="">Add a hop…</option>
            {hops.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
                {h.alpha != null ? ` (${h.alpha}% AA)` : ""}
              </option>
            ))}
          </select>
          {hopRows.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: "0.85rem" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Hop</th>
                    <th>g</th>
                    <th>Alpha %</th>
                    <th>Min</th>
                    <th>Dry</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {hopRows.map((h) => (
                    <tr key={h.key}>
                      <td>{h.name}</td>
                      <td>
                        <input type="number" value={h.amountG} style={{ width: "4rem" }}
                          onChange={(e) => setHopRows((r) => r.map((x) => (x.key === h.key ? { ...x, amountG: e.target.value } : x)))} />
                      </td>
                      <td>
                        <input type="number" step="0.1" value={h.alphaPct} style={{ width: "4rem" }}
                          onChange={(e) => setHopRows((r) => r.map((x) => (x.key === h.key ? { ...x, alphaPct: e.target.value } : x)))} />
                      </td>
                      <td>
                        <input type="number" value={h.timeMin} style={{ width: "4rem" }}
                          onChange={(e) => setHopRows((r) => r.map((x) => (x.key === h.key ? { ...x, timeMin: e.target.value } : x)))} />
                      </td>
                      <td>
                        <input type="checkbox" checked={h.isDryHop}
                          onChange={(e) => setHopRows((r) => r.map((x) => (x.key === h.key ? { ...x, isDryHop: e.target.checked } : x)))} />
                      </td>
                      <td>
                        <button type="button" onClick={() => setHopRows((r) => r.filter((x) => x.key !== h.key))}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {hopRows.length > 0 && (
            <div style={{ marginTop: "0.75rem", borderTop: "1px solid var(--wh-border)", paddingTop: "0.6rem" }}>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                <strong style={{ fontSize: "0.85rem" }}>Buy the right amount for your actual hops</strong>
                <label style={{ fontSize: "0.78rem", color: "var(--wh-text-light)" }}>
                  bittering ≥{" "}
                  <input
                    type="number"
                    value={bitterThreshold}
                    style={{ width: "3.5rem" }}
                    onChange={(e) => setBitterThreshold(e.target.value)}
                  />{" "}
                  min
                </label>
              </div>
              <p style={{ fontSize: "0.78rem", color: "var(--wh-text-light)", margin: "0.3rem 0" }}>
                Put each hop&apos;s <em>actual</em> alpha (from the package) in the Alpha % field. Only
                bittering additions are rescaled to hold the bitterness; aroma additions keep their
                weight so the flavour and aroma you designed stay put.
              </p>
              <table style={{ width: "100%", fontSize: "0.82rem" }}>
                <tbody>
                  {hopAdjust.additions.map((a, i) => (
                    <tr key={i} style={{ color: a.role === "aroma" ? "var(--wh-text-light)" : undefined }}>
                      <td>{a.name}</td>
                      <td className="nowrap">{a.role}</td>
                      <td className="nowrap">
                        {a.changed ? (
                          <>
                            <s>{a.originalG.toFixed(0)} g</s> → <strong>{a.suggestedG.toFixed(1)} g</strong>
                          </>
                        ) : (
                          `${a.originalG.toFixed(0)} g`
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {hasBitteringChange && (
                <div style={{ fontSize: "0.8rem", marginTop: "0.35rem" }}>
                  <strong>Weigh out / buy:</strong>{" "}
                  {hopAdjust.buyTotals.map((b) => `${b.name} ${b.grams} g`).join(" · ")}
                </div>
              )}
            </div>
          )}
        </fieldset>
      )}

      {/* ------------------------------------------------- water & salts --- */}
      {isBeer && (
        <fieldset style={FS}>
          <legend style={LEG}>Water &amp; salts</legend>
          <div style={GRID}>
            <label style={{ fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
              <span style={{ color: "var(--wh-text-light)" }}>Your source water</span>
              <select value={sourceWaterId} onChange={(e) => setSourceWaterId(e.target.value)}>
                <option value="">Distilled / RO (start clean)</option>
                {["classic-city", "modern-city"].map((k) => (
                  <optgroup key={k} label={k === "classic-city" ? "Classic brewing cities" : "Modern cities"}>
                    {waters.filter((w) => w.kind === k).map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label style={{ fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
              <span style={{ color: "var(--wh-text-light)" }}>Target profile</span>
              <select value={targetWaterId} onChange={(e) => setTargetWaterId(e.target.value)}>
                <option value="">Pick a target…</option>
                <optgroup label="Style targets">
                  {waters.filter((w) => w.kind === "style-target").map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Classic city water">
                  {waters.filter((w) => w.kind === "classic-city").map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </optgroup>
              </select>
            </label>
            {suggestedTargetId && !targetWaterId && (
              <button
                type="button"
                className="wh-style-chip"
                style={{ cursor: "pointer", alignSelf: "end" }}
                onClick={() => setTargetWaterId(suggestedTargetId)}
              >
                Use the target for this colour
              </button>
            )}
          </div>

          {water && (
            <div style={{ overflowX: "auto", marginTop: "0.75rem" }}>
              <table style={{ width: "100%", fontSize: "0.85rem" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}></th>
                    <th>Ca</th><th>Mg</th><th>Na</th><th>Cl</th><th>SO₄</th><th>HCO₃</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Source</td>
                    {IonKeys.map((k) => <td key={k} className="nowrap" style={{ textAlign: "center" }}>{Math.round((water.source[k] ?? 0))}</td>)}
                  </tr>
                  <tr style={{ color: "var(--wh-text-light)" }}>
                    <td>Target</td>
                    {IonKeys.map((k) => <td key={k} className="nowrap" style={{ textAlign: "center" }}>{Math.round((water.target[k] ?? 0))}</td>)}
                  </tr>
                  <tr style={{ fontWeight: 700 }}>
                    <td>After salts</td>
                    {IonKeys.map((k) => <td key={k} className="nowrap" style={{ textAlign: "center" }}>{Math.round(water.result[k])}</td>)}
                  </tr>
                </tbody>
              </table>

              <p style={{ fontSize: "0.85rem", margin: "0.6rem 0 0.3rem" }}>
                <strong>Add per {waterVol.toFixed(0)} L</strong> of brewing water:
              </p>
              {Object.keys(water.plan.grams).length === 0 ? (
                <p style={{ fontSize: "0.85rem", color: "var(--wh-text-light)", margin: 0 }}>
                  Nothing — your source water already meets or exceeds this target. To go lower, dilute with distilled or RO water.
                </p>
              ) : (
                <ul style={{ fontSize: "0.85rem", margin: 0, paddingLeft: "1.1rem" }}>
                  {SALTS.filter((s) => (water.plan.grams[s.key] ?? 0) > 0.01).map((s) => (
                    <li key={s.key}>
                      <strong>{water.plan.grams[s.key].toFixed(1)} g</strong> {s.name} <span style={{ color: "var(--wh-text-light)" }}>({s.formula})</span>
                    </li>
                  ))}
                </ul>
              )}
              {water.plan.shortfalls.length > 0 && (
                <p style={{ fontSize: "0.8rem", color: "var(--wh-text-light)", marginTop: "0.4rem" }}>
                  Couldn&apos;t reach by addition alone: {water.plan.shortfalls.join("; ")}.
                </p>
              )}

              <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", marginTop: "0.6rem", fontSize: "0.85rem" }}>
                <span>
                  SO₄:Cl <strong>{water.ratio == null ? "—" : water.ratio === Infinity ? "∞" : water.ratio.toFixed(2)}</strong>{" "}
                  <span style={{ color: "var(--wh-text-light)" }}>({balanceLabel(water.ratio)})</span>
                </span>
                <span>Residual alkalinity <strong>{water.ra}</strong> ppm</span>
              </div>

              {phAdvice && (
                <p style={NOTE}>
                  Mash pH looks <strong>{phAdvice.verdict}</strong> for this colour (RA {phAdvice.actualRa} vs
                  target {phAdvice.targetRa}).{" "}
                  {phAdvice.verdict === "too alkaline" && phAdvice.acidMaltPct != null && (
                    <>Bring it down with about <strong>{phAdvice.acidMaltPct}%</strong> acidulated malt, or ~
                    {phAdvice.lacticMlPerGal} mL of 88% lactic acid per gallon of mash water. </>
                  )}
                  {phAdvice.verdict === "too soft" && (
                    <>The grist is dark enough that this water is too soft — a pinch of baking soda (or chalk in the mash)
                    lifts it into range. </>
                  )}
                  Estimated mash pH ≈ <strong>{phAdvice.estimatedPh.toFixed(2)}</strong> — confirm with a meter.
                </p>
              )}
              <p style={{ fontSize: "0.78rem", color: "var(--wh-text-light)", marginTop: "0.4rem" }}>
                Additions are sized to the full batch volume as a first pass. For the mash/sparge split and acid
                adjustment, take it into the <Link href="/water/builder">water &amp; salt builder →</Link>
              </p>
            </div>
          )}
        </fieldset>
      )}

      {/* ----------------------------------------------------- results --- */}
      <fieldset style={{ ...FS, background: "var(--wh-bg-soft)" }}>
        <legend style={LEG}>Result</legend>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem" }}>
          <BandStat label="Original gravity" b={engine.og} fmt={(v) => v.toFixed(3)} />
          <BandStat label="Final gravity" b={engine.fg} fmt={(v) => v.toFixed(3)} />
          <BandStat label="ABV" b={engine.abv} fmt={(v) => `${v.toFixed(1)}%`} />
          <BandStat label="Starting °Brix" b={engine.brix} fmt={(v) => v.toFixed(1)} />
          {isBeer && engine.ibu != null && <PlainStat label="IBU" value={engine.ibu.toFixed(0)} />}
          {isBeer && engine.srm != null && <PlainStat label="SRM" value={engine.srm.toFixed(1)} />}
        </div>

        <table style={{ width: "100%", fontSize: "0.85rem", marginTop: "0.75rem" }}>
          <tbody>
            <tr>
              <td>Fermentable sugar</td>
              <td className="nowrap">
                {(engine.sugarG.typical / 1000).toFixed(2)} kg
                {engine.sugarG.high - engine.sugarG.low > 1 && (
                  <span style={{ color: "var(--wh-text-light)" }}>
                    {" "}({(engine.sugarG.low / 1000).toFixed(2)}–{(engine.sugarG.high / 1000).toFixed(2)})
                  </span>
                )}
              </td>
            </tr>
            <tr>
              <td>Liquid from ingredients</td>
              <td className="nowrap">{engine.ingredientVolumeL.toFixed(1)} L</td>
            </tr>
            <tr>
              <td>{engine.topUpWaterL >= 0 ? "Water to top up" : "Over batch volume by"}</td>
              <td className="nowrap">{Math.abs(engine.topUpWaterL).toFixed(1)} L</td>
            </tr>
            {engine.estimatedTaGPerL != null && (
              <tr>
                <td>Estimated titratable acidity</td>
                <td className="nowrap">{engine.estimatedTaGPerL.toFixed(1)} g/L</td>
              </tr>
            )}
            {engine.estimatedPh != null && (
              <tr>
                <td>Estimated must pH</td>
                <td className="nowrap">{engine.estimatedPh.toFixed(2)}</td>
              </tr>
            )}
          </tbody>
        </table>

        {engine.warnings.map((w, i) => (
          <p key={i} style={NOTE}>
            {w}
          </p>
        ))}
        {engine.uncertain && (
          <p style={{ ...NOTE, borderLeftColor: "var(--wh-accent)" }}>
            The high and low figures above are not error bars on the maths — they are the real spread in the fruit. A
            refractometer reading in the &ldquo;Measured °Bx&rdquo; column replaces the estimate with your actual juice
            and collapses the band to one number.
          </p>
        )}
      </fieldset>

      {/* ------------------------------------------------ colour rebalance --- */}
      {isBeer && colorBill.length > 0 && (
        <fieldset style={FS}>
          <legend style={LEG}>Colour &amp; malt bill</legend>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.85rem" }}>
              Current <strong>{(engine.srm ?? 0).toFixed(1)} SRM</strong>
            </span>
            <label style={{ fontSize: "0.8rem", color: "var(--wh-text-light)" }}>
              Target SRM{" "}
              <input
                type="number"
                step="0.1"
                value={targetSrm}
                placeholder="e.g. 8"
                style={{ width: "5rem" }}
                onChange={(e) => {
                  setTargetSrm(e.target.value);
                  setColorNote("");
                }}
              />
            </label>
            {num(targetSrm) > 0 && engine.srm != null && (
              <span style={{ fontSize: "0.8rem", color: "var(--wh-text-light)" }}>
                Δ {(engine.srm - num(targetSrm)).toFixed(1)} SRM{" "}
                {engine.srm > num(targetSrm) ? "too dark" : engine.srm < num(targetSrm) ? "too pale" : "on target"}
              </span>
            )}
          </div>
          <p style={{ fontSize: "0.78rem", color: "var(--wh-text-light)", margin: "0.35rem 0" }}>
            A maltster swap can shift colour, because the same variety differs in kiln and roast between
            producers. Set a target and choose how to rebalance — or just be told the shift.
          </p>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            <button type="button" onClick={() => doRebalance("specialty")}>Scale specialty / dark malts</button>
            <button type="button" onClick={() => doRebalance("swap-base")}>Swap base for lighter</button>
            <button type="button" onClick={() => doRebalance("inform")}>Just show the shift</button>
            <button type="button" onClick={() => doRebalance("custom")}>Custom (edit by hand)</button>
          </div>
          {colorNote && <p style={{ fontSize: "0.8rem", marginTop: "0.4rem" }}>{colorNote}</p>}
        </fieldset>
      )}

      {/* Shop this recipe — renders nothing until a retailer is enabled. */}
      <ShopThisRecipe items={buyItems} />

      {/* ---------------------------------------------- must chemistry --- */}
      {showMust && (
        <fieldset style={FS}>
          <legend style={LEG}>Must chemistry</legend>
          <div style={GRID}>
            <Field label="Measured pH (optional)" value={measuredPh} onChange={setMeasuredPh} placeholder={engine.estimatedPh?.toFixed(2) ?? ""} />
            <Field label="Measured TA g/L (optional)" value={measuredTa} onChange={setMeasuredTa} placeholder={engine.estimatedTaGPerL?.toFixed(1) ?? ""} />
            <Field label="Target TA g/L" value={targetTa} onChange={setTargetTa} />
            <Field label="Chaptalise to SG" value={targetSg} onChange={setTargetSg} placeholder="e.g. 1.090" />
            <label style={{ fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
              <span style={{ color: "var(--wh-text-light)" }}>Yeast nitrogen demand</span>
              <select value={nitrogenDemand} onChange={(e) => setNitrogenDemand(e.target.value as typeof nitrogenDemand)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem", marginTop: "0.75rem" }}>
            {acidPlan && (
              <Panel title="Acid">
                {acidPlan.direction === "none" ? (
                  <p style={{ margin: 0 }}>{acidPlan.note}</p>
                ) : (
                  <>
                    <p style={{ margin: "0 0 0.3rem" }}>
                      <strong>
                        {acidPlan.direction === "add" ? "Add" : "Remove"} {acidPlan.totalGrams.toFixed(0)} g
                      </strong>{" "}
                      of {acidPlan.agent} ({acidPlan.gramsPerLitre.toFixed(2)} g/L).
                    </p>
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--wh-text-light)" }}>{acidPlan.note}</p>
                  </>
                )}
              </Panel>
            )}

            {so2 && (
              <Panel title="Sulphite">
                <p style={{ margin: "0 0 0.3rem" }}>
                  At pH {(ph ?? 0).toFixed(2)}, hitting <strong>0.8 mg/L molecular SO₂</strong> needs{" "}
                  <strong>{so2.requiredFreeSo2MgPerL.toFixed(0)} mg/L free SO₂</strong> —{" "}
                  {so2.kmsGrams.toFixed(2)} g of potassium metabisulfite, or about{" "}
                  {so2.campdenTabletsPerGallonEquivalent.toFixed(1)} Campden tablets.
                </p>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--wh-text-light)" }}>
                  Molecular SO₂ is the fraction that actually kills anything, and pH sets it:
                  free ÷ (1 + 10^(pH − 1.81)). At pH 3.0 about 6% of your free SO₂ is molecular; at pH 3.8, 1%.
                </p>
                {so2.warning && <p style={NOTE}>{so2.warning}</p>}
              </Panel>
            )}

            {nutrients && (
              <Panel title="Nitrogen">
                <p style={{ margin: "0 0 0.3rem" }}>
                  Target <strong>{nutrients.targetYan.toFixed(0)} mg/L YAN</strong>. From nothing, that is{" "}
                  {nutrients.dapGrams?.toFixed(1)} g DAP, or {nutrients.fermaidKGrams?.toFixed(1)} g Fermaid K, or{" "}
                  {nutrients.fermaidOGrams?.toFixed(1)} g Fermaid O.
                </p>
                {tosnaPlan && (
                  <p style={{ margin: "0 0 0.3rem" }}>
                    <strong>TOSNA:</strong> {tosnaPlan.totalGrams.toFixed(1)} g Fermaid O total,{" "}
                    {tosnaPlan.perDoseGrams.toFixed(1)} g at each of {tosnaPlan.doses.join(", ")}.
                  </p>
                )}
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--wh-text-light)" }}>{nutrients.note}</p>
              </Panel>
            )}

            {chapt && (
              <Panel title="Chaptalisation">
                <p style={{ margin: "0 0 0.3rem" }}>
                  <strong>{(chapt.sugarG / 1000).toFixed(2)} kg</strong> of sugar takes {engine.og.typical.toFixed(3)} to{" "}
                  {chapt.achievedSg.toFixed(3)}.
                </p>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--wh-text-light)" }}>
                  The sugar takes up room too — about 0.625 mL per gram — so the must finishes at{" "}
                  {chapt.finalVolumeL.toFixed(1)} L rather than {vol.toFixed(1)} L. Ignoring that under-doses by roughly
                  15%.
                </p>
              </Panel>
            )}
          </div>
        </fieldset>
      )}

      {/* -------------------------------------------------- distilling --- */}
      {isSpirit && spirit && (
        <fieldset style={FS}>
          <legend style={LEG}>Still run</legend>
          <div style={GRID}>
            <Field label="Still efficiency (%)" value={stillEfficiency} onChange={setStillEfficiency} />
            <Field label="Collection strength (% ABV)" value={collectionAbv} onChange={setCollectionAbv} />
            <Field label="Bottling strength (% ABV)" value={targetProofAbv} onChange={setTargetProofAbv} />
          </div>
          <table style={{ width: "100%", fontSize: "0.85rem", marginTop: "0.5rem" }}>
            <tbody>
              <tr><td>Wash strength</td><td className="nowrap">{engine.abv.typical.toFixed(1)}% ABV</td></tr>
              <tr><td>Absolute alcohol in the wash</td><td className="nowrap">{spirit.absoluteAlcoholL.toFixed(2)} L</td></tr>
              <tr><td>Expected collection at {num(collectionAbv)}%</td><td className="nowrap">{spirit.expectedCollectionL.toFixed(2)} L</td></tr>
              <tr><td>Foreshots to discard</td><td className="nowrap">{spirit.foreshotsML.toFixed(0)} mL</td></tr>
              <tr><td>Rough hearts fraction</td><td className="nowrap">{spirit.heartsEstimateL.toFixed(2)} L</td></tr>
              {proof && (
                <>
                  <tr><td>Water to reach {num(targetProofAbv)}% ABV</td><td className="nowrap">{proof.waterToAddL.toFixed(2)} L</td></tr>
                  <tr><td>Final bottled volume</td><td className="nowrap">{proof.finalVolumeL.toFixed(2)} L ({(num(targetProofAbv) * 2).toFixed(0)}° US proof)</td></tr>
                </>
              )}
            </tbody>
          </table>
          <p style={NOTE}>{spirit.note}</p>
          {proof && <p style={{ fontSize: "0.8rem", color: "var(--wh-text-light)" }}>{proof.note}</p>}
          <p style={{ ...NOTE, borderLeftColor: "var(--wh-accent)" }}>
            Distilling alcohol at home without a licence is illegal in the United States, the United Kingdom and many
            other jurisdictions, whatever the still is sold as. These figures are here for people distilling legally, and
            for anyone working out what a commercial spirit&apos;s yield implies.
          </p>
        </fieldset>
      )}

      <p style={{ fontSize: "0.8rem", color: "var(--wh-text-light)" }}>
        Every formula here is validated against published reference values — run{" "}
        <code>node app/validate-must.mjs</code> to see the checks. Ingredient figures come from the{" "}
        <Link href="/ingredients">ingredient databases</Link>, each record carrying its own source.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- bits ---

const FS: React.CSSProperties = {
  border: "1px solid var(--wh-border)",
  borderRadius: 8,
  padding: "0.75rem 1rem 1rem",
  marginBottom: "1rem",
};
const LEG: React.CSSProperties = { fontWeight: 700, fontSize: "0.9rem", padding: "0 0.4rem" };
const GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "0.6rem",
};
const NOTE: React.CSSProperties = {
  fontSize: "0.82rem",
  borderLeft: "3px solid var(--wh-border)",
  paddingLeft: "0.6rem",
  margin: "0.6rem 0 0",
};

const CATEGORY_LABELS: Record<string, string> = {
  "base-malt": "Base malts",
  "specialty-malt": "Specialty malts",
  "adjunct-grain": "Adjunct grains",
  cereal: "Cereals & novelty",
  sugar: "Sugars",
  syrup: "Syrups",
  extract: "Extracts",
  honey: "Honey",
  fruit: "Fruit",
  juice: "Juice & concentrate",
  "wine-grape": "Wine grapes",
  other: "Other",
};

const PATH_LABELS: Record<SugarPath, string> = {
  mash: "Mashed (efficiency applies)",
  direct: "Dissolved, full yield",
  "whole-fruit": "Whole, in the fermenter",
  juice: "Juice, as poured",
};

function pickIons(w: WaterPick): Ions {
  return {
    calcium: w.calcium,
    magnesium: w.magnesium,
    sodium: w.sodium,
    chloride: w.chloride,
    sulfate: w.sulfate,
    bicarbonate: w.bicarbonate,
  };
}

function balanceLabel(ratio: number | null): string {
  if (ratio == null) return "—";
  if (ratio === Infinity || ratio >= 2) return "hoppy / dry";
  if (ratio >= 1.3) return "balanced-hoppy";
  if (ratio >= 0.8) return "balanced";
  if (ratio >= 0.5) return "balanced-malty";
  return "malty / full";
}

function rowSugarLabel(r: Row): string {
  const p = r.pick;
  if (!p) return "—";
  if (r.measuredBrix) return `${r.measuredBrix} °Bx measured`;
  if (r.path === "juice" || (r.path === "whole-fruit" && r.fruitHandling === "pressed")) {
    if (p.juiceBrixMin != null && p.juiceBrixMax != null) return `${p.juiceBrixMin}–${p.juiceBrixMax} °Bx`;
    return p.juiceBrix != null ? `${p.juiceBrix} °Bx` : "—";
  }
  if (r.path === "whole-fruit") {
    if (p.sugarGPer100gMin != null && p.sugarGPer100gMax != null)
      return `${p.sugarGPer100gMin}–${p.sugarGPer100gMax} g/100 g`;
    return p.sugarGPer100g != null ? `${p.sugarGPer100g} g/100 g` : "—";
  }
  return p.ppg != null ? `${p.ppg} PPG` : "—";
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label style={{ fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
      <span style={{ color: "var(--wh-text-light)" }}>{label}</span>
      <input type="number" step="any" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function BandStat({ label, b, fmt }: { label: string; b: Band; fmt: (v: number) => string }) {
  const spread = b.high - b.low;
  return (
    <div>
      <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--wh-accent)", lineHeight: 1.1 }}>
        {fmt(b.typical)}
      </div>
      {spread > 1e-9 && (
        <div style={{ fontSize: "0.75rem", color: "var(--wh-text-light)" }}>
          {fmt(b.low)} – {fmt(b.high)}
        </div>
      )}
      <div style={{ fontSize: "0.72rem", color: "var(--wh-text-light)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
    </div>
  );
}

function PlainStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--wh-accent)", lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: "0.72rem", color: "var(--wh-text-light)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
    </div>
  );
}

// Approximate SRM colour from the standard beer-colour chart (nearest stop).
const SRM_HEX: [number, string][] = [
  [1, "#FFE699"], [2, "#FFD878"], [3, "#FFCA5A"], [4, "#FFBF42"], [5, "#FBB123"],
  [6, "#F8A600"], [8, "#EA8F00"], [10, "#DE7C00"], [13, "#C56600"], [16, "#A64C00"],
  [20, "#8E2900"], [25, "#701400"], [30, "#600903"], [35, "#3D0708"], [40, "#240607"],
];
function srmToHex(srm: number): string {
  let best = SRM_HEX[0];
  for (const stop of SRM_HEX) if (Math.abs(stop[0] - srm) < Math.abs(best[0] - srm)) best = stop;
  return best[1];
}

function StatMini({ label, value, swatch }: { label: string; value: string; swatch?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
      {swatch && (
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            background: swatch,
            border: "1px solid rgba(0,0,0,0.25)",
            display: "inline-block",
            flexShrink: 0,
          }}
        />
      )}
      <div>
        <div style={{ fontSize: "1.15rem", fontWeight: 700, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: "0.62rem", color: "var(--wh-text-light)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ border: "1px solid var(--wh-border)", borderRadius: 6, padding: "0.6rem 0.7rem" }}>
      <h3 style={{ fontSize: "0.9rem", margin: "0 0 0.4rem" }}>{title}</h3>
      <div style={{ fontSize: "0.85rem" }}>{children}</div>
    </section>
  );
}
