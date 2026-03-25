---
title: "The Forge"
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

The Forge is AgentMux's agent configuration manager. It's where you create, configure, and manage your AI agents.

## Opening The Forge

- Click the **hammer** icon in the top bar
- Or press `Cmd+Shift+F` / `Alt+Shift+F`
- Or right-click any pane header and select **Forge** from the widget menu

## Views

The Forge has three main views:

### Agent List

The default view shows all configured agents, grouped into sections:

- **Host Agents** — Run directly on your machine
- **Container Agents** — Run in Docker containers
- **Custom Agents** — User-defined configurations

Each agent card shows the agent name, type, and status. Click a card to open the detail view, or click **+ New Agent** to create one.

### Create / Edit Form

The agent form has the following fields:

| Field | Description |
|-------|-------------|
| **Name** | Human-readable agent name |
| **Agent Type** | `host` or `container` |
| **Provider** | Claude Code, Codex CLI, or Gemini CLI |
| **Command** | Launch command (auto-filled from provider) |
| **Working Directory** | Project directory the agent operates in |
| **Connection** | Remote connection (SSH host) or local |

### Detail View

The detail view for a specific agent has three sections:

#### Content

Four tabs for configuring the agent's context:

| Tab | Purpose |
|-----|---------|
| **Soul** | System prompt — defines the agent's personality, priorities, and behavior |
| **Instructions** | Project-specific instructions loaded into context on launch (like `CLAUDE.md`) |
| **MCP** | Model Context Protocol server configuration (JSON) |
| **Env** | Environment variables passed to the agent process |

Content is persisted per-agent and saved to the backend automatically.

#### Skills

Reusable capabilities attached to an agent:

| Skill Type | Description |
|------------|-------------|
| `prompt` | A reusable prompt template |
| `command` | A shell command or script |
| `workflow` | A multi-step automation sequence |
| `mcp-tool` | An MCP tool configuration |

Create, edit, and delete skills from this tab. Skills are stored per-agent.

#### History

Session history for the agent. Shows past sessions with:

- Session ID and timestamp
- Model used
- Message count and token usage
- Working directory and git branch
- First user message (preview)

## Provider Configuration

The Forge pre-configures launch commands for each provider:

| Provider | Default Command |
|----------|----------------|
| **Claude Code** | `claude --output-format stream-json` |
| **Codex CLI** | `codex --full-auto` |
| **Gemini CLI** | `gemini --yolo` |

You can customize these commands in the agent edit form.

## MCP Server Configuration

Configure MCP servers per-agent in the **MCP** content tab using JSON:

```json
{
  "filesystem": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
  },
  "github": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "env": {
      "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..."
    }
  }
}
```

MCP servers configured here override the global MCP settings for this specific agent.

## Import from Claw

If you manage container agents with [Claw](https://github.com/a5af/claw), click **Import from Claw** to pull existing agent configurations into The Forge. This imports:

- Agent name and identity
- Working directory
- Environment variables
- MCP server configuration

## See Also

- [First Agent Setup](/first-agent) — Step-by-step guide
- [Configuration](/config) — Global MCP and agent settings
- [Pane Types](/pane-types) — Agent pane behavior
