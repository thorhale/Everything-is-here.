"""Shared fetch+parse loop, usable single-threaded (M1 proof) or with a small
thread pool (M2 full-scale scrape).

Concurrency here only overlaps network *wait* time across workers - the
RateLimitedFetcher's pacing gate and failure counter are shared and
lock-protected (see scraper/fetch/fetcher.py), so the aggregate request rate
to web.archive.org stays the same regardless of worker count. Keep workers
modest (3-4): this is about not wasting wall-clock time on latency, not
about increasing load on a shared public archive.
"""
from __future__ import annotations

import dataclasses
import json
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

from fetch.fetcher import RateLimitedFetcher
from manifest.select import RecipeManifestEntry
from parse.html_parser import parse_recipe_html
from parse.xml_parser import parse_recipe_xml


def asdict_recursive(obj):
    if dataclasses.is_dataclass(obj):
        return {k: asdict_recursive(v) for k, v in dataclasses.asdict(obj).items()}
    if isinstance(obj, list):
        return [asdict_recursive(v) for v in obj]
    return obj


def _fetch_and_parse_one(fetcher: RateLimitedFetcher, entry: RecipeManifestEntry) -> dict | None:
    html_bytes = None
    if entry.html_url and entry.html_timestamp:
        html_bytes = fetcher.fetch_snapshot(entry.html_url, entry.html_timestamp)
    if html_bytes is None:
        return {"slug": entry.slug, "status": "fetch_failed"}

    xml_bytes = None
    if entry.xml_url and entry.xml_timestamp:
        xml_bytes = fetcher.fetch_snapshot(entry.xml_url, entry.xml_timestamp)

    parsed_html = parse_recipe_html(entry.slug, html_bytes)
    if any("error page" in w for w in parsed_html.parse_warnings):
        return {"slug": entry.slug, "status": "error_page"}

    parsed_xml = parse_recipe_xml(entry.slug, xml_bytes) if xml_bytes else None

    return {
        "slug": entry.slug,
        "status": "ok",
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


def load_done_slugs(out_path: str) -> set[str]:
    """Slugs already successfully written to a prior (possibly interrupted)
    run's output file - used to resume without re-parsing (fetches are also
    cached, but re-parsing 300k+ records on every restart wastes real time).
    """
    done: set[str] = set()
    try:
        with open(out_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    done.add(json.loads(line)["slug"])
                except (json.JSONDecodeError, KeyError):
                    continue  # tolerate a truncated last line from a killed process
    except FileNotFoundError:
        pass
    return done


def fetch_and_parse_manifest(
    manifest: list[RecipeManifestEntry],
    fetcher: RateLimitedFetcher,
    out_path: str,
    *,
    workers: int = 1,
    progress_every: int = 25,
    resume: bool = True,
) -> dict:
    """Fetch+parse every entry in `manifest`, writing ok records to `out_path`
    as JSONL. Returns a summary dict of counts. Safe to call with workers>1:
    result records are collected then written from the main thread to avoid
    interleaved/corrupt JSONL lines.

    When resume=True (default), entries whose slug is already present in
    out_path are skipped and new records are appended rather than
    overwriting - this environment restarts frequently mid-run, so every
    fetch_and_parse_manifest call needs to pick up where a prior, killed
    invocation left off rather than starting the output file over.
    """
    done_slugs = load_done_slugs(out_path) if resume else set()
    if done_slugs:
        print(f"      resuming: {len(done_slugs)} recipes already done, skipping them")
    todo = [e for e in manifest if e.slug not in done_slugs]

    counts = {"ok": 0, "error_page": 0, "fetch_failed": 0}
    confidences: list[float] = []
    write_lock = threading.Lock()
    n_done = 0

    with open(out_path, "a", encoding="utf-8") as out_f:

        def handle_result(record: dict | None) -> None:
            nonlocal n_done
            n_done += 1
            if record is None:
                return
            counts[record["status"]] = counts.get(record["status"], 0) + 1
            if record["status"] == "ok":
                with write_lock:
                    out_f.write(json.dumps(record) + "\n")
                    out_f.flush()
                confidences.append(record["parse_confidence"])
            if n_done % progress_every == 0:
                print(f"      ... {n_done}/{len(todo)} processed this run "
                      f"({len(done_slugs) + n_done}/{len(manifest)} total)")

        if workers <= 1:
            for entry in todo:
                handle_result(_fetch_and_parse_one(fetcher, entry))
        else:
            with ThreadPoolExecutor(max_workers=workers) as pool:
                futures = {
                    pool.submit(_fetch_and_parse_one, fetcher, entry): entry
                    for entry in todo
                }
                for future in as_completed(futures):
                    handle_result(future.result())

    avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
    low_conf = sum(1 for c in confidences if c < 0.7)
    return {
        **counts,
        "avg_parse_confidence": avg_conf,
        "low_confidence_count": low_conf,
        "already_done_before_this_run": len(done_slugs),
    }
