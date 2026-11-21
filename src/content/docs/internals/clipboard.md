---
title: Clipboard & export
description: How copy and paste are wired across panes in AgentMux — the CEF clipboard bridge, and where the surfaces (keyboard and context menu) plug in.
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

Both functions invoke CEF IPC commands implemented in [`crates/cef/src/commands/clipboard.rs`](https://github.com/agentmuxai/agentmux/blob/main/crates/cef/src/commands/clipboard.rs):

- **Windows** — Win32 `OpenClipboard` / `SetClipboardData` (CF_UNICODETEXT).
- **macOS** — `pbcopy` / `pbpaste`.
- **Linux** — `wl-copy` (Wayland) with `xclip` / `xsel` fallback (X11).

Errors propagate: `writeText` and `readText` reject when the underlying CEF IPC call fails (e.g. missing clipboard helpers on Linux, IPC token expired). Callers that don't want to surface the failure to the user should `.catch()` and log — see the reference implementation in [`termwrap.ts`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/view/term/termwrap.ts) which logs to `console.log` so the failure shows up in the dev `[fe]` tail without blocking the UI.

### Rule: never call `navigator.clipboard.*` directly

All code goes through the wrapper. If you need clipboard from a pane, the wrapper is your only API.

## Surfaces: keyboard and context menu

A copy action is reached from the keyboard (`Ctrl+C` in general, `Ctrl+Shift+C` in terminals) and from a right-click menu with Copy items. Each pane wires its own, as described below.

## What is selectable

There is no shared selection registry. The unified clipboard spec (`SPEC_UNIFIED_CLIPBOARD_2026_05_18.md`) proposed a `SelectionProvider` that each pane would register, but it was never built. Each pane wires its own copy actions: the terminal as described below, and the install log view (`frontend/app/element/install/LogView.tsx`) with its own **Copy All** menu item.

## xterm.js terminals

The terminal pane ([`termwrap.ts`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/view/term/termwrap.ts)) wires three things (the agent install modal's terminal, which wired the same three, has since been removed):

1. **`onSelectionChange`** — read the `term:copyonselect` setting; if true, copy the current xterm selection on every change.
2. **`attachCustomKeyEventHandler`** — intercept `Ctrl+Shift+C` and write the selection to clipboard. Return `false` to stop xterm from also routing the keystroke as terminal input.
3. **`onContextMenu` on the container** — show Copy / Copy All via `ContextMenuModel.showContextMenu`.

Selection within xterm is managed by xterm.js itself, not by the browser — `xterm.css` sets `user-select: none` on the canvas. Use `terminal.getSelection()` to read it; never `window.getSelection()` on a terminal pane.

## Adding clipboard to a new pane

1. Import the wrapper: `import { writeText } from "@/util/clipboard"`.
2. If the pane has selectable content, wire its copy actions in the pane itself, as the terminal and the install log view do.
3. For xterm-based panes, wire all three xterm hooks (selection-change, key-handler, container context menu) as above.
4. Add Copy / Copy All to the pane's right-click menu via `ContextMenuModel.showContextMenu`.
5. **Do not** call `navigator.clipboard.*` directly.

## See also

- Spec: [`SPEC_UNIFIED_CLIPBOARD_2026_05_18.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/SPEC_UNIFIED_CLIPBOARD_2026_05_18.md) — the unified architecture + phased rollout.
- Source:
  - [`frontend/util/clipboard.ts`](https://github.com/agentmuxai/agentmux/blob/main/frontend/util/clipboard.ts) — the wrapper.
  - [`crates/cef/src/commands/clipboard.rs`](https://github.com/agentmuxai/agentmux/blob/main/crates/cef/src/commands/clipboard.rs) — host-side impl.
  - [`frontend/app/store/contextmenu.ts`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/store/contextmenu.ts) — `ContextMenuModel`.
  - [`frontend/app/view/term/termwrap.ts`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/view/term/termwrap.ts) — reference xterm wiring.
