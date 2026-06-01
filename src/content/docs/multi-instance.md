---
title: Running multiple instances
description: How AgentMux lets multiple installs and dev builds run side-by-side without colliding.
---

AgentMux is designed for **multiple [instances](/glossary/#instance) running side-by-side** — installed + dev, a portable + `task dev`, several portable copies of the same release. Each instance has its own process tree (launcher → sidecar → host → renderer(s)), its own Job Object, and its own dynamic backend port. On-disk state (SQLite, logs, browser cache, auth dirs) is keyed by **channel** — different channels never collide; instances on the same channel share an on-disk data dir but nothing else at runtime.

This page explains how that works from a user's perspective. For the underlying data-directory layout, log-discovery mechanics, and per-store details, see [Data layout](/internals/data-layout/).

## The three runtime modes (and the channels they map to)

| Mode | When | Default channel | Data dir |
|---|---|---|---|
| **Installed** | Normal MSI install | `stable` | `~/.agentmux/channels/stable/` |
| **Portable** (released ZIP) | Extracted release ZIP, run from `<extracted-folder>/agentmux.exe` | `stable` | `~/.agentmux/channels/stable/` (same as installed — both bind to the same channel) |
| **Portable** (local `task package`) | A portable you built yourself from source | `dev-portable-<branch>` | `~/.agentmux/channels/dev-portable-<branch>/` (per-branch; `-- --fresh` for a throwaway dir) |
| **Dev** (`task dev`) | `task dev` from a checked-out source tree | `dev-<branch>-<clone>` | `~/.agentmux/dev/<branch>/<clone-id>/` |

Dev mode lives under `~/.agentmux/dev/` (outside `channels/`) and adds a per-clone segment so two checkouts of the same branch can run side-by-side. See [Multiple `task dev` sessions](#multiple-task-dev-sessions-from-different-clones) below.

The mode is detected at startup; the channel is derived from the mode. The override is `AGENTMUX_CHANNEL=<name>` — pin a channel explicitly for parallel-channel testing or to make a dev build share state with a portable. Has no effect in Dev mode (Dev branches don't route through `channels/`).

## What's per-instance vs per-channel

Two axes of isolation, often confused:

**Per-instance** (one launcher → sidecar → host → renderer(s) tree, plus a Job Object) — every running AgentMux owns its own:

- Process tree, dynamic backend port, IPC pipe, Job Object
- Renderer JS contexts (in-memory state in the running window(s))

**Per-channel** (one on-disk state set per channel, shared by all same-channel instances at runtime, isolated between channels):

- **Data** — workspaces, tabs, blocks, layouts, agent definitions (one SQLite database per channel)
- **Logs** — host + sidecar log files
- **Browser state** — cookies, local storage, IndexedDB, service workers, browser DevTools settings
- **Agent working dirs** — per-agent directories created by the Agent pane
- **Per-provider auth dirs** — Claude, Codex, Gemini, OpenClaw, Kimi, Copilot, and Pi each get their own auth state (see [Auth flows](/auth/))

So: two instances on the same channel (e.g. two portables of the same release launched from different folders) share all the per-channel state above but each runs as its own process tree. Two instances on different channels (e.g. installed `stable` + a `dev-<branch>` build) share none of it.

This means installing a new patch release of `stable` doesn't disturb your existing My Agents, conversations, or auth state — both versions share the `stable` channel and the schema migrates forward in place. Switching between `task dev` branches *does* fully isolate, because each branch gets its own `dev-<branch>` channel. Two portables of the same release launched from different folders are two distinct [instances](/glossary/#instance) (each with its own process tree, Job Object, dynamic backend port) that **share the same on-disk data dir** because they're on the same channel.

## Channels replace per-version data dirs

Earlier builds isolated by individual version (`~/.agentmux/versions/<version>/`), and `task package` bumped the version on every build, so each one produced a fresh empty dir — My Agents reset, conversation history vanished. **Channels collapse that into one dir per channel**, and `task package` no longer bumps (local builds carry an ephemeral label, not a new version), with forward-only schema migrations on launch. A safety lock refuses to open a channel whose schema is newer than the running binary (so an older AgentMux can't downgrade-corrupt a channel a newer build wrote to). Pre-migration snapshots auto-save and the last 5 are kept.

See [Data layout → Schema safety lock + snapshots](/internals/data-layout/#schema-safety-lock--snapshots) and the [`SPEC_DATA_CHANNELS_2026_05_24`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/SPEC_DATA_CHANNELS_2026_05_24.md) spec for the design.

## What's shared

A few things are channel-independent and shared across all instances:

- **Account-wide state** — dictionary downloads, anything the user authenticates "once" rather than "per channel"
- **Pointer files** that resolve to the currently-running instance's logs (so a `muxlog` shell helper opened from any context can find the right log file)
- **Account-wide config** — the launcher's own config (saga retention, etc.)

## Running multiple instances at once

You can:

- Run a `stable` portable *and* `task dev` simultaneously. Different channels → different data dirs, different ports, different databases.
- Run a `stable` portable and a `dev-portable` build side by side. Both running, fully isolated.
- Test a feature branch against an installed AgentMux without leaving the running session — `task dev` from the branch gets its own `dev-<branch>` channel.
- Pin parallel channels with `AGENTMUX_CHANNEL=beta agentmux.exe` to test a release candidate without touching `stable` state.

Each new launch picks up its own dynamic backend port. There's no port to coordinate.

## Multiple `task dev` sessions from different clones

Two checkouts of `agentmux` on the same host can each run `task dev` in parallel, even on the same branch. Every dev launch derives a stable **clone id** from a hash of its workspace-root path:

- **Data dir:** `~/.agentmux/dev/<branch>/<clone-id>/` — distinct per clone, so lockfile, named-pipe IPC, CEF cache, and logs all isolate. (Without this, two clones on the same branch would silently share state — the second `task dev`'s launcher would attach to the first clone's running window.)
- **Vite dev server port:** `5173 + cksum($PWD) % 200` — derived the same way. First clone often gets 5173; the second gets a different deterministic port from the same range (5173–5372).
- **Sidecar TCP ports:** dynamic (OS-assigned), so always distinct without any keying.
- **`target/` and `dist/cef-dev/`:** live inside each clone's working tree, so they're per-clone by construction.

You don't need to configure anything — the derivation is automatic. If two clones happen to hash to the same Vite port (rare, but possible), override with `AGENTMUX_VITE_PORT=<free-port> task dev`. To force a specific clone identity for some external integration, set `AGENTMUX_CLONE_ID=<16-hex>` before launch.

Switching branches within a clone still re-keys the data dir by `<branch>` — your `main` and `agentx/feature` dev sessions remain isolated from each other regardless of which clone they're in.

## Environment variables

| Variable | Effect |
|---|---|
| `AGENTMUX_CHANNEL=<name>` | Pin the channel explicitly for Installed / Portable runs. Lets you test a release candidate channel side-by-side with `stable` without touching `stable` state. No effect in Dev mode. |
| `AGENTMUX_DEV_BRANCH=<name>` | Override the branch detection for Dev mode (CI-style). Useful when you're running a dev build from a CI worker that has no checked-out branch. |
| `AGENTMUX_CLONE_ID=<16-hex>` | Override the auto-derived clone id. Mostly used by child processes (host, sidecar) that inherit it from the launcher; you'd rarely set it by hand. |
| `AGENTMUX_VITE_PORT=<n>` | Override the auto-derived per-clone Vite port. Useful when the derivation collides or you need a specific port for an external integration. |
| `AGENTMUX_HOME_OVERRIDE=<path>` | Test-only — replace `~/.agentmux/` as the root. Used by the test suite to keep tempdirs isolated. |

## Tearing a tab into a new instance (Windows)

You can spawn a fresh AgentMux instance directly from a running window by **dragging a tab below the tab bar**. The drag has to clear the tab bar by ~5px before it commits — pulling the tab back into the bar before that threshold cancels the gesture, as does pressing `Esc` mid-drag.

What happens on a successful tear-off:

- A new top-level AgentMux window spawns at the cursor, matching the source window's size and position across monitors (DPI-corrected).
- The window paints live during the drag (Chrome-style follow), at full opacity.
- The new window is a **full new instance**: own backend sidecar, own data dir, own workspace, own taskbar entry — same independence as launching AgentMux twice from the Start menu.

Because the new window is a separate instance, all the per-instance/per-channel rules above apply: a tear-off on the same channel shares the per-channel state (cookies, browser cache, SQLite stores), a tear-off into a different channel is fully isolated.

**Platform support:** Windows ✅, macOS ✅ (v0.40+), Linux ✅ Phase A (v0.41+, Wayland). There is no menu item or keyboard shortcut for tear-off today — drag is the only invocation path.

**Known limitation:** Dropping the dragged tab into *another* running AgentMux instance's tab bar is not yet wired up — Phase 1 only supports tearing to the desktop, not cross-instance docking. That's planned for Phase 2.

Floating panes (pop a single pane into its own owned window without spawning a new instance) are a separate feature; only the Phase 1 host primitive has shipped — there is no user-visible gesture yet.

### Running different versions side-by-side

Starting in v0.41.1, different AgentMux versions (e.g. 0.40.x and 0.41.x) can run simultaneously without interfering. Before v0.41.1, launching an older portable while a newer one was running would silently focus the wrong window.

Each version now has its own single-instance domain and versioned data directory (`channels/<channel>/versions/<semver>/`). Agent definitions and settings are still shared within the same channel, so your agents are available across versions.

## Browser state per channel

Browser state lives on disk in the per-channel data dir, so it follows the same axis as everything else listed under [per-channel](#whats-per-instance-vs-per-channel):

- Cookies / local storage / IndexedDB / service workers are per-channel (shared between same-channel instances, isolated between channels)
- Browser DevTools settings are per-channel
- Cached JavaScript is per-channel

If you need to wipe everything for a channel: delete that channel's `cef-cache/` and the browser pane comes up fresh on the next launch of any instance on that channel. ([Data layout](/internals/data-layout/) has the exact path.)

## Common pitfalls

**"Why isn't my dev build picking up the meta?"**
You're probably running `task dev` from a different branch — or a different clone — than the one that wrote the meta. Each (branch, clone) pair gets its own dev data dir at `~/.agentmux/dev/<branch>/<clone-id>/`. Switching branches restarts the session in a different dir; running from a separate checkout of the same branch also gets its own dir. See [Multiple `task dev` sessions](#multiple-task-dev-sessions-from-different-clones).

**"My v0.38.3 database is gone after I installed v0.38.4."**
It's there — the `stable` channel data dir is shared by all `stable` versions, and the schema migrated forward in place. Open the new version and your existing My Agents / conversations / identity bundles are all there. (This is the channels design: per-version isolation was the *old* behavior; it's gone.)

**"Are running portables sharing state?"**
If they're on the same channel, yes. Different channels (e.g. `stable` vs `dev-portable`) → different data dirs. Same channel, different extracted folders → same data dir, both can run, both see the same blocks. They're still distinct [instances](/glossary/#instance) (each with its own launcher → sidecar → host → renderer process tree, its own Job Object) — only the on-disk data dir is shared.

**"I can't find the log file."**
Use the `muxlog` shell helper from any AgentMux terminal:

```bash
muxlog host         # tail the current host log
muxlog srv          # tail the sidecar log
muxlog host '\[fe\]'  # filter the host log to frontend lines
muxlog host cat     # full file contents
```

For the underlying pointer-file mechanics that make `muxlog` work, see [Data layout](/internals/data-layout/).

## See also

- [Pane Types](/pane-types/) — the user-visible pane catalog
- [Auth flows](/auth/) — per-channel auth-dir isolation per provider
- [Data layout](/internals/data-layout/) — internals: SQLite stores, pointer files, log discovery
