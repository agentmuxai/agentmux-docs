---
title: "Settings Reference"
---

Complete reference for all AgentMux settings. Settings are stored in `settings.json` and can be edited via the Settings UI (`Cmd+,` / `Alt+,`) or directly in the file.

## Settings File Location

| Platform | Path |
|----------|------|
| Windows | `%APPDATA%\agentmux\settings.json` |
| macOS | `~/Library/Application Support/agentmux/settings.json` |
| Linux | `~/.config/agentmux/settings.json` |

Override with the `AGENTMUX_HOME` environment variable.

## Terminal Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `term:fontsize` | number | `12` | Font size in pixels |
| `term:fontfamily` | string | `"JetBrains Mono"` | Font family |
| `term:theme` | string | `"default-dark"` | Terminal color theme |
| `term:scrollback` | number | `1000` | Scrollback buffer lines |
| `term:copyonselect` | boolean | `true` | Auto-copy text on selection |
| `term:transparency` | number | `0.5` | Pane transparency (0.0–1.0) |
| `term:localshellpath` | string | `"/bin/bash"` | Default shell executable |
| `term:localshellopts` | array | `[]` | Shell launch arguments |
| `term:disablewebgl` | boolean | `false` | Disable WebGL renderer (falls back to Canvas) |
| `term:allowbracketedpaste` | boolean | `true` | Enable bracketed paste mode |
| `term:shiftenternewline` | boolean | `false` | Shift+Enter creates newline |

## AI Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `ai:preset` | string | `""` | Named AI preset ID |
| `ai:apitype` | string | `"anthropic"` | API provider type |
| `ai:baseurl` | string | `""` | Custom API endpoint URL |
| `ai:apitoken` | string | `""` | Authentication token |
| `ai:model` | string | `"claude-sonnet-4-6"` | Model identifier |
| `ai:maxtokens` | number | `4096` | Max completion tokens |
| `ai:timeoutms` | number | `60000` | Request timeout in milliseconds |
| `ai:fontsize` | number | `14` | AI pane font size |
| `ai:fixedfontsize` | number | `14` | Code block font size in AI pane |

## Editor Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `editor:fontsize` | number | `14` | Editor font size |
| `editor:minimapenabled` | boolean | `false` | Show minimap |
| `editor:stickyscrollenabled` | boolean | `false` | Enable sticky scroll |
| `editor:wordwrap` | boolean | `true` | Word wrap |

## Window Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `window:transparent` | boolean | `false` | Enable window transparency |
| `window:blur` | boolean | `false` | Blur background (macOS only) |
| `window:opacity` | number | `1.0` | Window opacity (0.0–1.0) |
| `window:bgcolor` | string | `""` | Custom background color |
| `window:zoom` | number | `1.0` | Global zoom factor |
| `window:tilegapsize` | number | `3` | Gap between panes in pixels |
| `window:showmenubar` | boolean | `false` | Show native menu bar |
| `window:nativetitlebar` | boolean | `false` | Use native title bar |
| `window:confirmclose` | boolean | `false` | Confirm before closing window |
| `window:savelastwindow` | boolean | `true` | Restore last window size and position |
| `window:dimensions` | string | `""` | Saved window dimensions (WxH) |
| `window:reducedmotion` | boolean | `false` | Reduce animations |
| `window:magnifiedblockopacity` | number | `0.6` | Opacity of background when a pane is magnified |
| `window:magnifiedblocksize` | number | `0.9` | Size of magnified pane (0.0–1.0) |
| `window:maxtabcachesize` | number | `10` | Maximum cached tabs |
| `window:disablehardwareacceleration` | boolean | `false` | Disable GPU acceleration |

## App Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `app:globalhotkey` | string | `""` | Global activation hotkey |
| `app:defaultnewblock` | string | `""` | Default pane type for new blocks |
| `app:showoverlayblocknums` | boolean | `false` | Show block numbers as overlay |

## Shell Environment

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `cmd:env` | object | `{}` | Environment variables passed to all shell processes |

## Auto Update Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `autoupdate:enabled` | boolean | `true` | Check for updates automatically |
| `autoupdate:installonquit` | boolean | `true` | Install updates when quitting |
| `autoupdate:channel` | string | `"latest"` | Release channel |

## Telemetry Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `telemetry:enabled` | boolean | `true` | Enable telemetry collection |
| `telemetry:interval` | number | `1.0` | Metrics collection interval in seconds |
| `telemetry:numpoints` | number | `120` | Number of history data points to track |

## Connection Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `conn:wshenabled` | boolean | `true` | Enable wsh shell integration on remote connections |
| `conn:askbeforewshinstall` | boolean | `true` | Prompt before installing wsh on remote hosts |

## Other Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `widget:showhelp` | boolean | `true` | Show help widget in top bar |
| `widget:icononly` | boolean | `false` | Icon-only widget bar (no labels) |
| `blockheader:showblockids` | boolean | `false` | Display block IDs in pane headers |
| `markdown:fontsize` | number | `14` | Font size for markdown rendering |
| `preview:showhiddenfiles` | boolean | `false` | Show hidden files in file previews |
| `tab:preset` | string | `""` | Default tab layout preset |

## MCP Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `mcp:servers` | object | `{}` | Global MCP server configuration |

### MCP Server Format

```jsonc
{
  "mcp:servers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-name", "/path"],
      "env": {
        "KEY": "value"
      }
    }
  }
}
```

Per-agent MCP configuration in [The Forge](/the-forge) overrides global settings.

## Environment Variables

AgentMux respects these environment variables:

| Variable | Purpose |
|----------|---------|
| `AGENTMUX_HOME` | Override the config directory path |
| `AGENTMUX_DEV` | Enable development mode (uses `~/.agentmux-dev/`) |
| `CLAUDE_API_KEY` | API key for Claude agent panes |
| `OPENAI_API_KEY` | API key for Codex agent panes |
| `GEMINI_API_KEY` | API key for Gemini agent panes |

## Data Directories

| Purpose | Development | Production |
|---------|------------|------------|
| Config | `~/.agentmux-dev/` | `~/.agentmux/` |
| Logs | `~/.agentmux-dev/agentmux.log` | `~/.agentmux/agentmux.log` |
| Database | `~/.agentmux-dev/agentmux.db` | `~/.agentmux/agentmux.db` |

## See Also

- [Configuration](/config) — Settings overview with examples
- [Keybindings](/keybindings) — Keyboard shortcuts
- [The Forge](/the-forge) — Per-agent configuration
- [System Metrics](/system-metrics) — Telemetry settings explained
