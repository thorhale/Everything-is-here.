"""Parse an archived Brewtoad recipe HTML page into a normalized dict.

Targets the markup confirmed present in December-2018 snapshots (Rails app,
server-rendered, no JS required):
  - div.recipe-show--stats -> div.horizontal-bar-graph{.value,.label} for OG/FG/IBU/SRM/ABV
  - div.recipe-show--notes -> free-text brewer notes (often a pasted export from
    other brewing software - kept as opaque text, not parsed further)
  - div.recipe-show--ingredients -> h3 headers + table#fermentables/#hops/#yeasts
  - div.soft > h3"Stats" -> batch size/boil time/efficiency/primary+secondary
    days/IBU formula (BrewToad's own computed values, distinct from whatever a
    brewer may have pasted into the free-text notes)
  - ol.recipe-comments-list -> per-comment li (commenter + text), if any

Every extracted field is optional (`None` when missing) - callers should treat
a low proportion of populated fields as a low-confidence parse and route it to
manual review rather than silently ingesting incomplete data.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from bs4 import BeautifulSoup

STAT_LABEL_MAP = {
    "OG": "og",
    "FG": "fg",
    "IBU": "ibu",
    "SRM": "srm",
    "ABV": "abv",
}


@dataclass
class ParsedFermentable:
    amount_display: str | None
    percent: str | None
    name: str
    maltster: str | None
    use: str | None
    ppg: str | None
    color_lovibond: str | None
    ref_url: str | None


@dataclass
class ParsedHop:
    amount_display: str | None
    name: str
    time_display: str | None
    use: str | None
    form: str | None
    alpha_acid: str | None
    ref_url: str | None


@dataclass
class ParsedYeast:
    name: str
    lab_product: str | None
    attenuation: str | None
    ref_url: str | None


@dataclass
class ParsedComment:
    comment_id: str | None
    commenter: str | None
    commenter_profile_url: str | None
    timestamp_display: str | None
    text: str
    parent_comment_id: str | None


@dataclass
class ParsedRecipe:
    slug: str
    title: str | None
    style: str | None
    og: str | None = None
    fg: str | None = None
    ibu: str | None = None
    srm: str | None = None
    abv: str | None = None
    batch_size_display: str | None = None
    boil_time_display: str | None = None
    efficiency_display: str | None = None
    ibu_formula: str | None = None
    notes_text: str | None = None
    fermentables: list[ParsedFermentable] = field(default_factory=list)
    hops: list[ParsedHop] = field(default_factory=list)
    yeasts: list[ParsedYeast] = field(default_factory=list)
    comments: list[ParsedComment] = field(default_factory=list)
    parse_warnings: list[str] = field(default_factory=list)

    @property
    def parse_confidence(self) -> float:
        """Rough 0-1 score: fraction of the fields we expect to usually be
        present that actually came through non-empty. Not a precise measure,
        just enough to bucket recipes for manual review."""
        checks = [
            self.title is not None,
            self.style is not None,
            self.og is not None,
            self.ibu is not None,
            self.abv is not None,
            len(self.fermentables) > 0,
            len(self.hops) > 0,
        ]
        return sum(checks) / len(checks)


def _text(el) -> str | None:
    if el is None:
        return None
    t = el.get_text(" ", strip=True)
    t = re.sub(r"\s+", " ", t).strip()
    return t or None


def _parse_title_style(soup: BeautifulSoup) -> tuple[str | None, str | None]:
    title_el = soup.find("title")
    if not title_el or not title_el.string:
        return None, None
    raw = title_el.get_text(strip=True)
    # e.g. "2 row vienna lager, a Vienna Lager homebrew beer recipe | Brewtoad"
    m = re.match(r"^(.*?),\s*a\s+(.+?)\s+homebrew beer recipe\s*\|", raw)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return raw.split("|")[0].strip() or None, None


def _parse_stats(soup: BeautifulSoup, recipe: ParsedRecipe) -> None:
    stats_div = soup.find("div", class_="recipe-show--stats")
    if not stats_div:
        recipe.parse_warnings.append("missing recipe-show--stats block")
        return
    for graph in stats_div.find_all("div", class_="horizontal-bar-graph"):
        label_el = graph.find("div", class_="label")
        value_el = graph.find("div", class_="value")
        label = _text(label_el)
        value = _text(value_el)
        if label in STAT_LABEL_MAP and value is not None:
            setattr(recipe, STAT_LABEL_MAP[label], value)


def _parse_notes(soup: BeautifulSoup, recipe: ParsedRecipe) -> None:
    notes_div = soup.find("div", class_="recipe-show--notes")
    if not notes_div:
        return
    markdown_div = notes_div.find("div", class_="markdown")
    recipe.notes_text = _text(markdown_div)


def _parse_extended_stats(soup: BeautifulSoup, recipe: ParsedRecipe) -> None:
    """The '<h3>Stats</h3> ... More stats...' block distinct from the top
    OG/FG/IBU/SRM/ABV bar graphs - carries batch size, boil time, efficiency,
    and BrewToad's own selected IBU formula."""
    stats_header = None
    for h3 in soup.find_all("h3"):
        if _text(h3) == "Stats":
            stats_header = h3
            break
    if not stats_header:
        return
    container = stats_header.parent
    if not container:
        return

    for li in container.find_all("li"):
        small = li.find("small")
        if not small:
            continue
        label = _text(small)
        value = _text(li) or ""
        value = value.replace(label or "", "", 1).strip() if label else value
        if label == "Batch Size":
            recipe.batch_size_display = value
        elif label == "Boil Time":
            recipe.boil_time_display = value
        elif label == "Efficiency":
            recipe.efficiency_display = value
        elif label == "IBU Formula":
            recipe.ibu_formula = value


def _parse_ingredient_table(soup: BeautifulSoup, table_id: str):
    table = soup.find("table", id=table_id)
    if not table:
        return []
    tbody = table.find("tbody")
    if not tbody:
        return []
    return tbody.find_all("tr")


def _parse_fermentables(soup: BeautifulSoup, recipe: ParsedRecipe) -> None:
    rows = _parse_ingredient_table(soup, "fermentables")
    if not rows:
        recipe.parse_warnings.append("no fermentables rows found")
    for row in rows:
        cells = row.find_all("td")
        if len(cells) < 6:
            recipe.parse_warnings.append("fermentables row with unexpected column count")
            continue
        amount_cell, name_cell, maltster_cell, use_cell, ppg_cell, color_cell = cells[:6]
        span = amount_cell.find("span")
        amount_display = _text(span) or _text(amount_cell)
        percent = span.get("title") if span else None
        link = name_cell.find("a")
        name = _text(link) if link else _text(name_cell)
        ref_url = link.get("href") if link else None
        recipe.fermentables.append(
            ParsedFermentable(
                amount_display=amount_display,
                percent=percent,
                name=name or "",
                maltster=_text(maltster_cell),
                use=_text(use_cell),
                ppg=_text(ppg_cell),
                color_lovibond=_text(color_cell),
                ref_url=ref_url,
            )
        )


def _parse_hops(soup: BeautifulSoup, recipe: ParsedRecipe) -> None:
    rows = _parse_ingredient_table(soup, "hops")
    if not rows:
        recipe.parse_warnings.append("no hops rows found")
    for row in rows:
        cells = row.find_all("td")
        if len(cells) < 6:
            recipe.parse_warnings.append("hops row with unexpected column count")
            continue
        amount_cell, name_cell, time_cell, use_cell, form_cell, aa_cell = cells[:6]
        link = name_cell.find("a")
        name = _text(link) if link else _text(name_cell)
        ref_url = link.get("href") if link else None
        recipe.hops.append(
            ParsedHop(
                amount_display=_text(amount_cell),
                name=name or "",
                time_display=_text(time_cell),
                use=_text(use_cell),
                form=_text(form_cell),
                alpha_acid=_text(aa_cell),
                ref_url=ref_url,
            )
        )


def _parse_yeasts(soup: BeautifulSoup, recipe: ParsedRecipe) -> None:
    rows = _parse_ingredient_table(soup, "yeasts")
    for row in rows:
        cells = row.find_all("td")
        if len(cells) < 3:
            recipe.parse_warnings.append("yeasts row with unexpected column count")
            continue
        name_cell, lab_cell, atten_cell = cells[:3]
        link = name_cell.find("a")
        name = _text(link) if link else _text(name_cell)
        ref_url = link.get("href") if link else None
        recipe.yeasts.append(
            ParsedYeast(
                name=name or "",
                lab_product=_text(lab_cell),
                attenuation=_text(atten_cell),
                ref_url=ref_url,
            )
        )


def _comment_id(li) -> str | None:
    raw_id = li.get("id")  # e.g. "recipe-comment-18811"
    if raw_id and raw_id.startswith("recipe-comment-"):
        return raw_id[len("recipe-comment-"):]
    return raw_id


def _parse_comments(soup: BeautifulSoup, recipe: ParsedRecipe) -> None:
    comment_list = soup.find("ol", class_="recipe-comments-list")
    if not comment_list:
        return
    # Comments are threaded (<ol class="comment-replies"> nested inside a
    # parent <li>), but every comment - top-level or reply - carries its own
    # id/author/time/body, so a flat find_all recovers every individual
    # comment; parent_comment_id preserves the thread structure for later.
    for li in comment_list.find_all("li", class_="recipe-comment"):
        body = li.find("div", class_="recipe-comment-body")
        text = _text(body)
        if not text:
            continue
        author_el = li.find("strong", class_="recipe-comment-author")
        author_link = author_el.find("a") if author_el else None
        time_el = li.find("small", class_="recipe-comment-time")

        parent_li = li.find_parent("li", class_="recipe-comment")
        recipe.comments.append(
            ParsedComment(
                comment_id=_comment_id(li),
                commenter=_text(author_link) if author_link else _text(author_el),
                commenter_profile_url=author_link.get("href") if author_link else None,
                timestamp_display=_text(time_el),
                text=text,
                parent_comment_id=_comment_id(parent_li) if parent_li else None,
            )
        )


def parse_recipe_html(slug: str, html: bytes | str) -> ParsedRecipe:
    soup = BeautifulSoup(html, "lxml")
    title, style = _parse_title_style(soup)
    recipe = ParsedRecipe(slug=slug, title=title, style=style)

    error_title = soup.find(class_="error-title")
    if error_title and "croaked" in _text(error_title).lower():
        recipe.parse_warnings.append("page is a Brewtoad error page (recipe missing/private)")
        return recipe

    _parse_stats(soup, recipe)
    _parse_notes(soup, recipe)
    _parse_extended_stats(soup, recipe)
    _parse_fermentables(soup, recipe)
    _parse_hops(soup, recipe)
    _parse_yeasts(soup, recipe)
    _parse_comments(soup, recipe)
    return recipe
