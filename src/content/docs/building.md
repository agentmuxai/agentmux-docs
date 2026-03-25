---
title: "Building from Source"
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

Build AgentMux from source on Windows, macOS, or Linux. AgentMux is built on **Tauri v2** with a **100% Rust backend**.

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | v22 LTS | Frontend build |
| **Rust** | 1.77+ | Backend + Tauri |
| **[Task](https://taskfile.dev/)** | Latest | Build orchestration |

### Platform-Specific Dependencies

#### macOS

```bash
xcode-select --install
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

#### Windows

1. Install Rust from [rustup.rs](https://rustup.rs/)
2. Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) — select "Desktop development with C++"
3. WebView2 is pre-installed on Windows 10/11

#### Linux (Debian/Ubuntu)

```bash
sudo apt install zip libwebkit2gtk-4.1-dev \
  build-essential curl wget file libssl-dev \
  libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev

curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Install Task

```bash
# macOS
brew install go-task/tap/go-task

# Linux
sudo snap install task --classic

# Windows (PowerShell)
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

This starts the Tauri app in development mode with:

- Frontend hot reload (SolidJS HMR via Vite)
- Tauri auto-rebuild on Rust changes
- DevTools available (`Ctrl+Shift+I` / `Cmd+Option+I`)

Always use `task dev` for development — never launch binaries from `target/` directly.

### After Code Changes

| Changed | Action |
|---------|--------|
| Frontend (TypeScript/SolidJS) | Auto-reloads |
| Tauri shell (`src-tauri/src/`) | Auto-rebuilds, process restarts |
| Rust backend (`agentmuxsrv-rs/`) | Run `task build:backend`, then restart `task dev` |
| Shell helper (`wsh-rs/`) | Run `task build:wsh`, then restart `task dev` |

## Build Commands

| Command | Description |
|---------|-------------|
| `task dev` | Development mode with hot reload |
| `task quickdev` | Fast dev (skips wsh build) |
| `task build:backend` | Build Rust backend (agentmuxsrv-rs + wsh-rs) |
| `task build:frontend` | Build frontend only |
| `task package` | Production installer for current platform |
| `task package:macos` | macOS .app + .dmg |
| `task package:portable` | Windows portable ZIP |
| `task package:portable:linux` | Linux AppImage |
| `task test` | Run tests (vitest) |
| `task clean` | Clean build artifacts |
| `task storybook` | Run Storybook for UI components |

## Architecture

```
agentmux/
├── src-tauri/          # Tauri v2 shell (Rust)
├── agentmuxsrv-rs/     # Rust async backend (Tokio + Axum + SQLite)
├── wsh-rs/             # Shell integration binary (Rust)
├── frontend/           # SolidJS + TypeScript (Vite)
├── schema/             # JSON schema definitions
├── docs/               # Architecture docs and specs
└── Taskfile.yml        # Build task definitions
```

### Component Sizes

| Component | Size | Purpose |
|-----------|------|---------|
| `agentmux` | ~14 MB | Tauri app (Rust + WebView) |
| `agentmuxsrv-rs` | ~4 MB | Async backend server |
| `wsh` | ~1.1 MB | Shell integration binary |
| **Total** | ~19 MB | All components |

### Communication Flow

```
Frontend (SolidJS)
    ↕  Tauri IPC
Tauri Shell (src-tauri)
    ↕  WebSocket / JSON-RPC 2.0
agentmuxsrv-rs (backend)
    ↕  WebSocket / wshrpc
wsh-rs (remote hosts)
```

## Debugging

### Frontend

Open DevTools: `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (macOS).

### Backend Logs

```bash
# Development
tail -f ~/.agentmux-dev/agentmux.log

# Production
tail -f ~/.agentmux/agentmux.log
```

### Tauri Logs

Appear in the terminal where `task dev` is running.

## Troubleshooting

### Backend binary not found (ENOENT)

Rebuild and verify:

```bash
task build:backend
ls -lh src-tauri/binaries/
```

### Tauri build fails with linker errors

Install platform dependencies (see Prerequisites above).

### Frontend not loading

Check port 1420 (Vite dev server). Clear and reinstall if needed:

```bash
rm -rf node_modules package-lock.json
npm install
task dev
```

### Schema directory missing after clean

Handled automatically by the build pipeline. If needed manually:

```bash
cp -r schema dist/schema
```

## See Also

- [Contributing](/contributing) — Contribution guidelines
- [Configuration](/config) — Settings file format
