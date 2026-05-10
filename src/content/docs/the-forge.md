---
title: "The Forge"
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

The Forge is AgentMux's agent configuration manager. It's where you create, configure, and manage your AI agents.

## Opening The Forge

The Forge isn't a standalone pane — it's a tab **inside the agent pane**. To open it:

1. Open an agent pane (`Cmd+Shift+A` / `Alt+Shift+A`, or click the agent icon in the top bar).
2. Open the agent pane's settings panel (cog icon in the pane header, or right-click the header → Settings).
3. Switch to the **Forge** tab.

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

The Forge pre-configures launch arguments for each of the seven supported providers. Defaults come from `frontend/app/view/agent/providers/index.ts:PROVIDERS[id].launchArgs`:

| Provider | Default Launch Args | Auth | Controller |
|----------|--------------------|------|------------|
| **Claude Code** | `-p --output-format stream-json --verbose --include-partial-messages --dangerously-skip-permissions` | OAuth | subprocess |
| **Codex CLI** | `exec --json --dangerously-bypass-approvals-and-sandbox -` | OAuth | subprocess |
| **Gemini CLI** | `--output-format stream-json --yolo -p ""` | OAuth | subprocess |
| **OpenClaw** | `--agent openclaw` (via `acpx`) | API key | ACP |
| **Kimi Code CLI** | `--print --output-format stream-json --yolo -p ""` | API key | subprocess |
| **GitHub Copilot CLI** | `--acp` | OAuth | ACP |
| **Pi** | `--json` | API key | ACP |

You can override `launchArgs` per agent in the edit form. Three providers run under the Agent Client Protocol (ACP) over stdio; the others use provider-specific streaming-JSON modes. AgentMux's controller layer handles either model.

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
