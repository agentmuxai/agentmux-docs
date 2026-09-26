---
title: "Browser pane"
description: A Chromium browser embedded in an AgentMux pane through CEF — not an iframe — with bookmarks, a start page, per-pane camera and microphone grants, and HTTP sign-in prompts.
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

The browser pane (view `browser`) embeds a real Chromium browser through CEF, **not an iframe**. Sites load with their own cookies, storage and scripts, the same as in a Chromium tab.

How it is embedded depends on the platform:

- **Windows:** a CEF browser window placed as a child window inside the AgentMux window (`agentmux-cef/src/browser_pane/creation.rs`).
- **macOS and Linux:** a CEF browser view laid over the AgentMux window (`agentmux-cef/src/browser_pane/creation_views.rs`).

Some things differ from a normal browser tab:

- Links that open in a new tab (`target="_blank"`) load in the same pane.
- Popups to other web sites open in your system browser, except sign-in popups (see [Sign-in popups](#sign-in-popups)).
- The pane won't navigate to `file:` URLs or other schemes that would hand off to the operating system.

## Opening a browser pane

The Browser widget is **not pinned** to the widget bar by default (`agentmux-srv/src/config/widgets.json`, `defwidget@browser`).

- Click **more** at the end of the widget bar and choose **Browser**. Right-click it there and choose **Pin to bar** to keep it in the bar.
- Click **+** on any pane's tab strip and pick **Browser** to open it as a tab in that pane.
- Right-click a pane header → **Replace With...** → **Browser** replaces that pane.
- From an AgentMux terminal: `muxsh web <url>` opens the URL in a browser pane split to the right of the terminal (`--split left|down|up` to change that, `--floating` for a floating window, `--title` to name it). The URL is completed the same way as in the address bar, and the new pane is focused with the keyboard in the page unless you pass `--no-focus` (`agentmux-srv/src/backend/shellintegration/muxsh.mjs`).
- From the App API: `pane.open` with `view: "browser"` and a `url`, which is required for this view.

The **Messengers** widget (Discord, Slack, Telegram, WhatsApp, Teams) opens browser panes too, with the navigation bar hidden.

### Start page

A new browser pane opens its configured URL if it has one, otherwise your start page, otherwise `https://agentmux.ai` (`frontend/app/view/browser/browser-model.ts`). To choose your start page, see [Bookmarks and start page](#bookmarks-and-start-page). For a blank pane, open `about:blank`.

## Navigation bar

| Control | Action |
|---|---|
| ← / → | Back / Forward. Disabled when there's nowhere to go. |
| ↻ | Reload |
| Bookmark icon | Opens the [bookmarks menu](#bookmarks-and-start-page) |
| Address bar | Enter a URL or search terms ("Enter URL or search...") |
| → (Go) | Load the address-bar value |

The address bar keeps anything starting with `http://`, `https://` or `about:`. Otherwise, if what you typed contains a dot and no spaces, `https://` is added in front. Anything else is sent to Google search. Type the scheme for addresses without a dot, e.g. `http://localhost:3000`.

The pane title follows the page title, and shows the host name while a page is loading. The pane icon is the site's favicon, or a globe when the site has none.

## Keyboard shortcuts

These shortcuts are handled by AgentMux itself (`agentmux-cef/src/client/handlers.rs`), so they work while the page has focus. The page doesn't receive them.

| Shortcut | Action |
|---|---|
| `Ctrl+L` (`Cmd+L` on macOS) | Focus the address bar and select its contents |
| `Ctrl+R` (`Cmd+R` on macOS) | Reload |
| `Alt+Left` | Back |
| `Alt+Right` | Forward |

With `Shift` held (for example `Ctrl+Shift+R`), AgentMux doesn't intercept these keys and leaves them to Chromium. There is no find-in-page (`Ctrl+F`), and the browser has no page tabs of its own; use [pane tabs](/pane-types/) instead.

A new browser pane that opens as the selected pane puts the keyboard straight into the page as soon as the page is created, unless you have already clicked into its address bar. Clicking in the page gives it the keyboard; clicking AgentMux's own interface takes it back. On macOS, typing into a browser pane works this way since AgentMux 0.57.5.

**Zoom:** on Windows, `Ctrl`+scroll zooms just that browser pane (50%–200%); the zoom lasts until the pane is closed or moved. On macOS and Linux, `Ctrl`+scroll uses Chromium's own page zoom, which applies to every pane showing the same site.

## Bookmarks and start page

The bookmark button next to Reload opens a menu (`frontend/app/view/browser/browser-nav-bar.tsx`). While a page is loaded it shows:

- **Set as Start Page** (reads **This Is Your Start Page** when the current page already is);
- **Bookmark This Page**, or **Remove Bookmark** if the page is already bookmarked;
- your bookmarks, each with its favicon and title. Click one to open it. With none saved, the list shows **No bookmarks yet**.

There is no bookmarks bar. To remove a bookmark, open that page and choose **Remove Bookmark**.

Bookmarks and the start page are shared by every browser pane and every AgentMux channel on your machine. They are stored in `~/.agentmux/shared/browser-bookmarks.json` and `~/.agentmux/shared/browser-start-page.json`.

## Camera, microphone and screen sharing

When a page asks for the camera, microphone or screen, AgentMux shows a prompt in the AgentMux window, not inside the page (`agentmux-cef/src/browser_panes/media_grants.rs`, `frontend/app/window/pane-media-permission-prompt.tsx`):

- The prompt reads "*site* wants to use your camera" (or microphone, screen contents, system audio), with **Allow** and **Don't allow**. `Esc` or clicking outside it means Don't allow.
- A prompt left unanswered for 60 seconds is denied.
- A grant covers one site in one pane, and only the devices it asked for. It lasts until the pane is closed or moved to another window; nothing is saved to disk.

While a page is capturing, a red **Camera in use**, **Microphone in use** or **Camera and microphone in use** indicator appears at the bottom-right of the window. Its **Stop** button asks you to confirm ("Stop camera and microphone access?", **Stop and reload**), then removes all of that pane's grants and reloads the page to end the capture.

Limitations:

- Prompts only appear in regular AgentMux windows. A browser pane in a [floating window](/pane-types/#floating-panes) doesn't show the prompt, so its request is denied after 60 seconds.
- The packaged macOS app declares microphone access for the operating system but not camera access, so macOS may block camera use.

## Sign-in prompts (HTTP authentication)

When a site or proxy asks for HTTP authentication, a sign-in dialog appears over that pane only; the rest of AgentMux stays usable (`frontend/app/view/browser/components/BrowserAuthModal.tsx`). It shows "*origin* says: *realm*", **Username** and **Password** fields, a **Save this credential** checkbox (off by default), and **Cancel** / **Sign in**.

A saved credential goes to your operating system's keychain, filed under the agent identity linked to the pane. If the pane has no linked agent identity, nothing is saved.

When a saved credential matches a later request, AgentMux asks before using it, in a small separate window: "Use saved sign-in?" with **Approve** and **Deny**. This means an agent controlling the pane never sees the password. The request is denied if you don't answer within 60 seconds. If the site asks again within 15 seconds of an automatic sign-in, AgentMux deletes the saved credential and shows the manual dialog instead.

There is no screen for listing or deleting saved credentials.

## Sign-in popups

When a page opens a sign-in popup, AgentMux opens a real popup window only when both of these are true (`agentmux-cef/src/client/lifecycle.rs`, `on_before_popup`):

- the popup's host is a known sign-in provider, such as Google, GitHub, Microsoft, Apple, Okta or Auth0;
- its URL looks like an OAuth authorization request.

The popup shares the pane's cookies and session, so the page's sign-in completes normally, and closing the popup closes only the popup. Other popups to web sites open in your system browser; any other popup is blocked.

## Load failures

If a page hasn't loaded after 20 seconds, the pane stops waiting and shows an error page in the style of Chrome's "This site can't be reached", with a **Retry** button. Redirects don't reset the 20-second limit. Other load failures (DNS, TLS, blocked requests) use the same error page. The pane never retries on its own.

## Context menu

Right-clicking inside a page shows AgentMux's menu instead of Chromium's (`frontend/app/view/browser/browser-model.ts`, `getBodyContextMenuItems`):

1. **Back**, **Forward**, **Reload**
2. **Cut**, **Copy**, **Paste**, when you right-click a selection or a text field
3. **Copy Link Address**, over a link
4. **Print**, **View Page Source**, **Inspect Element**
5. The standard pane items: **Copy**, **Split Up/Down/Left/Right**, **Replace With...**, **Magnify Pane**, **Close Pane**, and a second **Inspect Element**

The first **Inspect Element** opens Chromium DevTools for the page at the element you clicked. The second, from the standard pane items, inspects AgentMux's own interface instead. **View Page Source** shows the source in the same pane, as a normal history entry.

If the menu can't be shown, you get Chromium's native menu instead.

## Platform differences

- **Selecting a pane by clicking in the page** works on Windows and macOS. On Linux, clicking inside a page doesn't make that pane the focused pane and doesn't close open AgentMux menus; click the pane's header instead.
- **Menus over a page:** a web page draws on top of AgentMux's own menus unless AgentMux makes room. On Windows and macOS, AgentMux cuts the menu's area out of the page (on macOS since AgentMux 0.57.5; before that, the right-click menu opened behind the page). On Linux, AgentMux hides the page and shows a still screenshot of it while the menu is open. `Esc` or a click in the page closes the menu.

## Dragging over a browser pane

When you drag a pane, a pane tab or a window tab over a browser pane, the page is replaced by a still snapshot of itself for the duration of the drag, so the drop preview shows and the drop lands, including a tab dropped onto the page (`frontend/app/view/browser/browser-view.tsx`). This works on every platform.

## What a pane keeps

Only the current URL is saved with the pane. Switching to another window tab and back keeps the page as it was. So does switching between pane tabs in the same pane: a browser tab stays loaded while another tab is showing, keeping its scroll position, form input, zoom and history (`frontend/app/view/browser/browser.tsx`, `lifecycle: "keepAlive"`). Moving a browser pane to another window creates a fresh browser at the saved URL, so the page reloads and its back/forward history, scroll position, zoom and camera/microphone grants are lost.

## Driving the browser from an agent

Agents can control a browser pane with the `Browser*` MCP tools: navigate, back, forward, reload, run JavaScript in the page, type into and focus elements, and read which element has focus. The navigation and JavaScript tools only work on the calling agent's own pane, and only when that pane is a browser pane. These tools use Chromium's DevTools protocol on the CEF remote-debugging port. Each pane resolves to its own page even when two browser panes show the same URL (`agentmux-cef/src/browser_api/resolver.rs`). See [Agent App API](/internals/agent-app-api/) for the tool reference.

## Internals

The renderer controls each browser pane through host IPC commands (`agentmux-cef/src/ipc.rs`). Examples: `browser_pane_create`, `browser_pane_navigate`, `browser_pane_resize`, `browser_pane_go_back`, `browser_pane_go_forward`, `browser_pane_reload`, `browser_pane_focus` and `browser_pane_close`. Other IPC commands handle printing, view-source, inspect, clipboard and the authentication prompt. Agents don't use these commands.

Per-pane browser state (URL, title, favicon, loading and error state, back/forward availability) lives in a reducer (`frontend/app/store/browser-pane-state/reducer.ts`, wrapped per pane by `frontend/app/store/browser-pane-state-store.ts`); the view model reads it from there. On Windows and macOS, a click inside the page sends a `browser-pane-clicked` event. The reducer turns it into a focus change for that pane, and a separate listener closes any open menus. See [Reducer stack](/internals/reducer-stack/).

On Windows and macOS, the address bar and the page compete for keyboard focus at the OS level. Pressing the mouse on the address bar moves OS focus back to the AgentMux window before the text field takes focus, so typed characters go to the address bar and not to the page.

## See also

- [Pane types](/pane-types/) — full pane catalog
- [Reducer stack](/internals/reducer-stack/) — the browser-pane reducer
- [Architecture overview](/internals/architecture/) — host / sidecar / renderer split
- `docs/specs/SPEC_BROWSER_PANE_UNIFIED_CONTEXT_MENU_2026_08_15.md` in the main repo — the context-menu design
