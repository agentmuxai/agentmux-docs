---
title: "Pane Types"
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

AgentMux organizes your workspace into panes — individual views that can be split, rearranged, and magnified. Each pane has a specific type that determines its behavior.

## Available Pane Types

| Pane | Icon | View ID | Description |
|------|------|---------|-------------|
| **Terminal** | square-terminal | `term` | Full terminal with real PTY via xterm.js |
| **Browser** | globe | `browser` | Embedded web browser, native CefBrowserView |
| **Agent** | sparkles | `agent` | AI agent session with streaming output (includes Forge config + Identity panels as in-pane subsections) |
| **Editor** | file-code | `editor` | Code editor with syntax highlighting |
| **Swarm** | bee | `swarm` | Multi-agent orchestration and history |
| **Subagent** | diagram-subtask | `subagent` | Monitor a specific sub-agent's activity |
| **Sysinfo** | chart-line | `sysinfo` | Live system metrics graphs |
| **Help** | circle-question | `help` | Built-in documentation |
| **DevTools** | code | `devtools` | Toggle Chromium DevTools |

**Forge** and **Identity** are not standalone pane types — they're tabs inside the Agent pane (see the Agent section below). **Settings** is not a pane either — open it via the hamburger menu.

## Terminal

The terminal pane provides authentic terminal emulation powered by xterm.js and portable-pty on the backend.

Features:

- Real PTY with full ANSI support
- Configurable font family and size
- Per-pane zoom level (`Ctrl+/-` and `Ctrl+Scroll`)
- Shell-integration env block (`AGENTMUX_BLOCKID`, `AGENTMUX_LOG_DIR`, `AGENTMUX_AGENT_ID`, …) with helper functions like `muxlog`
- Remote connections (SSH)

Open a terminal: `Cmd+N` / `Alt+N` or click the terminal icon in the top bar.

The shell-integration scripts deployed to `~/.agentmux/shell/` set the env vars and define helpers; see [Multi-instance & dev mode](/multi-instance/#shell-helpers) for the full list.

## Browser

The browser pane embeds a native [CefBrowserView](https://bitbucket.org/chromiumembedded/cef/) at the OS-window level. It is **not** an iframe — the pane HWND sits as a child window of the AgentMux frame, which is why links, popups, and DRM content all work like a regular Chromium tab.

| Control | Action |
|---|---|
| ← / → / ⟳ | Back / Forward / Reload |
| Address bar | Enter URL or search query — defaults to a search if it doesn't parse as a URL |
| Go | Navigate to the address-bar value |

Header state syncs from the backend's `browser-pane-nav-state` event:

- **Title** — updates as the page loads
- **Favicon** — fetched from the page; falls back to the `globe` icon
- **History** — back/forward enabled state, per-pane

When you click inside the pane, the host fires `browser-pane-clicked` over the JS bridge, which the [reducer stack](/reducer-stack/) routes through `refocusNode(blockId)` so keyboard shortcuts and split commands target the clicked pane. (DOM clicks don't bubble out of the embedded HWND, so the explicit IPC is necessary — this is the same pattern the [debugging](/debugging/#reducer-dispatch-ring) page describes.)

### IPC commands

The host exposes the browser pane's lifecycle via these CEF commands (invoked through `invokeCommand` from the renderer):

- `browser_pane_create` — instantiate the CefBrowserView; called on first mount
- `browser_pane_navigate` — load a URL
- `browser_pane_resize` — propagate Solid layout changes to the HWND
- `browser_pane_reload` — reload the current page
- `browser_pane_focus` — explicit focus handoff after a click
- `browser_pane_close` — tear down on pane close

If you need to drive the browser pane from an agent or saga, those are the commands. The frontend [BrowserViewModel](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/view/browser/browser-model.ts) shows the canonical sequencing.

### Default URL

Blank-spawned browser panes default to `https://agentmux.ai`. To get a literally blank pane, pass `meta.url = "about:blank"` explicitly. (Spec: `SPEC_BROWSER_PANE_DEFAULT_URL_AND_POPUP_2026_04_21.md`.)

### Address-bar focus + click handoff

The address bar and the embedded CEF pane each compete for keyboard focus across **two independent axes**:

1. **DOM focus** — `document.activeElement` in the main React webview. Owned by Chromium, updated on every focus/blur. The "DOM is the source of truth for where typing goes" rule from the [browser-pane state catalog](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/browser-pane-state-catalog.md) applies to this axis only.
2. **Win32 OS focus** — which HWND receives keystrokes. Owned by the OS, set by `SetFocus`/`SetForegroundWindow`. The pane HWND is a child of the main window; clicking the pane intercepts the click at WndProc level *before* the renderer's React DOM ever sees it.

When these two axes disagree, you get the classic "click X, type, characters land in Y" bug. Two specific paths matter:

**Click into the page (e.g. google search):** The pane HWND captures the click via WndProc, `SetFocus`s itself, and emits `browser-pane-clicked` over IPC. The renderer's `BrowserViewModel` handler explicitly **blurs whatever main-window input held DOM focus** before calling `refocusNode(blockId)` — otherwise the subsequent `giveFocus()` flow sees the address bar's stale `activeElement` and tells the host to bounce OS focus back to the main window. (Diag log: `[browser-pane:diag] pane-click blur active=input.browser-address-bar`.)

**Click into the address bar:** The `<input>` `onMouseDown` handler fires `main_window_focus` IPC *before* the focus event, so OS keyboard focus moves to the main webview HWND at click-start. Without this, the address bar's `onFocus` fires too late — DOM focus moves but OS focus stays on the pane HWND, and keystrokes still route to Chromium. Buttons in the same nav bar happen to work without an explicit IPC because CEF/Chromium internally calls `SetFocus(parent)` for native `<button>` controls; `<input>` doesn't get the same treatment when the parent webview lacks focus.

`onMouseDown` (not `onMouseEnter`) is the click-to-focus trigger on both sides — hover-focus loops were the original failure mode the design corrects.

## Agent

The agent pane runs an AI agent session. It displays:

- **Streaming text** — Agent output in real time
- **Tool calls** — Name, arguments, and result of each tool invocation
- **File diffs** — Visual diff overlay when the agent writes files
- **Auto-scroll** — Follows output, with manual scroll override

Agent panes are configured through [The Forge](/the-forge/), accessible as a tab inside the agent pane (see Subsections below).

Settings that affect agent panes:

| Setting | Default | Description |
|---------|---------|-------------|
| `agent:defaultprovider` | `claude` | Default provider for new agent panes |
| `agent:showtoolcalls` | `true` | Show tool calls in real time |
| `agent:showdiffs` | `true` | Show file diff overlay |
| `agent:autoscroll` | `true` | Auto-scroll agent output |

### Subsections

The agent pane has built-in side panels — they used to be standalone pane types but are now in-pane tabs:

- **Forge** — agent configuration manager. Create / edit / view forge agents (host, container, custom), including their Soul, Instructions, MCP, and Env tabs. Same surface as [The Forge](/the-forge/) page describes.
- **Identity** — manage agent identities (provider accounts, OAuth tokens, per-agent credential mapping). Backed by `frontend/app/view/identity/`, surfaced as the Identity panel inside the agent pane's settings.

Both open from inside an active agent pane — there is no top-bar widget for either.

## Swarm

The Swarm pane provides a bird's-eye view of all agent activity. It has three tabs:

- **Overview** — Active and completed sub-agents across all agent sessions
- **History** — Past session metadata with message counts, models, token usage, and git branches
- **Search** — Full-text search across all agent sessions

Click any sub-agent in the overview to open a dedicated [Subagent](#subagent) pane.

## Subagent

A focused view of a single sub-agent's activity stream. Shows:

- Agent ID and slug
- Status badge (active, completed, loading)
- Event count and last activity time
- Model being used
- Event stream: text output, tool uses, tool results, and progress updates

Subagent panes auto-scroll by default. Scroll up to pause, and a "scroll to bottom" button appears.

## Sysinfo

Live system metrics displayed as time-series line plots. Supports multiple plot types:

| Plot Type | Metrics |
|-----------|---------|
| CPU | Overall CPU usage % |
| Mem | Memory used (GB) |
| CPU + Mem | Both on one view |
| Net | Total network throughput (MB/s) |
| Net (Sent/Recv) | Sent and received separately |
| Disk I/O | Total disk throughput |
| Disk I/O (R/W) | Read and write separately |
| All CPU | Per-core CPU usage (up to 32 cores) |
| CPU + Mem + Net | All three combined |

Data streams via WebSocket events from the backend. Supports remote connections — view system metrics from SSH-connected hosts.

## Pane Management

### Creating Panes

- **Top bar widgets** — Click the icons on the right side of the top bar
- **Right-click header** — Right-click a pane header for the widget menu
- **Keyboard** — `Cmd+N` / `Alt+N` for terminal, `Cmd+Shift+A` / `Alt+Shift+A` for agent panel

### Splitting

| Action | macOS | Windows / Linux |
|--------|-------|-----------------|
| Split Right | `Cmd+D` | `Alt+D` |
| Split Below | `Cmd+Shift+D` | `Alt+Shift+D` |
| Split in Direction | `Ctrl+Shift+S` + Arrow | Same |

### Navigation

| Action | Shortcut |
|--------|----------|
| Navigate between panes | `Ctrl+Shift+Arrow` |
| Focus pane N | `Ctrl+Shift+1-9` |
| Close pane | `Cmd+W` / `Alt+W` |
| Magnify pane | `Cmd+M` / `Alt+M` |

### Drag and Drop

Rearrange panes by dragging their headers. You can:

- Reorder panes within a tab
- Move panes across tabs
- Drag panes between windows (cross-window drag supported on all platforms)
