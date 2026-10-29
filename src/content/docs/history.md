---
title: History
description: "The History pane: every agent's kept conversation, what was typed to each agent, and where the history is stored and for how long."
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

The **History** pane is the record of what agents did. **Agents** lists every agent's kept conversation and opens it, **Typed** lists what you typed to an agent, and **Storage** shows where the history is kept, how much there is and for how long.

## Where to find it

The History widget (icon: `clock-rotate-left`) is **not pinned** to the widget bar by default. Open it in any of these ways:

- Click **more** at the end of the widget bar and choose **History**. Right-click it there and choose **Pin to bar** to keep it on the bar.
- **Open History** in the command palette (`open:history`).
- Right-click a pane header → **Replace With...** → **History**.

A tab holds one History: choosing it again brings back the one already open instead of opening a second. A segmented control along the top switches between the three views. The History pane was for a while a section of the Warden pane: see [Warden](/warden/).

## Agents

**Agents** lists every agent that has a kept history, including agents whose pane is closed and agents that were deleted (marked **Deleted agent**). Type in **Filter agents** to narrow the list.

| Column | What |
|---|---|
| **Agent** | The agent's name. A conversation forked from another says `fork of` and the other's name |
| **Provider** | The agent's CLI |
| **History** | The size of its kept conversation, archives included |
| **Archived** | How many earlier conversations it has archived (for example with **New conversation**) |
| **Last active** | How long ago the agent last did anything |

**Open history** shows the agent's whole recorded conversation in this pane, read-only. **Show sessions** lists the agent's sessions with their start, last activity, size, where the record is kept and the folder the session ran in.

Nothing here is deleted by AgentMux. The record is kept forever.

## Typed

**Typed** shows what you typed to an agent, newest first, with the time. Choose the agent from the list, and type in **Search what was typed** to find a message. **Clear…** then **Forget everything typed to** the agent removes the lot. Forgotten entries show under **Recently forgotten** and can be restored for a while, then they are gone.

What was typed to an agent is kept with the agent, up to the limit set by `agent:inputhistory:max`, and goes when the agent is deleted.

## Storage

**Storage** shows how much agent history is on this machine and where it is kept: for each place, its size and file count. **Measure again** measures anew.

- **Pane history compression** (setting `agent:transcriptframes`) says how much transcript is stored compressed, and the ratio.
- **Reclaim** appears when the shared history store has a large amount of free space inside it (at least 1 GB, and at least a fifth of the file). Choose **Reclaim at next start** and AgentMux gives that space back to the disk the next time it starts. **Don't reclaim** cancels it.

**Retention** on that view says what is kept: agent history is kept forever and AgentMux deletes none of it on its own. Claude Code keeps its own session files, and AgentMux sets that cleanup to 36,500 days unless your Claude config already sets another value. Conversations archived by **New conversation** and inactive panes' archived transcripts are never pruned. The record of messages between agents is written to disk and kept (see [Audit](/audit/)).

## See also

- [Audit](/audit/): the record of messages between agents and what agents did with your secrets
- [Swarm](/subagent-watcher/): what agents are doing now
- [Warden](/warden/): where this pane used to be a section
