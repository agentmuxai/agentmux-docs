---
title: Running multiple instances
description: How AgentMux lets multiple installs and dev builds run side-by-side without colliding.
---

AgentMux is designed for **multiple [instances](/glossary/#instance) running side-by-side** — different versions, dev + portable, or several portable copies of the same version. Each instance has its own process tree (launcher → sidecar → host → renderer(s)), its own Job Object, and its own dynamic backend port. On-disk state (SQLite, logs, browser cache, auth dirs) is keyed by *version* — different versions never collide; same-version instances share an on-disk data dir but nothing else at runtime.

This page explains how that works from a user's perspective. For the underlying data-directory layout, log-discovery mechanics, and per-store details, see [Data layout](/internals/data-layout/).

## The three runtime modes

| Mode | When | Where it lives |
|---|---|---|
| **Installed** | Normal MSI install (or a future release channel) | Versioned per-install location |
| **Portable** | Extracted ZIP, run from `<extracted-folder>/agentmux.exe` | Same versioned location as the installed copy of the same version |
| **Dev** | `task dev` from a checked-out source tree | Per-branch dev location (one dir per checked-out branch) |

The mode is detected at startup. The version's data directory then becomes the root for everything that's keyed per-version (see [What's per-instance vs per-version](#whats-per-instance-vs-per-version) below).

## What's per-instance vs per-version

Two axes of isolation, often confused:

**Per-instance** (one launcher → sidecar → host → renderer(s) tree, plus a Job Object) — every running AgentMux owns its own:

- Process tree, dynamic backend port, IPC pipe, Job Object
- Renderer JS contexts (in-memory state in the running window(s))

**Per-version** (one on-disk state set per version, shared by all same-version instances at runtime, isolated between versions):

- **Data** — workspaces, tabs, blocks, layouts, agent definitions (one SQLite database per version)
- **Logs** — host + sidecar log files
- **Browser state** — cookies, local storage, IndexedDB, service workers, browser DevTools settings
- **Agent working dirs** — per-agent directories created by the Agent pane
- **Per-provider auth dirs** — Claude, Codex, Gemini, OpenClaw, Kimi, Copilot, and Pi each get their own auth state (see [Auth flows](/auth/))

So: two same-version instances (e.g. two portables launched from different folders) share all the per-version state above but each runs as its own process tree. Two different-version instances share none of it.

This means installing v0.33.10 doesn't disturb a running v0.33.9 portable. Switching between `task dev` branches doesn't mix branch A's data into branch B's. Two portables of the **same** version launched from different folders are two distinct [instances](/glossary/#instance) (each with its own launcher → sidecar → host → renderer process tree, its own Job Object, its own dynamic backend port) that **share the same on-disk data dir** — because the data dir is keyed by *version*, not by which folder you ran the binary from. Both can run; both see the same blocks.

## What's shared

A few things are version-independent and shared across all instances:

- **Account-wide state** — OAuth tokens, dictionary downloads, anything the user authenticates "once" rather than "per-version"
- **Pointer files** that resolve to the currently-running instance's logs (so a `muxlog` shell helper opened from any context can find the right log file)
- **Account-wide config** — the launcher's own config (saga retention, etc.)

## Running multiple instances at once

You can:

- Run a portable v0.33.10 *and* `task dev` simultaneously. Different versions → different data dirs, different ports, different databases.
- Run two portables of different versions side by side. v0.33.9 keeps its data; v0.33.10 starts fresh (or migrates if it's a meta-compat bump).
- Test a feature branch against an installed AgentMux without leaving the running session — `task dev` from the branch gets its own per-branch dev directory.

Each new launch picks up its own dynamic backend port. There's no port to coordinate.

## Browser state per version

Browser state lives on disk in the per-version data dir, so it follows the same axis as everything else listed under [per-version](#whats-per-instance-vs-per-version):

- Cookies / local storage / IndexedDB / service workers are per-version (shared between same-version instances, isolated between versions)
- Browser DevTools settings are per-version
- Cached JavaScript is per-version

If you need to wipe everything for a version: delete that version's `cef-cache/` and the browser pane comes up fresh on the next launch of any instance of that version. ([Data layout](/internals/data-layout/) has the exact path.)

## Common pitfalls

**"Why isn't my dev build picking up the meta?"**
You're probably running `task dev` from a different branch than the one that wrote the meta. Each branch has its own data dir; switching branches and restarting `task dev` switches the data dir.

**"My v0.33.9 database is gone after I installed v0.33.10."**
It isn't — it's still in v0.33.9's data dir. The newer install made its own dir at v0.33.10. Roll back the install and your data comes back.

**"Are running portables sharing state?"**
Only if they're the same version. Different versions have different data dirs. Same version, different extracted folders → same data dir, both can run, both see the same blocks. They're still distinct [instances](/glossary/#instance) (each with its own launcher → sidecar → host → renderer process tree, its own Job Object) — only the on-disk data dir is shared.

**"I can't find the log file."**
Use the `muxlog` shell helper from any AgentMux terminal:

```bash
muxlog host         # tail the current host log
muxlog srv          # tail the sidecar log
muxlog host '[fe]'  # filter the host log to frontend lines
muxlog host cat     # full file contents
```

For the underlying pointer-file mechanics that make `muxlog` work, see [Data layout](/internals/data-layout/).

## See also

- [Pane Types](/pane-types/) — the user-visible pane catalog
- [Auth flows](/auth/) — per-instance auth-dir isolation per provider
- [Data layout](/internals/data-layout/) — internals: SQLite stores, pointer files, log discovery
