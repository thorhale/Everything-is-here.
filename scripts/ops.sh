#!/usr/bin/env bash
# Idempotent recovery/status script for the WortHogg pipeline.
#
# This environment's container restarts frequently, killing Postgres, the
# scraper, and the dev server. Running this script once brings everything
# back up (skipping anything already running) and prints a status summary.
#
# Usage:
#   scripts/ops.sh          # ensure postgres + scraper are up, print status
#   scripts/ops.sh --dev    # also ensure the Next.js dev server is up
#   scripts/ops.sh --sync   # also run the Postgres import (new records only)

set -u
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

echo "== WortHogg ops =="

# --- Postgres ---
if pg_lsclusters | grep -q online; then
  echo "postgres: already running"
else
  service postgresql start > /dev/null 2>&1
  sleep 2
  if pg_lsclusters | grep -q online; then
    echo "postgres: started"
  else
    echo "postgres: FAILED to start" >&2
  fi
fi

# --- Scraper ---
if pgrep -f "run_m2.py" > /dev/null; then
  echo "scraper: already running"
else
  nohup python3 scraper/run_m2.py 4 > data/m2_run.log 2>&1 &
  disown
  echo "scraper: started (log: data/m2_run.log)"
fi

# --- Dev server (opt-in) ---
if [[ "${1:-}" == "--dev" || "${2:-}" == "--dev" ]]; then
  if pgrep -f "next dev" > /dev/null; then
    echo "dev server: already running"
  else
    (cd app && nohup npm run dev > ../data/nextdev.log 2>&1 &)
    echo "dev server: started (log: data/nextdev.log)"
  fi
fi

# --- Postgres sync (opt-in) ---
if [[ "${1:-}" == "--sync" || "${2:-}" == "--sync" ]]; then
  echo "syncing postgres from data/parsed/recipes_full.jsonl ..."
  (cd app && npx tsx prisma/import.ts ../data/parsed/recipes_full.jsonl | tail -3)
fi

# --- Snapshot (opt-in): commit a gzipped copy of the parsed data as
# insurance against this ephemeral container being reclaimed. Only when
# it has grown by >2000 recipes since the last snapshot, to keep git
# history from bloating with near-identical 7MB+ blobs every check-in.
if [[ "${1:-}" == "--snapshot" || "${2:-}" == "--snapshot" || "${3:-}" == "--snapshot" ]]; then
  mkdir -p data/snapshots
  current=$(wc -l < data/parsed/recipes_full.jsonl 2>/dev/null || echo 0)
  last=$(zcat data/snapshots/recipes_full.jsonl.gz 2>/dev/null | wc -l || echo 0)
  if (( current - last > 2000 )); then
    gzip -c data/parsed/recipes_full.jsonl > data/snapshots/recipes_full.jsonl.gz
    git add data/snapshots/recipes_full.jsonl.gz
    git commit -q -m "Snapshot parsed recipe data at ${current} recipes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015xuUYdkBo5VfiLYUqQKNsL"
    git push -q origin claude/brew-toad-recreation-idpvrb && echo "snapshot: committed at ${current} recipes" || echo "snapshot: commit ok, push FAILED" >&2
  else
    echo "snapshot: skipped (only $((current - last)) new since last)"
  fi
fi

# --- Status summary ---
scraped=$(wc -l < data/parsed/recipes_full.jsonl 2>/dev/null || echo 0)
echo "progress: ${scraped}/354608 recipes scraped"
tail -1 data/m2_run.log 2>/dev/null || true
