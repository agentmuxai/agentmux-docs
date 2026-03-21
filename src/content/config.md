# Configuration

AgentMux stores its configuration in a JSON settings file. You can edit it directly or through the Settings UI (`Ctrl+,` / `Cmd+,`).

## Settings File Location

| Platform | Path |
|----------|------|
| Windows | `%APPDATA%\agentmux\settings.json` |
| macOS | `~/Library/Application Support/agentmux/settings.json` |
| Linux | `~/.config/agentmux/settings.json` |

## Core Settings

### Window

```jsonc
{
  // Enable window transparency (requires compositor support on Linux)
  "window:transparency": false,

  // Window opacity (0.0 - 1.0, only when transparency is enabled)
  "window:opacity": 1.0,

  // Remember window position and size across sessions
  "window:saveposition": true
}
```

### Terminal

```jsonc
{
  // Default shell (auto-detected if not set)
  "term:shell": "",

  // Font family for terminal panes
  "term:fontfamily": "JetBrains Mono, Cascadia Code, monospace",

  // Font size in pixels
  "term:fontsize": 13,

  // Terminal theme
  "term:theme": "dark"
}
```

### Agent Panes

```jsonc
{
  // Default agent provider (claude, codex, gemini)
  "agent:defaultprovider": "claude",

  // Show tool calls in real time
  "agent:showtoolcalls": true,

  // Show file diff overlay for agent file writes
  "agent:showdiffs": true,

  // Auto-scroll agent output
  "agent:autoscroll": true
}
```

### Telemetry

```jsonc
{
  // AgentMux collects zero telemetry by default
  // This setting exists for future opt-in analytics
  "telemetry:enabled": false
}
```

## Environment Variables

AgentMux respects these environment variables:

| Variable | Purpose |
|----------|---------|
| `AGENTMUX_HOME` | Override config directory |
| `AGENTMUX_DEV` | Enable development mode |
| `CLAUDE_API_KEY` | API key for Claude agent panes |
| `OPENAI_API_KEY` | API key for Codex agent panes |
| `GEMINI_API_KEY` | API key for Gemini agent panes |

## MCP Server Configuration

AgentMux supports Model Context Protocol (MCP) servers for extending agent capabilities. Configure them per-agent in The Forge or globally in settings:

```jsonc
{
  "mcp:servers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/dir"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..."
      }
    }
  }
}
```

## See Also

- [Keybindings](/keybindings) — Customize keyboard shortcuts
- [Settings Reference](/settings) — Complete settings list
- [The Forge](/the-forge) — Per-agent configuration
