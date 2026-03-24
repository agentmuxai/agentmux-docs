---
title: "Quickstart"
---

Get AgentMux running with your first agent in under 5 minutes.

## 1. Install AgentMux

Download from [agentmux.ai](https://agentmux.ai) for your platform:

- **macOS** — `.dmg` installer (Apple Silicon)
- **Windows** — `.exe` installer or portable `.zip`
- **Linux** — AppImage

See [Installation](/installation) for detailed steps.

## 2. Launch and Orient

When AgentMux opens, you'll see a default terminal pane. The key areas are:

- **Top bar** — Tab management and widget launcher (right side icons)
- **Workspace** — Your pane grid, drag to rearrange
- **Status bar** — Connection status and system info

## 3. Open The Forge

Click the hammer icon in the top bar (or press `Cmd+Shift+F` / `Alt+Shift+F`) to open [The Forge](/the-forge) — the agent configuration manager.

Click **+ New Agent** and fill in:

| Field | Example |
|-------|---------|
| **Name** | `my-claude` |
| **Provider** | Claude Code |
| **Working Directory** | `/home/user/projects/myapp` |

Click **Create**.

## 4. Launch an Agent Session

Back in the Forge, click your new agent's card. Then click **Launch** to open an agent pane.

The agent starts in a new pane within your workspace. You'll see:

- Real-time streaming output
- Tool calls as they execute
- File diffs when the agent writes files

## 5. Split Panes

Run a terminal alongside your agent:

1. Press `Cmd+D` (`Alt+D`) to split right
2. The new pane opens as a terminal
3. Navigate between panes with `Ctrl+Shift+Arrow`

## 6. Monitor System Resources

Click the chart icon in the top bar to add a **Sysinfo** pane. It shows live CPU, memory, network, and disk I/O graphs.

## 7. Add More Agents

AgentMux supports multiple agents running simultaneously. Open The Forge again and create agents for different providers:

- **Claude Code** — `claude --output-format stream-json`
- **Codex CLI** — `codex --full-auto`
- **Gemini CLI** — `gemini --yolo`

Each agent runs in its own pane. Use the [Swarm](/subagent-watcher) view to monitor all of them at once.

## Next Steps

- [First Agent Setup](/first-agent) — Detailed agent configuration
- [Pane Types](/pane-types) — All available pane types
- [Keybindings](/keybindings) — Keyboard shortcuts
- [Configuration](/config) — Customize settings
