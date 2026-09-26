---
title: "Getting Started with AgentMux"
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

AgentMux is an **agent operating environment**: a desktop app where AI agents are first-class residents, in structured panes with their own identity and memory, and with the ability to operate the workspace itself. It's built in Rust, with a bundled Chromium runtime (CEF) and a SolidJS frontend.

## What is AgentMux?

In AgentMux, an agent is not a terminal wrapper. Each one runs in a structured pane with its own identity, optional memory bundle, streaming parser and lifecycle. AgentMux supports ten harnesses (the CLI tools that run agents): Claude Code, Codex CLI, Mux Code, Gemini CLI, Qwen Code, Kimi Code CLI, OpenClaw, Pi, GitHub Copilot CLI and Antigravity (AGY). The agent picker has a template for eight of them; Mux Code and Qwen Code don't have one yet. You see each tool call and file edit as it happens.

Agents can also operate the environment itself through AgentMux's own tools: opening panes, renaming tabs, messaging other agents and moving around the workspace.

## Key Concepts

- **Panes**: the units of the workspace. The widget bar opens them: Agent, Swarm, Armory, Sysinfo, and under **more**, Drone, Warden, Terminal, Editor, Browser, Help, Messengers, Media, Toolchain and Settings. See [Pane Types](/pane-types/).
- **Self-contained CLIs**: AgentMux installs each npm-based agent CLI itself, into a folder per AgentMux version, the first time you pick it. You don't run `npm install -g` first, but you do need Node.js and npm, which AgentMux can install for you. Kimi Code CLI is the exception: install it with `pip install kimi-cli`.
- **Accounts**: provider logins and API keys, managed in **≡ → Armory → Accounts**. You link one to an agent through the **Identity** field when you create it, or later with **Bind**. Claude Code, Codex CLI, Gemini CLI, OpenClaw and GitHub Copilot CLI agents need a bound account; the other providers can run on AgentMux's shared login folder for the provider instead. See [Auth flows](/auth/).
- **Bundles**: reusable sets of instructions, MCP servers and skills, tied to one provider. Manage them in the [Armory](/armory/)'s **Bundles** tab and attach one through the **Memory** field.
- **Harness vs. model vendor**: the *harness* is the CLI driving a session (Claude Code, Codex CLI, Antigravity, …); the *model vendor* is the LLM backend serving its responses. A harness talks to its default vendor unless you redirect it; today only Claude Code can be pointed at a custom endpoint. See [First Agent Setup](/first-agent/#create-an-agent).
- **Interagent Comms**: agents message each other over the MuxBus (host, LAN and WAN tiers). They use `DiscoverAgents` to find peers and `SendMessage` to send them messages. See [Interagent Comms](/internals/interagent-comms/).
- **Agent App API**: AgentMux's MCP server and local API let agents control the workspace: open panes and tabs, rename tabs and windows, switch tabs, and find and message other agents. This is what makes AgentMux an *operating* environment. See [Agent App API](/internals/agent-app-api/).
- **Swarm**: a live tree of your agent panes, with their subagents, todos and running tools.
- **Toolchain**: **≡ → Toolchain** shows your `PATH` and the version, path and status of Node.js, npm, Git, Python and every agent CLI, with install links and a one-click install for Git, Node.js, npm and Python.
- **Reducer stack**: how state moves between AgentMux's processes. See [The reducer stack](/internals/reducer-stack/).

## Quick Install

- **Windows (x64):** install from the [Microsoft Store](https://apps.microsoft.com/detail/9p9qcxnncrk3), or download the installer (`.exe`) or portable build (`.zip`) from [GitHub Releases](https://github.com/agentmuxai/agentmux/releases).
- **macOS (Apple Silicon):** download the `.dmg` from [GitHub Releases](https://github.com/agentmuxai/agentmux/releases).
- **Linux (x86_64):** download the AppImage, `.deb`, `.rpm` or `.tar.gz` from [GitHub Releases](https://github.com/agentmuxai/agentmux/releases). For the AppImage:

  ```bash
  chmod +x AgentMux_*_amd64.AppImage
  ./AgentMux_*_amd64.AppImage
  ```

## Next Steps

- [Installation](/installation/): platform-specific install details
- [Quickstart](/quickstart/): your first agent in a few minutes
- [First Agent Setup](/first-agent/): connect your first AI agent
- [Configuration](/config/): customize AgentMux settings
- [Keybindings](/keybindings/): keyboard shortcuts reference
