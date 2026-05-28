---
title: "Quickstart"
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

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

## 3. Create a Memory bundle

Open an agent pane (`Cmd+Shift+A` / `Alt+Shift+A`, or click the **Agent** icon in the top bar), then open the agent pane's settings panel (cog icon in the pane header) and switch to the **Memory** tab. See [Memory bundles](/memory/) for the full configuration surface.

Click **+ New Memory** and fill in:

| Field | Example |
|-------|---------|
| **Name** | `my-claude` |
| **Provider** | Claude Code |
| **Working Directory** | `/home/user/projects/myapp` |

Click **Create**.

## 4. Launch an Agent Session

In the Launch Agent modal, pick your Memory bundle (and optionally an [Identity bundle](/identity/) for credentials). Click **Launch** to open an agent pane.

The first time you pick a provider, AgentMux installs that CLI for you — an inline install modal runs `npm install` and streams the output. No `npm install -g` step beforehand. Once installed, the binary is cached per AgentMux version and reused on every later launch.

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

AgentMux supports multiple agents running simultaneously. Open the Memory pane again and create bundles for different providers:

- **Claude Code** — `claude -p --output-format stream-json --verbose --include-partial-messages --dangerously-skip-permissions`
- **Codex CLI** — `codex exec --json --dangerously-bypass-approvals-and-sandbox -`
- **Gemini CLI** — `gemini --output-format stream-json --yolo -p ""`
- **OpenClaw** — `acpx --agent openclaw`
- **Kimi Code CLI** — `kimi --print --output-format stream-json --yolo -p ""`
- **GitHub Copilot CLI** — `copilot --acp`
- **Pi** — `pi --json`

Each agent runs in its own pane. Use the [Swarm](/subagent-watcher) view to monitor all of them at once.

## Next Steps

- [First Agent Setup](/first-agent) — Detailed agent configuration
- [Pane Types](/pane-types) — All available pane types
- [Keybindings](/keybindings) — Keyboard shortcuts
- [Configuration](/config) — Customize settings
