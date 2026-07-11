"""M4 golden-set validation: recompute OG/FG/ABV/IBU/SRM from parsed
ingredients using scraper/calculator.py and compare against each recipe's
displayed "Anticipated" values from the archived HTML page.

Usage:
    python3 scraper/validate_calculator.py [data/parsed/m1_sample.jsonl]
"""
from __future__ import annotations

import json
import re
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from calculator import CalcFermentable, CalcHop, CalcInputs, og, fg, abv, ibu, srm  # noqa: E402

NUM_RE = re.compile(r"-?\d+\.?\d*")

# BrewToad supported per-user unit preferences (imperial by default, but
# metric shows up too, e.g. "3.5 kg" fermentables / "20.0 L" batch size /
# "38.0 g" hops) - discovered by a golden-set validation outlier, not
# assumed up front. Convert everything to the lb/oz/gal the extracted
# calculator formulas (docs/calculator-formulas.md) operate in.
KG_TO_LB = 2.20462
G_TO_OZ = 0.035274
L_TO_GAL = 0.264172


def _num(s: str | None) -> float | None:
    if not s:
        return None
    m = NUM_RE.search(s)
    return float(m.group()) if m else None


def _weight_lb(s: str | None) -> float | None:
    v = _num(s)
    if v is None:
        return None
    if s and "kg" in s.lower():
        return v * KG_TO_LB
    return v


def _weight_oz(s: str | None) -> float | None:
    v = _num(s)
    if v is None:
        return None
    if s and re.search(r"\bg\b", s.lower()):
        return v * G_TO_OZ
    return v


def _volume_gal(s: str | None) -> float | None:
    v = _num(s)
    if v is None:
        return None
    if s and re.search(r"\bl\b", s.lower()):
        return v * L_TO_GAL
    return v


def build_inputs(html: dict) -> CalcInputs | None:
    batch_size = _volume_gal(html.get("batch_size_display"))
    efficiency = _num(html.get("efficiency_display"))
    if batch_size is None or efficiency is None:
        return None

    yeasts = html.get("yeasts") or []
    attenuation = _num(yeasts[0]["attenuation"]) if yeasts else None
    if attenuation is None:
        return None

    fermentables = []
    colors = []
    for f in html.get("fermentables", []):
        amount = _weight_lb(f.get("amount_display"))
        ppg = _num(f.get("ppg"))
        color = _num(f.get("color_lovibond"))
        if amount is None or ppg is None:
            continue
        # Proxy for the JS's `type === "Grain"` efficiency-scaling check:
        # HTML doesn't expose BrewToad's internal fermentable type, but "Use"
        # (Mash vs Steep/other) is a reasonable stand-in for "does efficiency
        # apply". Documented approximation, see docs/calculator-formulas.md.
        is_grain = (f.get("use") or "").strip().lower() == "mash"
        fermentables.append(CalcFermentable(amount_lb=amount, ppg=ppg, is_grain=is_grain))
        if color is not None:
            colors.append((color, amount))

    hops = []
    for h in html.get("hops", []):
        amount = _weight_oz(h.get("amount_display"))
        alpha = _num(h.get("alpha_acid"))
        time_val = _num(h.get("time_display"))
        if amount is None or alpha is None or time_val is None:
            continue
        is_dry_hop = "dry hop" in (h.get("use") or "").lower() or "day" in (h.get("time_display") or "").lower()
        hops.append(CalcHop(amount_oz=amount, alpha_pct=alpha, time_min=0 if is_dry_hop else time_val, is_dry_hop=is_dry_hop))

    return CalcInputs(
        batch_size_gal=batch_size,
        efficiency_pct=efficiency,
        attenuation_pct=attenuation,
        fermentables=fermentables,
        hops=hops,
        fermentable_colors=colors,
    )


def main() -> None:
    path = sys.argv[1] if len(sys.argv) > 1 else "data/parsed/m1_sample.jsonl"
    records = [json.loads(l) for l in open(path, encoding="utf-8")]

    diffs = {"og": [], "fg": [], "abv": [], "ibu": [], "srm": []}
    skipped = 0
    evaluated = 0

    for r in records:
        html = r["html"]
        inputs = build_inputs(html)
        if inputs is None or not inputs.fermentables:
            skipped += 1
            continue

        og_v = og(inputs)
        fg_v = fg(og_v, inputs.attenuation_pct)
        abv_v = abv(og_v, fg_v)
        ibu_v = ibu(inputs)
        srm_v = srm(inputs)

        displayed_og = _num(html.get("og"))
        displayed_fg = _num(html.get("fg"))
        displayed_abv = _num(html.get("abv"))
        displayed_ibu = _num(html.get("ibu"))
        displayed_srm = _num(html.get("srm"))

        if displayed_og is None:
            skipped += 1
            continue

        evaluated += 1
        if displayed_og is not None:
            diffs["og"].append(abs(og_v - displayed_og))
        if displayed_fg is not None:
            diffs["fg"].append(abs(fg_v - displayed_fg))
        if displayed_abv is not None:
            diffs["abv"].append(abs(abv_v - displayed_abv))
        if displayed_ibu is not None:
            diffs["ibu"].append(abs(ibu_v - displayed_ibu))
        if displayed_srm is not None:
            diffs["srm"].append(abs(srm_v - displayed_srm))

    print(f"evaluated={evaluated} skipped(missing fields)={skipped}")
    for key, vals in diffs.items():
        if not vals:
            continue
        mean_abs = sum(vals) / len(vals)
        max_abs = max(vals)
        print(f"  {key}: n={len(vals)} mean_abs_diff={mean_abs:.4f} max_abs_diff={max_abs:.4f}")


if __name__ == "__main__":
    main()
