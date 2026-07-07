# Checking for BitLocker Encryption

From the live USB environment, identify the Windows partition first:

```sh
lsblk -f
```

Look for a partition with filesystem type `ntfs` or `BitLocker` and a
plausible size (typically the largest NTFS partition, not the small ~100 MB
EFI/Recovery partitions).

## Method 1 — `blkid`

```sh
sudo blkid /dev/sdXN
```

If the `TYPE=` field reads `BitLocker` (rather than `ntfs`), the volume is
encrypted.

## Method 2 — `dislocker-find`

SystemRescue and most rescue distros ship `dislocker`. It can confirm and
help mount a BitLocker volume if you have credentials:

```sh
sudo dislocker-find
```

This scans for BitLocker volumes and reports their status.

## If encrypted — do you have a way in?

You need one of:
- The 48-digit **BitLocker recovery key** (often stored in the previous
  owner's Microsoft account online, printed on paper, or saved to a USB
  drive at time of encryption).
- The **password** used to unlock it, if password-protected rather than
  TPM-only.

If you have a recovery key, mount with dislocker:

```sh
sudo mkdir -p /mnt/bitlocker /mnt/winusers
sudo dislocker -r -p<RECOVERY-KEY-NO-DASHES> /dev/sdXN -- /mnt/bitlocker
sudo mount -o loop /mnt/bitlocker/dislocker-file /mnt/winusers
```

If you have **no key and no password**, the data is not recoverable through
normal means — proceed to `phase1-decision-tree.md` and go straight to the
wipe.

## If unencrypted

`TYPE=` will read `ntfs` directly. Mount it read-only first to confirm it's
the right volume before backing up:

```sh
sudo mkdir -p /mnt/winusers
sudo ntfs-3g -o ro /dev/sdXN /mnt/winusers
ls /mnt/winusers/Users
```

Then continue to `phase1-decision-tree.md`.
