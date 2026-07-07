#!/usr/bin/env bash
# Back up \Users\* from a mounted (unencrypted or dislocker-unlocked) Windows
# NTFS volume to external media.
#
# Usage: backup-userdata.sh <source-mount> <dest-mount>
#   e.g. backup-userdata.sh /mnt/winusers /mnt/external/backup

set -euo pipefail

SRC="${1:?Usage: $0 <source-mount> <dest-mount>}"
DEST="${2:?Usage: $0 <source-mount> <dest-mount>}"

if [ ! -d "$SRC/Users" ]; then
  echo "error: $SRC/Users not found - is the Windows volume mounted?" >&2
  exit 1
fi

mkdir -p "$DEST"

rsync -avh --progress \
  --exclude 'Users/*/AppData/Local/Temp' \
  --exclude 'Users/*/AppData/Local/Microsoft/Windows/INetCache' \
  --exclude 'Users/*/NTUSER.DAT*' \
  --exclude 'Users/*/ntuser.dat*' \
  "$SRC/Users/" "$DEST/Users/"

echo "Backup complete. File count check:"
echo "  source: $(find "$SRC/Users" -type f | wc -l)"
echo "  dest:   $(find "$DEST/Users" -type f | wc -l)"
