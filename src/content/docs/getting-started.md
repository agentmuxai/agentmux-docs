---
title: "Getting Started with AgentMux"
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

AgentMux is an agentic workflow environment — a desktop app for running, observing, and coordinating AI agents. Built on Rust with a bundled Chromium 146 via CEF and a SolidJS frontend.

## What is AgentMux?

AgentMux gives you a multiplexed workspace where multiple AI agents run in parallel panes. Seven providers are supported as first-class agent types: Claude Code, Codex CLI, Gemini CLI, OpenClaw, Kimi Code CLI, GitHub Copilot CLI, and Pi. You see every tool call, file write, and network request in real time. Panes communicate with each other through a backend WebSocket pub-sub event system.

## Key Concepts

- **Panes** — Individual workspace units. Each pane has a type (`agent`, `browser`, `terminal`, `editor`, `swarm`, `sysinfo`, `help`, `devtools`).
- **Identity bundles** — Named credential sets (GitHub PAT, AWS profile, Anthropic API key, …) you assign to an agent at launch. Survives renames; swappable without restart.
- **Memory bundles** — Reusable agent personality + capability stacks (provider, model, instructions, MCP, skills) selectable at launch.
- **The Forge** — A tab inside the Agent pane (cog → settings → Forge) where you configure the agent's launch parameters.
- **Interagent Comms** — Panes communicate via a backend pub-sub event system. An agent's output can stream into another pane's input.
- **Subagent monitoring** — The Swarm pane provides a bird's-eye view of all sub-agents spawned by primary agents; clicking one opens a focused Subagent view.
- **Reducer stack** — A 4-layer audited dispatch model (launcher / host / sidecar / frontend slices). Every state mutation is structured and logged.

## Quick Install

### macOS (Apple Silicon)
Download the `.dmg` from [agentmux.ai](https://agentmux.ai) or the [GitHub releases](https://github.com/agentmuxai/agentmux/releases).

### Windows
Download the installer (`.exe`) or portable (`.zip`) from [agentmux.ai](https://agentmux.ai).

### Linux
Download the AppImage from [agentmux.ai](https://agentmux.ai):
```bash
chmod +x AgentMux_amd64.AppImage
./AgentMux_amd64.AppImage
```

## Next Steps

- [Installation](/installation) — Platform-specific install details
- [First Agent Setup](/first-agent) — Connect your first AI agent
- [Configuration](/config) — Customize AgentMux settings
- [Keybindings](/keybindings) — Keyboard shortcuts reference
