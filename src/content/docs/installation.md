---
title: "Installation"
---

AgentMux is available for Windows, macOS, and Linux. Under 25MB installed, 35-125MB memory at runtime.

## macOS (Apple Silicon)

Download the `.dmg` installer from [agentmux.ai](https://agentmux.ai) or [GitHub Releases](https://github.com/agentmuxai/agentmux/releases).

1. Open the `.dmg` file
2. Drag AgentMux to your Applications folder
3. Launch from Applications or Spotlight

The macOS build is code-signed and notarized.

## Windows

Two options available from [agentmux.ai](https://agentmux.ai):

### Installer (.exe)
Download `AgentMux_x64-setup.exe` and run the NSIS installer. It will install to `%LOCALAPPDATA%\AgentMux`.

### Portable (.zip)
Download `agentmux-x64-portable.zip` and extract anywhere. No installation required — run `AgentMux.exe` directly.

### MSIX
Download `AgentMux_x64.msix` for Windows Store-style installation with automatic updates.

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
- WebKitGTK (usually pre-installed on modern distros)

## Verify Installation

After launching AgentMux, you should see the workspace with a default terminal pane. Press `Cmd+Shift+A` (macOS) or `Alt+Shift+A` (Windows/Linux) to open the agent panel.

## Next Steps

- [First Agent Setup](/first-agent) — Connect your first AI agent
- [Configuration](/config) — Customize your settings
