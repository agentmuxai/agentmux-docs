---
title: The reducer stack
description: How state flows through AgentMux — the 4-layer launcher / host / srv / frontend-slice model, sagas, and persistence.
---

AgentMux is built on a strict reducer model. Every cross-process state mutation goes through a single layer's reducer, emits events that other layers project, and is persisted by the layer that owns the truth. This page is the entry point into that model.

The canonical living document for current status is [`docs/specs/MASTER_REDUCER_STACK_STATUS_2026-05-05.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/MASTER_REDUCER_STACK_STATUS_2026-05-05.md) in the source repo. The rolling tracking thread is [Discussion #707](https://github.com/agentmuxai/agentmux/discussions/707). Both are appended to as work ships.

## Why a reducer stack?

Three pressures drove it:

1. **Multi-process truth** — the launcher knows OS facts, the host knows CEF facts, the sidecar knows app facts. Without a reducer model, each process develops ad-hoc gossip channels and the shared mental model rots.
2. **Auditable mutations** — every command leaves a trail. Bug reports become "find the last `dispatch(blockId, MoveBlockToWindow)` for that block_id" instead of "did anyone call `setUrl()` mid-load?".
3. **Testable invariants** — pure `update(state, command)` functions are unit-testable without a CEF context. The `agent-pane-state` slice has 32 invariants asserted in its test file alone; none of them require a running app.

## The four layers

```
Frontend (renderer / SolidJS)         per-process atoms        consumer
   ▲ slice-based reducer migration (9 slices, in flight)
   ┃ CEF JS bridge ▲ events
Host (agentmux-cef)                   FFI + UI thread           Layer 2
   ▲ pending_window_creations, active_drag, tear_off_hooks
   ▲ deliberately retained scaffolding: browsers, window_pool
   ┃ launcher → host pipe (in flight)
Launcher (agentmux-launcher)          process & OS facts        Layer 1
   ▲ lifecycle, processes, windows, monitors, pool, registries
   ▲ WRR (Window Reality Reconciliation) via Win32 hooks
   ┃ launcher pipe (named pipe IPC)
Srv (agentmux-srv)                    app domain                Layer 3
   ▲ workspaces, tabs, blocks, layouts, agents, identity
   ▲ saga coordinator (Path A — chosen E.5)
   ┃ persist subscriber (idempotent SQLite write-back)
Persistence                                                      durability
   ▲ objects.db, filestore.db, sagas.db, launcher-sagas.db
   ▲ launcher-events.log (JSONL); in-memory ring (4096) + disk
```

### Layer 1 — Launcher

Single-writer reducer over OS-level facts. Lives in `agentmux-launcher`. Reconciles AgentMux's own model against Win32 reality via WRR (Window Reality Reconciliation) hooks. Durable JSONL event log at `<instance>/data/launcher-events.log` (per-instance). **Status:** done.

### Layer 2 — Host

CEF-side coordination: pending window creations, active drag operations, tear-off hooks, lifecycle. Lives in `agentmux-cef`. **Status:** partial — Phase B.5 shadow mirrors shipped; the host's own reducer migration is in flight.

### Layer 3 — Sidecar (srv)

Owns the app domain — every workspace, tab, block, layout, agent identity, forge definition. Lives in `agentmux-srv/src/reducer.rs` plus the per-domain modules (`block.rs`, `tab.rs`, `layout.rs`, `lifecycle.rs`, `snapshot.rs`, `window.rs`, `workspace.rs`). Saga coordinator handles cross-block lifecycle. Idempotent persist subscriber writes back to SQLite. **Status:** mostly done.

### Layer 4 — Frontend slices

Per-pane state cells that project the layers above into Solid signals. Each slice is a pure `update(state, command) → { state, events }` plus a slot store with `register / dispatch / unregister` lifecycle.

| Slice | What it owns | Status |
|---|---|---|
| #1 — agent-document-store | Per-pane document state cell | **shipped** |
| #2 — conventions | Slot lifecycle, audit trail, echo-loop guard | spec done |
| #3 — frontend-command-bus | Single outbound dispatch chokepoint | spec done |
| #4 — agent-pane-state-store | Streaming, sessionStats, currentTool, turnTokens, turnActive, stopping, pending | **shipped** |
| #5 — frontend-layout-reducer | Per-tab pane tree | spec done |
| #6 — launcher-event-reducer | Mirrors launcher window state into the frontend | **shipped** |
| #7 — tab-state-reducer | Active tab, tab order | spec done |
| #8 — pane-tree-reducer | Cross-tab pane mapping | deferred |
| #9 — browser-pane-state | Per-pane `closed` / `loading` / `error` / `canGoBack` / `canGoForward` / `title` (cells migrated); `url`, `faviconUrl` pending | **partial**: 4 phases shipped (3a/b/c/e); danger-cell `url` migration (3d) + slot store + `recordDispatch` (4) pending |

## The pattern, end-to-end

A user clicks a link inside a browser pane. Here's what happens:

1. **CEF** captures the click. Win32 `WM_LBUTTONDOWN` fires on the pane's HWND.
2. **Host** emits `browser-pane-clicked` over the JS bridge. The launcher (Layer 1) records nothing — this is a renderer concern.
3. **Frontend slice** receives the event. The handler blurs any main-input that held stale DOM focus (so `giveFocus()` doesn't bounce OS focus back), then calls `refocusNode(blockId)`. _Today this is a direct call site; Phase 4 routes it through a `PaneClicked` reducer command + slot dispatch so the audit ring records every transition._
4. **Saga** turns the event into a side effect: layout's focus state updates. The layout slice (#5) records the change.
5. **Sidecar** persists the new layout via the persist subscriber. The next time the user opens the same workspace, the focus is restored.

If any of those four hops fails — host doesn't emit, slice doesn't subscribe, saga drops the event, sidecar doesn't persist — there's exactly one place to look. That's the value the reducer stack delivers over the prior ad-hoc model.

## Auditing dispatches

Every slice routes through `command-source.ts`'s `recordDispatch(...)` helper, which appends a structured record (slice name, key, command, emitted events, source, timestamp) to an in-memory ring buffer. The diagnostics panel surfaces this; debugging a "what mutated this state?" question becomes filtering the ring for the relevant key.

## How sagas fit

Sagas are the "what should happen as a side effect of this state change" layer. They live srv-side per [`SPEC_PHASE_E_SAGAS_2026-04-30.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/SPEC_PHASE_E_SAGAS_2026-04-30.md) (Path A — chosen during Phase E.5). Frontend slices subscribe to terminal saga events; orchestration is upstream.

This is intentional: the frontend can't be the source of truth for "did this CLI command actually finish?" — the answer lives in the sidecar's saga state, and the frontend projects it.

## Persistence boundary

Each layer's persistence is independent:

| Store | Writer | What |
|---|---|---|
| `objects.db` (SQLite) | sidecar | block / tab / window / workspace meta, layouts |
| `filestore.db` (SQLite) | sidecar | per-block content blobs (forge agents, snapshots) |
| `sagas.db` (SQLite) | sidecar | saga state for crash-resume |
| `launcher-sagas.db` (SQLite) | launcher | launcher-side saga state |
| `launcher-events.log` (JSONL) | launcher | append-only event log; in-memory ring with disk overflow |

Each can be backed up independently. None of them depend on a single point of failure.

## Reading the source

The TypeScript slice surface is documented in the [TypeScript API reference](/api/typescript/) on this site (the four slice store files). For the host and sidecar reducer code, see the upstream Rust source — `agentmux-launcher/src/reducer/`, `agentmux-cef/src/`, and `agentmux-srv/src/reducer/` in the [agentmux repo](https://github.com/agentmuxai/agentmux).

For deep design docs:

- [`docs/specs/MASTER_REDUCER_STACK_STATUS_2026-05-05.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/MASTER_REDUCER_STACK_STATUS_2026-05-05.md) — current status across all layers
- [`docs/specs/frontend-reducer-architecture-2026-05-03.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/frontend-reducer-architecture-2026-05-03.md) — frontend slice model
- [`docs/specs/frontend-reducer-conventions-2026-05-03.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/frontend-reducer-conventions-2026-05-03.md) — Command/event types, slot lifecycle, audit, echo-loop guard
- [`docs/specs/frontend-reducer-implementation-plan-2026-05-03.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/frontend-reducer-implementation-plan-2026-05-03.md) — slice ordering and PR boundaries
- [Discussion #707](https://github.com/agentmuxai/agentmux/discussions/707) — rolling thread; append PRs and gap closures here, don't fork
