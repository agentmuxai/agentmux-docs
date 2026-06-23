---
title: Warden widget
description: The Warden is AgentMux's operator surface for monitoring and (softly) controlling agents across the Host, LAN, and Internet layers.
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

The **Warden** is a pane that gives you a single place to see *who is running, where, and what they're doing* across every AgentMux instance reachable from your machine. It also exposes a small set of *control* actions on the local Host layer; more enforcement (and cross-instance control) is coming as the underlying networking matures.

## Where to find it

The Warden is a pinned widget (icon: shield) in the widget bar. Click it to open a pane. There is no keyboard shortcut yet.

## The three layers

The Warden renders one section per **trust layer**, in order of decreasing trust:

| Layer | What it covers | Trust |
|------|----------------|-------|
| **Host** | The AgentMux process on this machine | Trusted — same memory space |
| **LAN** | Peer AgentMux instances reachable via [LAN discovery](/lan-discovery/) | Semi-trusted — same network |
| **Internet** | Cross-network peers via the MuxBus cloud relay | Untrusted — opt-in only |

Each section has a small status chip in its header: `live`, `stub`, or `disabled`. That tells you at a glance whether the layer is currently functional (Host: yes), waiting on more substrate (LAN: live if you've enabled mDNS, otherwise empty), or deliberately off until you opt in (Internet: disabled by default).

## Host section

The Host section is where most of the action lives today.

### Agent table

Lists every agent currently registered with this instance's reactive handler:

| Column | What |
|---|---|
| `agent` | Agent ID (matches what shows in the agent pane title bar) |
| `pane` | Short hash of the pane ID hosting the agent |
| `last seen` | Time since the agent last sent a heartbeat (refreshes every second) |
| `state` | `active` if heartbeat ≤ 30 s ago, else `idle` |

The list refreshes every 5 s. Agents that stop heart-beating drop off the table; they re-appear within a few seconds of registering again.

### Audit feed

Below the agent table, the **Recent jekts (audit)** feed shows the last 50 [jekt](/glossary/#jekt) events: which agent jekted which, how many bytes were delivered, and whether the delivery succeeded. Failed rows are tinted red and carry the error message inline.

The feed shares the 5 s refresh tick with the agent table and uses the same backend audit endpoint that the reactive handler maintains for its own bookkeeping.

### Soft deregister

Each agent row has a `×` button. Clicking it (after confirming the dialog) **deregisters** the agent from the reactive handler — future jekts to it return `agent not found`. This is intentionally a **soft** action:

- The agent's underlying process / pane keeps running
- The agent may re-register on its next heartbeat (if its shell auto-register hook is still alive)
- Nothing on disk changes — no files removed, no state lost

Useful when you want to **stop letting an agent receive jekts** while you investigate something, without killing its process. A real hard-kill (PTY termination, pause-host, kill-all) is a separate, more dangerous capability that hasn't shipped yet.

## LAN section

The LAN section populates when you turn on [LAN discovery](/lan-discovery/) via the HostPopover toggle. Once mDNS is up, peer AgentMux instances on your network appear here within ~5 s, with their hostname, version, address, agent count, and last-seen age.

| Column | What |
|---|---|
| `peer` | Peer's hostname (or instance ID if no hostname) |
| `version` | Peer's AgentMux version |
| `address` | Peer's IP and backend port |
| `agents` | Number of agents currently registered on the peer |
| `last seen` | Time since the peer last announced |

Today the LAN section is **read-only in the Warden UI** — you can see peers, but you can't yet jekt to them through the Warden, quarantine them, or push policy. LAN jekt forwarding itself shipped in v0.46 (accessible via `SendMessage` MCP tool); the Warden UI controls for cross-instance jekt and quarantine are a follow-up.

## Internet section

The Internet section is **closed by default**. Cross-network governance (via the MuxBus cloud relay) ships behind a future opt-in. The section currently shows a status chip of `disabled` and a one-line explanation.

## What the Warden is *not*

Two adjacent surfaces sometimes get confused with the Warden:

- The **[Swarm pane](/pane-types/#swarm)** is about *workflow*: which agents are running which tasks, what stage they're at, throughput. The Warden is about *policy*: who exists, what each one is allowed to do, what they've actually done. Both touch agent state, but for different questions.
- The **HostPopover** in the status bar is a quick-access overview of *this* instance. The Warden is the multi-layer deep-dive — see the same hostname info, plus the agent table, audit feed, and peer list.

## Status today

| Capability | Status |
|---|---|
| See agents on this host | ✅ Live |
| See recent jekts (audit) | ✅ Live |
| Soft-deregister an agent | ✅ Live |
| See LAN peers via mDNS | ✅ Live (turn on LAN discovery) |
| Hard kill (PTY termination) | ❌ Future PR |
| Pause host / kill-all | ❌ Future PR |
| `governance.json` policy file | ❌ Future PR |
| Approval queue (human-in-the-loop) | ❌ Future PR |
| Cross-instance jekt forwarding via Warden UI | ❌ Future PR |
| Quarantine a peer / push policy | ❌ Future PR |
| Internet (cloud) governance | ❌ Blocked on MuxBus cloud relay |

## See also

- [LAN discovery](/lan-discovery/) — the substrate the LAN section reads from
- [Warden architecture (internals)](/internals/warden/) — design, layers, RPC contracts
- [Interagent communication](/internals/interagent-comms/) — the reactive event system the audit feed reads from
- The [`SPEC_WARDEN_WIDGET_2026-05-25.md`](https://github.com/agentmuxai/agentmux/blob/main/specs/SPEC_WARDEN_WIDGET_2026-05-25.md) spec in the main repo for the full design
