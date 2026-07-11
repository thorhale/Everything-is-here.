"""Parse an archived Brewtoad BeerXML export into a normalized dict.

Used as a cross-check against the HTML parser's extracted ingredient line
items (fermentables/hops/yeasts), and as a fallback source of clean brewer
attribution (<BREWER>) and batch/boil size (in liters) when the HTML page
is missing or low-confidence.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from bs4 import BeautifulSoup


@dataclass
class XmlFermentable:
    name: str
    origin: str | None
    type: str | None
    amount_kg: float | None
    potential: float | None
    color_srm: float | None


@dataclass
class XmlHop:
    name: str
    alpha: float | None
    amount_kg: float | None
    use: str | None
    form: str | None
    time_minutes: float | None


@dataclass
class XmlYeast:
    name: str
    laboratory: str | None
    attenuation: float | None
    form: str | None


@dataclass
class ParsedXmlRecipe:
    slug: str
    name: str | None = None
    style_name: str | None = None
    brewer: str | None = None
    batch_size_liters: float | None = None
    boil_size_liters: float | None = None
    boil_time_minutes: float | None = None
    efficiency_pct: float | None = None
    fermentables: list[XmlFermentable] = field(default_factory=list)
    hops: list[XmlHop] = field(default_factory=list)
    yeasts: list[XmlYeast] = field(default_factory=list)
    parse_warnings: list[str] = field(default_factory=list)


def _float(el) -> float | None:
    if el is None or not el.string:
        return None
    try:
        return float(el.string.strip())
    except ValueError:
        return None


def _text(el) -> str | None:
    if el is None or not el.string:
        return None
    return el.string.strip() or None


def parse_recipe_xml(slug: str, xml: bytes | str) -> ParsedXmlRecipe:
    soup = BeautifulSoup(xml, "lxml-xml")
    recipe_el = soup.find("RECIPE")
    result = ParsedXmlRecipe(slug=slug)
    if not recipe_el:
        result.parse_warnings.append("no <RECIPE> element found")
        return result

    result.name = _text(recipe_el.find("NAME"))
    style_el = recipe_el.find("STYLE")
    if style_el:
        result.style_name = _text(style_el.find("NAME"))
    result.brewer = _text(recipe_el.find("BREWER"))
    result.batch_size_liters = _float(recipe_el.find("BATCH_SIZE"))
    result.boil_size_liters = _float(recipe_el.find("BOIL_SIZE"))
    result.boil_time_minutes = _float(recipe_el.find("BOIL_TIME"))
    result.efficiency_pct = _float(recipe_el.find("EFFICIENCY"))

    fermentables_el = recipe_el.find("FERMENTABLES")
    if fermentables_el:
        for f in fermentables_el.find_all("FERMENTABLE"):
            result.fermentables.append(
                XmlFermentable(
                    name=_text(f.find("NAME")) or "",
                    origin=_text(f.find("ORIGIN")),
                    type=_text(f.find("TYPE")),
                    amount_kg=_float(f.find("AMOUNT")),
                    potential=_float(f.find("POTENTIAL")),
                    color_srm=_float(f.find("COLOR")),
                )
            )
    else:
        result.parse_warnings.append("no <FERMENTABLES> element found")

    hops_el = recipe_el.find("HOPS")
    if hops_el:
        for h in hops_el.find_all("HOP"):
            result.hops.append(
                XmlHop(
                    name=_text(h.find("NAME")) or "",
                    alpha=_float(h.find("ALPHA")),
                    amount_kg=_float(h.find("AMOUNT")),
                    use=_text(h.find("USE")),
                    form=_text(h.find("FORM")),
                    time_minutes=_float(h.find("TIME")),
                )
            )

    yeasts_el = recipe_el.find("YEASTS")
    if yeasts_el:
        for y in yeasts_el.find_all("YEAST"):
            result.yeasts.append(
                XmlYeast(
                    name=_text(y.find("NAME")) or "",
                    laboratory=_text(y.find("LABORATORY")),
                    attenuation=_float(y.find("ATTENUATION")),
                    form=_text(y.find("FORM")),
                )
            )

    return result
