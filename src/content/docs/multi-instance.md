---
title: Multi-instance & dev mode
description: How AgentMux isolates multiple installs, where each instance writes its data and logs, and how to find the right log file.
---

AgentMux is designed for **multiple instances running side-by-side** — different versions, dev + portable, or several portable copies of the same version — without any of them stepping on each other. This page explains the data layout that makes that work, and where to look when you need to debug.

## The three runtime modes

| Mode | When | Instance directory |
|---|---|---|
| **Installed** | A normal install via the MSI (or a future release channel) | `~/.agentmux/versions/<version>/` |
| **Portable** | Extracted ZIP run from `<extracted-folder>/agentmux.exe` | `~/.agentmux/versions/<version>/` (still keyed on the binary's version) |
| **Dev** | `task dev` from a checked-out source tree | `~/.agentmux/dev/<branch>/` (one dir per checked-out branch) |

The mode is detected at startup by `agentmux-common`'s runtime-mode probe — see [`agentmux-common/src/runtime_mode.rs`](https://github.com/agentmuxai/agentmux/blob/main/agentmux-common/src/runtime_mode.rs). The instance directory then becomes the root for everything that needs to be per-instance.

## What's per-instance

Every running AgentMux owns its own:

- **Data directory** — `<instance>/data/` with the SQLite stores (`db/objects.db`, `db/filestore.db`, `db/sagas.db`)
- **Log directory** — `<instance>/logs/` (host + cef-debug logs)
- **CEF cache** — `<instance>/cef-cache/` (Chromium cookies, local storage, etc. — never shared across instances)
- **Agents directory** — `<instance>/agents/` (per-agent working dirs created by the forge)
- **Config directory** — `<instance>/config/` (auth-config-dir homes for the CLI providers)
- **Runtime directory** — `<instance>/runtime/` (per-instance temp / IPC artifacts)

This means installing v0.33.10 doesn't disturb a running v0.33.9 portable. Switching between `task dev` branches doesn't mix branch A's database into branch B's. Two portables of v0.33.10 in different desktop folders share the same instance dir (because the version key is the same) — which is intentional: they're the same instance, just relaunched from different places.

## What's shared

A single tree at `~/.agentmux/`:

| Path | Purpose | Owner |
|---|---|---|
| `~/.agentmux/shared/` | Account-wide state (cookies, OAuth tokens, dictionary downloads) — version-independent | All hosts |
| `~/.agentmux/logs/` | Global pointer files that resolve to per-instance log paths via absolute paths | All hosts (write-through) |
| `~/.agentmux/logs/agentmux-launcher.log` | The launcher's own startup-phase log (single file, no rotation) | The launcher |
| `~/.agentmux/config.toml` | Account-wide launcher config (saga retention, etc.) | The launcher |

The durable launcher reducer event log (`launcher-events.log`) is **per-instance** — it lives at `<instance>/data/launcher-events.log`, not in the shared tree. Each instance has its own.

## Log discovery

The host writes its own logs to `<instance>/logs/`. To make those discoverable from any context (e.g. a `muxlog` shell helper running in an unrelated terminal), the host **also** writes a pointer file under the shared `~/.agentmux/logs/` directory:

```
~/.agentmux/logs/current-host-v<version>.path
```

The pointer file's contents are the **absolute path** to the current log file, e.g.:

```
C:\Users\area54\.agentmux\versions\0.33.10\logs\agentmux-host-v0.33.10.log.2026-05-08
```

So the canonical "find the running host's log" recipe is:

```bash
LOG="$(cat ~/.agentmux/logs/current-host-v<version>.path)"
tail -F "$LOG"
```

The same convention applies to the sidecar (`current-srv-v<version>.path`).

### Shell helpers

The shell-integration scripts shipped to AgentMux's own terminals expose a `muxlog` helper:

```bash
muxlog host          # tail the current host log
muxlog srv           # tail the sidecar log
muxlog host '\[fe\]' # filter the host log to frontend [fe] lines
muxlog host cat      # full file contents (instead of tailing)
```

The helper detects whether the pointer holds a basename (legacy) or an absolute path (newer instances), so the same command works against any version.

## Running multiple instances at once

You can:

- Run a portable v0.33.10 *and* `task dev` simultaneously. Different instance dirs, different ports, different databases.
- Run two portables of different versions side by side. v0.33.9 keeps its data; v0.33.10 starts fresh (or migrates if it's a meta-compat bump).
- Test a feature branch against an installed AgentMux without leaving the running session — `task dev` from the branch gets `~/.agentmux/dev/<branch>/`.

Each new launch picks up its own dynamic backend port for the websocket. There's no port to coordinate.

## What about Chromium state?

Each instance has its own `cef-cache/`. That means:

- Cookies / local storage / IndexedDB / service workers are per-instance
- Browser DevTools settings are per-instance
- Cached JavaScript is per-instance

If you need to wipe everything for one instance: delete `<instance>/cef-cache/`. The browser pane comes up fresh next time.

## Common pitfalls

**"Why isn't my dev build picking up the meta?"**
You're probably running `task dev` from a different branch than the one that wrote the meta. Each branch has its own data dir; switching branches and restarting `task dev` switches the data dir.

**"I can't find the log file."**
The pointer file at `~/.agentmux/logs/current-host-v<version>.path` should resolve. If it doesn't, the host hasn't reached the logging-init point — check `~/.agentmux/logs/agentmux-launcher.log` for spawn errors.

**"My v0.33.9 database is gone after I installed v0.33.10."**
It isn't — it's at `~/.agentmux/versions/0.33.9/data/db/objects.db`. The newer install made its own dir at `versions/0.33.10/`. Roll back the install and you'll see your data come back.

**"Are running portables sharing state?"**
Only if they're the same version. Different versions have different `<version>` instance dirs. Same version, different extracted folders → same data dir, both can run, both see the same blocks (but each has its own host process and frontend).

## Reading order from here

- [Pane Types](/pane-types/) for what you can put inside a tab
- [The Forge](/the-forge/) for how agent identity & working dirs are managed
- [Reducer stack](/reducer-stack/) for how state actually flows once you're running
