---
title: Platform support
description: Which AgentMux features run on which OS, and how the docs flag platform-specific paths and behavior.
---

AgentMux is built primarily on Windows today, with cross-platform foundations and ongoing work on macOS + Linux. This page is the canonical answer to "does X run on my OS?" — bookmark it.

## At a glance

| Area | Windows | macOS | Linux |
|---|---|---|---|
| Launcher (`agentmux-launcher`) | ✅ ships | 🟡 in progress | 🟡 in progress |
| Host (`agentmux-cef`) — Chromium embed | ✅ ships | 🟡 in progress | 🟡 in progress |
| Sidecar (`agentmux-srv`) | ✅ ships | ✅ cross-platform | ✅ cross-platform |
| `agentmux-common` (path resolution, runtime mode) | ✅ ships | ✅ cross-platform | ✅ cross-platform |
| Frontend / SolidJS renderer | ✅ ships | ✅ runs in any CEF | ✅ runs in any CEF |
| **WRR (Window Reality Reconciliation)** | ✅ Win32 hooks | ❌ no equivalent yet | ❌ no equivalent yet |
| Browser pane (CefBrowserView) | ✅ ships | 🟡 packaging | 🟡 packaging |
| Terminal pane (PTY) | ✅ ConPTY | ✅ posix\_openpt | ✅ posix\_openpt |
| Shell-integration scripts (bash / zsh / fish / pwsh) | ✅ all four | ✅ all four | ✅ bash + zsh + fish (pwsh optional) |
| Crashpad reports | ✅ `<instance>/cef-cache/Crashpad/` | ✅ same path | ✅ same path |
| Sidecar minidumps | ✅ WER → `%LOCALAPPDATA%\CrashDumps\` | ❌ uses macOS crash reporter (different path) | ❌ uses systemd-coredump or apport (different path) |
| Portable distribution | ✅ ZIP build (`task package`) | 🟡 .app bundle planned | 🟡 AppImage (in progress) |
| Multi-instance isolation under `~/.agentmux/` | ✅ ships | ✅ same layout | ✅ same layout |

✅ — supported and tested · 🟡 — partial / in progress · ❌ — not supported

## What's Windows-coupled today

A handful of features are Windows-coupled because they hook directly into Win32:

- **WRR (Window Reality Reconciliation)** — hooks `WM_PAINT`, `SetWindowPos`, `GetForegroundWindow` to reconcile against AgentMux's reducer model. macOS / Linux equivalents (`NSWindow` observers, `wlroots` events) are on the roadmap; until they ship, `task dev` on those platforms runs without WRR drift detection.
- **Sidecar crash minidumps** — Windows Error Reporting writes to `%LOCALAPPDATA%\CrashDumps\`. On macOS the system Crash Reporter writes to `~/Library/Logs/DiagnosticReports/`; on Linux it depends on whether `systemd-coredump` or `apport` is installed.
- **Portable ZIP packaging** — the `task package` flow assumes a Windows extracted-folder layout. macOS will use an `.app` bundle; Linux will use AppImage.

Pages and admonitions in these docs that are Windows-specific are flagged with a `:::note[Windows-only]` block at the top of the relevant section. If you don't see a flag, assume it works cross-platform.

## What's cross-platform today

The architecture is designed cross-platform from the start:

- The four-process topology ([architecture overview](/internals/architecture/)) doesn't change per OS — same launcher / host / sidecar / renderer split.
- Path resolution ([multi-instance](/multi-instance/)) uses `~/.agentmux/` everywhere; the per-instance versioned subdirs are identical across OSes.
- Persistence ([SQLite + JSONL](/internals/persistence/)) is byte-identical. A backup taken on Windows can be restored on macOS or Linux.
- Reducer state, sagas, and the frontend slice migration ([reducer stack](/internals/reducer-stack/)) are pure logic with no OS-specific code.
- App API ([agent-app-api](/internals/agent-app-api/)) — every command in the catalog is OS-independent at the wire level.

## Per-OS notes

### Windows

- Path separators in commands and config are `\\`; the docs uses `/` for portability — both work in PowerShell and Git Bash.
- Use **PowerShell 7+** or **Git Bash (MSYS2)** for the shell-integration scripts. CMD is not supported.
- The `taskkill` recipes in the [debugging](/internals/debugging/) page expect Windows.
- `%APPDATA%`, `%LOCALAPPDATA%`, `%USERPROFILE%` resolve to the standard Windows paths.

### macOS (in progress)

- Build path planned: native `.app` bundle, code-signed, notarized. The launcher binary ships as a Mach-O executable inside `Contents/MacOS/`.
- WRR hooks will use `NSWorkspace` observers for the launcher's window-event subscriptions; the precise mapping is still being designed.
- Shell integration: bash, zsh, and fish ship by default. PowerShell support is opt-in.

### Linux (in progress)

- AppImage packaging is the target — single self-contained binary, no installer.
- Wayland: app\_id is `agentmux`; the desktop file is `agentmux.desktop`.
- X11: works; some WRR-equivalent features depend on the compositor exposing window state, which not all do.

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

1. **macOS host build + sidecar bundle** — the longest tail, but the most user-requested.
2. **Linux AppImage + sidecar parity** — already partially shipped; remaining work is packaging.
3. **WRR equivalents on macOS / Linux** — depends on per-OS window-management APIs.
4. **Native crash-reporting hookup** — replace the Windows-WER-only path with per-OS native handlers feeding into a unified diagnostics view.

Track progress on [GitHub Discussions](https://github.com/agentmuxai/agentmux/discussions) and the [main agentmux repo](https://github.com/agentmuxai/agentmux).

## See also

- [Architecture overview](/internals/architecture/) — process topology (cross-platform)
- [Multi-instance & dev mode](/multi-instance/) — data layout (cross-platform)
- [WRR](/internals/wrr/) — Windows-only details
- [Debugging](/internals/debugging/) — log + crash-report recipes (mostly cross-platform; Windows-specific paths flagged)
