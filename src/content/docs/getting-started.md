---
title: "Getting Started with AgentMux"
---

AgentMux is an agentic workflow environment — a desktop app for running, observing, and coordinating AI agents. Built on Rust (Tauri v2) with a TypeScript frontend.

## What is AgentMux?

AgentMux gives you a multiplexed workspace where multiple AI agents (Claude, Codex, Gemini) run in parallel panes. You see every tool call, file write, and network request in real time. Agents can communicate with each other through interpane reactive messaging.

## Key Concepts

- **Panes** — Individual workspace units. Each pane can be a terminal, agent session, code preview, or system monitor.
- **The Forge** — A persistent agent configuration manager. Define working directory, identity, MCP config, and environment per agent.
- **Interpane Comms** — Panes talk to each other via reactive channels. An agent's output can stream into another pane's input.
- **Subagent Watcher** — Monitor sub-agents spawned by your primary agents in a dedicated view.

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
