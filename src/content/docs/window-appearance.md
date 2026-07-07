---
title: Window appearance
description: Control global and per-window opacity in AgentMux.
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

AgentMux lets you control window translucency at two levels: **global opacity** (applies to the whole instance) and **per-window opacity** (applies to one window independently).

## Global opacity

Global opacity is set from the hamburger menu (≡) → **Opacity** and applies to the entire AgentMux instance. Choosing any value below 100% makes all windows translucent at the same level.

This writes two settings into `settings.json`:

| Key | Value (via slider) |
|-----|-------|
| `window:opacity` | `0.35`–`1.0` in 5% steps |
| `window:transparent` | `true` when opacity < 1.0, `false` at 100% |

The slider floor is **35%** — below that text becomes unreadable, so the UI clamps there. The underlying `window:opacity` key is unbounded in the schema; if you edit `settings.json` directly you can set values below 0.35 (at your own risk).

Changes take effect immediately. When you restart AgentMux, opacity is restored from `settings.json` automatically.

**Platform support:** Windows only. On macOS and Linux the value is stored in `settings.json` but produces no visible change — `set_window_transparency` in `agentmux-cef` is gated to `#[cfg(target_os = "windows")]` and the non-Windows path discards the args. macOS support is on the roadmap; Linux depends on compositor capability.

## Per-window opacity

Per-window opacity lets each window have a different translucency level. Use this when you want one window fully opaque and another at 70%, for example.

### Opening the slider

1. Click the **version chip** in the bottom status bar (shows the version number, e.g. `v0.33.893`).
2. The **Instance Panel** popover opens, listing all open windows.
3. Under each window name, drag the **Opacity** slider — the window dims in real time.
4. Release to confirm. The value persists across restarts.

### Slider range

The InstancePanel slider clamps to **35%–100%** in **5% steps**, matching the global Opacity submenu. The percentage label to the right of the slider updates live. At 100% the transparency setting is cleared and the window returns to fully opaque.

As with global opacity, the underlying `window:opacity` key has no schema-level minimum — manual JSON edits to the window meta can go below 0.35, but the UI never produces those values.

### Persistence

Per-window opacity is stored in the window's object meta:

| Key | Value (via slider) |
|-----|-------|
| `window:opacity` | `0.35`–`< 1.0` (UI range), or absent when 100% |
| `window:transparent` | `true` while opacity is active, `false` (or absent) at 100% |

When you drag the slider to 100%, both keys are cleared — the window returns to fully opaque with no transparency layer active.

On next launch, AgentMux reads the stored meta and restores each window's opacity individually. As of the window-topology-persistence work, this now also survives an unexpected **crash** (not just a clean quit and relaunch): the value is mirrored to the srv-side `Window.opacity` field via a `SetWindowOpacity` RPC, so if the host process is killed outright, the next launch can still recover the last-set opacity from srv storage rather than defaulting to opaque.

### Interaction with global opacity

Per-window opacity and global opacity are independent. The per-window slider controls only the targeted window. The global hamburger-menu Opacity submenu controls all windows that don't have a per-window override applied.

If you set a per-window opacity of 70% on Window A and set global opacity to 80%, Window A stays at 70% and Window B (no override) is at 80%.

### Platform support

Per-window opacity uses Win32 `SetLayeredWindowAttributes` and ships **Windows only**. On macOS and Linux the slider value is stored to the window meta but produces no visible change (the host's `set_window_transparency` command is `#[cfg(target_os = "windows")]`). macOS support is on the roadmap.

## See Also

- [Settings reference](/settings/) — `window:opacity`, `window:transparent`, `window:blur`
- [Keybindings](/keybindings/) — keyboard shortcuts
