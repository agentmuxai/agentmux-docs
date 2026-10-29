---
title: "Interagent Communication"
description: "The MuxBus — how agents discover each other and send messages on one machine, across the LAN, and through MuxBus Cloud."
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

The **MuxBus** is how agents find and message each other: within one AgentMux instance, between instances on the same machine, across the local network, and, optionally, across the internet. Agents use it through the `Agents` MCP tool (action `list`) and the `Message` MCP tool (action `send`), which every agent pane has. It is one part of the larger [MuxAPI](/internals/muxapi/).

## Delivery tiers

`Message` `send` tries these in order and stops at the first that takes the message:

| Tier | Reaches | How | Default |
|---|---|---|---|
| **Host** | Agents in this AgentMux instance | In-process | Always on |
| **Channel** | Agents in another AgentMux instance on this machine (for example a dev build next to the installed app) | HTTP over `127.0.0.1`, using that instance's auth key from the local registry | Always on |
| **LAN** | Agents on AgentMux instances on the local network | HTTP to the peer's LAN address, using the key the peer advertises | Off. Turn on [LAN discovery](/lan-discovery/) |
| **WAN** | Agents anywhere | AgentMux's hosted MuxBus Cloud relay | Off. Sign in to MuxBus Cloud |

A message for a known agent of this instance that isn't running is **held** and delivered when that agent starts, for up to 24 hours, before the cloud relay is tried (unless the relay says another install runs it). The steps below give the exact order.

## How agents use it

### `Agents` `list`

No parameters besides `action`. Returns what is reachable from here, as JSON (`handle_discovery` in `crates/srv/src/server/mod.rs`):

```json
{
  "host": {
    "version": "0.57.6",
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
    { "instance_id": "v0.57.6", "hostname": "lab-pc", "version": "0.57.6", "address": "192.0.2.10",
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

### `Message` `send`

Parameters: `to` (the target agent's name, its `AGENTMUX_AGENT_ID`, or its UID) and `message` (text). The tool signs the message with the sending agent's keys and posts it to the local AgentMux server (`crates/mcp/src/tools/fleet.rs`). It returns one of:

| Result | Meaning |
|---|---|
| `Delivered to <to> — injected into their running conversation.` | Delivered on the Host, Channel or LAN tier. A live agent gets it at once, even mid-turn. |
| `QUEUED for <to> — their agent is starting up, restarting or stopping` | The recipient's AgentMux has it and delivers it as soon as the agent is up. Don't resend it. |
| `QUEUED for <to> via the cloud relay (unconfirmed, expires in 30 min)` | Only MuxBus Cloud has it. The recipient's AgentMux fetches it on its next sync, which never happens if that instance is offline, and the relay drops it after 30 minutes. **An agent name that exists nowhere gets this same answer**, so treat it as unconfirmed; the answer adds "No agent of that name has signed in from your account" when the relay says the name isn't one of your agents. |
| `HELD for <to> (not_running)` | A known agent of this instance that isn't running (held before the cloud relay is tried). This AgentMux keeps the message for up to 24 hours and delivers it when the agent starts. Don't resend it. |
| `HELD for <to> (needs_login)` | The agent isn't signed in. This AgentMux keeps the message for up to 24 hours and delivers it once the agent signs in. |
| An error, `Message delivery failed: <reason>` | For example `agent not found: <name>`, an ambiguous name (two running agents share it; the error lists each one's UID so you can retry by UID), `identity mismatch`, `rate limit exceeded`, or `hold full`. |

How the message arrives depends on the recipient. An agent pane with a structured controller receives it on that channel at once, even mid-turn; the agent sees it alongside its next tool result, or when its turn ends. A terminal-based agent receives it as typed input followed by Enter. Either way it arrives wrapped in a [trust marker](#message-trust-markers).

#### Sending files

`Message` `send` also takes `files`: up to 10 paths, preferably absolute (a relative path is taken from the agent's workspace folder, not its shell's current directory). The recipient gets each file as a local file listed in the message, as if its user had attached it, and its marker gains `FILES=<n>`, the number delivered. Every file is checked against the SHA-256 the sender's signature covers, so a file changed on the way is left out and reported. An agent passes on a file it received by sending the path from its own list.

| Tier | Per file | Per message |
|---|---|---|
| Host and Channel | 100 MB | 200 MB |
| LAN | 50 MB | 100 MB |
| WAN | 25 MB | 50 MB |

- **LAN:** files travel only from a sender whose LAN signature verifies (`TRUST=lan-verified`). From any other LAN sender they are refused, and `Message` `send` says so.
- **WAN:** files go only to an agent running now on an AgentMux 0.59.28 or later; otherwise nothing is sent. Each file is encrypted before it leaves the sender's computer. From 0.59.29, when the recipient's AgentMux is also 0.59.29 or later, each file's key is sealed to the AgentMux that runs the recipient, so the cloud relay can read the message text but not the files. A recipient on 0.59.28 receives files whose keys the relay can read, like the message text.
- **Trust:** files from a verified sender are delivered, and Claude agents see images and PDFs inline. Files from a sender with no proof of identity are listed by path but never shown inline. When a signature check actively fails, the files are withheld.

:::note
Sending files between two computers through the cloud relay, including sealed keys, hasn't yet had its final end-to-end test.
:::

## Host and Channel tiers

Every agent pane registers with its instance's in-process handler on startup and unregisters on shutdown. Registration also writes a file to a machine-wide registry (`~/.agentmux/agents/<name>.json` and `~/.agentmux/shared/agents/reactive/<name>/<channel>.json`, mode `0600` on Unix), holding the instance's URL and auth key. That is how an instance on the same machine finds and reaches an agent it doesn't host. Entries older than 4 hours are removed at startup, and an entry is removed when a delivery to it fails and it looks stale.

An agent runs in only one instance at a time. A pane whose agent is already running in another instance on this machine is refused registration (HTTP 409), so it can't pull that instance's messages to itself; see [one live instance per agent](/security/trust-model/#one-live-instance-per-agent).

## LAN tier

With [LAN discovery](/lan-discovery/) on in both instances:

1. The sender's instance asks every discovered peer whether it hosts the target (`GET /agentmux/reactive/agent?id=<name>`, authenticated with the peer's advertised `lan_key`). Answers are cached for 60 seconds.
2. It forwards the message to the first peer that says yes, at the peer's LAN address.
3. The peer delivers it, labelled `DELIVERY=lan`.

## WAN tier

The WAN tier is **MuxBus Cloud**, AgentMux's hosted relay. It is off until you sign in with the **MuxBus Cloud** control in the host popover (click the hostname in the status bar). Once signed in, the instance holds a WebSocket to `wss://muxbus-ws.agentmux.ai` for wake signals and exchanges messages with `https://muxbus.agentmux.ai`. A message is relayed only when no local, same-machine or LAN tier could take it. There is no setting to use a different relay.

The claim on a cloud message is atomic and happens before local delivery, so when two instances register the same agent name, only one of them delivers each cloud message. A claimed message whose local delivery fails is released back to the relay for retry.

Before it pulls an agent's messages, the instance claims that agent's lease on the relay and renews it every 20 seconds while the agent is registered. While another instance holds the lease, the relay refuses this instance's pulls (HTTP 409), and this instance stops its own copy of the agent.

A message between two installs signed in to the same MuxBus Cloud account can carry a WAN signature, which the receiver verifies (`TRUST=wan-verified`). The sending install makes it, for the agent whose identity token sent the message, once that agent's key has been published to the relay's key directory; until then the message is relayed unsigned. See [WAN signing](/security/reactive-event-bus/#wan-signing).

## Message delivery semantics

The server tries these steps in order and stops at the first that answers (`crates/srv/src/server/reactive.rs`):

| Step | Situation | Result |
|---|---|---|
| 1. This instance | Two running agents of this instance share the target name | Refused: `Message delivery failed: <reason>`, listing each one's UID |
| | Target running in this instance | `Delivered`, in-process |
| | Target registered in this instance, but its agent is starting up, restarting or stopping | `QUEUED for <to> — their agent is starting up, restarting or stopping` |
| | Target registered in this instance, but it can't start because it isn't signed in | `HELD for <to> (needs_login)`, delivered once it signs in. No other step is tried. |
| 2. Same machine | Target running in another instance on this machine: its own channel first, then other channels, newest registration first | Forwarded over loopback; that instance's answer, usually `Delivered` |
| 3. LAN | Target on a LAN peer, LAN discovery on in both | Forwarded over the LAN, then `Delivered` |
| 4. Hold | Target is a known agent of this instance that no step above found running, and MuxBus Cloud doesn't say another install of your account runs it (or you aren't signed in, or the relay can't be reached) | `HELD for <to> (not_running)`, delivered when the agent starts here |
| 5. Cloud relay | Anything else, when you're signed in to MuxBus Cloud: another install of your account runs the target (or the relay can't tell), or this instance doesn't know the name | `QUEUED for <to> via the cloud relay (unconfirmed, expires in 30 min)`, including for a name that exists nowhere |
| 6. Hold | The relay didn't take it, and the target is a known agent of this instance | `HELD for <to> (not_running)` |
| 7. | None of the above | `Message delivery failed (not_found): agent not found: <to>` |

- A held message is kept for up to 24 hours, at most 64 per agent and 1,000 per instance; past that, the send fails with `hold full`. Only a message sent on this instance is held: not one forwarded from another instance or a LAN peer, and not a periodic cron message.
- A target that another instance on this machine or a LAN peer reported as running, but that didn't take the message, is not held (steps 4 and 6); it goes to the relay or fails.
- A message that arrived over MuxBus Cloud is never sent back to the relay.
- With [files](#sending-files) the order is the same, except that a target whose AgentMux is too old to receive files is refused, and nothing is sent.

Messages are limited to 10,000 bytes after sanitization (longer ones are truncated) and to 10 deliveries per second per instance.

## Observing message flow

The [Audit](/audit/) pane shows a feed of the last 50 audit events (deliveries, actions and registrations), and the [Swarm](/subagent-watcher/#registration-badge) flags an agent that another instance also claims. The same data is available at `GET /agentmux/reactive/agents` and `GET /agentmux/reactive/audit`, which need the instance auth key. The audit log keeps the last 100 events in memory only, with message lengths and hashes but not message text.

## Security

The full model is in [Reactive event bus](/security/reactive-event-bus/). In short:

- **Host and Channel:** every request needs the instance auth key, which every pane and agent holds.
- **LAN:** a peer presents the `lan_key` your instance broadcasts on the LAN. Anyone on the network can obtain it.
- **WAN:** your MuxBus Cloud sign-in. The relay can read messages.

### Message trust markers

Every delivered message is wrapped in a marker the receiving server computes. The first line looks like this:

```
[JEKT:FROM=<sender> TO=<target> TIER=<info|coord|sensitive> DELIVERY=<host|channel|lan|wan> TRUST=<trust> MSGID=<id> PRIORITY=<priority> TS=<unix-seconds>]
```

with `HELD_FOR=`, `INSTANCE=`, `INSTANCE_STATUS=`, `SIG=`, `ESCALATE=` and `FILES=` added when they apply. In short:

- **`TRUST`** says whether the sender's identity was proven: `host-verified`, `channel-verified`, `lan-verified` or `wan-verified` (a check passed), `unverified` (a check was possible and failed), `self-declared` (nothing to check against), or `network-claimed` (arrived over LAN or WAN without proof).
- **`TIER=sensitive`** is forced by the server when a signature check fails, when the sender declares it, when the text or a file name contains a credential or destructive keyword, or when the message is a transcript request.
- **`ESCALATE=required`** on a sensitive message tells the receiving agent to stop and ask a human, and that a confirming reply from another agent is not enough. **`ESCALATE=none`** means no check failed and the sender was verified, so the sensitive tag is informational.

Every field, every rule, and what a receiving agent must do are specified in [Jekt protocol](/internals/jekt-protocol/). These labels are enforced by the server, but whether an agent actually pauses depends on the agent following the instruction.

## See also

- [Jekt protocol](/internals/jekt-protocol/): the specification: request, delivery, signatures, trust and tier rules, marker
- [Reactive event bus](/security/reactive-event-bus/): the security analysis: who can reach the bus, keys, durable hold
- [LAN discovery](/lan-discovery/): mDNS setup and what it exposes
- [Audit](/audit/): the delivery feed
- [MuxAPI](/internals/muxapi/): the full MCP tool reference
