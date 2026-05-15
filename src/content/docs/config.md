---
title: "Configuration"
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

AgentMux stores its configuration in a JSON settings file. You can edit it directly or through the Settings UI (`Ctrl+,` / `Cmd+,`).

## Settings File Location

Settings are per-instance, under the unified data layout:

| Mode | Path |
|---|---|
| Installed / Portable | `~/.agentmux/versions/<version>/config/settings.json` |
| Dev (`task dev`) | `~/.agentmux/dev/<branch>/config/settings.json` |

Override the `~/.agentmux/` root with the `AGENTMUX_HOME_OVERRIDE` environment variable (intended for tests). See [Settings Reference](/settings/) and [Multi-instance & dev mode](/multi-instance/) for the full layout.

## Core Settings

### Window

```jsonc
{
  // Enable window transparency (requires compositor support on Linux)
  "window:transparent": false,

  // Window opacity (0.0 - 1.0, only when transparency is enabled)
  "window:opacity": 1.0,

  // Restore last window size and position on launch
  "window:savelastwindow": true
}
```

### Terminal

```jsonc
{
  // Path to the shell binary
  "term:localshellpath": "/bin/bash",

  // Font family for terminal panes
  "term:fontfamily": "JetBrains Mono",

  // Font size in pixels
  "term:fontsize": 12,

  // Terminal color theme
  "term:theme": "default-dark"
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
| `AGENTMUX_HOME_OVERRIDE` | Override the `~/.agentmux/` root (intended for tests) |
| `AGENTMUX_RUNTIME_MODE` | Set by the launcher; consumers read it to know they're running installed/portable/dev |
| `AGENTMUX_DATA_DIR`, `AGENTMUX_CONFIG_DIR`, `AGENTMUX_LOG_DIR`, … | Per-instance paths exported by the launcher; never set these manually |
| `CLAUDE_API_KEY` | API key for Claude agent panes |
| `OPENAI_API_KEY` | API key for Codex agent panes |
| `GEMINI_API_KEY` | API key for Gemini agent panes |

## MCP Server Configuration

MCP servers are configured **per-agent** in a [Memory bundle](/memory/) (cog → settings → Memory inside an agent pane), not in `settings.json`. The agent runtime materializes the bundle's `mcp` field into the agent's `.mcp.json` at launch and the AgentMux MCP server is auto-injected alongside any user-defined entries.

See [Memory bundles](/memory/) for the full bundle schema and an example MCP block.

## See Also

- [Keybindings](/keybindings) — Customize keyboard shortcuts
- [Settings Reference](/settings) — Complete settings list
- [Memory bundles](/memory/) — Per-agent configuration
