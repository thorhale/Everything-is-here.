# Phase 3: Worker Node Overview

The All-in-One PC keeps its existing Windows install path but gets rebuilt
as a de-bloated worker: minimal background services, native OpenSSH Server
enabled for remote job execution from the Arch host, a KVM client for
shared keyboard/mouse, and a lightweight telemetry dashboard on its own
screen.

## Order of operations

1. **Debloat** — `phase3-debloat.md` + `configs/windows/autounattend.xml`.
2. **Enable OpenSSH Server** — `scripts/worker-node/enable-openssh.ps1`.
3. **Wire up remote dispatch from the Arch host** —
   `scripts/dispatch/run-remote.sh` / `Makefile`.
4. **KVM** — `configs/inputleap/server.conf` (Barrier/Input Leap).
5. **Dashboard** — `phase3-dashboard.md` + `configs/monitoring/glances-server.md`.

Verify all of Phase 3 with `docs/verification.md`.
