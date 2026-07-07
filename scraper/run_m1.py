"""M1: small-scale end-to-end pipeline proof.

Enumerates a limited slice of /recipes/* via CDX, fetches the best HTML+XML
snapshot per recipe, parses both, and writes normalized records to
data/parsed/m1_sample.jsonl for manual spot-checking.

Usage:
    python3 scraper/run_m1.py [prefix] [max_recipes]

Defaults to a small slug-prefix slice so a full run finishes in a few minutes
without hammering web.archive.org.
"""
from __future__ import annotations

import dataclasses
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from cdx.enumerate import enumerate_to_jsonl  # noqa: E402
from fetch.fetcher import RateLimitedFetcher  # noqa: E402
from manifest.select import build_manifest  # noqa: E402
from parse.html_parser import parse_recipe_html  # noqa: E402
from parse.xml_parser import parse_recipe_xml  # noqa: E402

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(REPO_ROOT, "data")


def asdict_recursive(obj):
    if dataclasses.is_dataclass(obj):
        return {k: asdict_recursive(v) for k, v in dataclasses.asdict(obj).items()}
    if isinstance(obj, list):
        return [asdict_recursive(v) for v in obj]
    return obj


def main() -> None:
    prefix = sys.argv[1] if len(sys.argv) > 1 else "www.brewtoad.com/recipes/2*"
    max_recipes = int(sys.argv[2]) if len(sys.argv) > 2 else 300

    cdx_path = os.path.join(DATA_DIR, "cdx", "m1_recipes.jsonl")
    print(f"[1/4] Enumerating CDX for prefix '{prefix}' ...")
    n_rows = enumerate_to_jsonl(prefix, cdx_path)
    print(f"      wrote {n_rows} CDX rows to {cdx_path}")

    print("[2/4] Building snapshot-selection manifest ...")
    manifest = build_manifest([cdx_path])
    manifest = manifest[:max_recipes]
    print(f"      selected {len(manifest)} recipes (capped at {max_recipes})")

    raw_cache_dir = os.path.join(DATA_DIR, "raw")
    fetcher = RateLimitedFetcher(raw_cache_dir)

    parsed_dir = os.path.join(DATA_DIR, "parsed")
    os.makedirs(parsed_dir, exist_ok=True)
    out_path = os.path.join(parsed_dir, "m1_sample.jsonl")

    print(f"[3/4] Fetching + parsing {len(manifest)} recipes (rate-limited, cached) ...")
    n_ok, n_error_page, n_fetch_fail = 0, 0, 0
    confidences = []

    with open(out_path, "w", encoding="utf-8") as out_f:
        for i, entry in enumerate(manifest, 1):
            html_bytes = None
            if entry.html_url and entry.html_timestamp:
                html_bytes = fetcher.fetch_snapshot(entry.html_url, entry.html_timestamp)

            xml_bytes = None
            if entry.xml_url and entry.xml_timestamp:
                xml_bytes = fetcher.fetch_snapshot(entry.xml_url, entry.xml_timestamp)

            if html_bytes is None:
                n_fetch_fail += 1
                continue

            parsed_html = parse_recipe_html(entry.slug, html_bytes)
            if any("error page" in w for w in parsed_html.parse_warnings):
                n_error_page += 1
                continue

            parsed_xml = parse_recipe_xml(entry.slug, xml_bytes) if xml_bytes else None

            record = {
                "slug": entry.slug,
                "source": {
                    "html_url": entry.html_url,
                    "html_timestamp": entry.html_timestamp,
                    "xml_url": entry.xml_url,
                    "xml_timestamp": entry.xml_timestamp,
                },
                "html": asdict_recursive(parsed_html),
                "xml": asdict_recursive(parsed_xml) if parsed_xml else None,
                "parse_confidence": parsed_html.parse_confidence,
            }
            out_f.write(json.dumps(record) + "\n")
            confidences.append(parsed_html.parse_confidence)
            n_ok += 1

            if i % 25 == 0:
                print(f"      ... {i}/{len(manifest)} processed")

    print("[4/4] Done.")
    avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
    low_conf = sum(1 for c in confidences if c < 0.7)
    print(
        f"      ok={n_ok} error_pages={n_error_page} fetch_failed={n_fetch_fail} "
        f"avg_parse_confidence={avg_conf:.2f} low_confidence(<0.7)={low_conf}"
    )
    print(f"      output: {out_path}")


if __name__ == "__main__":
    main()
