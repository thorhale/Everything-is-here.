# CLAUDE.md

This repo holds runbooks, scripts, and config templates for a homelab build,
not application source code. There is no build/test/lint pipeline.

## Layout

- `docs/` — phase-numbered runbooks (`phase1-*`, `phase2-*`, `phase3-*`) plus
  `verification.md`. Read the relevant phase doc before touching its scripts.
- `scripts/` — executable templates (`rescue/`, `arch-install/`, `vfio/`,
  `worker-node/`, `dispatch/`). Placeholders like `$DEVICE`, `<aio-ip>`, and PCI
  bus IDs must be filled in from the real hardware — never run these unmodified.
- `configs/` — non-executable config templates (systemd units, libvirt XML,
  Windows answer files, Input Leap, monitoring).
- `inventory/` — records of hardware findings (GPU count, IOMMU groups) that
  gate which branch of the Phase 2 VFIO setup applies.

## Working conventions

- Shell scripts target Arch Linux (`scripts/rescue`, `scripts/arch-install`,
  `scripts/vfio`, `scripts/dispatch`) unless named `*.ps1`, which target Windows
  (PowerShell) and live under `scripts/worker-node/`.
- Keep destructive operations (drive wipes) isolated in clearly named scripts
  that take the target device as an explicit argument — never hardcode a device
  path.
- The three phases are sequential and each is gated on a decision recorded in
  `inventory/`: Phase 1 branches on BitLocker status, Phase 2 branches on GPU
  count.
