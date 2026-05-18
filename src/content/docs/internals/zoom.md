---
title: Zoom system
description: How `Ctrl+/-/0` and `Ctrl+Scroll` route to per-pane and chrome zoom — the universal framework in `frontend/app/store/zoom.platform.ts`, how it persists, and how new view types opt in.
---

AgentMux has **one** zoom framework, used by every pane type that supports zooming. Three keyboard inputs (`Ctrl+/-/0`) and one mouse input (`Ctrl+Wheel`) flow through it; everything that scales — terminal font size, agent-pane content, chrome — reads back from the same persisted state.

## Two zooms

| Mode | Scope | Persistence | Mechanism |
|---|---|---|---|
| **Per-pane** | One block | `term:zoom` on block meta | Terminal panes: `term.options.fontSize = base * zoom`. Other view types: CSS `zoom` on the view root. |
| **Chrome** | Whole window | In-memory only — `chromeZoomAtom` + `--zoomfactor` on `:root`; reset on reload (`initChromeZoom()` reapplies `DEFAULT_ZOOM`, `loadZoom()` is a no-op today) | Title bar + status bar use `calc(... * var(--zoomfactor))` for their dimensions and fonts. |

Per-pane is what users hit by default (zoom in/out adjusts the focused pane). Chrome zoom fires when the cursor is over the title bar / status bar / pane header during `Ctrl+Wheel`.

## Input routing

Three files own the input plumbing:

- [`frontend/app/store/zoom.platform.ts`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/store/zoom.platform.ts) — the store. Exports `zoomIn`, `zoomOut`, `zoomReset`, `zoomBlockIn`, `zoomBlockOut`, `chromeZoomIn/Out/Reset`, plus the `zoomIndicatorVisibleAtom` / `zoomIndicatorTextAtom` signals the indicator overlay reads. Per-platform variants (`zoom.win32.ts`, `zoom.darwin.ts`, `zoom.linux.ts`) only diverge on platform-specific compensation; the API is identical.
- [`frontend/app/store/keymodel.ts`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/store/keymodel.ts) — `Ctrl+/-/0` and `Cmd+/-/0` bindings call `zoomIn() / zoomOut() / zoomReset()`. Those resolve the focused block via `getFocusedBlockId()` and route to `zoomBlockIn/Out` for that block.
- [`frontend/app/app.tsx`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/app.tsx) — `Ctrl+Wheel` listener at window scope. If the cursor is over chrome (`.window-header` / `.status-bar` / `.block-frame-default-header`), routes to `chromeZoomIn/Out`; otherwise probes `target.closest("[data-blockid]")` and routes to `zoomBlockIn/Out`.

Both paths converge on `setBlockZoom(blockId, factor)` which writes `term:zoom` on the block's meta via `SetMeta` RPC. Other components read it back through their block atom.

## How to make a view type zoomable

1. Set `viewType` on the block so `getBlockZoom` recognises it. The allow-list is per-platform — `zoom.platform.ts` resolves to `zoom.win32.ts`, `zoom.darwin.ts`, or `zoom.linux.ts` at build time, and each file has its own `getBlockZoom`. The Windows one looks like:

   ```ts
   if (vt !== "term" && vt !== "agent" && vt !== "swarm") return null;
   ```

   **Update every platform variant** (or extract a shared helper) so the new view zooms on all three OSes — a Windows-only change silently no-ops on macOS / Linux builds. Codex P2 on docs PR #32 caught this. Returning `null` for unsupported types is the "this pane doesn't zoom" signal — `zoomBlockIn/Out` early-returns and the universal indicator doesn't show.

2. **Read** the persisted value in your view component:

   ```tsx
   const block = model.blockAtom;
   const zoomFactor = createMemo(() => {
       const z = block()?.meta?.["term:zoom"];
       if (z == null || typeof z !== "number" || isNaN(z)) return 1.0;
       return Math.max(0.5, Math.min(2.0, z));
   });
   ```

3. **Apply** it. Two patterns depending on the pane content:

   - **Terminals**: scale the font size, not the container. xterm.js doesn't observe CSS `zoom`; it has its own renderer. The store does this for you via `getBaseFontSize` × `zoom` → `fontSizeAtom` → `terminal.options.fontSize`.
   - **Everything else**: apply CSS `zoom` on the view root:
     ```tsx
     <div ref={rootRef} class="agent-view" style={{ zoom: zoomFactor() }}>
       …
     </div>
     ```

4. **DO NOT** attach your own `Ctrl+/-/0` or `Ctrl+Wheel` handlers. The universal framework already covers them. Duplicate handlers compete with the universal flow (different step sizes, capture-phase `stopPropagation` pre-empting the indicator, two writes to the same meta key) and break zoom for that pane.

   This bit the agent pane in an early refactor. The agent-view component had inline `Ctrl+Wheel` and `Ctrl+/-/0` handlers attached in capture phase on the root, while the universal handlers fired through `keymodel.ts` and `app.tsx`. Result: each input either no-op'd or stepped twice. Deleting the inline handlers fixed it.

## Indicator overlay

`zoomindicator.tsx` reads `zoomIndicatorVisibleAtom` + `zoomIndicatorTextAtom` and renders a transient pill with the current percentage. The store's `showZoomIndicator(text)` helper flips visibility on, schedules a 1.5s timeout to hide it, and replaces any pending timeout. Both per-pane and chrome zoom calls into it (`"Chrome 110%"` vs `"110%"`) so the user always sees what they just changed.

## Persistence

`term:zoom` is a block meta key. The full lifecycle:

1. User hits `Ctrl++`.
2. `keymodel.ts` calls `zoomIn()` → `getFocusedBlockId()` → `zoomBlockIn(blockId, KEYBOARD_STEP)`.
3. `zoomBlockIn` reads current zoom from meta, computes `stepZoom` (with skip-to-next-pixel-size logic for font-bound terminals), and calls `setBlockZoom(blockId, factor)`.
4. `setBlockZoom` clamps to `[0.5, 2.0]`, rounds to 0.01, and fires `SetMeta` RPC writing `term:zoom: factor` (or `null` if back at 1.0, to keep the persisted block clean).
5. The backend persists the meta change and broadcasts a block-update event.
6. The block atom in the renderer re-fires; every component that reads `block()?.meta?.["term:zoom"]` recomputes.

The cleanup at step 4 (`null` for 1.0) means the persisted meta only has a `term:zoom` entry for blocks the user actually adjusted — clean diffs in object dumps.

## Limits

- **Range**: 0.5x to 2.0x. Constants in `zoom.win32.ts` (`MIN_ZOOM`, `MAX_ZOOM`).
- **Steps**: 0.1 (keyboard, `KEYBOARD_STEP`) or 0.05 (wheel, `WHEEL_STEP`). The skip-to-next-pixel logic in `stepZoom` ensures a keyboard step always changes the rendered terminal font by at least 1px (avoids "I pressed Ctrl++ but nothing changed").
- **Font bounds**: terminal fonts clamp to `[4, 64]` px regardless of zoom factor — the store enforces this in `computeEffectiveFontSize`.

## See also

- Spec: [`docs/specs/zoom-architecture.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/zoom-architecture.md) — the original design that established the universal framework, plus follow-ups for chrome zoom + pane-header zoom routing.
- Source:
  - [`frontend/app/store/zoom.win32.ts`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/store/zoom.win32.ts) (canonical implementation; macOS and Linux variants only override platform-specific compensation)
  - [`frontend/app/store/keymodel.ts`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/store/keymodel.ts) (Ctrl+/-/0 bindings)
  - [`frontend/app/app.tsx`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/app.tsx) (Ctrl+Wheel routing)
