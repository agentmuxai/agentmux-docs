---
title: Windows, tabs, panes and renderers
description: Which Chromium renderer process runs which window, tab and pane, what stays in memory when you hide something, and what gives memory back.
---

AgentMux runs inside Chromium, and Chromium puts web pages in **renderer processes**. Which renderer a window, a tab or a pane lands in decides where the memory goes. This page explains the mapping. For the other processes (launcher, host, backend) see the [Architecture overview](/internals/architecture/).

## The short answer

**Not every pane has its own renderer. Every window does, and every browser pane does. Every other pane shares its window's renderer.**

- A **window** (the main window, a second window, a torn-off floating pane) is one Chromium browser that loads the AgentMux frontend. It gets one renderer. **All of that window's tabs, and every pane in them except browser panes, run in that one renderer:** agents, terminals, editors, files, Swarm, Tower, settings and widgets.
- A **[browser pane](/browser-pane/)** is a separate Chromium browser that the host creates and lays over the window. Its web page runs in **its own renderer**, and sometimes in more than one (see [Browser panes](#browser-panes)). The window's renderer only holds the pane's frame: the bar with the address and buttons, and an empty placeholder the page is positioned over.
- A **floating pane** is a window of its own, with its own renderer running its own copy of the frontend. Tearing a pane off rebuilds it in the new window from the backend's state; docking it back does the reverse. A browser pane is closed and recreated on either move. It keeps its cookies, so it stays signed in, but the page reloads.
- **Hidden pre-warmed windows** have a renderer too: a few windows, already loaded and waiting, so that a new window or a tear-off appears without a cold start.

So "this window uses a lot of memory" almost always means the window's own renderer, which carries every non-browser pane of every tab in it, hidden ones included.

## The processes of one instance

| Process | How many | What runs in it |
|---|---|---|
| launcher | 1 | Lifecycle and restarts |
| backend (`agentmux-srv`) | 1 | All durable state; your agents' CLIs run as its children |
| host (`agentmux-cef`, Chromium's browser process) | 1 | Windows, browser panes, IPC |
| GPU process | 1 | Compositing and WebGL for every renderer, terminal WebGL included |
| utility processes | a few | Network, storage and audio services |
| **window renderer** | 1 per window, and 1 per floating-pane window | The SolidJS frontend: every tab and every non-browser pane of that window |
| **pool renderers** | a few | A hidden window with the frontend loaded, waiting to become the next new window or tear-off |
| **browser pane renderer** | 1 or more per browser pane | The web page shown in that pane |

The agent CLIs (Claude Code, Codex and the others) are not renderers and not Chromium processes: they are the backend's children.

[Tower](/tower/) lists the processes of your instance, and labels each renderer with the window or browser pane it serves. It is the reliable way to see this on your own machine. See [`crates/cef/src/renderer_map.rs`](https://github.com/agentmuxai/agentmux/blob/main/crates/cef/src/renderer_map.rs) for how the host learns which renderer belongs to which window.

## What is inside a window's renderer

- **Every window tab of the window is mounted at once.** A tab you aren't looking at is hidden, not unloaded: with `window:keepinactivetabslaidout` (the default) it stays laid out but invisible, so switching back to it has nothing to catch up on. Its layout, its stores and its terminals' buffers stay in memory. See [`workspace.tsx`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/workspace/workspace.tsx).
- **Inside a pane, the pane tabs you aren't looking at** stay mounted if their type is kept alive (agent, terminal, browser, editor, files) and are unmounted otherwise (for example Help, system info and Swarm). Kept-alive types keep their scroll position and drafts when you come back.
- **A hidden agent pane stops drawing new output** but keeps receiving and storing its stream, so the memory it holds keeps growing with what the agent does. Switching back is instant because nothing has to be fetched.
- **A minimized pane** is drawn as a header chip and stays mounted. **A minimized window** counts as hidden for agent panes: they stop drawing and keep their memory.
- **Widgets** run in a sandboxed frame inside the window. Chromium decides whether such a frame gets a process of its own.

Chromium's JavaScript heap doesn't give memory back to the system when things are freed. A window's renderer therefore stays near its high-water mark until its page is reloaded (see [What gives memory back](#what-gives-memory-back)).

## Pre-warmed windows

New windows and tear-offs come from a small hidden pool: windows that have already loaded the frontend and wait off-screen. Promoting one turns its renderer into that window's renderer, and the pool then makes another. There is one pool for new windows and one for floating panes; each keeps a small fixed number ready. See [Why tear-off feels instant](/pane-types/#why-tear-off-feels-instant).

## Browser panes

AgentMux does not change Chromium's process model, so Chromium's usual rules decide how many renderers a browser pane uses. In practice:

- one renderer for the page;
- **another for each cross-site `<iframe>`** on it (site isolation);
- a navigation to another site moves the pane to a new renderer and lets the old one exit;
- Chromium can keep a **spare renderer** ready for the next navigation;
- if Chromium runs low on processes it may let same-site pages share a renderer, so "one per pane" is the normal case, not a guarantee.

**The cookie jar doesn't change the count.** Your Personal profile, a named profile and Incognito decide which cookies a page sees, not how many processes it uses.

**A hidden browser pane is put to sleep.** A browser pane that is out of sight (in another window tab or pane tab, or minimized) is collapsed to nothing, and after a while its page is closed so its renderer exits:

- Setting `browser:hibernate` (on by default) turns this off; `browser:hibernateafter` is how many minutes a pane must be hidden first (30 by default; sooner when the computer is low on memory).
- A sleeping pane keeps its address, title, icon and cookie jar, and loads again when you are about to look at it, with a note while it restores. It shows a card that says why it slept and how much memory that freed. On an engine that can discard a page in place, the wake also brings back the back and forward history, scroll position and anything typed into the page; otherwise the page reloads fresh.
- When the computer is low on memory, the biggest hidden pages sleep first.
- A pane an agent used within `browser:hibernateafter` minutes (never less than 10), one playing or capturing media, one with something typed into it, a page that asks before leaving, a page whose title or icon changed in the last 30 minutes, a local development server, a pane with a popup window open and a pane waiting for you don't sleep. `browser:keepawakesites` lists sites that never sleep.
- An agent's pane that the agent has left alone for that long sleeps, and the agent's next `Browser` call wakes it.
- Before it sleeps, a hidden page that is still awake is frozen after a few minutes: no scripts or timers run, but its renderer is still there.

See [`hibernation.ts`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/view/browser/hibernation.ts) for the exact rules.

## What gives memory back

| Action | Window renderer | Browser pane renderer |
|---|---|---|
| Switch to another window tab | Nothing freed | Nothing freed right away (the page is collapsed); it sleeps after a while |
| Switch to another pane tab | An unmounted type is freed; kept-alive types keep everything | Same as above |
| Minimize a pane or the window | Nothing freed | Same as above |
| Close a pane | Its share, but the heap mostly keeps the pages | The whole renderer exits |
| **Reload Window (Free Memory)** | The page reloads and the heap starts over; panes restore from the backend | The page re-attaches to the pane |
| **Automatic recycle** | The same reload, by itself, when the window is idle and over budget (below) | Not touched |

**Reload Window (Free Memory)** is in the command palette. It reloads the window's page, so the renderer's memory starts over; your panes, layout, scroll positions and drafts come back. It waits if something would be lost, such as a drag in progress, an open dialog or an agent waiting for your answer.

**Automatic recycle** does the same reload for a window you aren't using. A window is recycled when all of these hold:

- its renderer is over 600 MB and over twice its size right after it loaded;
- it has not been in front for 10 minutes (2 minutes when the computer is short of memory);
- nothing would be lost: no recent input, no unsaved changes, no agent waiting for an answer, no open dialog.

At most one window is recycled at a time. Setting `window:autorecycle` to `false` turns it off, leaving only the command. The window you are working in is never recycled automatically; it only shrinks when you reload it yourself or restart AgentMux. See [`recycle_governor.rs`](https://github.com/agentmuxai/agentmux/blob/main/crates/cef/src/commands/recycle_governor.rs).

## Where the memory goes

On a long-running instance with several window tabs of agents, terminals and browser panes, the window's own renderer is by far the largest renderer, several times all the browser panes together, because it carries every tab's agents, terminals and views. Browser panes cost one page each, typically tens to a couple of hundred megabytes, and a sleeping pane costs nothing.

To keep a window's renderer small: close panes you are done with, use **Reload Window (Free Memory)** after a heavy session, and leave `window:autorecycle` on.

## See also

- [Architecture overview](/internals/architecture/): the four processes and how they talk.
- [Browser pane](/browser-pane/) and [Pane types](/pane-types/).
- [Tower](/tower/): your instance's processes, with memory.
- [Settings](/settings/#window-settings): `window:keepinactivetabslaidout` and the other window settings.
