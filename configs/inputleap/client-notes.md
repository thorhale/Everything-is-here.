# Input Leap / Barrier — Worker Node (Client) Setup

1. Install [Input Leap](https://github.com/input-leap/input-leap/releases)
   (or Barrier, its predecessor) on the Windows worker node.
2. Launch it, select **Client** mode.
3. Enter the Arch host's IP/hostname as the server address.
4. On the Arch host, run the server pointed at `configs/inputleap/server.conf`
   and make sure the screen name in that file (`aio-worker`) matches the
   worker's hostname as reported by the client, or the connection will be
   refused.
5. Confirm firewall rules on the worker allow inbound TCP 24800 (Input
   Leap's default port) from the Arch host's LAN IP.
6. Test by moving the mouse off the edge of the Arch host's screen toward
   the direction configured in `server.conf` (`right` in the example) — the
   cursor should appear on the worker's monitor.
