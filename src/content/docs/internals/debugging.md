---
title: Debugging
description: How to find logs, trace renderer crashes, follow the reducer dispatch ring, inspect WRR drift, and open DevTools (including remote CDP access) in a running AgentMux.
---

This page is the practical "something's off, where do I look first" reference. AgentMux's three-process design means logs, state, and crash artifacts each live in a specific place — the trick is knowing which.

## Logs at a glance

| Source | File | Tail recipe |
|---|---|---|
| Host (CEF) — includes frontend `[fe]` console | `<data-dir>/logs/agentmux-host-v<v>.log.<date>` | `muxlog host` (or `muxlog host '\[fe\]'` for frontend only) |
| Sidecar (`agentmux-srv`) | `~/.agentmux/logs/agentmuxsrv-v<v>.log.<date>` | `muxlog srv` |
| Launcher (early-startup) | `~/.agentmux/logs/agentmux-launcher.log` | `cat "$AGENTMUX_LOG_DIR/agentmux-launcher.log"` |
| Launcher reducer events | `<data-dir>/data/launcher-events.log` | `tail -F` directly (JSONL) |

Only the host log lives in the per-version data dir — the sidecar and launcher both log directly to the shared `~/.agentmux/logs/`.

### Pointer files

Daily log rotation means the active filename changes at UTC midnight. Rather than guessing, both host and sidecar write a **pointer file** to the active log filename:

```bash
LOG="$(cat ~/.agentmux/logs/current-host-v<version>.path)"
tail -F "$LOG"
```

The host pointer holds an absolute path (since the host log lives in the per-channel data dir). The sidecar pointer (`current-srv-v<version>.path`) holds just the basename, since the sidecar log lives directly in `~/.agentmux/logs/` next to it. Both pointers are rewritten on each launch and on every rotation.

The shipped `muxlog` shell helper does this lookup for you and also handles the legacy basename-only pointer format used by older instances. See [Multi-instance & dev mode](/multi-instance/) for the full pointer story.

## muxlog — multi-instance log discovery

`muxlog` is shipped in every AgentMux terminal (bash / zsh / pwsh / fish) and does more than tail a file — it **discovers, renders, and follows** AgentMux logs across every running instance on the machine, so debugging never starts with a file hunt.

```bash
muxlog ls           # what logs exist, newest first, with version + age
muxlog              # follow the most-recently-active host log
muxlog srv          # follow the active sidecar log
muxlog errors       # ERROR + WARN lines across host + sidecar
muxlog help         # full usage
```

Not loaded in a tool-spawned subshell (e.g. a tool call's `bash -c`)? Call the core directly: `node ~/.agentmux/shell/muxlog.mjs ls`.

### Targets

| Target | Log |
|---|---|
| `host` (default) | CEF host — windows, IPC bridge, frontend `[fe]` lines, heartbeat |
| `srv` | sidecar — RPC, blocks, shells, config |
| `launcher` | launcher — process/DLL/startup diagnostics (portable & installed only) |
| `fe` | the host log, pre-filtered to frontend `[fe]` lines |
| `all` | host (alias for the active host log; a real combined view is a roadmap item) |

### Actions and options

Three actions: `tail` (default — last `-n` lines, then follow like `tail -f`), `cat` (whole log, rendered), `grep <regex>` (lines whose **message** matches, not the whole JSON). Options compose in any position:

| Option | Effect |
|---|---|
| `-i <substr>` | pick the instance whose log path / branch / version contains `<substr>` |
| `-n <N>` | history lines before following (default 200) |
| `-a` | include agent-transcript noise (the sidecar's `… → blockfile` lines), excluded by default |
| `--grep <re>` | filter on the message field only |
| `--level a,b` | only these levels (`error,warn,info,debug`) |
| `--target <s>` | only lines whose tracing target contains `<s>` |
| `--since <ts>` | only lines at/after ISO `<ts>` (e.g. `2026-06-15T23:30`) |
| `--raw` | emit the original NDJSON (don't render) |
| `--verbose` | append the structured fields after the message |

```bash
muxlog srv -i fix-shell grep "shell\.spawn"   # a specific dev branch's sidecar
muxlog host --level error,warn                 # only problems, then follow
```

### Recipes

| Recipe | What it shows |
|---|---|
| `muxlog ls` | every instance's logs: target, version, source (`shared` / `dev:<branch>` / `channel:…`), age, size, path |
| `muxlog mem` (alias `doctor`) | system commit-free + derived pressure level (the OOM-relevant ceiling, not physical RAM) + the count and footprint of live AgentMux processes |
| `muxlog errors` | ERROR + WARN across the active host and sidecar |
| `muxlog bridge` | the startup handshake — `Loading URL`, `Injected IPC …`, `backend-ready`, `window.api`, `Bootstrap failed` — correlated in time, so a reconnect loop is obvious at a glance |
| `muxlog swarm` | subagent/swarm lifecycle — spawn, `display_name` resolution, status transitions, and the `parent_block_id`/`session_id`/`workflow_id` each event carries; sidecar-only |
| `muxlog auth` | provider auth/identity lifecycle — login flow (`auth.start`/`auth.spawn`/`auth.cancel`), OAuth config-dir wiring, credential import, and the logout side (`identity.unlink:`, `identity.delete:`) |
| `muxlog phases [<block-id>]` | **New 2026-08-18.** Merged, chronological turn-phase timeline for one agent pane — combines the frontend's `[wave-turn]` transition log (host) with the backend's `[health] turn_active flip` log (srv) into a single, correctly-ordered stream instead of two files to cross-reference by hand. Defaults to your own pane via `$AGENTMUX_BLOCKID` (already set in every agent's shell env); pass an explicit block id for a different pane. Host/srv logs are resolved by checking which log actually **contains** this pane's lines, not just "most recently active," so it stays correct with several instances — or several retained dev builds of the same branch — running at once. |

Every generic option (`--grep`, `--level`, `--target`, `-a`, `--raw`) composes on top of a recipe's own per-recipe filter.

### How discovery works

AgentMux logs live in **three** root trees, not one:

```
~/.agentmux/logs/                                   shared: sidecar, launcher, some host
~/.agentmux/dev/<branch>/<hash>/logs/               task dev — keyed on the git branch
~/.agentmux/channels/local-*/versions/<v>/.../logs/ portable / per-build instances
```

`muxlog` scans every root and ranks by modification time, defaulting to the **most-recently-active** instance — with dev + portables + several versions all up at once, that's almost always the one you mean. **Don't trust a single pointer for this** — run `muxlog ls` first, and pin a specific instance with `-i` when the most-recent one isn't the one you need.

Full reference: [`docs/MUXLOG.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/MUXLOG.md).

## muxspect — live process/turn-state introspection

`muxlog` is history — logs already written to disk. `muxspect` is its **live** sibling: it answers "what is this instance's agent pane doing **right now**" — controller lifecycle, the OS process tree behind a block, how stale that view is — by reading the same `ProcessBroker` computation the app's own Swarm pane uses. It never invents a second, independent view of process/turn state.

```bash
node ~/.agentmux/shell/muxspect.mjs list
node ~/.agentmux/shell/muxspect.mjs describe <block_id>
node ~/.agentmux/shell/muxspect.mjs watch <block_id>
node ~/.agentmux/shell/muxspect.mjs help
```

:::caution[Known gap — call the core directly for now]
The bare `muxspect` shell function only loads in an *interactive* terminal pane (sourced from the shell rcfile). Tool-spawned shells — the primary intended use, an agent's own tool calls — don't source the rcfile, so `muxspect` is undefined there even though the env vars it needs (`$AGENTMUX_LOCAL_URL`, `$AGENTMUX_AUTH_KEY`) are present. **Until this is fixed** (reagent P1 on PR #2380), call the deployed core directly instead of the shell function: `node ~/.agentmux/shell/muxspect.mjs <command>`. The wire protocol and commands are identical either way.
:::

### Diagnosing a stuck Activity Dock entry

`list` / `describe` / `watch` read controller state — they cannot see the Agent pane's **Activity Dock**, an in-renderer, never-persisted `ToolNode` list. A tool call that never received its terminating event (e.g. rejected by the outer CLI harness before it ever ran) can stay stuck at `status: "running"` in the dock indefinitely, invisible to every other `muxspect` command. Two more commands cover exactly this gap:

```bash
node ~/.agentmux/shell/muxspect.mjs dock <block_id>
node ~/.agentmux/shell/muxspect.mjs dock clear <block_id> <node_id>
```

`dock` reads a lightweight snapshot the renderer pushes on every `ToolNode` status change (id, tool name, status, age, whether it was a `run_in_background` launch) and flags entries that look stuck (`running`, past a 30s promotion threshold, nothing srv-side backing the block). `dock clear` force-cancels one specific entry live, in whatever renderer currently has that block open — no pane reload needed. This is `muxspect`'s only mutating command; every other command is read-only diagnostics.

The `STUCK?` heuristic has a blind spot for backgrounded launches: an accepted `run_in_background` call's raw status goes terminal (`success`) almost immediately even while the dock row keeps showing `running` while it awaits a `<task-notification>` (that reclassification is purely client-side). `STUCK?` structurally can't flag these — check the `bg` column by hand: a `bg` row with an old `age` and `status: success` is worth checking in the live UI even though `STUCK?` reads clean.

### Scope

**Phase 1 only queries the instance you're already inside** — it reads `$AGENTMUX_LOCAL_URL`/`$AGENTMUX_AUTH_KEY` from its own environment, the same way `agentmux-mcp` reaches every other `/api/v1/*` route. It cannot yet discover or query a *different* running AgentMux instance — each instance has its own dynamic port and auth key (the same isolation invariants covered in [Multi-instance & dev mode](/multi-instance/)) and there's no cross-instance discovery+auth story yet. Planned as Phase 2.

Full reference: [`docs/MUXSPECT.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/MUXSPECT.md).

## Frontend `[fe]` logs go to the host log, not DevTools

Every `console.log/warn/error/debug/info` call in the frontend is monkey-patched at startup by [`frontend/log/log-pipe.ts`](https://github.com/agentmuxai/agentmux/blob/main/frontend/log/log-pipe.ts) and forwarded to the host via the `fe_log_structured` CEF IPC command. They land in the **host log**, tagged `[fe]` with `module=console`:

```
INFO agentmux_lib::commands::backend: [fe] my message module=console
```

So:

- **Don't tell users to open DevTools expecting frontend `console.*` output** — it isn't there (see below for what DevTools' Console tab *does* show).
- **`muxlog host '\[fe\]'`** filters the host log to frontend output only.
- **Live tail** during repro: keep the dev terminal open with `task dev`; `[fe]` lines appear inline.

## Inspecting elements and opening DevTools

DevTools is still the right tool for DOM/CSS inspection and network activity — just not for frontend app logs (those are the host log, above). Two ways to reach it, both routed through the same `toggle_devtools`/`inspect_element_at` CEF IPC commands ([`agentmux-cef/src/commands/window/meta.rs`](https://github.com/agentmuxai/agentmux/blob/main/agentmux-cef/src/commands/window/meta.rs)):

- **Right-click → Inspect Element** — opens DevTools focused on the exact element under the cursor. Works both on regular panes (agent, terminal, editor, etc.) and browser panes. This is a frontend-owned menu entry, not CEF's built-in one: AgentMux's own unified context menu (`ContextMenuModel.showContextMenu`) renders every right-click surface in the app, and on browser panes CEF's native Chromium context menu (which has its own competing "Inspect") is deliberately suppressed so this one custom menu owns the whole surface — see [`docs/specs/SPEC_BROWSER_PANE_UNIFIED_CONTEXT_MENU_2026_08_15.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/SPEC_BROWSER_PANE_UNIFIED_CONTEXT_MENU_2026_08_15.md) in the app repo.
- **Toggle DevTools without a specific element** — hamburger menu (≡) → DevTools on Windows/Linux, the native View menu (⌥⌘I) on macOS, or the Command Palette's "Toggle DevTools" command. See [Main Menu](/main-menu/) and [Keybindings](/keybindings/).

Once open, the **Elements**, **Styles**, and **Network** tabs behave like DevTools anywhere — the **Console** tab just won't show `[fe]`-tagged app logs, since those bypass it entirely (previous section).

### Remote debugging via the Chrome DevTools Protocol (CDP)

Beyond the interactive DevTools window, the host also exposes a raw CDP endpoint — useful for scripted inspection or driving a running instance from a test harness, not just clicking around by hand.

**Port:** prefers **9223** in a dev build (`AGENTMUX_DEV=1` / `task dev`) or **9222** in a release build; if that port is already taken (e.g. a second instance is already running), it falls back to any free OS-assigned port instead of failing — don't hardcode 9222/9223 blindly when more than one instance might be up ([`agentmux-cef/src/lib.rs`](https://github.com/agentmuxai/agentmux/blob/main/agentmux-cef/src/lib.rs)).

**List targets and connect:**

```bash
curl -s http://127.0.0.1:9223/json/list   # each entry includes webSocketDebuggerUrl
```

Open the returned `webSocketDebuggerUrl` (`ws://127.0.0.1:9223/devtools/page/<target_id>`) and speak CDP's JSON-RPC-style protocol directly — or, for interactive use, point a Chromium-based browser at `chrome://inspect` → **Configure…** → add `localhost:9223` (or `9222` for a release build), and the AgentMux renderer appears under **Remote Target**.

For a working scripted reference (target discovery + a plain `WebSocket` JSON-RPC client, no external CDP library), see [`test/e2e/harness.ts`](https://github.com/agentmuxai/agentmux/blob/main/test/e2e/harness.ts) in the app repo.

## Reducer dispatch ring

Every slice in the [reducer stack](/internals/reducer-stack/) routes through `command-source.ts`'s `recordDispatch(...)` helper, which appends a structured record (slice name, key, command, emitted events, source, timestamp) to an in-memory ring buffer. The diagnostics panel surfaces this.

When a question like "what mutated this state?" comes up, filter the ring for the relevant key — the answer is one entry. This was the discriminator in the SolidJS reactive-leak storm crashes that earlier attempts (PRs #708, #721, #722) chased the wrong way.

## WRR drift diagnostics

[Window Reality Reconciliation](/internals/wrr/) reconciles AgentMux's model against Win32 reality. When a window appears to "freeze" or windows mysteriously vanish, the launcher reducer's event log is the authority. Useful greps:

```bash
grep -E "HiddenSinceOpen|HwndWithoutBrowser|WRR-DRIFT|wfr:gate|wfr:runner|pending=" \
    "$AGENTMUX_DATA_DIR/launcher-events.log"
```

`HiddenSinceOpen` and `HwndWithoutBrowser` indicate the window's lifecycle state diverged from CEF's view. `WRR-DRIFT` lines show the specific reconciliation action taken.

## Sidecar crash dumps

The sidecar runs as a separate process auto-spawned by the launcher (which owns its lifecycle). If it crashes (e.g. a `0xC0000409` STACK_BUFFER_OVERRUN), the OS writes a minidump.

:::note[Windows-only path]
On Windows, dumps land at `%LOCALAPPDATA%\CrashDumps\agentmux-srv*.dmp` via Windows Error Reporting (WER). On macOS, the system Crash Reporter writes to `~/Library/Logs/DiagnosticReports/`; on Linux, the path depends on whether `systemd-coredump` or `apport` is installed. See [Platform support](/internals/platform-support/) for the full per-OS table.
:::

WER configuration is part of AgentMux's installer; on a dev build, ensure the dump dir exists before reproducing. Open dumps in WinDbg (Windows) or `lldb` (macOS) / `gdb` (Linux) to inspect the crashing thread's stack.

## Chromium / renderer crashes

Renderer crashes come up as Crashpad reports. The host log captures the crash event; the dump itself lands in:

```
<data-dir>/cef-cache/Crashpad/reports/
```

For renderer-storm crashes (the screen flashes, panes blink, eventually CEF gives up): check the dispatch ring **first**, not the Crashpad stack. A reactive dependency leak in a shared utility produces the same symptoms as a real C++ crash but is diagnosed entirely from the ring. See PRs #708 / #721 / #722 for the specific `recordDispatch` pattern that caused it; instrument **effect-run count** before you fan out into hosts.

## Shell-integration env block

Terminals opened inside AgentMux get an `AGENTMUX_*` env block. The `muxlog` helper, custom prompts, and pane-title color all rely on these:

```bash
echo "$AGENTMUX_BLOCKID"      # which block this terminal is in
echo "$AGENTMUX_LOG_DIR"      # where to look for host/srv logs
echo "$AGENTMUX_VERSION"      # which version this terminal was launched against
echo "$AGENTMUX_AGENT_ID"     # agent identity, if an agent owns the pane
```

If a terminal is missing these, the shell-integration scripts at `~/.agentmux/shell/` weren't sourced — usually because the user opened the terminal outside AgentMux's spawn path.

## Useful greps cheat sheet

Most of these now have a proper `muxlog` recipe (see the [muxlog section](#muxlog--multi-instance-log-discovery) above) — reach for those first. The greps below remain useful for the handful of things without a recipe yet (DnD/tab-drag, saga lifecycle, persist-subscriber lag).

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

- [Architecture overview](/internals/architecture/) — what each process owns
- [Multi-instance & dev mode](/multi-instance/) — log path resolution
- [Reducer stack](/internals/reducer-stack/) — what the dispatch ring records
- [Persistence](/internals/persistence/) — where durable state lives, including the cross-process session lease
- [Report Issues](/report-issues/) — when to file a bug
- [`docs/MUXLOG.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/MUXLOG.md) / [`docs/MUXSPECT.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/MUXSPECT.md) — full tool references in the app repo
