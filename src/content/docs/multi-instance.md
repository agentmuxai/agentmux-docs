---
title: Running multiple instances
description: How AgentMux lets multiple installs and dev builds run side-by-side without colliding.
---

AgentMux is designed for **multiple [instances](/glossary/#instance) running side-by-side** — installed + dev, a portable + `task dev`, several portable copies of the same release. Each instance has its own process tree (launcher → sidecar → host → renderer(s)), its own process-isolation container (Job Object on Windows / process group on Linux + macOS), and its own dynamic backend port. On-disk state has three axes: **per-channel** (settings + per-channel agent working dirs — survive upgrades within a channel), **per-version within a channel** (SQLite, host logs, CEF cache + cookies, IPC artifacts — isolated per release so concurrent versions don't collide), and **account-wide** (agent definitions + instances registry, provider auth, sidecar log, dictionaries, launcher config — independent of channel, under `~/.agentmux/shared/`). Instances on the same (channel, version) share their runtime state; different versions or different channels are isolated, but agents and auth follow you across all of them.

This page explains how that works from a user's perspective. For the underlying data-directory layout, log-discovery mechanics, and per-store details, see [Data layout](/internals/data-layout/).

## The three runtime modes (and the channels they map to)

| Mode | When | Default channel | Data dir |
|---|---|---|---|
| **Installed** | Inno Setup installer | `stable` | Runtime (DB, cache, logs): `~/.agentmux/channels/stable/versions/<v>/`. Shared (agents, settings): `~/.agentmux/channels/stable/`. See [Data layout → Per-channel contents](/internals/data-layout/#per-channel-contents) for the full split. |
| **Portable** (released ZIP) | Extracted release ZIP, run from `<extracted-folder>/agentmux.exe` | `stable` | Same as installed — both bind to the `stable` channel. |
| **Portable** (local `task package`) | A portable you built yourself from source | `local-<branch>-<hash>-<build-id>` (per build) | `~/.agentmux/channels/local-<branch>-<hash>-<build-id>/versions/<v>/` (version-scoped like any release; **each rebuild gets its own channel** — `--fresh` is now a no-op since every build is already isolated) |
| **Dev** (`task dev`) | `task dev` from a checked-out source tree | `dev-<branch>` | `~/.agentmux/dev/<branch>/<clone-id>/` |

Dev mode lives under `~/.agentmux/dev/` (outside `channels/`) and adds a per-clone segment so two checkouts of the same branch can run side-by-side. See [Multiple `task dev` sessions](#multiple-task-dev-sessions-from-different-clones) below.

Local `task package` builds are channel-isolated **per build**, not per branch. The channel is baked into the binary at compile time (`AGENTMUX_BUILD_CHANNEL_DEFAULT`) as `local-<branch>-<hash>-<build-id>`, so two rebuilds of the same branch get **different** channels and therefore **do not** share a data dir or session — each build is its own AgentMux instance with its own data dir, CEF cache, and single-instance pipe. Because agent definitions and auth are account-wide (under `~/.agentmux/shared/`), a fresh per-build data dir still shows every agent and stays logged in — only pane layout and memories start fresh. These per-build channels accumulate on disk; remove unused `~/.agentmux/channels/local-*` manually when no instance from that build is running.

The mode is detected at startup; the channel is derived from the mode. The override is `AGENTMUX_CHANNEL=<name>` — pin a channel explicitly for parallel-channel testing or to make a dev build share state with a portable. Has no effect in Dev mode (Dev branches don't route through `channels/`).

## What's per-instance vs per-version vs per-channel

Three axes of isolation, often confused:

**Per-instance** (one launcher → sidecar → host → renderer(s) tree, plus a process-isolation container) — every running AgentMux owns its own:

- Process tree, dynamic backend port, IPC socket/pipe, process-isolation container (Job Object on Windows / process group on Linux + macOS)
- Renderer JS contexts (in-memory state in the running window(s))

**Per-version** (one runtime-state set per (channel, version) pair, shared by all instances of the same release on the same channel, isolated from other versions of the same channel — shipped in v0.41.1):

- **Runtime SQLite stores** — workspaces, tabs, blocks, layouts, sagas, filestore (`objects.db`, `sagas.db`, `filestore.db`)
- **Logs** — host log files (rotated daily). Sidecar logs are *not* per-version — see [shared](#whats-shared) below.
- **Browser state (CEF cache)** — cookies, local storage, IndexedDB, service workers, cached JS
- **IPC + lockfiles** — ipc-port file, single-instance lock, named-pipe sockets (Windows) / Unix domain sockets (Linux + macOS)

**Per-channel** (one set per channel, shared across every version of that channel, isolated between channels — these are the things you want to survive an upgrade):

- **Agent working dirs** — `channels/<ch>/agents/`, the per-agent working directories, shared across versions of the channel
- **Settings** — `settings.json` (and `keybindings.json`) under `channels/<ch>/config/`. Provider auth-config dirs (OAuth tokens, API keys) are *not* per-channel — they live account-wide under `~/.agentmux/shared/providers/<provider>/` so credentials persist across channel upgrades. See [Auth flows](/auth/).

**Account-wide** (one set per machine account, shared across *every* channel and version — broader than per-channel):

- **Agent definition registry** — `shared/agents/definitions/`, the canonical agent definitions, shared across all channels
- **Agent instances registry** — `shared/agents/registry/`, cross-channel agent instances plus each agent's `session_id` for resume
- **Provider auth** — `shared/providers/<provider>/` for a plain agent spawn's *ambient* credentials — unconditionally global, every channel and version. **Explicitly-bound Armory Accounts are the one exception**, as of a more recent default change: on any channel other than `stable`, the Armory account list (and any account you bind to an agent from that channel) now defaults to *isolated* to that one channel instead of account-wide — a fresh `dev-<branch>` or per-build `local-*` channel starts with zero Armory accounts. `stable` is unaffected. See [Auth flows → Isolated auth by channel](/auth/#isolated-auth-by-channel) for the full rule, the override env var, and why a plain (non-Account-bound) agent spawn is never affected by it.

So agents and ambient auth follow you everywhere: a brand-new per-build `local-*` channel, or a `dev-<branch>` channel, still shows all your agents and stays logged in for any agent not explicitly bound to an Armory Account. An agent that *is* bound to an Account only keeps working seamlessly across that channel switch because the binding itself (`db_agent_identity_links`) lives in a separate, always-global identity store — see [Identity & Accounts → Persistence](/identity/#persistence) for that split.

So: two instances of the **same release** on the **same channel** (e.g. two portables of v0.41.1 `stable` launched from different folders) share the per-version runtime DBs and the channel-wide settings/agent working dirs, but each is its own process tree. Two instances of **different releases** on the same channel (e.g. v0.40.2 and v0.41.1, both `stable`) share the channel-wide settings/agent working dirs but have separate runtime DBs and caches. Two instances on **different channels** (e.g. installed `stable` + a `dev-<branch>` build) share no channel- or version-scoped state — but the account-wide agent registries and auth are still common to both.

This means installing a new patch release of `stable` doesn't disturb your existing My Agents or auth state — both versions share the `stable` channel's agents/config, the new version starts with a fresh runtime-DB sub-dir and the schema migrates forward in place. Switching between `task dev` branches *does* fully isolate, because each branch gets its own `dev-<branch>` channel. Dev mode keeps the legacy single-dir layout (no per-version split) because Dev builds aren't released versions.

## How channels and versions split state

Channels are the cross-cutting axis: they group runs by purpose (`stable`, the per-build `local-<branch>-<hash>-<build-id>`, `dev-<branch>`). Within a channel, the **settings you tuned travel with the channel** — they survive upgrades — while your **agents and auth travel even further**, account-wide under `~/.agentmux/shared/`, so they're present in every channel. Each release version then gets its **own runtime DBs, CEF cache, logs, and IPC artifacts** under `channels/<channel>/versions/<v>/`, so two concurrent releases on the same channel can't collide on SQLite writes or corrupt each other's caches (shipped in v0.41.1).

This is a deliberate two-step model:

- **Pre-channels (legacy):** state was isolated per individual version (`~/.agentmux/versions/<version>/`), and `task package` bumped on every build. Each new build produced an empty dir — My Agents reset, conversation history vanished.
- **Channels (mid-2026):** state collapsed into one dir per channel. Agents and settings survived upgrades, but two concurrent versions on the same channel shared a SQLite file — a real hazard once tear-off and multi-version coexistence shipped.
- **Channels + version-scoped runtime (v0.41.1+):** runtime DBs, cache, logs, and IPC are version-scoped under `channels/<ch>/versions/<v>/`. Settings stay channel-wide, and agents + auth move account-wide under `~/.agentmux/shared/`, so all of them survive upgrades (and agents/auth survive channel switches too). `task package` no longer bumps (local builds carry an ephemeral label, not a new version) and bakes a per-build channel so each build is its own instance, with forward-only schema migrations on launch. A safety lock refuses to open a channel whose schema is newer than the running binary (so an older AgentMux can't downgrade-corrupt a channel a newer build wrote to). Pre-migration snapshots auto-save and the last 5 are kept.

See [Data layout → Schema safety lock + snapshots](/internals/data-layout/#schema-safety-lock--snapshots) and the [`SPEC_DATA_CHANNELS_2026_05_24`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/SPEC_DATA_CHANNELS_2026_05_24.md) spec for the design.

## What's shared

A few things are channel-independent and shared across all instances:

- **Sidecar logs** — `~/.agentmux/logs/agentmuxsrv-v<v>.log.<date>` — written directly to the account-wide log dir (not the per-version path) so `muxlog srv` resolves uniformly from any AgentMux terminal regardless of which channel/version is running.
- **Pointer files** that resolve to the currently-running instance's logs (`current-host-v<v>.path`, `current-srv-v<v>.path`) so a `muxlog` shell helper opened from any context can find the right log file. Plus the launcher's own startup log (`agentmux-launcher.log`).
- **Account-wide state** (`~/.agentmux/shared/`) — dictionary downloads; provider OAuth tokens and API keys (`shared/providers/<provider>/`, so credentials survive channel upgrades); the global agent **definition** registry (`shared/agents/definitions/`); and the global agent **instances** registry (`shared/agents/registry/` — cross-channel agents plus each one's `session_id` for resume). Plus the platform's system Crashpad dir on Windows.
- **Account-wide config** — the launcher's own `~/.agentmux/config.toml` (saga retention, etc.).

## Running multiple instances at once

You can:

- Run a `stable` portable *and* `task dev` simultaneously. Different channels → different data dirs, different ports, different databases.
- Run a `stable` portable and a `local-<branch>-<hash>-<build-id>` build side by side. Both running, fully isolated. Two `task package` rebuilds of the *same* branch are likewise isolated — each is its own channel.
- Test a feature branch against an installed AgentMux without leaving the running session — `task dev` from the branch gets its own `dev-<branch>` channel.
- Pin parallel channels with `AGENTMUX_CHANNEL=beta agentmux.exe` to test a release candidate without touching `stable` state.

Each new launch picks up its own dynamic backend port. There's no port to coordinate.

## Multiple `task dev` sessions from different clones

Two checkouts of `agentmux` on the same host can each run `task dev` in parallel, even on the same branch. Every dev launch derives a stable **clone id** from a hash of its workspace-root path:

- **Data dir:** `~/.agentmux/dev/<branch>/<clone-id>/` — distinct per clone, so lockfile, IPC socket/pipe, CEF cache, and logs all isolate. (Without this, two clones on the same branch would silently share state — the second `task dev`'s launcher would attach to the first clone's running window.)
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
- The new window is a **full new instance**: own backend sidecar, own data dir, own workspace, and its own entry in the OS window manager (Windows taskbar, macOS Dock, GNOME activities, etc.) — same independence as launching AgentMux twice from a fresh shortcut.

Because the new window is a separate instance — but the same binary, so the same (channel, version) — it shares the per-version runtime state (cookies, CEF cache, SQLite stores) and the channel-wide settings of the source window, plus the account-wide agents and auth. A tear-off can only land on the same channel; channel-scoped state is never crossed.

**Platform support:** Windows ✅, macOS ✅ (v0.40+), Linux ✅ Phase A (v0.41+, Wayland). There is no menu item or keyboard shortcut for tear-off today — drag is the only invocation path.

**Known limitation:** Dropping the dragged tab into *another* running AgentMux instance's tab bar is not yet wired up — Phase 1 only supports tearing to the desktop, not cross-instance docking. That's planned for Phase 2.

**Floating panes** (pop a single pane into its own owned window without spawning a new instance) are a distinct feature — drag a pane header outside the window to float it. See [Pane Management → Floating panes](/pane-types/#floating-panes) for the full gesture and redock behaviour.

## Running different versions side-by-side

Different AgentMux versions (e.g. 0.40.x and 0.41.x) can run simultaneously without interfering. On macOS this takes **two** isolation layers, not one.

**Launcher layer (all platforms).** Each version has its own single-instance domain — the launcher's IPC socket/pipe hash includes the build version, so two binaries on the same channel produce distinct sockets/pipes and don't activate each other's window (Windows v0.41.1 / macOS + Linux v0.42.x, shipped in [#1227](https://github.com/agentmuxai/agentmux/pull/1227)). Runtime databases, CEF cache, host logs, and IPC artifacts are version-scoped under `channels/<channel>/versions/<semver>/`, so two concurrent releases can't collide on SQLite writes or corrupt each other's caches. Settings live at the channel level (shared across all versions of that channel) and agents + auth are account-wide under `~/.agentmux/shared/`, so your agents and settings are available in both. Before this shipped, launching an older portable while a newer one ran would silently focus the wrong window on Windows/Linux (and hang on macOS — see the identity layer next).

**macOS identity layer (LaunchServices).** macOS routes a launch by `CFBundleIdentifier` through LaunchServices *before* the launcher runs, so the socket hash alone isn't enough. Until the channel-scoped bundle id ([#1568](https://github.com/agentmuxai/agentmux/pull/1568)) every build shared one id (`ai.agentmux.cef`), so double-clicking a second version made macOS try to re-activate the already-running one and hang with *"AgentMux is not responding."* Now the bundle id **follows the channel** — `ai.agentmux.cef.<channel>` (the default release channel is `ai.agentmux.cef.stable`; a local `task package` build is `ai.agentmux.cef.local-<branch>-<hash>-<build-id>`). So:

- **Different channels** (e.g. a `local-<branch>-<hash>-<build-id>` build vs `stable`) are **distinct macOS apps** — double-click-launchable side by side.
- **Two stable releases** still share `ai.agentmux.cef.stable`, so launching a second one re-activates the running release instead of starting a separate process. To run two stable releases at once on macOS, launch the second with `open -n /path/to/AgentMux.app`, or use the in-app status-bar instance chip → **"+ Open another window."**
- **Re-activating a running AgentMux opens a new window** — both Finder double-click / `open` *and* a Dock-icon click now forward to the running host and spawn a fresh window ([#1692](https://github.com/agentmuxai/agentmux/pull/1692), building on [#1572](https://github.com/agentmuxai/agentmux/pull/1572)). This works reliably; the earlier *"AgentMux is not responding"* hang is fixed.

This is independent of tear-off: it applies whenever two different versions launch at the same time, regardless of how they were launched.

## Browser state

Browser state (cookies, local storage, IndexedDB, service workers, cached JS, DevTools settings) lives on disk in the version-scoped CEF cache (`channels/<channel>/versions/<v>/cef-cache/`, v0.41.1+). It's shared between instances of the same (channel, version) running simultaneously, and isolated from other versions on the same channel as well as other channels entirely. See [What's per-instance vs per-version vs per-channel](#whats-per-instance-vs-per-version-vs-per-channel).

If you need to wipe browser state for a single version: delete that version's `cef-cache/` and the browser pane comes up fresh on the next launch. ([Data layout](/internals/data-layout/) has the exact path.)

## Common pitfalls

**"Why isn't my dev build picking up the meta?"**
You're probably running `task dev` from a different branch — or a different clone — than the one that wrote the meta. Each (branch, clone) pair gets its own dev data dir at `~/.agentmux/dev/<branch>/<clone-id>/`. Switching branches restarts the session in a different dir; running from a separate checkout of the same branch also gets its own dir. See [Multiple `task dev` sessions](#multiple-task-dev-sessions-from-different-clones).

**"What survives a version upgrade?"**
- **Settings** and **agent working dirs** live at the channel level (`channels/<ch>/config/`, `channels/<ch>/agents/`) and carry over from one version to the next automatically.
- **Agent definitions, the agent instances registry, and ambient provider auth** live account-wide under `~/.agentmux/shared/` (`shared/agents/definitions/`, `shared/agents/registry/`, `shared/providers/<provider>/`), so they survive not just upgrades but channel switches too — including a brand-new per-build `local-*` channel. Explicitly-bound Armory Accounts are the exception to the auth half of this — see the [Account-wide](#whats-per-instance-vs-per-version-vs-per-channel) bullet above.
- **Session history and block state (`objects.db`, `sagas.db`), CEF cache, host logs, and IPC artifacts** are version-scoped (`channels/<ch>/versions/<v>/...`, v0.41.1+) — a fresh release starts with its own runtime sub-dir. On first launch of a new version, the launcher copies the immediate-prior version's runtime data into the new sub-dir so your conversation history isn't lost (one-time copy; the prior version's dir stays intact so you can fall back). If both versions then run concurrently, their runtime state diverges from that point.
- **Sidecar log** lives at `~/.agentmux/logs/` (account-wide), so the cross-version `muxlog srv` recipe keeps working regardless.

**"Are running portables sharing state?"**
Depends on the (channel, version) pair. Two portables of the *same* release on the *same* channel share the version-scoped runtime SQLite, CEF cache, and host logs as well as the channel-wide settings — they're effectively the same data, just two process trees. Two portables of *different* releases on the same channel share only the channel-wide settings and agent working dirs; their runtime dirs are separate. Two portables on *different* channels (e.g. `stable` vs a `local-<branch>-<hash>-<build-id>` build, or two rebuilds of the same branch) share no channel- or version-scoped state. In **all** of these cases the account-wide agents and ambient auth (`~/.agentmux/shared/`) are still common, so every instance shows your agents and stays logged in for a plain agent spawn — except Armory Accounts explicitly bound to an agent, which follow the conditional per-channel default noted above. And in all cases the launcher/sidecar/host/renderer tree is its own [instance](/glossary/#instance) with its own process-isolation container (Job Object on Windows / process group on Linux + macOS).

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
- [Auth flows](/auth/) — provider credential storage model and auth flows per provider
- [Data layout](/internals/data-layout/) — internals: SQLite stores, pointer files, log discovery
