---
title: LAN discovery (internals)
description: How the mDNS-based peer discovery module is wired — service definition, controller lifecycle, hostname normalization, live toggle, and the events it emits.
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases.
:::

This page is the architectural companion to the user-facing [LAN discovery](/lan-discovery/) page. It covers what's actually on disk and what runs at startup vs. on toggle.

## Module layout

All the LAN-discovery code lives in **`agentmux-srv/src/backend/lan_discovery.rs`**:

| Item | Role |
|---|---|
| `SERVICE_TYPE = "_agentmux._tcp.local."` | The mDNS service we advertise / browse |
| `LanInstance` | One peer's snapshot row (hostname, version, address, port, agents, first/last seen) |
| `LanDiscovery` | The actual daemon — owns the `ServiceDaemon`, the peer `HashMap`, the EventBus handle, and the event-loop thread |
| `LanDiscoveryController` | The runtime-toggleable wrapper — owns the start args + a swappable `RwLock<Option<Arc<LanDiscovery>>>` slot |
| `mdns_hostname()` | Pure helper that appends `.local.` to a bare hostname (mdns-sd requirement) |

The crate dependency is [`mdns-sd`](https://crates.io/crates/mdns-sd) — pure-Rust, async-friendly, well-maintained.

## The advertise + browse loop

`LanDiscovery::start()` does five things, in order:

1. Constructs a fresh `mdns_sd::ServiceDaemon` (binds UDP `5353` on `0.0.0.0`)
2. Builds a `ServiceInfo` with this instance's TXT records:

   ```rust
   let properties = [
       ("version",     version.as_str()),
       ("hostname",    hostname.as_str()),
       ("instance_id", instance_id.as_str()),
   ];
   ```

3. Calls `daemon.register(service_info)` to advertise
4. Calls `daemon.browse(SERVICE_TYPE)` to start watching for peers
5. Spawns a `tokio::task::spawn_blocking` thread that loops on `receiver.recv()`, dispatching `ServiceResolved` / `ServiceRemoved` events to `handle_event()`

The spawned thread holds its own `Arc<LanDiscovery>` clone for the lifetime of the loop. That detail matters — see *Live disable* below.

## Hostname normalization

`mdns-sd` requires the host name passed to `ServiceInfo::new()` to end with `.local.`. Bare OS hostnames (`claudius`, `Macbook-Pro`, `pi-lab`) fail the validation outright, causing `LAN discovery start failed: Hostname must end with '.local.'`.

`mdns_hostname(os_hostname: &str) -> String` normalizes any input to a valid form. It:

- Appends `.local.` to a bare name (`claudius` → `claudius.local.`)
- Passes through an already-FQDN name unchanged (`claudius.local.` → `claudius.local.`)
- Adds the trailing dot if missing (`claudius.local` → `claudius.local.`)
- Strips a stray trailing dot first so it never doubles the suffix

The helper is unit-tested under `#[cfg(test)] mod tests` in the same file; cases include the bare-hostname path (the most common Windows case), the already-suffixed pass-through, and idempotency under repeated calls.

## The controller

`LanDiscoveryController` is the public surface stored in `AppState.lan_discovery`. It owns:

- `slot: Arc<RwLock<Option<Arc<LanDiscovery>>>>` — the runtime-swappable daemon
- `instance_id`, `hostname`, `version`, `port` — the start arguments, captured at construction
- `event_bus: Arc<EventBus>` — for broadcasting peer-list and error events

### `apply(enabled: bool)`

This is the idempotent transition function. It holds the slot's **write lock** for the entire check-and-modify, which closes a TOCTOU race that earlier review feedback flagged (two concurrent setconfig calls could otherwise both see `is_running = false` and both spawn a daemon).

```rust
pub fn apply(&self, enabled: bool) {
    let mut slot = self.slot.write();           // exclusive
    let is_running = slot.is_some();
    match (enabled, is_running) {
        (true, false)  => /* construct LanDiscovery, populate slot */,
        (false, true)  => /* lan.shutdown(); *slot = None */,
        _              => /* no-op */,
    }
}
```

### Live disable

Disabling LAN discovery looks deceptively simple — drop the `Arc` and `Drop for LanDiscovery` should run, unregistering from mDNS and shutting down the daemon. **Except it doesn't**, because the event-loop thread holds its own `Arc<LanDiscovery>` clone (see *advertise + browse loop* step 5). As long as that thread is blocked on `receiver.recv()`, the refcount stays ≥ 1 and `Drop` never fires.

The fix is an explicit `shutdown()` method on `LanDiscovery`:

```rust
pub fn shutdown(&self) {
    let _ = self.daemon.unregister(&self.service_fullname);
    let _ = self.daemon.shutdown();
}
```

The controller's `apply(false, true)` branch calls `shutdown()` first, *then* clears the slot. `daemon.shutdown()` closes the mDNS socket synchronously, which causes the receiver to return `Err`, the event loop to exit, the spawned thread to drop *its* `Arc`, and finally `Drop for LanDiscovery` to fire (idempotently — it just calls `shutdown()` again, which is a no-op once the socket is already closed).

## Live toggle wiring

Two paths flip `network:lan_discovery`:

| Path | Where | When |
|---|---|---|
| HostPopover toggle | `frontend/app/statusbar/HostPopover.tsx` → `RpcApi.SetConfigCommand` | Click |
| Direct edit | User edits `~/.agentmux/config/settings.json` | Manual |

Both end up at the WS handler `COMMAND_SET_CONFIG` in `agentmux-srv/src/server/websocket.rs`. After updating the in-memory `SettingsType`, the handler calls:

```rust
lan_discovery_setconfig.apply(merged_settings.network_lan_discovery);
```

The controller decides whether anything actually needs to happen. If the toggle stays the same value as before (no-op), `apply()` short-circuits. If it flipped, `apply()` starts or stops the daemon.

Direct edits to `settings.json` currently take effect on the next restart — the fs-watcher path doesn't invoke the controller yet. The HostPopover toggle is the primary path and is what the [user guide](/lan-discovery/) recommends.

## Events emitted

The Warden and HostPopover both subscribe to two WS events:

| Event | When | Payload |
|---|---|---|
| `laninstances` | Peer joins, leaves, or is re-resolved | `Vec<LanInstance>` (full peer list) |
| `laninstances:error` | Daemon `start()` returned `Err` | `{ "error": "<message>" }` |

Frontend handlers live in `frontend/app/store/global.ts` — `setLanInstancesAtom` and `setLanDiscoveryErrorAtom`. Successful list broadcasts also clear the error atom, so a successful re-enable wipes any stale "blocked" warning.

## HTTP endpoint

`GET /api/lan-instances` (public route, alongside `/schema/*` and `/docsite/*`) returns the current peer list as JSON. The Warden's LAN section polls this every 5 s; the Warden uses HTTP rather than the WS event stream for the initial render (cleaner cold-start, no race) and for refresh-on-mount.

## Boot semantics

`agentmux-srv/src/main.rs` constructs a controller at startup, regardless of the setting value:

```rust
let lan_discovery = Arc::new(LanDiscoveryController::new(
    config.instance_id.clone(),
    hostname,
    version.clone(),
    web_addr.port(),
    event_bus.clone(),
));
lan_discovery.apply(config_watcher.get_settings().network_lan_discovery);
```

If the setting is `false` (the default), `apply()` is a no-op and no daemon starts. If `true`, the daemon comes up and starts advertising as part of boot. The setting can be flipped at any point afterwards without touching the controller — the *controller* always exists; the *daemon* slot is what flips.

## Why opt-in by default

Earlier history kept LAN discovery off by default to avoid the Windows Firewall prompt that the `0.0.0.0:5353` bind triggers. Flipping the default to `true` would resurrect that prompt on every fresh install. The HostPopover toggle is the discoverability fix: the operator initiates the opt-in, so the firewall prompt arrives as the *expected consequence* of clicking the toggle rather than a surprise on launch.

See `specs/windows-firewall-fix.md` in the main repo for the original investigation.

## Source

- `agentmux-srv/src/backend/lan_discovery.rs` — controller + daemon + tests
- `agentmux-srv/src/main.rs` — boot wiring
- `agentmux-srv/src/server/websocket.rs` (setconfig handler) — live toggle hook
- `agentmux-srv/src/server/mod.rs` — `/api/lan-instances` route + `AppState.lan_discovery`
- `frontend/app/statusbar/HostPopover.tsx` — UI toggle + peer-list popover
- `frontend/app/store/global.ts` — `lanInstancesAtom`, `lanDiscoveryErrorAtom`, event handlers
- `specs/lan-awareness-and-embedded-jekt-api.md` — the broader plan (Phases 1–5)
- `specs/lan-discovery-toggle.md` — the toggle UX + live-daemon-lifecycle spec
- `specs/windows-firewall-fix.md` — the original firewall analysis

## See also

- [LAN discovery (user guide)](/lan-discovery/) — how to turn it on, what to expect
- [Warden architecture (internals)](/internals/warden/) — the Warden's LAN section is the primary visualization
- [Interagent event bus](/internals/interagent-comms/) — the WS-event substrate the `laninstances` events ride
