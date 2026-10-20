---
title: Persistence
description: How srv keeps session state in its per-version stores (objects.db, filestore.db, sagas.db), how agents persist across channels, and the launcher's event log.
---

This page covers the per-version stores srv keeps session state in, how agents persist across channels, and the launcher's event log. AgentMux also keeps machine-wide databases under `~/.agentmux/shared/` (accounts, bundles and memory, the Skills and MCP catalogs, every agent's conversation) and a channel-wide `wan.db`; [Data structure](/internals/data-structure/) maps all eight databases and every other file.

## At a glance

| File | Format | Writer | Owns |
|---|---|---|---|
| `objects.db` | SQLite | sidecar | Workspaces, tabs, blocks, windows, layouts, controllers + the agent-definition / identity / memory / drone catalog — the app-domain reducer state of record |
| `filestore.db` | SQLite | sidecar | Per-block content blobs (agent configs, snapshots, file-pane content) |
| `sagas.db` | SQLite | sidecar | Saga step + lifecycle rows for the srv sagas (compensated after a crash) |
| `launcher-events.log` | JSONL | launcher | Append-only Layer 1 reducer event log (durable, OS-level facts) |

All four live under the **version-scoped** data dir at `<data-dir>/data/`. For installed/portable builds the data dir is version-scoped — `~/.agentmux/channels/<channel>/versions/<version>/data/` — so two concurrent release versions never share these files or their caches (they do share the machine-wide stores under `shared/`). Dev builds use `~/.agentmux/dev/<branch>/<clone-id>/data/`. SQLite files are inside `data/db/`; the JSONL log is directly in `data/`. See [Data layout](/internals/data-layout/) for how `<channel>` and `<version>` are derived.

> **Not everything is version-scoped.** Alongside `data/`, the version dir also holds `logs/`, `cef-cache/`, and `runtime/` (ipc-port, lock). But `config/` (settings, including shortcut overrides) and `agents/` (agent working dirs) live one level **up**, at the **channel-wide** root `~/.agentmux/channels/<channel>/` — so settings and agent working dirs survive version upgrades. Path resolution is in [`data_paths.rs`](https://github.com/agentmuxai/agentmux/blob/main/crates/common/src/data_paths.rs).

Resolution is centralized in [`agentmux-common::DataPaths`](https://github.com/agentmuxai/agentmux/blob/main/crates/common/src/data_paths.rs) — the launcher resolves once and exports `AGENTMUX_DATA_DIR`; host + sidecar read it from env.

## `objects.db` — sidecar reducer state

Owned by `agentmux-srv`. Opened via `Store::open(<data-dir>/db/objects.db)` in [`crates/srv/src/bootstrap/stores.rs`](https://github.com/agentmuxai/agentmux/blob/main/crates/srv/src/bootstrap/stores.rs).

Stores every:

- **Workspace** — top-level container, identity + window membership
- **Tab** — per-window tab list with layout root pointer
- **Block** — every pane (terminal, browser, agent, file, system metrics, …) including its meta map (controller type, agent id, URL, scroll position, …)
- **Window** — OS-window record; the host reads this on launch to restore window geometry
- **Layout** — per-tab pane tree (split orientation, focus path, sizes)
- **Client** — per-CEF-session client record

It also holds the agent domain: one `db_agents` row per agent (definition
and latest launch state — the separate definition and instance tables were
merged), the agent's content, skills, keys and input history, and **drone
runs**. Accounts, bundles, drone definitions and the Skills and MCP catalogs
live in the shared stores; `objects.db` keeps fallback copies of those tables
for when the shared stores can't be opened. The full table list is in
[Data structure](/internals/data-structure/#objectsdb).

The schema is a single flat table set built by `run_object_schema`
(`crates/srv/src/backend/storage/migrations.rs`), which adds missing tables
and columns every time the file is opened. Data changes go through numbered
migrations (`crates/srv/src/migrations/`), recorded in `db_migrations`. A
`PRAGMA user_version` stamp (currently 44) acts as a downgrade tripwire.

This is where "I closed the app and reopened it; my tabs are back" comes from. If you delete `objects.db`, the next launch copies it forward again from the newest older version of the same channel, if there is one, and otherwise comes up with a single empty workspace.

### Bootstrap + persist subscriber

At startup the sidecar's reducer loads its in-memory state from `objects.db` ([`bootstrap_state_from_mstore`](https://github.com/agentmuxai/agentmux/blob/main/crates/srv/src/persist.rs)). During the session, **HTTP/WS RPC writes still go directly to SQLite via `wcore`** — SQLite stays authoritative even if the reducer's session-only projection diverges.

A separate **persist subscriber** ([`crates/srv/src/persist_subscriber.rs`](https://github.com/agentmuxai/agentmux/blob/main/crates/srv/src/persist_subscriber.rs)) consumes the reducer's broadcast bus and mirrors lifecycle events back to SQLite for entities the reducer owns. On a `Lagged` error it does a scoped full-resync (insert/update only, never delete — there's a code comment explaining the migration-window reason).

Migration status: workspaces are reducer-driven (E.2c.2 onward); tab + block writes are still mostly RPC-direct.

## Cross-channel agent persistence

`objects.db` is authoritative **per channel**, but user agents are meant to follow
you everywhere — an agent created in one channel (or one release version) should
appear, fully configured, in all of them. That globalization is implemented by a
**definition-registry mirror** that shadows local `objects.db` agent mutations into
an account-wide store. See
[`SPEC_CROSS_CHANNEL_AGENT_PERSISTENCE`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/SPEC_CROSS_CHANNEL_AGENT_PERSISTENCE_2026-06-13.md)
and [`def_registry_mirror.rs`](https://github.com/agentmuxai/agentmux/blob/main/crates/srv/src/backend/storage/def_registry_mirror.rs).

### The two global stores

Both live under `~/.agentmux/shared/agents/` (account-wide, channel- and
version-independent), as siblings resolved in
[`registry/paths.rs`](https://github.com/agentmuxai/agentmux/blob/main/crates/srv/src/registry/paths.rs):

- **Definition registry** — `~/.agentmux/shared/agents/definitions/` — the global
  copy of each user agent's *definition* (the launchable catalog entry).
- **Instances registry** — `~/.agentmux/shared/agents/registry/` — the named
  cross-channel *instances* (a running/launched agent's identity).

### What travels with the definition

A global definition record is not just the row from `db_agents`. The
mirror (`agent_definition_to_record`) folds the agent's **content blobs** (e.g.
instructions, the per-agent `ui:zoom`) and its **skills** into the same record,
because both live in separate local tables and must travel together for a
cross-channel agent to launch with its instructions intact.

### Authority and read direction

- **Local SQLite stays authoritative for writes** within its channel. The global
  store is a cross-channel **read view**, never a write target that overrides
  local truth.
- **Reads are global-first for the roster.** `agent_def_list` overlays the global
  user-agent roster so an agent that exists only in another channel still shows up.
- **Content + skills fall back to the global record** when the agent has no local
  SQLite row (the cross-channel case), so it launches with its instructions.

### Symmetric mirroring (set *and* delete)

Every local mutation re-mirrors via `registry_def_upsert`:

- `agent_content_set` **and** `agent_content_delete` both re-mirror — so a
  reset-to-default that deletes a local content row propagates the deletion
  globally, not just the addition.
- Skills mirror the same way (insert and delete).

To make that safe, the mirror reads the local row with **local-only** accessors
(`agent_content_get_all_local` / `agent_skill_list_local`). If it read through the
global-fallback accessors, deleting a local blob would re-read the still-present
global copy and re-mirror it straight back, defeating the deletion.

### Deletes are global tombstones

Deleting a user agent calls `registry_def_retire`, which writes a `retired/`
**tombstone** into the definition store rather than just removing the active
record. The tombstone is what stops a *stale* `objects.db` in another channel from
resurrecting a deleted agent on its next `registry_def_upsert` — `upsert` refuses
to revive a tombstoned id. A delete works even for an agent that exists only
globally (no local SQLite row): the retire path still tombstones and reports
success.

### Resume across channels

The instances registry carries a `session_id` (added in schema v1→v2, see
[`registry/schema.rs`](https://github.com/agentmuxai/agentmux/blob/main/crates/srv/src/registry/schema.rs))
so a cross-channel agent's **conversation can resume** rather than starting cold
when it's opened from a different channel or version.

### Seeded vs user agents

Only **user** agents go global. Seeded template agents stay **local** (per-channel):
they're manifest-managed and re-seeded into each channel, and their hide flag is
per-channel UI state — so the mirror skips any definition with `is_seeded != 0`.

## `filestore.db` — content blobs

Same writer (`agentmux-srv`), opened via `FileStore::open(<data-dir>/db/filestore.db)`. It holds per-block files, addressed by zone (the block's oid) and name, stored in 64 KB parts: terminal scrollback (`term`), agent output (`output`) and its index and state files. Agents' conversations are also written to a machine-wide transcripts store at `~/.agentmux/shared/agents/transcripts/filestore.db`, with the same schema, so they open from any channel or version (see [Data structure](/internals/data-structure/#filestoredb-per-version-and-shared-transcripts)).

Deleting `filestore.db` keeps your workspace structure, which is in `objects.db`, but loses each block's scrollback and output history in this version; agent conversations remain in the shared transcripts store.

## `sagas.db` — sidecar saga coordinator

Per [`SPEC_PHASE_E_SAGAS_2026-04-30.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/SPEC_PHASE_E_SAGAS_2026-04-30.md) (Path A — chosen during Phase E.5), srv's sagas run multi-step workspace, tab and block commands such as tear-off, redock and delete (see [How sagas fit](/internals/reducer-stack/#how-sagas-fit)). `sagas.db` records each saga's lifecycle and each step's command and outcome ([`crates/srv/src/sagas/log.rs`](https://github.com/agentmuxai/agentmux/blob/main/crates/srv/src/sagas/log.rs)).

After a crash, srv doesn't resume an interrupted saga, it undoes it. At startup, before the API server accepts requests, `compensate_unresolved` ([`crates/srv/src/sagas/recovery.rs`](https://github.com/agentmuxai/agentmux/blob/main/crates/srv/src/sagas/recovery.rs)) walks each unresolved saga's succeeded steps in reverse and dispatches their inverse commands. A step with no inverse it can derive is logged for review, and the saga is marked `failed_compensation`.

## Launcher sagas aren't persisted

The launcher's two sagas, `pool_respawn` and `window_cleanup` (`crates/launcher/src/saga/`), keep their state in an in-memory registry. Both narrate cleanup the host does on its own, and srv rebuilds windows from its own state after a crash, so an interrupted launcher saga leaves nothing to recover. Their transitions are in the launcher log, prefixed `[saga]`. Older versions kept a `launcher-sagas.db`; the launcher deletes it at startup.

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

- **Cold-copy `~/.agentmux/shared/`, `~/.agentmux/channels/` and `~/.agentmux/agents/`** while AgentMux is closed. A version's `data/` folder alone misses the shared stores most of your data is in.
- **Hot copy of an individual SQLite file** while AgentMux is open: use `sqlite3 <file> ".backup <copy>"`, not a plain file copy, which can miss recent writes still in the `-wal` file. JSONL log is append-only and safe to copy at any time.

Re-importing into a fresh install: stop AgentMux, place the files back where they came from, remove any `-wal` and `-shm` files beside the restored databases, and launch. See [Data structure → Backing up and restoring](/internals/data-structure/#backing-up-and-restoring).

## What's NOT here

Things that are NOT stored in these four files:

- **Settings** — JSON at the **channel-wide** `~/.agentmux/channels/<channel>/config/settings.json` (`~/.agentmux/channels/settings.json` for the stable channel); **not** under `versions/<version>/`, so settings survive version upgrades
- **Agent working directories** — `~/.agentmux/agents/<slug>/`, shared by every channel (the agent *definitions* themselves live in `objects.db` locally and in the global registry — see above)
- **Accounts, bundles, memory, Skills and MCP catalogs** — the machine-wide `~/.agentmux/shared/store.db` and `shared/identity-store.db` (see [Data structure](/internals/data-structure/))
- **Provider sign-ins** — provider login folders under `~/.agentmux/shared/providers/` and `shared/identities/`; MuxBus tokens in the OS keychain
- **Cookies and spell-check dictionaries** — Chromium's version-scoped `versions/<version>/cef-cache/`, copied forward to a new version on its first start
- **Global agent registry** — user-agent definitions + named instances live account-wide under `~/.agentmux/shared/agents/` (see [Cross-channel agent persistence](#cross-channel-agent-persistence))
- **Cross-process session-ownership leases** — `~/.agentmux/shared/agents/registry/leases/<instance_id>.lease.json`, a sibling directory of the instances registry above, **not** part of any per-channel/per-version `<data-dir>/data/` tree at all. One JSON file per agent `instance_id`: TTL-based (renewed every 5s, reclaimable once ~3 renewals are missed — `LEASE_TTL_MS`/`RENEW_INTERVAL_MS`) and scoped to a `boot_id`, so at most one process can hold the right to drive a given agent's turns at a time in host-mode. Guarded by a real OS advisory lock (`flock`/`LockFileEx`) for the claim/renew/release critical section, not the atomic-rename-only pattern `Registry::upsert` uses elsewhere. See [`crates/srv/src/registry/leases.rs`](https://github.com/agentmuxai/agentmux/blob/main/crates/srv/src/registry/leases.rs).
- **Chromium cache** — version-scoped `~/.agentmux/channels/<channel>/versions/<version>/cef-cache/`
- **CLI provider configs** — each provider CLI's own config folder, which AgentMux points at `~/.agentmux/shared/providers/<provider>/` or `shared/identities/<id>/<provider>/`

## See also

- [Data structure](/internals/data-structure/) — every database and file, and which builds share it
- [Architecture overview](/internals/architecture/) — process topology
- [Multi-instance & dev mode](/multi-instance/) — full data-dir layout
- [Reducer stack](/internals/reducer-stack/) — how persistence relates to the reducer model
- [Debugging](/internals/debugging/) — log discovery + diagnostic recipes
