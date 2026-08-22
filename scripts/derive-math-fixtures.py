#!/usr/bin/env python3
"""Derive data/math-verified.json: CAS-computed reference values for the
calculation corpus, independent of the shipped TypeScript.

WHY: the TypeScript tests pin functions to reference values, but most of those
values were themselves computed by hand or transcribed from documents. This
script recomputes each one symbolically (SymPy) or at 50-digit precision
(mpmath) — a genuinely independent implementation in a different language on a
different numeric stack — and writes them to a fixture file that
app/lib/math-verified.test.ts holds the shipped code to.

ORACLES. Each fixture records which oracle produced it. The first is "sympy"
(SymPy/mpmath, run by this script). The second is Wolfram, reached through the
Wolfram Language connector: every expression string below is written to be
pasteable into a Wolfram kernel, and the digits Wolfram returned are recorded
verbatim in WOLFRAM_COUNTERSIGNED. This script re-checks that agreement on
every run and only then labels a fixture "sympy+wolfram" — so the second
opinion is reproducible evidence in the repository, not a claim in a commit
message. A value that DISAGREED between the two oracles is a finding, not an
update, and this script fails rather than writing it.

Deterministic: re-running regenerates the file byte-identically.

Run:  python3 scripts/derive-math-fixtures.py
"""
import json
import pathlib
from fractions import Fraction

import mpmath as mp
import sympy as sp

mp.mp.dps = 50  # 50 decimal digits everywhere

OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "math-verified.json"

# Digits returned by the Wolfram Language kernel for each fixture's expression,
# transcribed exactly as printed. Checked against this script's own SymPy/mpmath
# result on every run (see add()). Exact closed forms and exact-by-definition
# unit conversions are expected to agree to full precision; the barrel fixtures
# are two independent numerical integrations (mpmath quad vs Wolfram NIntegrate
# at WorkingPrecision 40) and agree to ~22 significant digits.
WOLFRAM_COUNTERSIGNED = {
    "barrel-total-coefficient": "3.141592653589793238462643",
    "barrel-canonical-total-m3": "0.2269989187777841002383567603022437604",
    "barrel-canonical-fill-0.1": "0.00804349941548237280437597426191016209",
    "barrel-canonical-fill-0.25": "0.04053254208816476901199396619443798838",
    "barrel-canonical-fill-0.5": "0.1134994593888920501191783801511218802",
    "barrel-canonical-fill-0.75": "0.18646637668961933122636279410780577202",
    "barrel-canonical-fill-0.9": "0.21895541936230172743398078604033359831",
    "barrel-stave-profile-model-spread-pct": "0.1169157690087718791",
    "wk-to-lintner-simpsons-244": "74.28571428571428571428571428571428571429",
    "iob-to-wk-ratio": "3.75",
    "bevsense-reduction-to-classic": "4.85014980849530322073373401397418409469",
    "dispense-psig-2.4-38F": "10.21869767441860465116279069767441860465",
    "kegpsi-regression-2.4-38F": "10.196687704",
    "sg-to-plato-1.048": "11.912080756224",
    "chaptalise-20L-1.045-to-1.090-grams": "2746.92793715490789547789846078752443153018",
    "us-gallon-litres": "3.785411784",
    "avoirdupois-pound-grams": "453.59237",
    "avoirdupois-ounce-grams": "28.349523125",
    "us-fluid-ounce-millilitres": "29.5735295625",
    "standard-atmosphere-psi": "14.69594877551344872550347215715472968922",
    "ethanol-density-g-per-ml": "0.789",
}

# How closely the two oracles must agree, as a relative difference. Two exact
# computations agree to the full 50 digits; the numerically integrated barrel
# fixtures are held to 1e-18, still nine orders tighter than the tolerance the
# shipped TypeScript is allowed.
ORACLE_AGREEMENT = mp.mpf("1e-18")

fixtures = []


def add(fid, expression, value, note, tol=1e-9):
    value = mp.mpf(value)
    oracle = "sympy"
    entry = {
        "id": fid,
        "expression": expression,
        "value": mp.nstr(value, 25),
        "oracle": oracle,
        "toleranceForTs": tol,
        "note": note,
    }
    countersigned = WOLFRAM_COUNTERSIGNED.get(fid)
    if countersigned is not None:
        w = mp.mpf(countersigned)
        scale = max(abs(w), mp.mpf(1))
        delta = abs(value - w) / scale
        if delta > ORACLE_AGREEMENT:
            raise SystemExit(
                f"ORACLE DISAGREEMENT on {fid}: sympy {mp.nstr(value, 30)} vs "
                f"wolfram {countersigned} (relative {mp.nstr(delta, 5)}). This is a finding — "
                "investigate which oracle is wrong before touching this file."
            )
        entry["oracle"] = "sympy+wolfram"
        entry["wolframValue"] = countersigned
    fixtures.append(entry)


# --- Barrel geometry (lib/barrel.ts) ----------------------------------------
#
# The barrel is a solid of revolution with the classical parabolic stave
# profile r(x) = Rh + (Rb - Rh)(1 - (2x/L)^2): head radius Rh at each end,
# bilge radius Rb at the middle. This is the Kepler-tradition gauging model.

x, L, Rb, Rh = sp.symbols("x L R_b R_h", positive=True)
profile = Rh + (Rb - Rh) * (1 - (2 * x / L) ** 2)
V_total = sp.simplify(sp.integrate(sp.pi * profile**2, (x, -L / 2, L / 2)))
expected_form = sp.pi * L * (8 * Rb**2 + 4 * Rb * Rh + 3 * Rh**2) / 15
assert sp.simplify(V_total - expected_form) == 0, "closed form does not match"
assert sp.simplify(V_total.subs(Rh, Rb) - sp.pi * L * Rb**2) == 0, "cylinder degenerate case"

add(
    "barrel-total-coefficient",
    "Integrate[Pi*(Rh + (Rb - Rh)*(1 - (2*x/L)^2))^2, {x, -L/2, L/2}] == Pi*L*(8*Rb^2 + 4*Rb*Rh + 3*Rh^2)/15; value is the coefficient sum at Rb=1, Rh=1, L=1: 15/15",
    mp.mpf(1) * mp.pi,
    "The closed-form total volume of the parabolic-stave barrel, verified symbolically: "
    "V = piL(8Rb^2 + 4RbRh + 3Rh^2)/15. At Rb=Rh=L=1 it must equal a unit cylinder, pi.",
)

# A canonical test barrel used across the TS tests: L=0.8 m, Rb=0.32, Rh=0.26.
CANON = dict(L=mp.mpf("0.8"), Rb=mp.mpf("0.32"), Rh=mp.mpf("0.26"))
canon_total = (
    mp.pi * CANON["L"] * (8 * CANON["Rb"] ** 2 + 4 * CANON["Rb"] * CANON["Rh"] + 3 * CANON["Rh"] ** 2) / 15
)
add(
    "barrel-canonical-total-m3",
    "Pi*0.8*(8*0.32^2 + 4*0.32*0.26 + 3*0.26^2)/15",
    canon_total,
    "Total volume in m^3 of the canonical test barrel (L=0.8 m, Rb=0.32 m, Rh=0.26 m).",
)


def segment_area(r, depth):
    """Area of a circular segment of radius r filled to `depth` from the bottom."""
    if depth <= 0:
        return mp.mpf(0)
    if depth >= 2 * r:
        return mp.pi * r * r
    return r * r * mp.acos((r - depth) / r) - (r - depth) * mp.sqrt(2 * r * depth - depth * depth)


def partial_volume(h, L_, Rb_, Rh_):
    """Liquid volume at height h above the lowest point of the bilge, horizontal barrel.

    The axis sits at height Rb; the cross-section at axial position u has radius
    r(u) and its lowest point at height Rb - r(u), so its local depth is
    h - (Rb - r(u)). Integrated with mpmath's adaptive quadrature at 50 digits.
    """

    def slice_area(u):
        r = Rh_ + (Rb_ - Rh_) * (1 - (2 * u / L_) ** 2)
        return segment_area(r, h - (Rb_ - r))

    return mp.quad(slice_area, [-L_ / 2, 0, L_ / 2])


for frac in ("0.1", "0.25", "0.5", "0.75", "0.9"):
    h = mp.mpf(frac) * 2 * CANON["Rb"]
    v = partial_volume(h, CANON["L"], CANON["Rb"], CANON["Rh"])
    add(
        f"barrel-canonical-fill-{frac}",
        f"NIntegrate over x in [-0.4, 0.4] of the circular-segment area of radius "
        f"r(x) = 0.26 + 0.06*(1 - (x/0.4)^2) at liquid height h = {mp.nstr(h, 6)} m above the bilge bottom",
        v,
        f"Partial volume (m^3) of the canonical barrel filled to {frac} of its bilge diameter. "
        "The TS Simpson integrator must reproduce this.",
        tol=5e-7,
    )

# Exact identity: half-full is exactly half, because every cross-section is a
# circle centred on the axis. The quadrature must agree with the closed form.
half = partial_volume(CANON["Rb"], CANON["L"], CANON["Rb"], CANON["Rh"])
assert abs(half - canon_total / 2) < mp.mpf("1e-40"), "half-full identity failed in the oracle itself"

# How much does the CHOICE of stave curve matter? Coopers bend staves, and the
# gauging tradition models the bend as a parabola; the other classical choice is
# a circular arc through the same head and bilge radii. The gap between the two
# is the model's own uncertainty, and it deserves a number rather than a
# hand-wave, because the card quotes it. Arc radius from the sagitta relation:
# R = ((Rb - Rh)^2 + (L/2)^2) / (2(Rb - Rh)).
sag = CANON["Rb"] - CANON["Rh"]
arc_R = (sag**2 + (CANON["L"] / 2) ** 2) / (2 * sag)
v_circular = mp.quad(
    lambda x: mp.pi * (CANON["Rb"] - arc_R + mp.sqrt(arc_R**2 - x**2)) ** 2,
    [-CANON["L"] / 2, 0, CANON["L"] / 2],
)
add(
    "barrel-stave-profile-model-spread-pct",
    "100*(NIntegrate[Pi*(rb - R + Sqrt[R^2 - x^2])^2, {x, -L/2, L/2}] - Pi*L*(8rb^2+4rb*rh+3rh^2)/15) "
    "/ (Pi*L*(8rb^2+4rb*rh+3rh^2)/15) with R = ((rb-rh)^2 + (L/2)^2)/(2(rb-rh)), rb=0.32, rh=0.26, L=0.8",
    100 * (v_circular - canon_total) / canon_total,
    "Percentage by which a circular-arc stave profile exceeds the parabolic one on the canonical "
    "barrel: 0.117%, about a quarter of a litre on 227 L. This is the gauging model's own "
    "uncertainty — smaller than one centimetre of dipstick reading — and the barrel card quotes it.",
    tol=1e-6,
)

# --- Diastatic power scales (lib/diastatic-power.ts) ------------------------
add(
    "wk-to-lintner-simpsons-244",
    "(244 + 16)/3.5",
    mp.mpf(244 + 16) / mp.mpf("3.5"),
    "Simpsons publishes Golden Promise at 150-244 WK and 47-74 Lintner; (244+16)/3.5 must land on ~74.3.",
)
add(
    "iob-to-wk-ratio",
    "150/40",
    mp.mpf(150) / 40,
    "The IoB-to-WK ratio, exact on all four Simpsons pairs: 3.75.",
)

# --- Carbonation (lib/draft-line.ts, lib/brewing-calcs.ts) ------------------
add(
    "bevsense-reduction-to-classic",
    "5.16/(1.015*(1 + 0.038/0.789))",
    mp.mpf("5.16") / (mp.mpf("1.015") * (1 + mp.mpf("0.038") / mp.mpf("0.789"))),
    "The Dynamic Henry's Law relation at the 1949 ASBC chart calibration collapses to the "
    "classic constant: must be 4.850 to three decimals.",
)
add(
    "dispense-psig-2.4-38F",
    "2.4*(38 + 12.4)*(1.015 + 0.048)/5.16 - 14.7",
    mp.mpf("2.4") * (38 + mp.mpf("12.4")) * (mp.mpf("1.015") + mp.mpf("0.048")) / mp.mpf("5.16") - mp.mpf("14.7"),
    "Standard-beer gauge pressure for 2.4 volumes at 38 F, with ABW derived from ABV as the "
    "shipped default does: SG*(1 + ABW/0.789) with ABW = (ABV/100)*0.789/SG collapses exactly to "
    "SG + ABV/100. DBQM Table 3.3 prints 10.3.",
)
kegpsi = (
    mp.mpf("-16.6999")
    - mp.mpf("0.0101059") * 38
    + mp.mpf("0.00116512") * 38 * 38
    + mp.mpf("0.173354") * 38 * mp.mpf("2.4")
    + mp.mpf("4.24267") * mp.mpf("2.4")
    - mp.mpf("0.0684226") * mp.mpf("2.4") ** 2
)
add(
    "kegpsi-regression-2.4-38F",
    "-16.6999 - 0.0101059*38 + 0.00116512*38^2 + 0.173354*38*2.4 + 4.24267*2.4 - 0.0684226*2.4^2",
    kegpsi,
    "The kegPsi regression recomputed independently — guards against coefficient typos in the TS.",
)

# --- Gravity/Plato (lib/brewing-calcs.ts) -----------------------------------
add(
    "sg-to-plato-1.048",
    "-616.868 + 1111.14*1.048 - 630.272*1.048^2 + 135.997*1.048^3",
    mp.mpf("-616.868") + mp.mpf("1111.14") * mp.mpf("1.048") - mp.mpf("630.272") * mp.mpf("1.048") ** 2 + mp.mpf("135.997") * mp.mpf("1.048") ** 3,
    "The ASBC cubic at the classic 1.048 reference point.",
)

# --- Chaptalisation (lib/must.ts) -------------------------------------------
# Raise 20 L of 1.045 to 1.090, accounting for the ~0.625 mL/g the dissolved
# sugar itself occupies. Solved symbolically over the RATIONALS end to end —
# an earlier version of this script cast through float() mid-solve and lost
# precision below the 12th digit, which is exactly the sort of quiet leak a
# second oracle exists to catch: Wolfram returned the closed rational
# 1316880000/479401 and the two no longer matched past 1e-12.
P = sp.Rational(46) / (sp.Rational(453592, 1000) / sp.Rational(378541, 100000))  # points per g/L
cur = (sp.Rational(45, 1000) * 1000 / P) * 20
conc = sp.Rational(90, 1000) * 1000 / P
xg = sp.symbols("x_g", positive=True)
sugar_exact = sp.solve(
    sp.Eq((cur + xg) / (20 + sp.Rational(625, 1000000) * xg), conc), xg
)[0]
# Both computer-algebra systems reduce this to the same rational, exactly.
assert Fraction(int(sp.numer(sugar_exact)), int(sp.denom(sugar_exact))) == Fraction(
    1316880000, 479401
), f"chaptalisation rational disagrees with Wolfram: {sugar_exact}"
sugar_g = mp.mpf(sp.numer(sugar_exact)) / mp.mpf(sp.denom(sugar_exact))
add(
    "chaptalise-20L-1.045-to-1.090-grams",
    "Solve[(cur + x)/(20 + 0.000625 x) == conc, x] with cur = 45*20/P, conc = 90/P, P = 46/(453.592/3.78541); exact rational 1316880000/479401",
    sugar_g,
    "Sugar in grams to raise 20 L from 1.045 to 1.090 including the volume the sugar adds. "
    "Both oracles reduce it to the exact rational 1316880000/479401. The TS chaptalise() must "
    "agree; the naive answer ignoring displacement is ~15% low.",
    tol=1e-6,
)

# --- Unit conversions (lib/units.ts) ----------------------------------------
# Exact by definition (international yard and pound, 1959), and therefore
# checkable to the last digit rather than to a tolerance. These are the
# constants every volume and weight in the app is scaled by, so an error here
# would be silent and everywhere at once.
gallon_l = sp.Rational(231) * sp.Rational(254, 100) ** 3 / 1000
add(
    "us-gallon-litres",
    "231 * (2.54 cm)^3 / 1000  ==  UnitConvert[Quantity[1, \"Gallons\"], \"Liters\"]",
    mp.mpf(sp.numer(gallon_l)) / mp.mpf(sp.denom(gallon_l)),
    "Litres in one US liquid gallon, exact by the 1959 definition: L_PER_GALLON in lib/units.ts.",
    tol=1e-12,
)
add(
    "avoirdupois-pound-grams",
    'UnitConvert[Quantity[1, "Pounds"], "Grams"]',
    mp.mpf("453.59237"),
    "Grams in one avoirdupois pound, exact by definition: KG_PER_LB in lib/units.ts.",
    tol=1e-12,
)
add(
    "avoirdupois-ounce-grams",
    '453.59237/16  ==  UnitConvert[Quantity[1, "Ounces"], "Grams"]',
    mp.mpf("453.59237") / 16,
    "Grams in one avoirdupois ounce, exact: G_PER_OZ in lib/units.ts.",
    tol=1e-12,
)
add(
    "us-fluid-ounce-millilitres",
    '231 * 2.54^3 / 128  ==  UnitConvert[Quantity[1, "FluidOunces"], "Milliliters"]',
    (mp.mpf(sp.numer(gallon_l)) / mp.mpf(sp.denom(gallon_l))) * 1000 / 128,
    "Millilitres in one US fluid ounce, exact — the unit the draught-line card reports the "
    "beer standing in the line in.",
    tol=1e-12,
)
add(
    "standard-atmosphere-psi",
    'UnitConvert[Quantity[1, "Atmospheres"], "PoundsForce"/"Inches"^2]',
    mp.mpf(101325) / (mp.mpf("4.4482216152605") / (mp.mpf("2.54") ** 2 / 10000)),
    "One standard atmosphere in psi: 14.6959. The carbonation code uses the ASBC's conventional "
    "14.7 psia at sea level, which is this rounded — a 0.04 psi convention, not an error, and "
    "recorded here so the difference is visible rather than assumed.",
    tol=1e-9,
)
add(
    "ethanol-density-g-per-ml",
    'Entity["Chemical", "Ethanol"]["Density"] in g/mL',
    mp.mpf("0.789"),
    "Ethanol density at room temperature, the 0.789 g/mL constant in the Dynamic Henry's Law "
    "ABW/ABV relation. A rounded physical measurement, not a definition: Wolfram's chemical "
    "data returns the same 0.789 the BevSense method uses.",
    tol=1e-3,
)

# --- Write ------------------------------------------------------------------
doc = {
    "generated": "by scripts/derive-math-fixtures.py — do not edit values by hand; re-run the script",
    "note": (
        "Independently derived reference values for the calculation corpus. Each value was computed "
        "symbolically (SymPy) or at 50-digit precision (mpmath) from the stated expression — a second "
        "implementation in a different language on a different numeric stack from the shipped "
        "TypeScript, which app/lib/math-verified.test.ts pins to these values. The `oracle` field "
        "records who has computed each value. Entries reading sympy+wolfram were also evaluated in a "
        "Wolfram Language kernel; `wolframValue` is what it returned, transcribed verbatim, and the "
        "generating script re-checks that agreement on every run and refuses to write a file where "
        "the two oracles disagree. A value that CHANGED under a second oracle is a finding to "
        "investigate, never a quiet update."
    ),
    "fixtures": fixtures,
}
OUT.write_text(json.dumps(doc, indent=1) + "\n")
print(f"wrote {OUT} — {len(fixtures)} fixtures")
for f in fixtures:
    print(f"  {f['id']:38s} {f['value'][:24]}")
