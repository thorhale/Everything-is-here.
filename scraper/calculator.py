"""Recreation of BrewToad's recipe calculator formulas, extracted verbatim
from the archived /assets/recipe_editor.js (see docs/calculator-formulas.md
for the de-minified source and derivation).

This module is the QA/validation implementation used to cross-check the
scraped dataset (recompute stats from parsed ingredients, compare against
each recipe's displayed "Anticipated" values). The same formulas get ported
to app/lib/calculator (TypeScript) for the live interactive calculator (M6) -
keep both in sync with docs/calculator-formulas.md if either changes.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class CalcFermentable:
    amount_lb: float
    ppg: float
    is_grain: bool  # non-grain (extract/sugar) always contributes; grain is
    # efficiency-scaled and skipped entirely for "Extract" recipe_type


@dataclass
class CalcHop:
    amount_oz: float
    alpha_pct: float
    time_min: float
    is_dry_hop: bool


@dataclass
class CalcInputs:
    batch_size_gal: float
    efficiency_pct: float
    attenuation_pct: float
    fermentables: list[CalcFermentable]
    hops: list[CalcHop]
    fermentable_colors: list[tuple[float, float]]  # (color_lovibond, amount_lb)
    recipe_type: str = "All Grain"  # "Extract" recipes skip grain PPG entirely
    boil_size_gal: float | None = None  # defaults to batch_size_gal if unknown


def _gravity_at(volume_gal: float, inputs: CalcInputs) -> float:
    if volume_gal <= 0:
        return 1.0
    total = 0.0
    for f in inputs.fermentables:
        if inputs.recipe_type == "Extract" and f.is_grain:
            continue
        pc = f.ppg * f.amount_lb
        if f.is_grain:
            pc *= inputs.efficiency_pct / 100
        total += pc * (1 / volume_gal)
    return total / 1000 + 1


def og(inputs: CalcInputs) -> float:
    return _gravity_at(inputs.batch_size_gal, inputs)


def _avg_boil_gravity(inputs: CalcInputs) -> float:
    boil_size = inputs.boil_size_gal if inputs.boil_size_gal is not None else inputs.batch_size_gal
    return _gravity_at((boil_size + inputs.batch_size_gal) / 2, inputs)


def fg(og_value: float, attenuation_pct: float) -> float:
    return 1 + (og_value - 1) * (1 - attenuation_pct / 100)


def abv(og_value: float, fg_value: float) -> float:
    return (og_value - fg_value) * 131


def ibu(inputs: CalcInputs) -> float:
    if inputs.batch_size_gal <= 0:
        return 0.0
    avg_gravity = _avg_boil_gravity(inputs)
    bigness_factor = 1.65 * (0.000125 ** (avg_gravity - 1))
    total = 0.0
    for h in inputs.hops:
        if h.is_dry_hop:
            continue
        aau_equiv = h.amount_oz * (h.alpha_pct / 100) * 100
        time_factor = (1 - 2.718281828 ** (-0.04 * h.time_min)) / 4.15
        utilization = bigness_factor * time_factor
        total += aau_equiv * utilization * 75 / inputs.batch_size_gal
    return total


def srm(inputs: CalcInputs) -> float:
    if inputs.batch_size_gal <= 0:
        return 0.0
    mcu = sum(color * amount for color, amount in inputs.fermentable_colors) / inputs.batch_size_gal
    return 1.4922 * (mcu ** 0.6859)
