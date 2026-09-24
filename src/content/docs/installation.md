---
title: "Installation"
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

AgentMux runs on Windows (x64), macOS (Apple Silicon only) and Linux (x86_64 only). There is no Intel Mac build and no Linux ARM build.

Every release is published on [GitHub Releases](https://github.com/agentmuxai/agentmux/releases), which is the source of truth for downloads. The [agentmux.ai](https://agentmux.ai) download buttons point at the same files, except on Windows, where the main button opens the Microsoft Store.

AgentMux bundles its own Chromium runtime (CEF), so it doesn't use a system browser engine such as WebKitGTK.

## Downloads

Release files carry the version in their name. The sizes below are for v0.57.1 and change a little from release to release.

| Platform | File | Download size |
|---|---|---|
| Windows | `AgentMux-<version>-x64-setup.exe` (installer) | 141.8 MB |
| Windows | `agentmux-<version>-x64-portable.zip` (portable) | 196.3 MB (434 MB extracted) |
| Windows | `AgentMux_<version>_x64.msix` (Store package, see [below](#msix-file)) | 197.0 MB |
| macOS | `AgentMux_<version>_arm64.dmg` | 155.6 MB |
| Linux | `AgentMux_<version>_amd64.AppImage` | 165.6 MB |
| Linux | `AgentMux_<version>_amd64.deb` | 178.7 MB |
| Linux | `AgentMux-<version>-1.x86_64.rpm` | 178.6 MB |
| Linux | `AgentMux_<version>_amd64-portable.tar.gz` | 179.4 MB (439 MB extracted) |

## Windows

Windows 10 or 11, x64.

### Microsoft Store

Install AgentMux from its [Microsoft Store listing](https://apps.microsoft.com/detail/9p9qcxnncrk3). The Store keeps it updated. Store submissions are uploaded by hand, so the Store version can trail the newest release on GitHub for a while.

### Installer (.exe)

Download `AgentMux-<version>-x64-setup.exe` and run it. It's an Inno Setup installer. By default it installs for the current user into `%LOCALAPPDATA%\Programs\AgentMux`, with no administrator prompt. It also offers an install for all users, into Program Files, which needs administrator rights. It adds a Start menu entry, and a desktop shortcut if you tick that box.

The installer and the portable build are not code-signed, so Windows SmartScreen may show "Windows protected your PC". Choose **More info**, then **Run anyway**.

### Portable (.zip)

Download `agentmux-<version>-x64-portable.zip`, extract it anywhere and run `agentmux.exe`. Nothing is installed and no administrator rights are needed.

The portable build keeps no data in its own folder. Like the installed app, it stores everything under `%USERPROFILE%\.agentmux\` in the `stable` channel. A portable copy and an installed copy therefore share settings and agents. Each AgentMux version keeps its own runtime data (databases, logs, browser cache) in a separate folder. See [Multi-instance & dev mode](/multi-instance/) for how instances and channels are kept apart.

### MSIX file

The `.msix` on the Releases page is the package submitted to the Microsoft Store. It is unsigned (the Store signs it on ingest), so Windows won't install it if you download and open it directly. Use the [Store listing](https://apps.microsoft.com/detail/9p9qcxnncrk3) instead.

AgentMux is not in the WinGet repository yet, so `winget install` won't find it.

## macOS (Apple Silicon)

Download `AgentMux_<version>_arm64.dmg`. It requires an Apple Silicon Mac (M1 or later).

1. Open the `.dmg`.
2. Drag **AgentMux** onto the **Applications** folder.
3. Launch AgentMux from Applications or Spotlight.

The app is signed with an Apple Developer ID certificate, and the release pipeline submits the DMG to Apple for notarization. If Apple doesn't accept the submission, the pipeline still publishes the signed DMG without notarization. In that case macOS blocks the first launch: open **System Settings → Privacy & Security** and click **Open Anyway**.

## Linux

Requirements:

- **x86_64.** There is no ARM build.
- **glibc 2.35 or newer.** Release builds are compiled on Ubuntu 22.04 (glibc 2.35). Older distributions such as Ubuntu 20.04 and Debian 11 are not supported.
- **An X11 or Wayland desktop.** See [Display server](#display-server).

The packages declare no package dependencies; they're built for a standard desktop installation.

### AppImage

Download `AgentMux_<version>_amd64.AppImage` from [GitHub Releases](https://github.com/agentmuxai/agentmux/releases), then:

```bash
chmod +x AgentMux_*_amd64.AppImage
./AgentMux_*_amd64.AppImage
```

On first launch the AppImage copies itself to `~/.local/share/agentmux/extracted/<version>/` and restarts from there. Later launches start from that copy. It keeps the two most recent extracted versions and deletes older ones that aren't running. The first launch also adds AgentMux to your desktop's application menu.

Mounting an AppImage needs FUSE. If your system has no FUSE, extract it and run it without mounting:

```bash
./AgentMux_*_amd64.AppImage --appimage-extract
squashfs-root/AppRun
```

Or use the `.deb`, `.rpm` or `.tar.gz` package, none of which need FUSE.

### .deb (Debian, Ubuntu)

```bash
sudo apt install ./AgentMux_*_amd64.deb
agentmux
```

The package installs AgentMux under `/opt/agentmux`, puts an `agentmux` command on your `PATH` and adds a desktop entry.

### .rpm (Fedora, openSUSE)

```bash
sudo dnf install ./AgentMux-*-1.x86_64.rpm
agentmux
```

The install layout is the same as the `.deb`.

### Portable (.tar.gz)

```bash
tar -xzf AgentMux_*_amd64-portable.tar.gz
./AgentMux/agentmux.sh
```

This needs no install step. It isn't covered by the one-time sandbox fix described below; if your system blocks the sandbox, use the AppImage, `.deb` or `.rpm` instead.

### Display server

When `WAYLAND_DISPLAY` is set, AgentMux runs as a native Wayland client. Otherwise it uses X11. If you enable window transparency (`window:transparent`), it runs through XWayland instead, because native Wayland has no equivalent of the X11 window-opacity property it uses. To force a backend, set `AGENTMUX_OZONE_PLATFORM=wayland` or `AGENTMUX_OZONE_PLATFORM=x11`. The logic is in `agentmux-cef/src/app/mod.rs` (the Linux Ozone branch).

### Sandbox blocked by AppArmor (Ubuntu)

AgentMux sandboxes its browser engine with unprivileged user namespaces. Recent Ubuntu releases restrict these through AppArmor, which blocks Chromium-based apps. AgentMux checks for this before starting the browser engine. If it's blocked, a dialog offers three choices:

- **Fix it now (one-time, needs your password):** installs a narrow AppArmor exception at `/etc/apparmor.d/agentmux-userns` through `pkexec`, then relaunches. The exception grants only the `userns` rule to AgentMux's own browser binary. It covers the AppImage (current and future versions) and the `.deb`/`.rpm` install path.
- **Continue without sandbox this time:** runs this session unsandboxed. The window title shows "— Sandbox Disabled".
- **Cancel:** exits.

The dialog needs `zenity` or `kdialog`. Without either, AgentMux prints the explanation to the terminal and exits. You can run one session without the sandbox by setting `AGENTMUX_UNSAFE_NOSANDBOX=1`. See `agentmux-cef/src/linux_sandbox.rs` (`build_apparmor_profile`) for the exact profile.

## First launch

The first window opens a starter layout of three panes:

- **Agent** (left): the agent picker, where you create or relaunch agents. See [First Agent Setup](/first-agent/).
- **Sysinfo** (top right): live system metrics.
- **Swarm** (bottom right): a live tree of your agent panes, with their subagents, todos and running tools.

New tabs and new windows start with the same layout (`agentmux-srv/src/backend/wcore/mod.rs`, `seed_default_layout`).

The **widget bar** at the top right opens panes. By default it pins **Agent**, **Swarm**, **Armory** and **Sysinfo** (`agentmux-srv/src/config/widgets.json`). Every other widget is under **more**: Drone, Warden, Terminal, Editor, Browser, Help, Messengers, Media, Toolchain and Settings. Right-click a widget to pin it to the bar or unpin it. As the title bar gets narrower, the bar first drops its labels and then moves widgets that no longer fit under **more**.

The **hamburger menu (≡)** has New Tab, New Window, Theme, Opacity, Settings, Command Palette, Armory, Toolchain, DevTools, Online Docs and Exit.

Agents need their CLI tools, and most of those need Node.js and npm. **≡ → Toolchain** shows what AgentMux can find: Node.js, npm, Git, Python, and the optional Docker and uv, plus every agent CLI, each with its version, path and status. For a missing Git, Node.js, npm or Python it offers **or install it now**, which installs through winget on Windows or Homebrew on macOS (if you have them), or through your distribution's package manager on Linux (for example apt-get, dnf, pacman or zypper, elevated through `pkexec`). The same option appears in the prompt AgentMux shows when you pick an agent whose required tools are missing.

## Updating

Apart from the Microsoft Store build, AgentMux doesn't update itself. To update, download the new release and install or run it in place of the old one. Your settings and agents carry over, because every release build uses the same `stable` channel. See [Update model](/security/update-model/).

## Next Steps

- [Quickstart](/quickstart/): your first agent in a few minutes
- [First Agent Setup](/first-agent/): connect your first AI agent
- [Configuration](/config/): customize your settings
