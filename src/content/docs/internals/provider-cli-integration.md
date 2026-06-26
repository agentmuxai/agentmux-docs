---
title: Provider CLI integration
description: How AgentMux spawns provider CLIs into PTYs — the blockcontroller, per-provider launch argument construction, stream format parsing, and subprocess lifecycle.
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

AgentMux does not call AI provider APIs directly. Instead, it manages a provider CLI subprocess — `claude`, `codex`, `gemini`, or others — inside a PTY, and communicates with the provider's API through that CLI. This page describes how that subprocess is created, configured, and supervised.

## Supported providers

| Provider | CLI binary | npm package | Controller type | Output format |
|---|---|---|---|---|
| Claude Code | `claude` | `@anthropic-ai/claude-code` | `persistent` | `stream-json` (NDJSON) |
| Codex | `codex` | `@openai/codex` | `subprocess` | JSON |
| Gemini | `gemini` | `@google/gemini-cli` | `subprocess` | `stream-json` (NDJSON) |
| OpenClaw | `openclaw` | — | `acp` | JSON-RPC 2.0 over stdio |
| Kimi | `kimi` | — | `subprocess` | `stream-json` (NDJSON) |
| Muxcode | `muxcode` | — | `subprocess` | — |

The **controller type** determines the spawn strategy: `persistent` keeps the CLI process alive between turns (Claude Code); `subprocess` spawns a fresh process per turn; `acp` uses the Agent Communication Protocol over stdio.

Provider definitions live in `frontend/app/view/agent/providers/index.ts`.

## Step 1 — CLI resolution

Before spawning, AgentMux resolves the CLI binary path via the `ResolveCliCommand` RPC. The resolution order is:

1. **AgentMux-managed install** — `~/.agentmux/cli/<provider>/node_modules/.bin/<provider>` (`.cmd` on Windows). This is always preferred; versions are pinned per release (e.g., Claude Code `2.1.185`).
2. **System PATH** — used only as a fallback for informational display (`detect_installed_clis`), never for actually launching agents.

AgentMux installs provider CLIs via npm into its own directory so agents always run a known, tested version regardless of what the user has globally installed.

Source: `agentmux-cef/src/commands/providers.rs` `get_local_cli_bin_path()`, `detect_installed_clis()`.

## Step 2 — Argument construction

Launch arguments are assembled by `frontend/app/view/agent/buildRuntimeArgs.ts`. When they are applied depends on the controller type:

- **`persistent` (Claude Code):** Args are built once at the time the CLI subprocess is spawned and do not change between turns — the process stays alive for the session.
- **`subprocess` (Codex, Gemini, others):** Args are rebuilt per turn, since a fresh process is spawned for each turn.

The construction process:

1. **Start from base args** — `ProviderDefinition.launchArgs` (e.g., `["-p", "--output-format", "stream-json", "--verbose", "--include-partial-messages"]` for Claude).
2. **Strip conflicting flags** — any `--dangerously-skip-permissions`, `--permission-mode`, `--yolo`, `--model`, and `--effort` flags already in the base are removed so runtime values take precedence.
3. **Append permission mode** — provider-dependent:
   - Claude/others: `--permission-mode <value>` (e.g., `default`, `bypass-permissions`)
   - Kimi / Gemini / Qwen: only `--yolo` is supported
   - Codex: no permission flag (baked into base args)
4. **Append model and effort** (Claude only):
   - `--model <opus|sonnet|haiku>`
   - `--effort <low|medium|high>` — skipped for Haiku (returns HTTP 400)
5. **Codex model special case** — the model value is prepended to the trailing `-` positional arg rather than passed as `--model`.

This means the same agent definition can be launched with different models or effort levels without changing the stored definition — the runtime config overrides are applied at spawn time.

## Step 3 — PTY creation (the blockcontroller)

The **blockcontroller** (`agentmux-srv/src/backend/blockcontroller/shell.rs`) is the component that creates and supervises the PTY. It owns the agent subprocess from birth to death.

### PTY creation

```rust
let pty_system = native_pty_system();
let pair = pty_system.openpty(pty_size)?;
```

`native_pty_system()` from the `portable-pty` crate selects the platform implementation:

- **Windows:** ConPTY (Windows Pseudo Console API)
- **Unix:** POSIX `posix_openpt()`

The PTY size is seeded from the frontend-computed terminal dimensions before the process starts, avoiding a post-spawn resize race. Fallback is 25 rows × 200 columns.

### Environment injection

The following environment variables are injected into the agent's PTY at spawn:

| Variable | Value |
|---|---|
| `AGENTMUX_LOCAL_URL` | `http://127.0.0.1:<port>` — sidecar base URL |
| `AGENTMUX_BLOCKID` | Pane UUID — the agent's own pane context |
| `AGENTMUX_AGENT_ID` | Agent's registered name |
| `TERM`, `COLORTERM`, `TERM_PROGRAM` | Terminal capability hints |
| `PATH` | Augmented with AgentMux-managed binary paths |

`AGENTMUX_AUTH_KEY` is **not** placed in the agent PTY environment (stripped at sidecar startup, security PR #801). Only internal tooling that requires it (`agentmux-mcp`, `agentmux-bashwrap`) receives it via their own spawn configuration.

See [Environment variable contract](/internals/env-vars/) for the full variable list.

### Internal async structure

Once the process is running, the blockcontroller runs three concurrent async tasks:

| Task | Responsibility |
|---|---|
| **PTY read loop** | Reads process stdout → line-buffer → JSON parse → FileStore + WPS events |
| **Input loop** | Routes the input channel → PTY writer (user turns, resize events, signals) |
| **Wait loop** | Monitors process exit, updates block status, classifies failures |

The blockcontroller state machine has three states: `INIT → RUNNING → DONE`.

## Step 4 — Output stream parsing

Each provider emits a different JSON format. The backend uses a `Translator` trait (`agentmux-srv/src/agents/translator/mod.rs`) with per-provider implementations:

```rust
pub trait Translator: Send {
    fn translate(&mut self, frame: Value) -> Vec<AgentEvent>;
}
```

The runner is provider-agnostic and holds `Box<dyn Translator>`. Each implementation maps provider-specific JSON frames to the internal `AgentEvent` enum.

### Line buffering and fast-reject

Raw bytes from the PTY are accumulated in a line buffer before JSON parsing:

- Lines not starting with `{` are fast-rejected (terminal UI output, not structured events)
- The buffer preserves raw bytes (not lossy-decoded strings) so multi-byte UTF-8 sequences that span chunk boundaries are handled correctly
- Buffer cap is 1 MiB (`AGENT_LINE_BUFFER_CAP`); reset if no newline is found within that window

Parsed events are published on the WPS scope `agent_event:<block_id>` and simultaneously written as raw bytes to the xterm.js renderer.

Source: `agentmux-srv/src/backend/blockcontroller/shell.rs` `extract_agent_events()`.

### Claude stream-json event types

| Frame type | Maps to |
|---|---|
| `stream_event.content_block_delta.text_delta` | `AssistantText` event |
| `stream_event.content_block_stop` (tool_use) | `ToolUse` event |
| `result` frame with `cost_usd` | `Cost` + `Done` events |
| `result` frame with `is_error: true` | Failure classification |

Source: `agentmux-srv/src/agents/translator/claude.rs`.

### ACP (OpenClaw)

OpenClaw uses JSON-RPC 2.0 over stdio rather than NDJSON. Its controller is in `agentmux-srv/src/backend/blockcontroller/acp.rs`.

## Step 5 — Subprocess lifecycle and signal handling

### Graceful stop

When an agent is stopped (via `agent.stop` RPC or user action):

**Unix:**
1. `SIGTERM` sent to the **process group** (negative PID) — signals the CLI and all its children
2. Grace period waits (`KILL_GRACE_SECS = 5`)
3. `SIGKILL` sent if the process is still running
4. PTY writer (`input_tx`) is dropped, delivering EOF/SIGHUP as a belt-and-suspenders signal

**Windows:**
- `child.kill()` only — no signal support in Win32

Source: `agentmux-srv/src/backend/blockcontroller/shell.rs` `stop()`.

### Unexpected crash handling

When the CLI exits unexpectedly:

1. Stdout/stderr readers are drained with a 2-second timeout
2. The `result` frame's `is_error` flag is checked
3. In-band API errors (401 auth failure, rate limits) are detected from synthetic `assistant` frames
4. The last ~40 lines of stderr are retained for failure classification
5. `crate::agents::failure::AgentFailure` classifies the exit into a structured failure type surfaced to the UI

Source: `agentmux-srv/src/backend/blockcontroller/subprocess.rs`.

### Session resume

Session IDs are captured from the CLI's stdout and persisted in block metadata. On resume, the frontend passes `--resume <session_id>` to the CLI so the conversation context is restored without re-sending history.

## Provider abstraction summary

The abstraction is **hybrid** — not a single unified interface throughout:

| Layer | Approach |
|---|---|
| Frontend provider definitions | Static lookup table (`PROVIDERS` record), conditional branching on `provider.id` |
| Argument construction | Conditional logic per provider in `buildRuntimeArgs.ts` |
| Backend spawn | Conditional on `ProviderDefinition.controllerType` (persistent / subprocess / acp) |
| Backend stream parsing | Abstract `Translator` trait — each provider implements `translate(frame) -> Vec<AgentEvent>` |

## See also

- [Conversation overhead & provider mechanics](/internals/conversation-overhead/) — what gets injected into the system prompt per turn and how prompt caching affects token cost
- [Agent App API](/internals/agent-app-api/) — the MCP tools and REST endpoints available to running agents
- [Environment variable contract](/internals/env-vars/) — full list of env vars injected at agent launch
- [Architecture overview](/internals/architecture/) — the four-process model and how the blockcontroller fits into the sidecar
