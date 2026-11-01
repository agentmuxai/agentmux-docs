---
title: The reducer stack
description: How state flows through AgentMux — the 4-layer launcher / host / srv / frontend-slice model, sagas, and persistence.
---

AgentMux is built on a strict reducer model. Every cross-process state mutation goes through a single layer's reducer, emits events that other layers project, and is persisted by the layer that owns the truth. This page is the entry point into that model.

The migration was tracked in [`docs/specs/MASTER_REDUCER_STACK_STATUS_2026-05-05.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/MASTER_REDUCER_STACK_STATUS_2026-05-05.md) in the source repo, with [Discussion #707](https://github.com/agentmuxai/agentmux/discussions/707) as the rolling thread. Where either disagrees with the code, the code is current.

## Why a reducer stack?

Three pressures drove it:

1. **Multi-process truth** — the launcher knows OS facts, the host knows CEF facts, the sidecar knows app facts. Without a reducer model, each process develops ad-hoc gossip channels and the shared mental model rots.
2. **Auditable mutations** — every command leaves a trail. Bug reports become "find the last `dispatch(blockId, MoveBlockToWindow)` for that block_id" instead of "did anyone call `setUrl()` mid-load?".
3. **Testable invariants** — pure `update(state, command)` functions are unit-testable without a CEF context. The `agent-pane-state` slice has 32 invariants asserted in its test file alone; none of them require a running app.

## The five layers

<img src="/diagrams/reducer-stack.svg" alt="Reducer stack: five layers from bottom (Persistence) through Srv, Launcher, Host up to Frontend, connected by labeled arrows showing data flow." style="max-width:100%" />

There are three reducers in Rust, one per process, each a pure `update` function over its own `State`:

| | Launcher | Host (cef) | Sidecar (srv) |
|---|---|---|---|
| Source | `crates/launcher/src/reducer/` | `crates/cef/src/reducer/` | `crates/srv/src/reducer.rs` + `crates/srv/src/reducer/` |
| Commands | the shared `agentmux_common::ipc::Command` | its own `HostCommand` (34 variants), host-internal, never on a pipe | the shared `agentmux_common::ipc::Command` |
| Output | `Vec<Event>`, which the saga coordinator subscribes to | a `DispatchOutput` whose Win32/CEF effects the caller applies | `Vec<Event>`, which the persist subscriber writes to SQLite |

The launcher and srv reducers share the wire types and the same discipline (total, deterministic, the state lock held only for the dispatch), but not their `State` or the commands each handles. A command one of them doesn't handle gets a non-fatal error event back rather than a silent success.

### Layer 1 — Launcher

Single-writer reducer over OS-level facts: processes, the mirror of every window, the warm pool, monitors and the instance registry. Lives in `crates/launcher/src/reducer/`. On Windows it also reconciles AgentMux's own model against Win32 reality via WRR hooks. On Linux and macOS it is the same reducer behind a Unix-domain-socket IPC server; WRR is Windows-only by design (see [WRR](/internals/wrr/)). Durable JSONL event log at `<data-dir>/data/launcher-events.log`. **Status:** done.

### Layer 2 — Host

CEF-side coordination, in `crates/cef/src/reducer/`: pending window creations, browser panes and the browser map, drag sessions, the window pool and the floating-pane pool, quit, per-window opacity, and floating-pane window state. Callers go through `AppState::host_dispatch`, which holds the state lock briefly and never across a CEF callback; the CEF calls the result asks for happen after it is released. Quit-on-last-window (#1676) routes through the `count_live_user_windows` gate in [`crates/cef/src/reducer/quit.rs`](https://github.com/agentmuxai/agentmux/blob/main/crates/cef/src/reducer/quit.rs), and the window-count consolidation (#1701) keeps the status-bar count accurate after CEF Views closes, via an explicit `WindowClosed` event plus snapshot reconciliation in the frontend. **Status:** done. The window-to-HWND map and redock's window classification still live outside it; that remaining work is tracked in [`SPEC_REDUCER_SSOT_CONSOLIDATION_2026_06_22`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/SPEC_REDUCER_SSOT_CONSOLIDATION_2026_06_22.md).

### Layer 3 — Sidecar (srv)

Owns the app domain: workspaces, tabs, block ids, which workspace each window shows, and each tab's layout tree with its focus and magnify. Lives in `crates/srv/src/reducer.rs` plus the per-domain modules in `crates/srv/src/reducer/` (`block.rs`, `tab.rs`, `layout.rs`, `lifecycle.rs`, `snapshot.rs`, `window.rs`, `workspace.rs`). Multi-step commands (tear-off, restore, redock, delete) run as srv sagas. An idempotent persist subscriber writes the events back to SQLite. **Status:** done.

### Layer 4 — Frontend slices

Per-pane (and a few global) state cells that project the layers above into Solid signals. Each slice is a pure `update(state, command) → { state, events }` in a `reducer.ts`, with a store beside it that owns the signals and does the I/O. The per-pane stores keep one slot per pane (`register`, `dispatch`, `unregister`); the global ones keep one state. All of them are in `frontend/app/store/`, and each has a test file.

| Slice | Where | What it owns |
|---|---|---|
| agent-document | `agent-document/`, `agent-document-store.ts` | A pane's message list: the nodes, the session phase and the dedup index. Every change to the list is a command |
| agent-pane-state | `agent-pane-state/`, `agent-pane-state-store.ts` | A pane's streaming state: session stats, the current tool, turn tokens, the turn phase, queued messages and the stream watchdog. Views read `isWorking(state)` and `state.turnPhase`, not separate flags |
| agent-pane-layout | `agent-pane-layout/`, `agent-pane-layout-store.ts` | The layout of the agent pane's virtualized list: measured and estimated row heights, expansion state, zoom and the scroll viewport. Row positions are a prefix sum of the heights, so rows can't overlap |
| browser-pane-state | `browser-pane-state/`, `browser-pane-state-store.ts` | A Browser pane's tabs (each with `url`, `title`, `faviconUrl` and navigation state) and its `closed` flag, with commands for the host's page events, such as `PaneClicked`. Commands from the backend carry `source: "backend"`, so a navigation the host reported isn't sent back to it |
| drone-run-state | `drone-run-state/`, `drone-run-state-store.ts` | A Drone pane's run: the run id, its status, each block's result, and the final output or error, folded from the run's event stream. The canvas editing state stays in the view |
| editor-pane-state | `editor-pane-state-store.ts` (one file) | An Editor pane's open buffers (path, language, load state, scratch identity), the dirty-close confirmation and the audit ring. The tab list itself is the shared model in `doc-tabs` |
| launch-phase-state | `launch-phase-state/` | An agent pane's launch and login state after the pane is mounted: the launch phase, the pane's own login attempts and the counter they share |
| launcher-event | `launcher-event/`, `launcher-event-store.ts` | One global slice that mirrors the launcher's window state into the frontend (see [Layer 1](#layer-1--launcher)) |
| window-opacity | `window-opacity/`, `window-opacity-store.ts` | One opacity per window, keyed by the window's label (a main window or a floating pane), kept between 0.35 and 1.0; fully opaque is "no entry". The native call lives in the store, not the reducer |

Pure state machines that aren't slices: the document-tab model (`doc-tabs`), the layout tree functions (`frontend/layout/lib/layoutTree.ts`), predictive echo in the terminal, and the agent pane's scroll-follow.

**Conventions.** A slice follows the same few rules, and there is no shared framework for them: the reducer is pure and does no I/O; a command carries a `source` (`"user"`, `"system"`, or an agent); a slice that has two writers for the same value guards against the echo loop between them (the Browser pane's `source: "backend"` above); and a closed pane's later commands are dropped and logged, not applied.

**What is not a frontend slice.** The layout tree and the tabs are srv's (Layer 3: `crates/srv/src/reducer/layout.rs` and `tab.rs`), and the window has no reducer of its own for them. A layout edit is applied to the window's local tree at once, so it shows with no round trip, and sent to srv as an intent (`frontend/layout/lib/layoutIntents.ts`). srv applies the same action to its own tree, and what srv stores is the layout: when nothing of the window's is in flight, the window compares its tree with the stored one and takes srv's if they differ. Pane-tab commands go to srv the same way, in the same queue.

## The pattern, end-to-end

A user clicks a link inside a browser pane. Here's what happens:

1. **CEF** captures the click. Win32 `WM_LBUTTONDOWN` fires on the pane's HWND.
2. **Host** emits `browser-pane-clicked` over the JS bridge. The launcher (Layer 1) records nothing — this is a renderer concern.
3. **Frontend slice** receives the event. The Browser pane's model dispatches a `PaneClicked` command to the browser-pane-state slot. The slot's event sink blurs any main-input that held stale DOM focus (so `giveFocus()` doesn't bounce OS focus back), then calls `refocusNode(blockId)`. Both the command and the event land in the audit ring.
4. **Layout** marks the pane focused in the window's tree at once, and sends a layout intent to srv.
5. **Sidecar** applies the same action to its own tree and persists the new layout via the persist subscriber. The next time the user opens the same workspace, the focus is restored.

If any of those hops fails — host doesn't emit, slice doesn't dispatch, the intent isn't sent, sidecar doesn't persist — there's exactly one place to look. That's the value the reducer stack delivers over the prior ad-hoc model.

## Auditing dispatches

`frontend/app/store/command-source.ts` records who initiated each frontend command and keeps one ring of the last 500 dispatches, in memory only. Each store calls `recordDispatch(...)` after it applies a command, passing the slice name, the pane's key, the command, the events it emitted, its source and a timestamp. Every slice does this except window-opacity. There is no single outbound command bus: each store's `dispatch` is its own entry point, and the ring only observes them. The dev-mode diagnostics panel lists the ring, so "what mutated this state?" becomes filtering it for the relevant key.

## How sagas fit

Sagas are the "what should happen as a side effect of this state change" layer: a multi-step flow that dispatches several reducer commands and reports its progress as `SagaStarted`, then `SagaCompleted` or `SagaFailed`. There are two saga frameworks, one in the launcher and one in srv. They share the module name and the event names, and nothing else. That split is deliberate, recorded in [`DECISION_SAGA_REDUCER_TWO_FRAMEWORKS_2026_09_07.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/architecture/DECISION_SAGA_REDUCER_TWO_FRAMEWORKS_2026_09_07.md).

- **Launcher** (`crates/launcher/src/saga/`): a `Saga` trait plus a `SagaCoordinator` that subscribes to the launcher's event bus. A trigger event starts a saga, later bus events are routed into it through `on_event`, and it answers with `SagaAction`s (for example, a command for the host). It was built for flows that cross processes, and has two sagas: `pool_respawn`, which brackets refilling the window pool after a pool window is promoted, and `window_cleanup`, which brackets the cleanup after a user window closes. Their state lives in memory; there is no launcher saga database (the old `launcher-sagas.db` is deleted at startup). Every transition is logged to the launcher log with a `[saga]` prefix.
- **srv** (`crates/srv/src/sagas/`): plain async functions. Each one allocates a saga id, emits `SagaStarted`, drives its steps through `SagaCtx::dispatch` (an in-process dispatch into the srv reducer, no IPC round trip), compensates with `SagaCtx::compensate` if a step fails, and emits the terminal event; `run_saga` wraps it with a timeout. Every srv saga changes only srv state, which is why it doesn't use the launcher's coordinator. The sagas tear off a tab or a block, restore a torn-off tab, promote a block to a tab, redock a floating pane, close a pane, and delete a block, a tab or a workspace. (The same module also holds agent teardown, the orphan reaper and the shutdown paths, which run outside `run_saga`.) Their steps are logged to `sagas.db`; see [Persistence](/internals/persistence/#sagasdb--sidecar-saga-coordinator).

Frontend slices subscribe to the terminal saga events; orchestration is upstream. This is intentional: the frontend can't be the source of truth for "did this flow actually finish?" — the answer lives in the saga's own events, and the frontend projects it.

## Persistence boundary

Each layer's persistence is independent:

| Store | Writer | What |
|---|---|---|
| `objects.db` (SQLite) | sidecar | block / tab / window / workspace meta, layouts |
| `filestore.db` (SQLite) | sidecar | per-block content blobs (agent configs, snapshots) |
| `sagas.db` (SQLite) | sidecar | srv saga steps, compensated after a crash |
| `launcher-events.log` (JSONL) | launcher | append-only event log; in-memory ring with disk overflow |

Launcher sagas aren't persisted: their registry is in memory, and a fresh launcher starts with an empty one.

Each can be backed up independently. None of them depend on a single point of failure.

## Reading the source

The TypeScript slice surface is documented in the [TypeScript API reference](/api/typescript/) on this site (the four slice store files). For the host and sidecar reducer code, see the upstream Rust source in the [agentmux repo](https://github.com/agentmuxai/agentmux): the reducers in `crates/launcher/src/reducer/`, `crates/cef/src/reducer/`, and `crates/srv/src/reducer.rs` with `crates/srv/src/reducer/`; the sagas in `crates/launcher/src/saga/` and `crates/srv/src/sagas/`.

For deep design docs:

- [`docs/architecture/DECISION_SAGA_REDUCER_TWO_FRAMEWORKS_2026_09_07.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/architecture/DECISION_SAGA_REDUCER_TWO_FRAMEWORKS_2026_09_07.md) — why the launcher and srv saga and reducer frameworks stay separate
- [`docs/specs/MASTER_REDUCER_STACK_STATUS_2026-05-05.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/MASTER_REDUCER_STACK_STATUS_2026-05-05.md) — the migration's status tracker, layer by layer
- [`docs/specs/frontend-reducer-architecture-2026-05-03.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/frontend-reducer-architecture-2026-05-03.md) — frontend slice model
- [`docs/specs/frontend-reducer-conventions-2026-05-03.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/frontend-reducer-conventions-2026-05-03.md) — Command/event types, slot lifecycle, audit, echo-loop guard
- [`docs/specs/frontend-reducer-implementation-plan-2026-05-03.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/frontend-reducer-implementation-plan-2026-05-03.md) — slice ordering and PR boundaries
- [Discussion #707](https://github.com/agentmuxai/agentmux/discussions/707) — rolling thread; append PRs and gap closures here, don't fork
