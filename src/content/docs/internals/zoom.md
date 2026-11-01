---
title: Zoom system
description: How `Ctrl+/-/0`, `Ctrl+Scroll` and `Ctrl+Shift+Scroll` route to per-pane, all-panes and chrome zoom — the universal framework in `frontend/app/store/zoom.ts`, how a zoom keeps the text under the pointer, how it persists (live block meta plus a durable per-agent layer), and how new view types opt in.
---

AgentMux has **one** zoom framework, used by every pane type that supports zooming. Three keyboard inputs (`Ctrl+/-/0`) and two mouse inputs (`Ctrl+Wheel`, and `Ctrl+Shift+Wheel` for every pane in the window) flow through it. Per-pane zoom lives on block meta (`term:zoom`); for **agent** panes it is additionally mirrored into a durable per-agent store so the zoom survives the block (see [Persistence](#persistence)). Chrome zoom is kept per window until the app restarts (see the table below). The one pane that doesn't use this framework is the Browser pane, whose page has Chromium's own per-site zoom ([Browser pane](/browser-pane/#zoom)).

## Two zooms

| Mode | Scope | Persistence | Mechanism |
|---|---|---|---|
| **Per-pane** | One block (agent panes: also persisted **per-agent**) | `term:zoom` on block meta — the live value; for agent panes also mirrored into a durable per-agent `ui:zoom` content blob (see [Persistence](#persistence)) | Terminal panes: `term.options.fontSize = base * zoom`. Other view types: CSS `zoom` on the view root. |
| **Chrome** | Whole window | `chromeZoomAtom` + `--zoomfactor` on `:root`, kept in the window's `sessionStorage` (`agentmux:chrome-zoom`), so a reload of the window (a recycle, a version-skew reload) keeps it and a restart of AgentMux starts at 100% | Title bar, status bar, pane headers and the browser toolbar use `calc(... * var(--zoomfactor))` for their dimensions and fonts. |

Per-pane is what users hit by default (zoom in/out adjusts the focused pane). Chrome zoom fires when the cursor is over the title bar / status bar / pane header / browser toolbar during `Ctrl+Wheel`. Both are clamped to 50%–200%.

## Input routing

Four files own the input plumbing:

- [`frontend/app/store/zoom.ts`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/store/zoom.ts) — the store. Exports `zoomIn`, `zoomOut`, `zoomReset`, `zoomBlockIn`, `zoomBlockOut`, `chromeZoomIn/Out/Reset`, plus the `zoomIndicatorVisibleAtom` / `zoomIndicatorTextAtom` signals the indicator overlay reads. One file serves every platform.
- [`frontend/app/store/keymodel.ts`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/store/keymodel.ts) — `Ctrl+/-/0` and `Cmd+/-/0` bindings call `zoomIn() / zoomOut() / zoomReset()`. Those resolve the focused block via `getFocusedBlockId()` and route to `zoomBlockIn/Out` for that block.
- [`frontend/app/app.tsx`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/app.tsx) — the `Ctrl+Wheel` listener at window scope. If the cursor is over chrome, routes to `chromeZoomIn/Out`; otherwise probes `target.closest("[data-blockid]")` and routes to `zoomBlockIn/Out`, passing the pointer. A second listener takes `Ctrl+Shift+Wheel`: over chrome it is the same chrome step, elsewhere it steps every zoomable pane in the window together (`zoomAllPanesIn/Out`), each from its own level, with one "All panes: …" indicator. `Ctrl+Shift+0` (`view:zoom:resetAll`) puts them all back to 100%.
- [`frontend/app/store/chrome-zoom-target.ts`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/store/chrome-zoom-target.ts) — `isOverChrome`, the one test both listeners use. An element's `data-zoom-scope` (`chrome` or `content`) says which zoom it is drawn at, and the nearest one wins; without one, `.window-header`, `.status-bar` and `.block-frame-default-header` count as chrome. A pane whose content zooms but whose own controls follow chrome zoom marks them: the browser toolbar is `chrome`, the Editor's PDF pages are `content`.

The **per-pane path** converges on `setBlockZoom(blockId, factor)` which writes `term:zoom` on the block's meta via `SetMeta` RPC. Other components read it back through their block atom.

The **chrome path** (`chromeZoomIn/Out`) updates `chromeZoomAtom`, the `--zoomfactor` CSS variable and the window's `sessionStorage`; it does NOT write block meta. Don't look for chrome zoom under `term:zoom` — it lives in the atom, scoped to the window, and starts again at 100% when AgentMux restarts.

A pane shows the level it just asked for before the backend has stored it. `setBlockZoom` (`frontend/app/store/zoom.ts`) holds the new level locally (`frontend/app/store/pane-zoom-local.ts`) until the metadata write settles, plus 1.5 s for its update to reach the cache, or drops it at once if the write is refused. Views read `paneZoom(blockId, meta)`, not `meta["term:zoom"]` directly, so a second wheel tick sent before the first came back steps from the right level.

## How to make a view type zoomable

1. Declare the `paneZoom` capability in the view's pane manifest, as the agent pane does (`frontend/app/view/agent/agent-manifest.tsx`):

   ```ts
   capabilities: {
       paneZoom: {}, // or { baseFontSize: 13 } to scale from another base size (default 15)
   },
   ```

   `getBlockZoom` (`frontend/app/store/zoom.ts`) asks for this capability (`frontend/app/block/pane-tab-registry.ts`) rather than keeping its own list of view types. Without it, `getBlockZoom` returns `null`, the "this pane doesn't zoom" signal: `zoomBlockIn/Out` early-returns and the universal indicator doesn't show.

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

4. **DO NOT** attach your own `Ctrl+/-/0` or `Ctrl+Wheel` handlers, with one exception. The universal framework already covers them. The exception is content that handles the wheel itself and would stop it before the window listener sees it, such as xterm.js and CodeMirror: call `usePaneZoomWheel` (`frontend/app/store/zoom.ts`) on the view's root, which listens in the capture phase and takes plain `Ctrl+Wheel` through the same `zoomBlockByWheel` step (and leaves `Ctrl+Shift+Wheel` to the all-panes listener). Duplicate handlers compete with the universal flow (different step sizes, capture-phase `stopPropagation` pre-empting the indicator, two writes to the same meta key) and break zoom for that pane.

   This bit the agent pane in an early refactor. The agent-view component had inline `Ctrl+Wheel` and `Ctrl+/-/0` handlers attached in capture phase on the root, while the universal handlers fired through `keymodel.ts` and `app.tsx`. Result: each input either no-op'd or stepped twice. Deleting the inline handlers fixed it.

## Indicator overlay

`zoomindicator.tsx` reads `zoomIndicatorVisibleAtom` + `zoomIndicatorTextAtom` and renders a transient pill with the current percentage. The store's `showZoomIndicator(text)` helper flips visibility on, schedules a 1.5s timeout to hide it, and replaces any pending timeout. Per-pane, all-panes and chrome zoom all call into it (`"110%"`, `"All panes: 110%"` or `"All panes: 90%–120%"`, and `"Chrome 110%"`) so the user always sees what they just changed.

## Keeping what is under the pointer

A zoom keeps the text under the pointer where it is, so the part you are reading doesn't jump away. The Agent pane, the Terminal and the Editor opt in with `useZoomAnchor` (`frontend/app/store/zoom-anchor.ts`) and an adapter that knows how that pane finds, and puts back, the thing under a point:

1. Just before a step changes a pane's zoom, the store calls `captureZoomAnchor(blockId, point)`. `point` is the pointer for the wheel, or, for the keys, the last pointer position (`lastPointer()`), which counts only if it is over the pane; otherwise the capture uses the pane's centre. The adapter notes what is there: a text position in a row for the Agent pane, a buffer line for the Terminal, a document position for the Editor.
2. After the zoom lands and the layout changes, the hook restores it, and again on the next frames while the pane measures itself, until two passes in a row agree, ten frames pass, you scroll yourself, or the pane is following its latest output (then there is nothing to hold).
3. Steps within 200 ms of one another with the pointer in the same place (a run of wheel ticks) share the first capture, so the held point doesn't drift by each step's rounding. A capture older than 2 s is discarded, so a pane whose zoom didn't change (a terminal whose font size rounds to the same size) never restores a stale point later.

`frontend/app/store/zoom-anchor-dom.ts` has the helpers the adapters share: finding the text under a point and the rectangle of a character.

### Panes whose content zooms on its own

Some panes have content that takes the pane's zoom while the pane's own controls follow chrome zoom. The Editor showing a PDF is one (`frontend/app/view/editor/viewers/content-zoom.ts`): its `term:zoom` is a multiple of the width that fits the pane, pdf.js draws the pages again at the new scale, the point under the pointer is held as a page and a fraction of it (`frontend/app/view/editor/viewers/pdf/pdf-zoom.ts`), and the tab strip, viewer bar and file tree are drawn at `chromeZoomAtom` (`frontend/app/view/editor/viewers/pdf/pdf-viewer.tsx`). Its pages are `data-zoom-scope="content"`, and the rest of the Editor is `chrome`, so a wheel over the pages zooms the PDF and a wheel over the tabs zooms the app.

## Persistence

Zoom persists in **two layers**. The frontend only ever touches the first; the second is a pure backend mirror — no frontend code changed to add it.

### Layer 1 — live block meta (`term:zoom`)

`term:zoom` is a block meta key, scoped to one block. It's the value every view reads and applies live. The full lifecycle:

1. User hits `Ctrl++`.
2. `keymodel.ts` calls `zoomIn()` → `getFocusedBlockId()` → `zoomBlockIn(blockId, KEYBOARD_STEP)`.
3. `zoomBlockIn` reads current zoom from meta, computes `stepZoom` (with skip-to-next-pixel-size logic for font-bound terminals), and calls `setBlockZoom(blockId, factor)`.
4. `setBlockZoom` clamps to `[0.5, 2.0]`, rounds to 0.01, and fires `SetMeta` RPC writing `term:zoom: factor` (or `null` if back at 1.0, to keep the persisted block clean).
5. The backend persists the meta change and broadcasts a block-update event.
6. The block atom in the renderer re-fires; every component that reads `block()?.meta?.["term:zoom"]` recomputes.

`Ctrl+Wheel` follows the same path via `term.tsx` / `app.tsx` (see [Input routing](#input-routing)). The cleanup at step 4 (`null` for 1.0) means the persisted meta only has a `term:zoom` entry for blocks the user actually adjusted — clean diffs in object dumps.

This layer is **block-scoped and ephemeral**: a block is created fresh each time a pane opens, so on its own `term:zoom` would reset to 1.0 every time you close and reopen an agent.

### Layer 2 — durable per-agent zoom (`ui:zoom`)

To make zoom survive pane close/reopen, the backend mirrors every agent block's `term:zoom` change into a **per-agent content blob** with `content_type = "ui:zoom"`, keyed by the stable `agent.id` (not the ephemeral block). This is the [`SPEC_AGENT_ZOOM_PERSISTENCE`](#see-also) layer.

- **Mirror trigger.** When a `SetMeta` updates `term:zoom` on a block that carries an `agentId` (i.e. an agent pane), [`service/object_helpers.rs`](https://github.com/agentmuxai/agentmux/blob/main/crates/srv/src/server/service/object_helpers.rs) calls `schedule_agent_zoom_mirror(agent_id, zoom)`. Non-agent blocks are untouched.
- **Debounced — one write per burst.** The mirror is a 300ms **trailing** debounce backed by a per-agent generation counter. A spin of `Ctrl+Wheel` fires many `term:zoom` writes, but only the last survives the debounce window and commits, so there's no durable-write amplification (each commit also does a single global def-registry re-mirror).
- **Reset deletes the row.** The frontend writes `term:zoom = null` when the user returns to 1.0. The mirror reads that `null` and **deletes** the `ui:zoom` row (`agent_content_delete`) rather than storing `1.0`. An agent the user never zoomed (or reset) persists nothing — defaults stay clean. Implementation in [`content.rs`](https://github.com/agentmuxai/agentmux/blob/main/crates/srv/src/backend/storage/content.rs).
- **Restore on reopen.** When a pane opens, [`app_api/agent_open.rs`](https://github.com/agentmuxai/agentmux/blob/main/crates/srv/src/server/app_api/agent_open.rs) `agent.open` reads the agent's saved `ui:zoom` and seeds the new block's `term:zoom` from it, clamped to `[0.5, 2.0]` (`parse_seed_zoom`, which also rejects out-of-range and default `1.0` values). Layer 1 then applies it exactly as if the user had just set it.
- **Global / cross-channel.** Because `ui:zoom` is a per-agent content blob, it is global cross-channel — `agent_content_set`/`agent_content_delete` re-mirror it to the shared definition registry. Reopening the *same agent* in a different window, channel, or server instance restores its zoom, not just within the channel where it was set.

The result: zoom feels like an agent-level preference (it follows the agent everywhere) while the frontend still reads and writes only the block-scoped `term:zoom` it always has.

### Zoom-invariant busy bar

Agent panes apply CSS `zoom` to the whole view root, which would also scale the marching-ants **busy bar** at the bottom of the pane. To keep that bar a fixed on-screen size regardless of pane zoom, `agent-view.tsx` also sets a CSS variable `--agent-pane-zoom` alongside `zoom` on the root, and [`_control-bar.scss`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/view/agent/styles/_control-bar.scss) **counter-scales** the bar's dimensions and animation by dividing by `var(--agent-pane-zoom)`. So the content zooms but the busy indicator stays visually constant.

## Limits

- **Range**: 0.5x to 2.0x. Constants in `frontend/app/store/zoom-factor.ts` (`MIN_ZOOM`, `MAX_ZOOM`).
- **Steps**: 0.1 (keyboard, `KEYBOARD_STEP`) or 0.05 (wheel, `WHEEL_STEP`). The skip-to-next-pixel logic in `stepZoom` ensures a keyboard step always changes the rendered terminal font by at least 1px (avoids "I pressed Ctrl++ but nothing changed").
- **Font bounds**: terminal fonts clamp to `[4, 64]` px regardless of zoom factor — the store enforces this in `computeEffectiveFontSize`.

## See also

- Spec: [`docs/specs/zoom-architecture.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/zoom-architecture.md) — the original design that established the universal framework, plus follow-ups for chrome zoom + pane-header zoom routing.
- Spec: `SPEC_AGENT_ZOOM_PERSISTENCE` — the durable per-agent `ui:zoom` layer (debounced mirror, reset-deletes, cross-channel restore).
- Source:
  - [`frontend/app/store/zoom.ts`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/store/zoom.ts) (one implementation for every platform)
  - [`frontend/app/store/keymodel.ts`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/store/keymodel.ts) (Ctrl+/-/0 bindings)
  - [`frontend/app/app.tsx`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/app.tsx) (Ctrl+Wheel routing)
  - [`crates/srv/src/server/service/object_helpers.rs`](https://github.com/agentmuxai/agentmux/blob/main/crates/srv/src/server/service/object_helpers.rs) (`schedule_agent_zoom_mirror` — debounced `term:zoom` → `ui:zoom` mirror)
  - [`crates/srv/src/server/app_api/mod.rs`](https://github.com/agentmuxai/agentmux/blob/main/crates/srv/src/server/app_api/mod.rs) (`parse_seed_zoom`; `agent.open` itself, which seeds `term:zoom` from saved `ui:zoom`, is in `crates/srv/src/server/app_api/agent_open.rs`)
  - [`crates/srv/src/backend/storage/content.rs`](https://github.com/agentmuxai/agentmux/blob/main/crates/srv/src/backend/storage/content.rs) (per-agent content store + global def-registry mirror)
  - [`frontend/app/view/agent/styles/_control-bar.scss`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/view/agent/styles/_control-bar.scss) (zoom-invariant busy bar via `--agent-pane-zoom`)
