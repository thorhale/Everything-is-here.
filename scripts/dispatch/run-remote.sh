#!/usr/bin/env bash
# Run a command/script on the Windows worker node over SSH from the Arch host.
#
# Usage:
#   run-remote.sh "Get-Process"
#   run-remote.sh -f path/to/job.ps1
#
# Requires: worker node reachable at $WORKER_HOST (default below), key-based
# auth already set up (see scripts/worker-node/enable-openssh.ps1).

set -euo pipefail

WORKER_USER="${WORKER_USER:-worker}"
WORKER_HOST="${WORKER_HOST:-<aio-ip>}"   # FILL: worker node's LAN IP or hostname

if [ "${1:-}" = "-f" ]; then
  SCRIPT_PATH="${2:?Usage: $0 -f path/to/job.ps1}"
  # shellcheck disable=SC2029
  ssh "${WORKER_USER}@${WORKER_HOST}" "powershell -NoProfile -Command -" < "$SCRIPT_PATH"
else
  CMD="${1:?Usage: $0 \"<powershell-command>\" | -f path/to/job.ps1}"
  ssh "${WORKER_USER}@${WORKER_HOST}" "powershell -NoProfile -Command \"$CMD\""
fi
