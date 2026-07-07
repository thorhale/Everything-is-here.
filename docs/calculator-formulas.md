# BrewToad calculator — formulas extracted from `recipe_editor.js`

Source: `/assets/recipe_editor.js`, archived snapshot `20130707160815` (and
others), fetched from `https://web.archive.org/web/20130707160815if_/http://www.brewtoad.com/assets/recipe_editor.js`.
This is minified client-side JS from BrewToad's own recipe editor — these are
the **actual formulas BrewToad used**, not reconstructions.

## Extracted logic (de-minified)

```js
// Gravity at a given volume `a` (gallons)
function gravityAt(a) {
  var c = 0;
  fermentables.forEach(function(f) {
    if (recipe_type === "" || (recipe_type === "Extract" && f.type === "Grain")) return;
    var pc = f.ppg * f.amount;
    if (f.type === "Grain") pc *= efficiency / 100;
    c += pc * (1 / a);
  });
  return c / 1000 + 1;
}

// Average gravity across the boil (used only for IBU utilization, not OG)
function avgBoilGravity() {
  return gravityAt((boil_size() + batch_size) / 2);
}

boil_size = (batch_size - top_up_water) / (1 - (evaporation_rate / 100) * (boil_time / 60));
og = gravityAt(batch_size);
fg = 1 + (og - 1) * (1 - attenuation / 100);
abv = (og - fg) * 131;                       // note: 131, not the more precise 131.25

// Tinseth IBU formula, per non-"Dry Hop" hop addition:
ibu += hop.amount * (hop.alpha / 100) * 100      // AAU-equivalent
     * (1.65 * Math.pow(0.000125, avgBoilGravity() - 1))   // Tinseth bigness factor
     * ((1 - Math.exp(-0.04 * hop.time)) / 4.15)            // Tinseth time factor
     * 75 / batch_size;

// Morey color formula
mcu = sum(fermentable.color_lovibond * fermentable.amount) / batch_size;
srm = 1.4922 * Math.pow(mcu, 0.6859);
```

This matches what the archived UI itself calls out: the "Stats" panel on
recipe pages consistently shows `IBU Formula: Tinseth`, and the Morey/Tinseth
choice lines up with the standard homebrewing formulas of that era.

## Spot-validation against a real archived recipe

Recipe: `2-row-ale` (batch 5 gal, 10 lb 2-Row Brewers Malt @ PPG 37, 75%
efficiency, Wyeast 1056 @ 75% attenuation, 1.5oz Cascade 4.5%AA @60min +
1.0oz Cascade 4.5%AA @20min). Displayed on the archived page: OG 1.056, FG
1.014, IBU 29, ABV 5.5%.

- OG: `37*10*0.75/5/1000+1 = 1.0555` → displays as **1.056** ✓ (rounding)
- FG: `1 + (1.0555-1)*(1-0.75) = 1.0139` → displays as **1.014** ✓
- ABV: `(1.0555-1.0139)*131 = 5.45%` → displays as **5.5%** ✓
- IBU: computed ≈31-33 depending on assumed `evaporation_rate`/`top_up_water`
  (not visible on the rendered recipe page) vs. displayed **29** — same
  ballpark, formula structure confirmed, but exact match needs those two
  hidden recipe-level fields.

## Known gap to resolve during M4

`evaporation_rate` and `top_up_water` feed into `boil_size()`, which in turn
feeds `avgBoilGravity()` used only inside the IBU calculation (OG itself uses
`batch_size` directly, unaffected). Neither field is rendered on the public
recipe HTML page or present in the BeerXML export sampled so far. Options for
M4:
1. Check whether other page variants (e.g. `/recipes/<slug>/print`, archived
   per the CDX enumeration) expose these fields.
2. If unrecoverable, default to `evaporation_rate=0, top_up_water=0` (i.e.
   `boil_size == batch_size`) for reproducing historical recipes — introduces
   a small, bounded IBU error (single-digit IBU in the example above), which
   is an acceptable, documented approximation for archived recipes.
3. For the *interactive* calculator (M6, new recipes), both fields are normal
   user inputs, so this gap only affects re-deriving IBU for old archived
   recipes, not the calculator tool going forward.

This module should be implemented as `lib/calculator/formulas.ts` (or `.py`
for the scraper's QA pass) exactly per the pseudocode above, then validated
against a larger golden set of ~20-50 archived recipes as planned for M4.
