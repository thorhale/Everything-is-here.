# Phase 2, Step 0: Hardware Inventory (run this first)

This determines which VFIO branch (single-GPU vs dual-GPU) applies in
`phase2-vfio-setup.md`. Run these from a Linux live environment or after the
base Arch install — either works since this is read-only hardware discovery.

## 1. List GPUs

```sh
lspci -nnk | grep -A3 -E "VGA|3D controller"
```

Count the discrete GPUs listed. Integrated graphics (e.g. Intel iGPU, AMD
APU graphics) count separately from a discrete card — note whether an iGPU
exists too, since it can serve as the host display in a dual-GPU passthrough
setup.

## 2. Full PCI listing with driver bindings

```sh
lspci -k
```

Note the PCI bus IDs (e.g. `01:00.0`) and vendor:device IDs (e.g.
`[10de:2504]`) for every GPU and its audio-function sibling (GPUs usually
expose an HDMI audio device on the same bus, e.g. `01:00.1`) — both need to
be passed through together.

## 3. IOMMU group enumeration

```sh
for d in /sys/kernel/iommu_groups/*/devices/*; do
  n=${d#*/iommu_groups/*}; n=${n%%/*}
  printf 'IOMMU Group %s: ' "$n"
  lspci -nns "${d##*/}"
done | sort -V
```

(If IOMMU isn't enabled yet at this point, this directory may not exist —
that's expected pre-Arch-install; kernel params for IOMMU are set up in
`phase2-vfio-setup.md`. Re-run this after that step to confirm your GPU's
group is isolated, i.e. no other unrelated device shares its group.)

## 4. Record the decision

Fill in `inventory/gpu-decision.md` with:
- GPU count (1 or 2+)
- Bus IDs and vendor:device IDs for the passthrough candidate + its audio function
- Whether an iGPU is available for the host display

This decides the branch in `phase2-vfio-setup.md`:
- **1 GPU total** → single-GPU dynamic unbind/rebind path.
- **2+ GPUs** → dual-GPU static binding path (bind the *secondary* card to
  vfio-pci at boot, keep the *primary*/iGPU on the host).
