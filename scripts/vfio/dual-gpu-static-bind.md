# Dual-GPU Static VFIO Binding

Use this path when `inventory/gpu-decision.md` records 2+ GPUs. The
secondary card is bound to `vfio-pci` unconditionally at boot; the primary
card (or iGPU) is never touched and always serves the host display.

## 1. Get the vendor:device IDs

From `phase2-hardware-inventory.md`'s `lspci -nnk` output, find the
secondary GPU's video and audio function IDs, e.g.:

```
01:00.0 VGA compatible controller [0300]: NVIDIA ... [10de:2504]
01:00.1 Audio device [0403]: NVIDIA ... [10de:22be]
```

## 2. Set the kernel parameter

Add to the kernel command line (alongside the `iommu=` params from
`phase2-vfio-setup.md`):

```
vfio-pci.ids=10de:2504,10de:22be
```

(Replace with your actual IDs recorded in `inventory/gpu-decision.md`.)

## 3. Confirm the driver binding after reboot

```sh
lspci -k -s 01:00.0
lspci -k -s 01:00.1
```

Both should show `Kernel driver in use: vfio-pci`, not `nvidia`/`amdgpu`/`nouveau`.

## 4. Reference the bus IDs in the VM definition

Fill the confirmed bus IDs into
`configs/libvirt/win-gaming-vm.xml`'s PCI hostdev entries.

No libvirt hook script is needed for this path — the card is never used by
the host, so there's nothing to unbind/rebind around VM start/stop.
