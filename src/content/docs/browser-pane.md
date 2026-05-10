---
title: "Browser pane"
description: Native CefBrowserView embedded as a child window of the AgentMux frame — full Chromium fidelity, not an iframe.
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

The browser pane is a pinned widget (`Browser`, view `browser`). It embeds a native [`CefBrowserView`](https://bitbucket.org/chromiumembedded/cef/) — **not an iframe**. The pane's HWND sits as a child window of the AgentMux frame, which is why links, popups, OAuth flows, and DRM content all behave like they would in a regular Chromium tab.

## Opening a browser pane

- Click the **Browser** widget in the top bar (pinned by default).
- Right-click any pane header → Browser.
- Programmatically: `pane.open` with `view: "browser"`, `meta.url: "https://example.com"`.

Blank-spawned browser panes default to `https://agentmux.ai`. To get a literally blank pane, pass `meta.url = "about:blank"` explicitly.

## Header controls

| Control | Action |
|---|---|
| ← / → | Back / forward — enabled state syncs from the backend |
| ⟳ | Reload current page |
| Address bar | Enter URL or search query — defaults to a search if it doesn't parse as a URL |
| Go | Navigate to the address-bar value |

Title and favicon update from the embedded page automatically. Title is fetched from the page's `<title>`; favicon falls back to the `globe` icon if the page doesn't expose one.

## IPC commands

The host exposes the browser pane's lifecycle via these CEF commands (invoked through `invokeCommand` from the renderer):

| Command | Purpose |
|---|---|
| `browser_pane_create` | Instantiate the `CefBrowserView`; called on first mount |
| `browser_pane_navigate` | Load a URL |
| `browser_pane_resize` | Propagate Solid layout changes to the HWND |
| `browser_pane_reload` | Reload the current page |
| `browser_pane_focus` | Explicit focus handoff after a click |
| `browser_pane_close` | Tear down on pane close |

The frontend [`BrowserViewModel`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/view/browser/browser-model.ts) shows the canonical sequencing.

## Address-bar focus + click handoff

The address bar (a DOM input) and the embedded `CefBrowserView` (a child HWND) compete for keyboard focus. The pane's HWND intercepts clicks at the Win32 level, so the renderer does not see DOM `click` events from inside the page. Two consequences:

- Clicking the address bar releases pane focus to the input. IME state is preserved.
- Clicking back into the pane fires `browser_pane_focus` to hand keyboard focus back to the embedded HWND.

The address-bar input uses `onMouseDown` (not `onMouseEnter`) for the click-to-focus handoff. Hover-focus loops were the original failure mode this design corrects.

## Click → reducer flow

When you click inside the browser pane, the host fires `browser-pane-clicked` over the JS bridge. The frontend's browser-pane reducer (slice #9) dispatches a `Clicked` command, which emits a `focus-block` event. A saga turns the event into `refocusNode(blockId)`, updating the layout's focus state so keyboard shortcuts and split commands target the clicked pane.

DOM clicks don't bubble out of the embedded HWND, so the explicit IPC is necessary. See [Reducer stack](/internals/reducer-stack/) for the broader pattern.

## Per-pane state

Each browser pane owns its own:

- URL and navigation history (back/forward stack)
- Title, favicon
- Loading / error state
- Scroll position (restored across pane moves)

State persists across pane moves between tabs and windows — drag a browser pane to a new tab and the page keeps loading.

## Browser-pane reducer (slice #9)

The browser pane is the subject of the in-flight reducer slice migration (frontend slice #9). Recent commits (`e3173631`, `ba843501`, `4cd960b2`, `540b1f4a`) move per-pane state cells (closed/loading/error → canGoBack/canGoForward → title) into the reducer model. See [Reducer stack](/internals/reducer-stack/) for the slice list and migration plan.

## See also

- [Pane types](/pane-types/) — full pane catalog
- [Reducer stack](/internals/reducer-stack/) — slice #9 status
- [Architecture overview](/internals/architecture/) — host / sidecar / renderer split
