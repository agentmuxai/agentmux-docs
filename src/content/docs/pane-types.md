---
title: "Pane Types"
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

AgentMux organizes your workspace into panes — individual views that can be split, rearranged, and magnified. Each pane has a specific type that determines its behavior.

## Available Pane Types

Every widget is pinned by default — the widget bar shows the full set directly, collapsing to icon-only when the title bar gets narrow. There's no overflow / More dropdown anymore (it existed in earlier builds but was removed; the `widget:icononly` setting force-collapses labels manually if you prefer).

| Pane | Icon | View ID | Description |
|------|------|---------|-------------|
| **Agent** | sparkles | `agent` | AI agent session with streaming output. Hosts Identity and Memory subsections via the cog → settings panel. |
| **Browser** | globe | `browser` | Embedded native `CefBrowserView` |
| **Terminal** | square-terminal | `term` | Full terminal with real PTY via xterm.js |
| **Sysinfo** | chart-line | `sysinfo` | Live system metrics graphs |
| **Editor** | file-code | `editor` | CodeMirror 6 editor with syntax highlighting + a file-tree explorer rooted at $HOME (with drives and mounts) — see [Editor](#editor) |
| **Swarm** | bee | `swarm` | Multi-agent orchestration and history |
| **Drone** | diagram-project | `drone` | Visual DAG-of-blocks automation engine (Agent / API / Condition / Variables / Response blocks) |
| **Help** | circle-question | `help` | Built-in documentation |
| **Warden** | shield-halved | `warden` | Monitor and control agents across Host / LAN / Internet layers — see [Warden widget](/warden/) |

### Not pane types

These views exist in the codebase but are **not** opened directly from the widget bar:

| Surface | How it's reached |
|---|---|
| **Identity** | Per-agent: tab inside the Agent pane (cog → Identity). App-wide: hamburger menu (≡) → **Identity & Memory** opens the singleton bundle manager. View registration (`view: "identity"`) and `IdentityPaneViewModel` exist for `pane.open` RPC and right-click menu paths. |
| **Memory** | Per-agent: tab inside the Agent pane (cog → Memory). App-wide: same hamburger menu (≡) → **Identity & Memory** entry — both bundles live side-by-side in the manager. Replaces the older Forge concept. |
| **Settings** | Hamburger menu (≡) in the top tab bar → Settings. Opens `settings.json` in your default editor. |
| **DevTools** | Hamburger menu (≡) in the top tab bar → Dev Tools. Toggles Chromium DevTools — does not open a pane. Was a widget-bar entry until PR #936. |
| **Subagent** | Spawned by clicking a sub-agent in the Swarm pane's overview. Not a top-level pane type the user opens directly. |

## Terminal

The terminal pane provides authentic terminal emulation powered by xterm.js and portable-pty on the backend.

Features:

- Real PTY with full ANSI support
- Configurable font family and size
- Per-pane zoom level (`Ctrl+/-` and `Ctrl+Scroll`)
- Shell-integration env block (`AGENTMUX_BLOCKID`, `AGENTMUX_LOG_DIR`, `AGENTMUX_AGENT_ID`, …) with helper functions like `muxlog`
- Remote connections (SSH)
- [Voice input](#voice-input) — dictate commands into the PTY via the mic button in the pane header

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

When you click inside the pane, the host fires `browser-pane-clicked` over the JS bridge, which the [reducer stack](/internals/reducer-stack/) routes through `refocusNode(blockId)` so keyboard shortcuts and split commands target the clicked pane. (DOM clicks don't bubble out of the embedded HWND, so the explicit IPC is necessary — this is the same pattern the [debugging](/internals/debugging/#reducer-dispatch-ring) page describes.)

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

## Editor

The editor pane is a [CodeMirror 6](https://codemirror.net/) workspace with a file-tree explorer down the left side. It covers quick edits, file viewing, and diffing inside a pane — it is not a standalone IDE; deep editing happens in your agent's terminal or via agent tool calls.

Languages currently get syntax highlighting via lazy-loaded extensions: TypeScript / JavaScript, Python, Rust, HTML, CSS, JSON, Markdown. Other extensions fall back to plain text. `Ctrl+S` / `Cmd+S` saves the current file; unsaved changes mark the pane title with `*`.

### File tree

The tree column appears on the left, **expanded by default**, with three "roots" — your `$HOME` (auto-expanded so you don't have to drill in) plus every other drive (Windows) or mount (macOS `/Volumes`, Linux `/mnt` and `/media`, plus `/` itself). The drive that hosts `$HOME` is de-duplicated so it doesn't appear twice — UNIX `/` is the exception, always shown so you can reach `/etc`, `/opt`, etc.

| Interaction | Behavior |
|---|---|
| Click a folder row | Expand if collapsed, collapse if expanded (lazy-loaded on first expand; cached after) |
| Click a file row | Loads it into the editor. The active file's row carries a `circle-dot` icon and a highlight |
| Hover the divider between tree and editor | Cursor flips to col-resize; drag to resize the tree column |
| Symlinked rows | Followed automatically (matches VS Code), marked with a `↗` overlay |

The tree column **width is persisted per pane** in block meta (`editor:tree_width`, default 240 px, range 150–600). The full tree's expand state is in-memory (collapsing a folder keeps its children cached so re-expand is instant).

### Header chevron

The pane header has a chevron next to the icon (`folder-tree` when expanded, `folder` when collapsed). Click it to hide the entire tree column and give CodeMirror the full pane width. The preference is **per pane** — `editor:tree_expanded` in block meta — so two editor panes in the same window can keep independent layouts (one tree-open for browsing, one full-width for diffs).

### Toolbar

Three small square buttons at the top of the tree, each with an **instant tooltip on hover** (zero delay — pure CSS reveal):

| Button | Type | Behavior |
|---|---|---|
| 👁 / 👁‍🗨 | toggle | Show / hide hidden files. Off by default — dotfiles, `node_modules`, `.DS_Store`, `Thumbs.db`, `$RECYCLE.BIN` are filtered out. Persisted per pane as `editor:show_hidden` |
| ⊟ | action | Collapse all folders to the top-level roots |
| 🔄 | action | Re-fetch every currently expanded folder. Preserves expansion state. There's no background watcher; this is the explicit refresh path |

### Open by path

A path-input affordance lives at the bottom of the tree column when no file is open — handy when an LLM hands you an absolute path and you don't want to navigate the tree to find it. Once a file is open, the input is hidden to give the tree more vertical space.

### What's not in the editor (yet)

The editor is intentionally scoped — see [`SPEC_EDITOR_FILE_TREE_2026-05-26.md`](https://github.com/agentmuxai/agentmux/blob/main/specs/SPEC_EDITOR_FILE_TREE_2026-05-26.md) for the design. Not currently supported (each item listed there as future phases):

- File watching for live tree updates — use the 🔄 button when something changes outside the app
- Rename / delete / new-file from the tree — happens in your agent or terminal
- Multi-root workspaces — single set of system roots is the only configuration
- LSP-style symbol navigation, autocomplete, diagnostics
- Tree-wide search / filter (the tree is read-only browse for now)

10 MB file-size cap on read and write — over that, the editor refuses to load.

## Agent

The agent pane runs an AI agent session. It displays:

- **Streaming text** — Agent output in real time
- **Tool calls** — Name, arguments, and result of each tool invocation
- **File diffs** — Visual diff overlay when the agent writes files
- **Auto-scroll** — Follows output, with manual scroll override
- **[Voice input](#voice-input)** — dictate prompts into the composer via the mic button in the pane header
- **Disconnected banner** — if the WebSocket tore down mid-turn, a banner appears at the top of the pane with a single action to reconnect. Dismissing it lands you in an idle state with the partial turn preserved.

Agent panes are configured through [Memory bundles](/memory/), accessible as a tab inside the agent pane (see Subsections below).

### Activity indicator

While an agent is actively streaming or tool-calling, the host signals the OS that the app is busy — Windows lights up the taskbar entry, macOS bounces the dock icon, Linux raises an urgency hint. The indicator clears as soon as the agent goes idle. Useful when you've shifted focus to another app and want to know when the agent has finished without polling the window.

Activity is tracked per-pane and aggregated across panes, so the indicator reflects "at least one agent is busy" not "this specific agent". Implementation detail in `frontend/app/store/agentActivity.ts`.

### Rendering performance

The agent message list is **virtualized**: only ~50 visible rows + 5-row overscan are mounted in the DOM at any moment, regardless of session length. A 2000-message session no longer means a 2000-element layout tree.

The virtualization is **hybrid** — the trailing 50 rows (the streaming buffer) are always mounted in normal flex flow, never recycled. Older rows are virtualized via `@tanstack/solid-virtual` with absolute positioning and per-row `ResizeObserver` measurement. This split eliminates measurement lag during token streams, which would otherwise cause visible jitter as text grew.

See [internals/agent-pane-virtualization](/internals/agent-pane-virtualization/) for the architecture and the spec at `docs/specs/SPEC_AGENT_PANE_VIRTUALIZATION_REDESIGN.md` in the main repo.

Runtime limits for agent panes are controlled by the `term:agentmaxruntimehours` and `term:agentidletimeoutmins` settings — see the [Settings Reference](/settings/#terminal-settings).

### Subsections

The agent pane has two built-in side panels, opened via the cog → settings panel:

- **Identity** — manage Identity bundles (named credential sets — GitHub PAT, AWS profile, Anthropic API key, …) for this agent instance. Backed by `frontend/app/view/identity/`, surfaced via `AgentIdentityPanel`. See [Identity](/identity/).
- **Memory** — manage Memory bundles (personality + capability stacks: provider, model, instructions, context files, MCP, skills) for this agent instance. Backed by `frontend/app/view/memory/`. See [Memory](/memory/). Replaces the older Forge concept; `view: "forge"` blocks are still redirected to `view: "agent"` by `block.tsx` for backward compatibility with already-persisted blocks.

Both open from inside an active agent pane — there are no widget-bar entries for them. The `view: "identity"` and `view: "memory"` registrations exist so `pane.open` RPC and right-click menus can still reach the views, but the primary path is the agent-pane subsection.

## Swarm

The Swarm pane provides a bird's-eye view of all agent activity. It has three tabs:

- **Overview** — Active and completed sub-agents across all agent sessions
- **History** — Past session metadata with message counts, models, token usage, and git branches
- **Search** — Full-text search across all agent sessions

Click any sub-agent in the overview to open a dedicated [Subagent](#subagent) pane.

## Subagent

A focused view of a single sub-agent's activity stream. **Not a widget-bar entry** — opened by clicking a sub-agent in the [Swarm pane's overview](#swarm). Shows:

- Agent ID and slug
- Status badge (active, completed, loading)
- Event count and last activity time
- Model being used
- Event stream: text output, tool uses, tool results, and progress updates

Subagent panes auto-scroll by default. Scroll up to pause, and a "scroll to bottom" button appears.

## Drone

The Drone pane is a visual **DAG-of-blocks** automation engine — compose a directed graph where each node is a reusable block, run it, and inspect results per block. Open it from the widget bar.

The name signals the pane's autonomous nature: a drone runs unattended on triggers, distinct from the interactive Agent pane.

### Block types

| Block | Purpose |
|---|---|
| **Variables** | Declare drone-scoped variables, read elsewhere via `{{var.name}}`. |
| **Agent** | Run an agent with a task prompt. Supports identity, memory, named-agent continuation, and working directory — the same controller the interactive Agent pane uses, invoked headlessly. |
| **API** | Make HTTP requests (GET/POST/PUT/PATCH/DELETE). URL and body support `{{...}}` interpolation. |
| **Condition** | Evaluate a boolean expression (e.g. `{{var.x}} > 10`); branches into true / false outputs. |
| **Response** | Terminal output block. Exactly one is required per drone — execution pauses until a Response is reached or an error occurs. |

### Authoring a drone

1. Click **New** to start a blank drone.
2. Click a block in the palette to add it to the canvas.
3. Shift-click a source node, then a target node, to connect them.
4. Click a node to open the inspector and configure its parameters.
5. **Save** to persist the drone to the backend.

### Running a drone

Click **Run**. The engine performs a topological sort over the DAG and executes blocks in dependency order, publishing `block_started` / `block_done` / `block_error` events on the `dronerun:<id>` SSE topic. The bottom **Runs** panel shows recent executions; the right-hand inspector shows the last result for whichever block is selected (for Agent blocks, the final response text and cost in USD if available).

### Known limitations

The Drone pane is on a Phase 2 roadmap that adds the following — they are **not** available yet:

- Drag-and-drop canvas (current canvas is click-to-add + Shift-click to connect)
- Triggers (cron / webhook / dependency / schedule)
- Subdrone invocation (one drone calling another)
- Function blocks (sandboxed JS via `quickjs-rs`)
- Streaming agent output live into the inspector (Phase 1.5 shows aggregated result only)
- Run cancellation / abort

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

## Voice input

Speak into a pane instead of typing. Voice input is supported on **Terminal** and **Agent** panes; other pane types don't surface the mic button.

### How it works

Each supporting pane shows a microphone button in the **top-right of the pane header**, next to the maximize and close buttons. Click it to start dictating into that pane:

- **Terminal panes** — the recognized text is streamed character-by-character into the PTY, exactly as if typed
- **Agent panes** — the recognized text appends to the composer textarea (interim phrases preview as you speak; finalized phrases commit). You still press Enter to send

The mic button pulses while listening. Clicking the mic on a **different** pane retargets the voice stream to that pane — only one pane receives output at a time. Clicking the active pane's mic again stops listening.

### Keyboard shortcut

| Action | Shortcut |
|---|---|
| Toggle voice on the focused pane | `Ctrl+Shift+V` |

The shortcut is a no-op on pane types that don't support voice (Browser, Editor, etc.).

### Settings

| Key | Type | Default | Effect |
|---|---|---|---|
| `voice:enabled` | bool | `true` | When `false`, hides the mic button across all panes |

Set in your [settings.json](/settings/) (the path varies by install vs dev mode — see the Settings page for the exact location). Useful if your browser blocks the Web Speech API or you don't want voice input enabled by default.

### Browser permission

Voice input uses the browser's built-in [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API). The first time you click the mic, Chromium prompts for microphone permission. If you deny it (or revoke it later), AgentMux shows a notification — re-enable it in browser settings to recover.

The Web Speech API is currently Chromium-only. AgentMux is built on Chromium so this works for all users; in non-Chromium browsers the mic button would simply not appear (`voice.isAvailable()` returns false).

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
