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

## Keyboard shortcuts

Because the embedded page is a native CEF child view and not DOM content, these shortcuts are intercepted at the CEF keyboard-handler layer rather than a JS `keydown` listener, so they work even while the page itself has focus:

| Shortcut | Action |
|---|---|
| <kbd>Ctrl+L</kbd> (<kbd>Cmd+L</kbd> on macOS) | Focus the address bar and select its contents |
| <kbd>Ctrl+R</kbd> (<kbd>Cmd+R</kbd> on macOS) | Reload the current page |
| <kbd>Alt+Left</kbd> | Go back |
| <kbd>Alt+Right</kbd> | Go forward |

<kbd>Ctrl+Shift+R</kbd> and <kbd>Ctrl+Shift+L</kbd> are left alone (not intercepted), so Chromium's own hard-reload chord still works. Reload/back/forward call straight into the same `BrowserPaneManager` methods the header buttons use via IPC; focusing the address bar round-trips through an event to the frontend (moving OS/DOM focus can only happen there), then hands off through the same click-to-focus path described below.

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

Clicking inside a browser pane also dismisses any open menu or popover elsewhere in the app — the More dropdown, status-bar popovers, tab context menus, and similar flyouts. This rides the same `browser-pane-clicked` event: a second, independent listener synthesizes a `mousedown`/`pointerdown` on the document body whenever the event fires, which every existing "click outside to dismiss" handler already reacts to. It doesn't replace the pane-selection consumer above — it's an additional subscriber to the same event.

Both `browser-pane-clicked` and right-click context-menu delivery (below) are implemented on Windows and macOS; Linux support is not yet in place, so pane click-to-select, the click-dismiss behavior, and the unified context menu don't apply there yet.

## Context menu

Right-clicking inside a browser pane shows **AgentMux's own context menu** — the same menu component every other pane type uses — instead of Chromium's native one. The native menu is suppressed at the CEF layer and replaced with the standard pane menu, extended with browser-specific items:

1. **Back** / **Forward** — disabled when there's nothing to go back/forward to
2. **Reload**
3. **Cut** / **Copy** / **Paste** — shown when the click is over a text selection or an editable field
4. **Copy Link Address** — shown when the click is over a link
5. **Print**
6. **View Page Source**
7. **Inspect Element**
8. The standard pane items — split up/down/left/right, replace, color, close — same as any other pane's context menu

If the menu can't be delivered to the pane's owning window for some reason, the pane falls back to Chromium's native menu rather than showing nothing.

## Pane-scope HTTP auth modal

When a page in the browser pane requests HTTP Basic Auth (or similar challenges), the credential prompt appears as a modal **scoped to just this pane**, not the whole app. Other panes stay interactive; you can keep typing in a terminal next door while the auth challenge is up. The pane that's locked is the only one that goes modal.

This is the same `ModalLayer` primitive the agent launch modal uses, parameterized over scope — the browser pane wraps its embedded `CefBrowserView` in a per-pane `ModalLayer`, so the lock region matches the pane bounds exactly. See [`SPEC_MODAL_LAYER_SCOPING`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs) for the underlying design.

## OAuth sign-in stays in-pane

Signing in via OAuth (Google Identity Services in particular) used to sometimes exit the entire AgentMux instance. The old code collapsed any popup a browser pane opened — including a sign-in popup — into the pane's own top-level browser; when the sign-in flow finished and called `window.close()`, it tore down what the pane thought was itself, which cascaded into the main window and could take the whole app down with it.

The fix lets a browser pane open a **real child popup** for sign-in flows, gated on two checks: the popup's destination must be a known identity-provider host, and the URL must look like an OAuth authorization request. A trusted popup shares the pane's browser/request context, so cookies, `window.opener`, and `postMessage` all behave normally, and closing the popup now only closes the popup. Anything else — a non-auth popup to an external site — opens in your system browser instead of hijacking the pane.

## Faster failure feedback

A load-timeout watchdog now bounds how long a browser pane will sit "still loading" before giving up — 20 seconds, well under Chromium's own multi-minute connect-timeout ceiling. If the page hasn't loaded by then, the pane shows a **human-readable error page** (in the style of Chrome's own "This site can't be reached" pages) instead of a raw Chromium error, with a Retry button. The same error-page rendering is used for genuine CEF load failures (DNS, TLS, blocked, etc.) and for the synthetic watchdog timeout, so failures look consistent regardless of cause. A redirect mid-navigation extends the tracked target URL but doesn't reset the 20 s deadline, so a long redirect chain can't be used to dodge the timeout.

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
- The [`SPEC_BROWSER_PANE_UNIFIED_CONTEXT_MENU_2026_08_15.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/SPEC_BROWSER_PANE_UNIFIED_CONTEXT_MENU_2026_08_15.md) spec in the main repo for the context-menu design
