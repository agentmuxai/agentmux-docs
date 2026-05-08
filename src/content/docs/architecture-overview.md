---
title: Architecture overview
description: How AgentMux is organized — the launcher, the host, the sidecar, and the renderer — and how they talk to each other.
---

AgentMux is a desktop application built around a small set of long-running processes that exchange events over named pipes and a local websocket. Understanding the topology is enough to navigate the rest of the docs.

## The four processes

```
┌──────────────────┐        named pipe        ┌──────────────────┐
│  agentmux-       │ ◀────────────────────────▶│  agentmux-cef    │
│  launcher.exe    │                          │  (the "host")    │
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
| **launcher** | Sets DLL search path; spawns the host from `runtime/`; tracks WRR (Window Reality Reconciliation) via Win32 hooks; durable event log for OS-level facts. | `agentmux-launcher` |
| **host** | Embeds Chromium via CEF; owns the OS window, the browser panes, the JS bridge, and IPC fan-out to the renderer. | `agentmux-cef` |
| **sidecar** | App-domain server: workspaces, tabs, blocks, layouts, agents, identity. Persists to SQLite. Auto-spawned by the host on a dynamic port; users never run it directly. | `agentmux-srv` |
| **renderer** | The SolidJS frontend that users actually see. Runs inside CEF. Stateless — projects what the sidecar/host expose, dispatches user actions back through them. | `frontend/` |

A fifth crate — `agentmux-common` — provides shared utilities (path resolution, runtime mode detection) that all the above consume.

## Why three real processes plus Chromium?

Each process owns one concern, end-to-end:

- **The launcher** is the only process that survives an OS-level Win32 surprise (a window minimize event, a monitor disconnection, a focus theft). Its WRR layer reconciles AgentMux's own model against what Win32 actually thinks is happening.
- **The host** is the only process with a CEF context. Browser panes, drag/drop, OS focus, and renderer crashes all live or die in the host. Crashing the host kills the user-facing window; the launcher restarts it.
- **The sidecar** is the only process that owns durable state. Closing the host doesn't lose data — when the host comes back, it reads from the sidecar.
- **The renderer** is intentionally state-poor. It's the projection of what the other processes hold; restarting the renderer (e.g. on hot reload) doesn't lose anything.

This split is what makes multi-instance work cleanly. Two AgentMux portables running side-by-side each have their own host, their own sidecar, and their own data dir — they share nothing except the launcher binary on disk.

## How they communicate

| Edge | Mechanism | What flows |
|---|---|---|
| launcher ↔ host | Named pipe IPC | OS-level facts (window position, monitor topology, lifecycle) |
| host ↔ sidecar | Local websocket (dynamic port) | RPC commands, event subscriptions, the wsh shell-integration channel |
| host ↔ renderer | CEF JS bridge | Per-frame UI events (clicks, focus, resizes), pane lifecycle |
| renderer ↔ sidecar | Local websocket (re-uses host's connection) | Frontend dispatches reach the sidecar through the host's bridge |

Every cross-process edge has its own event format, its own ack semantics, and its own persistence strategy. None of them are "just" a function call.

## State ownership

This is where the [reducer stack](/reducer-stack/) lives. Briefly:

- **Layer 1 — launcher reducer** owns process / OS / monitor / pool state. Single-writer; durable JSONL event log.
- **Layer 2 — host reducer** (in flight) owns CEF-side coordination: pending window creations, active drag, lifecycle.
- **Layer 3 — srv reducer** owns the app domain: workspaces, tabs, blocks, layouts, agents.
- **Layer 4 — frontend slices** project the above into per-pane Solid signals via per-slice reducer modules.

The full layout, slice list, and migration plan are in the [reducer stack page](/reducer-stack/).

## Data layout on disk

Every running instance writes to its own data directory:

| Mode | Root | Data subpath |
|---|---|---|
| **Portable** | `<extracted-folder>/data/` (per portable instance) | maps to `<root>/versions/<version>/` internally |
| **Installed** | `~/.agentmux/versions/<version>/` | same logical layout |
| **Dev** (`task dev`) | `~/.agentmux/dev/<branch>/` | one dir per checked-out branch — different branches don't collide |

The shared `~/.agentmux/logs/` directory holds **pointer files** that resolve to per-instance log paths. See [Multi-instance & dev mode](/multi-instance/) for the full discovery story.

## Reading order

If you're new, read in this order:

1. **You're here.** This page.
2. [Multi-instance & dev mode](/multi-instance/) — gets you to a running AgentMux you can poke at.
3. [Reducer stack](/reducer-stack/) — explains how state actually flows through the four processes.
4. [Pane Types](/pane-types/) — the user-visible building blocks.
5. The [Agent App API reference](/agent-app-api/) when you're ready to drive AgentMux from an agent.
