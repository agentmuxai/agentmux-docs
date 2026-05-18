---
title: Clipboard & export
description: How copy/paste, save-to-file, and open-in-editor are wired across panes in AgentMux — the CEF clipboard bridge, the SelectionProvider contract, and where the surfaces (keyboard, context menu, action bar) plug in.
---

AgentMux routes all clipboard interaction through **one** path: a thin frontend wrapper that calls into the host process via CEF IPC. CEF's Chromium blocks `navigator.clipboard.readText()` without a Permissions-Policy header, and `writeText()` works today but is fragile — the wrapper exists so every pane in the app behaves the same way regardless.

This page documents how the wiring goes together and how to add clipboard support to a new pane type.

## The wrapper

```ts
// frontend/util/clipboard.ts
import { writeText, readText } from "@/util/clipboard";

await writeText("hello");
const text = await readText();
```

Both functions invoke CEF IPC commands implemented in [`agentmux-cef/src/commands/clipboard.rs`](https://github.com/agentmuxai/agentmux/blob/main/agentmux-cef/src/commands/clipboard.rs):

- **Windows** — Win32 `OpenClipboard` / `SetClipboardData` (CF_UNICODETEXT).
- **macOS** — `pbcopy` / `pbpaste`.
- **Linux** — `wl-copy` (Wayland) with `xclip` / `xsel` fallback (X11).

Errors propagate: `writeText` and `readText` reject when the underlying CEF IPC call fails (e.g. missing clipboard helpers on Linux, IPC token expired). Callers that don't want to surface the failure to the user should `.catch()` and log — see the reference implementation in [`termwrap.ts`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/view/term/termwrap.ts) which logs to `console.log` so the failure shows up in the dev `[fe]` tail without blocking the UI.

### Rule: never call `navigator.clipboard.*` directly

The audit on 2026-05-18 found exactly one direct call (the OAuth URL copy button in `PreLaunchAuthPanel.tsx`) — that's been routed through the wrapper. New code must follow suit. If you need clipboard from a pane, the wrapper is your only API.

## Surfaces: keyboard, context menu, action bar

A given copy action shows up in three places (one user-visible command, three discovery paths):

| Surface | How it fires |
|---|---|
| Keyboard | `Ctrl+C` (general), `Ctrl+Shift+C` (terminals), `Ctrl+S` (save) |
| Right-click | Context menu items: Copy, Copy All, Save Selection As… |
| Action bar | Hover-revealed `[ Copy | Save ]` on long-output regions (terminals, log viewers) |

The intent of putting one command in three places: discoverability without re-implementing the action.

## The SelectionProvider contract

A pane that has selectable content tells the global commands what's selectable. Define a provider:

```ts
interface SelectionProvider {
    /** Best-effort current selection. Empty string if nothing selected. */
    getSelection(): string;
    /** Full content of the view (used by Copy All / Save / Open). */
    getAll(): string;
    /** Optional filename label — "terminal", "agent-log", "install-output". */
    exportLabel?(): string;
}
```

Register it on mount, unregister on unmount:

```ts
import { registerSelectionProvider } from "@/util/selection-registry";

onMount(() => {
    const dispose = registerSelectionProvider({
        getSelection: () => terminal.getSelection(),
        getAll: () => serializeBuffer(terminal),
        exportLabel: () => `install-${agent.id}`,
    });
    onCleanup(dispose);
});
```

The provider is **activated when the pane has DOM focus**. Multiple panes can be mounted; only the focused one's provider is queried by global commands.

> **As of 2026-05-18 the SelectionProvider registry ships in Phase β.** Phase α (the install-modal fix) wires clipboard inline. See [`SPEC_UNIFIED_CLIPBOARD_2026_05_18.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/SPEC_UNIFIED_CLIPBOARD_2026_05_18.md) for the implementation roadmap.

## xterm.js terminals

Both terminal consumers — the regular term pane ([`termwrap.ts`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/view/term/termwrap.ts)) and the install modal terminal ([`AgentInstallModal.tsx`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/view/agent/components/AgentInstallModal.tsx)) — wire three things:

1. **`onSelectionChange`** — read the `term:copyonselect` setting; if true, copy the current xterm selection on every change.
2. **`attachCustomKeyEventHandler`** — intercept `Ctrl+Shift+C` and write the selection to clipboard. Return `false` to stop xterm from also routing the keystroke as terminal input.
3. **`onContextMenu` on the container** — show Copy / Copy All via `ContextMenuModel.showContextMenu`.

Selection within xterm is managed by xterm.js itself, not by the browser — `xterm.css` sets `user-select: none` on the canvas. Use `terminal.getSelection()` to read it; never `window.getSelection()` on a terminal pane.

## Save to file (Phase γ)

For long-output surfaces (install logs, terminal scrollback, agent transcripts), one extra action:

- **Save Selection As…** — writes the selection (or `getAll()` if nothing is selected) to a path picked via the OS save dialog. Default location: `~/.agentmux/clips/<timestamp>-<label>.txt`.

Backend RPC: `RpcApi.WriteFile({ path, content, overwrite })`. Backend handler will live in [`agentmux-srv/src/server/file_handlers.rs`](https://github.com/agentmuxai/agentmux/blob/main/agentmux-srv/src/server/file_handlers.rs).

Cleanup: clips older than 7 days are pruned on startup. Capped at 1 MB per file.

> **As of 2026-05-18 Phase γ has not shipped yet.** Track the roadmap in [`SPEC_UNIFIED_CLIPBOARD_2026_05_18.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/SPEC_UNIFIED_CLIPBOARD_2026_05_18.md) §4.
>
> "Open in editor" was originally scoped here but cut after design review — selecting text for copy/paste doesn't imply moving the whole buffer into an editor. If that capability is needed later, it can chain `RpcApi.OpenExternalCommand(path)` after the save.

## Adding clipboard to a new pane

1. Import the wrapper: `import { writeText } from "@/util/clipboard"`.
2. If the pane has selectable content, implement and register a `SelectionProvider` (once Phase β lands).
3. For xterm-based panes, wire all three xterm hooks (selection-change, key-handler, container context menu) as above.
4. Add Copy / Copy All to the pane's right-click menu via `ContextMenuModel.showContextMenu`.
5. **Do not** call `navigator.clipboard.*` directly.

## See also

- Spec: [`SPEC_UNIFIED_CLIPBOARD_2026_05_18.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/SPEC_UNIFIED_CLIPBOARD_2026_05_18.md) — the unified architecture + phased rollout.
- Source:
  - [`frontend/util/clipboard.ts`](https://github.com/agentmuxai/agentmux/blob/main/frontend/util/clipboard.ts) — the wrapper.
  - [`agentmux-cef/src/commands/clipboard.rs`](https://github.com/agentmuxai/agentmux/blob/main/agentmux-cef/src/commands/clipboard.rs) — host-side impl.
  - [`frontend/app/store/contextmenu.ts`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/store/contextmenu.ts) — `ContextMenuModel`.
  - [`frontend/app/view/term/termwrap.ts`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/view/term/termwrap.ts) — reference xterm wiring.
