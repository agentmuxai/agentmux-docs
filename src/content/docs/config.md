---
title: "Configuration"
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

AgentMux stores its configuration in a JSON settings file. You can edit it directly or through the Settings UI (`Ctrl+,` / `⌘,`).

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
  // Default theme for windows without their own (the hamburger menu sets one window's)
  "window:theme": "default",

  // Make windows see-through by default
  "window:transparent": false,

  // Default opacity for windows without their own, used while window:transparent is on
  // (0.8 when unset)
  "window:opacity": 0.8
}
```

Theme and opacity are set per window from the hamburger menu; these keys are the defaults. See [Window appearance](/window-appearance/).

### Terminal

```jsonc
{
  // The shell new local terminals open with: a full path or a name on PATH.
  // Unset: chosen for the platform (pwsh, else powershell, else cmd on Windows;
  // $SHELL, else /bin/bash on macOS and Linux). Settings ▸ Terminal ▸ Default shell
  // lists the shells installed on this machine.
  "term:localshellpath": "/bin/zsh",

  // Font family for terminal panes (default "Hack")
  "term:fontfamily": "Hack",

  // Font size in pixels (default 15)
  "term:fontsize": 15,

  // Terminal color theme
  "term:theme": "default-dark"
}
```

### Sysinfo

```jsonc
{
  // Seconds between samples in the Sysinfo pane (local only; nothing is sent anywhere)
  "telemetry:interval": 1.0,

  // How many samples the Sysinfo charts keep (30-1024)
  "telemetry:numpoints": 120
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

MCP servers are configured **per-agent**, not in `settings.json` — either baked into a [Bundle](/bundles/)'s `mcp_servers` field, or managed live via the [MCP Server primitive](/connectors/#mcp-servers) (the agent pane's Stash icon → MCP Servers tab, or app-wide in Connectors → MCP servers). The agent runtime materializes the bundle's `mcp_servers` field into the agent's `.mcp.json` at launch and the AgentMux MCP server is auto-injected alongside any user-defined entries.

See [Bundles](/bundles/) for the full bundle schema (including the `mcp_servers` field).

## See Also

- [Keybindings](/keybindings) — Every shortcut, and the `keybindings` setting for your own
- [Settings Reference](/settings) — Complete settings list
- [Bundles](/bundles/) — Per-agent configuration
