---
title: "Settings Reference"
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

Complete reference for all AgentMux settings. Settings are stored in `settings.json` and edited directly in your default editor.

## Opening Settings

Settings is **not a pane** — there's no `defwidget@settings` widget anymore. Open `settings.json` from the **hamburger menu** in the top tab bar:

1. Click the hamburger icon (≡) at the start of the tab bar.
2. Select **Settings**.
3. AgentMux opens `settings.json` in your default editor (via `ensure_settings_file` + `open_in_editor`).

You can also use the command palette ("Open Settings File") if you prefer keyboard navigation.

## Settings File Location

Settings are per-instance, under the unified data layout:

| Mode | Path |
|---|---|
| Installed / Portable | `~/.agentmux/versions/<version>/config/settings.json` |
| Dev (`task dev`) | `~/.agentmux/dev/<branch>/config/settings.json` |

Override the `~/.agentmux/` root with the `AGENTMUX_HOME_OVERRIDE` environment variable (intended for tests). See [Multi-instance & dev mode](/multi-instance/) for the full layout.

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

Per-agent MCP configuration in [Memory bundles](/memory/) overrides global settings.

## Environment Variables

AgentMux respects these environment variables:

| Variable | Purpose |
|----------|---------|
| `AGENTMUX_HOME_OVERRIDE` | Override the `~/.agentmux/` root (intended for tests) |
| `AGENTMUX_RUNTIME_MODE` | Set by the launcher; consumers read it to know they're running installed/portable/dev |
| `AGENTMUX_DATA_DIR`, `AGENTMUX_CONFIG_DIR`, `AGENTMUX_LOG_DIR`, … | Per-instance paths exported by the launcher; never set these manually |
| `CLAUDE_CONFIG_DIR` | Per-instance Claude Code auth/config dir; AgentMux sets this automatically |
| `CODEX_HOME` | Per-instance Codex CLI auth dir |
| `GEMINI_CLI_HOME` | Per-instance Gemini CLI auth dir |
| `GEMINI_FORCE_FILE_STORAGE` | `true` — required for Gemini CLI auth-dir isolation |
| `OPENCLAW_HOME` | Per-instance OpenClaw auth dir |
| `KIMI_SHARE_DIR` | Per-instance Kimi Code CLI auth dir |
| `COPILOT_HOME` | Per-instance GitHub Copilot CLI auth dir |
| `PI_HOME` | Per-instance Pi auth dir |
| `CLAUDE_API_KEY` | Optional fallback for Claude agent panes (OAuth is the primary path) |
| `OPENAI_API_KEY` | Optional fallback for Codex agent panes (OAuth is the primary path) |
| `GEMINI_API_KEY` | Optional fallback for Gemini agent panes (OAuth is the primary path) |

The per-provider `*_HOME` / `*_CONFIG_DIR` variables are set automatically by AgentMux at launch (sourced from each provider's `authConfigDirEnvVar` field in `PROVIDERS`). Setting them manually is only useful when scripting an out-of-AgentMux workflow against the same auth dirs.

## Data Directories

All per-instance state lives under `<instance>/`, where `<instance>` is `~/.agentmux/versions/<version>/` (installed / portable) or `~/.agentmux/dev/<branch>/` (dev). See [Persistence](/internals/persistence/) and [Multi-instance & dev mode](/multi-instance/) for the full layout.

| Purpose | Path |
|---|---|
| Config (`settings.json`, etc.) | `<instance>/config/` |
| Logs (rotated daily, 7-day retention) | `<instance>/logs/` |
| SQLite stores (objects, filestore, sagas) | `<instance>/data/db/` |
| Launcher event log (JSONL) | `<instance>/data/launcher-events.log` |
| Account-wide state (cookies, OAuth) | `~/.agentmux/shared/` |

## See Also

- [Configuration](/config) — Settings overview with examples
- [Keybindings](/keybindings) — Keyboard shortcuts
- [Memory bundles](/memory/) — Per-agent configuration
- [System Metrics](/system-metrics) — Telemetry settings explained
