---
title: Kanban
description: "Warden's Kanban section: one card per task in the shared task queue, filed and updated by agents, moved by AgentMux, and finished by you."
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

The **Kanban** shows what work there is and where it stands. Each card is one **task** in the shared task queue that agents use through their `Tasks` tool. Agents file tasks, take them, report progress, ask you questions and hand them in. AgentMux moves a card on what it already knows: an agent waiting on a question, failing or closing. You start tasks on agents, answer, accept or send work back.

The Kanban is the first section of the [Warden](/warden/) pane (`frontend/app/view/warden-kanban/warden-kanban-manager.tsx`). [Swarm](/subagent-watcher/) shows what each agent is doing right now; the Kanban shows the work.

## Where to find it

- **Kanban** in the widget bar's **more** menu (right-click it there and choose **Pin to bar** to keep it on the bar). It is Warden opened on its Kanban section (`defwidget@kanban` in `crates/srv/src/config/widgets.json`, with `"section": "kanban"`).
- **Open Kanban** in the command palette (`open:kanban`).
- Warden's **Kanban** tab.
- On a [Swarm](/subagent-watcher/) row, the chip of the task an agent is on opens the Kanban with that task shown.

The button and the command switch the Warden already in the tab to its Kanban section, or open a Warden if the tab has none.

While the Kanban is shown, the pane's title counts the tasks that need you: **Kanban · 2 need you**. The section loads tasks only while it is shown; a Warden on another section doesn't fetch or follow them.

## Columns

| Column | What is in it |
|---|---|
| **Backlog** | Tasks waiting to be started, grouped by the agent each is for, then **Anyone**. Within a group, in the order the agent will take them. A task on hold is marked **on hold**; one that starts after another unfinished task shows **after #12** |
| **In progress** | Tasks an agent holds and is working on or idle with. Agents working without a task show here too, as dashed **untracked** cards |
| **Needs you** | Tasks you have to act on. The card's first line says why: `asks: …` (the agent asked you a question), `question waiting in its pane`, `agent errored`, `agent stopped`, `agent closed`, or `failed after 3 attempts` |
| **Review** | Tasks handed in and waiting for you. The header shows how many and how long the oldest has waited |
| **Done** | Tasks finished or cancelled in the last 7 days, newest first |

A card shows its number (`#12`), title, the agent on it with a live status dot, checklist progress (`3/7`), its pull request once linked, how many times it has been taken when more than once, its repository, who asked for it ("from you, via Agent1") and how long since it last moved.

## What agents do

Agents use the `Tasks` MCP tool. Its actions:

| Action | What it does |
|---|---|
| `enqueue` | Files a task: a title and a standalone prompt. With `for: "me"` it waits in the agent's own backlog |
| `claim` | Takes the next task the agent can: its own backlog first, then anyone's. It holds a lease while the agent is alive. With `id`, it takes that task and no other, even one on hold |
| `update` | A progress note, a checklist, or links (a PR, a branch) |
| `ask` | A question only you can answer. The task moves to Needs you; your answer reaches the agent as a message |
| `submit` | Hands it in with a result. A task you asked for waits in Review; others are done |
| `complete` | The same as `submit`, for a task that needs no review |
| `release` | Hands it back with a reason; it uses one of the task's attempts |
| `hold`, `unhold` | Puts a waiting task on hold, so no one takes it, or takes it off hold, with an optional reason. Any agent can do either, on any waiting task, including one you put on hold; the task's history names who did it. An agent working on a task can put it back on hold to wait on something outside its control, without using up an attempt |
| `heartbeat`, `list` | Extend the lease (not needed while the agent's session is alive); read the queue |

### Requests filed for later

When you ask an agent for something while it is busy with other work, and it isn't urgent or a minute's work, the agent files it in its own backlog, tells you the number ("Filed as #12"), and finishes what it was doing. Finishing a task answers with the next one waiting for it, so the agent goes on through its backlog until it is empty.

With reminders on, an agent that goes idle for 2 minutes with tasks waiting for it gets one note from AgentMux naming them, once per idle period. A task the agent released in the last hour isn't named. Reminders are off unless you turn them on: **Remind idle agents of their backlog**, in the Kanban's toolbar or in Settings › Advanced. AgentMux records who asked: a task filed during a turn you started shows "you, via" the agent, with your words on the card. The agent can't set this.

## What you do

Click a card to open its drawer: the prompt, what you asked, the checklist, the result, what it starts after, and the **History** of every move, with who made it and when. Its buttons depend on the column:

- **Backlog:** pick an agent and **Start** (the prompt goes to that agent as your message; one written by an agent is quoted with its author named), **Hold** or **Release hold**, **Give to anyone**.
- **Needs you:** type **Your answer** and **Answer**.
- **Review:** **Accept**, or **Send back** with what to fix. Only you can accept: an agent can hand work in but can't accept its own.
- **Failed:** **Try again**.
- **Open** the agent that holds it (the button names it), and **Cancel task** from any column but Done.

You can also drag a Backlog card onto another agent's backlog group to give it to that agent, or onto an agent's chip in the strip above the board to start it there.

The toolbar above the board has a search box (title, `#number`, agent or repository), a repository filter when there is more than one, **Lanes** (one row of columns per repository, those with unfinished work first), **Untracked** (show or hide agents working without a task), **New task** and **Refresh**. **New task** takes a title, an optional prompt, the tasks it starts after (`#12`), who it is for, and **On hold**.

An untracked card has **Track**, which turns the agent's current work into a task it holds.

## Pull requests

When an agent opens a pull request while it holds exactly one task, AgentMux records the branch on that task and links the PR once GitHub lists it. A task in Review whose PR merges is accepted, with "PR #12 merged" in its history. AgentMux reads GitHub without a sign-in for this, so it works for public repositories; tasks of other repositories wait for your **Accept**.

## Settings

These are `settings.json` keys. `kanban:reminders` also has a switch in the Kanban's toolbar and in Settings › Advanced; the others have no control yet.

| Key | Default | What it does |
|---|---|---|
| `kanban:reminders` | off | `true` turns on the idle reminder for every agent |
| `kanban:closeonmerge` | on | `false` stops accepting a reviewed task when its PR merges |
| `kanban:reviewlimit` | none | A whole number: past it, the Review header turns amber. Nothing is blocked |

An agent pane whose block meta has `kanban:continue: false` gets no reminder, and finishing a task doesn't name its next one.

## Where tasks are kept

In the task queue in `shared/identity-store.db`, shared by every AgentMux on this computer. The Kanban shows every task in it, with this AgentMux's own agents in the strip. Tasks survive restarts and pane closes; closing an agent releases the tasks it held.

A sandboxed [widget](/widgets/) with the `tasks:read` permission can list the Kanban's tasks with `am.tasks.list()`: each task's number, title, state, agent, repository, PR and checklist progress, never its prompt, your words or its result. See the [widget API](/widget-api/#tasks).

## See also

- [Warden](/warden/): the pane the Kanban is a section of
- [Swarm](/subagent-watcher/): what each agent is doing right now
- [Widgets from widgets.json: sections](/widgets/#sections): how the Kanban button opens a section, and how to pin any section yourself
