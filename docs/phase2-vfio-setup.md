# Phase 2: IOMMU / VFIO GPU Passthrough Setup

Complete `phase2-hardware-inventory.md` and `inventory/gpu-decision.md`
first — this doc branches on that result.

## 1. Enable IOMMU

Add to the kernel command line (edit `/boot/loader/entries/arch.conf` if
using systemd-boot, or the `GRUB_CMDLINE_LINUX` line in
`/etc/default/grub` + `grub-mkconfig` if using GRUB):

- Intel CPU: `intel_iommu=on iommu=pt`
- AMD CPU: `amd_iommu=on iommu=pt`

Reboot, then re-run the IOMMU group enumeration from
`phase2-hardware-inventory.md` to confirm the passthrough GPU sits in its
own isolated group (or a group only shared with its own audio function).

## 2. Load vfio modules early

Edit `/etc/mkinitcpio.conf`:

```
MODULES=(vfio_pci vfio vfio_iommu_type1 vfio_virqfd ... <existing gpu driver modules after this>)
```

`vfio` modules must load **before** `nvidia`/`amdgpu`/`nouveau` so vfio-pci
can claim the passthrough card first. Rebuild the initramfs:

```sh
mkinitcpio -P
```

## 3. Branch on GPU count (`inventory/gpu-decision.md`)

### Dual GPU → static binding

See `scripts/vfio/dual-gpu-static-bind.md` and
`configs/systemd/vfio-pci-static.conf`. Summary: pass
`vfio-pci.ids=<vendor:device>,<vendor:device>` (video + audio function) as a
kernel parameter so the secondary card is bound to vfio-pci at boot, never
touched by the nvidia/amdgpu driver. The primary card (or iGPU) stays free
for the host.

### Single GPU → dynamic unbind/rebind

See `scripts/vfio/single-gpu-hook.sh` and
`configs/systemd/libvirt-hooks/qemu`. Summary: a libvirt `prepare`/`release`
hook unbinds the GPU from its host driver and binds vfio-pci right before
the Windows VM starts, then reverses this when the VM stops — so the host
display drops briefly during that window (expected trade-off of single-GPU
passthrough; consider SSH/serial access to the host during testing in case
this doesn't cleanly recover the first few tries).

## 4. Enable libvirtd

```sh
systemctl enable --now libvirtd
usermod -aG libvirt $USER
```

## Next

Continue to `phase2-ai-stack.md`, then define the VM in
`configs/libvirt/win-gaming-vm.xml`.
