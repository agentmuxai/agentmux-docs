---
title: "Getting Started with AgentMux"
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

AgentMux is an **agent operating environment** — a desktop app where AI agents are first-class residents: structured panes with real identity, real memory, and the ability to operate the workspace itself. Built on Rust with a bundled Chromium 148 via CEF and a SolidJS frontend.

## What is AgentMux?

In AgentMux, every agent is a first-class resident — not a terminal wrapper, but a structured pane with its own identity bundle, memory bundle, streaming parser, and lifecycle. Seven providers run as first-class agent types: Claude Code, Codex CLI, Gemini CLI, OpenClaw, Kimi Code CLI, GitHub Copilot CLI, and Pi. You see every tool call, file write, and network request in real time. And uniquely: agents can operate the environment itself via the Agent App API — opening panes, renaming tabs, messaging peer agents, navigating the workspace.

## Key Concepts

- **Panes** — Individual workspace units. Each pane has a type (`agent`, `browser`, `terminal`, `editor`, `swarm`, `drone`, `sysinfo`, `help`).
- **Self-contained** — AgentMux bundles its own Chromium runtime and installs the agent CLIs for you on first use (in-pane install modal, per-version cache). No `npm install -g` step before launch.
- **Identity bundles** — Named credential sets (GitHub PAT, AWS profile, Anthropic API key, …) you assign to an agent at launch. Survives renames; swappable without restart.
- **Memory bundles** — Reusable agent personality + capability stacks (provider, model, instructions, MCP, skills). Manage via the Memory tab inside an Agent pane's settings panel. Replaces the older "Forge" concept.
- **Interagent Comms** — Agents communicate via the MuxBus (Host / LAN / WAN tiers). Use `DiscoverAgents` to find peers and `SendMessage` to send typed messages. An agent's output can also stream into another pane's input.
- **Agent App API** — Agents inside any pane can control the workspace via a typed MCP + REST API: open new panes, rename tabs and windows, navigate between tabs, discover and message peer agents. This is what makes AgentMux an _operating_ environment, not just a workspace. See [Agent App API](/internals/agent-app-api/).
- **Subagent monitoring** — The Swarm pane provides a bird's-eye view of all sub-agents spawned by primary agents; clicking one opens a focused Subagent view.
- **Toolchain Manager** — Hamburger menu (≡) → Toolchain Manager shows the effective PATH and the detected version, path, and status of every provider CLI and system dependency, with install links for anything missing.
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
