---
title: "Subagent Watcher"
---

The Subagent Watcher provides real-time monitoring of sub-agents spawned by your primary AI agents. AgentMux offers two complementary views: the **Swarm** pane for overview and the **Subagent** pane for focused inspection.

## Swarm Pane

The Swarm pane is the bird's-eye view of all agent activity. Open it from the top bar (bee icon) or right-click a pane header and select **Swarm**.

### Overview Tab

Shows all sub-agents across your workspace, split into:

- **Active Subagents** — Currently running, with event count and last activity time
- **Completed Subagents** — Finished sessions

Each entry shows:

| Field | Description |
|-------|-------------|
| Agent ID | Unique identifier (truncated) |
| Slug | Human-readable name |
| Parent Agent | Which agent spawned this sub-agent |
| Status | `active` or `completed` |
| Event Count | Number of events recorded |
| Model | AI model being used |

Click any sub-agent to open a dedicated Subagent pane for that agent.

### History Tab

Browse past agent sessions with metadata:

| Field | Description |
|-------|-------------|
| Session ID | Unique session identifier |
| Provider / Model | AI provider and model used |
| Slug | Session name |
| Working Directory | Project path |
| Git Branch | Branch at time of session |
| Message Count | Total messages exchanged |
| Token Usage | Total tokens consumed |
| Created / Modified | Session timestamps |

### Search Tab

Full-text search across all agent sessions. Results include:

- Agent ID and session
- Timestamp and event type
- Content preview
- Relevance score

## Subagent Pane

A focused view of a single sub-agent's activity stream. Open one by clicking a sub-agent in the Swarm overview, or programmatically.

### Header

The header displays:

- Sub-agent slug and ID
- Status badge (`active`, `completed`, `loading`)
- Event count
- Last activity timestamp
- Model name

### Event Stream

Events are displayed in chronological order:

| Event Type | Display |
|------------|---------|
| **Text** | Agent text output |
| **Tool Use** | Tool name and input summary |
| **Tool Result** | Success/error indicator with result preview |
| **Progress** | Progress output from long-running operations |

### Auto-Scroll

The Subagent pane auto-scrolls to follow new events. Scrolling up pauses auto-scroll and shows a "scroll to bottom" button. Scrolling to the bottom re-enables auto-scroll.

## How It Works

1. When an agent session starts, the backend begins tracking its JSONL output stream
2. Sub-agents spawned by the parent agent are detected from the stream
3. The backend emits `subagent` events via the pub-sub system
4. The Swarm pane subscribes to all subagent events for the overview
5. Individual Subagent panes subscribe to events for a specific agent ID

Data is persisted in JSONL files on disk, allowing history browsing even after sessions complete.

## See Also

- [Pane Types](/pane-types) — Swarm and Subagent pane details
- [Interpane Communication](/interpane-comms) — Event system architecture
- [The Forge](/the-forge) — Agent configuration
