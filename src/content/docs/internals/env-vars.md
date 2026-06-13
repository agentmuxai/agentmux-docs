---
title: Environment variable contract
description: Every AGENTMUX_* variable in the process tree — who sets it, who reads it, and the security pitfalls.
---

**Version:** 0.44.1 | **Date:** 2026-06-12 | **Commit:** 6d282acf

This document is the canonical reference for every `AGENTMUX_*` (and legacy
`WAVEMUX_*`) environment variable that flows through the AgentMux process
tree. Its absence was the direct cause of the Win11 focused-border
invisibility bug (AGENTMUX_AGENT_COLOR = #000000 silently became the
pane's focused-border colour, making it invisible against a dark background).

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
  │     strips: AUTH_KEY from its own process env after reading
  │
  └── agentmux-cef  (Chromium host, J0 member)
        reads: BACKEND_WS/WEB/PID, AUTH_KEY, LAUNCHER_PIPE/PID
               HOME, SPLASH_EVENT, INSTANCE_ID, RUNTIME_MODE, path vars
        │
        └── [PTY shell per pane]  (child of srv, not host)
              reads: AGENTMUX, BLOCKID, TABID, VERSION, LOG_DIR,
                     LOCAL_URL, AGENT_ID, AGENT_COLOR, AGENT_TEXT_COLOR,
                     TERM, COLORTERM, TERM_PROGRAM, PATH (augmented)
              shell integration sends OSC 16162;E back to srv
```

Source files cited throughout:
- `shell.rs` = `agentmux-srv/src/backend/blockcontroller/shell.rs`
- `data_paths.rs` = `agentmux-common/src/data_paths.rs`
- `runtime_mode.rs` = `agentmux-common/src/runtime_mode.rs`
- `srv_spawner.rs` = `agentmux-launcher/src/srv_spawner.rs`
- `launcher/main.rs` = `agentmux-launcher/src/main.rs`
- `shellintegration.rs` = `agentmux-srv/src/backend/shellintegration.rs`
- `bash.sh` = `agentmux-srv/src/backend/shellintegration/bash.sh`
- `pwsh.ps1` = `agentmux-srv/src/backend/shellintegration/pwsh.ps1`
- `websocket.rs` = `agentmux-srv/src/server/websocket.rs`

---

## Group 1 — Identity Variables

These variables identify the agent persona assigned to a pane and drive
focused-border colour, pane title, and jekt auto-registration.

### AGENTMUX_AGENT_ID

| Attribute | Value |
|-----------|-------|
| **Who sets it** | srv shell controller (`shell.rs:575-595`) from block `cmd:env` metadata or global settings `cmd_env`; `app_api.rs:306` on `agent.open`; `agent_config.rs:258` for MCP env injection |
| **Who reads it** | PTY shell process; shell integration scripts (`bash.sh:60`, `pwsh.ps1:37`, `zsh.sh:60`) encode it into OSC 16162;E on every prompt; `shell.rs:440` reads it to decide jekt auto-registration |
| **Example value** | `AgentX`, `Aria`, `Terminal` |
| **Lifetime** | Set once at pane spawn; persists for the lifetime of the PTY session |

**Priority chain** (shell.rs:437-449):
1. Block metadata `cmd:env["AGENTMUX_AGENT_ID"]`
2. Global settings `cmd_env["AGENTMUX_AGENT_ID"]`
3. Legacy compat: `WAVEMUX_AGENT_ID` process env (read-only fallback for jekt registration)

**Strip logic** (`shell.rs:597-608`): if none of the above sources provides
a value, `AGENTMUX_AGENT_ID`, `AGENTMUX_AGENT_COLOR`, `AGENTMUX_AGENT_TEXT_COLOR`,
`WAVEMUX_AGENT_ID`, and `WAVEMUX_AGENT_COLOR` are _actively removed_ from the
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

### AGENTMUX_AGENT_COLOR

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Same chain as `AGENTMUX_AGENT_ID`; typically set alongside it in block `cmd:env` |
| **Who reads it** | Shell integration scripts (`bash.sh:61`, `pwsh.ps1:44`); frontend uses the value in OSC 16162;E payload to render the focused pane border |
| **Example value** | `#4A90E2`, `#FF6B35` |
| **Format** | CSS hex colour string, 6-digit `#RRGGBB` |

**SECURITY/PITFALL — Win11 border bug (the bug that required this doc):**
`AGENTMUX_AGENT_COLOR=#000000` is valid and accepted. The focused-border
renderer uses this value directly as the border colour. On a dark-themed
desktop (the default on Win11), a pure-black border is invisible, making
it impossible to tell which pane has keyboard focus. Always use a colour
that contrasts with your background theme.

**Strip logic:** same as `AGENTMUX_AGENT_ID` — removed when no explicit
agent identity is configured (`shell.rs:604`).

---

### AGENTMUX_AGENT_TEXT_COLOR

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Block `cmd:env` metadata; not emitted via OSC 16162;E by the current shell integration scripts |
| **Who reads it** | Frontend pane header; used as text colour for the agent name label in the pane title bar |
| **Example value** | `#FFFFFF`, `#1A1A1A` |

**Strip logic:** removed at pane spawn when no agent identity is configured
(`shell.rs:605`). Unlike `AGENTMUX_AGENT_COLOR`, this variable is NOT
currently forwarded via OSC 16162;E — only `AGENTMUX_AGENT_ID` and
`AGENTMUX_AGENT_COLOR` are in the OSC payload. Changing it inside a running
shell has no effect until the next pane restart.

---

### WAVEMUX_AGENT_ID / WAVEMUX_AGENT_COLOR (legacy)

| Attribute | Value |
|-----------|-------|
| **Status** | Deprecated — read-only backward-compat bridge |
| **Who reads them** | `shell.rs:449` reads `WAVEMUX_AGENT_ID` as the lowest-priority fallback for jekt registration only |
| **Strip logic** | Both are removed from PTY children when no explicit agent identity is configured (`shell.rs:606-607`) |

These variables were the pre-rebrand names from the WaveMux era. Do not
set them in new configurations; use `AGENTMUX_*` equivalents instead.
The only surviving use is as a read-only fallback in the jekt
auto-registration path — they are never written by AgentMux.

---

## Group 2 — Path Variables

All path variables are set by the launcher from `DataPaths::to_env_vars()`
(`data_paths.rs:267-296`) and consumed by downstream binaries via
`DataPaths::from_env()` (`data_paths.rs:304-344`). The launcher is the
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
| **Who sets it** | Launcher, via `DataPaths::to_env_vars()` (`data_paths.rs:270`) |
| **Who reads it** | srv, host via `DataPaths::from_env()` |
| **Example** | `C:\Users\asafe\.agentmux\channels\stable` |
| **Purpose** | Channel root; config and agents directories hang directly off this |

---

### AGENTMUX_DATA_DIR

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher (`data_paths.rs:271`) |
| **Who reads it** | srv for SQLite database location (`objects.db`, `sagas.db`); `DataPaths::from_env()` |
| **Example** | `C:\Users\asafe\.agentmux\channels\stable\versions\0.44.1\data` |

**Legacy alias:** srv also publishes `AGENTMUX_DATA_HOME` for any
code path that pre-dates the unification (`srv/main.rs:292`). New code
should read `AGENTMUX_DATA_DIR`.

---

### AGENTMUX_CONFIG_DIR

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher (`data_paths.rs:272`) |
| **Who reads it** | `config_watcher_fs.rs:32` for `settings.json` and related config files; `app_api.rs:276` for agent working dirs |
| **Example** | `C:\Users\asafe\.agentmux\channels\stable\config` |

**Legacy alias:** `AGENTMUX_CONFIG_HOME` (`base.rs:16`). Same caveats as
DATA_DIR/DATA_HOME above.

---

### AGENTMUX_LOG_DIR

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher (`data_paths.rs:273`); also injected into PTY child environment by srv shell controller (`shell.rs:519-523`) with a hardcoded `~/.agentmux/logs` path |
| **Who reads it** | Shell integration `muxlog` helper (`bash.sh:90-118`, `pwsh.ps1:63-79`); `memory_heartbeat.rs:81`; any process in a pane that wants to locate logs |
| **Example** | `/home/alice/.agentmux/logs` or `C:\Users\asafe\.agentmux\logs` |

**Note on dual injection:** The launcher sets the canonical per-channel
log dir; the shell controller re-injects the value into PTY children using
`dirs::home_dir().join(".agentmux").join("logs")` (a fixed path,
`shell.rs:519-523`). The two values are identical in production but diverge
in test scenarios. PTY children should use whatever value is in their
environment.

**PITFALL:** On Windows with MSIX packaging, `AGENTMUX_DATA_DIR` and
friends resolve inside the virtual file system, but `AGENTMUX_LOG_DIR` is
always under the real home dir (`shell.rs:484-489`) because ConPTY child
processes cannot see virtualised MSIX writes at their literal path.

---

### AGENTMUX_CEF_CACHE_DIR

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher (`data_paths.rs:274`) |
| **Who reads it** | CEF host for Chromium profile / cache directory |
| **Example** | `C:\Users\asafe\.agentmux\channels\stable\versions\0.44.1\cef-cache` |

Regenerable; can be deleted without data loss.

---

### AGENTMUX_AGENTS_DIR

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher (`data_paths.rs:275`) |
| **Who reads it** | srv agent definition storage; channel-wide (does not include the version segment) |
| **Example** | `C:\Users\asafe\.agentmux\channels\stable\agents` |

---

### AGENTMUX_INSTANCE_RUNTIME_DIR

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher (`data_paths.rs:276-279`) |
| **Who reads it** | srv and launcher for single-instance lock files, IPC port file, named-pipe path |
| **Example** | `C:\Users\asafe\.agentmux\channels\stable\versions\0.44.1\runtime` |

---

### AGENTMUX_SHARED_DIR

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher (`data_paths.rs:280`) |
| **Who reads it** | Identity/OAuth code; provider auth dirs live here so credentials persist across channel/version upgrades |
| **Example** | `C:\Users\asafe\.agentmux\shared` |

Channel-independent and version-independent. The fix for the
per-channel OAuth re-authentication regression (each channel had an
empty auth dir → Claude would spin prompting for login on every new
channel). Provider credential directories now always live under
`shared/providers/<provider>/`.

---

### AGENTMUX_HOME

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher (Windows only, `launcher/main.rs:332`) to the `runtime/` directory containing the host binary |
| **Who reads it** | CEF host for asset resolution (`commands/window/creation.rs:139`): `index.html`, frontend bundle |
| **Example** | `C:\Users\asafe\Desktop\agentmux-portable\runtime` |

**Purpose:** Shields against a Windows bug where `GetModuleFileName`
returns the load-time path even after the directory is renamed or unlinked.
The launcher resolves the real exe path and exports the parent dir. Not set
on Unix (fallback to `current_exe().parent()` is reliable there).

---

### AGENTMUX_HOME_OVERRIDE (test-only)

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Test harness only |
| **Who reads it** | `data_paths.rs:395`, `srv/main.rs:341`, `registry/paths.rs:29` |
| **Purpose** | Replaces `~/.agentmux` root with a temp directory so tests don't touch the real user data |

**SECURITY:** Do not set this in production. Any process that sets this
variable can redirect the entire AgentMux state tree to an arbitrary path.

---

## Group 3 — Runtime / Mode Variables

### AGENTMUX_RUNTIME_MODE

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher, computed once by `RuntimeMode::current()` (`runtime_mode.rs:69-117`) |
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
The dev host uses `resolve_path_only` (`data_paths.rs:160`) which ignores
the env and relies on the exe path to detect dev mode — preventing
cross-contamination. Do not override `AGENTMUX_RUNTIME_MODE` in an agent
pane's environment unless you know exactly what you are doing.

---

### AGENTMUX_CHANNEL

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher (`data_paths.rs:285`) from channel resolution; also a user override for `Installed`/`Portable` modes |
| **Who reads it** | `srv/main.rs:332` for pre-migration snapshot naming; `DataPaths::from_env()` (required field — missing value causes `from_env()` to return `None`) |
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
| **Who sets it** | Launcher (`data_paths.rs:292-295`) only when `RuntimeMode::Dev { clone_id: Some(...) }` |
| **Who reads it** | `RuntimeMode::from_env_with_clone()` (`runtime_mode.rs:195-205`) to reconstruct the full `Dev` variant |
| **Example** | `deadbeefcafebabe` (16-char hex FNV-1a hash of the clone's workspace root path) |

Ensures two clones of the same branch land in separate subdirectories
(`~/.agentmux/dev/<branch>/<clone_id>/`), preventing lockfile collisions
when running `task dev` from two clones simultaneously.

---

### AGENTMUX_DEV_BRANCH (build/CI override)

| Attribute | Value |
|-----------|-------|
| **Who sets it** | CI pipelines or developer shell before launching |
| **Who reads it** | `runtime_mode.rs:104` as step 4 of mode detection (after portable marker and exe-path checks) |
| **Example** | `main`, `agenta-feature-x` |

Allows forcing dev mode for a specific branch without matching the
exe-path heuristics. Value is sanitized (path traversal stripped). If the
sanitized value is empty, mode falls through to `Installed`.

---

### AGENTMUX_VERSION

| Attribute | Value |
|-----------|-------|
| **Who sets it** | srv shell controller (`shell.rs:515`), `shellexec.rs:360`; baked at compile time via `env!("CARGO_PKG_VERSION")` |
| **Who reads it** | Shell integration `muxlog` helper to locate pointer files (`bash.sh:96`, `pwsh.ps1:69`); `srv/main.rs:333` reads it from env as a fallback |
| **Example** | `0.44.1` |

Available in every PTY pane shell session. Required by `muxlog` to
resolve the `current-host-v<AGENTMUX_VERSION>.path` pointer file.

---

### AGENTMUX_DEV (legacy sentinel)

| Attribute | Value |
|-----------|-------|
| **Status** | Deprecated — no longer set by the launcher |
| **Who reads it** | `base.rs:19` defines the constant; some legacy code paths (`config.rs:63`) note it is no longer emitted |
| **Replacement** | `AGENTMUX_RUNTIME_MODE=dev:<branch>` |

---

### AGENTMUX_BUILD_CHANNEL_DEFAULT (compile-time)

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Build script (`agentmux-common/build.rs:37`) from the env at compile time |
| **Who reads it** | `data_paths.rs:54-58` as `option_env!` — baked into the binary, not read at runtime |
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
| **Who sets it** | srv after binding its HTTP listener (`srv/main.rs:708`): `std::env::set_var("AGENTMUX_LOCAL_URL", &local_web_url)` |
| **Who reads it** | Shell controller propagates it into PTY children (`shell.rs:527-529`); `agentmux-bashwrap` reads it for WPS publish authentication (`wps_client.rs:71`); jekt registry writer uses it for cross-instance registration (`shell.rs:666`) |
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
| **Who sets it** | Launcher generates a UUID v4 per run (`srv_spawner.rs:112`); sets it on both srv and host |
| **Who reads it** | srv `config.rs:37` reads and immediately removes it from the process env (security hardening, PR #801); websocket handler re-injects it into agent process spawns (`websocket.rs:912`) for streaming bash auth; `wps_client.rs:72` for WPS publish |
| **Example** | `550e8400-e29b-41d4-a716-446655440000` (UUID v4) |

**SECURITY:** srv actively removes this from its own process environment
after reading it (`config.rs:45`). This prevents child processes spawned by
srv (not through the PTY/shell path) from inheriting the bearer token.
The websocket handler re-injects a fresh copy only for processes that need
it (streaming bash runner via `agent.run-command`).

**SECURITY:** Do not log this value. It authenticates all WebSocket
connections to the srv instance for the lifetime of that srv process.

---

### AGENTMUX_BACKEND_WS / AGENTMUX_BACKEND_WEB / AGENTMUX_BACKEND_PID

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher on the host process env (`launcher/main.rs:322-324`) |
| **Who reads it** | CEF host `sidecar.rs:43,61,62` to skip spawning its own srv when one is already running |
| **Example** | `AGENTMUX_BACKEND_WS=ws://127.0.0.1:49313` / `AGENTMUX_BACKEND_WEB=http://127.0.0.1:49312` / `AGENTMUX_BACKEND_PID=12345` |

These three vars form the launcher-managed srv hand-off. When all three
are present, the host skips `spawn_backend()` and connects to the
launcher-owned srv instead. If `AGENTMUX_BACKEND_WS` is set but empty or
malformed, the host hard-fails rather than silently spawning a second srv
(`cef/main.rs:532`).

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
| **Who sets it** | Launcher (`srv_spawner.rs:142`) passes it to srv; launcher also advertises it to itself via env for re-use |
| **Who reads it** | srv (`srv/main.rs:895`): if set, opens a named-pipe IPC server for launcher ↔ srv control channel; CEF host `srv_ipc.rs:62` to connect its IPC bridge |
| **Example** | `\\.\pipe\agentmux-srv-3f9a8c1d` (Windows) / `/tmp/agentmux-srv-3f9a8c1d.sock` (Unix) |

Absent in `task dev` mode (no launcher in the loop). The presence of this
var is the discriminator between launcher-managed and standalone execution.

---

### AGENTMUX_LAUNCHER_PIPE

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher on the host env (`launcher/main.rs:328`) |
| **Who reads it** | CEF host `launcher_ipc.rs:88` to connect the launcher ↔ host control channel; floating panes also read it to forward open-in-new-window requests (`launcher_ipc.rs:325`) |
| **Example** | Same path format as `AGENTMUX_SRV_PIPE_PATH` with a different leaf name |

Absent in standalone / dev mode. Host logs a warning and continues without
the IPC bridge.

---

### AGENTMUX_LAUNCHER_PID (Unix only)

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher on the host env (Unix only, `launcher/main.rs:411`) |
| **Who reads it** | CEF host `parent_process.rs:75` to verify the launcher is still alive and is genuinely the current parent |
| **Example** | `5432` |

Used to distinguish a genuine launcher hand-off from an inherited stale
`AGENTMUX_BACKEND_WS` value (when the host is launched inside an agent
pane). The host calls `getppid()` and compares it to this value.

---

### AGENTMUX_INSTANCE_ID

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher on both srv and host (`launcher/main.rs:326`, `srv_spawner.rs:114`) |
| **Who reads it** | CEF host `sidecar.rs:67`; identifies the srv instance for multi-instance coordination |
| **Example** | `v0.44.1` |

Formatted as `v<version>`. Not the same as AGENTMUX_VERSION (which is the
raw semver string without the `v` prefix injected into PTY children).

---

### AGENTMUX_SPLASH_EVENT (Windows only)

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher (`launcher/main.rs:335`) |
| **Who reads it** | CEF host `client/mod.rs:1243` signals this named Win32 event when the first page load completes, causing the launcher to dismiss the splash window |
| **Example** | A Win32 event object name, unique per run |

Used exclusively for splash-screen synchronisation on Windows. Has no
effect on Unix builds.

---

### AGENTMUX_BLOCKID

| Attribute | Value |
|-----------|-------|
| **Who sets it** | srv shell controller (`shell.rs:513`); websocket handler for agent process spawns (`websocket.rs:917`); `shellexec.rs:352` |
| **Who reads it** | `agentmux-bashwrap` (`bash_wrap.rs:132,137`) to scope WPS publishes to the correct pane; shell integration scripts have access to it in the PTY environment |
| **Example** | `550e8400-e29b-41d4-a716-446655440001` (block UUID) |

Unique per pane block. The streaming bash runner uses this to route
output chunks to the correct pane subscription.

---

### AGENTMUX_TABID

| Attribute | Value |
|-----------|-------|
| **Who sets it** | srv shell controller (`shell.rs:514`); `shellexec.rs:353` |
| **Who reads it** | Shell integration and any process that needs to know which tab it belongs to |
| **Example** | `550e8400-e29b-41d4-a716-446655440002` (tab UUID) |

---

### AGENTMUX_APP_PATH

| Attribute | Value |
|-----------|-------|
| **Who sets it** | Launcher (`srv_spawner.rs:141`), host `sidecar.rs:217`; re-set in srv process env at startup (`srv/main.rs:298`) |
| **Who reads it** | srv `base.rs:18` (`WAVE_APP_PATH_ENV`); used to locate bundled tool binaries (`jq.exe`, `rg.exe`, etc.) alongside the launcher |
| **Example** | `C:\Users\asafe\Desktop\agentmux-portable` |

---

## Group 5 — Terminal Emulator Capability Variables

Set by the srv shell controller (`shell.rs:509-512`) on every interactive
shell pane. These are standard terminal capability variables; values are
fixed constants.

### TERM

| Attribute | Value |
|-----------|-------|
| **Set to** | `xterm-256color` |
| **Why** | ConPTY on Windows fully supports VT/ANSI sequences. Without TERM, CLI tools (including Claude Code) use different Unicode width tables, causing ANSI colour offset on Windows. `shell.rs:510` |

### COLORTERM

| Attribute | Value |
|-----------|-------|
| **Set to** | `truecolor` |
| **Why** | Signals 24-bit colour support. Without this, tools that check for truecolor fall back to 256-colour palettes. `shell.rs:511` |

### TERM_PROGRAM

| Attribute | Value |
|-----------|-------|
| **Set to** | `agentmux` |
| **Why** | Allows CLI tools to detect they are running inside AgentMux and enable specific integrations. `shell.rs:512` |

---

## Group 6 — Shell Integration Variables

Variables set by the `shellintegration.rs` / `get_shell_startup()` logic
(`shellintegration.rs:108-165`) at shell spawn time.

### AGENTMUX (sentinel)

| Attribute | Value |
|-----------|-------|
| **Who sets it** | srv shell controller (`shell.rs:535`) |
| **Set to** | `1` |
| **Purpose** | Presence-check sentinel for shell integration scripts. Scripts test `[[ -n "$AGENTMUX" ]]` to confirm they are running inside AgentMux |

**History:** In WaveMux/Waveterm, `AGENTMUX` (then `WAVETERM`) held the
path to the `wsh` binary. Since `wsh` was retired (`specs/archive/SPEC_RETIRE_WSH_2026_04_12.md`),
the variable is now a plain `1` sentinel. Shell integrations no longer
prepend anything to `$PATH` based on its value.

---

### ZDOTDIR / AGENTMUX_ZDOTDIR (zsh only)

| Attribute | Value |
|-----------|-------|
| **Who sets it** | `shellintegration.rs:128-131` at zsh spawn |
| **ZDOTDIR** | `~/.agentmux/shell/zsh` — causes zsh to load AgentMux's `.zshrc` instead of `~/.zshrc` |
| **AGENTMUX_ZDOTDIR** | Same path — preserved so the integration `.zshrc` can source the real `~/.zshrc` |

The AgentMux zsh `.zshrc` sources `~/.zshrc` explicitly (`zsh.sh:13`) to
preserve user configuration.

---

## Group 7 — Legacy / Transition Variables

### AGENTMUX_DATA_HOME

| Attribute | Value |
|-----------|-------|
| **Status** | Deprecated alias for `AGENTMUX_DATA_DIR` |
| **Who sets it** | srv `main.rs:292` re-publishes it for backward compatibility if `config.data_home` is non-empty |
| **Who reads it** | `base.rs:17` (`WAVE_DATA_HOME_ENV`); `config.rs:104`; `sidecar.rs` (pre-unification path) |

Use `AGENTMUX_DATA_DIR` in new code.

---

### AGENTMUX_CONFIG_HOME

| Attribute | Value |
|-----------|-------|
| **Status** | Deprecated alias for `AGENTMUX_CONFIG_DIR` |
| **Who sets it** | srv `main.rs:295` |
| **Who reads it** | `base.rs:16`; `config_watcher_fs.rs:32`; `app_api.rs:276` |

Use `AGENTMUX_CONFIG_DIR` in new code.

---

## Complete Variable Quick-Reference

| Variable | Group | Set By | Available In Pane? |
|----------|-------|--------|--------------------|
| `AGENTMUX_AGENT_ID` | Identity | block metadata / settings | Yes |
| `AGENTMUX_AGENT_COLOR` | Identity | block metadata / settings | Yes |
| `AGENTMUX_AGENT_TEXT_COLOR` | Identity | block metadata / settings | Yes |
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
| `AGENTMUX_HOME_OVERRIDE` | Paths (test) | test harness | No |
| `AGENTMUX_RUNTIME_MODE` | Runtime | launcher | No |
| `AGENTMUX_CHANNEL` | Runtime | launcher / user | No |
| `AGENTMUX_CLONE_ID` | Runtime | launcher (dev mode) | No |
| `AGENTMUX_DEV_BRANCH` | Runtime | CI / user (pre-launch) | No |
| `AGENTMUX_VERSION` | Runtime | shell controller | Yes |
| `AGENTMUX_BUILD_CHANNEL_DEFAULT` | Runtime (build-time) | build script | No |
| `AGENTMUX_DEV` | Runtime (legacy) | deprecated | No |
| `AGENTMUX_LOCAL_URL` | IPC | srv (after bind) | Yes |
| `AGENTMUX_AUTH_KEY` | IPC | launcher | No (stripped from srv; re-injected per-spawn) |
| `AGENTMUX_BACKEND_WS` | IPC | launcher → host | No |
| `AGENTMUX_BACKEND_WEB` | IPC | launcher → host | No |
| `AGENTMUX_BACKEND_PID` | IPC | launcher → host | No |
| `AGENTMUX_SRV_PIPE_PATH` | IPC | launcher → srv + host | No |
| `AGENTMUX_LAUNCHER_PIPE` | IPC | launcher → host | No |
| `AGENTMUX_LAUNCHER_PID` | IPC (Unix) | launcher → host | No |
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

| Topic | File | Lines |
|-------|------|-------|
| PTY env injection (shell controller) | `agentmux-srv/src/backend/blockcontroller/shell.rs` | 506–611 |
| Identity strip logic | `agentmux-srv/src/backend/blockcontroller/shell.rs` | 597–608 |
| Jekt auto-registration | `agentmux-srv/src/backend/blockcontroller/shell.rs` | 652–683 |
| DataPaths struct and env var names | `agentmux-common/src/data_paths.rs` | 77–127 |
| DataPaths::to_env_vars() | `agentmux-common/src/data_paths.rs` | 267–296 |
| DataPaths::from_env() | `agentmux-common/src/data_paths.rs` | 304–344 |
| RuntimeMode detection | `agentmux-common/src/runtime_mode.rs` | 69–117 |
| AGENTMUX_LOCAL_URL set point | `agentmux-srv/src/main.rs` | 706–708 |
| AUTH_KEY strip | `agentmux-srv/src/config.rs` | 37–45 |
| AUTH_KEY re-inject for streaming bash | `agentmux-srv/src/server/websocket.rs` | 900–912 |
| Shell integration deployment | `agentmux-srv/src/backend/shellintegration.rs` | 55–94 |
| Bash integration script | `agentmux-srv/src/backend/shellintegration/bash.sh` | whole file |
| PowerShell integration script | `agentmux-srv/src/backend/shellintegration/pwsh.ps1` | whole file |
| Zsh integration script | `agentmux-srv/src/backend/shellintegration/zsh.sh` | whole file |
| Launcher → srv env vars | `agentmux-launcher/src/srv_spawner.rs` | 127–145 |
| Launcher → host env vars (Windows) | `agentmux-launcher/src/main.rs` | 319–335 |
| Launcher → host env vars (Unix) | `agentmux-launcher/src/main.rs` | 397–412 |
| WSH retirement (AGENTMUX sentinel history) | `specs/archive/SPEC_RETIRE_WSH_2026_04_12.md` | — |
| Data channels design | `docs/specs/SPEC_DATA_CHANNELS_2026_05_24.md` | — |
