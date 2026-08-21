#!/usr/bin/env python3
"""Derive data/math-verified.json: CAS-computed reference values for the
calculation corpus, independent of the shipped TypeScript.

WHY: the TypeScript tests pin functions to reference values, but most of those
values were themselves computed by hand or transcribed from documents. This
script recomputes each one symbolically (SymPy) or at 50-digit precision
(mpmath) — a genuinely independent implementation in a different language on a
different numeric stack — and writes them to a fixture file that
app/lib/math-verified.test.ts holds the shipped code to.

ORACLES. Each fixture records which oracle produced it. Today that is "sympy"
(SymPy/mpmath, run by this script). The Wolfram Alpha connector, when
connected, countersigns the same fixtures — the expression strings below are
written to be pasteable into Wolfram — upgrading `oracle` to "sympy+wolfram"
WITHOUT any value changing. A value that changed under a second oracle would be
a finding, not an update.

Deterministic: re-running regenerates the file byte-identically.

Run:  python3 scripts/derive-math-fixtures.py
"""
import json
import pathlib

import mpmath as mp
import sympy as sp

mp.mp.dps = 50  # 50 decimal digits everywhere

OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "math-verified.json"

fixtures = []


def add(fid, expression, value, note, tol=1e-9):
    fixtures.append(
        {
            "id": fid,
            "expression": expression,
            "value": mp.nstr(mp.mpf(value), 25),
            "oracle": "sympy",
            "toleranceForTs": tol,
            "note": note,
        }
    )


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
# sugar itself occupies. Solved symbolically, not by the TS formula.
P = mp.mpf(46) / (mp.mpf("453.592") / mp.mpf("3.78541"))  # points per g/L
cur = (mp.mpf("0.045") * 1000 / P) * 20
conc = mp.mpf("0.090") * 1000 / P
xg = sp.symbols("x_g", positive=True)
sol = sp.solve(
    sp.Eq((sp.Rational(1) * float(cur) + xg) / (20 + sp.Rational(625, 1000000) * xg), float(conc)), xg
)
sugar_g = mp.mpf(str(sp.nsimplify(sol[0], rational=False)))
add(
    "chaptalise-20L-1.045-to-1.090-grams",
    "Solve[(cur + x)/(20 + 0.000625 x) == conc, x] with cur = 45*20/P, conc = 90/P, P = 46/(453.592/3.78541)",
    sugar_g,
    "Sugar in grams to raise 20 L from 1.045 to 1.090 including the volume the sugar adds. "
    "The TS chaptalise() must agree; the naive answer ignoring displacement is ~15% low.",
    tol=1e-6,
)

# --- Write ------------------------------------------------------------------
doc = {
    "generated": "by scripts/derive-math-fixtures.py — do not edit values by hand; re-run the script",
    "note": (
        "Independently derived reference values for the calculation corpus. Each value was computed "
        "symbolically (SymPy) or at 50-digit precision (mpmath) from the stated expression — a second "
        "implementation in a different language on a different numeric stack from the shipped "
        "TypeScript, which app/lib/math-verified.test.ts pins to these values. The `oracle` field "
        "records who has computed each value; when the Wolfram Alpha connector is available, the same "
        "expressions are evaluated there and agreeing entries are upgraded to sympy+wolfram. A value "
        "that CHANGED under a second oracle is a finding to investigate, never a quiet update."
    ),
    "fixtures": fixtures,
}
OUT.write_text(json.dumps(doc, indent=1) + "\n")
print(f"wrote {OUT} — {len(fixtures)} fixtures")
for f in fixtures:
    print(f"  {f['id']:38s} {f['value'][:24]}")
