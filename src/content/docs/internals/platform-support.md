---
title: Platform support
description: Which AgentMux features run on which OS, and how the docs flag platform-specific paths and behavior.
---

AgentMux runs on Windows, macOS, and Linux. This page is the canonical answer to "does X run on my OS?" — bookmark it.

## At a glance

| Area | Windows | macOS | Linux |
|---|---|---|---|
| Launcher (`agentmux-launcher`) | ✅ ships | ✅ ships (`task dev` v0.41.0+; packaged DMG v0.42.x+) | ✅ ships (AppImage entry point A0 v0.42.x; Unix-socket IPC + reducer + saga A1 v0.42.x) |
| Host (`agentmux-cef`) — Chromium embed | ✅ ships | ✅ ships (DMG, v0.42.x+) | ✅ ships (AppImage, v0.42.x+) |
| Sidecar (`agentmux-srv`) | ✅ ships | ✅ cross-platform | ✅ cross-platform |
| `agentmux-common` (path resolution, runtime mode) | ✅ ships | ✅ cross-platform | ✅ cross-platform |
| Frontend / SolidJS renderer | ✅ ships | ✅ runs in any CEF | ✅ runs in any CEF |
| **WRR (Window Reality Reconciliation)** | ✅ Win32 hooks | ❌ no equivalent yet | ❌ no equivalent yet |
| Browser pane (CefBrowserView) | ✅ ships | ✅ ships (v0.42.x+) | ✅ ships (v0.42.x+) |
| Terminal pane (PTY) | ✅ ConPTY | ✅ posix\_openpt | ✅ posix\_openpt |
| Shell-integration scripts (bash / zsh / fish / pwsh) | ✅ all four | ✅ all four | ✅ bash + zsh + fish (pwsh optional) |
| Native window drag (title-bar + floater header) | ✅ ships | ✅ ships | ✅ ships (patched libcef.so, v0.42.x+) |
| Floating-pane tear-off / redock | ✅ ships | ✅ ships | ✅ ships (Phase A, v0.41+, Wayland desktop) |
| Window transparency | ✅ ships | 🟡 in progress | 🟡 in progress (root cause identified) |
| Native splash screen | ✅ ships | ✅ ships | 🟡 not yet implemented |
| Crashpad reports | ✅ `<data-dir>/cef-cache/Crashpad/` | ✅ same path | ✅ same path |
| Sidecar minidumps | ✅ WER → `%LOCALAPPDATA%\CrashDumps\` | ❌ uses macOS crash reporter (`~/Library/Logs/DiagnosticReports/`) | ❌ uses systemd-coredump or apport |
| Portable distribution | ✅ ZIP (`task package`) | ✅ DMG, notarized (v0.42.x+) | ✅ AppImage (`task package:linux`, v0.42.x+) |
| Multi-instance isolation under `~/.agentmux/` | ✅ ships | ✅ same layout | ✅ same layout |
| Version isolation (per-version single-instance domain + version-scoped runtime dirs) | ✅ v0.41.1+ | ✅ v0.42.x+ | ✅ v0.42.x+ |

✅ — supported and tested · 🟡 — partial / in progress · ❌ — not supported

## What's Windows-coupled today

A handful of features are Windows-coupled because they hook directly into Win32:

- **WRR (Window Reality Reconciliation)** — hooks `WM_PAINT`, `SetWindowPos`, `GetForegroundWindow` to reconcile against AgentMux's reducer model. macOS / Linux equivalents (`NSWindow` observers, `wlroots` events) are on the roadmap; until they ship, `task dev` on those platforms runs without WRR drift detection.
- **Sidecar crash minidumps** — Windows Error Reporting writes to `%LOCALAPPDATA%\CrashDumps\`. On macOS the system Crash Reporter writes to `~/Library/Logs/DiagnosticReports/`; on Linux it depends on whether `systemd-coredump` or `apport` is installed.
- **Window transparency** — `SetBackgroundOpaque(false)` IPC is Windows-only today; the root cause on Linux (views::SolidBackground / kColorPrimaryBackground) is identified and a fix is in progress.

Pages and admonitions in these docs that are Windows-specific are flagged with a `:::note[Windows-only]` block at the top of the relevant section. If you don't see a flag, assume it works cross-platform.

## What's cross-platform today

The architecture is designed cross-platform from the start:

- The four-process topology ([architecture overview](/internals/architecture/)) doesn't change per OS — same launcher / host / sidecar / renderer split.
- Path resolution ([multi-instance](/multi-instance/)) uses `~/.agentmux/` everywhere; the channel + version sub-dir layout (`channels/<ch>/versions/<v>/`) is identical across OSes.
- Persistence ([SQLite + JSONL](/internals/persistence/)) is byte-identical. A backup taken on Windows can be restored on macOS or Linux.
- Reducer state, sagas, and the frontend slice migration ([reducer stack](/internals/reducer-stack/)) are pure logic with no OS-specific code.
- App API ([agent-app-api](/internals/agent-app-api/)) — every command in the catalog is OS-independent at the wire level.
- **Version isolation** (v0.41.1+ Windows; v0.42.x+ macOS + Linux) — each release version has its own single-instance domain (the launcher's IPC socket/pipe hash includes the build version). Runtime DBs, CEF cache, host logs, and IPC artifacts are version-scoped under `channels/<channel>/versions/<v>/`. Agent definitions and settings are channel-wide under `channels/<channel>/`, so upgrading doesn't reset your agents or settings.

## Per-OS notes

### Windows

- Path separators in commands and config are `\\`; the docs uses `/` for portability — both work in PowerShell and Git Bash.
- Use **PowerShell 7+** or **Git Bash (MSYS2)** for the shell-integration scripts. CMD is not supported.
- The `taskkill` recipes in the [debugging](/internals/debugging/) page expect Windows.
- `%APPDATA%`, `%LOCALAPPDATA%`, `%USERPROFILE%` resolve to the standard Windows paths.

### macOS

- Ships as a notarized `.dmg` (v0.42.x+). The launcher binary is `Contents/MacOS/AgentMux` inside the app bundle.
- WRR hooks will use `NSWorkspace` observers for window-event subscriptions (planned; not yet implemented — see the ❌ WRR row in the table above).
- Shell integration: bash, zsh, and fish ship by default. PowerShell support is opt-in.

### Linux

- Ships as an **AppImage** (`task package:linux`) — one self-contained file, no installer. System requirements: glibc 2.31+ and FUSE (for the compressed SquashFS mount; pre-installed on most desktop distros — see [Installation → Linux](/installation/#linux) for the `--appimage-extract` fallback if FUSE is absent).
- **Launch flow:** `AppRun` → `linux-apprun.sh` → `agentmux-launcher` (the AppImage entry point). The launcher supervises the sidecar and host as a process group. On first launch the AppImage extracts itself to `~/.local/share/agentmux/extracted/<version>/` for faster subsequent starts.
- **Single-instance IPC:** Unix domain socket at `$XDG_RUNTIME_DIR/agentmux/<hash>.sock` (fallback: `/tmp/agentmux-<uid>/<hash>.sock`). The full reducer + saga coordinator runs on Linux (A1, v0.42.x+) — same feature set as Windows.
- **Display server:** defaults to XWayland (`--ozone-platform=x11`). Set `AGENTMUX_OZONE_PLATFORM=wayland` for native Wayland (experimental).
- **Window drag:** requires the patched `libcef.so` bundled in all release AppImages (`CefWindow::BeginWindowDrag()` dispatches `xdg_toplevel.move` / `_NET_WM_MOVERESIZE`).
- **Wayland app\_id:** `agentmux`. Desktop file: `agentmux.desktop` (auto-registered by the AppImage on first launch).
- **WRR:** no equivalent on Linux yet; the launcher runs without drift detection.

## Reading the docs across platforms

When you see a recipe like:

```bash
# Windows
muxlog host '\[fe\]'
```

it works the same on macOS and Linux unless an explicit `:::note[Windows-only]` flag says otherwise. Path examples use `~/.agentmux/...` consistently — the env var `AGENTMUX_LOG_DIR` resolves to the right per-instance path regardless of OS.

If a section is genuinely Windows-coupled, you'll see a flag like this:

```
:::note[Windows-only]
This recipe relies on Windows Error Reporting. macOS and Linux equivalents are documented above the table.
:::
```

## Roadmap

Cross-platform parity priority order (subject to change):

1. **Window transparency on Linux** — root cause identified (views::SolidBackground), fix in progress.
2. **Native splash screen on Linux** — Windows and macOS already have it; Linux splash is spec-complete and ready to implement.
3. **WRR equivalents on macOS / Linux** — depends on per-OS window-management APIs.
4. **Native crash-reporting hookup** — replace the Windows-WER-only path with per-OS native handlers feeding into a unified diagnostics view.
5. **Native Wayland (non-XWayland)** — experimental today; stability work ongoing.

Track progress on [GitHub Discussions](https://github.com/agentmuxai/agentmux/discussions) and the [main agentmux repo](https://github.com/agentmuxai/agentmux).

## See also

- [Architecture overview](/internals/architecture/) — process topology (cross-platform)
- [Multi-instance & dev mode](/multi-instance/) — data layout (cross-platform)
- [WRR](/internals/wrr/) — Windows-only details
- [Debugging](/internals/debugging/) — log + crash-report recipes (mostly cross-platform; Windows-specific paths flagged)
