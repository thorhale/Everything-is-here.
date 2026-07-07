# Creating the Rescue USB (Rufus, from Windows)

You're writing this from the Windows secondary machine.

## Choosing the ISO

- **Primary: [SystemRescue](https://www.system-rescue.org/)** — a rescue-focused
  live Linux distro that ships `dislocker`, `ntfs-3g`, `ddrescue`, `parted`,
  and `cryptsetup` out of the box. Small download, boots fast, no GUI file
  manager but everything needed is on the command line.
- **Fallback: Ubuntu Desktop (Live)** — larger download, but gives a full
  desktop/file manager if you'd rather drag-and-drop the backup instead of
  using `rsync`. `dislocker` and `ntfs-3g` need to be installed manually
  (`sudo apt install dislocker ntfs-3g`) since they aren't preinstalled.

## Steps

1. Download the chosen ISO onto the Windows machine.
2. Download [Rufus](https://rufus.ie/).
3. Insert a USB drive (8 GB+; it will be fully erased).
4. Open Rufus:
   - **Device:** select the USB drive.
   - **Boot selection:** click **SELECT**, choose the downloaded ISO.
   - **Partition scheme:** GPT (for UEFI) — use MBR only if the target PC is
     known to be legacy BIOS.
   - **Target system:** UEFI (non-CSM) unless the target is legacy BIOS.
5. Click **START**. If prompted to write in ISO vs DD mode, ISO mode is fine
   for SystemRescue and Ubuntu.
6. Once complete, safely eject and move the USB to the locked PC.

Continue to `phase1-boot-menu.md`.
