---
title: LAN discovery (internals)
description: How mDNS peer discovery and the LAN listeners are wired — service record, UDP probe responder, listener supervisor, live toggle, and the events they emit.
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases.
:::

This page is the architectural companion to the user-facing [LAN discovery](/lan-discovery/) page. It covers what runs at startup and what runs on toggle. For the security side, see [Network exposure](/security/network-exposure/).

## Module layout

Two modules own everything LAN-facing:

| Item | File | Role |
|---|---|---|
| `LanListenerSupervisor` | `crates/srv/src/backend/lan_listeners.rs` | Binds and drops the LAN-facing listeners, and decides whether mDNS may advertise |
| `STARTUP_BIND_ADDR` | `crates/srv/src/backend/lan_listeners.rs` | `127.0.0.1:0`: the server's startup listeners are always loopback-only |
| `SERVICE_TYPE` | `crates/srv/src/backend/lan_discovery.rs` | `_agentmux._tcp.local.`, the mDNS service advertised and browsed |
| `LanInstance` | `crates/srv/src/backend/lan_discovery.rs` | One peer: `instance_id`, `hostname`, `version`, `address`, `port`, `auth_key` (the peer's `lan_key`), `agents`, `first_seen`, `last_seen`, `other_ttl_secs` |
| `LanDiscovery` | `crates/srv/src/backend/lan_discovery.rs` | The running daemon: owns the `ServiceDaemon`, the peer map, and three background tasks |
| `LanDiscoveryController` | `crates/srv/src/backend/lan_discovery.rs` | The toggleable wrapper stored in `AppState.lan_discovery`: start arguments, a swappable daemon slot, and the agent and public-key lookup caches |
| `mdns_hostname()` | `crates/srv/src/backend/lan_discovery.rs` | Appends `.local.` to a bare hostname, as `mdns-sd` requires |

The mDNS implementation is the [`mdns-sd`](https://crates.io/crates/mdns-sd) crate, version 0.12.

## The LAN listeners

The server binds its web and ws ports on `127.0.0.1` at startup, whatever the setting says (`bind_listeners_and_network` in `crates/srv/src/bootstrap/network.rs`). LAN reachability is added by `LanListenerSupervisor`, which binds the **same two ports** again on each non-loopback interface address:

- `lan_bind_addresses()` returns every IPv4 address and every IPv6 address except link-local (`fe80::/10`), from all interfaces;
- each address gets both ports or neither; a failed bind is logged and skipped;
- the listeners serve the same router as loopback: the full server API, with its normal authentication;
- a sweep every 20 seconds (`RECONCILE_INTERVAL_SECS`) re-reads the interface list, so a DHCP renewal, Wi-Fi/Ethernet switch or VPN change is picked up without a toggle.

The startup listeners are deliberately never a wildcard `0.0.0.0` bind. On Linux a wildcard socket on the port makes the per-address binds fail with `EADDRINUSE`, and on Windows and macOS it leaves two sockets on one port.

`sync_advertising` ties mDNS to reachability: the supervisor calls `LanDiscoveryController::apply(enabled && has_lan_listener())` after every reconcile, so the instance never advertises an address nothing listens on.

## The advertise and browse loop

`LanDiscovery::start()`:

1. Constructs a `mdns_sd::ServiceDaemon`, which opens its UDP 5353 multicast sockets.
2. Builds a `ServiceInfo` with instance name `agentmux-<hostname>-<port>` (`mdns_instance_label`, unique per instance and free of dots), host name `<hostname>.local.`, the web port, `enable_addr_auto()` so the daemon fills in and tracks the machine's addresses, and these TXT properties:

   ```rust
   let properties = [
       ("version",     version.as_str()),
       ("hostname",    hostname.as_str()),
       ("instance_id", instance_id.as_str()),
       ("auth_key",    auth_key.as_str()),
   ];
   ```

   `instance_id` is the server's `--instance` argument, which the launcher sets to `v<version>`. `auth_key` carries the **`lan_key`** (`Config::lan_key` in `crates/srv/src/config.rs`), a per-launch key accepted only by `lan_or_full_auth_middleware`'s routes (jekt delivery with and without files, agent lookup, agent names, the one-live-instance check, the fleet feed and the remote-operation door). The TXT field keeps the name `auth_key` for compatibility with older peers.
3. Registers the service, then browses `SERVICE_TYPE`.
4. Spawns three background tasks, each holding its own `Arc<LanDiscovery>`:
   - the **event loop** (`spawn_blocking`), which handles `ServiceResolved` events and skips resolutions of this instance itself (same port and one of its own addresses);
   - the **UDP probe responder** on `0.0.0.0:47891`. It answers `{"type":"agentmux_discover","v":1}` from private, link-local and loopback source addresses with `instance_id`, `hostname`, `version`, `port` and `auth_key` (the `lan_key`). If another local instance already holds the port, the bind fails quietly and mDNS carries on;
   - the **agent-names refresh**, which every 30 seconds asks each peer's `GET /agentmux/reactive/agent-names` for its agent list, authenticating with that peer's advertised `lan_key`. Responses are capped at 64 KiB, 500 names, and 256 characters per name, because mDNS advertisements are unauthenticated and a peer may be hostile.

A peer is kept until its `last_seen` is older than its own advertised record TTL, clamped to between 300 and 9,000 seconds. `ServiceRemoved` events don't delete peers: they fired on ordinary TTL churn, and re-resolution after a removal came back with an empty TXT record.

## Hostname normalization

`mdns-sd` requires the host name passed to `ServiceInfo::new()` to end in `.local.`. `mdns_hostname()` normalizes any input:

- appends `.local.` to a bare name (`claudius` → `claudius.local.`);
- passes an already-normalized name through (`claudius.local.` → `claudius.local.`);
- adds the trailing dot if it's missing (`claudius.local` → `claudius.local.`);
- strips a stray trailing dot first, so it never doubles the suffix.

It is unit-tested in the same file.

## The controller

`LanDiscoveryController::apply(enabled)` is idempotent. It holds the slot's write lock for the whole check-and-modify, so two concurrent calls can't both start a daemon:

```rust
pub fn apply(&self, enabled: bool) {
    let mut slot = self.slot.write();
    let is_running = slot.is_some();
    match (enabled, is_running) {
        (true, false) => { /* LanDiscovery::start(..); on error broadcast laninstances:error */ }
        (false, true) => { /* d.shutdown(); *slot = None; broadcast an empty laninstances */ }
        _ => {}
    }
}
```

The controller also answers the two lookups the reactive bus needs:

- `find_agent(agent_id)` asks every peer's `GET /agentmux/reactive/agent?id=<agent_id>` concurrently and takes the first 2xx. Positive and negative answers are cached for 60 seconds.
- `find_agent_lan_pubkey(agent_id)` makes the same query for a sender's LAN public key, used to verify LAN signatures. It is rate-limited to 10 peer fan-outs per second; a rate-limited lookup is reported as `RateLimited`, and a name that is a former agent id as `Renamed`; the verifier treats both as a failed signature, not as "no key". See [Jekt protocol](/internals/jekt-protocol/#52-lan-ed25519).

The peer list also serves one live instance per agent. `bootstrap.rs` hands the controller to `agent_admission::set_lan_discovery`, and `agent_admission::lan_holders(uid)` asks every peer's `GET /agentmux/agent/holding?uid=<uid>` concurrently, with the peer's `lan_key` and a 1.5-second timeout. It runs before an agent starts and every 30 seconds while it runs (every sixth 5-second lease renewal). Answers from this host are ignored, unreachable peers and peers without the route are skipped, and `peer_wins` decides between two hosts running the same agent: the earlier start wins, and starts within 10 seconds of each other go to the lower hostname. See [one live instance per agent](/security/trust-model/#one-live-instance-per-agent).

### Live disable

The background tasks each hold an `Arc<LanDiscovery>`, so dropping the controller's reference never runs `Drop`. `shutdown()` stops everything explicitly:

```rust
pub fn shutdown(&self) {
    // stop the UDP responder and the agent-names refresh via their cancel channels
    let _ = self.daemon.unregister(&self.service_fullname);
    let _ = self.daemon.shutdown();
}
```

Shutting down the daemon closes its sockets, so the event loop's receiver returns an error and the loop exits. `Drop` calls `shutdown()` again, which is a no-op by then.

## Live toggle wiring

| Path | Where | Takes effect |
|---|---|---|
| Host popover toggle | `frontend/app/statusbar/HostPopover.tsx` → `RpcApi.SetConfigCommand` | Immediately |
| Hand edit of `settings.json` | The settings file | At the next start of AgentMux |

The toggle reaches the WebSocket `setconfig` handler in `crates/srv/src/server/websocket.rs`. It writes the setting to disk, updates the in-memory settings, and calls:

```rust
lan_listeners.apply(lan_enabled);
```

Only the listener supervisor is driven there. It binds or drops the listeners and then gates mDNS through `sync_advertising`, as above. Calling the discovery controller directly would advertise before any listener is bound. The settings-file watcher doesn't call either, which is why hand edits wait for a restart.

## Events emitted

| Event | When | Payload |
|---|---|---|
| `laninstances` | A peer is resolved or refreshed, or discovery is turned off (empty list) | `Vec<LanInstance>`, the full peer list |
| `laninstances:error` | `LanDiscovery::start()` failed | `{ "error": "<message>" }` |

The frontend handlers are in `frontend/app/store/global.ts` (`setLanInstancesAtom`, `setLanDiscoveryErrorAtom`). A successful list broadcast clears the error, so a successful re-enable removes a stale warning.

## HTTP endpoint

`GET /api/lan-instances` returns the current peer list as JSON, **including each peer's `lan_key`**. It sits behind the normal full-key `auth_middleware`, like every other route except the health check, the WhatsApp webhook and the `lan_key` routes. The network pill in the status bar reads the same list.

## Remote operations and fleet sync

The same peer list carries typed requests between machines (`crates/srv/src/server/remote_ops/`). The door is `POST /agentmux/remote/op`, one of the `lan_key` routes, but it is opened by a signature, not by the key (`receive.rs`). It checks, in order, that the call came with the `lan_key`, that `network:remote_ops` is not `false`, the shape and size of the request, that the audience is this instance's `lan_key`, that the timestamp is within 60 seconds and after this srv started, that the requesting agent's key is pinned here, the signature, and the certificate that names the hosting install. Then it looks the operation up (`lookup` in `mod.rs`): `app.version`, `app.health`, `app.activity`, `app.logs.tail`, `app.history_reclaim`, `agents.start`, `agents.open`, `agents.stop`, `agents.set_seat`, `agents.env_get`, `agents.env_set`, `tasks.enqueue`, `tasks.list`, `identity.accounts`, `identity.switch`, `identity.signin.start`, `.notice` and `.finish`, and `memory.global.put`, `.remove` and `.list`. A change, and a read of personal data, also needs an install this instance trusts (`lan_continuity::instance_trust`). An operation runs for at most 25 seconds, and the nonce store answers a repeated request with the first answer. The sending half is `send.rs` (`POST /api/v1/agent/remote/op`): it resolves the `host` to one LAN peer, signs with the asking agent's LAN key and writes `remote.request` to the audit trail.

`crates/srv/src/server/remote_ops/fleet_sync.rs` keeps fleet-scoped Global Memory in step over the same transport. Every 15 seconds it fingerprints what this machine holds for the fleet and, for each proven peer whose last sync saw another fingerprint (or that has just appeared, which is how a machine that was offline catches up), lists what the peer holds and sends what it lacks or has older. A peer is synced again after 10 minutes in any case, and a peer that failed is left alone for 5 minutes. The merge rule (newest `updated_at` wins, a larger content hash on a tie, a removal being a write) is in `crates/srv/src/backend/fleet_memory.rs`.

## Boot semantics

1. `bind_listeners_and_network` (`crates/srv/src/bootstrap/network.rs`) binds the loopback listeners, constructs the `LanDiscoveryController` with the hostname, version, web port and `lan_key`, constructs the `LanListenerSupervisor`, and links the two with `set_discovery`. It does **not** start discovery.
2. `main.rs` builds the router, hands it to the supervisor with `set_router`, calls `lan_listeners.apply(<network:lan_discovery setting>)`, and starts the reconcile sweep.

With the setting off (the default), nothing LAN-facing starts. With it on, the listeners bind and mDNS starts during boot.

## Why it's opt-in

Turning LAN discovery on exposes the full server API on the network, broadcasts a key that lets anyone on the LAN send messages to agents, and makes Windows Firewall prompt. Keeping it off by default means a fresh install does none of that; the toggle makes the firewall prompt an expected consequence of a user's choice.

## Source

- `crates/srv/src/backend/lan_discovery.rs` — daemon, controller, UDP responder, lookups, tests
- `crates/srv/src/backend/lan_listeners.rs` — LAN listener supervisor
- `crates/srv/src/bootstrap/mod.rs`, `crates/srv/src/main.rs` — boot wiring
- `crates/srv/src/server/websocket.rs` (`setconfig` handler) — live toggle
- `crates/srv/src/server/mod.rs` — `/api/lan-instances` and the `lan_key` routes
- `crates/srv/src/backend/agent_admission.rs` (`lan_holders`, `peer_wins`), `crates/srv/src/server/agent_takeover.rs` (`handle_agent_holding`) — the LAN tier of one live instance per agent
- `crates/srv/src/server/remote_ops/` — typed requests between machines; `crates/srv/src/backend/fleet_memory.rs` — the fleet Global Memory merge
- `crates/srv/src/config.rs` — `lan_key`
- `frontend/app/statusbar/HostPopover.tsx` — toggle and peer list
- `frontend/app/store/global.ts` — `lanInstancesAtom`, `lanDiscoveryErrorAtom`, event handlers

Design documents in the main repository (designs, not a description of current behavior): `specs/lan-awareness-and-embedded-jekt-api.md`, `specs/lan-discovery-toggle.md`, `specs/windows-firewall-fix.md`.

## See also

- [LAN discovery (user guide)](/lan-discovery/) — turning it on, what it exposes
- [Network exposure](/security/network-exposure/) — every listener
- [LAN discovery](/lan-discovery/#the-network-pill) — the network pill's LAN peers
- [Interagent communication](/internals/interagent-comms/) — how messages use LAN peers
