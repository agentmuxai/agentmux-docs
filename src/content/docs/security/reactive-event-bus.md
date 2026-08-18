---
title: "Reactive event bus"
description: "How jekt and message flow between agents, between AgentMux instances, and to/from a cloud relay."
---

The **reactive event bus** is the cross-pane, cross-instance, and (optionally) cross-machine message channel that lets agents and panes talk to each other. This page documents the surface, the trust model, and how to wire it up.

If you just want the user-level overview, see [Interagent event bus](/internals/interagent-comms/). This page covers the security side: how messages are authenticated, where the trust boundaries are, and what's opt-in.

## The two delivery models

| Verb | Semantics | MCP tool | Use when |
|---|---|---|---|
| **jekt** | Inject directly into the recipient's terminal stdin. Synchronous, immediate. | `mcp__muxbus__inject_terminal` | The recipient is running and you want them to act now. |
| **message** | Drop into the recipient's mailbox; they read on their own schedule. Asynchronous. | `mcp__muxbus__send_message` | The recipient may be offline; you don't need immediate processing. |

Both delivery models go through the same routing logic; the difference is what happens at the recipient.

## Endpoint surface

All `/agentmux/reactive/*` HTTP routes require the sidecar's `X-AuthKey` header. (Before agentmux v0.33.790 they did not — see audit C1+C2.)

### Inject

```
POST /agentmux/reactive/inject
```

Body: `{ "target_agent": "id", "source_agent": "id?", "message": "..." }`.

The handler tries local delivery first via the in-process `reactive_handler`. If the target isn't registered locally, it consults the file-based agent registry under `~/.agentmux/agents/`. If a peer instance owns the target, the handler forwards the request to that peer's `/agentmux/reactive/inject` over HTTP, authenticating with the peer's auth key from the registry entry.

If no local or peer match: returns "agent not found", which the MuxBus client (the `@agentmuxai/muxbus-client` package) typically interprets as "fall back to the cloud relay".

### Register / unregister

```
POST /agentmux/reactive/register   { "agent_id", "block_id", "tab_id?" }
POST /agentmux/reactive/unregister { "agent_id" }
```

Lifecycle: agents register themselves on terminal-bring-up and unregister on shutdown. The registry writes a per-agent file at `~/.agentmux/agents/<agent_id>.json`, mode `0600` on Unix, containing the instance's local URL and per-launch auth key. Stale entries auto-expire after 4 hours.

### Poller config + status

```
POST /agentmux/reactive/poller/config { "muxbus_url", "muxbus_token" }
GET  /agentmux/reactive/poller/status
GET  /agentmux/reactive/poller/stats
```

Used to wire up the cloud MuxBus relay (see below). Auth required on all three (audit fix C2 closed a token-leak from the previous unauthenticated `status` endpoint).

### Audit + listing

```
GET /agentmux/reactive/audit
GET /agentmux/reactive/agents
GET /agentmux/reactive/agent?agent_id=...
```

Diagnostic endpoints — list registered agents on this instance, fetch the audit log of recent injects. Useful for `/sources` reviewers and debugging.

## The three trust boundaries

<img src="/diagrams/reactive-event-bus.svg" alt="Trust boundaries: Frontend pane sends jekt/message to local sidecar (purple, X-AuthKey required). Sidecar forwards bidirectionally to peer sidecar (steel-blue, peer auth_key from mode-0600 registry) or via outbound poll to cloud relay (opt-in, dashed)." style="max-width:100%" />

1. **Frontend ↔ sidecar.** Frontend sends `X-AuthKey` from the per-launch UUIDv4 the launcher generated. Same boundary as every other authed RPC.
2. **Sidecar ↔ peer sidecar (cross-instance).** The writing sidecar embeds its `auth_key` in its registry file. The forwarding sidecar reads the registry, extracts the peer's `auth_key`, and presents it on the forward. The registry file is `0600` so a co-user on the same box can't read it — same boundary as the existing `authkey.dev` file.
3. **Sidecar ↔ cloud MuxBus relay.** The poller calls outbound HTTPS to the configured `muxbus_url`, presenting `muxbus_token` as a bearer. The relay never calls into the sidecar. All inbound messages arrive over the polled connection (long-poll or websocket — relay-specific).

## Cloud MuxBus poller — opt-in

The poller is **off by default**. To enable it:

1. Open the Subagent Watcher or a terminal pane in AgentMux.
2. Issue the `X` OSC sequence (or use the in-app settings panel) with `{ muxbus_url, muxbus_token }`.
3. The poller starts long-polling the relay; inbound messages route through the same `reactive_handler.inject_message` path as local injects.

To stop:

- Configure with empty `muxbus_url` and `muxbus_token`. The poller stops cleanly.

The relay is **your choice of operator** — AgentMux Corp doesn't run one. Spin up your own, or use the open-source `@agentmuxai/muxbus-server`. There is no AgentMux-Corp-controlled endpoint baked into the binary.

## Cross-instance forwarding

There are two cross-instance forwarding modes, based on where the peer lives.

### Same-machine (local) forwarding

The registry at `~/.agentmux/agents/` is shared by all AgentMux instances running as the same user. When the target agent is registered by a different instance on the same machine, the handler forwards over `127.0.0.1` — no network exposure. Auth is the per-peer auth key from the registry entry (mode `0600`).

The audit (C1+C2 fix) tightened this: prior to agentmux v0.33.790, the cross-instance forward presented no auth, which relied on the receiving peer accepting any local-process request. Now both halves of the forward require the per-peer auth key from the registry entry.

### LAN forwarding (v0.46+)

When [LAN discovery](/lan-discovery/) is active, peer AgentMux instances on the local network are discovered via mDNS. Their sidecar address (real IP + port) and auth key are exchanged during the mDNS announcement.

When a `SendMessage` target isn't found in the local registry, the handler checks the mDNS peer list. If a peer owns the agent, the forward goes to the peer's actual IP + port — not `127.0.0.1` — using the peer's auth key from the announcement.

The trust model here is the same as same-machine forwarding: the peer's auth key gating. The threat surface is wider (the forward travels over LAN, not loopback) but is still bounded by: (a) you opted in to LAN discovery, and (b) the peer's auth key isn't shared beyond the mDNS announcement.

LAN forwarding is **off by default**. Enable LAN discovery via the HostPopover toggle (version chip → LAN discovery). Without it, `SendMessage` to a LAN agent returns `agent not found`.

## Jekt sender identity: `TRUST=`, `SIG=`, and `ESCALATE=`

Everything above governs who's allowed to call the sidecar's endpoints — a separate, transport-level question from whether the `FROM=` sender claim inside a delivered jekt is actually true. Incoming jekts arrive wrapped in a marker block (`[JEKT:FROM=... TIER=... DELIVERY=... TRUST=... ...]`, plus `SIG=` on some WAN traffic and, when `TIER=sensitive`, `ESCALATE=`). This section documents what that marker does and does not prove — the trust model here was substantially rebuilt in August 2026, and the honest answer differs sharply by delivery tier.

**No blanket rule like "same account" or "same host and network" is trusted.** Only specific, narrow cryptographic checks are, and they differ by `DELIVERY=` tier.

### Host-tier: per-agent HMAC-SHA256 signing (`DELIVERY=host`)

For a jekt delivered on the same machine as the receiving srv instance, sender identity CAN be cryptographically proven. Each agent gets its own signing key (`AGENTMUX_JEKT_KEY`), injected into that agent's own MCP server process env at spawn time — never into any other agent's env, never returned over any RPC, and never readable by the sending agent's own model output. srv verifies the claimed sender's signature against that agent's key on file. The marker's `TRUST=` field reports one of three outcomes; treat them as distinct, not interchangeable:

| `TRUST=` value | What it means | Identity proven? |
|---|---|---|
| `host-verified` | Claimed sender has a key on file and the signature matched. | **Yes** — the only case where identity is actually proven, not merely assumed. |
| `unverified` | Claimed sender has a key on file, but the signature was missing or didn't match. | No — an active red flag. Always forces `TIER=sensitive`. |
| `self-declared` | No signing key exists for the claimed sender at all (e.g. a Slack/Discord/Telegram/WhatsApp bridge, or an agent that hasn't been respawned since this feature shipped). | No — nothing was checked. This is the historical, unauthenticated default; clean content still lands at `TIER=coord` like it always could. |

### LAN-tier: per-agent Ed25519 signing (`DELIVERY=lan`)

Every agent also gets its own Ed25519 keypair for LAN traffic specifically — a separate scheme from the host-tier HMAC key above. A LAN jekt whose signature verifies against the claimed sender's own public key (fetched from whichever LAN peer actually hosts that agent) renders `TRUST=lan-verified` — proof of identity, the LAN equivalent of `host-verified`. A LAN signature that was present but did **not** verify against a public key that *was* found is treated as an active forgery attempt — someone signed as a specific agent and got it wrong — and is unconditionally forced to `TIER=sensitive`, worse than sending no signature at all. (An unsigned LAN jekt, or one signed where the sender's public key couldn't be found, is not in this "failed" category — see the narrowing below.)

### WAN-tier: Ed25519 signing, scoped to reagent only

WAN jekts otherwise default to `TRUST=network-claimed` — crossing a network boundary never proves identity by itself, and there is currently no general agent-to-agent WAN signing scheme (that's separate, not-yet-built work). The one exception is reagent, AgentMux's own GitHub-review-notification service: a WAN jekt carrying `SIG=verified` means its Ed25519 signature checked out against reagent's pinned production public key, and is treated the same as host-tier's `TRUST=host-verified` — never forced sensitive by trust alone. `SIG=invalid` means a reagent signature was present but did **not** cryptographically verify; it is unconditionally forced to `TIER=sensitive` — worse than no signature at all, never read it as a lesser version of unsigned.

(A second, placeholder pinned key can also produce `SIG=verified`, kept registered only so already-in-flight dev-signed messages still verify against it; as of the tier narrowing below, which of the two keys verified no longer affects `TIER` at all.)

### The `TIER=sensitive` narrowing

Merely lacking proof of identity — `TRUST=network-claimed` or `TRUST=self-declared` — is **not**, by itself, sufficient to force `TIER=sensitive`. It's forced only by an active red flag:

- `TRUST=unverified` (host-tier signature present but didn't match) — always.
- `SIG=invalid` (WAN reagent signature present but didn't verify) — always.
- A LAN signature present, sender's public key found, but didn't verify — always.
- The jekt declares its own tier as `sensitive` — always, honored as-is.
- The message body matches a credential/destructive keyword (PAT, token, secret, password, credential, keychain, api_key, `--force`, `rm -rf`, etc.) — regardless of trust tier, including on an otherwise-verified sender.

Clean content from an unproven sender — `TRUST=network-claimed` or `TRUST=self-declared`, LAN or WAN, none of the above conditions met — now settles at the declared tier (`TIER=coord` by default), the same as a verified sender's would. Absence of proof is not itself a red flag; an active verification failure is.

### `ESCALATE=`: does `TIER=sensitive` always stop work?

No. A `TIER=sensitive` marker also carries an `ESCALATE=` field that decides whether the tier requires stopping:

- **`ESCALATE=required`** — the sender is not cryptographically verified on the tier it arrived on. Work should stop: show the marker to a human operator and get explicit confirmation before acting. A confirming reply from another agent over muxbus does **not** count as sufficient — a spoofed jekt followed by a spoofed muxbus "confirmation" is exactly the attack this rule exists to stop. This is the outcome for every active-forgery case above (`TRUST=unverified`, `SIG=invalid`, a failed LAN signature) unconditionally, and also for a self-declared-`sensitive` tier or keyword match coming from an unverified/self-declared/network-claimed sender.
- **`ESCALATE=none`** — `TIER=sensitive` was reached via a self-declared-sensitive tier or a keyword match, but the sender **is** cryptographically verified for this exact message (`TRUST=host-verified`, `TRUST=lan-verified`, or WAN `SIG=verified`). No stop is required and work proceeds normally — the message still carries a lighter "⚠ SENSITIVE (verified sender)" tag for visibility, but that's a display hint, not an instruction to pause.

This split exists because a genuinely `SIG=verified` jekt from reagent was once forced to `TIER=sensitive` purely by a keyword match in its own review text (reagent routinely reviews and discusses credential-handling PRs in exactly those terms) and incorrectly stopped work pending human confirmation, even though the sender's identity was never actually in doubt. `ESCALATE=none` is what that case produces now: a verified sender whose content happens to look sensitive gets a visual tag, not a stop.

## What an attacker would have to do to drive your agent

For each delivery path, here's the trust assumption:

- **Frontend → sidecar:** Have the per-launch auth key. That means reading `~/.agentmux/authkey.dev` (mode `0600`) or being the user's CEF process. Practical attack: another process running as the same user. Defence: don't run untrusted processes as the user that runs AgentMux.
- **Peer sidecar → sidecar:** Have a registry file that includes the peer's auth key. Same threat model — co-user with read access to `~/.agentmux/agents/`. Defence: don't run untrusted processes as the user.
- **Cloud relay → sidecar:** Configure your poller to point at the relay AND know the bearer token. Defence: only configure pollers you control.
- **Forging another agent's identity inside a jekt (the `FROM=` claim):** Depends on delivery tier — see [Jekt sender identity](#jekt-sender-identity-trust-sig-and-escalate) above. On host and LAN tiers, forging is cryptographically detectable — it produces `TRUST=unverified` or a failed LAN signature, both unconditionally forced to `TIER=sensitive` with `ESCALATE=required`. On WAN, only reagent's traffic is signed; any other WAN `source_agent` claim is exactly as forgeable as the endpoint access above allows.

In all three endpoint-access cases, the boundary is **the user account on the local machine**. AgentMux doesn't claim to defend against threats inside that boundary — see [trust model](/security/trust-model/).

---

**Source-of-truth references**:
- `agentmux-srv/src/server/reactive.rs` — HTTP handlers (all auth-gated)
- `agentmux-srv/src/server/mod.rs` — router + auth middleware
- `agentmux-srv/src/backend/reactive/handler.rs` — `inject_message` in-process delivery, `TIER=`/`ESCALATE=` escalation logic
- `agentmux-srv/src/backend/reactive/sanitize.rs` — keyword/credential detection feeding the `TIER=sensitive` rules
- `agentmux_common::jekt_sign` — host-tier HMAC-SHA256 and Ed25519 signing/verification
- `agentmux-srv/src/backend/lan_discovery.rs` — LAN peer public-key distribution
- `agentmux-srv/src/backend/reactive/registry.rs` — cross-instance file registry
- `agentmux-srv/src/backend/reactive/poller.rs` — cloud MuxBus poller

**Related**: [Interagent event bus](/internals/interagent-comms/), [Trust model](/security/trust-model/), [Network exposure](/security/network-exposure/).
