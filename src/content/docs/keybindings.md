---
title: "Keybindings"
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

All keyboard shortcuts for AgentMux. On macOS, `Cmd` is used; on Windows/Linux, `Alt` is used instead.

## Command Palette

Press **`Ctrl + P`** from anywhere to open the command palette — a searchable launcher for the registered command groups listed below. The palette is not exhaustive: most navigation and split shortcuts (Connect Remote, Settings, Focus Block N, Tab Switching, Block Navigation, etc.) are reachable only via their keybindings, not from the palette.

| Key | Action |
|---|---|
| `Ctrl + P` | Open the palette |
| Typed characters | Filter the command list |
| `↑` / `↓` | Move highlight |
| `Enter` | Run the highlighted command |
| `Esc` | Close the palette |

Commands are grouped by category:

| Category | Commands |
|---|---|
| **Open** | Open Terminal, Open Agent, Open System Info, Open Swarm, Open Help |
| **Split** | Split Right / Left / Down / Up |
| **Window** | New Window, Close Window, Minimize Window, Toggle Maximize |
| **Tab** | New Tab, Close Tab, Next Tab, Previous Tab |
| **Pane** | Close Pane, Toggle Magnify, Focus Pane Right / Left / Up / Down |
| **Dev** | Toggle DevTools, Restart Backend, Open Settings File |

Most commands also have a direct keyboard shortcut — see the tables below.

## General

| Action | macOS | Windows / Linux |
|--------|-------|-----------------|
| New Tab | `Cmd + T` | `Alt + T` |
| New Terminal Block | `Cmd + N` | `Alt + N` |
| Open Agent Panel | `Cmd + Shift + A` | `Alt + Shift + A` |
| Close Block | `Cmd + W` | `Alt + W` |
| Magnify Block | `Cmd + M` | `Alt + M` |
| Connect Remote | `Cmd + G` | `Alt + G` |
| Settings | `Cmd + ,` | `Alt + ,` |

## Tab Switching

| Action | macOS | Windows / Linux |
|--------|-------|-----------------|
| Switch to Tab N | `Cmd + 1-9` | `Alt + 1-9` |
| Previous Tab | `Cmd + [` | `Alt + [` |
| Next Tab | `Cmd + ]` | `Alt + ]` |

## Block Navigation

| Action | Shortcut |
|--------|----------|
| Navigate Between Blocks | `Ctrl + Shift + Arrow Keys` |
| Focus Block N | `Ctrl + Shift + 1-9` |
| Focus Agent Panel | `Ctrl + Shift + 0` |

## Splitting

| Action | macOS | Windows / Linux |
|--------|-------|-----------------|
| Split Right | `Cmd + D` | `Alt + D` |
| Split Below | `Cmd + Shift + D` | `Alt + Shift + D` |
| Split in Direction | `Ctrl + Shift + S`, then Arrow Key |

## Customization

Keybindings can be customized in the settings file. See [Configuration](/config) for details on the settings file location and format.
