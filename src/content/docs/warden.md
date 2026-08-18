---
title: Warden widget
description: The Warden is AgentMux's operator surface for monitoring and supervising agents across the Host, LAN, and Internet layers — agent visibility, an audit trail, and Supervisor-driven auto-continue.
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

The **Warden** is a pane that gives you a single place to see *who is running, where, and what they're doing* across every AgentMux instance reachable from your machine. It also exposes a set of *control* actions: soft-deregistering an agent on the local Host layer, and — new — letting one agent supervise another's session, reading its transcript and nudging it to continue when it stalls. Cross-instance enforcement is still coming as the underlying networking matures.

## Where to find it

The Warden is a pinned widget (icon: shield) in the widget bar. Click it to open a pane. There is no keyboard shortcut yet.

## The five sections

As of the 0.55.7 rebuild, the Warden is a **pane view** (not a floating modal) with a left-hand icon rail — the same rail/tab-bar pattern the [Armory](/armory/) uses, down to the shared chrome styling. On narrow widths the rail collapses to a bottom tab bar.

| Section | Icon | What it covers |
|---|---|---|
| **Host** | `server` | Agents registered with this instance's reactive handler, plus soft-deregister |
| **LAN** | `network-wired` | Peer AgentMux instances on the local network (read-only) |
| **Internet** | `globe` | Cross-network peers via the MuxBus cloud relay (disabled by default) |
| **Audit** | `list-check` | The delivery/audit feed — jekts, plus Supervisor nudge/decline decisions |
| **Supervisor** | `user-shield` | Per-agent auto-continue opt-in, and a feed of recent Supervisor decisions |

Host, LAN, and Internet map onto AgentMux's three trust layers, in order of decreasing trust:

| Layer | What it covers | Trust |
|------|----------------|-------|
| **Host** | The AgentMux process on this machine | Trusted — same memory space |
| **LAN** | Peer AgentMux instances reachable via [LAN discovery](/lan-discovery/) | Semi-trusted — same network |
| **Internet** | Cross-network peers via the MuxBus cloud relay | Untrusted — opt-in only |

Audit and Supervisor are cross-cutting — they aren't scoped to a single trust layer. All five sections stay mounted once the Warden pane is open, so switching between them is instant; each section keeps its own 5 s poll loop running whether or not it's the one currently visible.

Each of the Host/LAN/Internet sections also carries a small status chip in its header: `live`, `stub`, or `disabled`. That tells you at a glance whether the layer is currently functional (Host: yes), waiting on more substrate (LAN: live if you've enabled mDNS, otherwise empty), or deliberately off until you opt in (Internet: disabled by default).

## Host section

The Host section is where most of the direct agent management lives today.

### Agent table

Lists every agent currently registered with this instance's reactive handler:

| Column | What |
|---|---|
| `agent` | Agent ID (matches what shows in the agent pane title bar) |
| `pane` | Short hash of the pane ID hosting the agent |
| `last seen` | Time since the agent last sent a heartbeat (refreshes every second) |
| `state` | `active` if heartbeat ≤ 30 s ago, else `idle` |

The list refreshes every 5 s. Agents that stop heart-beating drop off the table; they re-appear within a few seconds of registering again.

The audit feed for jekts delivered to Host agents now lives in its own [Audit section](#audit-section), not inline under Host — see below.

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

Known issue: the peer-list request currently sits behind the authenticated-routes gate added in the route audit, so it can 401 on load in some setups instead of showing peers — a fix is tracked as a follow-up.

## Internet section

The Internet section is **closed by default**. Cross-network governance (via the MuxBus cloud relay) ships behind a future opt-in. The section currently shows a status chip of `disabled` and a one-line explanation.

## Audit section

The Audit section is the single feed for everything the reactive handler has recorded: the last 50 [jekt](/glossary/#jekt) deliveries (which agent jekted which, how many bytes, success/failure — failed rows are tinted red with the error message inline) plus every decision the Supervisor has made about a stalled agent (nudged, declined, or attempted-but-failed).

Supervisor-originated rows carry two fields ordinary jekt rows don't:

| Field | What |
|---|---|
| `outcome` | `nudge_sent`, `nudge_declined`, or `nudge_failed` |
| `reason` | The Supervisor's stated justification for the decision |

The feed shares the 5 s refresh tick with the rest of the Warden's sections and reads from the same backend audit endpoint the reactive handler maintains for its own bookkeeping.

## Supervisor section

The Supervisor section is a **control surface**, not a decision-maker — it doesn't itself run any judgment about *when* to nudge a stalled agent. That logic lives in an ordinary spawned AgentMux agent that you designate as a supervisor, using two MCP tools to watch and act on other agents:

- **`GetAgentTranscript`** — reads another agent's transcript tail (default 100 lines, server-capped at 500) and whether that agent is currently mid-turn. Read-only; it never delivers anything to the target.
- **`SupervisorNudge`** — sends a fixed, server-owned continuation message ("Continue the task you were already doing.") to a stalled agent, or records a `decline` with no delivery. The message text is not caller-supplied by design — this isn't a free-form messaging channel.

### Auto-continue opt-in

Every agent has a per-agent `auto_continue_enabled` setting, off by default (fail-closed — same posture as ambient login). The Supervisor section lists every agent with a checkbox to flip it. A `SupervisorNudge` **nudge** call is rejected unless the *target* agent has opted in; **decline** is never gated.

### Consecutive-nudge ceiling

To stop a runaway auto-continue loop, the server allows at most **5 consecutive nudges** to the same target within one registration window — the counter resets after roughly 30 minutes without a nudge, or when the target respawns, whichever comes first. Once the ceiling is hit, the next nudge attempt is refused: the Audit feed still records it as a declined outcome (reason: "consecutive-nudge ceiling reached"), and the calling agent gets an error back rather than a silent no-op. The `SupervisorNudge` tool description tells a supervising agent to treat that refusal as a signal to stop nudging and escalate to a human via `SendMessage` instead of retrying.

### Recent decisions

Below the opt-in table, a feed of recent Supervisor decisions shows the same rows as the Audit section, filtered down to Supervisor-originated ones — target agent, nudged/declined/failed, and the stated reason.

There's deliberately no "spawn a Supervisor for this agent" button here — this section only controls which agents a supervisor is *allowed* to act on. You spawn and configure the watcher agent itself the same way you'd spawn any other agent.

## What the Warden is *not*

Two adjacent surfaces sometimes get confused with the Warden:

- The **[Swarm pane](/pane-types/#swarm)** is about *workflow*: which agents are running which tasks, what stage they're at, throughput. The Warden is about *policy*: who exists, what each one is allowed to do, what they've actually done. Both touch agent state, but for different questions.
- The **HostPopover** in the status bar is a quick-access overview of *this* instance. The Warden is the multi-layer deep-dive — see the same hostname info, plus the agent table, audit feed, and peer list.

## Status today

| Capability | Status |
|---|---|
| See agents on this host | ✅ Live |
| See recent jekts + Supervisor decisions (audit) | ✅ Live |
| Soft-deregister an agent | ✅ Live |
| See LAN peers via mDNS | ✅ Live (turn on LAN discovery) |
| Per-agent auto-continue opt-in | ✅ Live |
| Read another agent's transcript (`GetAgentTranscript` MCP tool) | ✅ Live (capped at 500 lines) |
| Nudge or decline a stalled agent (`SupervisorNudge` MCP tool) | ✅ Live (requires target opt-in; capped at 5 consecutive nudges) |
| Spawn/designate a Supervisor from the Warden UI | ❌ Not planned for v1 — spawn the agent normally |
| Hard kill (PTY termination) | ❌ Future PR |
| Pause host / kill-all | ❌ Future PR |
| `governance.json` policy file | ❌ Future PR |
| Approval queue (human-in-the-loop) | ❌ Future PR |
| Cross-instance jekt forwarding via Warden UI | ❌ Future PR |
| Quarantine a peer / push policy | ❌ Future PR |
| Internet (cloud) governance | ❌ Blocked on MuxBus cloud relay |

## See also

- [Armory](/armory/) — the pane view the Warden's rail/tab layout and chrome are modeled on
- [LAN discovery](/lan-discovery/) — the substrate the LAN section reads from
- [Warden architecture (internals)](/internals/warden/) — design, layers, RPC contracts
- [Interagent communication](/internals/interagent-comms/) — the reactive event system the audit feed reads from
- The [`SPEC_WARDEN_WIDGET_2026-05-25.md`](https://github.com/agentmuxai/agentmux/blob/main/specs/SPEC_WARDEN_WIDGET_2026-05-25.md) spec in the main repo for the original Host/LAN/Internet design (predates the 0.55.7 rail rebuild and the Audit/Supervisor sections)
