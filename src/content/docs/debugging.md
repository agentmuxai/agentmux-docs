---
title: Debugging
description: How to find logs, trace renderer crashes, follow the reducer dispatch ring, and inspect WRR drift in a running AgentMux.
---

This page is the practical "something's off, where do I look first" reference. AgentMux's three-process design means logs, state, and crash artifacts each live in a specific place — the trick is knowing which.

## Logs at a glance

| Source | File | Tail recipe |
|---|---|---|
| Host (CEF) — includes frontend `[fe]` console | `<instance>/logs/agentmux-host-v<v>.log.<date>` | `muxlog host` (or `muxlog host '[fe]'` for frontend only) |
| Sidecar (`agentmux-srv`) | `<instance>/logs/agentmuxsrv-v<v>.log.<date>` | `muxlog srv` |
| Launcher (early-startup) | `~/.agentmux/logs/agentmux-launcher.log` | `cat "$AGENTMUX_LOG_DIR/agentmux-launcher.log"` |
| Launcher reducer events | `<instance>/data/launcher-events.log` | `tail -F` directly (JSONL) |

The launcher log is the only one outside the per-instance dir — it's the early-startup file the launcher writes before paths are fully resolved.

### Pointer files

Daily log rotation means the active filename changes at UTC midnight. Rather than guessing, every host + sidecar process writes a **pointer file** with the current absolute path:

```bash
LOG="$(cat ~/.agentmux/logs/current-host-v<version>.path)"
tail -F "$LOG"
```

The same convention applies for the sidecar (`current-srv-v<version>.path`). The pointer file is rewritten on each launch and on every rotation.

The shipped `muxlog` shell helper does this lookup for you and also handles the legacy basename-only pointer format used by older instances. See [Multi-instance & dev mode](/multi-instance/) for the full pointer story.

## Frontend `[fe]` logs go to the host log, not DevTools

Every `console.log/warn/error/debug/info` call in the frontend is monkey-patched at startup by [`frontend/log/log-pipe.ts`](https://github.com/agentmuxai/agentmux/blob/main/frontend/log/log-pipe.ts) and forwarded to the host via the `fe_log_structured` CEF IPC command. They land in the **host log**, tagged `[fe]` with `module=console`:

```
INFO agentmux_lib::commands::backend: [fe] my message module=console
```

So:

- **Don't tell users to open DevTools (F12)** — the frontend logs aren't there.
- **`muxlog host '\[fe\]'`** filters the host log to frontend output only.
- **Live tail** during repro: keep the dev terminal open with `task dev`; `[fe]` lines appear inline.

## Reducer dispatch ring

Every slice in the [reducer stack](/reducer-stack/) routes through `command-source.ts`'s `recordDispatch(...)` helper, which appends a structured record (slice name, key, command, emitted events, source, timestamp) to an in-memory ring buffer. The diagnostics panel surfaces this.

When a question like "what mutated this state?" comes up, filter the ring for the relevant key — the answer is one entry. This was the discriminator in the SolidJS reactive-leak storm crashes that earlier attempts (PRs #708, #721, #722) chased the wrong way.

## WRR drift diagnostics

[Window Reality Reconciliation](/multi-instance/#what-about-chromium-state) reconciles AgentMux's model against Win32 reality. When a window appears to "freeze" or windows mysteriously vanish, the launcher reducer's event log is the authority. Useful greps:

```bash
grep -E "HiddenSinceOpen|HwndWithoutBrowser|WRR-DRIFT|wfr:gate|wfr:runner|pending=" \
    "$AGENTMUX_DATA_DIR/launcher-events.log"
```

`HiddenSinceOpen` and `HwndWithoutBrowser` indicate the window's lifecycle state diverged from CEF's view. `WRR-DRIFT` lines show the specific reconciliation action taken.

## Sidecar crash dumps

The sidecar runs as a separate process auto-spawned by the host. If it crashes (e.g. a `0xC0000409` STACK_BUFFER_OVERRUN), Windows Error Reporting writes a minidump:

```
%LOCALAPPDATA%\CrashDumps\agentmux-srv*.dmp
```

WER configuration is part of AgentMux's installer; on a dev build, ensure the dump dir exists before reproducing. Open dumps in WinDbg to inspect the crashing thread's stack.

## Chromium / renderer crashes

Renderer crashes come up as Crashpad reports. The host log captures the crash event; the dump itself lands in:

```
<instance>/cef-cache/Crashpad/reports/
```

For renderer-storm crashes (the screen flashes, panes blink, eventually CEF gives up): check the dispatch ring **first**, not the Crashpad stack. A reactive dependency leak in a shared utility produces the same symptoms as a real C++ crash but is diagnosed entirely from the ring. See PRs #708 / #721 / #722 for the specific `recordDispatch` pattern that caused it; instrument **effect-run count** before you fan out into hosts.

## Shell-integration env block

Terminals opened inside AgentMux get an `AGENTMUX_*` env block. The `muxlog` helper, custom prompts, and pane-title color all rely on these:

```bash
echo "$AGENTMUX_BLOCKID"      # which block this terminal is in
echo "$AGENTMUX_LOG_DIR"      # where to look for host/srv logs
echo "$AGENTMUX_VERSION"      # which version this terminal was launched against
echo "$AGENTMUX_AGENT_ID"     # agent identity, if a forge agent owns the pane
```

If a terminal is missing these, the shell-integration scripts at `~/.agentmux/shell/` weren't sourced — usually because the user opened the terminal outside AgentMux's spawn path.

## Useful greps cheat sheet

```bash
# Frontend only
muxlog host '\[fe\]'

# DnD / drag / tab-drop
grep -i "dnd\|drag\|tab-drag\|tab drop\|ReorderTab\|tab-reorder" "$LOG"

# Memory heartbeat (FileStore cache size, etc.)
muxlog host mem_heartbeat

# WRR drift
grep -E "HiddenSinceOpen|HwndWithoutBrowser|WRR-DRIFT|wfr:gate|wfr:runner" \
    "$AGENTMUX_DATA_DIR/launcher-events.log"

# Saga lifecycle
grep -E "saga.start|saga.step|saga.complete|saga.fail" "$LOG"

# Persist subscriber lag
grep -E "persist|broadcast|Lagged" "$LOG"
```

## When to escalate

If three checks haven't revealed the cause, **stop investigating in isolation**. The reducer dispatch ring, the launcher event log, and the host/sidecar logs collectively cover every cross-process state mutation. If the answer isn't in those three sources, the question is probably wrong — file a bug with what you've ruled out.

## See also

- [Architecture overview](/architecture-overview/) — what each process owns
- [Multi-instance & dev mode](/multi-instance/) — log path resolution
- [Reducer stack](/reducer-stack/) — what the dispatch ring records
- [Persistence](/persistence/) — where durable state lives
- [Report Issues](/report-issues/) — when to file a bug
