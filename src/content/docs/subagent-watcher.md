---
title: "Swarm"
description: The Swarm pane shows every running agent pane on this AgentMux instance as a tree, with its subagents, workflows, background shells, cron jobs and todo list, plus a fleet toolbar for broadcasting to or stopping several agents at once.
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

The **Swarm** pane is the overview of what your agents are doing right now. It lists every running agent pane on this AgentMux instance as a tree: under each agent you see its subagents, workflow runs, background shells, cron jobs, long-running commands and todo list. A fleet toolbar at the top lets you send one message to several agents, or stop them, in one action.

:::note[This page used to be "Subagent Watcher"]
Earlier releases had a separate **Subagent** pane and a Swarm pane with Overview, History and Search tabs. Both are gone. The Swarm pane has no tabs, and subagent activity now expands inline in the tree instead of opening its own pane.
:::

## Opening Swarm

- Click **Swarm** (bee icon) in the widget bar. It is pinned by default (`agentmux-srv/src/config/widgets.json`, `defwidget@swarm`).
- Command palette (`Ctrl+P`): **Open Swarm**.
- Click **+** on any pane's tab strip and pick **Swarm** to add it as a tab in that pane.
- Right-click a pane header → **Replace With...** → **Swarm** replaces that pane with Swarm.
- In an agent pane, click a subagent or workflow dispatch card (it reads **View in Swarm →**; `Enter` or `Space` also work). Each click opens a new Swarm pane (`frontend/app/view/agent/components/tool-renderers/DispatchCard.tsx`).

With no agent panes open, Swarm shows **No active agent panes** and "Start an agent session to see it here." The fleet toolbar only appears once there is at least one agent.

## Layout

From top to bottom (`frontend/app/view/swarm/swarm-view.tsx`, `SwarmView`):

1. The [fleet toolbar](#fleet-toolbar).
2. A result panel, shown only after a fleet action.
3. A **Clear completed (N)** button, shown only when there are finished rows to dismiss.
4. The agent tree.

Swarm supports per-pane zoom like other panes, from 50% to 200%: `Ctrl`+scroll, or `Ctrl` `+` / `-` / `0`.

## The agent tree

Each top-level row is a **running agent pane** on this AgentMux instance, across all of its windows and workspaces. Agents on other AgentMux instances or LAN peers are not listed.

An agent row shows:

| Element | What it shows |
|---|---|
| Checkbox | Selects the agent for a fleet action |
| Chevron (▸ / ▾) | Expands or collapses the row. Shown only when the agent has child rows. |
| Provider logo and name | The pane's agent name, or "Agent" if it has none |
| Child count | Number of child rows, shown while the row is collapsed |
| Context size | The context-window reading from the agent's last turn, e.g. `45.2k` |
| Status chip | `working`, `tools`, `stopping`, `idle`, `error` or `offline` |
| Activity line | A one-line summary of what the agent is doing, when available |
| Current tool | The tool the agent is running right now, while it is working |

**Clicking an agent row focuses that agent** (`frontend/app/view/swarm/swarm-view.tsx`, `frontend/app/util/focus-block.ts`): AgentMux switches to the agent's tab, brings its pane tab to the front if the pane has several tabs, and focuses its pane. If the agent is in another window, that window is brought forward. Only the chevron expands or collapses a row, and ticking the checkbox doesn't move focus. Rows start collapsed. Clicking empty space in Swarm focuses the Swarm pane itself.

Rows use the agent's own pane-tab color: the row of the currently focused agent pane has a thin border in that color, and hovering a row tints it with a lighter shade. The color is the pane's **Pane Color** if you set one, otherwise the agent's assigned color.

Under an expanded agent, child rows are grouped in this order. A group is hidden when it is empty.

### Todos

The agent's current todo list, read from its transcript every few seconds (`agentmux-srv/src/backend/reactive/progress_watcher.rs`). AgentMux picks up `TodoWrite`, `TaskCreate` and `TaskUpdate` tool calls, and other tools whose name contains "Todo".

- The header reads **Todos** with a done/total count, e.g. `1/3`.
- Items keep the agent's own order and are marked ✓ (completed), ▸ (in progress) or ○ (pending).
- At most 24 items are shown, then **+N more**.
- **earlier items may be missing** appears when AgentMux started watching the agent partway through its session.

The last list stays visible after the agent goes idle.

### Agent Tool

One row per subagent the agent launched with its Agent/Task tool. Subagent tracking is **Claude Code only**: AgentMux reads the subagent transcripts Claude Code writes under its config directory (`agentmux-srv/src/backend/subagent_watcher/mod.rs`).

- The label is a short generated name for the subagent, falling back to its slug and ID.
- The status chip is `working`, `idle` or `interrupted`.
- Click a row to expand its activity feed: text output, tool calls (click to see the input), results and errors (click for a preview), and progress. The feed keeps the latest 500 entries.

### Workflow

One row per Workflow tool run (not one per member), showing `{active}/{total} active` or `{total} retired` and an **Active** or **Retired** badge. Expand it for a live feed tagged with each member's short ID.

An Agent Tool row whose subagent finished, and a Workflow row whose members all completed, show **disappearing in Ns** and remove themselves after 60 seconds. Hovering a row pauses the countdown. These rows, and interrupted Agent Tool rows, have a **×** button ("Retire") to dismiss them now. An interrupted row has no countdown and stays until you dismiss it.

### Shell

Background shells the agent started with the `Shell` MCP tool: title, elapsed time and a **Stop** button.

### Cron

Cron jobs the agent created: name, cron expression, when it last fired, fire count and an **Active** or **Paused** badge. Read-only.

### Running

Long-running `Bash` tool calls (`frontend/app/view/swarm/swarm-longrunning.ts`):

- a call that has been running for more than 30 seconds;
- a bare `sleep`, from the start, with a "~Ns left" countdown;
- a command the agent started with `run_in_background`, until the agent is notified that it finished.

Each row shows the command and elapsed time. This group only covers agent panes that are currently open in the same window as the Swarm pane.

### Clear completed

**Clear completed (N)** dismisses every finished or interrupted Agent Tool row and every retired Workflow row. Dismissals are remembered in this machine's local storage, so they survive reopening Swarm. Nothing is deleted from the agent's own history, and a dismissed row comes back if it shows new activity. Todos, Shell, Cron and Running rows are not affected.

## Copy menus

Right-click a row for a menu of values to copy (`frontend/app/view/swarm/swarm-view.tsx`). Entries with no value are left out.

| Row | Menu entries |
|---|---|
| Agent | **Copy agent name**, **Copy block ID** |
| Todo item | **Copy todo text** |
| Agent Tool | **Copy name**, **Copy slug** (when it differs from the name), **Copy agent ID** |
| Workflow | **Copy name**, **Copy workflow ID** |
| Shell | **Copy command**, **Copy title** (when it differs from the command), **Copy shell ID** |
| Cron | **Copy name**, **Copy schedule**, **Copy target agent**, **Copy cron ID** |
| Running | **Copy command** |

## Fleet toolbar

The toolbar acts on the agents whose checkboxes you tick (`frontend/app/view/swarm/swarm-fleet-toolbar.tsx`). There is no separate scope picker: the toolbar only sees agents in the tree, which are the agent panes on this instance.

| Control | What it does |
|---|---|
| **Select all** / **Select none** | Ticks or clears every agent. The toolbar shows **{N} selected**. |
| **Broadcast** | Opens an inline box ("Message to send to {N} agents…") with **Send** and **Cancel**. `Enter` sends, `Esc` cancels. The Stop button is hidden while the box is open. |
| **Stop {N}** | Stops the selected agents, after a confirmation dialog. |
| **Groups ▾** | **Save selection as group…** (while agents are selected); click a saved group to select its agents again, or its **×** to delete it. Groups are stored in AgentMux's database. |
| **Clear** | Clears the selection. |

**Broadcast** sends the same message to each selected agent with no confirmation step. Each agent receives it as a [jekt](/glossary/) from an unnamed sender (`TRUST=self-declared`), because a message you type in the UI is not signed by any agent. An agent that is not live and registered for messages fails with an error in the result panel.

**Stop** opens a dialog titled "Stop N agents?" (or "Stop 1 agent?") listing the selected panes' block IDs, with a **Stop {N}** button. With 5 or more agents selected you can tick **Staged rollout** to stop them in batches (**Batch size**, default 3) and abort if a batch's failure rate exceeds a percentage (default 50). Stopping ends each agent's CLI process; the pane stays open. Because you are the one stopping them, the agents stop right away, without the 15-second override window an agent-initiated stop gets (see below). The selection is cleared afterwards. If an agent belongs to another AgentMux instance on the same machine (for example, a different channel), the stop is forwarded to that instance. Every stop is recorded in the [Warden](/warden/) audit feed.

After either action, the result panel shows a summary such as "Broadcast — 3 succeeded, 1 failed" or "Bulk stop — 3 succeeded, 1 failed" (with "— staged rollout aborted early" if that happened), and one row per agent with its error, if any. Dismiss it with **×**.

### From an agent

Agents can do the same through the App API (`agentmux-mcp/src/tool_schemas.rs`; backend `agentmux-srv/src/server/app_api/fleet.rs`):

- **`FleetList`** lists every agent reachable from the calling agent, with the IDs the other two tools expect.
- **`FleetBroadcast`** sends one message to many targets. Each message is signed and delivered exactly like `SendMessage`, so it reaches agents on this machine by block ID and agents on LAN peers or the cloud relay by name. Large broadcasts go out in chunks of 10, about a second apart.
- **`FleetBulkStop`** stops agent panes by block ID, on this instance or another instance on the same machine. Each target running on this instance first gets its user's 15-second override window, all in parallel, so the call takes at least 15 seconds; a target the user chooses to keep running is reported as kept and failed. The optional staged rollout applies only to the other targets (`agentmux-srv/src/sagas/pending_shutdown.rs`).

See [Agent App API](/internals/agent-app-api/) for the full tool reference.

## Tokens and cost per agent

Swarm shows each agent's context size, not its spend. Per-agent token counts and cost are in the status bar's **Token Usage** popover (`frontend/app/statusbar/TokenBreakdownPopover.tsx`), and in an agent pane, clicking the context reading in the composer strip (e.g. `104k / 200k`) opens a popover with that session's cost, turns, duration and token totals (`frontend/app/view/agent/components/AgentSessionStats.tsx`).

Swarm itself spends a small number of tokens: when you open it, AgentMux asks a small model to name up to 20 unnamed subagent rows.

## What Swarm doesn't do

- **No history or search.** Swarm shows live state only. Subagent activity is held in memory; when an agent pane is reopened, AgentMux reloads that session's subagent activity from Claude Code's transcript files.
- **No other instances or LAN peers.** For those, see the [Warden](/warden/).
- **No subagent tracking for providers other than Claude Code.**

## See also

- [Pane Types](/pane-types/) — every pane type, including the agent pane's dispatch cards
- [Warden](/warden/) — agents across Host, LAN and Internet, the jekt audit feed, and Supervisor auto-continue
- [Interagent Communication](/internals/interagent-comms/) — how jekts are delivered
