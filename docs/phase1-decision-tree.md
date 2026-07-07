# Phase 1 Decision Tree

```
                     BitLocker check (phase1-bitlocker-check.md)
                                   |
                +------------------+------------------+
                |                                     |
          Unencrypted                             Encrypted
                |                                     |
    Mount rw with ntfs-3g                +------------+------------+
    Run scripts/rescue/                  |                         |
    backup-userdata.sh              Key/password known      No key, no password
                |                        |                         |
    Verify backup file count      Unlock with dislocker,    Data is not recoverable.
    against source                then treat as             Document this in
                |                  "Unencrypted" path        inventory/ and move on.
                +------------------+------------------+
                                   |
                          scripts/rescue/wipe-drive.sh <device>
                                   |
                        Clean GPT drive, ready for
                        docs/phase2-arch-install.md
```

Record which branch you took (and, if applicable, that the recovery key was
unavailable) as a short note — there's no dedicated inventory file for this
since it's a one-time decision, but keep it in mind when reporting back on
what was/wasn't recoverable.
