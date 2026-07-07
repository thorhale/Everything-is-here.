# GPU Decision Record

Fill this in after running `docs/phase2-hardware-inventory.md`.

- **GPU count:** _(1 / 2+)_
- **Host GPU** (stays bound to Linux, or iGPU if available):
  - Bus ID:
  - Vendor:Device ID:
- **Passthrough GPU** (goes to the Windows VM):
  - Bus ID:
  - Vendor:Device ID (video function):
  - Vendor:Device ID (HDMI/audio function):
- **Branch selected:** _(single-gpu-hook.sh / dual-gpu-static-bind.md)_
- **IOMMU group isolation confirmed:** _(yes/no — paste relevant `iommu_groups` output if useful)_
