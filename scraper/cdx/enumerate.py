"""Enumerate archived brewtoad.com URLs via the Wayback CDX API.

The CDX API caps a single query at 100,000 rows, so full-domain enumeration
needs to be split by path prefix (and, if a prefix alone still overflows,
paginated further via resumeKey). This module handles one prefix at a time;
scraper/cdx/run_enumeration.py drives it across all known prefixes.
"""
from __future__ import annotations

import json
import time
import urllib.parse
from dataclasses import dataclass, asdict
from typing import Iterator

import requests

CDX_ENDPOINT = "https://web.archive.org/cdx/search/cdx"
PAGE_LIMIT = 50_000  # comfortably under the 100k cap, leaves room for resumeKey use
REQUEST_TIMEOUT = 30
RETRY_STATUSES = {429, 502, 503, 504}
MAX_RETRIES = 5


@dataclass
class CdxRow:
    urlkey: str
    timestamp: str
    original: str
    mimetype: str
    statuscode: str
    digest: str
    length: str


def _get_with_retry(params: dict) -> requests.Response:
    backoff = 1.0
    last_exc: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.get(CDX_ENDPOINT, params=params, timeout=REQUEST_TIMEOUT)
        except requests.RequestException as exc:
            last_exc = exc
            time.sleep(backoff)
            backoff *= 2
            continue
        if resp.status_code in RETRY_STATUSES:
            time.sleep(backoff)
            backoff *= 2
            continue
        resp.raise_for_status()
        return resp
    raise RuntimeError(f"CDX query failed after {MAX_RETRIES} retries: {last_exc}")


def query_prefix(url_prefix: str, *, collapse: str = "urlkey") -> Iterator[CdxRow]:
    """Yield every CdxRow for a given URL prefix, transparently paginating.

    url_prefix should already include the trailing '*' if a wildcard match is
    wanted, e.g. 'brewtoad.com/recipes/*'.

    Pagination requires explicitly requesting `showResumeKey=true` - without
    it the API silently truncates at `limit` with no marker at all (verified
    directly against the live endpoint; this is not documented behavior you
    can infer from a single un-paginated response). When present, a truncated
    response ends with two extra rows: an empty `[]` separator followed by a
    single-element `["<resume_key>"]` row.
    """
    resume_key = None
    while True:
        params = {
            "url": url_prefix,
            "matchType": "prefix" if url_prefix.endswith("*") else "exact",
            "output": "json",
            "collapse": collapse,
            "limit": PAGE_LIMIT,
            "showResumeKey": "true",
        }
        # CDX wants the '*' stripped from the url param itself when matchType=prefix
        if params["url"].endswith("*"):
            params["url"] = params["url"][:-1]
        if resume_key:
            params["resumeKey"] = resume_key

        resp = _get_with_retry(params)
        text = resp.text.strip()
        if not text:
            return
        rows = json.loads(text)
        if not rows:
            return

        header, *data_rows = rows
        resume_key = None
        if data_rows and len(data_rows[-1]) == 1:
            resume_key = data_rows[-1][0] or None
            data_rows = data_rows[:-1]
            if data_rows and len(data_rows[-1]) == 0:
                data_rows = data_rows[:-1]

        for row in data_rows:
            yield CdxRow(*row)

        if not resume_key:
            return


def enumerate_to_jsonl(url_prefix: str, out_path: str) -> int:
    """Query a prefix and write all rows to a JSONL file. Returns row count."""
    count = 0
    with open(out_path, "w", encoding="utf-8") as f:
        for row in query_prefix(url_prefix):
            f.write(json.dumps(asdict(row)) + "\n")
            count += 1
    return count


if __name__ == "__main__":
    import sys

    if len(sys.argv) != 3:
        print("usage: enumerate.py <url-prefix> <out.jsonl>", file=sys.stderr)
        raise SystemExit(1)
    n = enumerate_to_jsonl(sys.argv[1], sys.argv[2])
    print(f"wrote {n} rows to {sys.argv[2]}")
