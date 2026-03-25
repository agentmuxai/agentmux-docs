---
title: "First Agent Setup"
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

This guide walks through connecting your first AI agent to AgentMux. AgentMux supports multiple agent providers — Claude Code, Codex CLI, and Gemini CLI.

## Prerequisites

You need at least one AI agent CLI installed and an API key configured:

| Provider | CLI Install | API Key Env Var |
|----------|------------|-----------------|
| **Claude Code** | `npm install -g @anthropic-ai/claude-code` | `CLAUDE_API_KEY` |
| **Codex CLI** | `npm install -g @openai/codex` | `OPENAI_API_KEY` |
| **Gemini CLI** | `npm install -g @google/gemini-cli` | `GEMINI_API_KEY` |

Set your API key in your shell profile (`~/.bashrc`, `~/.zshrc`, etc.) or configure it in AgentMux's environment settings.

## Create an Agent in The Forge

1. Open The Forge — click the hammer icon in the top bar or press `Cmd+Shift+F` / `Alt+Shift+F`
2. Click **+ New Agent**
3. Fill in the agent configuration:

### Basic Settings

| Field | Description |
|-------|-------------|
| **Name** | A human-readable name (e.g., `backend-claude`) |
| **Agent Type** | `host` (runs on your machine) or `container` (Docker) |
| **Provider** | Claude Code, Codex CLI, or Gemini CLI |
| **Working Directory** | The project directory the agent works in |

### Provider Command

Each provider has a default launch command:

```
Claude Code:  claude --output-format stream-json
Codex CLI:    codex --full-auto
Gemini CLI:   gemini --yolo
```

You can customize these in the agent's settings.

### Content Tabs

The Forge provides four content tabs per agent:

- **Soul** — The agent's system prompt and personality. Defines how the agent behaves and what it prioritizes.
- **Instructions** — Project-specific instructions (equivalent to `CLAUDE.md` or similar). Loaded into the agent's context on launch.
- **MCP** — Model Context Protocol server configuration. Add tools the agent can use (filesystem access, GitHub, databases, etc.).
- **Env** — Environment variables passed to the agent process. Use this for API keys, feature flags, and project-specific config.

## Launch the Agent

From the Forge agent list, click on your agent's card and then click **Launch**. A new agent pane opens in your workspace.

The agent pane shows:

- **Streaming output** — Text as the agent generates it
- **Tool calls** — Each tool invocation with name and arguments
- **File diffs** — Side-by-side diffs when the agent modifies files
- **Status** — Active, idle, or completed

## Agent Types

### Host Agents

Run directly on your machine. The agent CLI process spawns as a child process with access to your local filesystem and tools.

### Container Agents

Run inside Docker containers. AgentMux connects to the container and manages the agent lifecycle. Useful for isolated environments or when agents need specific toolchains.

### Import from Claw

If you use [Claw](https://github.com/a5af/claw) for container agent management, you can import existing agent configurations directly into The Forge. Click **Import from Claw** in the empty state or from the Forge header menu.

## Skills

Each agent can have custom skills — reusable prompt templates, commands, workflows, or MCP tool configurations. Manage skills from the agent's detail view in The Forge under the **Skills** tab.

Skill types:

| Type | Description |
|------|-------------|
| `prompt` | A reusable prompt template |
| `command` | A shell command or script |
| `workflow` | A multi-step sequence |
| `mcp-tool` | An MCP tool configuration |

## Next Steps

- [The Forge](/the-forge) — Full Forge reference
- [Pane Types](/pane-types) — All pane types including agent panes
- [Configuration](/config) — Global and per-agent settings
