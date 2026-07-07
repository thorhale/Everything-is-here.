"""Polite, resumable fetcher for Wayback Machine snapshots.

Caches every raw response to disk keyed by (url, timestamp) before returning
it, so re-running after a crash or a rate-limit pause never re-fetches
already-downloaded content.
"""
from __future__ import annotations

import hashlib
import os
import random
import time

import requests

RETRY_STATUSES = {429, 502, 503, 504}
MAX_RETRIES = 5
REQUEST_TIMEOUT = 30
MIN_DELAY_SECONDS = 0.6  # ~1.5 req/sec sustained, single-threaded caller


def _cache_key(url: str, timestamp: str) -> str:
    h = hashlib.sha1(f"{timestamp}|{url}".encode("utf-8")).hexdigest()
    return h


def _cache_paths(cache_dir: str, url: str, timestamp: str) -> tuple[str, str]:
    key = _cache_key(url, timestamp)
    body_path = os.path.join(cache_dir, f"{key}.body")
    meta_path = os.path.join(cache_dir, f"{key}.meta.json")
    return body_path, meta_path


class RateLimitedFetcher:
    """Single-threaded, politely-paced fetcher with an on-disk cache.

    Low concurrency is achieved by simply not parallelizing callers — this
    class enforces a minimum delay between requests it issues itself.
    """

    def __init__(self, cache_dir: str, min_delay: float = MIN_DELAY_SECONDS):
        self.cache_dir = cache_dir
        self.min_delay = min_delay
        self._last_request_at = 0.0
        self._consecutive_failures = 0
        os.makedirs(cache_dir, exist_ok=True)

    def fetch_snapshot(self, original_url: str, timestamp: str) -> bytes | None:
        """Fetch the original (unrewritten) bytes of a Wayback snapshot.

        Returns None if the fetch ultimately failed after retries (caller
        should log this to a retry queue rather than crash the whole run).
        """
        body_path, meta_path = _cache_paths(self.cache_dir, original_url, timestamp)
        if os.path.exists(body_path):
            with open(body_path, "rb") as f:
                return f.read()

        wayback_url = f"https://web.archive.org/web/{timestamp}if_/{original_url}"
        body = self._get_with_retry(wayback_url)
        if body is None:
            return None

        with open(body_path, "wb") as f:
            f.write(body)
        with open(meta_path, "w", encoding="utf-8") as f:
            f.write(f'{{"url": "{original_url}", "timestamp": "{timestamp}"}}')
        return body

    def _pace(self) -> None:
        elapsed = time.monotonic() - self._last_request_at
        if elapsed < self.min_delay:
            time.sleep(self.min_delay - elapsed)
        self._last_request_at = time.monotonic()

    def _get_with_retry(self, url: str) -> bytes | None:
        backoff = 1.0
        for attempt in range(MAX_RETRIES):
            self._pace()
            try:
                resp = requests.get(url, timeout=REQUEST_TIMEOUT)
            except requests.RequestException:
                self._consecutive_failures += 1
                time.sleep(backoff + random.uniform(0, 0.5))
                backoff *= 2
                continue

            if resp.status_code in RETRY_STATUSES:
                self._consecutive_failures += 1
                time.sleep(backoff + random.uniform(0, 0.5))
                backoff *= 2
                continue

            if resp.status_code == 404:
                self._consecutive_failures = 0
                return None

            if resp.status_code != 200:
                self._consecutive_failures += 1
                if self._consecutive_failures >= 10:
                    raise RuntimeError(
                        f"Circuit breaker: {self._consecutive_failures} consecutive "
                        f"fetch failures, last status {resp.status_code} on {url}"
                    )
                time.sleep(backoff + random.uniform(0, 0.5))
                backoff *= 2
                continue

            self._consecutive_failures = 0
            return resp.content

        return None
