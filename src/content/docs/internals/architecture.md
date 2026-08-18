---
title: Architecture overview
description: How AgentMux is organized — the launcher, the host, the sidecar, and the renderer — and how they talk to each other.
---

AgentMux is a desktop application built around a small set of long-running processes that exchange events over named pipes (Windows) / Unix domain sockets (Linux + macOS) and a local websocket. Understanding the topology is enough to navigate the rest of the docs.

## The four processes

<p align="center">
  <img src="/architecture.svg" alt="AgentMux four-process architecture: agentmux-launcher (×1 per channel, single-instance lock) spawns agentmux-cef (×1 per launcher) and agentmux-srv (×1 per launcher, dynamic port). Host embeds Chromium 148 via CEF (×1 main renderer + ×N per browser pane). The SolidJS frontend runs in the main renderer and talks to srv over WebSocket. Multiple AgentMux instances can run side-by-side, each with its own full stack keyed on data-dir channel." width="860" />
</p>

| Process | Role | Crate |
|---|---|---|
| **launcher** | Resilience and lifecycle layer on all platforms: spawns the host; **owns the sidecar lifecycle**; durable event log; single-instance enforcement per (channel, version) — the I1 isolation invariant keys the IPC socket/pipe on `hash(data_dir + version)`. On Windows: sets DLL search path; tracks WRR (Window Reality Reconciliation) via Win32 hooks. On Linux: AppImage entry point (A0, v0.42.x); Unix-socket IPC server + full reducer + saga coordinator (A1, v0.42.x). `task dev` on all platforms runs through the launcher (v0.41.0+). | `agentmux-launcher` |
| **host** | Embeds Chromium via CEF; owns the windows (CEF Views top-level windows — `browser_view_create` + `window_create_top_level`, [`agentmux-cef/src/app.rs`](https://github.com/agentmuxai/agentmux/blob/main/agentmux-cef/src/app.rs)), the browser panes, the JS bridge, and IPC fan-out to the renderer. New windows and tear-off floating panes are served from a hidden, pre-warmed pool (see below). | `agentmux-cef` |
| **sidecar** | App-domain server: workspaces, tabs, blocks, layouts, agents, identity. Persists to SQLite. Spawned and supervised by the launcher (which owns its lifecycle); listens on a dynamic local port and serves the host + frontend over a WebSocket. Users never run it directly. | `agentmux-srv` |
| **renderer** | A Chromium renderer process running the SolidJS frontend JS for one browser context. **Not a singleton** — every OS window gets its own renderer, and every [browser pane](/browser-pane/) inside a window adds another. Stateless — projects what the sidecar/host expose, dispatches user actions back through them. | `frontend/` |

A fifth crate — `agentmux-common` — provides shared utilities (path resolution, runtime mode detection) that all the above consume.

> The four processes above plus the Chromium subprocesses that the host transparently spawns (GPU, network, storage, …) are collectively one **[instance](/glossary/#instance)** — a process tree rooted at one launcher. A baseline single-window dev session runs as launcher + sidecar + host + 1 renderer = 4 processes; opening more windows or browser panes spawns additional renderers. Multiple instances (different versions, dev + portable) run side-by-side without colliding — see [Multi-instance & dev mode](/multi-instance/).

## Why three real processes plus Chromium?

Each process owns one concern, end-to-end:

- **The launcher** is the resilience and lifecycle layer. It is the only process that survives an unexpected OS-level event (a window minimize, a monitor disconnection, a focus theft). On Windows, its WRR layer reconciles AgentMux's own model against what Win32 actually reports (Win32 hooks, WindowProc). On Linux (v0.42.x+), the launcher is the AppImage entry point and runs the full reducer + saga coordinator over Unix-domain-socket IPC. WRR is **Windows-only by design** (not a roadmap gap — see [WRR](/internals/wrr/)); on macOS/Linux the cross-platform safety net for orphaned/crashed windows is the host's orphan reconciler.
- **The host** is the only process with a CEF context. Windows are CEF Views top-level windows: the host calls `browser_view_create` + `window_create_top_level` and lets CEF Views handle resize, snap, and the frameless title bar natively. On Win32 the Views `window_handle()` can come back NULL, so window operations resolve the real `HWND` by enumeration. Browser panes, drag/drop, OS focus, and renderer crashes all live or die in the host. Crashing the host kills the user-facing window; the launcher restarts it.
- **The sidecar** is the only process that owns durable state. The launcher spawns it (so its lifecycle survives a host crash); closing the host doesn't lose data — when the host comes back, it reads from the sidecar.
- **The renderer** is intentionally state-poor. It's the projection of what the other processes hold; restarting the renderer (e.g. on hot reload) doesn't lose anything.

This split is what makes multi-instance work cleanly: each instance has its own host, sidecar, dynamic backend port, process-isolation container (Job Object on Windows / process group on Linux + macOS), and process tree. What instances share on disk depends on whether they're the same release: two portables of the same (channel, version) share the version-scoped runtime dir (SQLite, CEF cache, host logs) as well as the channel-wide agents/settings; two portables of different versions on the same channel share only the channel-wide agents/settings; two portables on different channels share nothing channel-scoped at all. Every instance also touches account-wide state (sidecar log, dictionaries, launcher config). See [Multi-instance & dev mode → What's per-instance vs per-version vs per-channel](/multi-instance/#whats-per-instance-vs-per-version-vs-per-channel) for the full matrix.

## The warm window pool

New windows and tear-off floating panes don't pay full CEF startup cost on demand. At app start the host spawns a hidden, pre-warmed **pool** of CEF windows — `window-pool-*` browsers back new tabs/windows, `floating-pool-*` browsers back floating panes (`init_pool` / `init_pane_pool` in [`agentmux-cef/src/client/mod.rs`](https://github.com/agentmuxai/agentmux/blob/main/agentmux-cef/src/client/mod.rs)). Opening a new window or tearing off a pane **promotes** a pooled browser: the host repositions and shows it, so the operation is near-instant rather than a cold spawn. Pool windows are kept hidden (not merely off-screen-but-visible) to avoid a Windows blank-window bug. Pool browsers don't count as user windows — they're excluded by type from the live-window count that keeps the instance alive (see below).

## Window lifecycle

Closing the **last** user window quits the instance cleanly. `count_live_user_windows()` counts only top-level, non-pool browsers ([`agentmux-cef/src/reducer/quit.rs`](https://github.com/agentmuxai/agentmux/blob/main/agentmux-cef/src/reducer/quit.rs)); when it reaches zero the host closes the pool browsers, calls `quit_message_loop` → `exit(0)`, and the launcher's Job Object (`KILL_ON_JOB_CLOSE`) reaps the rest of the process tree — no orphaned trees, no spurious relaunch.

Two CEF Views quirks shape this. First, Views recycles windows on close rather than destroying them, so `on_before_close` does **not** fire; `close_window` therefore calls `report_window_closed` explicitly ([`agentmux-cef/src/commands/window/lifecycle.rs`](https://github.com/agentmuxai/agentmux/blob/main/agentmux-cef/src/commands/window/lifecycle.rs)) and emits a `WindowClosed` event so the status-bar window count stays accurate. Second, to stay correct even if an event is dropped, the frontend detects gaps in the launcher event stream and reconciles from an authoritative snapshot via `ReconcileFromSnapshot` ([`frontend/app/store/launcher-event/reducer.ts`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/store/launcher-event/reducer.ts)). On macOS, re-activating a still-running app (Finder double-click, `open`, or a Dock click) raises a reopen event that the launcher forwards to the host to open a fresh window.

## How they communicate

| Edge | Mechanism | What flows |
|---|---|---|
| launcher ↔ host | Named pipe (Windows) / Unix domain socket (Linux + macOS) | OS-level facts (window position, monitor topology, lifecycle) |
| host ↔ sidecar | Local websocket (dynamic port) | RPC commands, event subscriptions, shell-integration env passing |
| host ↔ renderer | CEF JS bridge | Per-frame UI events (clicks, focus, resizes), pane lifecycle |
| renderer ↔ sidecar | Local websocket (re-uses host's connection) | Frontend dispatches reach the sidecar through the host's bridge |

Every cross-process edge has its own event format, its own ack semantics, and its own persistence strategy. None of them are "just" a function call.

## State ownership

This is where the [reducer stack](/internals/reducer-stack/) lives. Briefly:

- **Layer 1 — launcher reducer** owns process / OS / monitor / pool state. Single-writer; durable JSONL event log.
- **Layer 2 — host reducer** (in flight) owns CEF-side coordination: pending window creations, active drag, lifecycle.
- **Layer 3 — srv reducer** owns the app domain: workspaces, tabs, blocks, layouts, agents.
- **Layer 4 — frontend slices** project the above into per-pane Solid signals via per-slice reducer modules.

The full layout, slice list, and migration plan are in the [reducer stack page](/internals/reducer-stack/).

Outside this reducer stack sits one more piece of cross-process coordination: a file-per-session **session-ownership lease** (`LeaseStore`, `agentmux-srv/src/registry/leases.rs`) that guards which single process may currently drive turns for a given agent `instance_id` — relevant in host-mode, where more than one process could otherwise reach the same agent. Each lease is `<registry_root>/leases/<instance_id>.lease.json`, TTL-based (renewed every 5s on the same tick as the per-turn health watchdog; reclaimable once ~3 renewals are missed) and scoped to a `boot_id`, and the claim/renew/release sequence is guarded by a real OS advisory lock (`flock` / `LockFileEx`) rather than the atomic-rename-only pattern the rest of the registry uses, so two processes can never both believe they hold the same session. See [Persistence](/internals/persistence/#whats-not-here) for where the lease files live on disk.

## Data layout on disk

Every running instance resolves its paths through `agentmux-common::DataPaths` ([source](https://github.com/agentmuxai/agentmux/blob/main/agentmux-common/src/data_paths.rs)). Resolution happens once in the launcher and is propagated to host + sidecar via the `AGENTMUX_*_DIR` env vars, so all three processes always agree.

| Mode | Channel root | Runtime dirs |
|---|---|---|
| **Installed** | `~/.agentmux/channels/<channel>/` (default `stable`) | `~/.agentmux/channels/<channel>/versions/<v>/` (v0.41.1+) — per-version runtime DB, cache, logs, IPC |
| **Portable** (released ZIP) | Same as installed | Same as installed |
| **Portable** (local `task package`) | `~/.agentmux/channels/local-<branch>/` | No version sub-dir — local builds aren't versioned releases. |
| **Dev** (`task dev`) | n/a | `~/.agentmux/dev/<branch>/<clone-id>/` — one dir per (branch × clone) pair. |

Inside each channel dir, state is split into **channel-wide** and **version-scoped** paths:

- **Channel-wide** (`channels/<channel>/`): `config/` (settings + per-provider auth dirs) and `agents/` (agent definitions). These survive version upgrades.
- **Version-scoped** (`channels/<channel>/versions/<v>/`, v0.41.1+): `data/` (SQLite + launcher event log), `logs/` (host log; sidecar log lives elsewhere — see below), `cef-cache/` (cookies, IndexedDB, JS cache), `runtime/` (lock + IPC port file). These are isolated per release so concurrent versions on the same channel can't collide on SQLite writes or corrupt each other's caches.

This is a two-step evolution: channels (mid-2026) collapsed the old per-version `~/.agentmux/versions/<v>/` layout into per-channel dirs so agents and settings survived upgrades. Then v0.41.1 reintroduced a *version-scoped* sub-dir for the runtime hazards (concurrent SQLite writers, shared CEF cache, single-instance pipe collisions) while keeping agents and settings channel-wide. See [Data layout](/internals/data-layout/), [`SPEC_DATA_CHANNELS_2026_05_24`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/SPEC_DATA_CHANNELS_2026_05_24.md), and [`SPEC_VERSION_ISOLATION_2026_06_01`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/SPEC_VERSION_ISOLATION_2026_06_01.md) for the design.

Account-wide state lives outside `channels/`: the sidecar log (`~/.agentmux/logs/agentmuxsrv-v<v>.log.<date>`), pointer files for log discovery, the launcher's `agentmux-launcher.log`, dictionaries, and the launcher's `config.toml` (saga retention etc.). Pre-migration snapshots auto-save at `~/.agentmux/snapshots/<channel>-pre-v<ver>-<iso>.bak/` (newest 5 per channel kept).

See [Multi-instance & dev mode](/multi-instance/) for the full layout, log discovery story, and per-instance vs shared boundary.

## Reading order

If you're new, read in this order:

1. **You're here.** This page.
2. [Multi-instance & dev mode](/multi-instance/) — gets you to a running AgentMux you can poke at.
3. [Reducer stack](/internals/reducer-stack/) — explains how state actually flows through the four processes.
4. [Pane Types](/pane-types/) — the user-visible building blocks.
5. The [Agent App API reference](/internals/agent-app-api/) when you're ready to drive AgentMux from an agent.
