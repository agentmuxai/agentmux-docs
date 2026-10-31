---
title: "The window"
description: "What's in an AgentMux window: the top bar with its tabs and widget bar, the panes, and the status bar with the panels each item opens."
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

An AgentMux window has three parts: the **top bar**, the **panes** of the current tab, and the **status bar** along the bottom.

![An AgentMux window: the top bar, three panes (Agent, CPU and Swarm), and the status bar](../../assets/screenshots/chrome/chrome-window.png)

## Top bar

![The top bar: the hamburger menu, a window tab, the widget bar (Agent, Swarm, Memory, Connectors, Files, Browser, Settings, Help and more) and the window buttons](../../assets/screenshots/chrome/chrome-top-bar.png)

From left to right:

- **Hamburger menu (≡):** global actions and preferences. See [Main menu & command palette](/main-menu/).
- **Window tabs:** each tab holds its own layout of panes. **New Tab** (`Ctrl+Shift+T` / `⌘T`) adds one; drag a tab below the tab bar to [tear it off](/pane-types/#tab-tear-off) into a new window.
- **Widget bar:** one icon per pinned widget; click one to open it. Widgets that aren't pinned are under **more** at the end of the bar. Right-click a pinned icon to unpin it.
- **Window buttons:** minimize, maximize and close.

The main window reopens where you left it, and maximized if it was, after a quit, a crash or an upgrade, on Windows, macOS and Linux. A window saved on a display that has since been unplugged isn't placed there. On Linux under native Wayland only the size and the maximized state come back, because the compositor decides where windows go.

### The widget bar's More list

Hover **more** (or click it) to list the widgets that aren't pinned to the bar. Click one to open it.

![The More list open under the widget bar, listing the widgets that aren't pinned: Kanban, Terminal, Editor, Messengers, Sysinfo, Drone, Warden, Vault, Toolchain and Tower](../../assets/screenshots/chrome/chrome-more-dropdown.png)

### A tab's menu

Right-click a window tab to colour it or rename it: pick one of 14 colours, **Clear color** to remove it, or **Rename**. The colour is stored with the tab (`tab:color`).

![A window tab's menu: 14 tab colours, Clear color, Rename and Close menu](../../assets/screenshots/chrome/chrome-tab-menu.png)

### Closing a tab

A tab's close button (×) asks first, because the tab's panes close with it. Tick **Don't ask again** (or turn on **Skip tab close confirmation** in [Settings → Window & Panes](/settings/#window--panes)) to close tabs straight away from then on.

![The Close tab dialog: "This tab and all its panes will be closed", with Don't ask again, Cancel and Close tab](../../assets/screenshots/chrome/chrome-close-tab-confirm.png)

## Panes

Each pane has a header that is also its tab strip: a pane can hold several tabs of any widget type. The buttons at the right of the header minimize the pane, maximize it to fill the tab, and close it. Right-click the header for the pane's menu. See [Pane Management](/pane-types/#pane-management) for splitting, pane tabs, moving panes and floating them.

## Status bar

![The status bar: uptime, CPU, memory, page file, disk, network and disk activity, graphics mode, token usage, host name and version](../../assets/screenshots/chrome/chrome-status-bar.png)

From left to right:

| Item | Shows | Click it for |
|------|-------|--------------|
| Backend status | A status dot and how long the backend has been up | The backend panel |
| **CPU** | Total CPU use | The load on each core |
| **GPU** | GPU use, where the platform reports it | — |
| **Mem** | Memory used and total | — |
| **PF** | Commit charge used and total: RAM plus the page file budget (Windows) | — |
| **Disk** | How much of the system drive is free (its colour warns as it fills) | Free space on each drive |
| ↑ ↓ | Network upload and download | — |
| **R** **W** | Disk reads and writes | — |
| **GFX** | Whether the window is drawn by the GPU (`HW`), in software (`SW`), or without WebGL | — |
| ↑ ↓ (right) | Tokens your agents have sent and received this session | Token usage by service |
| Host name | This computer's name, with the LAN discovery indicator (◇) and the MuxBus Cloud dot | The host panel |
| Version | The AgentMux version | The instance panel |

Hover an item for a short description. Each panel closes with `Esc` or a click outside it.

### Backend

The backend's status, process id, uptime and endpoint, and how the window is drawn: whether graphics are hardware accelerated, the WebGL version, and the graphics driver.

![The backend panel: status running, PID, uptime and endpoint, and the GPU section with WebGL and driver](../../assets/screenshots/chrome/chrome-status-backend.png)

### CPU cores

The load on each CPU core, and the average.

![The CPU Usage panel: one bar per core with its percentage, and the average](../../assets/screenshots/chrome/chrome-status-cpu.png)

### Disk space

Each drive's free space and size. The **Disk** figure in the bar is the system drive's free share.

![The Disk Space panel: one bar per drive with its free space and size](../../assets/screenshots/chrome/chrome-status-disk.png)

### Token usage

Tokens sent and received since the time shown, by service. **Reset counter** starts the count again.

![The Token Usage panel before any turn has completed, with Reset counter](../../assets/screenshots/chrome/chrome-status-tokens.png)

### Host

This computer: its OS, address, the backend's process id, and the version's data folder (click the path to open it in your file manager). Below that: the [LAN discovery](/lan-discovery/) switch and **Pair a device**, [MuxBus Cloud](/auth/) sign-in, and the local endpoints (IPC, backend, WebSocket, DevTools).

![The host panel: OS, IP, PID and data folder; LAN discovery switched off with Pair a device; MuxBus Cloud with Sign in; and the IPC, backend, WS and DevTools endpoints](../../assets/screenshots/chrome/chrome-status-host.png)

### Instance panel

This AgentMux instance: its version, channel, commit, CEF version, runtime and build time (each with a copy button), the windows of the open [workspace](/workspaces/), its floating panes, and maintenance (whether this version is up to date, with **Check for update**). **Open another window** opens a new window in the workspace.

The window list is headed by the workspace's name and how many windows it has ("Default Workspace — 3 windows"); double-click the heading, or press `F2` on it, to rename the workspace. Below it:

- **Open windows** (● this window, ○ the others): click one to focus it, double-click (or `F2`) to rename it. Each has an opacity slider and **Remove from workspace**, which closes the window and deletes its tabs and panes (disabled on the only open window).
- **Closed windows**, greyed (◌), with when they closed: click one, or its **Reopen** button, to open it where it was, its agents resuming. Right-click one for **Remove from workspace**.

Closing a window keeps it in the workspace as a closed window (see [Workspaces](/workspaces/#windows-in-a-workspace)). See [Window appearance](/window-appearance/) for the opacity slider and [Report issues](/report-issues/) for what to copy into a bug report.

![The instance panel: version, channel, commit, CEF, runtime and build time; the Default Workspace's 3 windows, Window 1 (this window) and Window 2 open, each with its opacity slider and trash button, and a closed window, greyed, with when it closed and Reopen; floating panes; maintenance with Check for update; and Open another window](../../assets/screenshots/chrome/chrome-status-instance.png)

## See also

- [Main menu & command palette](/main-menu/)
- [Pane Types](/pane-types/) and [Pane Management](/pane-types/#pane-management)
- [Settings reference](/settings/)
- [System Metrics](/system-metrics/): the Sysinfo widget's graphs
