---
title: "Network exposure"
description: "Every socket AgentMux listens on, what it accepts, and what AgentMux connects out to, for firewall configuration and security review."
---

This page is for IT teams, network admins and security reviewers who need to know exactly what AgentMux puts on the wire.

## Listeners at a glance

| Listener | Process | Bind | Protocol | Authentication | When |
|---|---|---|---|---|---|
| AgentMux server (web and ws ports) | `agentmux-srv` | `127.0.0.1`, two ephemeral ports | HTTP, WebSocket | `X-AuthKey` (instance auth key). Public: `GET /`, `/webhook/whatsapp` | Always |
| AgentMux server, LAN listeners | `agentmux-srv` | The same two ports on every non-loopback interface address | HTTP | Only four LAN-peer routes, each taking the `lan_key` or the auth key. Public: `GET /`, `/health`, `/webhook/whatsapp` | LAN discovery on (default **off**) |
| mDNS | `agentmux-srv` | UDP 5353, multicast | mDNS / DNS-SD | None | LAN discovery on |
| UDP discovery responder | `agentmux-srv` | `0.0.0.0:47891` UDP | JSON | None; answers only private, link-local and loopback source addresses | LAN discovery on |
| Dev proxy | `agentmux-srv` | `127.0.0.1:8090` | HTTP reverse proxy | None | Always (skipped if the port is taken) |
| OAuth callback | `agentmux-srv` | `127.0.0.1`, ephemeral | HTTP, one request | OAuth `state` and PKCE | Only during a browser sign-in to an account you configured OAuth for |
| Host IPC server | `agentmux-cef` | `127.0.0.1`, ephemeral | HTTP | Bearer token on `/ipc` and `/agentmux/browser/*`. Public: `/health`, the frontend's static files | Always |
| Chromium remote debugging (CDP) | `agentmux-cef` | Loopback; port 9222 (release), 9223 (dev), or a free port | HTTP, WebSocket | **None** | Dev builds, or when `AGENTMUX_CDP_PORT` turns it on. **Off** in release builds by default |
| Launcher IPC | `agentmux-launcher` | Windows named pipe `\\.\pipe\agentmux-<hash>\command`; Unix socket in `$XDG_RUNTIME_DIR/agentmux/` or `/tmp/agentmux-<uid>/` | Newline-delimited JSON | None | Always |
| Server IPC (Windows) | `agentmux-srv` | Named pipe `\\.\pipe\agentmux-<hash>\srv-command` | Newline-delimited JSON | None | Windows, when started by the launcher |
| Crash monitor (Windows) | `agentmux-srv` | Unix-domain socket `C:\CrashDumps\agentmuxsrv\monitor.sock` | Minidump IPC | None | Windows, always |

`agentmux-mcp`, the MCP server each agent runs, talks to its agent over stdio and opens no listener.

**With LAN discovery off, nothing listens on a non-loopback address.** Every TCP listener binds `127.0.0.1`, and the pipes and sockets are local by construction. Loopback is shared by every account on the machine, though: other OS users can reach the loopback listeners too. That matters most for the [remote-debugging port](#chromium-remote-debugging-port), when it is on.

## The AgentMux server

`agentmux-srv` binds two ports on `127.0.0.1`, both chosen by the OS at each launch, and serves the same API on both. The bind address is fixed in code (`STARTUP_BIND_ADDR` in `agentmux-srv/src/backend/lan_listeners.rs`); no setting changes it.

Authentication (`auth_middleware` in `agentmux-srv/src/server/mod.rs`):

- Every route requires the `X-AuthKey` header to equal the instance auth key. The key is a UUIDv4 the launcher generates at each launch.
- `/ws` also accepts the key as an `?authkey=` query parameter, because the browser WebSocket API can't set headers. No other route accepts it in the query string.
- Unauthenticated: `GET /` returns `{"status":"ok","version":"<version>"}`. `/webhook/whatsapp` is the receiver for the WhatsApp bridge; it checks Meta's verify token and `X-Hub-Signature-256` HMAC instead of the auth key, and returns 503 until that bridge is set up.
- Every response, including unauthenticated ones, carries an `x-agentmux-srv-version` header.

CORS reflects only the origins `http://127.0.0.1[:port]` and `http://localhost[:port]`. A web page from any other origin can't read responses. A page still can't call any authenticated route without the key. `/ws` also refuses a WebSocket upgrade whose `Origin` header is anything other than those two (`ws_origin_guard`); a client that sends no `Origin`, such as the launcher or `agentmux-mcp`, is allowed. Every key and token a caller presents is compared in constant time (`agentmux-common/src/secret_eq.rs`).

Every terminal pane and host agent process receives the auth key as `AGENTMUX_AUTH_KEY`. See the [trust model](/security/trust-model/) for what that means. [Container agents](/security/trust-model/#container-agents) get a narrower per-agent token in the same variable instead.

## LAN listeners

When you turn on LAN discovery, `LanListenerSupervisor` binds the server's two ports again on **every non-loopback interface address**: all IPv4 addresses, and all IPv6 addresses except link-local. That includes VPN and virtual adapters. It re-checks the interface list every 20 seconds, and removes the listeners when you turn LAN discovery off.

These listeners serve **only the routes LAN peers need** (`build_routers_with` in `agentmux-srv/src/server/mod.rs`, the `lan` router), with no filtering by source address. From any network that can reach one of those addresses:

- anyone can call `GET /` and `/health` (the version) and the WhatsApp webhook;
- anyone holding the `lan_key` can call four routes: send a jekt, look up one agent, list agent names, and ask whether an agent UID is running here (see [what the `lan_key` unlocks](/security/reactive-event-bus/#who-may-call-the-bus));
- nothing else. Every other route, `/ws` included, returns 404 on a LAN listener, even with the full auth key, and the LAN listeners never serve the frontend.

The mobile-pairing QR code in the host popover (**Show QR code**) still contains the full auth key, together with this machine's LAN address and port. Over the network the key reaches only the four routes above, but on this machine it gives full control until AgentMux restarts, so don't show the code where others can see it.

The `lan_key` is sent in cleartext to anyone on the local network (next section). Turn LAN discovery on only on networks you trust, and restrict the listeners with your host firewall to the peers or subnet you expect.

## mDNS and the UDP probe: what they reveal

While LAN discovery is on and at least one LAN listener is bound, the server advertises itself over mDNS as service type `_agentmux._tcp.local.`:

- instance name `agentmux-<hostname>-<port>`, host name `<hostname>.local.`;
- the server's web port and the machine's IP addresses;
- TXT record: `version`, `hostname`, `instance_id` (`v` plus the version, for example `v0.57.6`), and `auth_key`, which holds the **`lan_key`**, not the full auth key.

It also listens on UDP port 47891. A datagram `{"type":"agentmux_discover","v":1}` from a private, link-local or loopback address gets a unicast reply:

```json
{ "type": "agentmux_discover_response", "v": 1, "instance_id": "v0.57.6",
  "hostname": "<hostname>", "version": "0.57.6", "port": <web port>, "auth_key": "<lan_key>" }
```

Neither channel has confidentiality or authentication. Anyone on the broadcast domain learns the machine's hostname, AgentMux version, server port and `lan_key`, and can then send messages to its agents. The `lan_key` is regenerated at each launch.

While LAN discovery is on, the server also contacts every peer it discovers, presenting that peer's advertised `lan_key`:

- every 30 seconds it asks each peer for its agent names; responses are capped at 64 KiB;
- before an agent starts, and every 30 seconds while it runs, it asks each peer whether it is running that agent (`GET /agentmux/agent/holding?uid=<uid>`, 1.5-second timeout), so one agent doesn't run on two computers (`agentmux-srv/src/backend/agent_admission.rs`).

A device that fakes an mDNS advertisement can make the server send these requests to an address of its choosing. Its answers aren't authenticated either: by claiming to hold an agent, it can make this instance refuse to start that agent, or stop it.

## Dev proxy

`agentmux-srv` always starts a reverse proxy on `127.0.0.1:8090` (`agentmux-srv/src/backend/dev_proxy.rs`). It routes a request whose `Host` is `<key>.localhost` to a dev server an agent registered with the `RegisterDevServer` tool (a port inside that agent's container). Unregistered hosts get 404. It has no authentication: any local process, including other users' processes, can reach a registered dev server through it. If port 8090 is taken, the proxy logs a warning and doesn't start.

## Host IPC server

The CEF host (`agentmux-cef`) runs an HTTP server on an ephemeral `127.0.0.1` port (`agentmux-cef/src/ipc.rs`). It serves the frontend's static files and `/health` without authentication. `/ipc` and the browser-automation routes `/agentmux/browser/*` require `Authorization: Bearer <token>`, a UUIDv4 generated at each start of the host.

- The token is passed to the frontend in the page URL. It is also written to an `ipc-port-<hash>` file in the data directory, with default file permissions (on Unix the data root itself is owner-only), so a second launch can find the running instance.
- `/ipc` returns the server auth key to the frontend (`get_auth_key`), so the token is as valuable as the auth key itself.
- The CORS layer is fully permissive (`CorsLayer::permissive()`): the bearer token is the only barrier.

## Chromium remote-debugging port

Chromium's remote-debugging (DevTools Protocol) server is **off in release builds** (`agentmux-cef/src/cdp_port.rs`). AgentMux doesn't need it: its own browser automation (the `/agentmux/browser/*` routes, which back the `Browser*`, `UIScreenshot`, `UIClick` and `UIQuery` agent tools) drives the DevTools Protocol inside the process (`agentmux-cef/src/browser_api/cdp.rs`), and **Inspect Element** opens Chromium's built-in DevTools window.

The `AGENTMUX_CDP_PORT` environment variable, read when AgentMux starts, turns it on or off:

| `AGENTMUX_CDP_PORT` | Server |
|---|---|
| Unset or empty | Off in release builds. On in dev builds, preferring port 9223 |
| A port from 1024 to 65535 | On, preferring that port |
| `1`, `on`, `true`, `yes` or `auto` | On, preferring 9222 (release) or 9223 (dev) |
| `0`, `off`, `false` or `no` | Off, dev builds included |

When the preferred port is taken, it uses an OS-assigned free port. The port actually used is written to `authkey.dev` in the data directory.

When the server is on, AgentMux doesn't set `--remote-debugging-address`, so Chromium binds it to loopback, its default. The server has **no authentication**. AgentMux starts Chromium with `--remote-allow-origins` set to `http://127.0.0.1:<port>` and `http://localhost:<port>` only (`agentmux-cef/src/app/mod.rs`, `remote_allow_origins`), so a web page from any other origin can't open a DevTools WebSocket. A client that sends no `Origin` header, which any local program can do, is not stopped by that check.

What this means in practice, while the server is on:

- Any process on the machine that can open a loopback TCP connection can attach to AgentMux's windows, run script in them and read what they display. **On a multi-user machine, that includes processes of other OS users.**
- The AgentMux UI holds the server auth key, so attaching to it gives full control of AgentMux: running commands as you, reading files, driving agents.

Mitigations: leave the server off unless you need it; don't set `AGENTMUX_CDP_PORT` on a shared machine. Dev builds run it by default, so set `AGENTMUX_CDP_PORT=0` there if other people use the machine. If you do turn it on on a shared host, block other accounts from the port with a per-user firewall rule if your OS supports one (on Linux, an `iptables` `owner` match on the loopback interface), and read the port from `authkey.dev`, since it can change.

## Local IPC

The launcher, the CEF host and the server talk over local IPC (`agentmux-launcher/src/ipc/server.rs`, `agentmux-srv/src/srv_ipc/server.rs`). None of these channels uses a token; the first message a client sends declares what it is.

- **Unix:** the launcher's socket lives in a directory AgentMux creates with mode `0700`, owned by you. It refuses to use the directory if it is a symlink, isn't a directory, or is owned by another user. Other OS users can't connect; any process running as you can.
- **Windows:** the named pipes are created without an explicit security descriptor, so Windows' default named-pipe security applies. Microsoft documents that default as full control for LocalSystem, administrators and the creator, and read access for Everyone and anonymous. Remote clients are rejected.
- **Windows crash monitor:** a helper process receives crash reports over a Unix-domain socket at the fixed path `C:\CrashDumps\agentmuxsrv\monitor.sock`, shared by all users and instances, and writes minidumps to `C:\CrashDumps\agentmuxsrv\`. The directory gets no explicit access control.

## What AgentMux connects out to

[Data sovereignty](/security/data-sovereignty/) lists every outbound call with its trigger. In summary:

| Destination | When |
|---|---|
| Your agents' model providers | Made by the agent CLIs, not by AgentMux |
| `api.anthropic.com/v1/models` | At each launch, when a Claude login token is found |
| `muxbus.agentmux.ai`, `muxbus-ws.agentmux.ai` | Only after you sign in to MuxBus Cloud |
| `registry.npmjs.org` (or your configured npm registry) | Installing an agent CLI; checking CLI versions in the Toolchain pane |
| `github.com` release downloads | Installing jq or ripgrep from the tool catalog |
| `www.google.com/s2/favicons` | Showing an agent's web-search or web-fetch results |
| `agentmux.ai` | Opening a browser pane with no URL (its default start page) |
| winget, Homebrew or your Linux package manager | One-click installs of Node.js, Git or Python |
| Groq, Hugging Face, Discord, Telegram, Slack, WhatsApp, OAuth providers, key-validation endpoints | Only when you configure or use those features |
| LAN peers | Only with LAN discovery on |

There is no telemetry endpoint, crash-report upload, update check or license check.

## Firewall configuration

**Workstation, LAN discovery off:** no inbound rule is needed. Every listener is loopback or local IPC.

**LAN discovery on:** the server's ports are chosen at each launch, so allow the program rather than fixed ports. Windows Firewall prompts for this the first time you turn LAN discovery on. Peers need:

- inbound TCP to the server's two ports (they change at every launch);
- inbound UDP 5353 (mDNS) and, for probe-based discovery, UDP 47891.

Restrict these to your LAN subnet or to known peers.

**Outbound:** allow whatever your agents' providers need, plus the destinations above for the features you use. Blocking `muxbus.agentmux.ai` and `muxbus-ws.agentmux.ai` disables MuxBus Cloud. Blocking the npm registry disables in-app CLI installs.

---

**Source-of-truth references**:
- `agentmux-srv/src/bootstrap.rs` (`bind_listeners_and_network`) — loopback startup listeners
- `agentmux-srv/src/backend/lan_listeners.rs` (`LanListenerSupervisor`, `lan_bind_addresses`) — LAN listeners
- `agentmux-srv/src/backend/lan_discovery.rs` — mDNS record (`LanDiscovery::start`), UDP responder (`udp_responder_loop`, `probe_response_json`, `is_lan_source`)
- `agentmux-srv/src/server/mod.rs` (`build_router`, `auth_middleware`, `lan_or_full_auth_middleware`) — routes, auth, CORS
- `agentmux-srv/src/server/agent_takeover.rs` (`handle_agent_holding`), `agentmux-srv/src/backend/agent_admission.rs` (`lan_holders`) — the LAN agent-holding query
- `agentmux-srv/src/config.rs` — `lan_key` generation
- `agentmux-srv/src/backend/dev_proxy.rs` — dev proxy
- `agentmux-srv/src/identity/oauth_client.rs` (`start_code_flow`) — OAuth callback
- `agentmux-cef/src/ipc.rs` — host IPC server
- `agentmux-cef/src/cdp_port.rs`, `agentmux-cef/src/lib.rs`, `agentmux-cef/src/app/mod.rs` — remote-debugging port and switches; `agentmux-cef/src/browser_api/cdp.rs` — in-process DevTools Protocol for the browser API
- `agentmux-launcher/src/ipc/server.rs`, `agentmux-launcher/src/ipc/mod.rs`, `agentmux-srv/src/srv_ipc/server.rs`, `agentmux-srv/src/crash_monitor.rs` — local IPC

**Marketing claims this page substantiates**: "runs on your machine" on [agentmux.ai](https://agentmux.ai).
