# Phase 1: Boot & Rescue — Master Checklist

Goal: gain access to the locked main rig, determine whether its drive is
BitLocker-encrypted, recover user data if possible, and leave the drive clean
for the Arch install in Phase 2.

> **Before you start:** confirm you're legally entitled to access this
> machine (as heir / estate executor / rightful owner of the inherited PC).
> Once you're in, treat anything personal you find with care — keep any
> recovered files private rather than casually re-sharing them.

## Steps

1. **Create the rescue USB** — see `phase1-rufus-usb.md`.
2. **Boot the locked PC from USB** — see `phase1-boot-menu.md`.
3. **Identify the Windows partition** from the live environment:
   ```sh
   lsblk -f
   fdisk -l
   ```
4. **Check for BitLocker** — see `phase1-bitlocker-check.md`.
5. **Branch per `phase1-decision-tree.md`:**
   - Unencrypted (or key known) → back up data with
     `scripts/rescue/backup-userdata.sh`.
   - Encrypted with no known recovery key → data is not recoverable; skip
     straight to wipe.
6. **Wipe the drive** with `scripts/rescue/wipe-drive.sh <device>` to leave a
   clean GPT table ready for Arch installation in Phase 2.
7. **Record the drive/device name** (e.g. `/dev/nvme0n1`) — you'll need it
   again in `docs/phase2-arch-install.md`.

## Verification

- `lsblk` on the target drive shows a fresh GPT label with no partitions.
- If data was backed up: file count on external media matches
  `find /mnt/winusers -type f | wc -l` taken before the wipe.
