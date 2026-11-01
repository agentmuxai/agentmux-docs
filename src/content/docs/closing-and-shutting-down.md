---
title: Closing and shutting down
description: "Closing a pane, tab or window keeps its agents running; Shut down is the one act that ends an agent. What each does, where to find Shut down, and when it asks first."
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

Two different things can happen to an agent, and AgentMux keeps them apart:

- **Closing** a pane, a tab or a window takes the view away. The agent keeps running.
- **Shutting down** ends the agent. Nothing else does.

## Closing keeps agents running

With the default setting (`agents:always_available`, on), closing a pane, tab or window **parks** the agents in it: the process, the conversation, its claims and its crons carry on as before, with no pane to show them. Open the agent from **My Agents** to see it again, whether it is idle or in the middle of a turn.

When a close parks agents, a notification says so for a few seconds: "KCont keeps running without a pane" (or "A and B keep running…", "A, B and 2 more keep running…"), with the line "Closing keeps it running. Shut down ends it." and an **Open** button that brings back the first agent. The others are in **My Agents**.

Closing a **window** also keeps the window's place in the workspace. It is listed in the status bar's instance panel as a closed window, with how many of its agents keep running ("2 agents keep running without a window"). **Reopen** puts the window back as it was, and each agent is back in the tab it was in. This survives a restart of AgentMux. Terminals, browsers and other panes in the window do close.

Closing doesn't ask about working agents while they keep running. These closes still stop agents, and still ask first when one is mid-turn:

- **The last open window.** Closing it quits AgentMux; the window opens again at the next launch.
- **Switching workspace.**
- **Any close, with `agents:always_available` turned off.** Closing then ends the agents in it, as it did before.

From your click on **Close** until the pane is gone, the pane is dimmed and ignores clicks, and its header reads **Closing…** (**Closing 3 tabs…** for a pane that holds three).

A browser pane whose page may have unsaved changes (one that would ask "Leave site?") asks first, in AgentMux's own dialog: "Close this pane?" with "*site* may have unsaved changes.", **Keep open** and **Close anyway**. Only a close you make asks. A close an agent makes, or quitting AgentMux, just closes.

An agent with no pane still stops itself after 60 minutes idle (`agents:idle_stop_minutes`), and at most 24 run at once (`agents:max_running`). See [Agents keep running without a pane](/first-agent/#agents-keep-running-without-a-pane).

## Shut down ends an agent

**Shut down** stops the agent's process, releases the work items it had claimed, stops the shells it started and closes its tab. The conversation is kept, and the agent stays in **My Agents**: a message or **Start** brings it back where it left off. A restart of AgentMux doesn't bring a shut-down agent back.

You can shut an agent down from:

- **`/shutdown`** in its message box. `/quit` and `/exit` still work as other names for it.
- **My Agents:** click the agent's tile; its panel has **Shut down**. It is there for every running agent, with a pane or without one.
- **The agent pane's right-click menu:** **Shut down**.

Other ways to end an agent keep their places: **Stop** in the [Swarm](/subagent-watcher/#fleet-toolbar) fleet toolbar and the `Stop` tool, which asks you for 30 seconds when another agent uses it.

### When another agent asks to stop or close yours

You get a countdown, in two places:

- **In the agent's pane,** a banner such as "Korp asked to close Camper. Closing in 12 s." with **Keep running**, which cancels it, and **Close now**, which skips the rest of the wait.
- **In a notification from AgentMux,** such as "Closing Camper in 30 s", with the same two buttons. On Windows it also has a progress bar.

If you do nothing, it goes ahead when the time is up. The wait is 30 seconds when another agent stops or closes yours, and 15 seconds when an agent quits itself during a turn you didn't start.

When one `Stop` call names several agents, they share one window and one notification ("Closing 5 agents: A, B, C and 2 more in 30 s"), whose **Keep running** and **Close now** apply to all of them. **Keep running** on one agent's own banner keeps only that agent; the others still close. That banner reads "Korp asked to close Camper and 4 others".

### When it asks first

An idle agent shuts down at once, with a note saying what it released. Shut down asks first only when something would be lost:

- the agent is **in the middle of a turn**;
- it holds a **claimed task** (it goes back to the pool);
- a **cron job** targets it (the job is kept, and fires again once the agent is started).

The question has a box, **Also stop its background tasks (dev servers)**. Leave it off and anything the agent started in the background, such as a dev server, keeps running.

## Quitting AgentMux

Quitting AgentMux winds the agents down with it, but doesn't shut them down: the agents that were running come back when AgentMux starts again, a few seconds apart. One you shut down stays down.
