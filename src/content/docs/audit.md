---
title: Audit
description: "The Audit pane: every message between agents, fleet and pane actions with their reasons, agent registrations, and what agents did with your secrets."
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

The **Audit** pane is the record of what happened between agents and with your secrets. It is one feed, newest first, with a **Secrets** block below it.

## Where to find it

The Audit widget (icon: `list-check`) is **not pinned** to the widget bar by default. Open it in any of these ways:

- Click **more** at the end of the widget bar and choose **Audit**. Right-click it there and choose **Pin to bar** to keep it on the bar.
- **Open Audit** in the command palette (`open:audit`).

A tab holds one Audit: choosing it again brings back the one already open. Audit was for a while a section of the Warden pane: see [Warden](/warden/). An old Warden pane, or an old pin for the whole Warden, opens the Audit.

## The feed

The feed is the record of what happened between agents, newest first (`frontend/app/view/audit/`). It is read from a file AgentMux only appends to, so it reaches back past restarts, and you can page back through all of it. It holds:

- every [jekt](/glossary/#jekt) delivery, from any tier, with sender and recipient, size in bytes, and success or failure (failed rows are tinted red and show the error);
- agent stops from the [Swarm fleet toolbar](/subagent-watcher/#fleet-toolbar) or `Stop` `agents`, and `Stop` `pane` calls in which an agent closed a pane that holds no agent;
- agents shut down or quitting themselves (`/shutdown`, `/quit`, `/exit`, **Shut down** in My Agents or a pane's menu, or `Stop` `self`), including a self-quit that has to wait for your 15-second override;
- the 30-second override window that an agent's `Stop` `agents` or its `Stop` `pane` opens for you: one row when it is requested ("pending user override…") and one with the outcome (shut down, superseded, failed, or kept by the user);
- [remote operations](/lan-discovery/#remote-operations): `remote.request` rows for the requests an agent here sent to another machine, and `remote.<operation>` rows for the typed requests another machine's agent sent here, under `agent@machine` with how the request was proven and how it ended (done, refused with its reason, or failed);
- agent registrations: a row when an agent **registered**, **unregistered**, or was **swept** (its pane was gone);
- agent starts and ends: a row when an agent's session started (resumed, or new, with or without its record) and when it stopped, with why;
- the state-changing calls agents and the app make through AgentMux's APIs, as **Actions** rows ("*agent* *command* on *target*", with "(failed)" when refused). Over HTTP the caller is the agent its token names, or `unproven`; an HTTP call is never recorded as you, because nothing on an HTTP request proves the window made it;
- messages two agents send each other through the Claude CLI's own messaging (only when `agent:climessaging` is on), as a jekt row whose summary says "CLI message", with the sender named by AgentMux from the verified process id, not from the name the message gives.

An entry never holds a message's text, only its length: the file keeps a hash and a size.

Each row shows how long ago it happened (hover for the exact time), the kind, what happened and the reason, and, on a delivered jekt, what the message cost the receiver to read. A cost marked `~` is an estimate from the message's length, such as "~120 tokens". Stops, pane closes and quits read "*who* *what happened* on *whom*"; the reason says more.

### Filters

Above the feed:

- **Agent**: only the entries that name this agent, as sender, receiver or actor.
- **Search entries**: only the entries whose summary, agents or reason contain the text.
- **How far back**: **All time**, **Last hour**, **Last 24 hours** or **Last 7 days**.
- **Kind chips**: **Jekts**, **Actions**, **Registrations**, **Starts**, **Ends**, **Tool calls** and **Thoughts**. The first five are on by default. Tool calls and thoughts are not recorded anywhere yet: turn them on and the pane says "Not recorded yet".

A line under the filters totals everything the filter matches, not only the rows shown: "212 entries · ~38k tokens". The feed shows 50 entries; **Show older** adds the next 50.

### Open the agents an entry is about

A row has a button for each agent it names, only where it can work:

- **Sender's history** and **Receiver's history** on a jekt, **Actor's history** and **Target's history** on an action, **In history** on a start, an end or a registration: opens that agent's [History](/history/) at the moment of the entry, in the conversation it happened in, so you read what was said around it. For a start or end, History opens at the exact point the session began or ended.
- **Sender's pane**, **Receiver's pane**, **Actor's pane**, **Target's pane** or **In its pane**: shows the agent's live pane, while it has one.

The feed refreshes every 5 seconds while you are at the newest entries and the pane is shown. Once you page back, the list stays where it is until you change a filter. A stopped or hidden Audit doesn't refresh.

Which agents are registered to receive messages is shown in the [Swarm](/subagent-watcher/): an agent that another AgentMux instance on the same machine also claims, or whose messages were refused for an identity mismatch, carries a badge on its row, and the row menu has **Stop receiving messages** for it.

## Secrets

Below the feed is **Secrets**: every use of a [Vault](/vault/) entry by an agent (filling a web form, running a command), with the entry, where it went and the outcome, and every standing permission ("may be used without asking") with a × to stop it. It never shows a value, and it doesn't list your own saves, reveals or copies; those are in the Vault's own Activity. **Open the Vault** goes to the Vault's Activity, which links back here. Showing this block doesn't read the Vault's entries, so it never makes the OS ask for the Vault key.

## See also

- [The Vault](/vault/): your secrets, and its own Activity
- [History](/history/): what agents did, as a conversation
- [Swarm](/subagent-watcher/): registered agents, the fleet toolbar and the Supervisor
- [Interagent communication](/internals/interagent-comms/): how jekts are delivered
- [Warden](/warden/): where this pane used to be a section
