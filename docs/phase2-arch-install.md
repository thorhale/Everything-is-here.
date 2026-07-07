# Phase 2: Arch Linux Install

Assumes the drive was wiped clean in Phase 1 (`scripts/rescue/wipe-drive.sh`)
and you've booted the [Arch Linux ISO](https://archlinux.org/download/).

This is a single-OS-plus-VM design: there is no real Windows dual-boot
partition. Windows only exists later as a VM disk image under
`/var/lib/libvirt/images/` (Phase 3 is the *worker node*'s Windows install;
the gaming VM on this same host is set up in `phase2-vfio-setup.md` /
`configs/libvirt/win-gaming-vm.xml`).

## Partitioning

Single EFI + root + swap, e.g. for `/dev/nvme0n1`:

| Partition | Size | Type |
|---|---|---|
| `nvme0n1p1` | 1 GiB | EFI System |
| `nvme0n1p2` | swap (~= RAM size, or 16-32 GiB) | Linux swap |
| `nvme0n1p3` | remainder | Linux filesystem (ext4 or btrfs) |

```sh
parted -s /dev/nvme0n1 \
  mkpart ESP fat32 1MiB 1GiB \
  set 1 esp on \
  mkpart primary linux-swap 1GiB 33GiB \
  mkpart primary ext4 33GiB 100%

mkfs.fat -F32 /dev/nvme0n1p1
mkswap /dev/nvme0n1p2 && swapon /dev/nvme0n1p2
mkfs.ext4 /dev/nvme0n1p3

mount /dev/nvme0n1p3 /mnt
mount --mkdir /dev/nvme0n1p1 /mnt/boot
```

Reserve generous space (200 GiB+) on this root filesystem for the Windows VM
disk image that will live under `/var/lib/libvirt/images/` — or place a
separate partition/LV for it if you're using LVM.

## Base install

```sh
pacstrap -K /mnt $(cat scripts/arch-install/packages-base.txt)
genfstab -U /mnt >> /mnt/etc/fstab
arch-chroot /mnt
```

Inside the chroot: set timezone, locale, hostname, root password, create a
user account with `wheel` group + sudo, and install a bootloader
(`systemd-boot` is simplest on UEFI):

```sh
bootctl install
```

Add a loader entry pointing at the root partition, then reboot into the new
system.

## Next

Continue to `phase2-vfio-setup.md` for IOMMU/GPU passthrough, then
`phase2-ai-stack.md` for CUDA/PyTorch.
