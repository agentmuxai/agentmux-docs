---
title: Architecture overview
description: How AgentMux is organized — the launcher, the host, the sidecar, and the renderer — and how they talk to each other.
---

AgentMux is a desktop application built around a small set of long-running processes that exchange events over named pipes and a local websocket. Understanding the topology is enough to navigate the rest of the docs.

## The four processes

```
┌──────────────────┐         named pipe        ┌──────────────────┐
│  agentmux-       │ ◀────────────────────────▶│  agentmux-cef    │
│  launcher        │                          │  (the "host")    │
│  (≈325 KB shim)  │                          │                  │
└────────┬─────────┘                          └────────┬─────────┘
         │ spawns                                      │ embeds
         │                                             ▼
         │                                      ┌──────────────────┐
         │                                      │  Chromium        │
         │                                      │  (CEF renderer)  │
         │                                      └────────┬─────────┘
         │                                               │ JS bridge
         │                                               ▼
         │                                      ┌──────────────────┐
         │                                      │  SolidJS app     │
         │                                      │  (the frontend)  │
         │                                      └────────┬─────────┘
         │                                               │ websocket
         ▼                                               ▼
┌─────────────────────────────────────────────────────────┐
│                     agentmux-srv                         │
│                       (sidecar)                          │
│   • RPC engine (websocket)   • SQLite persistence        │
│   • saga coordinator         • event bus                 │
└─────────────────────────────────────────────────────────┘
```

| Process | Role | Crate |
|---|---|---|
| **launcher** | Resilience and lifecycle layer on all platforms: spawns the host from `runtime/`; durable event log for OS-level facts; version isolation (one single-instance domain per version). On Windows: sets DLL search path; tracks WRR (Window Reality Reconciliation) via Win32 hooks (WindowProc, Win32 window events). macOS/Linux launcher integration shipped for `task dev` in v0.41.0; full feature parity is on the roadmap. | `agentmux-launcher` |
| **host** | Embeds Chromium via CEF; owns the OS window, the browser panes, the JS bridge, and IPC fan-out to the renderer. | `agentmux-cef` |
| **sidecar** | App-domain server: workspaces, tabs, blocks, layouts, agents, identity. Persists to SQLite. Auto-spawned by the host on a dynamic port; users never run it directly. | `agentmux-srv` |
| **renderer** | A Chromium renderer process running the SolidJS frontend JS for one browser context. **Not a singleton** — every OS window gets its own renderer, and every [browser pane](/browser-pane/) inside a window adds another. Stateless — projects what the sidecar/host expose, dispatches user actions back through them. | `frontend/` |

A fifth crate — `agentmux-common` — provides shared utilities (path resolution, runtime mode detection) that all the above consume.

> The four processes above plus the Chromium subprocesses that the host transparently spawns (GPU, network, storage, …) are collectively one **[instance](/glossary/#instance)** — a process tree rooted at one launcher. A baseline single-window dev session runs as launcher + sidecar + host + 1 renderer = 4 processes; opening more windows or browser panes spawns additional renderers. Multiple instances (different versions, dev + portable) run side-by-side without colliding — see [Multi-instance & dev mode](/multi-instance/).

## Why three real processes plus Chromium?

Each process owns one concern, end-to-end:

- **The launcher** is the resilience and lifecycle layer. It is the only process that survives an unexpected OS-level event (a window minimize, a monitor disconnection, a focus theft). On Windows, its WRR layer reconciles AgentMux's own model against what Win32 actually reports (Win32 hooks, WindowProc). On macOS/Linux, the equivalent reconciliation layer is on the roadmap; `task dev` on those platforms runs through the launcher as of v0.41.0.
- **The host** is the only process with a CEF context. Browser panes, drag/drop, OS focus, and renderer crashes all live or die in the host. Crashing the host kills the user-facing window; the launcher restarts it.
- **The sidecar** is the only process that owns durable state. Closing the host doesn't lose data — when the host comes back, it reads from the sidecar.
- **The renderer** is intentionally state-poor. It's the projection of what the other processes hold; restarting the renderer (e.g. on hot reload) doesn't lose anything.

This split is what makes multi-instance work cleanly. Two AgentMux portables running side-by-side each have their own host, their own sidecar, and their own data dir — they share nothing except the launcher binary on disk.

## How they communicate

| Edge | Mechanism | What flows |
|---|---|---|
| launcher ↔ host | Named pipe IPC | OS-level facts (window position, monitor topology, lifecycle) |
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

## Data layout on disk

Every running instance resolves its paths through `agentmux-common::DataPaths` ([source](https://github.com/agentmuxai/agentmux/blob/main/agentmux-common/src/data_paths.rs)). Resolution happens once in the launcher and is propagated to host + sidecar via the `AGENTMUX_*_DIR` env vars, so all three processes always agree.

| Mode | Channel root | Runtime dirs |
|---|---|---|
| **Installed** | `~/.agentmux/channels/<channel>/` (default `stable`) | `~/.agentmux/channels/<channel>/versions/<v>/` (v0.41.1+) — per-version runtime DB, cache, logs, IPC |
| **Portable** (released ZIP) | Same as installed | Same as installed |
| **Portable** (local `task package`) | `~/.agentmux/channels/dev-portable-<branch>/` | No version sub-dir — local builds aren't versioned releases. |
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
