---
title: Running multiple instances
description: How AgentMux lets multiple installs and dev builds run side-by-side without colliding.
---

AgentMux is designed for **multiple [instances](/glossary/#instance) running side-by-side** — installed + dev, a portable + `task dev`, several portable copies of the same release. Each instance has its own process tree (launcher → sidecar → host → renderer(s)), its own Job Object, and its own dynamic backend port. On-disk state has three axes: **per-channel** (settings, agent definitions, per-provider OAuth auth dirs — survive upgrades within a channel), **per-version within a channel** (SQLite, host logs, CEF cache + cookies, IPC artifacts — isolated per release so concurrent versions don't collide), and **account-wide** (sidecar log, dictionaries, launcher config — independent of channel). Instances on the same (channel, version) share their runtime state; different versions or different channels are isolated.

This page explains how that works from a user's perspective. For the underlying data-directory layout, log-discovery mechanics, and per-store details, see [Data layout](/internals/data-layout/).

## The three runtime modes (and the channels they map to)

| Mode | When | Default channel | Data dir |
|---|---|---|---|
| **Installed** | Normal MSI install | `stable` | Runtime (DB, cache, logs): `~/.agentmux/channels/stable/versions/<v>/`. Shared (agents, settings): `~/.agentmux/channels/stable/`. See [Data layout → Per-channel contents](/internals/data-layout/#per-channel-contents) for the full split. |
| **Portable** (released ZIP) | Extracted release ZIP, run from `<extracted-folder>/agentmux.exe` | `stable` | Same as installed — both bind to the `stable` channel. |
| **Portable** (local `task package`) | A portable you built yourself from source | `dev-portable-<branch>` | `~/.agentmux/channels/dev-portable-<branch>/` (per-branch; no version sub-dir for local builds; `-- --fresh` for a throwaway dir) |
| **Dev** (`task dev`) | `task dev` from a checked-out source tree | `dev-<branch>-<clone>` | `~/.agentmux/dev/<branch>/<clone-id>/` |

Dev mode lives under `~/.agentmux/dev/` (outside `channels/`) and adds a per-clone segment so two checkouts of the same branch can run side-by-side. See [Multiple `task dev` sessions](#multiple-task-dev-sessions-from-different-clones) below.

The mode is detected at startup; the channel is derived from the mode. The override is `AGENTMUX_CHANNEL=<name>` — pin a channel explicitly for parallel-channel testing or to make a dev build share state with a portable. Has no effect in Dev mode (Dev branches don't route through `channels/`).

## What's per-instance vs per-version vs per-channel

Three axes of isolation, often confused:

**Per-instance** (one launcher → sidecar → host → renderer(s) tree, plus a Job Object) — every running AgentMux owns its own:

- Process tree, dynamic backend port, IPC pipe, Job Object
- Renderer JS contexts (in-memory state in the running window(s))

**Per-version** (one runtime-state set per (channel, version) pair, shared by all instances of the same release on the same channel, isolated from other versions of the same channel — shipped in v0.41.1):

- **Runtime SQLite stores** — workspaces, tabs, blocks, layouts, sagas, filestore (`objects.db`, `sagas.db`, `filestore.db`)
- **Logs** — host log files (rotated daily). Sidecar logs are *not* per-version — see [shared](#whats-shared) below.
- **Browser state (CEF cache)** — cookies, local storage, IndexedDB, service workers, cached JS
- **IPC + lockfiles** — ipc-port file, single-instance lock, named-pipe sockets

**Per-channel** (one set per channel, shared across every version of that channel, isolated between channels — these are the things you want to survive an upgrade):

- **Agent definitions** — per-agent working dirs and definitions; running v0.41.0 and v0.41.1 of `stable` side-by-side gives both access to the same agents
- **Settings** — `settings.json` and per-provider auth-config-dir homes (Claude, Codex, Gemini, OpenClaw, Kimi, Copilot, Pi — see [Auth flows](/auth/))

So: two instances of the **same release** on the **same channel** (e.g. two portables of v0.41.1 `stable` launched from different folders) share the per-version runtime DBs and the channel-wide agents/settings, but each is its own process tree. Two instances of **different releases** on the same channel (e.g. v0.40.2 and v0.41.1, both `stable`) share the channel-wide agents/settings but have separate runtime DBs and caches. Two instances on **different channels** (e.g. installed `stable` + a `dev-<branch>` build) share none of it.

This means installing a new patch release of `stable` doesn't disturb your existing My Agents or auth state — both versions share the `stable` channel's agents/config, the new version starts with a fresh runtime-DB sub-dir and the schema migrates forward in place. Switching between `task dev` branches *does* fully isolate, because each branch gets its own `dev-<branch>` channel. Dev mode keeps the legacy single-dir layout (no per-version split) because Dev builds aren't released versions.

## How channels and versions split state

Channels are the cross-cutting axis: they group runs by purpose (`stable`, `beta`, `dev-portable-<branch>`). Within a channel, the **agents you defined and the settings you tuned travel with the channel** — they survive upgrades. Each release version then gets its **own runtime DBs, CEF cache, logs, and IPC artifacts** under `channels/<channel>/versions/<v>/`, so two concurrent releases on the same channel can't collide on SQLite writes or corrupt each other's caches (shipped in v0.41.1).

This is a deliberate two-step model:

- **Pre-channels (legacy):** state was isolated per individual version (`~/.agentmux/versions/<version>/`), and `task package` bumped on every build. Each new build produced an empty dir — My Agents reset, conversation history vanished.
- **Channels (mid-2026):** state collapsed into one dir per channel. Agents and settings survived upgrades, but two concurrent versions on the same channel shared a SQLite file — a real hazard once tear-off and multi-version coexistence shipped.
- **Channels + version-scoped runtime (v0.41.1+):** runtime DBs, cache, logs, and IPC are version-scoped under `channels/<ch>/versions/<v>/`. Agents and settings remain channel-wide so they still survive upgrades. `task package` no longer bumps (local builds carry an ephemeral label, not a new version), with forward-only schema migrations on launch. A safety lock refuses to open a channel whose schema is newer than the running binary (so an older AgentMux can't downgrade-corrupt a channel a newer build wrote to). Pre-migration snapshots auto-save and the last 5 are kept.

See [Data layout → Schema safety lock + snapshots](/internals/data-layout/#schema-safety-lock--snapshots) and the [`SPEC_DATA_CHANNELS_2026_05_24`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/SPEC_DATA_CHANNELS_2026_05_24.md) spec for the design.

## What's shared

A few things are channel-independent and shared across all instances:

- **Sidecar logs** — `~/.agentmux/logs/agentmuxsrv-v<v>.log.<date>` — written directly to the account-wide log dir (not the per-version path) so `muxlog srv` resolves uniformly from any AgentMux terminal regardless of which channel/version is running.
- **Pointer files** that resolve to the currently-running instance's logs (`current-host-v<v>.path`, `current-srv-v<v>.path`) so a `muxlog` shell helper opened from any context can find the right log file. Plus the launcher's own startup log (`agentmux-launcher.log`).
- **Account-wide state** — dictionary downloads and anything the user authenticates "once" rather than "per channel" (the platform's system Crashpad dir on Windows; provider OAuth tokens are *not* in this category — those live per-channel under `channels/<ch>/config/auth/`).
- **Account-wide config** — the launcher's own `~/.agentmux/config.toml` (saga retention, etc.).

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

## Tearing a tab into a new instance

You can spawn a fresh AgentMux instance directly from a running window by **dragging a tab below the tab bar**. The drag has to clear the tab bar by ~5px before it commits — pulling the tab back into the bar before that threshold cancels the gesture, as does pressing `Esc` mid-drag.

What happens on a successful tear-off:

- A new top-level AgentMux window spawns at the cursor, matching the source window's size and position across monitors (DPI-corrected).
- The window paints live during the drag (Chrome-style follow), at full opacity.
- The new window is a **full new instance**: own backend sidecar, own data dir, own workspace, own taskbar entry — same independence as launching AgentMux twice from the Start menu.

Because the new window is a separate instance — but the same binary, so the same (channel, version) — it shares the per-version runtime state (cookies, CEF cache, SQLite stores) and the channel-wide agents/settings of the source window. A tear-off onto a different channel is fully isolated.

**Platform support:** Windows ✅, macOS ✅ (v0.40+), Linux ✅ Phase A (v0.41+, Wayland). There is no menu item or keyboard shortcut for tear-off today — drag is the only invocation path.

**Known limitation:** Dropping the dragged tab into *another* running AgentMux instance's tab bar is not yet wired up — Phase 1 only supports tearing to the desktop, not cross-instance docking. That's planned for Phase 2.

Floating panes (pop a single pane into its own owned window without spawning a new instance) are a separate feature; only the Phase 1 host primitive has shipped — there is no user-visible gesture yet.

## Running different versions side-by-side

Starting in v0.41.1, different AgentMux versions (e.g. 0.40.x and 0.41.x) can run simultaneously without interfering. Before v0.41.1, launching an older portable while a newer one was running would silently focus the wrong window.

Each version has its own single-instance domain — the launcher's named-pipe hash includes the build version, so two binaries on the same channel produce distinct pipes and don't activate each other's window (shipped in [#1227](https://github.com/agentmuxai/agentmux/pull/1227)). Runtime databases, CEF cache, host logs, and IPC artifacts are version-scoped under `channels/<channel>/versions/<semver>/`, so two concurrent releases can't collide on SQLite writes or corrupt each other's caches. Agent definitions and settings live at the channel level and are shared across all versions of that channel, so your agents and settings are available in both.

This is independent of tear-off: it applies whenever two different versions on the same channel launch at the same time, regardless of how they were launched.

## Browser state

Browser state (cookies, local storage, IndexedDB, service workers, cached JS, DevTools settings) lives on disk in the version-scoped CEF cache (`channels/<channel>/versions/<v>/cef-cache/`, v0.41.1+). It's shared between instances of the same (channel, version) running simultaneously, and isolated from other versions on the same channel as well as other channels entirely. See [What's per-instance vs per-version vs per-channel](#whats-per-instance-vs-per-version-vs-per-channel).

If you need to wipe browser state for a single version: delete that version's `cef-cache/` and the browser pane comes up fresh on the next launch. ([Data layout](/internals/data-layout/) has the exact path.)

## Common pitfalls

**"Why isn't my dev build picking up the meta?"**
You're probably running `task dev` from a different branch — or a different clone — than the one that wrote the meta. Each (branch, clone) pair gets its own dev data dir at `~/.agentmux/dev/<branch>/<clone-id>/`. Switching branches restarts the session in a different dir; running from a separate checkout of the same branch also gets its own dir. See [Multiple `task dev` sessions](#multiple-task-dev-sessions-from-different-clones).

**"What survives a version upgrade?"**
- **Agent definitions** and **settings** (incl. per-provider auth dirs) live at the channel level (`channels/<ch>/agents/`, `channels/<ch>/config/`) and carry over from one version to the next automatically.
- **Conversations, sagas, filestore, CEF cache, host logs, and IPC artifacts** are version-scoped (`channels/<ch>/versions/<v>/...`, v0.41.1+) — a fresh release starts with its own runtime sub-dir. On first launch of a new version, the launcher copies the immediate-prior version's runtime data into the new sub-dir so your conversation history isn't lost (one-time copy; the prior version's dir stays intact so you can fall back). If both versions then run concurrently, their runtime state diverges from that point.
- **Sidecar log** lives at `~/.agentmux/logs/` (account-wide), so the cross-version `muxlog srv` recipe keeps working regardless.

**"Are running portables sharing state?"**
Depends on the (channel, version) pair. Two portables of the *same* release on the *same* channel share the version-scoped runtime SQLite, CEF cache, and host logs as well as the channel-wide agents/settings — they're effectively the same data, just two process trees. Two portables of *different* releases on the same channel share only the channel-wide agents/settings; their runtime dirs are separate. Two portables on *different* channels (e.g. `stable` vs `dev-portable`) share nothing. In all cases the launcher/sidecar/host/renderer tree is its own [instance](/glossary/#instance) with its own Job Object.

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
