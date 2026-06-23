---
title: Data layout
description: The on-disk layout for AgentMux — per-channel data dirs, per-instance runtime artifacts, account-wide shared state, pointer-file log discovery.
---

This page documents the on-disk layout AgentMux uses to isolate state across builds and to make log files discoverable from any context. For the user-facing perspective ("how do I run multiple versions side-by-side?") see [Running multiple instances](/multi-instance/). For the SQLite stores themselves, see [Persistence](/internals/persistence/).

The on-disk layout is keyed by **channel** and, within a channel, by **version** (as of v0.41.1). The channel persists settings across versions — so per-channel config survives upgrades; agent definitions and auth are shared even more broadly (account-wide under `shared/`, see [Account-wide (shared) contents](#account-wide-shared-contents)). The version sub-directory isolates the runtime DBs, cache, and logs so two concurrent releases can't collide on SQLite writes or corrupt each other's caches. Across channels (`stable`, `dev-<branch>`, and the per-build `local-<branch>-<hash>-<build-id>` channels) state is fully isolated. Dev mode adds a further axis — per **clone** — so two checkouts of the same branch don't fight each other on lockfiles, pipes, or data dirs.

## Channels: what they replace

Earlier builds isolated by **version** — each new build got a fresh, empty `~/.agentmux/versions/<version>/`, and `task package` bumped the version on every build, so each portable reset My Agents and discarded conversation history. Channels collapse the per-version dirs into one per-channel dir, and `task package` no longer bumps at all — local builds carry an ephemeral *label*, not a new version (see [Building → local build labels](/internals/building/)). Agent definitions and auth then moved further still, into the account-wide `shared/` tree, so they survive across **every** channel — including each per-build `local-<branch>-<hash>-<build-id>` channel.

## Runtime modes, channels, and data directories

| Runtime mode | Default channel | Data directory |
|---|---|---|
| **Installed** (production install) | `stable` | Runtime root: `~/.agentmux/channels/stable/versions/<version>/` (`data/` for SQLite, `logs/`, `cef-cache/`, `runtime/` are siblings under it). Channel root: `~/.agentmux/channels/stable/` (`agents/`, `config/` — shared across versions). See [Per-channel contents](#per-channel-contents) for the full breakdown. |
| **Portable** (downloaded released ZIP) | `stable` | Same as installed — both bind to the `stable` channel |
| **Portable** (local `task package` build) | `local-<branch>-<hash>-<build-id>` | `~/.agentmux/channels/local-<branch>-<hash>-<build-id>/versions/<version>/` — version-scoped like any Installed/Portable build. The channel is baked per build (compile-time `AGENTMUX_BUILD_CHANNEL_DEFAULT`), so **each rebuild gets a different channel** and its own isolated data dir — two rebuilds of the same branch do **not** share a session. |
| **Dev** (`task dev`) | `dev-<branch>` | `~/.agentmux/dev/<branch>/<clone-id>/` |

Dev mode lives outside `channels/` on purpose: branches are short-lived and numerous, so promoting each one to a first-class channel would clutter the namespace. The `<clone-id>` segment was added when [PR #1053](https://github.com/agentmuxai/agentmux/pull/1053) generalized Dev mode to also be per-clone — see [Per-clone isolation in Dev mode](#per-clone-isolation-in-dev-mode) below.

Each local `task package` build is its own isolated AgentMux instance. The channel string is baked into the binary at compile time (`AGENTMUX_BUILD_CHANNEL_DEFAULT`) as `local-<branch>-<hash>-<build-id>`, so two rebuilds of the *same* branch produce *different* channels — different `<hash>`/`<build-id>` — and therefore different data dirs, CEF caches, and single-instance pipes. Launching a freshly-built binary always runs that build rather than joining a still-running sibling. These per-build channels accumulate on disk; clean up unused `~/.agentmux/channels/local-*` manually when no instance from that build is running. Because agent definitions and auth are account-wide under `shared/` (see [Account-wide (shared) contents](#account-wide-shared-contents)), a fresh per-build data dir still shows every agent and stays logged in — only pane layout and memories start fresh.

The mode is detected at startup by `agentmux-common`'s runtime-mode probe ([`agentmux-common/src/runtime_mode.rs`](https://github.com/agentmuxai/agentmux/blob/main/agentmux-common/src/runtime_mode.rs)). The channel is derived from the mode, with an override:

- `AGENTMUX_CHANNEL=<name>` — pin the channel explicitly. Useful for parallel-channel testing (`AGENTMUX_CHANNEL=beta agentmux.exe`) or for letting a dev build share state with a portable. Has no effect in Dev mode (Dev branches don't traverse `channels/`).

Resolution is centralized in [`agentmux-common::DataPaths`](https://github.com/agentmuxai/agentmux/blob/main/agentmux-common/src/data_paths.rs). The launcher resolves once at startup and exports `AGENTMUX_DATA_DIR`, `AGENTMUX_CONFIG_DIR`, `AGENTMUX_LOG_DIR`, etc. as env vars; host and sidecar read them from env. All three processes always agree on paths — with one carve-out: the sidecar's own log file is initialized to the shared `~/.agentmux/logs/` directly (see [Log discovery via pointer files](#log-discovery-via-pointer-files) below). The host log respects the per-channel `AGENTMUX_LOG_DIR`. PTY shells spawned by the sidecar also see `AGENTMUX_LOG_DIR=~/.agentmux/logs/`, so `muxlog` lookups resolve uniformly.

### Per-clone isolation in Dev mode

Dev mode is keyed by two segments under `~/.agentmux/dev/`:

1. **`<branch>`** — the git branch you're on (`main`, `agentx/foo`, etc.), slugified. Two `task dev` sessions on different branches always isolate.
2. **`<clone-id>`** — a 16-char FNV-1a hash of the clone's workspace-root absolute path. Two `task dev` sessions on the **same** branch but from different clones (e.g. `C:\repo1\agentmux` and `D:\repo2\agentmux`) get distinct subdirs and isolate fully.

Without this second segment, two clones on the same branch would resolve to the same `~/.agentmux/dev/<branch>/` and silently collide on:

- the single-instance lockfile,
- the launcher's IPC socket/pipe (the second clone's launcher would route opens into the first clone's window),
- the data dir and logs.

Each `task dev` derives its `clone-id` from `current_exe()` at launch, hashes the canonical lowercase path, and threads it into [`RuntimeMode::Dev { branch, clone_id }`](https://github.com/agentmuxai/agentmux/blob/main/agentmux-common/src/runtime_mode.rs). It travels to host and sidecar via `AGENTMUX_CLONE_ID`.

`task dev` also derives a per-clone **Vite port** the same way (`5173 + cksum(workspace-root) % 200`), so the dev server doesn't fight `--strictPort` on a single hardcoded port either. Override with `AGENTMUX_VITE_PORT=<n> task dev` if you need a specific port.

Legacy `dev/<branch>/` data from before [PR #1053](https://github.com/agentmuxai/agentmux/pull/1053) is left in place — it isn't auto-migrated into a clone-id subdir. If you launch a binary that doesn't supply `AGENTMUX_CLONE_ID`, path resolution falls back to the pre-PR two-level `dev/<branch>/` layout for back-compat.

### Schema safety lock + snapshots

Migrations are **forward-only**. When a newer binary opens a channel whose schema is older, it runs the migrations on launch. When an *older* binary tries to open a channel whose schema is **newer** than it knows about, it refuses to open with a `StoreError::SchemaTooNew` and an actionable error message — protecting against downgrade corruption.

Pre-migration snapshots auto-save when an upgrade-with-migration is detected, then prune to the last 5 per channel:

```
~/.agentmux/snapshots/<channel>-pre-v<code-version>-<ISO8601>.bak/
  ├── objects.db
  └── sagas.db
```

The snapshot is a `VACUUM INTO` copy of each SQLite store — atomic and WAL-consistent regardless of journal state. Snapshot failure is logged but non-fatal (refusing to boot when the backup can't be written would be worse than booting without one; the safety lock still prevents downgrade corruption).

To roll back manually if a migration goes wrong, close AgentMux and copy the snapshot's `*.db` files back into `channels/<channel>/versions/<v>/data/db/` (v0.41.1+), matching the version whose runtime DB you want to restore. There's no CLI for this yet — it's a planned follow-up.

## Per-channel contents

As of v0.41.1, installed and portable release builds split channel contents into **version-scoped** paths (one set per release) and **channel-wide** paths (shared across all versions of the same channel):

**Version-scoped** — `channels/<channel>/versions/<version>/`

| Path | Owns |
|---|---|
| `versions/<v>/data/` | SQLite stores live in `data/db/` — `objects.db` (reducer state), `sagas.db` + `launcher-sagas.db` (saga logs), `filestore.db` (per-block content) — plus the launcher's JSONL event log (`launcher-events.log`) directly in `data/` |
| `versions/<v>/logs/` | Host logs (rotated daily, 7-day retention). **Sidecar logs are not here** — they live at `~/.agentmux/logs/` (account-wide), see [Account-wide (shared) contents](#account-wide-shared-contents) below. |
| `versions/<v>/cef-cache/` | Chromium cookies, local storage, IndexedDB, service workers, cached JS |
| `versions/<v>/runtime/` | Runtime IPC artifacts (the `ipc-port` file and single-instance `lock`; named-pipe sockets on Windows / Unix domain sockets on Linux + macOS) |

**Channel-wide** — `channels/<channel>/`

| Path | Owns |
|---|---|
| `agents/` | Per-agent working dirs — channel-wide so they survive version upgrades. The cross-channel agent **definition** and **instance** registries are *not* here — they live account-wide under `shared/agents/` (see [Account-wide (shared) contents](#account-wide-shared-contents)). |
| `config/` | Settings (`settings.json`, `keybindings.json`). Provider credentials are **not** here — they moved to the account-wide `~/.agentmux/shared/providers/<provider>/` in v0.45 (see [Auth flows](/auth/)). |

Older docs and shell-integration scripts use `<data-dir>` as a single placeholder; treat it as the version-scoped root `channels/<channel>/versions/<v>/` when the context is runtime state (DB, logs, cache, IPC), and the channel root `channels/<channel>/` when the context is agents or settings. The distinction is resolved automatically by `agentmux-common::DataPaths` and exported as `AGENTMUX_DATA_DIR`, `AGENTMUX_CONFIG_DIR`, `AGENTMUX_LOG_DIR` — you don't need to manage it manually.

See [Persistence](/internals/persistence/) for what each SQLite file holds and which process writes it.

## Account-wide (shared) contents

A single tree at `~/.agentmux/`, independent of channel:

| Path | Purpose | Owner |
|---|---|---|
| `~/.agentmux/shared/` | Account-wide state, independent of channel and version: dictionary downloads, provider OAuth/API-key credentials (`shared/providers/<provider>/`), the global agent **definition** registry (`shared/agents/definitions/`), and the global agent **instances** registry (`shared/agents/registry/` — cross-channel agents plus their `session_id` for resume). Browser cookies are *not* here; CEF cookies live in the version-scoped `versions/<v>/cef-cache/`. | All hosts |
| `~/.agentmux/logs/current-host-v<version>.path` | Pointer file resolving to the running host's log path (absolute) | Host (write-through) |
| `~/.agentmux/logs/agentmuxsrv-v<version>.log.<date>` | The sidecar's daily log file (lives directly in the shared dir, not the per-channel data dir) | Sidecar |
| `~/.agentmux/logs/current-srv-v<version>.path` | Pointer file resolving to the running sidecar's log basename (relative to the same dir) | Sidecar (write-through) |
| `~/.agentmux/logs/agentmux-launcher.log` | The launcher's own startup-phase log (single file, no rotation) | Launcher |
| `~/.agentmux/config.toml` | Account-wide launcher config (saga retention, etc.) | Launcher |

The durable launcher reducer event log (`launcher-events.log`) lives at `channels/<channel>/versions/<v>/data/launcher-events.log` (v0.41.1+). Multiple instances of the **same (channel, version)** running concurrently append to this single file; a different release on the same channel writes to its own version-scoped file.

## Log discovery via pointer files

The host writes its own logs to `<data-dir>/logs/`. To make those discoverable from any context (e.g. a `muxlog` shell helper running in an unrelated terminal), the host **also** writes a pointer file under the shared `~/.agentmux/logs/` directory:

```
~/.agentmux/logs/current-host-v<version>.path
```

The pointer file's contents are the **absolute path** to the current log file:

```
C:\Users\area54\.agentmux\channels\stable\versions\0.41.2\logs\agentmux-host-v0.41.2.log.2026-06-03
```

So the canonical "find the running host's log" recipe is:

```bash
LOG="$(cat ~/.agentmux/logs/current-host-v<version>.path)"
tail -F "$LOG"
```

The sidecar uses the same pointer-file scheme but with a twist: its log file lives directly in `~/.agentmux/logs/` (hard-coded in `agentmux-srv` init, not under the per-channel data dir), so `current-srv-v<version>.path` stores just the basename relative to that directory. The literal recipe:

```bash
LOG=~/.agentmux/logs/"$(cat ~/.agentmux/logs/current-srv-v<version>.path)"
tail -F "$LOG"
```

(`$AGENTMUX_LOG_DIR` inside AgentMux-spawned terminals also points at `~/.agentmux/logs/` — the sidecar overrides it in `shell.rs` when spawning PTYs — but the launcher's process-level export is per-instance, so the literal path is the unambiguous form.)

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

The launcher's reducer event log is backed by an in-memory ring buffer (4096 entries). Recent events are queryable from a running instance without touching disk; older events spill to `<data-dir>/data/launcher-events.log` for durability.

This is the canonical forensic source when something feels off at the OS level: a window vanished, a pane drifted, a monitor disconnect lost focus. Search recipes:

```bash
# Windows / Git Bash / muxlog-style
grep -E "HiddenSinceOpen|HwndWithoutBrowser|WRR-DRIFT|wfr:gate|wfr:runner|pending=" \
    "$AGENTMUX_DATA_DIR/launcher-events.log"
```

See [Window Reality Reconciliation](/internals/wrr/) for what the WRR drift records mean.

## Backup + portability

Each per-version file is independently restorable:

- **Cold-copy the whole `<data-dir>/data/` directory** while AgentMux is closed — that's the simplest, most reliable backup.
- **Hot copy of an individual SQLite file** while AgentMux is open is supported because the writer holds short transactions; use `sqlite3 .backup`. The JSONL event log is append-only and safe to copy at any time.

Re-importing into a fresh install: stop AgentMux, place the `*.db` files at `<data-dir>/data/db/` and the JSONL log at `<data-dir>/data/`, and launch. Bootstrap reads them.

## See also

- [Running multiple instances](/multi-instance/) — user-facing perspective
- [Persistence](/internals/persistence/) — what each SQLite store holds
- [Architecture overview](/internals/architecture/) — process topology
- [Window Reality Reconciliation](/internals/wrr/) — what the launcher event log records
- [Auth flows](/auth/) — provider credential storage model (account-wide under shared/providers/)
