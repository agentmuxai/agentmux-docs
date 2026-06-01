---
title: "Building from Source"
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

Build AgentMux from source on Windows, macOS, or Linux. AgentMux is a Rust desktop app with a SolidJS frontend, hosted in a bundled Chromium runtime via CEF (`cef-rs`).

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | 22 LTS | Frontend build (Vite + SolidJS) |
| **Rust** | 1.77+ | Backend, host, and launcher |
| **[Task](https://taskfile.dev/)** | Latest | Build orchestration |
| **CMake** | 3.20+ | Required by `cef-dll-sys` (CEF C wrapper) |
| **Ninja** | 1.10+ | Required by `cef-dll-sys` |

### Platform-Specific Dependencies

#### macOS

```bash
xcode-select --install
brew install cmake ninja
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

#### Windows

1. Install Rust from [rustup.rs](https://rustup.rs/).
2. Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) — select "Desktop development with C++" (provides CMake and Ninja).
3. Verify Ninja is on `PATH`. The Visual Studio install ships Ninja inside `Common7/IDE/CommonExtensions/Microsoft/CMake/Ninja/`; copy or symlink `ninja.exe` to a PATH entry. From Git Bash (note: the `*` must be unquoted so the shell expands it):
   ```bash
   cp /c/Program\ Files/Microsoft\ Visual\ Studio/*/Community/Common7/IDE/CommonExtensions/Microsoft/CMake/Ninja/ninja.exe /c/Systems/bin/
   ```
   Or substitute the actual edition (`Community`, `Professional`, `Enterprise`) and year (`2022`, etc.) so no glob is needed.

#### Linux (Debian/Ubuntu)

```bash
sudo apt install build-essential cmake ninja-build curl wget file libssl-dev
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Install Task

```bash
# macOS
brew install go-task/tap/go-task

# Linux
sudo snap install task --classic

# Windows
winget install Task.Task
```

## Clone and Install

```bash
git clone https://github.com/agentmuxai/agentmux.git
cd agentmux
npm install
```

## Development

```bash
task dev
```

This launches the four-process app with Vite hot reload. The frontend rebuilds on save (SolidJS HMR via Vite); changes to the Rust crates require a rebuild and restart.

### After code changes

| Changed | Action |
|---------|--------|
| Frontend (TypeScript / SolidJS) | Auto-reloads via Vite HMR |
| Rust sidecar (`agentmux-srv/`) | `task build:backend`, then restart `task dev` |
| Rust host (`agentmux-cef/`) | `task build:host`, then restart `task dev` |
| Launcher (`agentmux-launcher/`) | `task package` (portable / installed builds). Note: `task dev` now runs through the launcher on all platforms as of v0.41.0 — launcher changes are exercised by `task dev`, not just package builds. |

## Build Commands

| Command | Description |
|---------|-------------|
| `task dev` | Development mode (CEF host + Vite hot reload) |
| `task build:host` | Build the CEF host binary |
| `task bundle` | Bundle CEF runtime DLLs |
| `task build:backend` | Build `agentmux-srv` |
| `task build:frontend` | Build frontend only |
| `task package` | Package a **local** portable for the host platform (Windows ZIP) — ephemeral labeled build, see below |
| `task package -- --fresh` | …with a throwaway data dir (clean-slate session) instead of the branch's persistent one |
| `task package:linux` | Linux AppImage (writes to `~/Desktop` per `build-appimage-linux.sh`) |
| `task test` | Run tests (`vitest`) |
| `task clean` | Clean build artifacts |

Run `task --list` to see every task. Note that `task package:macos` and `task package:msix` exist as TODO stubs in `Taskfile.yml` but do nothing — the full DMG / MSIX / .deb release artifact set is produced by [`agentmuxai/agentmux-builder`](https://github.com/agentmuxai/agentmux-builder), not local builds.

### Local build labels

`task package` is for **local** builds. It does **not** bump the version and does **not** touch git — the committed version moves only through `task release` (changesets). Each local build instead carries an ephemeral, traceable *label*:

```
agentmux-<version>+g<sha>[.dirty].<stamp>-x64-portable
```

Everything after `+` is [semver build metadata](https://semver.org/#spec-item-10) — ignored for version precedence, so a local label can never collide with or reorder a release version. The `<sha>` ties the build back to its source commit, `.dirty` marks a build made from uncommitted changes, and `<stamp>` (a UTC build timestamp) makes every build's folder unique — so a running instance can never lock the next build's output folder. The data dir is keyed on the `dev-portable-<branch>` channel, so rebuilds of one branch share a session (agents/panes/auth persist across the iterate-rebuild loop); `--fresh` suffixes the channel with the stamp for a one-off clean slate. Full rationale: [`SPEC_LOCAL_BUILD_VERSIONING_2026_05_28.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/SPEC_LOCAL_BUILD_VERSIONING_2026_05_28.md).

## Source Layout

```
agentmux/
├── agentmux-launcher/   # Launcher shim (≈325 KB) — spawns the host, owns OS-level facts
├── agentmux-cef/        # CEF host — embeds Chromium, owns the OS window
├── agentmux-srv/        # Sidecar — RPC engine, SQLite persistence, sagas
├── agentmux-common/     # Shared utilities (path resolution, runtime mode)
├── frontend/            # SolidJS + TypeScript (Vite)
├── docs/                # Architecture docs and specs
├── specs/               # Top-level specs
└── Taskfile.yml         # Build task definitions
```

## Communication Flow

```
launcher ◀── named pipe ──▶ host (CEF)
                              │
                              ├── JS bridge ──▶ renderer (SolidJS)
                              │
                              ├── websocket ──▶ sidecar (agentmux-srv)
                              │                   │
                              │                   └── websocket / wshrpc ──▶ remote `wsh`
                              │
                              ▼
                         OS window, browser panes
```

See [Architecture overview](/internals/architecture/) for the full topology and what each edge carries.

## Debugging

### Frontend

Open Chromium DevTools from the **hamburger menu (≡)** in the top tab bar → **Dev Tools**, or use the keyboard shortcut. DevTools is no longer a widget-bar entry (moved to the hamburger menu — see [Pane types](/pane-types/)). Reload the renderer with `Ctrl+R` / `Cmd+R`.

### Backend Logs

The host log lives in `<data-dir>/logs/` (per channel/version). The sidecar logs directly to the shared `~/.agentmux/logs/`, alongside pointer files that resolve to the running host's per-channel log. Use the `muxlog` shell helper from any AgentMux terminal — it handles both:

```bash
muxlog host           # tail the current host log
muxlog srv            # tail the sidecar log
muxlog host '\[fe\]'  # filter the host log to frontend lines
muxlog host cat       # full file contents
```

See [Multi-instance & dev mode](/multi-instance/) for the per-instance path layout and pointer-file resolution.

## Troubleshooting

### CMake / Ninja errors

If `cargo build` fails with "CMake was unable to find a build program corresponding to Ninja", verify `ninja --version` works on `PATH`. On Windows, see the install steps above.

### Backend binary not found

Run `task build:backend` and verify the binary lands in `target/release/` (or the platform-equivalent location). The host auto-spawns the sidecar by absolute path.

### Frontend not loading

Check the Vite dev port (`task dev` prints it on startup) is not already in use. Clear and reinstall if needed:

```bash
rm -rf node_modules package-lock.json
npm install
task dev
```

### Schema directory missing after clean

`dist/schema/` is wiped by `task clean` but automatically recreated by the `copy:schema` dependency in `dev`, `start`, and `package` tasks.

## See Also

- [Architecture overview](/internals/architecture/) — process topology and IPC edges
- [Multi-instance & dev mode](/multi-instance/) — data layout, log discovery
- [Reducer stack](/internals/reducer-stack/) — how state flows across the four processes
- [Contributing](/contributing) — contribution guidelines
- [Configuration](/config) — settings file format
