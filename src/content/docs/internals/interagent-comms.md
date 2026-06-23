---
title: "Interagent Communication"
description: "The MuxBus — how agents discover each other and route messages across the Host, LAN, and WAN tiers."
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

The **MuxBus** is the messaging substrate that lets agents find and talk to each other — on the same machine, across a local network, or (optionally) across the internet. Every agent pane gets access to it via the `DiscoverAgents` and `SendMessage` MCP tools.

## Architecture

The MuxBus has three tiers, ordered by trust and latency:

<img src="/diagrams/interagent-comms.svg" alt="Three-tier delivery model: Host tier (purple, always on) → LAN tier (steel-blue, mDNS peers, off by default) → WAN tier (blue, cloud relay, opt-in). Dashed arrows show opt-in escalation path." style="max-width:100%" />

| Tier | Scope | How it works | Auth | Default |
|---|---|---|---|---|
| **Host** | Same AgentMux instance | In-process reactive handler | Per-launch auth key | Always on |
| **LAN** | Same local network | mDNS peer discovery + HTTP forward | Peer auth key from mDNS/registry | Off — enable via LAN discovery toggle |
| **WAN** | Cross-network | Outbound poll to a MuxBus relay | Bearer token you configure | Off — enable via poller config |

## How agents use it

Two MCP tools cover the full surface. They're available to every agent pane automatically — no configuration required on the Host tier.

### `DiscoverAgents`

No parameters. Returns the reachable agent population across all active tiers:

```json
{
  "host": {
    "addressable": [
      { "agent_id": "claude", "block_id": "uuid", "provider": "claude" }
    ],
    "agents": [ /* full agent records with heartbeat state */ ]
  },
  "lan": [
    {
      "host": "peer-machine",
      "agents": [ { "agent_id": "codex", "provider": "codex" } ]
    }
  ],
  "wan": {
    "subscribed_agents": [ /* agents reachable via the cloud relay */ ]
  }
}
```

`host.addressable` is the list you can `SendMessage` to right now. `host.agents` includes all registered agents, including those that may be idle or just missed a heartbeat. LAN and WAN entries appear only when those tiers are active.

### `SendMessage`

Parameters: `to` (target agent name, required), `message` (string, required).

Routes the message to the named agent through the appropriate tier — Host if the agent is local, LAN if it's on a discovered peer, WAN via the relay otherwise.

Returns `{ "success": true }` on delivery, or `{ "success": false, "error": "..." }` if the agent isn't found or the tier is unavailable.

The message arrives in the target agent's pane as if a user typed it. The agent picks it up on its next turn.

## Host tier

The **reactive handler** is the in-process delivery path. Every agent pane registers with it on startup and unregisters on shutdown. Registration writes a per-agent file at `~/.agentmux/agents/<agent_id>.json` so peer instances can also find and forward to it.

Agents that stop sending heartbeats drop from the Host `addressable` list within ~30 s but remain in `agents` for audit purposes until the entry expires (4 hours).

The Host tier is always active — no configuration needed.

## LAN tier

The LAN tier requires **LAN discovery** to be enabled:

1. Click the version chip in the status bar to open the HostPopover.
2. Toggle **LAN discovery** on.
3. AgentMux starts advertising via mDNS and browsing for peers.

Once active, peer instances on the same network appear within ~5 s in the Warden widget's LAN section and in `DiscoverAgents`'s `lan` field.

When `SendMessage` targets an agent on a LAN peer:
1. The local reactive handler checks `~/.agentmux/agents/` for the agent's registry entry.
2. If not found locally, it checks the mDNS-discovered peer list.
3. The message is forwarded via HTTP to the peer's sidecar, authenticated with the peer's auth key from the registry entry.
4. The peer delivers it to the target agent's pane.

LAN forwarding uses the peer's actual IP + port from the mDNS announcement — not `127.0.0.1`. This is the key difference from local cross-instance forwarding (which is 127.0.0.1 only, for same-machine multi-instance scenarios).

## WAN tier

The WAN tier routes messages through a MuxBus cloud relay you configure and operate. AgentMux does not run a relay — you bring your own (the open-source `agentbus-server`; the binary still carries the legacy name).

To enable:

1. Open any terminal pane in AgentMux.
2. Configure the poller via the in-app settings panel with `{ agentmux_url, agentmux_token }`.
3. The sidecar starts polling the relay; inbound messages route through the same reactive handler as local injects.

The relay is opt-in and operates under your control. See [Reactive event bus](/security/reactive-event-bus/) for the full WAN trust model and poller configuration details.

## Message delivery semantics

| Scenario | Behavior |
|---|---|
| Target found on Host tier | In-process inject — synchronous, ~zero latency |
| Target found on LAN peer | HTTP forward to peer sidecar — ~LAN latency |
| Target found via WAN relay | Relay delivers on next poll cycle |
| Target not found anywhere | Returns `{ success: false, error: "agent not found" }` |
| LAN tier off, agent is on LAN | Returns `agent not found` — tier must be active to route |

There is no buffering for offline agents at any tier. If an agent isn't registered and reachable when `SendMessage` is called, the call fails immediately.

## Observing message flow

The **Warden widget** (hamburger ≡ → Warden, or the shield icon in the widget bar) surfaces the reactive handler state:

- **Agent table** — registered agents with last-seen heartbeat
- **Audit feed** — last 50 message deliveries (source, target, byte count, success/fail)
- **LAN section** — discovered peer instances and their agent counts

For programmatic inspection, the `/agentmux/reactive/audit` and `/agentmux/reactive/agents` REST endpoints expose the same data.

## Security

The auth model across all three tiers is documented in [Reactive event bus](/security/reactive-event-bus/). The short version:

- **Host and local cross-instance:** per-launch auth key gated on every route.
- **LAN peer-to-peer:** peer's auth key from its registry entry (mode `0600`) presented on forward.
- **WAN relay:** bearer token you configure, outbound-only connection — the relay never calls into your sidecar.

## See also

- [Reactive event bus](/security/reactive-event-bus/) — auth model, endpoint reference, trust boundaries
- [LAN discovery](/lan-discovery/) — mDNS setup and peer visibility
- [Warden widget](/warden/) — observing agent state and audit feed
- [Agent App API](/internals/agent-app-api/) — DiscoverAgents and SendMessage tool reference
