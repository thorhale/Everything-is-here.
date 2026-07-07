# Booting the Locked PC from USB

1. Insert the rescue USB into the locked PC.
2. Power on and immediately tap the vendor boot-menu key repeatedly:
   - Dell: `F12`
   - HP: `F9` (or `Esc` then `F9`)
   - Lenovo: `F12` (or `Novo` button on some models)
   - ASUS: `F8` or `Esc`
   - MSI: `F11`
   - Generic/unknown OEM: try `F12`, `F11`, `F9`, `Esc`, or `Del` (the last
     one usually opens BIOS/UEFI setup directly instead of a boot menu).
3. Select the USB drive from the one-time boot menu.
4. **If the USB doesn't appear in the list**, enter BIOS/UEFI setup (`Del` or
   `F2` on most boards) and:
   - Disable **Secure Boot**.
   - Disable **Fast Boot** / **Fast Startup** (this Windows-side setting can
     also prevent clean access to the disk from Linux — if you can get into
     Windows at all, disabling Fast Startup there is ideal, but since the PC
     is locked you'll instead rely on the BIOS-level Fast Boot toggle).
   - Confirm the boot mode is UEFI (matches how the USB was written) unless
     you deliberately used MBR/Legacy in Rufus.
5. Save and exit, then retry the boot-menu key.

Once booted into the live environment, continue to `phase1-bitlocker-check.md`.
