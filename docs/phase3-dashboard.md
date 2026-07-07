# Phase 3: Telemetry Dashboard on the Worker Node's Screen

Simplest option: [Glances](https://nicolargo.github.io/glances/) in web-server
mode, running on the worker node, viewed full-screen in a browser on its own
monitor. See `configs/monitoring/glances-server.md` for setup.

## Upgrade path

If you later want historical graphs (not just live numbers), swap in
Prometheus + `windows_exporter` (the Windows equivalent of node-exporter) +
Grafana:

1. Install [`windows_exporter`](https://github.com/prometheus-community/windows_exporter)
   as a Windows service on the worker node — exposes metrics on `:9182`.
2. Run Prometheus on the Arch host, scraping the worker's `:9182` endpoint.
3. Run Grafana on the Arch host (or in a container), add Prometheus as a
   data source, import a community Windows dashboard (search Grafana's
   dashboard library for "windows_exporter").
4. Point the worker node's browser at the Grafana dashboard URL instead of
   the Glances page.

Start with Glances — it's a single binary/service with no separate
time-series database to run, and is enough for a quick-glance status
screen.
