# Yeast pitching & starter formulas

Source implementation: `app/lib/pitching/formulas.ts` (used by the
`/pitching` calculator and embedded on recipe pages via
`app/app/recipes/[slug]/RecipePitching.tsx`).

## Why this is a reconstruction, not a port

Unlike `docs/calculator-formulas.md` — where the recipe calculator is a
verbatim port of BrewToad's archived client-side `recipe_editor.js` — Mr
Malty's pitching math is **not public**. The current mrmalty.com calculator
runs server-side ("Calculations run on the Mr Malty calculation API"), so
there is no client JS to extract.

This model is therefore an **independent reconstruction** from the openly
published homebrewing literature the original is built on. WortHogg is not
affiliated with Mr Malty.

## Sources

- **C. White & J. Zainasheff, _Yeast: The Practical Guide to Beer
  Fermentation_ (Brewers Publications, 2010)** — target pitch rates and
  fresh viable-cell assumptions.
- **Maltose Falcons, "Yeast Propagation and Maintenance: Principles and
  Practices"**
  (<https://www.maltosefalcons.com/blogs/brewing-techniques-tips/yeast-propagation-and-maintenance-principles-and-practices>)
  — measured per-method starter cell densities and the dry/liquid
  viable-cell figures.
- **K. Troester (Braukaiser), yeast-growth experiments** — the
  inoculation-density → growth-rate curve a starter follows toward its
  ceiling.

## Target cells

```
plato   = -616.868 + 1111.14·SG - 630.272·SG² + 135.997·SG³   (ASBC cubic)
needed  = pitchRate · plato · volumeMl / 1000                  (billion cells)
```

Pitch rates (million cells / mL / °Plato). These are consistent with the
Maltose Falcons ranges — ales ~6–10 M/mL, lagers ~10–15 M/mL at typical
gravities:

| Fermentation | Rate |
| ------------ | ---- |
| Ale          | 0.75 |
| Hybrid       | 1.0  |
| Lager        | 1.5  |

## Yeast source (cells available before a starter)

| Source | Fresh count | Notes |
| ------ | ----------- | ----- |
| Liquid | 100 B / vial or Activator pack | age-adjusted by viability model |
| Dry    | 20 B / gram (Maltose Falcons: 5 g → ~124 B @ 80% viability) | decays far slower (age applied at 15% rate) |
| Slurry | 3.5 B / mL of 100%-solids yeast | scaled by `yeastFraction`, age-adjusted |

Viability decay models (age in days → surviving fraction):

- **classic** — Mr Malty's ~0.7%/day linear (`1 − 0.007·d`)
- **optimistic** — gentler curve flattening toward a floor
  (`0.5 + 0.5·e^(−d/90)`)
- **whiteLabs** — slower linear (`1 − 0.005·d`)
- **wyeast** — Wyeast's ~20%/month (`1 − 0.2·d/30`)

## Starter growth

The method's **maximum cell density** is the primary lever, taken from
Maltose Falcons' measured 500 mL starters (60 / 92 / 180–360 M/mL):

| Method               | Max density (B/L) | Basis |
| -------------------- | ----------------- | ----- |
| Simple (no agitation)| 20  | ~stir ÷ 12.5 ("10–15× fold" note) |
| Simple + O₂ at start | 35  | between airlocked and shaken |
| Intermittent shaking | 60  | Maltose Falcons (60 M/mL) |
| Continuous aeration  | 92  | Maltose Falcons (92 M/mL) |
| Stir plate           | 200 | Maltose Falcons (180–360 M/mL; conservative low end) |

Cells grow along the Braukaiser inoculation-density curve but are **capped
at the method's carrying capacity** (`maxDensity × starterVolumeL`), and can
never fall below what was pitched (an over-pitched small starter simply
doesn't grow):

```
r        = pitchedCells(B) / starterVolume(L)          (inoculation density, B/L)
grow(r)  = max(0, 12.54793776·r^(−0.4594858324) − 0.9994994906)
total    = clamp( pitched·(1 + grow(r)), pitched, maxDensity·volumeL )
```

Starter gravity is assumed ~1.037–1.040 (≈100 g DME/L); it only informs the
density calibration, not a separate input.

## Spot checks (stir plate)

| Yeast in            | Starter | Result       |
| ------------------- | ------- | ------------ |
| 1 fresh vial (100 B)| 1 L     | ~150 B total |
| 1 fresh vial (100 B)| 2 L     | ~200 B total |
| 10 B into           | 0.5 L shaken | ~30 B (matches Maltose Falcons) |

These land in the same ballpark as the published recommendations. Results
are close approximations, not bit-for-bit reproductions.

## Persisting a recipe's protocol

A recipe can carry its chosen protocol permanently: model
`RecipePitchingProtocol` (one-to-one with `Recipe`) stores the raw
calculator inputs, saved via the admin-gated `savePitchingProtocol` action
in `app/app/recipes/[slug]/actions.ts`. Results are always recomputed from
`lib/pitching/formulas.ts`, never stored.
