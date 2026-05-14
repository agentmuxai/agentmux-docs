---
title: Data layout
description: The on-disk layout for AgentMux — per-version data dirs, per-instance runtime artifacts, account-wide shared state, pointer-file log discovery.
---

This page documents the on-disk layout AgentMux uses to isolate per-version state and to make log files discoverable from any context. For the user-facing perspective ("how do I run multiple versions side-by-side?") see [Running multiple instances](/multi-instance/). For the SQLite stores themselves, see [Persistence](/internals/persistence/).

The on-disk layout is keyed by **version**, not by [instance](/glossary/#instance) — two same-version instances launched from different folders share the same data dir (see [Running multiple instances → What's per-instance vs per-version](/multi-instance/#whats-per-instance-vs-per-version)).

## Three runtime modes, three data directories

| Mode | Data directory |
|---|---|
| **Installed** | `~/.agentmux/versions/<version>/` |
| **Portable** | `~/.agentmux/versions/<version>/` (same as installed — keyed on version, not on which folder you ran the binary from; two same-version portables share this dir) |
| **Dev** (`task dev`) | `~/.agentmux/dev/<branch>/` (one dir per checked-out branch — different branches don't collide) |

The mode is detected at startup by `agentmux-common`'s runtime-mode probe — see [`agentmux-common/src/runtime_mode.rs`](https://github.com/agentmuxai/agentmux/blob/main/agentmux-common/src/runtime_mode.rs).

Resolution is centralized in [`agentmux-common::DataPaths`](https://github.com/agentmuxai/agentmux/blob/main/agentmux-common/src/data_paths.rs). The launcher resolves once at startup and exports `AGENTMUX_DATA_DIR`, `AGENTMUX_CONFIG_DIR`, `AGENTMUX_LOG_DIR`, etc. as env vars; host and sidecar read them from env. All three processes always agree on paths.

## Per-version contents

Inside each data dir (shared by all same-version instances at runtime):

| Path | Owns |
|---|---|
| `<data-dir>/data/` | SQLite stores (`db/objects.db`, `db/filestore.db`, `db/sagas.db`, `db/launcher-sagas.db`) and the launcher's JSONL event log (`launcher-events.log`) |
| `<data-dir>/logs/` | Host + sidecar logs (rotated daily, 7-day retention) |
| `<data-dir>/cef-cache/` | Chromium cookies, local storage, IndexedDB, service workers, cached JS |
| `<data-dir>/agents/` | Per-agent working dirs created by the agent system |
| `<data-dir>/config/` | Settings (`settings.json`) plus per-provider auth-config-dir homes (`config/auth/claude/`, `config/auth/codex/`, etc. — see [Auth flows](/auth/)) |
| `<data-dir>/runtime/` | Runtime IPC artifacts (lock files, named-pipe sockets) used by the launcher's single-instance / IPC machinery |

See [Persistence](/internals/persistence/) for what each SQLite file holds and which process writes it.

## Account-wide (shared) contents

A single tree at `~/.agentmux/`:

| Path | Purpose | Owner |
|---|---|---|
| `~/.agentmux/shared/` | Account-wide state (cookies, OAuth tokens, dictionary downloads) — version-independent | All hosts |
| `~/.agentmux/logs/current-host-v<version>.path` | Pointer file resolving to the running host's log path | Host (write-through) |
| `~/.agentmux/logs/current-srv-v<version>.path` | Pointer file resolving to the running sidecar's log path | Sidecar (write-through) |
| `~/.agentmux/logs/agentmux-launcher.log` | The launcher's own startup-phase log (single file, no rotation) | Launcher |
| `~/.agentmux/config.toml` | Account-wide launcher config (saga retention, etc.) | Launcher |

The durable launcher reducer event log (`launcher-events.log`) lives at `<data-dir>/data/launcher-events.log`. With multiple same-version instances running, all of their launchers append to this single file.

## Log discovery via pointer files

The host writes its own logs to `<data-dir>/logs/`. To make those discoverable from any context (e.g. a `muxlog` shell helper running in an unrelated terminal), the host **also** writes a pointer file under the shared `~/.agentmux/logs/` directory:

```
~/.agentmux/logs/current-host-v<version>.path
```

The pointer file's contents are the **absolute path** to the current log file:

```
C:\Users\area54\.agentmux\versions\0.33.740\logs\agentmux-host-v0.33.740.log.2026-05-08
```

So the canonical "find the running host's log" recipe is:

```bash
LOG="$(cat ~/.agentmux/logs/current-host-v<version>.path)"
tail -F "$LOG"
```

Same convention applies to the sidecar (`current-srv-v<version>.path`).

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

Re-importing into a fresh install: stop AgentMux, place the files at `<data-dir>/data/db/` (and the JSONL log at `<data-dir>/data/`), and launch. Bootstrap reads them.

## See also

- [Running multiple instances](/multi-instance/) — user-facing perspective
- [Persistence](/internals/persistence/) — what each SQLite store holds
- [Architecture overview](/internals/architecture/) — process topology
- [Window Reality Reconciliation](/internals/wrr/) — what the launcher event log records
- [Auth flows](/auth/) — per-version auth-dir isolation
