---
title: Zoom system
description: How `Ctrl+/-/0` and `Ctrl+Scroll` route to per-pane and chrome zoom — the universal framework in `frontend/app/store/zoom.platform.ts`, how it persists (live block meta plus a durable per-agent layer), and how new view types opt in.
---

AgentMux has **one** zoom framework, used by every pane type that supports zooming. Three keyboard inputs (`Ctrl+/-/0`) and one mouse input (`Ctrl+Wheel`) flow through it. Per-pane zoom lives on block meta (`term:zoom`); for **agent** panes it is additionally mirrored into a durable per-agent store so the zoom survives the block (see [Persistence](#persistence)). Chrome zoom is in-memory only (see the table below).

## Two zooms

| Mode | Scope | Persistence | Mechanism |
|---|---|---|---|
| **Per-pane** | One block (agent panes: also persisted **per-agent**) | `term:zoom` on block meta — the live value; for agent panes also mirrored into a durable per-agent `ui:zoom` content blob (see [Persistence](#persistence)) | Terminal panes: `term.options.fontSize = base * zoom`. Other view types: CSS `zoom` on the view root. |
| **Chrome** | Whole window | In-memory only — `chromeZoomAtom` + `--zoomfactor` on `:root`; reset on reload (`initChromeZoom()` reapplies `DEFAULT_ZOOM`, `loadZoom()` is a no-op today) | Title bar + status bar use `calc(... * var(--zoomfactor))` for their dimensions and fonts. |

Per-pane is what users hit by default (zoom in/out adjusts the focused pane). Chrome zoom fires when the cursor is over the title bar / status bar / pane header during `Ctrl+Wheel`.

## Input routing

Three files own the input plumbing:

- [`frontend/app/store/zoom.platform.ts`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/store/zoom.platform.ts) — the store. Exports `zoomIn`, `zoomOut`, `zoomReset`, `zoomBlockIn`, `zoomBlockOut`, `chromeZoomIn/Out/Reset`, plus the `zoomIndicatorVisibleAtom` / `zoomIndicatorTextAtom` signals the indicator overlay reads. Per-platform variants (`zoom.win32.ts`, `zoom.darwin.ts`, `zoom.linux.ts`) only diverge on platform-specific compensation; the API is identical.
- [`frontend/app/store/keymodel.ts`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/store/keymodel.ts) — `Ctrl+/-/0` and `Cmd+/-/0` bindings call `zoomIn() / zoomOut() / zoomReset()`. Those resolve the focused block via `getFocusedBlockId()` and route to `zoomBlockIn/Out` for that block.
- [`frontend/app/app.tsx`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/app.tsx) — `Ctrl+Wheel` listener at window scope. If the cursor is over chrome (`.window-header` / `.status-bar` / `.block-frame-default-header`), routes to `chromeZoomIn/Out`; otherwise probes `target.closest("[data-blockid]")` and routes to `zoomBlockIn/Out`.

The **per-pane path** converges on `setBlockZoom(blockId, factor)` which writes `term:zoom` on the block's meta via `SetMeta` RPC. Other components read it back through their block atom.

The **chrome path** (`chromeZoomIn/Out/Reset`) updates `chromeZoomAtom` and the `--zoomfactor` CSS variable in memory; it does NOT write block meta. Don't look for chrome zoom under `term:zoom` — it lives in the atom, scoped to the running renderer, and resets on reload.

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

- **Mirror trigger.** When a `SetMeta` updates `term:zoom` on a block that carries an `agentId` (i.e. an agent pane), [`service.rs`](https://github.com/agentmuxai/agentmux/blob/main/agentmux-srv/src/server/service.rs) calls `schedule_agent_zoom_mirror(agent_id, zoom)` (≈ line 2825). Non-agent blocks are untouched.
- **Debounced — one write per burst.** The mirror is a 300ms **trailing** debounce backed by a per-agent generation counter. A spin of `Ctrl+Wheel` fires many `term:zoom` writes, but only the last survives the debounce window and commits, so there's no durable-write amplification (each commit also does a single global def-registry re-mirror).
- **Reset deletes the row.** The frontend writes `term:zoom = null` when the user returns to 1.0. The mirror reads that `null` and **deletes** the `ui:zoom` row (`agent_content_delete`) rather than storing `1.0`. An agent the user never zoomed (or reset) persists nothing — defaults stay clean. Implementation in [`content.rs`](https://github.com/agentmuxai/agentmux/blob/main/agentmux-srv/src/backend/storage/content.rs).
- **Restore on reopen.** When a pane opens, [`app_api.rs`](https://github.com/agentmuxai/agentmux/blob/main/agentmux-srv/src/server/app_api.rs) `agent.open` (≈ line 330) reads the agent's saved `ui:zoom` and seeds the new block's `term:zoom` from it, clamped to `[0.5, 2.0]` (`parse_seed_zoom`, which also rejects out-of-range and default `1.0` values). Layer 1 then applies it exactly as if the user had just set it.
- **Global / cross-channel.** Because `ui:zoom` is a per-agent content blob, it is global cross-channel — `agent_content_set`/`agent_content_delete` re-mirror it to the shared definition registry. Reopening the *same agent* in a different window, channel, or server instance restores its zoom, not just within the channel where it was set.

The result: zoom feels like an agent-level preference (it follows the agent everywhere) while the frontend still reads and writes only the block-scoped `term:zoom` it always has.

### Zoom-invariant busy bar

Agent panes apply CSS `zoom` to the whole view root, which would also scale the marching-ants **busy bar** at the bottom of the pane. To keep that bar a fixed on-screen size regardless of pane zoom, `agent-view.tsx` also sets a CSS variable `--agent-pane-zoom` alongside `zoom` on the root, and [`_control-bar.scss`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/view/agent/styles/_control-bar.scss) **counter-scales** the bar's dimensions and animation by dividing by `var(--agent-pane-zoom)`. So the content zooms but the busy indicator stays visually constant.

## Limits

- **Range**: 0.5x to 2.0x. Constants in `zoom.win32.ts` (`MIN_ZOOM`, `MAX_ZOOM`).
- **Steps**: 0.1 (keyboard, `KEYBOARD_STEP`) or 0.05 (wheel, `WHEEL_STEP`). The skip-to-next-pixel logic in `stepZoom` ensures a keyboard step always changes the rendered terminal font by at least 1px (avoids "I pressed Ctrl++ but nothing changed").
- **Font bounds**: terminal fonts clamp to `[4, 64]` px regardless of zoom factor — the store enforces this in `computeEffectiveFontSize`.

## See also

- Spec: [`docs/specs/zoom-architecture.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/zoom-architecture.md) — the original design that established the universal framework, plus follow-ups for chrome zoom + pane-header zoom routing.
- Spec: `SPEC_AGENT_ZOOM_PERSISTENCE` — the durable per-agent `ui:zoom` layer (debounced mirror, reset-deletes, cross-channel restore).
- Source:
  - [`frontend/app/store/zoom.win32.ts`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/store/zoom.win32.ts) (canonical implementation; macOS and Linux variants only override platform-specific compensation)
  - [`frontend/app/store/keymodel.ts`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/store/keymodel.ts) (Ctrl+/-/0 bindings)
  - [`frontend/app/app.tsx`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/app.tsx) (Ctrl+Wheel routing)
  - [`agentmux-srv/src/server/service.rs`](https://github.com/agentmuxai/agentmux/blob/main/agentmux-srv/src/server/service.rs) (`schedule_agent_zoom_mirror` — debounced `term:zoom` → `ui:zoom` mirror)
  - [`agentmux-srv/src/server/app_api.rs`](https://github.com/agentmuxai/agentmux/blob/main/agentmux-srv/src/server/app_api.rs) (`agent.open` seeds `term:zoom` from saved `ui:zoom`; `parse_seed_zoom`)
  - [`agentmux-srv/src/backend/storage/content.rs`](https://github.com/agentmuxai/agentmux/blob/main/agentmux-srv/src/backend/storage/content.rs) (per-agent content store + global def-registry mirror)
  - [`frontend/app/view/agent/styles/_control-bar.scss`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/view/agent/styles/_control-bar.scss) (zoom-invariant busy bar via `--agent-pane-zoom`)
