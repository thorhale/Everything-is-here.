# Phase 3: De-bloating the Worker Node's Windows Install

Two complementary approaches — use both.

## 1. Unattended install answer file

`configs/windows/autounattend.xml` skips the OOBE prompts that install/opt
you into bloat during setup itself: no Microsoft account nudge (local
account instead), no Cortana setup, no OneDrive folder redirection prompt,
no default-app/privacy-settings wizard. Place it at the root of the install
USB (or mounted alongside the Windows ISO) so Setup picks it up
automatically. See comments inside the file for what each section controls.

## 2. Post-install debloat pass

After Setup completes, run a curated removal pass. The most widely-used,
actively maintained community tool for this is
[Chris Titus Tech's WinUtil](https://github.com/ChrisTitusTech/winutil) — an
open-source PowerShell script (run via `irm christitus.com/win | iex` from
an elevated PowerShell prompt) that presents a checklist UI for:

- Removing pre-installed bloat apps (Xbox app/Game Bar, Store consumer apps,
  Weather, News, Solitaire, etc.)
- Disabling telemetry-related scheduled tasks and services
- Applying "essential tweaks" (disabling unnecessary startup services,
  visual effects tuning) without touching anything OpenSSH/networking needs

Review each checkbox before applying — some tweaks (like disabling Windows
Update entirely) aren't appropriate for a machine you also want secure and
remotely reachable. Keep networking, Remote Desktop (if you want it as a
fallback), and Windows Update service-related items enabled.

An alternative/manual path if you'd rather not run a third-party script: work
through Microsoft's own
[`Uninstall-AppxPackage`](https://learn.microsoft.com/powershell/module/appx/uninstall-appxpackage)
list for the built-in apps you don't want, and disable specific telemetry
scheduled tasks under `Task Scheduler > Microsoft > Windows > Application
Experience` / `Customer Experience Improvement Program` by hand.

## Next

Continue to `scripts/worker-node/enable-openssh.ps1`.
