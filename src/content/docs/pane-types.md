---
title: "Pane Types"
---

AgentMux organizes your workspace into panes — individual views that can be split, rearranged, and magnified. Each pane has a specific type that determines its behavior.

## Available Pane Types

| Pane | Icon | View ID | Description |
|------|------|---------|-------------|
| **Terminal** | square-terminal | `term` | Full terminal with real PTY via xterm.js |
| **Agent** | sparkles | `agent` | AI agent session with streaming output |
| **Forge** | hammer | `forge` | Agent configuration manager |
| **Swarm** | diagram-project | `swarm` | Multi-agent orchestration and history |
| **Subagent** | diagram-subtask | `subagent` | Monitor a specific sub-agent's activity |
| **Sysinfo** | chart-line | `sysinfo` / `cpuplot` | Live system metrics graphs |
| **Launcher** | — | `launcher` | Quick-launch widget picker |
| **Identity** | — | `identity` | Agent identity management |
| **Help** | circle-question | `help` | Built-in documentation |

## Terminal

The terminal pane provides authentic terminal emulation powered by xterm.js and portable-pty on the backend.

Features:
- Real PTY with full ANSI support
- Configurable font family and size
- Per-pane zoom level
- Shell integration via `wsh` binary
- Remote connections (SSH)

Open a terminal: `Cmd+N` / `Alt+N` or click the terminal icon in the top bar.

### wsh Commands

From any terminal, use the `wsh` helper:

| Command | Description |
|---------|-------------|
| `wsh view [file\|url]` | Preview a file, directory, or URL in a new pane |
| `wsh edit [file]` | Open a file in the code preview pane |

## Agent

The agent pane runs an AI agent session. It displays:

- **Streaming text** — Agent output in real time
- **Tool calls** — Name, arguments, and result of each tool invocation
- **File diffs** — Visual diff overlay when the agent writes files
- **Auto-scroll** — Follows output, with manual scroll override

Agent panes are configured through [The Forge](/the-forge), where you set the provider, working directory, environment, and MCP servers.

Settings that affect agent panes:

| Setting | Default | Description |
|---------|---------|-------------|
| `agent:defaultprovider` | `claude` | Default provider for new agent panes |
| `agent:showtoolcalls` | `true` | Show tool calls in real time |
| `agent:showdiffs` | `true` | Show file diff overlay |
| `agent:autoscroll` | `true` | Auto-scroll agent output |

## Forge

The Forge is the agent configuration manager. It provides three views:

- **List** — All configured agents, grouped by type (host, container, custom)
- **Create/Edit** — Agent configuration form with content tabs (Soul, Instructions, MCP, Env)
- **Detail** — Agent details with content, skills, and session history

See [The Forge](/the-forge) for full documentation.

## Swarm

The Swarm pane provides a bird's-eye view of all agent activity. It has three tabs:

- **Overview** — Active and completed sub-agents across all agent sessions
- **History** — Past session metadata with message counts, models, token usage, and git branches
- **Search** — Full-text search across all agent sessions

Click any sub-agent in the overview to open a dedicated [Subagent](#subagent) pane.

## Subagent

A focused view of a single sub-agent's activity stream. Shows:

- Agent ID and slug
- Status badge (active, completed, loading)
- Event count and last activity time
- Model being used
- Event stream: text output, tool uses, tool results, and progress updates

Subagent panes auto-scroll by default. Scroll up to pause, and a "scroll to bottom" button appears.

## Sysinfo

Live system metrics displayed as time-series line plots. Supports multiple plot types:

| Plot Type | Metrics |
|-----------|---------|
| CPU | Overall CPU usage % |
| Mem | Memory used (GB) |
| CPU + Mem | Both on one view |
| Net | Total network throughput (MB/s) |
| Net (Sent/Recv) | Sent and received separately |
| Disk I/O | Total disk throughput |
| Disk I/O (R/W) | Read and write separately |
| All CPU | Per-core CPU usage (up to 32 cores) |
| CPU + Mem + Net | All three combined |

Data streams via WebSocket events from the backend. Supports remote connections — view system metrics from SSH-connected hosts.

## Pane Management

### Creating Panes

- **Top bar widgets** — Click the icons on the right side of the top bar
- **Right-click header** — Right-click a pane header for the widget menu
- **Keyboard** — `Cmd+N` / `Alt+N` for terminal, `Cmd+Shift+A` / `Alt+Shift+A` for agent panel

### Splitting

| Action | macOS | Windows / Linux |
|--------|-------|-----------------|
| Split Right | `Cmd+D` | `Alt+D` |
| Split Below | `Cmd+Shift+D` | `Alt+Shift+D` |
| Split in Direction | `Ctrl+Shift+S` + Arrow | Same |

### Navigation

| Action | Shortcut |
|--------|----------|
| Navigate between panes | `Ctrl+Shift+Arrow` |
| Focus pane N | `Ctrl+Shift+1-9` |
| Close pane | `Cmd+W` / `Alt+W` |
| Magnify pane | `Cmd+M` / `Alt+M` |

### Drag and Drop

Rearrange panes by dragging their headers. You can:

- Reorder panes within a tab
- Move panes across tabs
- Drag panes between windows (cross-window drag supported on all platforms)
