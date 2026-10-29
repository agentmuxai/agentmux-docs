---
title: Warden
description: "The Warden pane is gone. Where each of its sections went: the Vault, History, Audit and Jobs panes, the Swarm, the status bar's network pill and token pill."
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

The **Warden** pane no longer exists. Each of its sections became a pane of its own, or moved to where it belongs. This page says where, so old links and old habits still find the right place.

| Warden section | Where it is now |
|---|---|
| **Vault** | The [Vault](/vault/) pane |
| **History** | The [History](/history/) pane |
| **Audit** | The [Audit](/audit/) pane |
| **Jobs** | The [Jobs](/jobs/) pane (**Open Jobs** in the command palette) |
| **Host** | The [Swarm](/subagent-watcher/#registration-badge): a badge on an agent's row and **Stop receiving messages** in its menu |
| **LAN** | The status bar's [network pill](#the-network-pill) |
| **Ambient** | The status bar's [token pill](#the-token-pill) |
| **Internet** | Gone. It was a placeholder. The cloud relay is the network pill's **MuxBus Cloud** block |
| **Kanban** | The [Kanban](/kanban/) pane |

Vault, History and Audit are widgets in the **more** menu, not pinned to the widget bar by default, with palette entries **Open Vault**, **Open History**, **Open Audit** and **Open Jobs**. Each is one pane per tab: choosing it again brings back the one already open.

## Old panes, pins and widgets

Nothing you saved breaks:

- A saved pane, widget-bar pin, `widgets.json` entry or layout file that named a Warden section opens that section's new home. A Vault, History or Audit section opens its pane, and Host opens the Swarm.
- LAN and Ambient aren't panes, so there is nothing to open. A pane, pin or widget call for them opens nothing and says where the section went. Internet says it is gone.
- A Warden with no section, or a pin for the whole Warden, opens the **Audit**. That opens nothing that needs your Vault key.
- A widget that calls `am.panes.open("warden", { "warden:section": "history" })` still works and opens the History pane. See [Widget API](/widget-api/#opening-a-section).

## The network pill

The pill in the status bar that shows this computer's hostname (the host popover) is where the LAN section went. With [LAN discovery](/lan-discovery/) on, each AgentMux instance found on your network is a row in the popover. Click a row to expand it:

| Row | What |
|---|---|
| **Address** | The peer's IP address and port |
| **Runs** | Its operating system and channel |
| **Agents** | How many agents it has, with **Show in Swarm** |
| **Last seen** | How long ago the peer was last seen |

A peer whose agent sent a message that was refused because its key changed has a warning on its row, with **Review in Settings › Devices › Pinned senders**. Accepting a new key stays in Settings, beside its explanation. The pill doesn't change the peer's trust by itself, and there is still no control to send to or quarantine a peer from it: agents send with the `Message` tool.

## The token pill

The token counts in the status bar (the ↑ and ↓ numbers) open a popover with the tokens agents have used. Its **AgentMux internal** row is where Ambient went: the model requests AgentMux makes on its own (session titles, subagent and workflow names, prompt suggestions, agent previews, narration, running summaries and Supervisor verdicts), not your agents' turns. Open it for one line per purpose with a count of failures; open a purpose for how its requests ended:

| Column | Meaning |
|---|---|
| **Requests** | All requests, including ones that never reached the model |
| **Accepted** | The model's answer passed AgentMux's checks and was taken. The pane can still keep the old title if the new one only rewords it |
| **Kept** | The model chose to leave things as they were. This is a normal answer, not a failure |
| **Refused** | The answer was rejected: blank, the wrong shape (several lines, too long, no letters), a non-answer such as "none" or "untitled", or a refusal |
| **Skipped** | No answer was needed: there was nothing to send, or a newer request replaced this one |
| **Failed** | The model's CLI couldn't run, failed, timed out, or the request was dropped before it ran |

A purpose is failing when its refused and failed requests together outnumber the accepted and kept ones, and the token indicator then shows a small red dot. The counts start again when AgentMux's server restarts.

These requests write the line under each agent in the [Swarm](/subagent-watcher/) and in the pane tab's tooltip, so this is where you see whether that line is working.

## See also

- [The Vault](/vault/), [History](/history/), [Audit](/audit/) and [Jobs](/jobs/)
- [Swarm](/subagent-watcher/): live agent activity, the Supervisor and the fleet toolbar
- [LAN discovery](/lan-discovery/)
- [Warden architecture (internals)](/internals/warden/)
