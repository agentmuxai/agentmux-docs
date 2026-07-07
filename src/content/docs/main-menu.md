---
title: Main menu & command palette
description: The hamburger menu (≡) in the top tab bar lists global actions and preferences; the command palette (Ctrl+P / ⌘P) gives keyboard-driven access to a wider set of commands.
---

AgentMux groups global actions into two surfaces:

- The **hamburger menu** (≡) at the start of the top tab bar — mouse-friendly, organized by category.
- The **command palette** (`Ctrl+P` / `⌘P`) — keyboard-driven, searchable list of every registered command.

## Hamburger menu (≡)

Click the three-line icon at the start of the tab bar. Items, top to bottom:

| Item | Shortcut | What it does |
|------|---------|--------------|
| **Command Palette** | `Ctrl+P` / `⌘P` | Opens the command palette (see below). |
| **New Tab** | `Ctrl+T` / `⌘T` | Adds a new tab to the current window. |
| **New Window** | `Ctrl+Shift+N` / `⌘⇧N` | Opens a second AgentMux window — fully isolated tabs/state from the first. See [Running multiple instances](/multi-instance/). |
| **Theme** | — | Submenu listing the available color themes. Selection persists via `window:theme` in `settings.json`. |
| **Opacity** | — | Submenu of preset levels (35% – 100%). Below 100%, the window becomes translucent. Per-window override is in the [InstancePanel](/window-appearance/). |
| **Help** | — | Opens the in-app Help pane (a quick reference). |
| **Armory** | — | Opens the Armory pane (formerly "Trust Center") — Accounts, Identities, Brain, Bundles, MCP Servers, Skills. See [Armory](/armory/). |
| **Settings** | — | Opens the Settings pane view — same as picking *Settings* from the command palette. Editing `settings.json` directly still works too. See [Settings reference](/settings/). |
| **Exit** | — | Closes the current window (not the whole app — other windows stay open). |

The Theme and Opacity submenus check-mark the currently active value, so you can see at a glance what you're on.

## Command palette (Ctrl+P / ⌘P)

Press `Ctrl+P` (Windows/Linux) or `⌘P` (macOS) from anywhere to open the palette. Type to filter, arrow keys to navigate, Enter to run.

Registered commands are grouped by category:

| Category | Commands |
|----------|----------|
| **Open** | Open Terminal, Open Agent, Open System Info, Open Help, Open Swarm |
| **Split** | Split Right, Split Left, Split Down, Split Up |
| **Window** | New Window, Close Window, Minimize Window, Toggle Maximize |
| **Tab** | New Tab, Close Tab, Next Tab, Previous Tab |
| **Pane** | Close Pane, Toggle Magnify, Focus Pane Right / Left / Up / Down |
| **Dev** | Toggle DevTools, Restart Backend, Open Settings File |

The palette is **not exhaustive** — most navigation shortcuts (Connect Remote, Settings UI, Focus Block N, raw tab-switching, etc.) are reachable only via [keybindings](/keybindings/), not from the palette.

## Why two surfaces?

The hamburger menu is the discoverable surface — open it once and you know what's in there. The command palette is the speed surface — once you know the command name, typing two or three letters and hitting Enter is faster than menu-and-mouse.

If you find yourself wanting an action from the palette that isn't there, [file an issue](/report-issues/) — the registry is small enough that adding new commands is straightforward.
