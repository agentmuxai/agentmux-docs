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

| Key | Value |
|-----|-------|
| `window:opacity` | `0.35`–`1.0` (step 0.05) |
| `window:transparent` | `true` when opacity < 1.0, `false` at 100% |

The minimum is **35%** — below that text becomes unreadable. Steps are 5%.

Changes take effect immediately. When you restart AgentMux, opacity is restored from `settings.json` automatically.

**Platform support:** Windows and macOS. On Linux, the setting is stored but translucency has no effect (compositor support varies).

## Per-window opacity

Per-window opacity lets each window have a different translucency level. Use this when you want one window fully opaque and another at 70%, for example.

### Opening the slider

1. Click the **version chip** in the bottom status bar (shows the version number, e.g. `v0.33.893`).
2. The **Instance Panel** popover opens, listing all open windows.
3. Under each window name, drag the **Opacity** slider — the window dims in real time.
4. Release to confirm. The value persists across restarts.

### Range and steps

- Minimum: **35%** (same floor as global opacity)
- Maximum: **100%** (fully opaque — clears the transparency setting)
- Step: **5%**

The percentage label to the right of the slider updates live.

### Persistence

Per-window opacity is stored in the window's object meta:

| Key | Value |
|-----|-------|
| `window:opacity` | `0.35`–`< 1.0`, or absent when 100% |
| `window:transparent` | `true` while opacity is active, `false` (or absent) at 100% |

When you drag the slider to 100%, both keys are cleared — the window returns to fully opaque with no transparency layer active.

On next launch, AgentMux reads the stored meta and restores each window's opacity individually.

### Interaction with global opacity

Per-window opacity and global opacity are independent. The per-window slider controls only the targeted window. The global hamburger-menu Opacity submenu controls all windows that don't have a per-window override applied.

If you set a per-window opacity of 70% on Window A and set global opacity to 80%, Window A stays at 70% and Window B (no override) is at 80%.

### Platform support

Per-window opacity uses Win32 `SetLayeredWindowAttributes` on Windows. It has no effect on Linux. macOS support is planned.

## See Also

- [Settings reference](/settings/) — `window:opacity`, `window:transparent`, `window:blur`
- [Keybindings](/keybindings/) — keyboard shortcuts
