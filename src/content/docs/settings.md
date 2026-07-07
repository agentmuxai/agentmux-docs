---
title: "Settings Reference"
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

Complete reference for all AgentMux settings. Settings are stored in `settings.json` and edited directly in your default editor.

## Opening Settings

Settings is now a real **pane view** with its own UI sections (Appearance / Terminal / Agent / Sounds / Network / Files / Advanced) — it's registered as `defwidget@settings` in the widget bar (unpinned by default, reachable from the widget bar's overflow) and also reachable from the **hamburger menu**:

1. Click the hamburger icon (≡) at the start of the tab bar.
2. Select **Settings**.
3. AgentMux opens (or focuses) the Settings pane.

Editing `settings.json` directly still works and is reflected in the pane — use the command palette ("Open Settings File") if you want the raw file instead of the UI.

The hamburger menu also includes inline submenus for the most-changed preferences so you don't have to touch the file directly:

- **Theme** ▸ Pick from `Default`, `Midnight`, `High Contrast`, `Monokai`, `Nord`, `Dracula`, `Tokyo Night`, `Catppuccin`, or `Gruvbox`. Selection persists across restart (writes `window:theme`).
- **Opacity** ▸ Global window translucency from 100% down to 35% in 5% steps (writes `window:opacity` + `window:transparent`). For per-window control, use the InstancePanel slider — click the version chip in the status bar. See [Window appearance](/window-appearance/).

Under `Midnight` specifically, the agent pane background is pure black; other panes use the theme's deep-navy `--main-bg-color`.

## Settings File Location

Settings live under the channel's data dir, so every version that binds to the same channel reads and writes the same `settings.json`:

| Mode | Path |
|---|---|
| Installed / Portable | `~/.agentmux/channels/<channel>/config/settings.json` (default channel: `stable`) |
| Dev (`task dev`) | `~/.agentmux/dev/<branch>/<clone-id>/config/settings.json` |

The `<channel>` segment is `stable` by default for Installed and downloaded Portable builds, `local-<branch>` for locally-packaged builds, or whatever `AGENTMUX_CHANNEL=<name>` overrides to. Dev mode keys on the git branch plus a per-clone hash so two checkouts of the same branch don't collide. Override the `~/.agentmux/` root with `AGENTMUX_HOME_OVERRIDE` for tests. See [Multi-instance & dev mode](/multi-instance/) for the full layout.

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
| `term:agentmaxruntimehours` | number | `0` | Max runtime for an agent pane in hours (`0` = unlimited) |
| `term:agentidletimeoutmins` | number | `0` | Idle timeout for an agent pane in minutes (`0` = unlimited) |
| `term:predictiveecho` | boolean | `true` | Show typed characters locally before PTY echo confirms them. Disable for strict server-echo-only behavior. |
| `term:predictiveecho:thresholdms` | number | `0` | Only predict when rolling p50 round-trip ≥ this value (ms). `0` = always predict once armed. |

## Window Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `window:theme` | string | `"default"` | UI color theme. One of `default`, `midnight`, `high-contrast`, `monokai`, `nord`, `dracula`, `tokyo-night`, `catppuccin`, `gruvbox`. Easier to switch from the hamburger menu's `Theme` submenu. |
| `window:transparent` | boolean | `false` | Enable window transparency |
| `window:blur` | boolean | `false` | Blur background (macOS only) |
| `window:opacity` | number | `1.0` | Window opacity (0.0–1.0). The hamburger menu's `Opacity` submenu (global) and the InstancePanel per-window slider both clamp to 0.35–1.0; direct edits to `settings.json` accept any number. Windows only — see [Window appearance](/window-appearance/). |
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
| `window:magnifiedblockblurprimarypx` | integer | — | Primary blur radius (px) behind a magnified pane |
| `window:magnifiedblockblursecondarypx` | integer | — | Secondary blur radius (px) behind a magnified pane |
| `window:maxtabcachesize` | number | `10` | Maximum cached tabs |
| `window:disablehardwareacceleration` | boolean | `false` | Disable GPU acceleration |

## App Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `app:globalhotkey` | string | `""` | Global activation hotkey |
| `app:defaultnewblock` | string | `""` | Default pane type for new panes |
| `app:defaultmodel` | string | `""` | Default model for new agent panes (e.g. `"claude-sonnet-4-6"`). When blank, the Launch Agent modal uses the model from the selected Memory bundle, or the provider's default if none is set. |
| `app:showoverlayblocknums` | boolean | `false` | Show pane numbers as overlay |
| `app:dismissarchitecturewarning` | boolean | `false` | Suppress the architecture-mismatch notice |

## Shell Environment

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `cmd:env` | object | `{}` | Environment variables passed to all shell processes |

## Telemetry Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `telemetry:enabled` | boolean | `false` | Enable the local Sysinfo pane's metrics sampler. Despite the name, this isn't analytics or crash-reporting — it's a purely local CPU/memory/disk/network sampling loop for the Sysinfo widget; nothing is ever sent off-device. Off by default. |
| `telemetry:interval` | number | `1.0` | Metrics collection interval in seconds |
| `telemetry:numpoints` | number | `120` | Number of history data points to track |

## Connection Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `conn:wshenabled` | boolean | `true` | Enable wsh shell integration on remote connections |
| `conn:askbeforewshinstall` | boolean | `true` | Prompt before installing wsh on remote hosts |

## Network Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `network:lan_discovery` | boolean | `false` | Advertise this instance + browse for peer AgentMux instances via mDNS. Off by default — on Windows, flipping it on triggers the firewall prompt for UDP 5353. See [LAN discovery](/lan-discovery/) for the toggle in the HostPopover (preferred over editing this file directly, since the UI flips the daemon live without a restart). |

## Other Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `widget:showhelp` | boolean | `true` | Show Help widget in top bar |
| `widget:icononly` | boolean | `false` | Icon-only widget bar (no labels) |
| `blockheader:showblockids` | boolean | `false` | Display pane IDs in pane headers |
| `preview:showhiddenfiles` | boolean | `false` | Show hidden files in file previews |
| `tab:preset` | string | `""` | Default tab layout preset |

## MCP Servers

MCP servers are configured **per-agent** in a [Memory bundle](/memory/), not via a global `settings.json` key. The agent runtime materializes the bundle's `mcp_servers` field into the agent's `.mcp.json` at launch and the AgentMux MCP server is auto-injected alongside any user-defined entries.

See [Memory bundles](/memory/) for the bundle schema (including the `mcp_servers` field).

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

For installed and portable release builds (v0.41.1+), state is split across **version-scoped** paths (one set per release, isolated so concurrent versions can't collide) and **channel-wide** paths (shared across all versions of the same channel, so they survive upgrades). Dev builds (`task dev`) skip the version-scoping and use a single per-(branch, clone) dir.

| Purpose | Path | Scope |
|---|---|---|
| Config (`settings.json`, per-provider auth-config-dir homes) | `~/.agentmux/channels/<channel>/config/` | Channel-wide |
| Agent definitions | `~/.agentmux/channels/<channel>/agents/` | Channel-wide |
| SQLite stores (objects, filestore, sagas) | `~/.agentmux/channels/<channel>/versions/<v>/data/db/` | Version-scoped |
| Launcher event log (JSONL) | `~/.agentmux/channels/<channel>/versions/<v>/data/launcher-events.log` | Version-scoped |
| Logs — host (rotated daily, 7-day retention) | `~/.agentmux/channels/<channel>/versions/<v>/logs/` | Version-scoped |
| Logs — sidecar (rotated daily) | `~/.agentmux/logs/agentmuxsrv-v<v>.log.<date>` | Account-wide |
| CEF cache (cookies, local storage, IndexedDB) | `~/.agentmux/channels/<channel>/versions/<v>/cef-cache/` | Version-scoped |
| Account-wide state (dictionaries, cross-channel shared) | `~/.agentmux/shared/` | Account-wide |
| Dev mode root | `~/.agentmux/dev/<branch>/<clone-id>/` | Per-(branch × clone), no version split |

See [Data layout](/internals/data-layout/) and [Multi-instance & dev mode](/multi-instance/) for the full layout and the historical migration from per-version → channels → channels-plus-version-scoped-runtime.

## See Also

- [Configuration](/config) — Settings overview with examples
- [Keybindings](/keybindings) — Keyboard shortcuts
- [Memory bundles](/memory/) — Per-agent configuration
- [System Metrics](/system-metrics) — Telemetry settings explained
