"""M2: full-scale CDX enumeration + scrape across all known path prefixes.

Unlike M1 (single prefix, small cap, single-threaded proof), this:
  - enumerates every known brewtoad.com path prefix, with resumeKey
    pagination handled transparently per-prefix (scraper/cdx/enumerate.py)
  - builds one manifest across all recipe HTML+XML snapshots found
  - fetches+parses with a small thread pool (default 4 workers) sharing one
    rate-limited fetcher instance, so the aggregate request rate to
    web.archive.org stays polite regardless of worker count

Resumable by design: CDX output and fetched snapshots are cached to disk, so
re-running after an interruption picks up where it left off rather than
starting over.

Usage:
    python3 scraper/run_m2.py [workers]
"""
from __future__ import annotations

import dataclasses
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))

from cdx.enumerate import enumerate_to_jsonl  # noqa: E402
from fetch.fetcher import RateLimitedFetcher  # noqa: E402
from manifest.select import RecipeManifestEntry, build_manifest  # noqa: E402
from pipeline import fetch_and_parse_manifest  # noqa: E402

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(REPO_ROOT, "data")

# Path prefixes known to exist on brewtoad.com from M1 exploration.
# Each becomes its own CDX query + jsonl file (keeps any single query well
# under the CDX 100k-row cap and makes enumeration independently resumable
# per prefix).
PREFIXES = {
    "recipes": "www.brewtoad.com/recipes/*",
    "brewers": "www.brewtoad.com/brewers/*",
    "generic_fermentables": "www.brewtoad.com/generic-fermentables/*",
    "hops": "www.brewtoad.com/hops/*",
    "yeasts": "www.brewtoad.com/yeasts/*",
}


def main() -> None:
    workers = int(sys.argv[1]) if len(sys.argv) > 1 else 4
    cdx_dir = os.path.join(DATA_DIR, "cdx")
    os.makedirs(cdx_dir, exist_ok=True)

    cdx_paths = []
    print(f"[1/3] Enumerating CDX across {len(PREFIXES)} path prefixes ...")
    for name, prefix in PREFIXES.items():
        out_path = os.path.join(cdx_dir, f"{name}.jsonl")
        if os.path.exists(out_path):
            print(f"      {name}: already enumerated, skipping ({out_path})")
            cdx_paths.append(out_path)
            continue
        t0 = time.time()
        n = enumerate_to_jsonl(prefix, out_path)
        print(f"      {name}: {n} rows in {time.time() - t0:.1f}s -> {out_path}")
        cdx_paths.append(out_path)

    print("[2/3] Building recipe snapshot-selection manifest ...")
    # The manifest is deterministic given the CDX data, but rebuilding it
    # parses ~650MB of JSONL (30-60s + a >1GB memory spike). This container
    # restarts frequently and the scraper is relaunched each time, so cache
    # the manifest to disk and reload it on subsequent runs.
    manifest_cache = os.path.join(DATA_DIR, "manifest_recipes.jsonl")
    if os.path.exists(manifest_cache):
        manifest = []
        with open(manifest_cache, encoding="utf-8") as f:
            for line in f:
                manifest.append(RecipeManifestEntry(**json.loads(line)))
        print(f"      {len(manifest)} recipes loaded from cache ({manifest_cache})")
    else:
        recipe_cdx_paths = [p for p in cdx_paths if "recipes.jsonl" in p]
        manifest = build_manifest(recipe_cdx_paths)
        with open(manifest_cache, "w", encoding="utf-8") as f:
            for entry in manifest:
                f.write(json.dumps(dataclasses.asdict(entry)) + "\n")
        print(f"      {len(manifest)} distinct recipes discovered (cached to {manifest_cache})")

    raw_cache_dir = os.path.join(DATA_DIR, "raw")
    fetcher = RateLimitedFetcher(raw_cache_dir)
    parsed_dir = os.path.join(DATA_DIR, "parsed")
    os.makedirs(parsed_dir, exist_ok=True)
    out_path = os.path.join(parsed_dir, "recipes_full.jsonl")

    print(f"[3/3] Fetching + parsing {len(manifest)} recipes with {workers} workers ...")
    t0 = time.time()
    summary = fetch_and_parse_manifest(manifest, fetcher, out_path, workers=workers)
    elapsed = time.time() - t0
    print(f"      done in {elapsed / 60:.1f} min: {summary}")
    print(f"      output: {out_path}")


if __name__ == "__main__":
    main()
