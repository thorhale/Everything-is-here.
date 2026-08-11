// Unit conversions, defined once.
//
// These were spread across three modules under three naming conventions —
// L_PER_GALLON in brewing-calcs, GAL_TO_L in must, GAL_TO_L again in beerxml;
// G_PER_OZ in one place and OZ_TO_G in another — for five physical constants
// and eight definitions. They all agreed, which is the only reason nothing had
// gone wrong yet. Constants that mean the same thing and live in different
// files stay equal exactly as long as nobody edits one of them.
//
// This module is a leaf: it imports nothing, so it can be pulled in from
// anywhere without risking an import cycle. Each original module still exports
// its own familiar name, re-exported from here, so no caller had to change.
//
// Values are exact by definition (international yard and pound, 1959).

/** Litres in one US liquid gallon. Exact: 231 in³ x (2.54 cm)³ / 1000. */
export const L_PER_GALLON = 3.785411784;
/** Millilitres in one US liquid gallon. */
export const ML_PER_GALLON = 3785.411784;
/** Grams in one avoirdupois ounce. Exact. */
export const G_PER_OZ = 28.349523125;
/** Kilograms in one avoirdupois pound. Exact. */
export const KG_PER_LB = 0.45359237;
/** Kilograms in one avoirdupois ounce. Exact. */
export const KG_PER_OZ = 0.028349523125;

