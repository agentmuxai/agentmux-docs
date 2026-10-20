---
title: Data layout
description: The on-disk layout for AgentMux — per-channel data dirs, per-instance runtime artifacts, account-wide shared state, pointer-file log discovery.
---

This page documents the on-disk layout AgentMux uses to isolate state across builds and to make log files discoverable from any context. For the user-facing perspective ("how do I run multiple versions side-by-side?") see [Running multiple instances](/multi-instance/). For every database and file, what it holds and which builds share it, see [Data structure](/internals/data-structure/).

The on-disk layout is keyed by **channel** and, within a channel, by **version** (as of v0.41.1). The channel persists settings across versions — so per-channel config survives upgrades. Agent definitions, accounts, memory and conversations are shared even more broadly: account-wide under `shared/`, by every channel, version and dev build on the computer (see [Account-wide (shared) contents](#account-wide-shared-contents)). The version sub-directory separates each release's own databases (`objects.db`, `filestore.db`, `sagas.db`), browser cache and logs, so two concurrent releases don't share session state or corrupt each other's caches; the shared databases under `shared/` are opened by all of them at once. Across channels (`stable`, `dev-<branch>`, and the per-build `local-<branch>-<hash>-<build-id>` channels) session state, settings and the WAN identity are separate; everything under `shared/` is not. Dev mode adds a further axis — per **clone** — so two checkouts of the same branch don't fight each other on lockfiles, pipes, or data dirs.

## Channels: what they replace

Earlier builds isolated by **version** — each new build got a fresh, empty `~/.agentmux/versions/<version>/`, and `task package` bumped the version on every build, so each portable reset My Agents and discarded conversation history. Channels collapse the per-version dirs into one per-channel dir, and `task package` no longer bumps at all — local builds carry an ephemeral *label*, not a new version (see [Building → local build labels](/internals/building/)). Agent definitions and auth then moved further still, into the account-wide `shared/` tree, so they survive across **every** channel — including each per-build `local-<branch>-<hash>-<build-id>` channel.

## Runtime modes, channels, and data directories

| Runtime mode | Default channel | Data directory |
|---|---|---|
| **Installed** (production install) | `stable` | Runtime root: `~/.agentmux/channels/stable/versions/<version>/` (`data/` for SQLite, `logs/`, `cef-cache/`, `runtime/` are siblings under it). Channel root: `~/.agentmux/channels/stable/` (`config/`, `wan-identity/`, `logs/` — shared across versions). See [Per-channel contents](#per-channel-contents) for the full breakdown. |
| **Portable** (downloaded released `.7z`) | `stable` | Same as installed — both bind to the `stable` channel |
| **Portable** (local `task package` build) | `local-<branch>-<hash>-<build-id>` | `~/.agentmux/channels/local-<branch>-<hash>-<build-id>/versions/<version>/` — version-scoped like any Installed/Portable build. The channel is baked per build (compile-time `AGENTMUX_BUILD_CHANNEL_DEFAULT`), so **each rebuild gets a different channel** and its own isolated data dir — two rebuilds of the same branch do **not** share a session. |
| **Dev** (`task dev`) | `dev-<branch>` | `~/.agentmux/dev/<branch>/<clone-id>/` |

Dev mode lives outside `channels/` on purpose: branches are short-lived and numerous, so promoting each one to a first-class channel would clutter the namespace. The `<clone-id>` segment was added when [PR #1053](https://github.com/agentmuxai/agentmux/pull/1053) generalized Dev mode to also be per-clone — see [Per-clone isolation in Dev mode](#per-clone-isolation-in-dev-mode) below.

Each local `task package` build is its own isolated AgentMux instance. The channel string is baked into the binary at compile time (`AGENTMUX_BUILD_CHANNEL_DEFAULT`) as `local-<branch>-<hash>-<build-id>`, so two rebuilds of the *same* branch produce *different* channels — different `<hash>`/`<build-id>` — and therefore different data dirs, CEF caches, and single-instance pipes. Launching a freshly-built binary always runs that build rather than joining a still-running sibling. These per-build channels accumulate on disk; clean up unused `~/.agentmux/channels/local-*` manually when no instance from that build is running. Because agent definitions and auth are account-wide under `shared/` (see [Account-wide (shared) contents](#account-wide-shared-contents)), a fresh per-build data dir still shows every agent, its conversations and memory, and stays logged in — only the pane layout and settings start fresh. A new **release** in the same channel doesn't start fresh at all: on its first start it copies the previous version's databases and browser sign-ins (see [How data reaches a new version](/internals/data-structure/#how-data-reaches-a-new-version)).

The mode is detected at startup by `agentmux-common`'s runtime-mode probe ([`crates/common/src/runtime_mode.rs`](https://github.com/agentmuxai/agentmux/blob/main/crates/common/src/runtime_mode.rs)). The channel is derived from the mode, with an override:

- `AGENTMUX_CHANNEL=<name>` — pin the channel explicitly. Useful for parallel-channel testing (`AGENTMUX_CHANNEL=beta agentmux.exe`) or for letting a dev build share state with a portable. Has no effect in Dev mode (Dev branches don't traverse `channels/`).

Resolution is centralized in [`agentmux-common::DataPaths`](https://github.com/agentmuxai/agentmux/blob/main/crates/common/src/data_paths.rs). The launcher resolves once at startup and exports `AGENTMUX_DATA_DIR`, `AGENTMUX_CONFIG_DIR`, `AGENTMUX_LOG_DIR`, etc. as env vars; host and sidecar read them from env. All three processes always agree on paths. Host and srv both write their logs to `AGENTMUX_LOG_DIR`, the version's `logs/` folder, and terminals and agents started by AgentMux see the same `AGENTMUX_LOG_DIR` (see [Log discovery via pointer files](#log-discovery-via-pointer-files) below). Only srv started without a launcher falls back to `~/.agentmux/logs/`.

### Per-clone isolation in Dev mode

Dev mode is keyed by two segments under `~/.agentmux/dev/`:

1. **`<branch>`** — the git branch you're on (`main`, `agentx/foo`, etc.), slugified. Two `task dev` sessions on different branches always isolate.
2. **`<clone-id>`** — a 16-char FNV-1a hash of the clone's workspace-root absolute path. Two `task dev` sessions on the **same** branch but from different clones (e.g. `C:\repo1\agentmux` and `D:\repo2\agentmux`) get distinct subdirs and isolate fully.

Without this second segment, two clones on the same branch would resolve to the same `~/.agentmux/dev/<branch>/` and silently collide on:

- the single-instance lockfile,
- the launcher's IPC socket/pipe (the second clone's launcher would route opens into the first clone's window),
- the data dir and logs.

Each `task dev` derives its `clone-id` from `current_exe()` at launch, hashes the canonical lowercase path, and threads it into [`RuntimeMode::Dev { branch, clone_id }`](https://github.com/agentmuxai/agentmux/blob/main/crates/common/src/runtime_mode.rs). It travels to host and sidecar via `AGENTMUX_CLONE_ID`.

`task dev` also derives a per-clone **Vite port** the same way (`5173 + cksum(workspace-root) % 200`), so the dev server doesn't fight `--strictPort` on a single hardcoded port either. Override with `AGENTMUX_VITE_PORT=<n> task dev` if you need a specific port.

Legacy `dev/<branch>/` data from before [PR #1053](https://github.com/agentmuxai/agentmux/pull/1053) is left in place — it isn't auto-migrated into a clone-id subdir. If you launch a binary that doesn't supply `AGENTMUX_CLONE_ID`, path resolution falls back to the pre-PR two-level `dev/<branch>/` layout for back-compat.

### Schema safety lock + snapshots

Migrations are **forward-only**. When a newer binary opens a store whose schema is older, it runs the migrations on launch. When an *older* binary tries to open a store whose schema is **newer** than it knows about, it refuses to open with a `StoreError::SchemaTooNew` and an actionable error message — protecting against downgrade corruption. Each release has its own `objects.db`, so in practice the lock matters most for the machine-wide stores under `shared/` (`store.db`, `identity-store.db`, the transcripts store), which every build opens: a build that raises their schema version locks older builds out. The schema versions per database are listed in [Data structure](/internals/data-structure/#schema-versions-and-migrations).

Pre-migration snapshots auto-save when `objects.db`'s schema is older than the running build's, inside that version's data folder, and prune to the last 5 there:

```
channels/<channel>/versions/<v>/data/snapshots/<channel>-pre-v<code-version>-<ISO8601>.bak/
  ├── objects.db
  ├── sagas.db
  └── filestore.db
```

(Dev builds: `dev/<branch>/<clone-id>/data/snapshots/`. Older versions wrote them to `~/.agentmux/snapshots/`.)

The snapshot is a `VACUUM INTO` copy of each of the per-version SQLite stores (`objects.db`, `sagas.db`, `filestore.db`) — atomic and WAL-consistent regardless of journal state. Snapshot failure is logged but non-fatal (refusing to boot when the backup can't be written would be worse than booting without one; the safety lock still prevents downgrade corruption). Snapshots don't cover the shared stores. Separately, before running migrations srv copies `shared/store.db` and `objects.db` to `~/.agentmux/shared/backups/pre-migration-<version>-<time>/`, kept for 30 days.

To roll back manually if a migration goes wrong, close AgentMux, copy the snapshot's `*.db` files back into `channels/<channel>/versions/<v>/data/db/`, and remove any `-wal` and `-shm` files beside them. There's no CLI for this yet — it's a planned follow-up.

## Per-channel contents

As of v0.41.1, installed and portable release builds split channel contents into **version-scoped** paths (one set per release) and **channel-wide** paths (shared across all versions of the same channel):

**Version-scoped** — `channels/<channel>/versions/<version>/`

| Path | Owns |
|---|---|
| `versions/<v>/data/` | SQLite stores live in `data/db/` — `objects.db` (reducer state), `sagas.db` (srv saga log), `filestore.db` (per-block content) — plus `snapshots/`, the JSONL event logs (`launcher-events.log`, `srv-events.log`), `srv.lock`, the host's `ipc-port-<hash>` file, attachments and update downloads directly in `data/`. The full list is in [Data structure](/internals/data-structure/#per-version). |
| `versions/<v>/logs/` | Host and srv logs (rotated daily, 7-day retention), `cef-debug.log`, and the `current-*.path` pointer files |
| `versions/<v>/cef-cache/` | Chromium cookies, local storage, IndexedDB, service workers, cached JS; named browser profiles in `profile-<id>/` |
| `versions/<v>/runtime/` | Created at startup, currently unused. The single-instance lock is the launcher's named pipe (Windows) or Unix domain socket, outside `~/.agentmux` |

**Channel-wide** — `channels/<channel>/`

| Path | Owns |
|---|---|
| `config/` | Settings (`settings.json`, including the `keybindings` shortcut overrides) and `widgets.json` for every channel except `stable`, which keeps them one level up in `channels/settings.json` and `channels/widgets.json`. Also a GitHub CLI config folder per agent and remote-host records. Provider credentials are **not** here — they moved to the account-wide `~/.agentmux/shared/providers/<provider>/` in v0.45 (see [Auth flows](/auth/)). |
| `wan-identity/` | `wan.db`: the channel's WAN instance and agent keys, shared by every version of the channel |
| `logs/` | `current-host-v<version>.path`, a pointer to the current host log (see [Log discovery](#log-discovery-via-pointer-files)) |
| `updates/<version>/` | An unpacked update, when it can't be placed beside the running install |
| `agents/` | Created, but agent working folders are not here: they live at `~/.agentmux/agents/<slug>/`, shared by every channel |

Older docs and shell-integration scripts use `<data-dir>` as a single placeholder; treat it as the version-scoped root `channels/<channel>/versions/<v>/` when the context is runtime state (DB, logs, cache, IPC), and the channel root `channels/<channel>/` when the context is agents or settings. The distinction is resolved automatically by `agentmux-common::DataPaths` and exported as `AGENTMUX_DATA_DIR`, `AGENTMUX_CONFIG_DIR`, `AGENTMUX_LOG_DIR` — you don't need to manage it manually.

See [Persistence](/internals/persistence/) for what each SQLite file holds and which process writes it.

## Account-wide (shared) contents

A single tree at `~/.agentmux/`, independent of channel:

| Path | Purpose | Owner |
|---|---|---|
| `~/.agentmux/shared/` | Account-wide state, independent of channel and version: the shared databases (`store.db`, `identity-store.db`, `agents/transcripts/filestore.db`), provider login folders (`shared/providers/<provider>/`, `shared/identities/<id>/<provider>/`), the global agent **definition** registry (`shared/agents/definitions/`), the global agent **instances** registry (`shared/agents/registry/` — cross-channel agents plus their `session_id` for resume), and pre-migration backups (`shared/backups/`). Browser cookies and spell-check dictionaries are *not* here; they live in the version-scoped `versions/<v>/cef-cache/`. The full list is in [Data structure](/internals/data-structure/#machine-wide). | srv |
| `~/.agentmux/agents/<slug>/` | Agent working folders, shared by every channel | srv |
| `~/.agentmux/widgets/<id>/` | Installed widgets | srv |
| `~/.agentmux/logs/agentmux-launcher.log` | The launcher's own log; rotates at 50 MB, keeping 3 old files | Launcher |
| `~/.agentmux/logs/migration-error.log` | The last failed `agentmux-srv migrate` run | srv |

The durable launcher reducer event log (`launcher-events.log`) lives at `channels/<channel>/versions/<v>/data/launcher-events.log` (v0.41.1+). Multiple instances of the **same (channel, version)** running concurrently append to this single file; a different release on the same channel writes to its own version-scoped file.

## Log discovery via pointer files

Host and srv write their logs to the version's `logs/` folder (`$AGENTMUX_LOG_DIR`), with the version and date in each file name. Next to them, each writes a pointer file naming its current log:

```
channels/<channel>/versions/<v>/logs/current-host-v<version>.path
channels/<channel>/versions/<v>/logs/current-srv-v<version>.path
```

Both hold the log's file name, relative to that folder. The host writes a second copy of its pointer three levels up, so the log can be found from outside the version folder: `channels/<channel>/logs/current-host-v<version>.path` for a release, `~/.agentmux/dev/logs/current-host-v<version>.path` for a dev build. That copy holds the **absolute path** to the current log file:

```
C:\Users\you\.agentmux\channels\stable\versions\0.59.34\logs\agentmux-host-v0.59.34.log.2026-10-20
```

Inside a terminal or agent started by AgentMux, `$AGENTMUX_LOG_DIR` and `$AGENTMUX_VERSION` are set, so the recipe is:

```bash
tail -F "$AGENTMUX_LOG_DIR/$(cat "$AGENTMUX_LOG_DIR/current-host-v$AGENTMUX_VERSION.path")"
tail -F "$AGENTMUX_LOG_DIR/$(cat "$AGENTMUX_LOG_DIR/current-srv-v$AGENTMUX_VERSION.path")"
```

Older versions wrote srv's log and both pointers to `~/.agentmux/logs/`; files there from those versions are left in place.

### `muxlog` helper

The shell-integration scripts shipped to AgentMux's own terminals expose a `muxlog` helper that wraps the pointer-file dance:

```bash
muxlog host          # tail the current host log
muxlog srv           # tail the sidecar log
muxlog host '\[fe\]' # filter the host log to frontend [fe] lines
muxlog host cat      # full file contents (instead of tailing)
```

The helper detects whether the pointer holds a basename (legacy) or an absolute path (newer versions), so the same command works against any version.

## In-memory ring + disk overflow

The launcher's reducer event log is backed by an in-memory ring buffer (4096 entries). Recent events are queryable from a running instance without touching disk; every event is also appended to `<data-dir>/data/launcher-events.log` for durability, which rotates to `launcher-events.log.old` at 8 MiB.

This is the canonical forensic source when something feels off at the OS level: a window vanished, a pane drifted, a monitor disconnect lost focus. Search recipes:

```bash
# Windows / Git Bash / muxlog-style
grep -E "HiddenSinceOpen|HwndWithoutBrowser|WRR-DRIFT|wfr:gate|wfr:runner|pending=" \
    "$AGENTMUX_DATA_DIR/launcher-events.log"
```

See [Window Reality Reconciliation](/internals/wrr/) for what the WRR drift records mean.

## Backup + portability

A version's `data/` folder is only part of your data: accounts, agents, memory and conversations live in the shared databases under `~/.agentmux/shared/`.

- **Cold-copy `~/.agentmux/shared/`, `~/.agentmux/channels/` and `~/.agentmux/agents/`** while AgentMux is closed — that's the simplest, most reliable backup.
- **Hot copy of an individual SQLite file** while AgentMux is open: use `sqlite3 <file> ".backup <copy>"`, never a plain file copy, which can miss recent writes still in the `-wal` file. The JSONL event logs are append-only and safe to copy at any time.

Restoring: stop AgentMux, put the files back where they came from, remove any `-wal` and `-shm` files beside the restored databases, and launch. See [Data structure → Backing up and restoring](/internals/data-structure/#backing-up-and-restoring).

## See also

- [Running multiple instances](/multi-instance/) — user-facing perspective
- [Data structure](/internals/data-structure/) — every database and file, and which builds share it
- [Persistence](/internals/persistence/) — what each SQLite store holds
- [Architecture overview](/internals/architecture/) — process topology
- [Window Reality Reconciliation](/internals/wrr/) — what the launcher event log records
- [Auth flows](/auth/) — provider credential storage model (account-wide under shared/providers/)
