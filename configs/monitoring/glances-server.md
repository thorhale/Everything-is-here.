# Glances Web Mode on the Worker Node

Glances has a native Windows build (via pip) and a built-in web server mode
— no separate web server needed.

## Install (on the worker node, in an elevated PowerShell prompt)

```powershell
python -m pip install --upgrade glances[web]
```

(Requires Python for Windows installed first — grab it from
python.org or the Microsoft Store build if you kept that during debloat.)

## Run in web-server mode

```powershell
python -m glances -w --disable-webui-cache
```

By default this serves on `http://<worker-ip>:61208`.

## Run it as a background/startup task

Create a Scheduled Task (`Task Scheduler > Create Task`) that runs at
log-on:

```
Program: pythonw.exe
Arguments: -m glances -w
```

Set it to run whether the user is logged on or not, with highest privileges,
so it survives reboots without a manual start.

## View it

From the Arch host (or any machine on the LAN), open
`http://<worker-ip>:61208` in a browser. For the "second screen" use case,
open that URL full-screen in a browser directly on the worker's own
monitor via a kiosk-mode browser shortcut.

## Verify

```sh
curl -s http://<worker-ip>:61208/api/4/cpu
```

should return JSON CPU stats.
