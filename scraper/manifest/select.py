"""Pick the best snapshot per canonical recipe URL from raw CDX rows.

Groups CDX rows by canonical recipe (base HTML page + its .xml BeerXML
sibling, if any), then for each picks the snapshot closest to the December
2018 mass-crawl window (richest/most-final data), falling back to the
nearest earlier 200-status capture.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass

RECIPE_HTML_RE = re.compile(r'^com,brewtoad\)/recipes/([^/?"\']+)$')
RECIPE_XML_RE = re.compile(r'^com,brewtoad\)/recipes/([^/?"\']+)\.xml$')

# Prefer snapshots on/before this timestamp (the known good mass-crawl window
# ran through mid-to-late December 2018); still accept snapshots after this
# if it's all that's available for a given recipe.
PREFERRED_WINDOW_START = "20181201000000"
PREFERRED_WINDOW_END = "20181231235959"

# Hard cutoff: brewtoad.com shut down 2018-12-31 and the domain was later
# squatted/parked, which the Wayback crawler still occasionally re-visits
# (observed captures as late as 2025) - those are parking-page content, not
# real recipes, so they must never be selectable as a "best" snapshot even
# as a last-resort fallback. Generous grace period past shutdown in case a
# CDN edge served real content into early 2019.
MAX_VALID_TIMESTAMP = "20190601000000"


@dataclass
class RecipeManifestEntry:
    slug: str
    html_url: str | None
    html_timestamp: str | None
    xml_url: str | None
    xml_timestamp: str | None


def _best_row(rows: list[dict]) -> dict | None:
    ok_rows = [
        r for r in rows
        if r["statuscode"] == "200" and r["timestamp"] <= MAX_VALID_TIMESTAMP
    ]
    if not ok_rows:
        return None
    in_window = [
        r for r in ok_rows if PREFERRED_WINDOW_START <= r["timestamp"] <= PREFERRED_WINDOW_END
    ]
    pool = in_window if in_window else ok_rows
    # Latest timestamp within the chosen pool - most "final" state of the recipe.
    return max(pool, key=lambda r: r["timestamp"])


def build_manifest(cdx_jsonl_paths: list[str]) -> list[RecipeManifestEntry]:
    html_rows: dict[str, list[dict]] = {}
    xml_rows: dict[str, list[dict]] = {}

    for path in cdx_jsonl_paths:
        with open(path, encoding="utf-8") as f:
            for line in f:
                row = json.loads(line)
                if row.get("mimetype") not in ("text/html", "application/xml"):
                    continue
                m_html = RECIPE_HTML_RE.match(row["urlkey"])
                if m_html and row["mimetype"] == "text/html":
                    html_rows.setdefault(m_html.group(1), []).append(row)
                    continue
                m_xml = RECIPE_XML_RE.match(row["urlkey"])
                if m_xml and row["mimetype"] == "application/xml":
                    xml_rows.setdefault(m_xml.group(1), []).append(row)

    slugs = set(html_rows) | set(xml_rows)
    manifest = []
    for slug in sorted(slugs):
        best_html = _best_row(html_rows.get(slug, []))
        best_xml = _best_row(xml_rows.get(slug, []))
        manifest.append(
            RecipeManifestEntry(
                slug=slug,
                html_url=best_html["original"] if best_html else None,
                html_timestamp=best_html["timestamp"] if best_html else None,
                xml_url=best_xml["original"] if best_xml else None,
                xml_timestamp=best_xml["timestamp"] if best_xml else None,
            )
        )
    # Most-recent-first: prioritizes richer/more-final snapshots (the Dec
    # 2018 mass-crawl) and means a partial/interrupted run still covers the
    # most complete data first rather than an arbitrary alphabetical slice.
    manifest.sort(key=lambda e: e.html_timestamp or "", reverse=True)
    return manifest
