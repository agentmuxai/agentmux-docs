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
Download `AgentMux_x64.msix` for Windows-Store-style installation with automatic updates.

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

After launching AgentMux, you should see the workspace with a default terminal pane and the widget bar at the top right. The widget bar's pinned tier (`Agent`, `Browser`, `Terminal`, `Sysinfo`, `DevTools`) appears directly; the rest (`Editor`, `Swarm`, `Help`) live in the **More** dropdown.

## Next Steps

- [First Agent Setup](/first-agent) — Connect your first AI agent
- [Configuration](/config) — Customize your settings
