"""Extract and parse BrewToad recipes from Archive Team WARC files.

The December 2018 shutdown crawl (ArchiveBot job 20181212094855c6930) is
published on archive.org as 7 bulk-downloadable .warc.gz files (~34GB total)
in the archiveteam_archivebot_go_* items. Processing those locally replaces
hundreds of thousands of rate-limited Wayback replay requests - it's both
enormously faster and far more polite to archive.org, whose download
endpoints exist exactly for this.

Streams a .warc.gz (no decompressed copy on disk), extracts HTTP 200
responses for recipe HTML pages and BeerXML exports, runs the existing
parsers, and appends records - in the same format the Wayback pipeline
produces - to data/parsed/recipes_full.jsonl, skipping slugs already there.

HTML pages and their .xml siblings can land in different WARC parts, so XML
parses are staged to data/parsed/warc_xml_staged.jsonl; merge_xml() joins
any staged XML into existing records once all parts are processed (records
without XML are still complete - XML is a cross-check/enrichment).

Usage:
    python3 scraper/warc/process_warc.py <file.warc.gz> [more.warc.gz ...]
    python3 scraper/warc/process_warc.py --merge-xml
"""
from __future__ import annotations

import dataclasses
import json
import os
import re
import sys

from warcio.archiveiterator import ArchiveIterator

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from parse.html_parser import parse_recipe_html  # noqa: E402
from parse.xml_parser import parse_recipe_xml  # noqa: E402

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(REPO_ROOT, "data")
OUT_PATH = os.path.join(DATA_DIR, "parsed", "recipes_full.jsonl")
XML_STAGE_PATH = os.path.join(DATA_DIR, "parsed", "warc_xml_staged.jsonl")

RECIPE_HTML_URL_RE = re.compile(r"^https?://www\.brewtoad\.com/recipes/([a-z0-9][a-z0-9\-]*)/?$")
RECIPE_XML_URL_RE = re.compile(r"^https?://www\.brewtoad\.com/recipes/([a-z0-9][a-z0-9\-]*)\.xml$")


def asdict_recursive(obj):
    if dataclasses.is_dataclass(obj):
        return {k: asdict_recursive(v) for k, v in dataclasses.asdict(obj).items()}
    if isinstance(obj, list):
        return [asdict_recursive(v) for v in obj]
    return obj


def load_done_slugs() -> set[str]:
    done: set[str] = set()
    try:
        with open(OUT_PATH, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    done.add(json.loads(line)["slug"])
                except (json.JSONDecodeError, KeyError):
                    continue
    except FileNotFoundError:
        pass
    return done


def warc_date_to_timestamp(warc_date: str | None) -> str:
    # "2018-12-12T09:48:55Z" -> "20181212094855"
    if not warc_date:
        return ""
    return re.sub(r"[^0-9]", "", warc_date)[:14]


def process_warc(path: str, done_slugs: set[str]) -> dict:
    counts = {"html_new": 0, "html_dup": 0, "xml_staged": 0, "error_pages": 0, "records": 0}
    with open(path, "rb") as stream, \
         open(OUT_PATH, "a", encoding="utf-8") as out_f, \
         open(XML_STAGE_PATH, "a", encoding="utf-8") as xml_f:
        for record in ArchiveIterator(stream):
            counts["records"] += 1
            if record.rec_type != "response":
                continue
            uri = record.rec_headers.get_header("WARC-Target-URI") or ""
            m_html = RECIPE_HTML_URL_RE.match(uri)
            m_xml = RECIPE_XML_URL_RE.match(uri) if not m_html else None
            if not m_html and not m_xml:
                continue
            if record.http_headers is None or record.http_headers.get_statuscode() != "200":
                continue
            timestamp = warc_date_to_timestamp(record.rec_headers.get_header("WARC-Date"))
            body = record.content_stream().read()

            if m_html:
                slug = m_html.group(1)
                if slug in done_slugs:
                    counts["html_dup"] += 1
                    continue
                parsed = parse_recipe_html(slug, body)
                if any("error page" in w for w in parsed.parse_warnings):
                    counts["error_pages"] += 1
                    continue
                rec = {
                    "slug": slug,
                    "status": "ok",
                    "source": {
                        "html_url": uri,
                        "html_timestamp": timestamp,
                        "xml_url": None,
                        "xml_timestamp": None,
                        "via": "archiveteam_warc",
                    },
                    "html": asdict_recursive(parsed),
                    "xml": None,
                    "parse_confidence": parsed.parse_confidence,
                }
                out_f.write(json.dumps(rec) + "\n")
                done_slugs.add(slug)
                counts["html_new"] += 1
                if counts["html_new"] % 5000 == 0:
                    out_f.flush()
                    print(f"      ... {counts['html_new']} new recipes from {os.path.basename(path)}")
            else:
                slug = m_xml.group(1)
                parsed_xml = parse_recipe_xml(slug, body)
                xml_f.write(json.dumps({
                    "slug": slug,
                    "xml_url": uri,
                    "xml_timestamp": timestamp,
                    "xml": asdict_recursive(parsed_xml),
                }) + "\n")
                counts["xml_staged"] += 1
    return counts


def merge_xml() -> None:
    """Join staged XML parses into recipes_full.jsonl records (rewrite)."""
    staged: dict[str, dict] = {}
    with open(XML_STAGE_PATH, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            staged[row["slug"]] = row

    tmp_path = OUT_PATH + ".tmp"
    merged = 0
    with open(OUT_PATH, encoding="utf-8") as in_f, open(tmp_path, "w", encoding="utf-8") as out_f:
        for line in in_f:
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            s = staged.get(rec["slug"])
            if s and not rec.get("xml"):
                rec["xml"] = s["xml"]
                rec["source"]["xml_url"] = s["xml_url"]
                rec["source"]["xml_timestamp"] = s["xml_timestamp"]
                merged += 1
            out_f.write(json.dumps(rec) + "\n")
    os.replace(tmp_path, OUT_PATH)
    print(f"merged XML into {merged} records ({len(staged)} staged)")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        raise SystemExit(1)
    if sys.argv[1] == "--merge-xml":
        merge_xml()
        raise SystemExit(0)
    done = load_done_slugs()
    print(f"{len(done)} slugs already parsed")
    for warc_path in sys.argv[1:]:
        print(f"processing {warc_path} ...")
        result = process_warc(warc_path, done)
        print(f"      {result}")
