---
title: "Network exposure"
description: "Every port AgentMux opens, on what interface, with what auth — for firewall configurators and IT teams."
---

This page is for IT teams, network admins, and security reviewers who need to know exactly what AgentMux puts on the wire.

## Ports at a glance

| Process | Port | Interface | Purpose | Auth | Default |
|---|---|---|---|---|---|
| CEF host (`agentmux-cef`) | random ephemeral | `127.0.0.1` | Serves the SolidJS frontend over HTTP and the IPC bridge | Bearer token (one-shot, per-launch) | On |
| Sidecar (`agentmux-srv`) | random ephemeral | `127.0.0.1` | WebSocket + HTTP RPC for the frontend, agent panes, and inter-instance forwarding | `X-AuthKey` header (per-launch UUIDv4) | On |
| mDNS discovery (sidecar) | `5353` | `0.0.0.0` | Announces this instance to other AgentMux instances on the LAN | None (read-only beacon) | **Off** |
| Sidecar LAN listener (v0.46+) | random ephemeral | LAN interface | Accepts forwarded messages from peer AgentMux instances when LAN discovery is on | `X-AuthKey` header (same auth as loopback listener) | **Off** (follows LAN discovery toggle) |
| Cloud MuxBus poller (sidecar) | n/a (outbound) | n/a | Inbound message channel from a hosted relay | Bearer token configured at setup | **Off** |

The TL;DR: **no inbound network listener accepts non-loopback traffic by default.** AgentMux requires no inbound firewall rule.

## Sidecar HTTP / WebSocket

The sidecar listens on a random ephemeral port (different each launch), bound to `127.0.0.1` only. Every route — except `/` (health check) — requires authentication.

Auth surface:

- **`X-AuthKey` header on every HTTP request.** Required.
- **`?authkey=` query parameter on `/ws` only.** The browser WebSocket API can't set custom headers; this is the documented exception. Every other route rejects query-string auth (it leaks into logs, history, and `Referer`). See the [trust model](/security/trust-model/) for the broader picture.

CORS:

- The sidecar reflects only loopback origins (`http://127.0.0.1:*` and `http://localhost:*`). External origins receive no `Access-Control-Allow-Origin` header, so a malicious web page can't drive the sidecar even if it discovers the port.
- This explicitly defends against drive-by CSRF from any browser tab the user happens to have open on a different site.

What this does *not* protect against:

- **DNS rebinding attacks** targeting `127.0.0.1` from a malicious web page. The CORS allow-list closes this in practice (a rebound page still presents as the attacker's origin), but if you're hardening a multi-tenant environment, consider host-header validation as defence-in-depth.
- **Same-machine non-AgentMux processes.** Anything running as the same user can read the auth-key file (`~/.agentmux/authkey.dev`, mode `0600`). The `0600` ACL is the boundary; root or sudo on a shared box defeats it. See [trust model](/security/trust-model/).

## CEF host IPC server

The CEF host runs its own small HTTP server on a separate random ephemeral port (also `127.0.0.1` only). The frontend talks to it for things that don't belong on the sidecar — clipboard, window management, file pickers, etc.

Auth is a bearer token injected at startup. The CORS posture mirrors the sidecar: loopback-only origins.

## mDNS discovery (opt-in)

When enabled, AgentMux broadcasts on `0.0.0.0:5353` to announce its presence to other AgentMux instances on the local network. This is the only socket that ever binds to a non-loopback interface, and it's **disabled by default**.

When mDNS is on, the data broadcast is:

- Instance ID (a UUID, not sensitive)
- Local sidecar URL (`http://127.0.0.1:<port>`)

No session content, no auth keys, no credentials. The mDNS broadcast itself is read-only — nobody can drive AgentMux through the mDNS announcement; it only reveals the instance's real IP and port. However, enabling LAN discovery also enables LAN-tier jekt forwarding (v0.46+): a LAN-enabled instance will open outbound TCP connections to peer sidecars using their discovered IP+port and auth key, and it will accept inbound TCP on a LAN interface from authenticated peers. See [Cross-instance forwarding](#cross-instance-forwarding) below.

If you don't want LAN broadcast: don't enable mDNS. It stays off.

## Cloud MuxBus poller (opt-in)

If you configure a remote MuxBus relay, the sidecar **outbound-polls** that URL on an interval. Inbound messages arrive over that polled connection; no inbound port is opened.

The poller URL and bearer token are user-configurable through the in-pane `/agentmux/reactive/poller/config` endpoint (which requires auth — see audit fix C2 in `agentmux@v0.33.790`). Configure once; rotate the token by re-configuring.

If you don't want any cloud connectivity: don't configure the poller. It stays off.

## Cross-instance forwarding

AgentMux supports two forwarding scopes, both opt-in:

**Same-machine forwarding** — Multiple instances on the same machine forward inject messages to each other over `127.0.0.1`. The file-based agent registry (`~/.agentmux/agents/`, mode `0600` per file) contains each instance's URL plus auth key. Peers use these credentials when forwarding.

**LAN forwarding (v0.46+)** — When LAN discovery is enabled, forwarding extends to peer instances on the LAN. The sender reads the peer's real IP and port (discovered via mDNS) and auth key (from the local registry), then connects directly over TCP. The peer sidecar authenticates every request with `X-AuthKey`. No traffic passes through the cloud relay; the forwarding is direct peer-to-peer.

Network implications of enabling LAN discovery + forwarding:

- The local sidecar opens outbound TCP connections to peer IP addresses on their backend port.
- The local sidecar also binds a LAN-interface listener so it can accept forwarded messages from peers — this is the one case where a sidecar socket accepts non-loopback connections. **This listener is only active when LAN discovery is on.**
- Firewall rule required: allow inbound TCP on the ephemeral sidecar port from trusted LAN peers (or restrict to the LAN subnet).

## Firewall configuration

For a typical workstation: **no firewall rule needed.** AgentMux runs entirely on loopback.

For a managed deployment that wants belt-and-suspenders:

- Allow outbound HTTPS to whatever LLM providers your agents use (Anthropic, OpenAI, Google, GitHub).
- Allow outbound to your tool catalog hosts (typically GitHub release assets).
- If using the cloud MuxBus poller: allow outbound to that relay.
- If using LAN discovery + forwarding (v0.46+): allow inbound TCP from trusted LAN peers on the ephemeral sidecar port. Without this rule, incoming LAN-forwarded messages are dropped by the OS firewall before AgentMux sees them.
- If NOT using LAN: block inbound to ports 1024-65535 from non-loopback interfaces (defence-in-depth — AgentMux doesn't accept inbound on those when LAN is off, but this catches misconfigurations).

## What we don't put on the wire

- **No SNMP, no LDAP, no SMB, no Kerberos.** Not part of the product.
- **No telemetry endpoint.** See [data sovereignty](/security/data-sovereignty/).
- **No update endpoint.** See [update model](/security/update-model/).
- **No license-server check-in.** Open source under Apache 2.0.

---

**Source-of-truth references**:
- `agentmux-srv/src/main.rs` — sidecar bind (`127.0.0.1` only); mDNS opt-in
- `agentmux-srv/src/server/mod.rs` — CORS predicate + auth middleware
- `agentmux-cef/src/ipc.rs` — host IPC server
- `agentmux-srv/src/backend/reactive/registry.rs` — cross-instance forwarding registry (`0600` files)
- `agentmux-srv/src/server/reactive.rs` — poller config endpoint

**Marketing claims this page substantiates**: "data sovereignty by default", "runs on your machine" on [agentmux.ai](https://agentmux.ai).
