# Everything-is-here.

Homelab build: turning an inherited PC into an Arch Linux AI-dev / GPU-passthrough
gaming rig, and an existing All-in-One PC into a hardwired worker node for
offloaded compute, KVM, and dashboarding.

## Phases

1. **Boot & Rescue** (`docs/phase1-*.md`, `scripts/rescue/`) — gain access to the
   locked main rig, check for BitLocker, back up recoverable data, wipe the drive.
2. **Host OS Provisioning** (`docs/phase2-*.md`, `scripts/arch-install/`,
   `scripts/vfio/`, `configs/libvirt/`) — install Arch Linux, set up IOMMU/VFIO
   GPU passthrough, install the AI/CUDA stack, define the Windows gaming VM.
3. **VM & Network Cluster Setup** (`docs/phase3-*.md`, `scripts/worker-node/`,
   `scripts/dispatch/`, `configs/windows/`, `configs/inputleap/`,
   `configs/monitoring/`) — provision the All-in-One as a de-bloated Windows
   worker with OpenSSH, wire up remote job dispatch, set up Barrier/Input Leap
   KVM and a status dashboard.

Start with `docs/phase1-rescue.md`. Verification steps for every phase are in
`docs/verification.md`.

All scripts and configs here are templates: device names, IP addresses, and PCI
bus IDs are placeholders filled in against the real hardware as you go — nothing
here is meant to run unmodified.
