---
title: "Reactive event bus"
description: "How jekt and message flow between agents, between AgentMux instances, and to/from a cloud relay."
---

The **reactive event bus** is the cross-pane, cross-instance, and (optionally) cross-machine message channel that lets agents and panes talk to each other. This page documents the surface, the trust model, and how to wire it up.

If you just want the user-level overview, see [Interagent event bus](/internals/interagent-comms/). This page covers the security side: how messages are authenticated, where the trust boundaries are, and what's opt-in.

## The two delivery models

| Verb | Semantics | MCP tool | Use when |
|---|---|---|---|
| **jekt** | Inject directly into the recipient's terminal stdin. Synchronous, immediate. | `mcp__agentbus__inject_terminal` | The recipient is running and you want them to act now. |
| **message** | Drop into the recipient's mailbox; they read on their own schedule. Asynchronous. | `mcp__agentbus__send_message` | The recipient may be offline; you don't need immediate processing. |

Both delivery models go through the same routing logic; the difference is what happens at the recipient.

## Endpoint surface

All `/agentmux/reactive/*` HTTP routes require the sidecar's `X-AuthKey` header. (Before agentmux v0.33.790 they did not — see audit C1+C2.)

### Inject

```
POST /agentmux/reactive/inject
```

Body: `{ "target_agent": "id", "source_agent": "id?", "message": "..." }`.

The handler tries local delivery first via the in-process `reactive_handler`. If the target isn't registered locally, it consults the file-based agent registry under `~/.agentmux/agents/`. If a peer instance owns the target, the handler forwards the request to that peer's `/agentmux/reactive/inject` over HTTP, authenticating with the peer's auth key from the registry entry.

If no local or peer match: returns "agent not found", which the agentbus client typically interprets as "fall back to the cloud relay".

### Register / unregister

```
POST /agentmux/reactive/register   { "agent_id", "block_id", "tab_id?" }
POST /agentmux/reactive/unregister { "agent_id" }
```

Lifecycle: agents register themselves on terminal-bring-up and unregister on shutdown. The registry writes a per-agent file at `~/.agentmux/agents/<agent_id>.json`, mode `0600` on Unix, containing the instance's local URL and per-launch auth key. Stale entries auto-expire after 4 hours.

### Poller config + status

```
POST /agentmux/reactive/poller/config { "agentmux_url", "agentmux_token" }
GET  /agentmux/reactive/poller/status
GET  /agentmux/reactive/poller/stats
```

Used to wire up the cloud agentbus relay (see below). Auth required on all three (audit fix C2 closed a token-leak from the previous unauthenticated `status` endpoint).

### Audit + listing

```
GET /agentmux/reactive/audit
GET /agentmux/reactive/agents
GET /agentmux/reactive/agent?agent_id=...
```

Diagnostic endpoints — list registered agents on this instance, fetch the audit log of recent injects. Useful for `/sources` reviewers and debugging.

## The three trust boundaries

```
┌─────────────────┐  jekt  ┌─────────────────┐
│  Frontend pane  │ ─────▶ │  Local sidecar  │
│  / MCP client   │        │  (this machine) │
└─────────────────┘        └────────┬────────┘
                                    │ X-AuthKey
                                    ▼
       cross-instance ◀─── peer auth_key from registry
                                    │
                                    │ outbound poll
                                    ▼
                           ┌──────────────────┐
                           │  Cloud agentbus  │   (opt-in)
                           │     relay        │
                           └──────────────────┘
```

1. **Frontend ↔ sidecar.** Frontend sends `X-AuthKey` from the per-launch UUIDv4 the launcher generated. Same boundary as every other authed RPC.
2. **Sidecar ↔ peer sidecar (cross-instance).** The writing sidecar embeds its `auth_key` in its registry file. The forwarding sidecar reads the registry, extracts the peer's `auth_key`, and presents it on the forward. The registry file is `0600` so a co-user on the same box can't read it — same boundary as the existing `authkey.dev` file.
3. **Sidecar ↔ cloud agentbus relay.** The poller calls outbound HTTPS to the configured `agentmux_url`, presenting `agentmux_token` as a bearer. The relay never calls into the sidecar. All inbound messages arrive over the polled connection (long-poll or websocket — relay-specific).

## Cloud agentbus poller — opt-in

The poller is **off by default**. To enable it:

1. Open the Subagent Watcher or a terminal pane in AgentMux.
2. Issue the `X` OSC sequence (or use the in-app settings panel) with `{ agentmux_url, agentmux_token }`.
3. The poller starts long-polling the relay; inbound messages route through the same `reactive_handler.inject_message` path as local injects.

To stop:

- Configure with empty `agentmux_url` and `agentmux_token`. The poller stops cleanly.

The relay is **your choice of operator** — AgentMux Corp doesn't run one. Spin up your own, or use the open-source agentbus-server. There is no AgentMux-Corp-controlled endpoint baked into the binary.

## Cross-instance forwarding — local-only

The registry lives in `~/.agentmux/agents/` and is shared by all AgentMux instances running as the same user. The forwarding happens over `127.0.0.1` URLs only — there is no cross-machine forwarding. For cross-machine routing, use the cloud agentbus poller (above).

The audit (C1+C2 fix) tightened this: prior to agentmux v0.33.790, the cross-instance forward presented no auth, which relied on the receiving peer accepting any local-process request. Now both halves of the forward require the per-peer auth key from the registry entry.

## What an attacker would have to do to drive your agent

For each delivery path, here's the trust assumption:

- **Frontend → sidecar:** Have the per-launch auth key. That means reading `~/.agentmux/authkey.dev` (mode `0600`) or being the user's CEF process. Practical attack: another process running as the same user. Defence: don't run untrusted processes as the user that runs AgentMux.
- **Peer sidecar → sidecar:** Have a registry file that includes the peer's auth key. Same threat model — co-user with read access to `~/.agentmux/agents/`. Defence: don't run untrusted processes as the user.
- **Cloud relay → sidecar:** Configure your poller to point at the relay AND know the bearer token. Defence: only configure pollers you control.

In all three cases, the boundary is **the user account on the local machine**. AgentMux doesn't claim to defend against threats inside that boundary — see [trust model](/security/trust-model/).

---

**Source-of-truth references**:
- `agentmux-srv/src/server/reactive.rs` — HTTP handlers (all auth-gated)
- `agentmux-srv/src/server/mod.rs` — router + auth middleware
- `agentmux-srv/src/backend/reactive/handler.rs` — `inject_message` in-process delivery
- `agentmux-srv/src/backend/reactive/registry.rs` — cross-instance file registry
- `agentmux-srv/src/backend/reactive/poller.rs` — cloud agentbus poller

**Related**: [Interagent event bus](/internals/interagent-comms/), [Trust model](/security/trust-model/), [Network exposure](/security/network-exposure/).
