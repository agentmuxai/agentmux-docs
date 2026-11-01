---
title: Environment variable contract
description: Every AGENTMUX_* variable in the process tree — who sets it, who reads it, and the security pitfalls.
---

**Checked against:** 0.60.10 | **Date:** 2026-11-01

This page covers the variables that matter to the process tree and to a pane's environment, not every `AGENTMUX_*` variable in the code (there are over two hundred; most are test, debug or build switches). Every variable named here exists.

This document is the canonical reference for every `AGENTMUX_*` (and legacy
`WAVEMUX_*`) environment variable that flows through the AgentMux process
tree. Its absence was the direct cause of the Win11 focused-border
invisibility bug (an agent colour of #000000 silently became the pane's
focused-border colour, making it invisible against a dark background).

---

## Process Tree Overview

```
agentmux-launcher  (J0 Job Object owner)
  │   sets: path vars, BACKEND_WS/WEB/PID, AUTH_KEY, SRV_PIPE_PATH
  │         LAUNCHER_PIPE, HOME, SPLASH_EVENT, INSTANCE_ID
  │
  ├── agentmux-srv  (sidecar, J0 member)
  │     reads: path vars, AUTH_KEY, APP_PATH, SRV_PIPE_PATH
  │     sets own env: LOCAL_URL (after binding), DATA_HOME, CONFIG_HOME
  │     strips: AUTH_KEY from its own process env after reading, then
  │             hands a pane only the variables on PANE_ENV_KEEP
  │
  └── agentmux-cef  (Chromium host, J0 member)
        reads: BACKEND_WS/WEB/PID, AUTH_KEY, LAUNCHER_PIPE/PID
               HOME, SPLASH_EVENT, INSTANCE_ID, RUNTIME_MODE, path vars
        │
        └── [PTY shell per pane]  (child of srv, not host)
              reads: AGENTMUX, BLOCKID, TABID, VERSION, BUILD,
                     INSTANCE_CHANNEL, LOG_DIR, LOCAL_URL, AUTH_KEY,
                     AGENT_ID, AGENT_SLUG, AGENT_DISPLAY, INSTANCE_SLUG,
                     TERM, COLORTERM, TERM_PROGRAM, PATH (augmented)
              shell integration sends OSC 16162;E back to srv
```

Source files cited throughout:
- `shell.rs` = `crates/srv/src/backend/blockcontroller/shell/lifecycle.rs`
- `data_paths.rs` = `crates/common/src/data_paths.rs`
- `runtime_mode.rs` = `crates/common/src/runtime_mode.rs`
- `srv_spawner.rs` = `crates/launcher/src/srv_spawner.rs`
- `launcher/main.rs` = `crates/launcher/src/main.rs`
- `shellintegration.rs` = `crates/srv/src/backend/shellintegration.rs`
- `bash.sh` = `crates/srv/src/backend/shellintegration/bash.sh`
- `pwsh.ps1` = `crates/srv/src/backend/shellintegration/pwsh.ps1`
- `websocket.rs` = `crates/srv/src/server/websocket.rs`

---

## Group 1 — Identity Variables

These variables identify the agent persona assigned to a pane and drive
focused-border colour, pane title, and jekt auto-registration.

### AGENTMUX_AGENT_ID

| Attribute | Value |
|-----------|-------|
| **Who sets it** | srv shell controller (`shell.rs`) from block `cmd:env` metadata (never from global settings `cmd_env`); `crates/srv/src/server/app_api/agent_open.rs` on `agent.open`; `agent_config.rs` for MCP env injection |
| **Who reads it** | PTY shell process; shell integration scripts (`bash.sh`, `pwsh.ps1`, `zsh.sh`) encode it into OSC 16162;E on every prompt; `shell.rs` reads it to decide jekt auto-registration |
| **Example value** | `AgentX`, `Aria`, `Terminal` |
| **Lifetime** | Set once at pane spawn; persists for the lifetime of the PTY session |

**Priority chain** (`shell.rs`):
1. Block metadata `cmd:env["AGENTMUX_AGENT_ID"]`
2. Legacy compat: `WAVEMUX_AGENT_ID` in the same block `cmd:env` (read-only fallback for jekt registration)

Global settings `cmd_env["AGENTMUX_AGENT_ID"]` and the srv process env are deliberately not consulted.

**Strip logic** (`shell.rs`): if none of the above sources provides
a value, `AGENTMUX_AGENT_ID` and the legacy `WAVEMUX_AGENT_ID` and
`WAVEMUX_AGENT_COLOR` are _actively removed_ from the
PTY child's environment so a parent AgentMux pane's identity does not bleed into
a new plain terminal pane.

**PITFALL — jekt pseudo-agent:** `AGENTMUX_AGENT_ID='Terminal'` is the
string that a plain (non-agent) pane would show if the strip logic were
absent. Do not configure this value unless you actually want the pane
treated as a named agent named "Terminal". The jekt registry will accept
it and route messages there.

**PITFALL — OSC 16162;E feedback loop:** The shell integration re-emits the
value on every prompt via an OSC sequence that the srv parses. If you
`export AGENTMUX_AGENT_ID=X` inside a running shell, the next prompt
triggers an identity update that the frontend applies immediately. This is
intentional (live agent re-binding), but setting the var to an empty string
emits `{}` rather than nothing, which clears the pane's displayed identity.

---

### AGENTMUX_AGENT_COLOR / AGENTMUX_AGENT_TEXT_COLOR (decommissioned)

| Attribute | Value |
|-----------|-------|
| **Status** | Decommissioned on 2026-09-20. srv no longer injects either variable into a pane, and neither is on `PANE_ENV_KEEP`. |
| **Who reads them** | Nothing. The shell integration scripts no longer send them in the OSC 16162;E payload, and the pane header and border use the agent's persisted `ui:color`. |

A value set in a block's `cmd:env` has no effect on the pane's colours. Set the agent's colour in its definition instead.

---

### The pane allow-list (`PANE_ENV_KEEP`)

An `AGENTMUX_*` variable reaches a pane only if it is on the allow-list `PANE_ENV_KEEP` in `crates/srv/src/backend/pane_env.rs`. Everything else that srv holds (the instance's data, config and cache folders, the channel, the runtime mode) is removed from the pane's environment, so a build started from a pane can't adopt the launching instance's identity. The list is an allow-list on purpose: a variable added later is kept out until someone adds it with a reason.

| Group | Variables |
|-------|-----------|
| The instance's loopback API | `AGENTMUX_LOCAL_URL`, `AGENTMUX_AUTH_KEY` |
| Which pane | `AGENTMUX_BLOCKID`, `AGENTMUX_TABID` |
| Which build | `AGENTMUX_VERSION`, `AGENTMUX_BUILD`, `AGENTMUX_INSTANCE_CHANNEL`, `AGENTMUX_LOG_DIR` |
| Agent identity | `AGENTMUX_AGENT_ID`, `AGENTMUX_AGENT_SLUG`, `AGENTMUX_AGENT_DISPLAY`, `AGENTMUX_INSTANCE_SLUG` |

`AGENTMUX` itself (the nesting sentinel) is always set to `1` and never stripped. On Linux, the AppImage's own `APPIMAGE`, `APPDIR`, `OWD` and `ARGV0`, and this version's folder in `LD_LIBRARY_PATH`, are removed too.

An agent's turn gets more variables than a plain pane, which srv sets when it starts the turn: `AGENTMUX_AGENT_UID`, `AGENTMUX_AGENT_TOKEN` (the agent's own token), the former names and slugs after a rename, the git author and committer identity, and the GitHub-broker switches. `crates/srv/src/backend/agent_env_scope.rs` lists each with the reason it reaches a container agent or doesn't. The MCP server entry in an agent's `.mcp.json` (`crates/srv/src/backend/mcp_json_identity.rs`) also carries the signing keys for jekts (`AGENTMUX_JEKT_KEY` and the LAN and WAN keys). Treat those as secrets and never log them.

---

### WAVEMUX_AGENT_ID / WAVEMUX_AGENT_COLOR (legacy)

| Attribute | Value |
|-----------|-------|
| **Status** | Deprecated — read-only backward-compat bridge |
| **Who reads them** | `shell.rs` reads `WAVEMUX_AGENT_ID` as the lowest-priority fallback for jekt registration only |
| **Strip logic** | Both are removed from PTY children when no explicit agent identity is configured (`shell.rs`) |

These variables were the pre-rebrand names from the WaveMux era. Do not
set them in new configurations; use `AGENTMUX_*` equivalents instead.
The only surviving use is as a read-only fallback in the jekt
auto-registration path — they are never written by AgentMux.

---

## Group 2 — Path Variables

All path variables are set by the launcher from `DataPaths::to_env_vars()`
(`data_paths.rs`) and consumed by downstream binaries via
`DataPaths::from_env()` (`data_paths.rs`). The launcher is the
single source of truth; downstream binaries must not recompute paths.

```
~/.agentmux/                              ← AGENTMUX_INSTANCE_DIR anchor (home_dir field)
├── shared/                               ← AGENTMUX_SHARED_DIR
├── channels/<channel>/                   ← AGENTMUX_INSTANCE_DIR  (Installed/Portable)
│   ├── config/                           ← AGENTMUX_CONFIG_DIR
│   ├── agents/                           ← AGENTMUX_AGENTS_DIR
│   └── versions/<ver>/
│       ├── data/                         ← AGENTMUX_DATA_DIR (+ legacy AGENTMUX_DATA_HOME)
│       ├── logs/                         ← AGENTMUX_LOG_DIR
│       ├── cef-cache/                    ← AGENTMUX_CEF_CACHE_DIR
│       └── runtime/                      ← AGENTMUX_INSTANCE_RUNTIME_DIR
└── dev/<branch>/[<clone_id>/]            ← AGENTMUX_INSTANCE_DIR  (Dev mode)
    └── (same children, no version/ nesting)
```

### AGENTMUX_INSTANCE_DIR

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher, via `DataPaths::to_env_vars()` (`data_paths.rs`) |
| **Who reads it** | srv, host via `DataPaths::from_env()` |
| **Example** | `C:\Users\<name>\.agentmux\channels\stable` |
| **Purpose** | Channel root; config and agents directories hang directly off this |

---

### AGENTMUX_DATA_DIR

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher (`data_paths.rs`) |
| **Who reads it** | srv for SQLite database location (`objects.db`, `sagas.db`); `DataPaths::from_env()` |
| **Example** | `C:\Users\<name>\.agentmux\channels\stable\versions\0.60.10\data` |

**Legacy alias:** srv also publishes `AGENTMUX_DATA_HOME` for any
code path that pre-dates the unification (`crates/srv/src/bootstrap/stores.rs`). New code
should read `AGENTMUX_DATA_DIR`.

---

### AGENTMUX_CONFIG_DIR

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher (`data_paths.rs`) |
| **Who reads it** | srv `config.rs`, which re-exports it as `AGENTMUX_CONFIG_HOME` for `config_watcher_fs.rs` (`settings.json` and related config files) |
| **Example** | `C:\Users\<name>\.agentmux\channels\stable\config` |

**Legacy alias:** `AGENTMUX_CONFIG_HOME` (`base.rs`). Same caveats as
DATA_DIR/DATA_HOME above.

---

### AGENTMUX_LOG_DIR

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher (`data_paths.rs`); also injected into PTY child environment by srv shell controller (`shell.rs`) with a hardcoded `~/.agentmux/logs` path |
| **Who reads it** | Shell integration `muxlog` helper (`bash.sh`, `pwsh.ps1`); `memory_heartbeat.rs`; any process in a pane that wants to locate logs |
| **Example** | `/home/alice/.agentmux/logs` or `C:\Users\<name>\.agentmux\logs` |

**Note on dual injection:** The launcher sets the canonical per-channel
log dir; the shell controller re-injects the value into PTY children using
`dirs::home_dir().join(".agentmux").join("logs")` (a fixed path,
`shell.rs`). The two values are identical in production but diverge
in test scenarios. PTY children should use whatever value is in their
environment.

**PITFALL:** On Windows with MSIX packaging, `AGENTMUX_DATA_DIR` and
friends resolve inside the virtual file system, but `AGENTMUX_LOG_DIR` is
always under the real home dir (`shell.rs`) because ConPTY child
processes cannot see virtualised MSIX writes at their literal path.

---

### AGENTMUX_CEF_CACHE_DIR

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher (`data_paths.rs`) |
| **Who reads it** | CEF host for Chromium profile / cache directory |
| **Example** | `C:\Users\<name>\.agentmux\channels\stable\versions\0.60.10\cef-cache` |

Regenerable; can be deleted without data loss.

---

### AGENTMUX_AGENTS_DIR

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher (`data_paths.rs`) |
| **Who reads it** | srv agent definition storage; channel-wide (does not include the version segment) |
| **Example** | `C:\Users\<name>\.agentmux\channels\stable\agents` |

---

### AGENTMUX_INSTANCE_RUNTIME_DIR

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher (`data_paths.rs`) |
| **Who reads it** | srv and launcher for single-instance lock files, IPC port file, named-pipe path |
| **Example** | `C:\Users\<name>\.agentmux\channels\stable\versions\0.60.10\runtime` |

---

### AGENTMUX_SHARED_DIR

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher (`data_paths.rs`) |
| **Who reads it** | Identity/OAuth code; provider auth dirs live here so credentials persist across channel/version upgrades |
| **Example** | `C:\Users\<name>\.agentmux\shared` |

Channel-independent and version-independent. The fix for the
per-channel OAuth re-authentication regression (each channel had an
empty auth dir → Claude would spin prompting for login on every new
channel). Provider credential directories now always live under
`shared/providers/<provider>/`.

---

### AGENTMUX_HOME

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher (Windows only, `crates/launcher/src/host_spawn.rs`) to the `runtime/` directory containing the host binary |
| **Who reads it** | CEF host for asset resolution (`crates/cef/src/commands/window/creation.rs`): `index.html`, frontend bundle |
| **Example** | `C:\Users\<name>\Desktop\agentmux-portable\runtime` |

**Purpose:** Shields against a Windows bug where `GetModuleFileName`
returns the load-time path even after the directory is renamed or unlinked.
The launcher resolves the real exe path and exports the parent dir. Not set
on Unix (fallback to `current_exe().parent()` is reliable there).

---

### AGENTMUX_HOME_OVERRIDE

| Attribute | Value |
|-----------|-------|
| **Who sets it** | The test harness, and `task dev` (to its own home, `<clone>/.dev-home/<vite port>`, unless `AGENTMUX_DEV_USE_REAL_HOME=1`) |
| **Who reads it** | `data_paths.rs`, `crates/srv/src/bootstrap/stores.rs`, `crates/srv/src/registry/paths.rs` |
| **Purpose** | Replaces `~/.agentmux` root with another folder so tests and dev builds don't touch the real user data |

**SECURITY:** Do not set this in production. Any process that sets this
variable can redirect the entire AgentMux state tree to an arbitrary path.

---

### AGENTMUX_DEV_USE_REAL_HOME (`task dev` only)

| Attribute | Value |
|-----------|-------|
| **Who sets it** | A developer, before `task dev` |
| **Who reads it** | `task dev` (`scripts/dev-home.mjs`) |
| **Example** | `1` |

`1` makes `task dev` run on the real `~/.agentmux` instead of a home of its
own, and the start-up banner says `REAL`. A dev build on the real home refuses
to start when a pending migration would move the shared stores ahead of the
installed build. See [Which home `task dev` uses](/multi-instance/#which-home-task-dev-uses).

---

## Group 3 — Runtime / Mode Variables

### AGENTMUX_RUNTIME_MODE

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher, computed once by `RuntimeMode::current()` (`runtime_mode.rs`) |
| **Who reads it** | srv and host via `RuntimeMode::from_env()` / `from_env_with_clone()` |
| **Values** | `installed`, `portable`, `dev:<branch>` |
| **Example** | `dev:main`, `installed`, `portable` |

Detection priority (launcher):
1. `AGENTMUX_RUNTIME_MODE` env override (CI / testing)
2. `agentmux-portable.marker` file next to launcher binary
3. Exe path contains `dist/cef-dev/`, `target/debug/`, or `target/release/`
4. `AGENTMUX_DEV_BRANCH` env override (CI)
5. Default: `installed`

**PITFALL — dev builds inside an agent pane:** If you run `task dev` from
inside an agent pane in a portable build, the child process inherits the
parent's `AGENTMUX_RUNTIME_MODE=portable` (and `AGENTMUX_CHANNEL=stable`).
The dev host uses `resolve_path_only` (`data_paths.rs`) which ignores
the env and relies on the exe path to detect dev mode — preventing
cross-contamination. Do not override `AGENTMUX_RUNTIME_MODE` in an agent
pane's environment unless you know exactly what you are doing.

---

### AGENTMUX_CHANNEL

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher (`data_paths.rs`) from channel resolution; also a user override for `Installed`/`Portable` modes |
| **Who reads it** | `crates/srv/src/bootstrap/stores.rs` for pre-migration snapshot naming; `DataPaths::from_env()` (required field — missing value causes `from_env()` to return `None`) |
| **Example** | `stable`, `beta`, `local-main`, `experiment` |
| **Constraints** | Max 64 chars; cannot be `shared`, `snapshots`, `dev`, `versions`, `channels`, `runtime`; `default` maps to `stable` |

**User-settable:** For `Installed` and `Portable` modes, setting this
before launch redirects the entire state tree to
`~/.agentmux/channels/<value>/`. Useful for parallel-channel testing.
Ignored in dev mode when using `resolve_path_only` (see above).

---

### AGENTMUX_CLONE_ID (Dev mode only)

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher (`data_paths.rs`) only when `RuntimeMode::Dev { clone_id: Some(...) }` |
| **Who reads it** | `RuntimeMode::from_env_with_clone()` (`runtime_mode.rs`) to reconstruct the full `Dev` variant |
| **Example** | `deadbeefcafebabe` (16-char hex FNV-1a hash of the clone's workspace root path) |

Ensures two clones of the same branch land in separate subdirectories
(`~/.agentmux/dev/<branch>/<clone_id>/`), preventing lockfile collisions
when running `task dev` from two clones simultaneously.

---

### AGENTMUX_DEV_BRANCH (build/CI override)

| Attribute | Value |
|-----------|-------|
| **Who sets it** | CI pipelines or developer shell before launching |
| **Who reads it** | `runtime_mode.rs` as step 4 of mode detection (after portable marker and exe-path checks) |
| **Example** | `main`, `agenta-feature-x` |

Allows forcing dev mode for a specific branch without matching the
exe-path heuristics. Value is sanitized (path traversal stripped). If the
sanitized value is empty, mode falls through to `Installed`.

---

### AGENTMUX_BUILD_CACHE_CLEAN

| Attribute | Value |
|-----------|-------|
| **Who sets it** | You, before AgentMux starts |
| **Who reads it** | srv's build cache cleanup (`crates/srv/src/backend/build_cache_service.rs`) |
| **Example** | `1`, `0` |

`1`, `true` or `on` lets this srv clear idle agents' build folders; `0`,
`false` or `off` never does. Unset: only an srv started by its launcher on
the real home cleans (the installed release, or a local package), and only
one at a time per computer. A `task dev` build, a headless srv, a binary run
from a source tree and an instance with a home of its own don't. An instance
with a home of its own never cleans, even with `1`. The settings that tune the
cleanup are in [Build Cache Settings](/settings/#build-cache-settings).

---

### AGENTMUX_VERSION

| Attribute | Value |
|-----------|-------|
| **Who sets it** | srv shell controller (`shell.rs`), `shellexec.rs`; baked at compile time via `env!("CARGO_PKG_VERSION")` |
| **Who reads it** | Shell integration `muxlog` helper to locate pointer files (`bash.sh`, `pwsh.ps1`); `crates/srv/src/bootstrap/stores.rs` reads it from env as a fallback |
| **Example** | `0.60.10` |

Available in every PTY pane shell session. Required by `muxlog` to
resolve the `current-host-v<AGENTMUX_VERSION>.path` pointer file.

---

### AGENTMUX_DEV (legacy sentinel)

| Attribute | Value |
|-----------|-------|
| **Status** | Deprecated — no longer set by the launcher |
| **Who reads it** | `base.rs` defines the constant; some legacy code paths (`config.rs`) note it is no longer emitted |
| **Replacement** | `AGENTMUX_RUNTIME_MODE=dev:<branch>` |

---

### AGENTMUX_BUILD_CHANNEL_DEFAULT (compile-time)

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Build script (`crates/common/build.rs`) from the env at compile time |
| **Who reads it** | `data_paths.rs` as `option_env!` — baked into the binary, not read at runtime |
| **Example** | `stable` (release CI), `local-main` (local `task package` on `main` branch) |

This is a _compile-time_ variable, not a runtime env var. Setting
`AGENTMUX_BUILD_CHANNEL_DEFAULT` before running `cargo build` bakes a
different default channel into the resulting binary. The `agentmux-common`
build script emits `cargo:rerun-if-env-changed=AGENTMUX_BUILD_CHANNEL_DEFAULT`
so incremental compilation detects the change.

---

## Group 4 — IPC Variables

These variables wire together the launcher, host, and srv processes.
Child processes inside panes also see some of them (LOCAL_URL, BLOCKID).

### AGENTMUX_LOCAL_URL

| Attribute | Value |
|-----------|-------|
| **Who sets it** | srv after binding its HTTP listener (`crates/srv/src/bootstrap/network.rs`): `std::env::set_var("AGENTMUX_LOCAL_URL", &local_web_url)` |
| **Who reads it** | Shell controller propagates it into PTY children (`shell.rs`); `agentmux-bashwrap` reads it for WPS publish authentication (`crates/bashwrap/src/mps_client.rs`); jekt registry writer uses it for cross-instance registration (`shell.rs`) |
| **Example** | `http://127.0.0.1:49312` |
| **Lifetime** | Set once per srv startup; changes only when srv restarts |

The URL is an ephemeral loopback HTTP endpoint (port 0 at binding, OS-assigned).
It is the address of the srv's web listener (not the WebSocket listener).

**PITFALL:** agentmux-bashwrap (the streaming bash runner) reads both
`AGENTMUX_LOCAL_URL` and `AGENTMUX_AUTH_KEY` to authenticate WPS
publish calls. If either is absent the wrapper silently skips publishing
and Claude's bash output does not stream to the drone/log pane.

---

### AGENTMUX_AUTH_KEY

| Attribute | Value |
|-----------|-------|
| **Who sets it** | The launcher generates a UUID v4 per run (`srv_spawner.rs`) and sets it on both srv and host |
| **Who reads it** | srv reads it at startup (`config.rs`) and removes it from its own process environment (security hardening, PR #801). Panes and agent processes get it again by design: it is on `PANE_ENV_KEEP` (`crates/srv/src/backend/pane_env.rs`), and `crates/srv/src/backend/shellintegration/lib/muxclient.mjs` and `agentmux-bashwrap` (`mps_client.rs`) read it, with `AGENTMUX_LOCAL_URL`, to authenticate to the instance's loopback API |
| **Example** | `550e8400-e29b-41d4-a716-446655440000` (UUID v4) |

**SECURITY:** srv removes the key from its own environment so that children it spawns by other paths don't inherit the bearer token. A pane is different: the shell helpers (`muxsh`, `muxlog`, `muxopen` and the rest) need it, so a pane's process holds an authenticated handle to the instance that spawned it. Anything started from a pane can use it. The allow-list comments in `pane_env.rs` call this the largest remaining coupling.

**SECURITY:** Do not log this value. It authenticates all WebSocket connections to the srv instance for the lifetime of that srv process.

**Container agents** don't get this value. Their `docker exec` environment carries a per-pane token starting `amxc_` in the same variable, which srv accepts on every route except the ones that run commands on the host, read host files or belong to the app itself (`crates/srv/src/backend/container_routes.rs`; the `amxc_` prefix is `TOKEN_PREFIX` in `crates/srv/src/backend/container_credential.rs`). See [Trust model](/security/trust-model/#container-agents).

---

### AGENTMUX_BACKEND_WS / AGENTMUX_BACKEND_WEB / AGENTMUX_BACKEND_PID

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher on the host process env (`crates/launcher/src/host_spawn.rs`) |
| **Who reads it** | CEF host `sidecar.rs` to skip spawning its own srv when one is already running |
| **Example** | `AGENTMUX_BACKEND_WS=ws://127.0.0.1:49313` / `AGENTMUX_BACKEND_WEB=http://127.0.0.1:49312` / `AGENTMUX_BACKEND_PID=12345` |

These three vars form the launcher-managed srv hand-off. When all three
are present, the host skips `spawn_backend()` and connects to the
launcher-owned srv instead. If `AGENTMUX_BACKEND_WS` is set but empty or
malformed, the host hard-fails rather than silently spawning a second srv
(`crates/cef/src/lib.rs`).

**PITFALL:** Dev builds launched from inside an agent pane inherit these
vars from the parent. The host uses `launcher_is_genuine_parent()` (checks
`AGENTMUX_LAUNCHER_PID` against `getppid()`) to distinguish a genuine
launcher hand-off from an inherited stale value. Without this check, a
developer running `task dev` inside a pane would silently connect the new
host to the parent's srv.

---

### AGENTMUX_SRV_PIPE_PATH

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher (`srv_spawner.rs`) passes it to srv; launcher also advertises it to itself via env for re-use |
| **Who reads it** | srv (`crates/srv/src/bootstrap/plumbing.rs`): if set, opens a named-pipe IPC server for launcher ↔ srv control channel; CEF host `srv_ipc.rs` to connect its IPC bridge |
| **Example** | `\\.\pipe\agentmux-srv-3f9a8c1d` (Windows) / `/tmp/agentmux-srv-3f9a8c1d.sock` (Unix) |

Absent in `task dev` mode (no launcher in the loop). The presence of this
var is the discriminator between launcher-managed and standalone execution.

---

### AGENTMUX_LAUNCHER_PIPE

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher on the host env (`crates/launcher/src/host_spawn.rs`) |
| **Who reads it** | CEF host `crates/cef/src/launcher_ipc/mod.rs` to connect the launcher ↔ host control channel; the Unix-socket variant reads it too (`crates/cef/src/launcher_ipc/mod.rs`) |
| **Example** | Same path format as `AGENTMUX_SRV_PIPE_PATH` with a different leaf name |

Absent in standalone / dev mode. Host logs a warning and continues without
the IPC bridge.

---

### AGENTMUX_LAUNCHER_PID

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher on the host env, on every platform (`crates/launcher/src/host_spawn.rs`; Windows too since v0.58.0) |
| **Who reads it** | CEF host (`launcher_is_genuine_parent`, `crates/cef/src/parent_process.rs`) to verify the launcher is still alive and is genuinely the current parent |
| **Example** | `5432` |

Used to distinguish a genuine launcher hand-off from an inherited stale
`AGENTMUX_BACKEND_WS` value (when the host is launched inside an agent
pane). The host compares its real parent process id to this value (`getppid()` on Unix, the process snapshot on Windows). A dev host on Windows used to ignore the hand-off and start a second srv on the same data directory; it now adopts the launcher's srv, as on macOS and Linux.

---

### AGENTMUX_INSTANCE_ID

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher on both srv and host (`crates/launcher/src/host_spawn.rs`, `srv_spawner.rs`) |
| **Who reads it** | CEF host `sidecar.rs`; identifies the srv instance for multi-instance coordination |
| **Example** | `v0.60.10` |

Formatted as `v<version>`. Not the same as AGENTMUX_VERSION (which is the
raw semver string without the `v` prefix injected into PTY children).

---

### AGENTMUX_SPLASH_EVENT (Windows only)

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher (`crates/launcher/src/host_spawn.rs`) |
| **Who reads it** | CEF host `crates/cef/src/client/navigation.rs` signals this named Win32 event when the first page load completes, causing the launcher to dismiss the splash window |
| **Example** | A Win32 event object name, unique per run |

Used exclusively for splash-screen synchronisation on Windows. Has no
effect on Unix builds.

---

### AGENTMUX_BLOCKID

| Attribute | Value |
|-----------|-------|
| **Who sets it** | srv shell controller (`shell.rs`); websocket handler for agent process spawns (`crates/srv/src/server/agent_handlers/input.rs`); `shellexec.rs` |
| **Who reads it** | `agentmux-bashwrap` (`bash_wrap.rs`) to scope WPS publishes to the correct pane; shell integration scripts have access to it in the PTY environment |
| **Example** | `550e8400-e29b-41d4-a716-446655440001` (block UUID) |

Unique per pane block. The streaming bash runner uses this to route
output chunks to the correct pane subscription.

---

### AGENTMUX_TABID

| Attribute | Value |
|-----------|-------|
| **Who sets it** | srv shell controller (`shell.rs`); `shellexec.rs` |
| **Who reads it** | Shell integration and any process that needs to know which tab it belongs to |
| **Example** | `550e8400-e29b-41d4-a716-446655440002` (tab UUID) |

---

### AGENTMUX_CDP_PORT

| Attribute | Value |
|-----------|-------|
| **Who sets it** | You, before starting AgentMux (optional) |
| **Who reads it** | CEF host at startup (`crates/cef/src/cdp_port.rs`, `requested_cdp_port`) |
| **Values** | Unset or empty: CDP server off in release builds, on (port 9223) in dev builds. `1024`–`65535`: on, preferring that port. `1`/`on`/`true`/`yes`/`auto`: on, preferring 9222 (release) or 9223 (dev). `0`/`off`/`false`/`no`: off, dev builds included |

Controls Chromium's unauthenticated remote-debugging (CDP) server. AgentMux's own browser automation doesn't need it. If the preferred port is taken an OS-assigned port is used, and the port in use is written to `authkey.dev`. See [Network exposure](/security/network-exposure/#chromium-remote-debugging-port).

---

### AGENTMUX_APP_PATH

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher (`srv_spawner.rs`), host `sidecar.rs`; re-set in srv process env at startup (`crates/srv/src/bootstrap/stores.rs`) |
| **Who reads it** | srv `base.rs` (`MUX_APP_PATH_ENV`); used to locate bundled tool binaries (`jq.exe`, `rg.exe`, etc.) alongside the launcher |
| **Example** | `C:\Users\<name>\Desktop\agentmux-portable` |

---

## Group 5 — Terminal Emulator Capability Variables

Set by the srv shell controller (`shell.rs`) on every interactive
shell pane. These are standard terminal capability variables; values are
fixed constants.

### TERM

| Attribute | Value |
|-----------|-------|
| **Set to** | `xterm-256color` |
| **Why** | ConPTY on Windows fully supports VT/ANSI sequences. Without TERM, CLI tools (including Claude Code) use different Unicode width tables, causing ANSI colour offset on Windows. `shell.rs` |

### COLORTERM

| Attribute | Value |
|-----------|-------|
| **Set to** | `truecolor` |
| **Why** | Signals 24-bit colour support. Without this, tools that check for truecolor fall back to 256-colour palettes. `shell.rs` |

### TERM_PROGRAM

| Attribute | Value |
|-----------|-------|
| **Set to** | `agentmux` |
| **Why** | Allows CLI tools to detect they are running inside AgentMux and enable specific integrations. `shell.rs` |

---

## Group 6 — Shell Integration Variables

Variables set by the `shellintegration.rs` / `get_shell_startup()` logic
(`shellintegration.rs`) at shell spawn time.

### AGENTMUX (sentinel)

| Attribute | Value |
|-----------|-------|
| **Who sets it** | srv shell controller (`shell.rs`) |
| **Set to** | `1` |
| **Purpose** | Presence-check sentinel for shell integration scripts. Scripts test `[[ -n "$AGENTMUX" ]]` to confirm they are running inside AgentMux |

**History:** In WaveMux/Waveterm, `AGENTMUX` (then `WAVETERM`) held the
path to the `wsh` binary. Since `wsh` was retired (`docs/specs/archive/SPEC_RETIRE_WSH_2026_04_12.md`),
the variable is now a plain `1` sentinel. Shell integrations no longer
prepend anything to `$PATH` based on its value.

---

### ZDOTDIR / AGENTMUX_ZDOTDIR (zsh only)

| Attribute | Value |
|-----------|-------|
| **Who sets it** | `shellintegration.rs` at zsh spawn |
| **ZDOTDIR** | `~/.agentmux/shell/zsh` — causes zsh to load AgentMux's `.zshrc` instead of `~/.zshrc` |
| **AGENTMUX_ZDOTDIR** | Same path — preserved so the integration `.zshrc` can source the real `~/.zshrc` |

The AgentMux zsh `.zshrc` sources `~/.zshrc` explicitly (`zsh.sh`) to
preserve user configuration.

---

## Group 7 — Legacy / Transition Variables

### AGENTMUX_DATA_HOME

| Attribute | Value |
|-----------|-------|
| **Status** | Deprecated alias for `AGENTMUX_DATA_DIR` |
| **Who sets it** | srv `crates/srv/src/bootstrap/stores.rs` re-publishes it for backward compatibility if `config.data_home` is non-empty |
| **Who reads it** | `crates/srv/src/backend/base.rs` (`MUX_DATA_HOME_ENV`); `crates/srv/src/bootstrap/stores.rs`; `sidecar.rs` (pre-unification path) |

Use `AGENTMUX_DATA_DIR` in new code.

---

### AGENTMUX_CONFIG_HOME

| Attribute | Value |
|-----------|-------|
| **Status** | Deprecated alias for `AGENTMUX_CONFIG_DIR` |
| **Who sets it** | srv `crates/srv/src/bootstrap/stores.rs` |
| **Who reads it** | `base.rs`; `config_watcher_fs.rs` |

Use `AGENTMUX_CONFIG_DIR` in new code.

---

## Complete Variable Quick-Reference

| Variable | Group | Set By | Available In Pane? |
|----------|-------|--------|--------------------|
| `AGENTMUX_AGENT_ID` | Identity | block metadata / settings | Yes |
| `AGENTMUX_AGENT_COLOR` | Identity (decommissioned) | — | No |
| `AGENTMUX_AGENT_TEXT_COLOR` | Identity (decommissioned) | — | No |
| `AGENTMUX_AGENT_SLUG`, `AGENTMUX_AGENT_DISPLAY`, `AGENTMUX_INSTANCE_SLUG` | Identity | srv | Yes |
| `AGENTMUX_BUILD`, `AGENTMUX_INSTANCE_CHANNEL` | Runtime | srv | Yes |
| `WAVEMUX_AGENT_ID` | Identity (legacy) | user config | Yes (stripped if no identity) |
| `WAVEMUX_AGENT_COLOR` | Identity (legacy) | user config | Yes (stripped if no identity) |
| `AGENTMUX_INSTANCE_DIR` | Paths | launcher | No |
| `AGENTMUX_DATA_DIR` | Paths | launcher | No |
| `AGENTMUX_CONFIG_DIR` | Paths | launcher | No |
| `AGENTMUX_LOG_DIR` | Paths | launcher + shell controller | Yes |
| `AGENTMUX_CEF_CACHE_DIR` | Paths | launcher | No |
| `AGENTMUX_AGENTS_DIR` | Paths | launcher | No |
| `AGENTMUX_INSTANCE_RUNTIME_DIR` | Paths | launcher | No |
| `AGENTMUX_SHARED_DIR` | Paths | launcher | No |
| `AGENTMUX_HOME` | Paths | launcher (Windows only) | No |
| `AGENTMUX_HOME_OVERRIDE` | Paths (test, `task dev`) | test harness, `task dev` | No |
| `AGENTMUX_RUNTIME_MODE` | Runtime | launcher | No |
| `AGENTMUX_CHANNEL` | Runtime | launcher / user | No |
| `AGENTMUX_CLONE_ID` | Runtime | launcher (dev mode) | No |
| `AGENTMUX_DEV_BRANCH` | Runtime | CI / user (pre-launch) | No |
| `AGENTMUX_DEV_USE_REAL_HOME` | Runtime (`task dev`) | user (pre-launch) | No |
| `AGENTMUX_BUILD_CACHE_CLEAN` | Runtime | user (pre-launch) | No |
| `AGENTMUX_VERSION` | Runtime | shell controller | Yes |
| `AGENTMUX_BUILD_CHANNEL_DEFAULT` | Runtime (build-time) | build script | No |
| `AGENTMUX_DEV` | Runtime (legacy) | deprecated | No |
| `AGENTMUX_LOCAL_URL` | IPC | srv (after bind) | Yes |
| `AGENTMUX_AUTH_KEY` | IPC | launcher | Yes (on `PANE_ENV_KEEP`; stripped from srv's own environment) |
| `AGENTMUX_BACKEND_WS` | IPC | launcher → host | No |
| `AGENTMUX_BACKEND_WEB` | IPC | launcher → host | No |
| `AGENTMUX_BACKEND_PID` | IPC | launcher → host | No |
| `AGENTMUX_SRV_PIPE_PATH` | IPC | launcher → srv + host | No |
| `AGENTMUX_LAUNCHER_PIPE` | IPC | launcher → host | No |
| `AGENTMUX_LAUNCHER_PID` | IPC | launcher → host | No |
| `AGENTMUX_INSTANCE_ID` | IPC | launcher → srv + host | No |
| `AGENTMUX_SPLASH_EVENT` | IPC (Windows) | launcher → host | No |
| `AGENTMUX_BLOCKID` | IPC | shell controller | Yes |
| `AGENTMUX_TABID` | IPC | shell controller | Yes |
| `AGENTMUX_APP_PATH` | IPC | launcher → srv | No |
| `TERM` | Terminal | shell controller | Yes |
| `COLORTERM` | Terminal | shell controller | Yes |
| `TERM_PROGRAM` | Terminal | shell controller | Yes |
| `AGENTMUX` | Shell integration | shell controller | Yes |
| `ZDOTDIR` | Shell integration (zsh) | shell controller | Yes |
| `AGENTMUX_ZDOTDIR` | Shell integration (zsh) | shell controller | Yes |
| `AGENTMUX_DATA_HOME` | Legacy | srv (compat re-publish) | No |
| `AGENTMUX_CONFIG_HOME` | Legacy | srv (compat re-publish) | No |

---

## Key Source Locations

| Topic | File |
|-------|------|
| PTY env injection (shell controller) | `crates/srv/src/backend/blockcontroller/shell/lifecycle.rs` |
| Identity strip logic | `crates/srv/src/backend/blockcontroller/shell/lifecycle.rs` |
| Jekt auto-registration | `crates/srv/src/backend/blockcontroller/shell/lifecycle.rs` |
| DataPaths struct and env var names | `crates/common/src/data_paths.rs` |
| DataPaths::to_env_vars() | `crates/common/src/data_paths.rs` |
| DataPaths::from_env() | `crates/common/src/data_paths.rs` |
| RuntimeMode detection | `crates/common/src/runtime_mode.rs` |
| AGENTMUX_LOCAL_URL set point | `crates/srv/src/bootstrap/network.rs` |
| AUTH_KEY strip | `crates/srv/src/config.rs` |
| AUTH_KEY re-inject for streaming bash | `crates/srv/src/server/agent_handlers/input.rs` |
| Shell integration deployment | `crates/srv/src/backend/shellintegration.rs` |
| Bash integration script | `crates/srv/src/backend/shellintegration/bash.sh` |
| PowerShell integration script | `crates/srv/src/backend/shellintegration/pwsh.ps1` |
| Zsh integration script | `crates/srv/src/backend/shellintegration/zsh.sh` |
| Launcher → srv env vars | `crates/launcher/src/srv_spawner.rs` |
| Launcher → host env vars (Windows) | `crates/launcher/src/host_spawn.rs` |
| Launcher → host env vars (Unix) | `crates/launcher/src/host_spawn.rs` |
| WSH retirement (AGENTMUX sentinel history) | `docs/specs/archive/SPEC_RETIRE_WSH_2026_04_12.md` |
| Data channels design | `docs/specs/SPEC_DATA_CHANNELS_2026_05_24.md` |
