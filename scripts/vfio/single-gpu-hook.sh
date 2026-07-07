#!/usr/bin/env bash
# libvirt QEMU hook: dynamically unbind the single GPU from its host driver
# and bind vfio-pci before the Windows VM starts, then reverse on stop.
#
# Install as /etc/libvirt/hooks/qemu (must be named exactly "qemu" and be
# executable), or symlink it there. libvirt invokes this for every domain
# with args: <domain-name> <operation> <sub-operation> <extra-arg>.
#
# Only acts for the domain named "winvm" (matches configs/libvirt/win-gaming-vm.xml);
# adjust VM_NAME if you name the domain differently.
#
# Fill in GPU_VIDEO_BUS / GPU_AUDIO_BUS / GPU_DRIVER from
# inventory/gpu-decision.md before using.

set -euo pipefail

VM_NAME="winvm"
GPU_VIDEO_BUS="0000:01:00.0"   # placeholder - fill in from inventory/gpu-decision.md
GPU_AUDIO_BUS="0000:01:00.1"   # placeholder - fill in from inventory/gpu-decision.md
GPU_DRIVER="nvidia"            # or amdgpu / nouveau

DOMAIN="$1"
OPERATION="$2"

[ "$DOMAIN" = "$VM_NAME" ] || exit 0

unbind_from_host() {
  for dev in "$GPU_VIDEO_BUS" "$GPU_AUDIO_BUS"; do
    if [ -e "/sys/bus/pci/devices/$dev/driver" ]; then
      echo "$dev" > "/sys/bus/pci/devices/$dev/driver/unbind" || true
    fi
    echo "vfio-pci" > "/sys/bus/pci/devices/$dev/driver_override"
  done
  echo "$GPU_VIDEO_BUS" > /sys/bus/pci/drivers/vfio-pci/bind
  echo "$GPU_AUDIO_BUS" > /sys/bus/pci/drivers/vfio-pci/bind
}

rebind_to_host() {
  for dev in "$GPU_VIDEO_BUS" "$GPU_AUDIO_BUS"; do
    echo "" > "/sys/bus/pci/devices/$dev/driver_override"
    if [ -e "/sys/bus/pci/devices/$dev/driver" ]; then
      echo "$dev" > "/sys/bus/pci/devices/$dev/driver/unbind" || true
    fi
  done
  echo "$GPU_VIDEO_BUS" > "/sys/bus/pci/drivers/$GPU_DRIVER/bind"
}

case "$OPERATION" in
  prepare)
    unbind_from_host
    ;;
  release)
    rebind_to_host
    ;;
esac
