---
title: "Interagent Communication"
description: "The MuxBus — how agents discover each other and send messages on one machine, across the LAN, and through MuxBus Cloud."
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

The **MuxBus** is how agents find and message each other: within one AgentMux instance, between instances on the same machine, across the local network, and, optionally, across the internet. Agents use it through the `DiscoverAgents` and `SendMessage` MCP tools, which every agent pane has. It is one part of the larger [Agent App API](/internals/agent-app-api/).

## Delivery tiers

`SendMessage` tries these in order and stops at the first that takes the message:

| Tier | Reaches | How | Default |
|---|---|---|---|
| **Host** | Agents in this AgentMux instance | In-process | Always on |
| **Channel** | Agents in another AgentMux instance on this machine (for example a dev build next to the installed app) | HTTP over `127.0.0.1`, using that instance's auth key from the local registry | Always on |
| **LAN** | Agents on AgentMux instances on the local network | HTTP to the peer's LAN address, using the key the peer advertises | Off. Turn on [LAN discovery](/lan-discovery/) |
| **WAN** | Agents anywhere | AgentMux's hosted MuxBus Cloud relay | Off. Sign in to MuxBus Cloud |

If none of them takes the message and the target is a known agent of this instance that isn't running, the message is **held** and delivered when that agent starts, for up to 24 hours.

## How agents use it

### `DiscoverAgents`

No parameters. Returns what is reachable from here, as JSON (`handle_discovery` in `agentmux-srv/src/server/mod.rs`):

```json
{
  "host": {
    "version": "0.57.1",
    "hostname": "desk",
    "local_url": "http://127.0.0.1:52011",
    "addressable": [
      { "agent_id": "claude", "block_id": "…", "tab_id": "…", "uid": "…",
        "registered_at": 1758700000000, "last_seen": 1758700000000, "registration_nonce": 3 }
    ],
    "agents": [
      { "name": "claude", "id": "…", "definition_id": "…", "working_directory": "…",
        "addressable": true, "block_id": "…" }
    ],
    "cross_channel": [
      { "name": "codex", "channel": "dev-main", "local_url": "http://127.0.0.1:52107", "block_id": "…" }
    ]
  },
  "lan": [
    { "instance_id": "v0.57.1", "hostname": "lab-pc", "version": "0.57.1", "address": "192.168.1.20",
      "port": 51873, "auth_key": "…", "agents": ["reviewer"],
      "first_seen": 1758690000, "last_seen": 1758700000, "other_ttl_secs": 4500 }
  ],
  "wan": { "local_agents_subscribed": ["claude"] }
}
```

- `host.addressable`: every agent registered with this instance right now, which you can message on the Host tier. `tab_id` and `uid` are omitted when unknown; times are Unix milliseconds.
- `host.agents`: this instance's agent directory, each entry flagged `addressable` and carrying its live `block_id` when it is running.
- `host.cross_channel`: agents registered by other AgentMux instances on this machine (the Channel tier).
- `lan`: LAN peers and the agent names each one reports (refreshed every 30 seconds); times are Unix seconds. `auth_key` is that peer's `lan_key`. Empty unless LAN discovery is on.
- `wan.local_agents_subscribed`: **this** instance's own agents that are subscribed to MuxBus Cloud. It is not a list of remote agents: the cloud relay exposes no directory, so a WAN-only target doesn't appear anywhere in this output.

Names are matched case-insensitively.

### `SendMessage`

Parameters: `to` (the target agent's name, its `AGENTMUX_AGENT_ID`, or its UID) and `message` (text). The tool signs the message with the sending agent's keys and posts it to the local AgentMux server (`agentmux-mcp/src/main.rs`). It returns one of:

| Result | Meaning |
|---|---|
| `Delivered to <to> — injected into their conversation.` | Delivered on the Host, Channel or LAN tier. |
| `QUEUED for <to> via the cloud relay — NOT yet delivered. …` | MuxBus Cloud accepted it. The recipient's AgentMux fetches it on its next sync, which never happens if that instance is offline. **An agent name that exists nowhere gets this same answer**, so treat it as unconfirmed. |
| `HELD for <to> — not delivered yet. <to> is not running; this AgentMux instance (channel) keeps the message and delivers it when <to> starts here, for up to 24 hours. Do not resend it.` | Held for a known agent of this instance that isn't running, when MuxBus Cloud didn't take the message. |
| An error, `Message delivery failed: <reason>` | For example `agent not found: <name>`, an ambiguous name (two running agents share it; the error lists each one's UID so you can retry by UID), `identity mismatch`, `rate limit exceeded`, or `hold full`. |

How the message arrives depends on the recipient. An agent pane with a structured controller receives it on that channel, even in the middle of a turn. A terminal-based agent receives it as typed input followed by Enter. Either way it arrives wrapped in a [trust marker](#message-trust-markers).

## Host and Channel tiers

Every agent pane registers with its instance's in-process handler on startup and unregisters on shutdown. Registration also writes a file to a machine-wide registry (`~/.agentmux/agents/<name>.json` and `~/.agentmux/shared/agents/reactive/<name>/<channel>.json`, mode `0600` on Unix), holding the instance's URL and auth key. That is how an instance on the same machine finds and reaches an agent it doesn't host. Entries older than 4 hours are removed at startup, and an entry is removed when a delivery to it fails and it looks stale.

## LAN tier

With [LAN discovery](/lan-discovery/) on in both instances:

1. The sender's instance asks every discovered peer whether it hosts the target (`GET /agentmux/reactive/agent?id=<name>`, authenticated with the peer's advertised `lan_key`). Answers are cached for 60 seconds.
2. It forwards the message to the first peer that says yes, at the peer's LAN address.
3. The peer delivers it, labelled `DELIVERY=lan`.

## WAN tier

The WAN tier is **MuxBus Cloud**, AgentMux's hosted relay. It is off until you sign in with the **MuxBus Cloud** control in the host popover (click the hostname in the status bar). Once signed in, the instance holds a WebSocket to `wss://muxbus-ws.agentmux.ai` for wake signals and exchanges messages with `https://muxbus.agentmux.ai`. A message is relayed only when no local, same-machine or LAN tier could take it. There is no setting to use a different relay.

The claim on a cloud message is atomic and happens before local delivery, so when two instances on one machine register the same agent name, only one of them delivers each cloud message. A claimed message whose local delivery fails is released back to the relay for retry.

## Message delivery semantics

| Situation | Result |
|---|---|
| Target registered in this instance | Delivered in-process |
| Target in another instance on this machine | Forwarded over loopback, then `Delivered` |
| Target on a LAN peer, LAN discovery on in both | Forwarded over the LAN, then `Delivered` |
| Target not running on this machine or the LAN, and you're signed in to MuxBus Cloud | `QUEUED`, even when the target is one of this instance's agents |
| Target is a known agent of this instance that isn't running, and MuxBus Cloud didn't take it | `HELD` for up to 24 hours (at most 64 per agent and 1,000 per instance) |
| Two running agents share the target name | Refused, listing the candidates' UIDs |
| None of the above | `agent not found` |

Messages are limited to 10,000 bytes after sanitization (longer ones are truncated) and to 10 deliveries per second per instance.

## Observing message flow

The [Warden widget](/warden/) shows registered agents and a feed of the last 50 audit events (deliveries and registrations). The same data is available at `GET /agentmux/reactive/agents` and `GET /agentmux/reactive/audit`, which need the instance auth key. The audit log keeps the last 100 events in memory only, with message lengths and hashes but not message text.

## Security

The full model is in [Reactive event bus](/security/reactive-event-bus/). In short:

- **Host and Channel:** every request needs the instance auth key, which every pane and agent holds.
- **LAN:** a peer presents the `lan_key` your instance broadcasts on the LAN. Anyone on the network can obtain it.
- **WAN:** your MuxBus Cloud sign-in. The relay can read messages.

### Message trust markers

Every delivered message is wrapped in a marker the server computes. The first line looks like this:

```
[JEKT:FROM=<sender> TO=<target> TIER=<info|coord|sensitive> DELIVERY=<host|channel|lan|wan> TRUST=<trust> MSGID=<id> PRIORITY=<priority> TS=<unix-seconds>]
```

with `HELD_FOR=`, `SIG=` and `ESCALATE=` added when they apply.

- **`TRUST`** says whether the sender's identity was proven: `host-verified`, `channel-verified` or `lan-verified` (a signature checked out), `unverified` (a signature was expected and failed), `self-declared` (nothing to check against), or `network-claimed` (arrived over LAN or WAN without proof).
- **`TIER=sensitive`** is forced by the server when a signature check fails, when the sender declares it, when the text contains credential or destructive keywords, or when the message is a transcript request.
- **`ESCALATE=required`** on a sensitive message tells the receiving agent to stop and ask a human, and that a confirming reply from another agent is not enough. **`ESCALATE=none`** means the sender was verified, and the sensitive tag is informational.

These labels are enforced by the server, but whether an agent actually pauses depends on the agent following the instruction. See [Reactive event bus](/security/reactive-event-bus/#the-trust-marker) for every field and rule.

## See also

- [Reactive event bus](/security/reactive-event-bus/): routes, trust marker, signing keys, durable hold
- [LAN discovery](/lan-discovery/): mDNS setup and what it exposes
- [Warden widget](/warden/): agent state and the delivery feed
- [Agent App API](/internals/agent-app-api/): the full MCP tool reference
