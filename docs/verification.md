# Verification

End-to-end checks for each phase. Run these as you complete the
corresponding phase, not just at the very end.

## Phase 1 — Boot & Rescue

- `lsblk <device>` shows a clean GPT label with no partitions after
  `scripts/rescue/wipe-drive.sh`.
- If data was backed up: file count on external media matches a
  `find /mnt/winusers -type f | wc -l` taken before the wipe (the backup
  script itself prints both counts at the end).

## Phase 2 — Host OS Provisioning

- `find /sys/kernel/iommu_groups/ -maxdepth 1 | wc -l` shows more than a
  handful of groups, and the passthrough GPU's group (per
  `phase2-hardware-inventory.md`) contains only itself + its audio function
  — no unrelated device sharing the group.
- `lspci -k -s <gpu-bus-id>` shows `Kernel driver in use: vfio-pci` for the
  passthrough card (both branches, confirmed differently: always-on for
  dual-GPU, only while the VM is running for single-GPU).
- `virsh start winvm` boots the Windows VM and grabs the passed-through GPU;
  inside the guest, Device Manager (or `nvidia-smi`/vendor equivalent if a
  driver is installed) shows the card with no error/yellow-bang.
- `nvidia-smi` on the host lists the host-resident GPU (if applicable), and
  `python -c "import torch; print(torch.cuda.is_available())"` prints
  `True`.

## Phase 3 — VM & Network Cluster Setup

- `ssh worker@<aio-ip> "echo ok"` succeeds without a password prompt
  (key-based auth working).
- `make -C scripts/dispatch worker-ping` succeeds.
- Barrier/Input Leap: moving the mouse off the configured screen edge on
  the Arch host makes the cursor appear on the worker node's monitor, and
  vice versa.
- `curl -s http://<aio-ip>:61208/api/4/cpu` (or the equivalent Grafana URL
  if upgraded) returns live stats; the worker's own monitor shows the
  dashboard rendering in its kiosk browser.

If any check fails, the corresponding phase doc has the detail needed to
re-diagnose that specific step rather than restarting the whole phase.
