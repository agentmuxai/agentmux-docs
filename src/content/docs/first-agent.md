---
title: "First Agent Setup"
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

This guide walks through connecting your first AI agent to AgentMux. AgentMux supports seven providers as first-class agent types — `claude`, `codex`, `gemini`, `openclaw`, `kimi`, `copilot`, and `pi`. The full list lives in `frontend/app/view/agent/providers/index.ts:PROVIDERS` in the main repo.

## Prerequisites

You need at least one AI agent CLI installed. Each provider has its own login flow:

| Provider | CLI Install | Auth | Login Command |
|----------|------------|------|---------------|
| **Claude Code** | `npm install -g @anthropic-ai/claude-code` (or `irm https://claude.ai/install.ps1 \| iex` on Windows / `curl -fsSL https://claude.ai/install.sh \| bash` on macOS / Linux) | OAuth | `claude auth login` |
| **Codex CLI** | `npm install -g @openai/codex` | OAuth | `codex login` |
| **Gemini CLI** | `npm install -g @google/gemini-cli` | OAuth | `gemini auth login` |
| **OpenClaw** | `npm install -g @openclaw/acpx` | API key | `openclaw onboard` |
| **Kimi Code CLI** | `pip install kimi-cli` | API key | `kimi login` |
| **GitHub Copilot CLI** | `npm install -g @github/copilot` | OAuth | `copilot auth login` |
| **Pi** | `npm install -g @mariozechner/pi-coding-agent` | API key | `pi config` |

After completing the provider's login flow, AgentMux can launch agents using that provider. AgentMux isolates each provider's auth config to a per-instance subdirectory using the provider's own `*_HOME` / `*_CONFIG_DIR` environment variable (see [Auth flows](/auth/) for the full list and isolation pattern).

## Configure an Agent via Memory bundles

1. Open an agent pane: `Cmd+Shift+A` / `Alt+Shift+A`, or click the agent icon in the top bar.
2. Open the agent pane's settings panel (cog icon in the pane header) and switch to the **Memory** tab.
3. Click **+ New Memory** to create a new bundle (or pick an existing one to edit).
4. Fill in the bundle configuration:

### Basic Settings

| Field | Description |
|-------|-------------|
| **Name** | A human-readable name (e.g., `backend-claude`) |
| **Provider** | Claude Code, Codex CLI, Gemini CLI, OpenClaw, Kimi Code CLI, GitHub Copilot CLI, or Pi |
| **Model** | Model identifier passed to the provider (e.g., `claude-sonnet-4-6`) |
| **Working Directory** | The project directory the agent works in |

### Provider Command

Each provider ships with default launch arguments tuned for non-interactive multi-turn use. The full set lives in `PROVIDERS[id].launchArgs`:

```
Claude Code:        claude -p --output-format stream-json --verbose --include-partial-messages --dangerously-skip-permissions
Codex CLI:          codex exec --json --dangerously-bypass-approvals-and-sandbox -
Gemini CLI:         gemini --output-format stream-json --yolo -p ""
OpenClaw:           acpx --agent openclaw
Kimi Code CLI:      kimi --print --output-format stream-json --yolo -p ""
GitHub Copilot CLI: copilot --acp
Pi:                 pi --json
```

Three providers (OpenClaw, Copilot, Pi) use the Agent Client Protocol (ACP) over stdio; the others use streaming-JSON modes specific to each CLI. AgentMux's controller layer abstracts the difference. You can override `launchArgs` per Memory bundle.

### Bundle Content

A Memory bundle holds four kinds of content per agent:

- **Soul** — The agent's system prompt and personality. Defines how the agent behaves and what it prioritizes.
- **Instructions** — Project-specific instructions (equivalent to `CLAUDE.md` or similar). Loaded into the agent's context on launch.
- **MCP** — Model Context Protocol server configuration. Add tools the agent can use (filesystem access, GitHub, databases, etc.).
- **Env** — Environment variables passed to the agent process. Use this for API keys, feature flags, and project-specific config.

## Launch the Agent

Open the Launch Agent modal (the same one you reach from the Agent picker), pick your Memory bundle, optionally pick an [Identity bundle](/identity/) for credentials, and click **Launch**. A new agent pane opens in your workspace.

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

If you use [Claw](https://github.com/a5af/claw) for container agent management, you can import existing agent configurations directly into Memory bundles. Click **Import from Claw** in the empty state or from the Memory pane's header menu.

## Skills

Each agent can have custom skills — reusable prompt templates, commands, workflows, or MCP tool configurations. Manage skills from the Memory bundle's detail view under the **Skills** tab.

Skill types:

| Type | Description |
|------|-------------|
| `prompt` | A reusable prompt template |
| `command` | A shell command or script |
| `workflow` | A multi-step sequence |
| `mcp-tool` | An MCP tool configuration |

## Next Steps

- [Memory bundles](/memory/) — full bundle reference (provider, model, instructions, MCP, skills)
- [Pane Types](/pane-types) — All pane types including agent panes
- [Configuration](/config) — Global and per-agent settings
