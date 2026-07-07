---
title: "Data sovereignty"
description: "What stays on your machine, what leaves it, and exactly when — itemized."
---

AgentMux runs locally. The marketing summary is "zero telemetry"; this page is the detailed version, so you can verify it.

## What never leaves your machine

The following are stored only on the local filesystem and are never transmitted by AgentMux itself:

- **Session state.** Every block, message, tool call, diff, and terminal output — all persisted in local SQLite databases (`objects.db`, `sagas.db`, `filestore.db`) under `~/.agentmux/channels/<channel>/versions/<v>/data/db/`, plus an account-wide `store.db` under `~/.agentmux/shared/` for identity accounts, bundles, drones, and MuxBus credentials (see [Persistence](/internals/persistence/) and [Data layout](/internals/data-layout/) for the full layout).
- **Prompts and replies.** The full content of what you send agents and what they send back.
- **File contents agents read or write.** When an agent reads or modifies a file, AgentMux records the diff in the local database. The file itself stays where it was.
- **Terminal output.** PTY output is streamed into the local database and rendered in the pane. Not uploaded.
- **Identity bundle metadata.** Provider, key name, scope — see [Identity & credential storage](/security/identity-credential-storage/) for the full model.
- **Workspace layout and configuration.** Pane positions, tabs, settings, themes.

The TL;DR: if you ran AgentMux on an air-gapped machine, you'd lose the ability to run agents (because the agents talk to LLM providers), but you'd lose nothing else.

## What AgentMux itself never does

Explicit negatives, verified by the security audit:

- **No telemetry.** AgentMux makes no outbound HTTP calls to any AgentMux-controlled endpoint. No analytics, no usage pings, no feature-flag check-ins.
- **No crash reporting.** Crashes are local. No exception data leaves the machine.
- **No version check.** The app does not phone home for update availability. See [Update model](/security/update-model/).
- **No license check.** AgentMux is open source under Apache 2.0; there's no license server to call.

## What leaves your machine — and when

The exceptions are scoped, explicit, and user-initiated:

### LLM API traffic (the obvious one)

When you launch an agent and send it a message, the agent's CLI (Claude Code, Codex, Gemini, Copilot, etc.) makes HTTPS calls to the agent's provider. **AgentMux is not in the data path for these calls.** The prompt goes from your machine directly to Anthropic / OpenAI / Google / GitHub, governed by their privacy policies. AgentMux records the call locally, but does not proxy it.

If you want to inspect or block this traffic, configure your network at the OS level (proxy, firewall, mitmproxy) — the agents will route through whatever you've set up.

### MCP server connections

MCP (Model Context Protocol) servers are processes the agent talks to over JSON-RPC. Whatever URLs or APIs an MCP server accesses are entirely the MCP's behavior, not AgentMux's. If you install a remote MCP server (one that opens an HTTPS connection to an external service), that connection is on you.

Local MCP servers (running as a subprocess on your machine) make no network calls unless they're configured to.

### Tool downloads (opt-in, user-initiated)

When you install a tool from AgentMux's tool catalog (e.g., installing an agent CLI), AgentMux downloads the binary from the URL in the catalog. Each download is **SHA-256 pinned** against the catalog entry — a mismatched hash is rejected. The URLs are typically GitHub release assets or upstream-vendor download endpoints.

The catalog itself ships with AgentMux. Adding a new tool is a code change, not a runtime fetch.

### Cross-instance forwarding (opt-in, default off)

If you run multiple AgentMux instances on the same machine and enable the MuxBus, they discover each other via a local file registry (`~/.agentmux/instances/`) and forward messages over 127.0.0.1 between them. No external network involved.

A separate **cloud MuxBus poller** can be configured to receive inbound messages from a hosted relay; this is opt-in and off by default. See [Reactive event bus](/security/reactive-event-bus/) once that page lands.

### mDNS discovery (opt-in, default off)

If you enable mDNS, AgentMux broadcasts on the local network (`0.0.0.0:5353`) to announce its presence to other AgentMux instances on the LAN. Off by default. When on, the only data broadcast is the instance ID and port — no session content.

## What you control

| Setting | Default | Effect |
|---|---|---|
| mDNS discovery | Off | LAN broadcast of instance presence. |
| Cloud MuxBus poller | Off | Inbound messages from a hosted relay. |
| Crash reporting | Not applicable (none exists) | — |
| Update check | Not applicable (none exists) | See [Update model](/security/update-model/). |

## Verifying the claims

If you want to verify any of this for yourself:

- **Audit network traffic.** Run AgentMux behind a packet inspector (`mitmproxy`, `tcpdump`, your firewall logs). All you'll see is the LLM provider traffic from agent CLIs and any explicit user actions (tool download, etc.).
- **Read the source.** The full outbound HTTP surface in the Rust backend is limited to: the tool store (`agentmux-srv/src/backend/tool_store.rs`), the cross-instance forwarder (`agentmux-srv/src/server/reactive.rs`), and the cloud MuxBus poller (opt-in, see above). Search for `reqwest::Client` in the codebase to see every outbound call.
- **Inspect the SQLite databases.** `objects.db`, `sagas.db`, and `filestore.db` (per-channel, per-version) and `store.db` (account-wide, under `~/.agentmux/shared/`) are normal SQLite files. Open them with the `sqlite3` CLI to confirm what's there.

---

**Source-of-truth references**:
- `agentmux-srv/src/backend/tool_store.rs` — tool download path + SHA-256 pinning
- `agentmux-srv/src/server/reactive.rs` — cross-instance forwarding
- `agentmux-srv/src/main.rs` — mDNS opt-in default-off
- `agentmux-common/src/data_paths.rs`, `agentmux-srv/src/registry/paths.rs` — local persistence paths (see [Persistence](/internals/persistence/))

**Marketing claims this page substantiates**: "zero telemetry", "data sovereignty by default", "audit trail" on [agentmux.ai](https://agentmux.ai).
