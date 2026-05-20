---
title: Persistence
description: The four SQLite stores and one JSONL log AgentMux writes — what each owns, who writes them, and how to back them up.
---

AgentMux persists state across five files, owned by two processes (sidecar + launcher). This page enumerates them and explains the boundary.

## At a glance

| File | Format | Writer | Owns |
|---|---|---|---|
| `objects.db` | SQLite | sidecar | Workspaces, tabs, blocks, windows, layouts, controllers + the agent-definition / identity / memory / drone catalog — the app-domain reducer state of record |
| `filestore.db` | SQLite | sidecar | Per-block content blobs (agent configs, snapshots, file-pane content) |
| `sagas.db` | SQLite | sidecar | Saga step + lifecycle rows for the srv saga coordinator (crash-resume) |
| `launcher-sagas.db` | SQLite | launcher | Launcher-side saga state (LSD-1 batch onward) |
| `launcher-events.log` | JSONL | launcher | Append-only Layer 1 reducer event log (durable, OS-level facts) |

All five live under the per-version data dir at `<data-dir>/data/` (i.e. `~/.agentmux/versions/<v>/data/` for installed/portable, `~/.agentmux/dev/<branch>/data/` for `task dev`). SQLite files are inside `data/db/`; the JSONL log is directly in `data/`.

Resolution is centralized in [`agentmux-common::DataPaths`](https://github.com/agentmuxai/agentmux/blob/main/agentmux-common/src/data_paths.rs) — the launcher resolves once and exports `AGENTMUX_DATA_DIR`; host + sidecar read it from env.

## `objects.db` — sidecar reducer state

Owned by `agentmux-srv`. Opened via `WaveStore::open(<data-dir>/db/objects.db)` in `agentmux-srv/src/main.rs`. The historical type name `WaveStore` predates the AgentMux rebrand — the file itself is `objects.db`.

Stores every:

- **Workspace** — top-level container, identity + window membership
- **Tab** — per-window tab list with layout root pointer
- **Block** — every pane (terminal, browser, agent, file, system metrics, …) including its meta map (controller type, agent id, URL, scroll position, …)
- **Window** — OS-window record; the host reads this on launch to restore window geometry
- **Layout** — per-tab pane tree (split orientation, focus path, sizes)
- **Client** — per-CEF-session client record
- **Controller** — block controller registration (shell, command runner, web view)

It also holds the agent domain: **agent definitions** (the launchable agent
catalog — formerly "Forge"), **identity** and **memory bundles**, per-launch
**agent instances**, and **drone** definitions/runs.

The schema is a single flat table set built by `run_object_schema`
(`agentmux-srv/src/backend/storage/migrations.rs`) — no migration ladder. A
`PRAGMA user_version` stamp acts as a downgrade tripwire.

This is where "I closed the app and reopened it; my tabs are back" comes from. If you delete `objects.db`, the next launch comes up with a single empty workspace.

### Bootstrap + persist subscriber

At startup the sidecar's reducer loads its in-memory state from `objects.db` ([`bootstrap_state_from_wstore`](https://github.com/agentmuxai/agentmux/blob/main/agentmux-srv/src/persist.rs)). During the session, **HTTP/WS RPC writes still go directly to SQLite via `wcore`** — SQLite stays authoritative even if the reducer's session-only projection diverges.

A separate **persist subscriber** ([`agentmux-srv/src/persist_subscriber.rs`](https://github.com/agentmuxai/agentmux/blob/main/agentmux-srv/src/persist_subscriber.rs)) consumes the reducer's broadcast bus and mirrors lifecycle events back to SQLite for entities the reducer owns. On a `Lagged` error it does a scoped full-resync (insert/update only, never delete — there's a code comment explaining the migration-window reason).

Migration status: workspaces are reducer-driven (E.2c.2 onward); tab + block writes are still mostly RPC-direct.

## `filestore.db` — content blobs

Same writer (`agentmux-srv`), opened via `FileStore::open(<data-dir>/db/filestore.db)`. Where blob content lives: agents' generated config files, session archives, file-pane buffers, captured screenshots. `objects.db` holds the meta — `filestore.db` holds the bytes.

You can rebuild `filestore.db` from scratch (you'll lose snapshots) without losing your workspace structure. The reverse is not true — `objects.db` references blobs by hash; deleting `filestore.db` while keeping `objects.db` leaves dangling references that the file pane will report as missing.

## `sagas.db` — sidecar saga coordinator

Per [`SPEC_PHASE_E_SAGAS_2026-04-30.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/SPEC_PHASE_E_SAGAS_2026-04-30.md) (Path A — chosen during Phase E.5), sagas coordinate cross-block side effects (e.g. "open an agent in a new pane and wait for the controller to come up"). `sagas.db` records each step's start, completion, retry, and final status.

On crash the saga coordinator reads back from `sagas.db` and resumes pending sagas from their last durable step — that's the point of having a durable log instead of in-memory state.

## `launcher-sagas.db` — launcher saga state

Added by the LSD-1 batch (2026-05-01). Same role as `sagas.db` but for sagas the launcher coordinates (window-pool warmup, window-detach, monitor-change reconciliation). Owned by `agentmux-launcher`.

## `launcher-events.log` — Layer 1 event log

JSONL, append-only. Written by the launcher's `event_log::run_disk_writer` task to `<data-dir>/launcher-events.log`. Holds every command + event the launcher reducer processed: process spawn/exit, window create/destroy, monitor changes, drag operations, tear-off events. Includes WRR (Window Reality Reconciliation) drift records.

In-memory ring buffer (4096 entries) backs disk overflow — recent events are queryable from a running instance without touching disk.

This is the canonical forensic source when something feels off at the OS level: a window vanished, a pane drifted, a monitor disconnect lost focus. Search recipes:

```bash
# Windows / Git Bash / muxlog-style
grep -E "HiddenSinceOpen|HwndWithoutBrowser|WRR-DRIFT|wfr:gate|wfr:runner|pending=" \
    "$AGENTMUX_DATA_DIR/launcher-events.log"
```

## Backup + portability

Each file is independently restorable:

- **Cold-copy the whole `<data-dir>/data/` directory** while AgentMux is closed — that's the simplest, most reliable backup.
- **Hot copy of an individual SQLite file** while AgentMux is open is supported because the writer holds short transactions; use `sqlite3 .backup`. JSONL log is append-only and safe to copy at any time.

Re-importing into a fresh install: stop AgentMux, place the files at `<data-dir>/data/db/` (and the log at `<data-dir>/data/`), and launch. Bootstrap reads them.

## What's NOT here

For completeness, things that are NOT stored in these five files:

- **Settings** — JSON at `<data-dir>/config/settings.json`
- **Agent working directories** — per-agent workspace dirs under `<data-dir>/agents/` (the agent *definitions* themselves live in `objects.db`)
- **Cookies / OAuth tokens / dictionary downloads** — `~/.agentmux/shared/` (account-wide, version-independent)
- **Chromium cache** — `<data-dir>/cef-cache/`
- **CLI provider configs** — auth-config-dir managed by each provider's CLI

## See also

- [Architecture overview](/internals/architecture/) — process topology
- [Multi-instance & dev mode](/multi-instance/) — full data-dir layout
- [Reducer stack](/internals/reducer-stack/) — how persistence relates to the reducer model
- [Debugging](/internals/debugging/) — log discovery + diagnostic recipes
