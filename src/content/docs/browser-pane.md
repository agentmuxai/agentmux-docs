---
title: "Browser pane"
description: A Chromium browser embedded in an AgentMux pane through CEF — not an iframe — with address-bar suggestions, profiles and Incognito tabs, bookmarks, a Home page, per-site page zoom, downloads, per-pane camera and microphone grants, HTTP sign-in prompts, and the controls you keep over an agent that drives the pane.
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

The browser pane (view `browser`) embeds a real Chromium browser through CEF, **not an iframe**. Sites load with their own cookies, storage and scripts, the same as in a Chromium tab.

How it is embedded depends on the platform:

- **Windows:** a CEF browser window placed as a child window inside the AgentMux window (`crates/cef/src/browser_pane/creation.rs`).
- **macOS and Linux:** a CEF browser view laid over the AgentMux window (`crates/cef/src/browser_pane/creation_views.rs`).

Some things differ from a normal browser tab:

- A link that opens a new tab (`target="_blank"`) opens as a **pane tab in the same pane** when you click it and it stays on the page's own site. A link to another site loads in the current tab. See [New windows and popups](#new-windows-and-popups).
- Popups to other web sites open in your system browser, except sign-in popups and popups from the page's own site (see the same section).
- The pane won't navigate to `file:` URLs or other schemes that would hand off to the operating system.
- A browser pane can't be made narrower than 250 px.

## Opening a browser pane

- Click **Browser** in the widget bar. It is pinned by default (`crates/srv/src/config/widgets.json`, `defwidget@browser`); if you've unpinned it, click **more** at the end of the widget bar and choose **Browser**.
- Click **+** on any pane's tab strip and pick **Browser** to open it as a tab in that pane.
- Press `Ctrl+Shift+K` (`⌃⇧K` on macOS) to replace the focused pane with a [Shortcuts pane](/pane-types/#the-shortcuts-pane), then choose **Browser**.
- From an AgentMux terminal: `muxsh web <url>` opens the URL in a browser pane split to the right of the terminal (`--split left|down|up` to change that, `--floating` for a floating window, `--title` to name it). The URL is completed the same way as in the address bar, and the new pane is focused with the keyboard in the page unless you pass `--no-focus` (`crates/srv/src/backend/shellintegration/muxsh.mjs`).
- From MuxAPI: `pane.open` with `view: "browser"` and a `url`, which is required for this view.

The **Messengers** widget (Discord, Slack, Telegram, WhatsApp, Teams) opens browser panes too, with the navigation bar hidden.

### Home page

A new browser pane opens its configured URL if it has one, otherwise your Home page, otherwise `https://agentmux.ai` (`frontend/app/view/browser/browser-model.ts`). To choose your Home page, see [Bookmarks and Home page](#bookmarks-and-home-page). For a blank pane, open `about:blank`.

## Navigation bar

| Control | Action |
|---|---|
| ← / → | Back / Forward. Disabled when there's nowhere to go. |
| ↻ | Reload. While a page is loading it becomes ✕ (**Stop loading**), and a press stops the load. |
| Home (house icon) | Opens your Home page. Right-click it for **Set this page as Home**. |
| Address bar | Enter a URL or search terms ("Enter URL or search..."). `Enter` loads it; there is no Go button. |
| Bookmark icon | Opens the [bookmarks menu](#bookmarks-and-home-page) |
| Profile button | Shows who the tab is browsing as, and opens a new tab as someone else. See [Profiles and Incognito](#profiles-and-incognito). |

The bookmark and profile buttons sit at the right end, bookmarks just left of profile. In a pane narrower than about 390 px the buttons stay in one row and the address bar takes a full-width row under them. `Ctrl`+scroll over the toolbar zooms AgentMux's own interface, not the page (see [Zoom](#zoom)).

Clicking into the address bar selects the whole address, as in Chrome, so typing replaces it. A second click places the cursor, and a drag selects just what you drag over.

### Suggestions as you type

The address bar suggests as you type, from Chrome's own engine:

- your history and the addresses you typed before, with the best match completed inline (type `git` and it may complete to `github.com`);
- a "search for what you typed" entry;
- your search engine's suggestions.

Use the arrow keys to move through the list; the address bar shows the highlighted entry. `Enter` opens the highlighted entry, or the engine's best match when nothing is highlighted. `Esc` closes the list and puts back what you typed. Leaving the address bar without choosing shows the page's own address again.

Asking your search engine for suggestions sends it what you type before you press Enter, as Chrome does. It's on by default. To keep suggestions to this computer (your history and typed addresses), turn off **Settings ▸ Browser ▸ Search suggestions while typing** (`browser:searchsuggestions`). Incognito tabs never ask the search engine, as in Chrome.

If suggestions aren't available, the address bar keeps anything starting with `http://`, `https://` or `about:`. Otherwise, if what you typed contains a dot and no spaces, `https://` is added in front. Anything else is sent to Google search.

The pane title follows the page title, and shows the host name while a page is loading. The pane icon, and the icon on the pane's tab, is the site's favicon. A generic globe stands in when the site has none, or when its icon fails to load, so the slot is never blank. After the first paint, a small loading mark shows in the top-right corner of the page while it loads.

## Keyboard shortcuts

These shortcuts are handled by AgentMux itself (`crates/cef/src/client/handlers.rs`), so they work while the page has focus. The page doesn't receive them.

| Shortcut | Action |
|---|---|
| `Ctrl+L` (`Cmd+L` on macOS) | Focus the address bar and select its contents |
| `Ctrl+R` (`Cmd+R` on macOS) | Reload |
| `Alt+Left` | Back |
| `Alt+Right` | Forward |
| `Alt+Home` | Home page |
| `Ctrl+Shift+N` (`Cmd+Shift+N` on macOS) | Open a new [Incognito tab](#profiles-and-incognito) in this pane |

`Ctrl+Shift+N` opens an Incognito tab whether the page, the address bar or the toolbar has the keyboard. Outside a browser pane, the same keys open a new AgentMux window. Apart from `Ctrl+Shift+N`, with `Shift` held (for example `Ctrl+Shift+R`), AgentMux doesn't intercept these keys and leaves them to Chromium. There is no find-in-page (`Ctrl+F`), and the browser has no page tabs of its own; use [pane tabs](/pane-types/) instead.

A new browser pane that opens as the selected pane puts the keyboard straight into the page as soon as the page is created, unless you have already clicked into its address bar. Clicking in the page gives it the keyboard; clicking AgentMux's own interface takes it back. On macOS, typing into a browser pane works this way since AgentMux 0.57.5.

## Zoom

`Ctrl`+scroll over the page is Chromium's per-site page zoom, as in Chrome:

- The zoom belongs to the site (its host) and the profile. Every pane on that site in that profile shares it, and a page opens at its zoom with no flash at 100% on each navigation.
- It is kept with the profile, so Personal and your own profiles keep it across a restart. An Incognito tab forgets it when it closes.
- On Windows a step is 5%, between 50% and 200%. On macOS and Linux Chromium's own steps apply.

`Ctrl`+scroll over the toolbar or the pane header zooms AgentMux's own interface instead (see [Zoom system](/internals/zoom/)). AgentMux doesn't take the keyboard zoom keys (`Ctrl+=`, `Ctrl+-`, `Ctrl+0`) from a focused page. The Browser pane is the one pane that doesn't use AgentMux's own pane zoom.

## Bookmarks and Home page

The bookmark button next to Home opens a menu (`frontend/app/view/browser/browser-nav-bar.tsx`). While a page is loaded it shows:

- **Set as Home Page** (reads **This Is Your Home Page** when the current page already is);
- **Bookmark This Page**, or **Remove Bookmark** if the page is already bookmarked;
- your bookmarks, each with its favicon and title. Click one to open it. With none saved, the list shows **No bookmarks yet**.

There is no bookmarks bar. To remove a bookmark, open that page and choose **Remove Bookmark**.

Bookmarks and the Home page are shared by every browser pane and every AgentMux channel on your machine. They are stored in `~/.agentmux/shared/browser-bookmarks.json` and `~/.agentmux/shared/browser-start-page.json`.

## Profiles and Incognito

Every browser tab browses as one identity, which never changes. The **Profile** button in the toolbar names it and opens a menu (`frontend/app/view/browser/browser-profile-menu.tsx`):

- **Open new Incognito tab** (`Ctrl+Shift+N`, `Cmd+Shift+N` on macOS);
- **Personal**, and each profile you created;
- **New profile…**, which asks for a name and a colour in a dialog that covers only this pane, so the rest of AgentMux stays usable while it is open;
- **Manage profiles…**, which opens **Settings ▸ Browser** in the window you clicked in.

Choosing an entry opens a **new tab in the same pane**, at the current page (or your Home page), as that identity. The tab you were on stays as it was.

- **Personal** is the identity every tab starts with: your saved sign-ins.
- **A profile** keeps its own sign-ins, cookies and site data on disk, apart from Personal and the other profiles, so one site can be open as two accounts side by side. Create one from **New profile…**. A new profile opens at your Home page, since it is signed in nowhere. Rename, recolour, delete and allow agents to use them in **Settings ▸ Browser**.
- **An agent's browser pane** (`Browser` `open`) browses as your Personal profile by default for an agent on your computer, and in a fresh Incognito jar for a container agent. The answer to `open` says which one the pane got, and its `profile` argument picks another.
- **An Incognito tab** has its own cookie jar, separate from your normal browsing and from every other Incognito tab. Nothing is saved, and it's gone when the tab closes.

An agent can browse as a profile only if you switch on **Agents may use it** for that profile in Settings ▸ Browser.

## Camera, microphone and screen sharing

When a page asks for the camera, microphone or screen, AgentMux shows a prompt in the AgentMux window, not inside the page (`crates/cef/src/browser_panes/media_grants.rs`, `frontend/app/window/pane-media-permission-prompt.tsx`):

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

## New windows and popups

What a page gets when it asks for a new window depends on what it asked for. A new window is only opened inside AgentMux when you caused it with a click or key press, it is an `http` or `https` page, and either it is on the same site as the page that opened it or an agent owns the pane. A pane may have at most 8 popup windows and 8 popup panes open at once (`crates/common/src/popup_rules.rs`, `crates/cef/src/client/popup_route.rs`).

| The page asks for | If it is allowed | If not |
|---|---|---|
| A new tab (`target="_blank"`, `window.open(url)`, a middle-click) | Opens as a **pane tab in the same pane** | The link loads in the current tab |
| A new window (shift-click, some `window.open` calls) | Opens as a browser pane beside this one | Opens in your system browser |
| A popup (`window.open` with a size or `popup` features) | Opens as a real popup window | Opens in your system browser |

A sign-in popup is always a real popup window, even when it is on another site. It must be a popup, go to a known sign-in provider such as Google, GitHub, Microsoft, Apple, Okta or Auth0, and its URL must look like an OAuth authorization request. The popup shares the pane's cookies and session, so the page's sign-in completes normally, and closing the popup closes only the popup.

A popup window is listed in a strip under the toolbar ("Popup window: *address*") with **Show** and **Close**. A page on this computer (a local dev server) can open a new window only to its own address, and never to one of AgentMux's own. In a pane an agent limited to some sites, a popup to another site waits for your **Allow** in the pane.

## Load failures

If a page hasn't loaded after 20 seconds, the pane stops waiting and shows an error page in the style of Chrome's "This site can't be reached", with a **Retry** button. Redirects don't reset the 20-second limit. Other load failures (DNS, TLS, blocked requests) use the same error page. The pane never retries on its own. The address bar keeps showing the address that failed, and that is the address the pane saves, so a restored pane tries the same page again.

## Downloads

A download starts the operating system's **Save As** dialog, named after the file, in the folder you saved to last (the Downloads folder the first time). The page never chooses where a file goes. Cancel the dialog and nothing is saved.

Once you save, a strip under the toolbar lists the download (`crates/cef/src/client/downloads.rs`, `frontend/app/view/browser/download-strip.tsx`):

- while it runs, its name and progress, with **Cancel**;
- when it is saved, the word "saved" and **Show in folder**, which reveals the file in your file manager;
- if it fails, the reason in words. Nothing is retried; the page's link is still there.

A finished line folds away after about 20 seconds, and **Hide** removes any line that has ended. A page that starts many downloads at once gets one line saying the extras were ignored. The strip is part of AgentMux's pane, outside the page, so a page can't imitate it.

## Context menu

Right-clicking inside a page shows AgentMux's menu instead of Chromium's (`frontend/app/view/browser/browser-model.ts`, `getBodyContextMenuItems`):

1. **Back**, **Forward**, **Reload**
2. **Cut**, **Copy**, **Paste**, when you right-click a selection or a text field
3. **Copy Link Address**, over a link
4. **Print**
5. **View Page Source** and **Inspect Element**, only with **Dev mode** on (**Settings ▸ Advanced**; on by default in a development build, off in the installed app)
6. The standard pane items: **Copy**, **Split Down**, **Split Right**, **Magnify Pane**, **Minimize to Header** (when the tab has other panes), **Close Pane**, and, with Dev mode on, a second **Inspect Element**

With Dev mode on, the first **Inspect Element** opens Chromium DevTools for the page at the element you clicked. The second, from the standard pane items, inspects AgentMux's own interface instead. **View Page Source** shows the source in the same pane, as a normal history entry.

If the menu can't be shown, you get Chromium's native menu instead.

## Platform differences

- **Selecting a pane by clicking in the page** works on Windows and macOS. On Linux, clicking inside a page doesn't make that pane the focused pane and doesn't close open AgentMux menus; click the pane's header instead.
- **Menus over a page:** a web page draws on top of AgentMux's own menus unless AgentMux makes room. On Windows and macOS, AgentMux cuts the menu's area out of the page (on macOS since AgentMux 0.57.5; before that, the right-click menu opened behind the page). On Linux, AgentMux hides the page and shows a still screenshot of it while the menu is open. `Esc` or a click in the page closes the menu.

## Dragging over a browser pane

When you drag a pane, a pane tab or a window tab over a browser pane, the page is replaced by a still snapshot of itself for the duration of the drag, so the drop preview shows and the drop lands, including a tab dropped onto the page (`frontend/app/view/browser/browser-view.tsx`). This works on every platform.

## What a pane keeps

Only the current URL is saved with the pane. Switching to another window tab and back keeps the page as it was. So does switching between pane tabs in the same pane: a browser tab stays loaded while another tab is showing, keeping its scroll position, form input and history (`frontend/app/view/browser/browser.tsx`, `lifecycle: "keepAlive"`). Moving a browser pane to another window creates a fresh browser at the saved URL, so the page reloads and its back/forward history, scroll position and camera/microphone grants are lost. Its [zoom](#zoom) isn't: that belongs to the site and the profile.

A pane that stays out of sight for a while (30 minutes by default) goes to sleep to free its memory, and loads again when you are about to look at it. Panes an agent is using never sleep. See **Hibernate hidden browser panes** in [Browser settings](/settings/#browser-settings).

## Driving the browser from an agent

Agents control a browser pane with the `Browser` MCP tool. It works on a browser pane the agent opened itself (`Browser` `open`) and on the agent's own pane when that is a browser pane, never on a pane the agent didn't open or one you took over. An agent reads a page as a snapshot, an accessibility tree with a reference on each element it can act on, and acts by reference: click, fill, select, check, upload files, navigate, wait for text. These actions drive Chromium's DevTools protocol inside the AgentMux process, not over the remote-debugging port, so they work with that port off (`crates/cef/src/browser_api/cdp.rs`). Each pane resolves to its own page even when two browser panes show the same URL (`crates/cef/src/browser_api/resolver.rs`). See [MuxAPI](/internals/muxapi/) for the tool reference.

### The strip over a driven pane

A pane an agent drives shows a strip under the toolbar: **Driven by** the agent's name, and **Limited to N sites** when the agent opened it for some sites only. Its buttons:

| Button | What it does |
|---|---|
| **Log (n)** | Lists what the agent did here, newest first: each action, how it went (allowed, approved, auto-approved, declined, refused) and the page. It works while the pane is paused, and stays after you take over. |
| **Pause** / **Resume** | Holds the agent's actions in this pane until you resume. Auto-approve's clock stops too. |
| **Auto-approve** | Lets the agent's clicks go through without asking, for a while. See below. |
| **Take over** | Ends the agent's control of this pane; its next action here fails. |

### Asking you, and Auto-approve

- **Hand-offs.** For a sign-in, a two-factor code, a CAPTCHA, payment details or any field marked secret, the agent hands the pane to you. A banner says what it needs; click **Done** when you have finished.
- **Committing clicks.** A click that submits a form or is named like Submit, Send, Pay, Delete or Confirm waits for you in the pane. The banner shows what the agent wants to do, the form's fields and where they go, with **Approve** and **Cancel**.
- **Auto-approve.** For a run of clicks you have asked for, choose **Auto-approve** in the strip, then **15 min**, **1 hour** or **4 hours** and **Turn on auto-approve**. Only a pointer click turns it on. For that time, on the sites the pane shows, the agent's clicks that submit, delete or send go through without asking, and so does the page's own "Are you sure?" that follows one. It still can't type passwords or codes or run scripts, and payments still ask. The strip turns red and reads **Auto-approve on** with the time left; **Stop auto-approve** ends it. If the page leaves the granted sites, auto-approve pauses until it returns.
- **The agent can ask.** An agent can ask you to turn auto-approve on, with a reason, for 15, 60 or 240 minutes. The banner offers **Allow auto-approve**, **Always for *agent* on this site** and **No**.

### Standing powers

**Always for *agent* on this site** keeps the grant. It adds a row to **Settings ▸ Browser ▸ Agents on sites**, and from then on that agent's requests for that site are granted at once, with no banner. The strip says "always, until you revoke it in Settings" instead of a time left. **Pause** and **Take over** still work in the pane; **Revoke** in Settings ends the row itself.

**Agents on sites** lists each row with the agent, the site, when you granted it, and its powers: **Committing clicks** (always on) and, as a checkbox, **Terminal: type and run commands**. **Revoke** ends a row at once, and a call in flight stops. To add one, choose an agent, type a site such as `shell.example.com`, tick **Terminal** if you want it, and click **Allow**. Under **Consoles, with the terminal**, **Google Cloud Shell** and **Azure Cloud Shell** add the sites those consoles use for the agent you chose. Only your own window writes these rows (or your answer **Always** on a request); no agent can.

### Web terminals

With the **Terminal** power on a site, an agent can type into a web terminal there, such as Google Cloud Shell, and read what it prints (`Browser` `terminal`). It types real keys, one at a time, and presses Enter after each line, with no question per line, so nobody checks each command: you can read every line in the pane's Log, and **Pause** and **Take over** end it at once. It works only on a site that has the grant, and only with terminals built on xterm.js. AgentMux won't type text that looks like a credential. Passwords and codes stay yours to type, so run commands that may ask for one (an `ssh` to another host, say) yourself. What the terminal prints goes back to the agent only and is not written to the Log.

### Secrets on a page

A card, bank or ID number, a security code or a one-time code a page prints, and the value of a field for one, are hidden from everything the agent reads, shown as `[card number hidden]` or `[code hidden]`. A secret a page shows only once, such as a new client secret next to a Copy button, is hidden from the agent's snapshots and screenshots too, including when the page splits it over highlighted text. The agent sees a placeholder, and can use `Browser` `capture` to save it straight into the [Vault](/vault/): it gets the new entry's id, never the value, and the entry keeps the page's address. With `download`, the agent names the button that downloads a file shown once, such as a GitHub App's private key; AgentMux clicks it and keeps the file's text in the Vault as a note without writing it to disk. Saving a new entry asks nobody, since nothing leaves the Vault; replacing an existing entry's value asks you each time.

### Uploading files, forms and frames

- **Uploads.** `set_files` puts files into a file input, and also works on the button or label that opens a page's file chooser (a hidden input, or one the page makes on click). A snapshot lists hidden file inputs as `file input (hidden)`. Up to 10 files and 25 MB in all, from the agent's own workspace, and every upload is logged.
- **Frames.** A snapshot waits briefly for iframes that are still loading, so a step that loads inside a frame isn't read as empty. References inside a frame look like `f1e3`. In a pane limited to some sites, frames from other sites show their contents with no references.

### Pause all agent browsing

An emergency stop for every pane an agent drives. While it is on, each of those panes refuses every call the agent makes, and the clocks of Auto-approve grants stand still. Turn it on or off with:

- the **Pause all agent browsing** switch in **Settings ▸ Browser**;
- **Pause all agent browsing** and **Resume agent browsing** in the command palette;
- the status bar, which shows **Agent browsing paused by you. Resume** while it is on, and resumes with one click.

It stays on after a restart until you turn it off. A pane's strip reads "Paused for every pane" while it is on, and **Resume** there turns it off for every pane. No agent can turn it on or off.

## Internals

The renderer controls each browser pane through host IPC commands (`crates/cef/src/ipc.rs`). Examples: `browser_pane_create`, `browser_pane_navigate`, `browser_pane_resize`, `browser_pane_go_back`, `browser_pane_go_forward`, `browser_pane_reload`, `browser_pane_focus` and `browser_pane_close`. Other IPC commands handle printing, view-source, inspect, clipboard and the authentication prompt. Agents don't use these commands.

Per-pane browser state (URL, title, favicon, loading and error state, back/forward availability) lives in a reducer (`frontend/app/store/browser-pane-state/reducer.ts`, wrapped per pane by `frontend/app/store/browser-pane-state-store.ts`); the view model reads it from there. On Windows and macOS, a click inside the page sends a `browser-pane-clicked` event. The reducer turns it into a focus change for that pane, and a separate listener closes any open menus. See [Reducer stack](/internals/reducer-stack/).

On Windows and macOS, the address bar and the page compete for keyboard focus at the OS level. Pressing the mouse on the address bar moves OS focus back to the AgentMux window before the text field takes focus, so typed characters go to the address bar and not to the page.

## See also

- [Pane types](/pane-types/) — full pane catalog
- [Reducer stack](/internals/reducer-stack/) — the browser-pane reducer
- [Architecture overview](/internals/architecture/) — host / sidecar / renderer split
- `docs/specs/SPEC_BROWSER_PANE_UNIFIED_CONTEXT_MENU_2026_08_15.md` in the main repo — the context-menu design
