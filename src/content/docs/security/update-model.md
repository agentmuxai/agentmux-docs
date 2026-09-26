---
title: "Update model"
description: "AgentMux has no in-app updater. How releases are published and signed, how to update, and how agent CLIs and tools get installed."
---

AgentMux has no auto-updater and never checks for a newer version of itself. This page covers how releases reach you, what is and isn't signed on each platform, and how agent CLIs and helper tools are installed, which is a separate flow.

## No in-app updates

- The app contains no update client and makes no version-check request.
- The status bar contains update UI, but nothing in the app ever reports an update, so it never appears. The underlying `install_update` command is a stub that does nothing (`agentmux-cef/src/commands/stubs.rs`).
- **Microsoft Store** installs are updated by the Store.
- For **every other install** you download and install new releases yourself.

Consequences: nothing can push code to your machine through AgentMux, and nothing brings you security fixes automatically either. To hear about new releases, watch the GitHub releases feed: `https://github.com/agentmuxai/agentmux/releases.atom`.

## How releases are published

Releases are built by the `release.yml` workflow in the AgentMux repository and published on [GitHub Releases](https://github.com/agentmuxai/agentmux/releases). [agentmux.ai/download](https://agentmux.ai/download) serves the same files.

| Platform | Files | Architecture |
|---|---|---|
| Windows | Installer (`AgentMux-<version>-x64-setup.exe`), portable ZIP, MSIX | x64 only |
| macOS | `AgentMux_<version>_arm64.dmg` | Apple Silicon only |
| Linux | AppImage, `.deb`, `.rpm`, portable `.tar.gz` | x86_64 only |

The Windows installer is built with **Inno Setup** (`packaging/windows/agentmux.iss`). By default it installs for the current user, into `%LOCALAPPDATA%\Programs\AgentMux`, without an administrator prompt; its first dialog lets you install for all users instead. It adds a Start-menu shortcut and, if you tick the box, a desktop shortcut. It creates no firewall rules, services or scheduled tasks.

Start-at-login is a separate, opt-in setting in the app. On Windows it creates a scheduled task named `AgentMux`. The uninstaller doesn't remove that task; turn the setting off before uninstalling, or remove it with `schtasks /Delete /TN "AgentMux" /F`.

## Code signing, per platform

| File | Signed? |
|---|---|
| Windows installer and portable ZIP | **No.** Neither the installer nor the executables are Authenticode-signed, so Windows SmartScreen may warn. |
| Windows MSIX on GitHub Releases | **No**, so Windows won't install it directly. The Microsoft Store signs the copy it distributes. |
| macOS DMG | **Yes**, with a Developer ID certificate and the hardened runtime. Notarization is attempted on every build. If Apple doesn't accept it, the build logs a warning and still ships a signed but un-notarized DMG. |
| Linux AppImage, `.deb`, `.rpm`, `.tar.gz` | **No.** No GPG signatures, and no package repository. |

The release workflow publishes **no checksum file**. For Windows and Linux, the only integrity guarantee is HTTPS from GitHub or agentmux.ai. On macOS you can check the signature and notarization yourself:

```bash
codesign --verify --deep --strict /Applications/AgentMux.app
spctl --assess --type execute -vv /Applications/AgentMux.app
xcrun stapler validate ~/Downloads/AgentMux_<version>_arm64.dmg
```

`stapler validate` fails for a DMG that shipped without notarization.

## Agent CLIs

When you launch an agent whose CLI isn't installed, or install it from the Toolchain pane, AgentMux runs npm (`agentmux-srv/src/server/cli_handlers.rs`, `agentmux-srv/src/server/install_handlers.rs`):

```
npm install --prefix ~/.agentmux/instances/v<agentmux-version>/cli/<provider> <package>@<pinned version>
```

| Provider | npm package | Pinned version |
|---|---|---|
| Claude Code | `@anthropic-ai/claude-code` | 2.1.280 |
| Codex | `@openai/codex` | 0.154.0 |
| Gemini | `@google/gemini-cli` | 0.60.0 |
| Qwen Code | `@qwen-code/qwen-code` | 0.24.0 |
| OpenClaw | `openclaw` | 2026.9.4 |
| Pi | `@mariozechner/pi-coding-agent` | 0.73.1 |
| Mux Code | `@agentmuxai/muxcode` | 0.1.0 |
| Copilot | `@github/copilot` | 1.0.85 |
| Antigravity | `@google/antigravity-cli` | 1.0.0 |
| Kimi | none: install it yourself (`pip install kimi-cli`) | — |

The pins live in `agentmux-srv/src/backend/providers.rs` and change with AgentMux releases.

What this does and doesn't guarantee:

- Only the top-level package version is pinned. Its dependencies resolve fresh at install time; there is no lockfile.
- **AgentMux checks no hash.** Integrity is whatever npm provides: TLS to the registry and the registry's own integrity metadata. npm uses your configured registry, so an internal mirror works.
- Packages' install scripts run. AgentMux removes its own `AGENTMUX_*` variables from their environment.
- Node.js is not bundled. If npm is missing, AgentMux points you to nodejs.org, or offers a one-click install through winget (`OpenJS.NodeJS.LTS`), Homebrew, or your Linux package manager via `pkexec`. Those package managers do their own verification.

The Toolchain pane also asks the npm registry for each CLI's latest version, to show whether yours is behind. It only displays the result; nothing is installed.

## Tool catalog

The tool catalog (`agentmux-srv/src/config/tool-catalog.json`) holds jq 1.7.1 and ripgrep 14.1.1. Both ship bundled with AgentMux, and both can be reinstalled from their GitHub release URLs. Each download is checked against the SHA-256 in the catalog, and a mismatch aborts the install (`agentmux-srv/src/backend/tool_store.rs`). The catalog is part of the app; it is not fetched at runtime.

## Default MCP servers

AgentMux's default MCP server catalog (git, fetch, sequential-thinking, memory, playwright, context7) starts its servers with `uvx` and `npx` without pinned versions (`agentmux-srv/src/config/starter-mcp-servers.json`). Those packages are downloaded from PyPI or npm, at their current versions, when an agent starts them. If that matters to you, remove them or replace them with pinned versions.

## Offline and managed deployment

- To run offline, install AgentMux and the agent CLIs you need while connected, or from an internal npm mirror. See [Data sovereignty](/security/data-sovereignty/#offline-and-air-gapped-use).
- For managed fleets, distribute the installer or packages through your own software-delivery tooling (Intune, Jamf, Ansible and the like). The Windows installer's per-user default fits unprivileged deployment.

## What we don't promise

- **No automatic security updates.** A fix ships as a release; you install it on your own schedule.
- **No staged rollouts** and **no telemetry-driven rollback.** Everyone who downloads a version gets the same files, and we learn about breakage only when you report it on GitHub Issues.

---

**Source-of-truth references**:
- `agentmux-cef/src/commands/stubs.rs` — `install_update` stub
- `.github/workflows/release.yml`, `.github/workflows/build-windows.yml`, `.github/workflows/build-macos.yml`, `scripts/package-macos.sh` — builds, signing, notarization
- `packaging/windows/agentmux.iss` — Windows installer
- `agentmux-launcher/src/autostart/mod.rs` — start-at-login
- `agentmux-srv/src/backend/providers.rs`, `agentmux-srv/src/server/cli_handlers.rs`, `agentmux-srv/src/server/install_handlers.rs` — agent CLI installs
- `agentmux-srv/src/server/system_install_handlers.rs` — one-click Node.js, Git and Python installs
- `agentmux-srv/src/backend/tool_store.rs`, `agentmux-srv/src/config/tool-catalog.json` — SHA-256-checked tool downloads
