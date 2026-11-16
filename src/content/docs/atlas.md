---
title: Atlas
description: "The Atlas pane: every agent on every machine as a map, with who reports to whom, the messages and tasks passing between agents, and the review bot and CI beside their pull requests."
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

The **Atlas** draws the agents the [Swarm](/subagent-watcher/) lists as a map: the machines they run on are boxes, each agent is a node in its machine's box, and a line runs from an agent to each agent that reports to it. While agents work, lines show the messages and tasks passing between them and the pull requests the review bot and CI have looked at. It reads the same agents as the Swarm, so the two always agree.

## Where to find it

- **Atlas** in the widget bar's **more** menu (right-click it there and choose **Pin to bar** to keep it on the bar).
- **Open Atlas** in the command palette.

The button and the command bring back the Atlas already open in the tab, or open one if the tab has none; Shift-click the button to open another.

## Reading the map

Each machine is a box titled with its name. Its badge says how the machine was found: **this machine**, **LAN** (a [LAN peer](/lan-discovery/)) or a cloud icon with **cloud** (one of your account's other machines that is not on this network; see [the cloud tier](/subagent-watcher/#agents-on-other-instances)). The badge also carries the machine's platform and **stale** when its last report is old. A machine whose container runtime is not running says **container runtime not running**. When the account's other machines could not be read just now, a note at the foot of the map says so.

An agent is a node with a coloured dot for its state, its name, and under it its [seat](/first-agent/#seats), or the state in words when it has none. Hover a node for the agent's summary line. The states are **Working**, **Waiting for an answer**, **Idle**, **Exited with an error**, **Out of quota**, **Signed out** and **Stopped**. A node of an agent in a container has a box icon and a dashed frame. A node of an agent on a machine whose last report is old is dimmed.

Stopped agents are not nodes. Each machine's box folds them into one chip, **N stopped**, that opens a list with **Open** and **Start** for each. With **By seat** (below), stopped agents are not drawn and a note counts them.

A machine's containers that no agent uses are nodes too, labelled **No agent** and the container's state.

### Layouts

The **Layout** control above the map has two choices, kept with the pane:

| Layout | What it shows |
|---|---|
| **By machine** | Each computer is a region with its agents inside it. Inside a region, an agent with reports stands above them, and agents with no lead and no reports stand in a grid below. |
| **By seat** | Every agent in one picture, under the agent it reports to, across machines. A node's tint tells which machine it runs on. |

The **Swarm's filter** sits at the left of the same bar and narrows the agents drawn the way it narrows the Swarm. The wheel zooms the map about the pointer, a drag on the background pans it, and the zoom buttons and **Fit all** do the rest. Ctrl or Cmd with the wheel zooms the whole pane, not the map.

### Lines

| Line | What it means |
|---|---|
| A solid line from one agent to another | The second reports to the first. A line is drawn only when both agents are on the map; a lead that is stopped, unknown or named in a way that fits two agents leaves the agent without one. |
| A dashed line from one agent to another | The second is a worker the first started, rather than one given a seat |
| A line that appears from a sender to a receiver and fades after about 12 seconds | A message between the two agents. Its colour says what happened: delivered, held or queued for later, or refused. A message with only one end on the map rings that end instead. |
| A dotted line with a number such as `#12` | A task one agent filed for, moved to or started on another, or handed back. It stays for about 5 minutes. Two numbers that would land on the same spot sit next to each other. |
| A dashed line from the **Review bot** or **CI** to an agent, with a pull request number | A review of that agent's pull request, or the checks of its latest commit. It is bright for the first 5 minutes, then dim until the pull request merges. A review by another bot or a person adds **Codex** or **person** after the number. |

Messages and tasks on the map are drawn with the agents' names and numbers only, never their text.

### The review bot and CI

The **Review bot** and **CI** are two nodes in a region of their own, titled **Pull requests** with the badge **GitHub**. They appear once a review, check or merge notice has reached this machine; a machine that gets none shows agents only. Each node says what needs you: **N need changes** or **N failing**, otherwise **N passing** or the time of the **Last notice**. While cloud messages are paused, both say **Cloud messages paused** and notices are not arriving.

Click a node for a card listing its pull requests newest first, each with its state (for example approved, changes requested or failing), the agent whose pull request it is and the time.

## The agent card

Click an agent to open its card at the edge of the map; **Esc** or the close button closes it. The card shows only what is known:

| Row | What it says |
|---|---|
| **State** | The state, with "(last report is old)" when its machine has not reported lately |
| **Doing** | Its summary line |
| **Tool** | The tool it runs now |
| **Seat** | Its [seat](/first-agent/#seats), in full |
| **Machine** | The machine it runs on |
| **Provider** | Its provider |
| **Runtime** | **NATIVE** on the machine, or **CONTAINER** |
| **Container** | For one of this machine's container agents: the container's name, its state and since when, and its image |
| **Account** | For an agent on another machine: the account it uses on this computer's name for it, or "Not signed in on this computer", and **Also on it** with the other agents that share the account (and so its quota) |
| **Branch** | The repository and branch of the agent's clone, for an agent of this AgentMux |
| **Tasks** | The Kanban tasks the agent holds, each with its pull request as a button that opens it |
| **Context** | The size of its context |
| **Spend today** | For an agent on a model route with a daily cap, how much of the cap it has used |

**Open** brings the agent's pane forward, or opens it when it has none. An agent of another machine has no pane here, so it has no **Open**. A container with no agent has a card with its state, image and "None: no agent of this machine uses it."

## Selecting agents

The Atlas has the Swarm's own **Broadcast**, **Stop** and **Supervisor** controls, acting on the agents you select on the map.

- **Drag a box** around agents with Shift held. The nodes the box touches show a check as you drag.
- Or turn on **Select** (the button next to the zoom controls). A plain drag then draws the box, and Shift with a drag pans the map.
- **Click** a node with Shift, Ctrl or Cmd held, or with **Select** on, to add or remove one agent.

The bar under the map shows once something is selected, or **Select** is on: **Select all** / **Select none**, **Stop {N}**, **Supervisor** and the **Broadcast** message box, as in the Swarm's [fleet toolbar](/subagent-watcher/#fleet-toolbar), with the same confirmation and the same result list naming each agent. The selection is the Swarm's own, so it carries over to the Swarm. Stopped agents, agents of a machine that has gone stale and the review bot and CI cannot be selected. A cloud machine's agents are display only: a broadcast or stop that includes one says it could not reach it.

See [Broadcast](/subagent-watcher/#broadcast) and [Supervisor](/subagent-watcher/#supervisor) for what each does. Supervisor modes apply to the selected agents of this AgentMux only.

## See also

- [Swarm](/subagent-watcher/): the list the map is drawn from
- [Kanban](/kanban/): the tasks whose hand-overs the dotted lines show
- [LAN discovery](/lan-discovery/): how other machines show up
