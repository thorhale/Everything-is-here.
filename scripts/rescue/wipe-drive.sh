#!/usr/bin/env bash
# Securely wipe a drive and leave a clean GPT label, ready for Arch installation.
#
# Usage: wipe-drive.sh /dev/sdX
#
# DESTRUCTIVE. Double-checks the device before touching it, but there is no
# undo past this point. Confirm this is the correct device with `lsblk` first.

set -euo pipefail

DEVICE="${1:?Usage: $0 /dev/sdX}"

if [ ! -b "$DEVICE" ]; then
  echo "error: $DEVICE is not a block device" >&2
  exit 1
fi

echo "About to wipe: $DEVICE"
lsblk "$DEVICE"
read -rp "Type the device path again to confirm ($DEVICE): " CONFIRM
if [ "$CONFIRM" != "$DEVICE" ]; then
  echo "Confirmation did not match, aborting." >&2
  exit 1
fi

echo "Wiping filesystem/partition signatures..."
wipefs -a "$DEVICE"

if [ -e "/sys/block/$(basename "$DEVICE")/queue/discard_max_bytes" ] \
   && [ "$(cat "/sys/block/$(basename "$DEVICE")/queue/discard_max_bytes")" != "0" ]; then
  echo "Device supports TRIM/discard - using blkdiscard."
  blkdiscard "$DEVICE"
else
  echo "No discard support detected - falling back to shred (single pass)."
  shred -vzn1 "$DEVICE"
fi

echo "Writing a fresh GPT partition table..."
parted -s "$DEVICE" mklabel gpt

echo "Done. Current state:"
lsblk "$DEVICE"
