---
title: "Configuration"
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

AgentMux stores its configuration in a JSON settings file. You can edit it directly or through the Settings UI (`Ctrl+,` / `Cmd+,`).

## Settings File Location

Settings live under the channel's data dir, so every version that binds to the same channel reads and writes the same `settings.json`:

| Mode | Path |
|---|---|
| Installed / Portable | `~/.agentmux/channels/<channel>/config/settings.json` (default channel: `stable`) |
| Dev (`task dev`) | `~/.agentmux/dev/<branch>/<clone-id>/config/settings.json` |

The `<channel>` segment is `stable` by default for Installed and downloaded Portable builds, `local-<branch>` for locally-packaged builds, or whatever `AGENTMUX_CHANNEL=<name>` overrides to. Dev mode keys on the git branch plus a per-clone hash so two checkouts of the same branch don't collide. Override the `~/.agentmux/` root with `AGENTMUX_HOME_OVERRIDE` for tests. See [Settings Reference](/settings/) and [Multi-instance & dev mode](/multi-instance/) for the full layout.

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
  // Controls the local Sysinfo pane's CPU/memory/disk/network sampler only —
  // not analytics or crash-reporting. Nothing is ever sent off-device either way.
  // Off by default.
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

MCP servers are configured **per-agent**, not in `settings.json` — either baked into a [Bundle](/memory/)'s `mcp_servers` field, or managed live via the [MCP Server primitive](/armory/#mcp-servers) (Agent setup icon → MCP Servers tab, or app-wide in the Armory). The agent runtime materializes the bundle's `mcp_servers` field into the agent's `.mcp.json` at launch and the AgentMux MCP server is auto-injected alongside any user-defined entries.

See [Memory bundles](/memory/) for the full bundle schema (including the `mcp_servers` field).

## See Also

- [Keybindings](/keybindings) — Customize keyboard shortcuts
- [Settings Reference](/settings) — Complete settings list
- [Memory bundles](/memory/) — Per-agent configuration
