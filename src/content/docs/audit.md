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

The feed shows recent entries from the message handler's audit log, most recent first (`frontend/app/view/warden-audit/`):

- every [jekt](/glossary/#jekt) delivery, from any tier, with sender and recipient, size in bytes, and success or failure (failed rows are tinted red and show the error);
- agent stops from the [Swarm fleet toolbar](/subagent-watcher/#fleet-toolbar) or `Stop` `agents`, and `Stop` `pane` calls in which an agent closed a pane that holds no agent;
- agents shut down or quitting themselves (`/shutdown`, `/quit`, `/exit`, **Shut down** in My Agents or a pane's menu, or `Stop` `self`), including a self-quit that has to wait for your 15-second override;
- the 30-second override window that an agent's `Stop` `agents` or its `Stop` `pane` opens for you: one row when it is requested ("pending user override…") and one with the outcome (shut down, superseded, failed, or kept by the user);
- [remote operations](/lan-discovery/#remote-operations): `remote.request` rows for the requests an agent here sent to another machine, and `remote.<operation>` rows for the typed requests another machine's agent sent here, under `agent@machine` with how the request was proven and how it ended (done, refused with its reason, or failed);
- agent registrations: a row when an agent **registered**, **unregistered**, or was **swept** (its pane was gone), with the block it was, and the block or agent it replaced if registering displaced one.

Each row shows the time, `sender → recipient` (or the agent and what happened to it), the status, a size in bytes and the reason. Rows for stops, pane closes and quits don't name the action; tell them apart by the reason text. Their byte size is the length of the internal action name, not of a message. A stop from the Swarm toolbar shows `—` as the sender.

The pane requests the latest 50 entries and refreshes every 5 seconds while it is shown. The log holds the last 100 entries in memory and is cleared when AgentMux restarts, so the feed is a recent window, not the whole history. A stopped or hidden Audit doesn't refresh.

Which agents are registered to receive messages is shown in the [Swarm](/subagent-watcher/): an agent that another AgentMux instance on the same machine also claims, or whose messages were refused for an identity mismatch, carries a badge on its row, and the row menu has **Stop receiving messages** for it.

## Secrets

Below the feed is **Secrets**: every use of a [Vault](/vault/) entry by an agent (filling a web form, running a command), with the entry, where it went and the outcome, and every standing permission ("may be used without asking") with a × to stop it. It never shows a value, and it doesn't list your own saves, reveals or copies; those are in the Vault's own Activity. **Open the Vault** goes to the Vault's Activity, which links back here. Showing this block doesn't read the Vault's entries, so it never makes the OS ask for the Vault key.

## See also

- [The Vault](/vault/): your secrets, and its own Activity
- [History](/history/): what agents did, as a conversation
- [Swarm](/subagent-watcher/): registered agents, the fleet toolbar and the Supervisor
- [Interagent communication](/internals/interagent-comms/): how jekts are delivered
- [Warden](/warden/): where this pane used to be a section
