---
title: "Update model"
description: "AgentMux has no in-app updater. How releases are published and signed, how to update, and how agent CLIs and tools get installed."
---

AgentMux has no auto-updater and never checks for a newer version of itself. This page covers how releases reach you, what is and isn't signed on each platform, and how agent CLIs and helper tools are installed, which is a separate flow.

## No in-app updates

- The app contains no update client and makes no version-check request.
- The status bar contains update UI, but nothing in the app ever reports an update, so it never appears. The underlying `install_update` command is a stub that does nothing (`crates/cef/src/commands/stubs.rs`).
- **Microsoft Store** installs are updated by the Store.
- For **every other install** you download and install new releases yourself.

Consequences: nothing can push code to your machine through AgentMux, and nothing brings you security fixes automatically either. To hear about new releases, watch the GitHub releases feed: `https://github.com/agentmuxai/agentmux/releases.atom`.

## How releases are published

Releases are built by the `release.yml` workflow in the AgentMux repository and published on [GitHub Releases](https://github.com/agentmuxai/agentmux/releases). [agentmux.ai](https://agentmux.ai/#download) serves the same files.

| Platform | Files | Architecture |
|---|---|---|
| Windows | Installer (`AgentMux-<version>-x64-setup.exe`), portable `.7z`, MSIX | x64 only |
| macOS | `AgentMux_<version>_arm64.dmg` | Apple Silicon only |
| Linux | AppImage, `.deb`, `.rpm`, portable `.tar.gz` | x86_64 only |

The Windows installer is built with **Inno Setup** (`packaging/windows/agentmux.iss`). By default it installs for the current user, into `%LOCALAPPDATA%\Programs\AgentMux`, without an administrator prompt; its first dialog lets you install for all users instead. It adds a Start-menu shortcut and, if you tick the box, a desktop shortcut. It creates no firewall rules, services or scheduled tasks.

Start-at-login is a separate, opt-in setting in the app. On Windows it creates a scheduled task named `AgentMux`. The uninstaller doesn't remove that task; turn the setting off before uninstalling, or remove it with `schtasks /Delete /TN "AgentMux" /F`.

## Code signing, per platform

| File | Signed? |
|---|---|
| Windows installer and portable `.7z` | **No.** Neither the installer nor the executables are Authenticode-signed, so Windows SmartScreen may warn. |
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

AgentMux installs a harness's CLI in one of two ways, depending on where the vendor publishes it.

### npm harnesses

When you launch an agent whose CLI isn't installed, or install it from the Toolchain pane, AgentMux runs npm (`crates/srv/src/server/cli_handlers.rs`, `crates/srv/src/server/install_handlers.rs`):

```
npm install --prefix ~/.agentmux/shared/cli/<provider>/<pinned version> <package>@<pinned version>
```

Every AgentMux version and channel on the machine shares that folder.

| Provider | npm package | Pinned version |
|---|---|---|
| Claude Code | `@anthropic-ai/claude-code` | 2.1.288 |
| Codex | `@openai/codex` | 0.154.0 |
| Gemini | `@google/gemini-cli` | 0.62.0 |
| Qwen Code | `@qwen-code/qwen-code` | 0.24.7 |
| OpenClaw | `openclaw` | 2026.9.8 |
| Pi | `pi-acp`, with `@earendil-works/pi-coding-agent` | 0.0.34, with 1.0.4 |
| Mux Code | `@agentmuxai/muxcode` | 0.8.0 |
| Copilot | `@github/copilot` | 1.0.91 |
| Kilo Code CLI | `@kilocode/cli` | 7.8.8 |
| Cline CLI | `cline` | 3.0.71 |
| OpenCode | `opencode-ai` | 1.19.0 |
| DeepSeek Harness | `@deepseek-ai/dsh` | 0.2.0-rc.2 (a prerelease) |
| Crush | `@charmland/crush` | 0.98.1 |

The pins live in `crates/srv/src/backend/providers.rs` and change with AgentMux releases.

What this does and doesn't guarantee:

- Only the top-level package version is pinned. Its dependencies resolve fresh at install time; there is no lockfile.
- **AgentMux checks no hash.** Integrity is whatever npm provides: TLS to the registry and the registry's own integrity metadata. npm uses your configured registry, so an internal mirror works.
- Packages' install scripts run. AgentMux removes its own `AGENTMUX_*` variables from their environment. Some packages download their native binary in that step: Crush's fetches it from GitHub releases.
- Node.js is not bundled. If npm is missing, AgentMux points you to nodejs.org, or offers a one-click install through winget (`OpenJS.NodeJS.LTS`), Homebrew, or your Linux package manager via `pkexec`. Those package managers do their own verification.
- Kilo Code CLI, Cline CLI and OpenCode can update themselves. AgentMux turns that off when it launches them, so the pinned version is the one that runs.

The Toolchain pane also asks the npm registry for each npm CLI's latest version, to show whether yours is behind. It only displays the result; nothing is installed.

### Harnesses you install yourself

Six harnesses aren't on npm: Kimi Code CLI, Antigravity, goose, Grok Build, Aider and Muse Code. AgentMux never runs their installers. It shows the vendor's own install command, you run it, and AgentMux finds the CLI on your `PATH` or, for all but Kimi Code CLI, in the folder that installer uses by default. Integrity is whatever the vendor's installer provides.

| Provider | Published as | Version AgentMux was tested with |
|---|---|---|
| Kimi Code CLI | PyPI `kimi-cli` (`pip install kimi-cli`) | Not pinned |
| Antigravity | Google's installer, which keeps `agy` up to date itself | Not pinned |
| goose | GitHub releases of `aaif-goose/goose`, through goose's installer | 1.54.0 |
| Grok Build | xAI's installer and its stable release channel | 1.0.52 |
| Aider | PyPI `aider-chat`, through Aider's installer (uv) | 0.86.2 |
| Muse Code | Meta's installer and its stable release channel | 1.4.7-R6101.1 |

AgentMux runs whatever version you have installed; the pin records the version it was tested with. It turns off self-update where the CLI allows it, so that version doesn't change under a running agent: Grok Build gets `GROK_DISABLE_AUTOUPDATER=1`, Muse Code `MUSE_NO_AUTO_UPDATE=1`, and Aider `--no-check-update`. On Windows, AgentMux runs Muse Code's native binary rather than its launcher, which would otherwise update itself.

AgentMux's maintainers track every pin against its upstream releases on npm, PyPI, GitHub releases or the vendor's release channel, and raise it in a later AgentMux release. The app itself asks only npm, for the Toolchain pane.

## Tool catalog

The tool catalog (`crates/srv/src/config/tool-catalog.json`) holds jq 1.7.1 and ripgrep 14.1.1. Both ship bundled with AgentMux, and both can be reinstalled from their GitHub release URLs. Each download is checked against the SHA-256 in the catalog, and a mismatch aborts the install (`crates/srv/src/backend/tool_store.rs`). The catalog is part of the app; it is not fetched at runtime.

## Default MCP servers

AgentMux's default MCP server catalog (git, fetch, sequential-thinking, memory, playwright, context7) starts its servers with `uvx` and `npx` without pinned versions (`crates/srv/src/config/starter-mcp-servers.json`). Those packages are downloaded from PyPI or npm, at their current versions, when an agent starts them. If that matters to you, remove them or replace them with pinned versions.

## Offline and managed deployment

- To run offline, install AgentMux and the agent CLIs you need while connected, or from an internal npm mirror. The harnesses you install yourself need their vendor's download sites, or a copy of the installed CLI. See [Data sovereignty](/security/data-sovereignty/#offline-and-air-gapped-use).
- For managed fleets, distribute the installer or packages through your own software-delivery tooling (Intune, Jamf, Ansible and the like). The Windows installer's per-user default fits unprivileged deployment.

## What we don't promise

- **No automatic security updates.** A fix ships as a release; you install it on your own schedule.
- **No staged rollouts** and **no telemetry-driven rollback.** Everyone who downloads a version gets the same files, and we learn about breakage only when you report it on GitHub Issues.

---

**Source-of-truth references**:
- `crates/cef/src/commands/stubs.rs` — `install_update` stub
- `.github/workflows/release.yml`, `.github/workflows/build-windows.yml`, `.github/workflows/build-macos.yml`, `scripts/package-macos.sh` — builds, signing, notarization
- `packaging/windows/agentmux.iss` — Windows installer
- `crates/launcher/src/autostart/mod.rs` — start-at-login
- `crates/srv/src/backend/providers.rs`, `crates/srv/src/backend/cli_install.rs`, `crates/srv/src/server/cli_handlers.rs`, `crates/srv/src/server/install_handlers.rs` — agent CLI installs, pins and the install folders the vendors' installers use
- `crates/srv/src/server/system_install_handlers.rs` — one-click Node.js, Git and Python installs
- `crates/srv/src/backend/tool_store.rs`, `crates/srv/src/config/tool-catalog.json` — SHA-256-checked tool downloads
