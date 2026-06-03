---
title: "Installation"
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

AgentMux is available for Windows, macOS, and Linux. The portable package is around 148 MB; runtime memory is 150–350 MB depending on session activity.

AgentMux bundles its own Chromium runtime via CEF — there is **no system dependency on WebKitGTK or any other browser engine.** A standard desktop installation of any supported OS is enough.

## macOS (Apple Silicon)

Download the `.dmg` installer from [agentmux.ai](https://agentmux.ai) or [GitHub Releases](https://github.com/agentmuxai/agentmux/releases).

1. Open the `.dmg` file.
2. Drag AgentMux to your Applications folder.
3. Launch from Applications or Spotlight.

The macOS build is code-signed and notarized.

## Windows

Three options available from [agentmux.ai](https://agentmux.ai):

### Installer (.exe)
Download `AgentMux_x64-setup.exe` and run the NSIS installer. Default install location is `%LOCALAPPDATA%\AgentMux`.

### Portable (.zip)
Download `agentmux-x64-portable.zip` and extract anywhere. No installation required — run `AgentMux.exe` directly. Ideal for testing a new build alongside an installed version (each instance is fully isolated; see [Multi-instance & dev mode](/multi-instance/)).

### MSIX

Download `AgentMux_x64.msix` for Windows-Store-style installation: sandboxed install (no UAC prompt) using AppX/MSIX packaging, with cleaner uninstall semantics than NSIS. Uses the same `stable` data channel as the installer, so agents and settings carry over if you switch between MSIX and the NSIS `.exe`.

Note: not yet published to the Store; the MSIX package is sideloaded directly from [GitHub Releases](https://github.com/agentmuxai/agentmux/releases) for now. **There is no auto-update** for any AgentMux distribution today (see [Update model](/security/update-model/)) — sideloaded MSIX, NSIS installer, and portable all require a manual re-download to upgrade. Once a Store listing ships, Store-installed MSIX builds will receive Store auto-updates; sideloaded MSIX builds still won't.

## Linux

### AppImage
```bash
# Download
curl -LO https://agentmux.ai/releases/latest/AgentMux_amd64.AppImage

# Make executable
chmod +x AgentMux_amd64.AppImage

# Run
./AgentMux_amd64.AppImage
```

### Requirements
- A display server (X11 or Wayland)
- glibc 2.31+ (Ubuntu 20.04 / Debian 11 / equivalent or newer)

No system browser dependencies — the AppImage carries its own CEF runtime.

## Verify Installation

After launching AgentMux, you should see the workspace with a default terminal pane and the widget bar at the top right. The widget bar lists every pinned widget — `Agent`, `Browser`, `Terminal`, `Sysinfo`, `Editor`, `Swarm`, `Drone`, `Help`, `Warden` — and collapses to icon-only when the title bar is narrow. **Settings** and **DevTools** are not widgets; both live in the **hamburger menu (≡)** at the top of the tab bar.

## Next Steps

- [First Agent Setup](/first-agent) — Connect your first AI agent
- [Configuration](/config) — Customize your settings
