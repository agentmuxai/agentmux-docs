---
title: Provider CLI integration
description: How AgentMux spawns provider CLIs into PTYs — the blockcontroller, per-provider launch argument construction, stream format parsing, and subprocess lifecycle.
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

AgentMux does not call AI provider APIs directly. Instead, it manages a provider CLI subprocess — `claude`, `codex`, `gemini`, or others — inside a PTY, and communicates with the provider's API through that CLI. This page describes how that subprocess is created, configured, and supervised.

## Supported providers

| Provider | CLI binary | npm package | Controller type | Output format |
|---|---|---|---|---|
| Claude Code | `claude` | `@anthropic-ai/claude-code` | `persistent` | `stream-json` (NDJSON) |
| Codex | `codex` | `@openai/codex` | `subprocess` | JSONL — `codex exec --json` (NDJSON, one JSON object per line; not a single JSON blob) |
| Gemini | `gemini` | `@google/gemini-cli` | `subprocess` | `stream-json` (NDJSON) |
| Qwen Code | `qwen` | `@qwen-code/qwen-code` | `subprocess` | `stream-json` (NDJSON) in Claude Code's frame shape, read by the Claude translator as `qwen-stream-json` |
| Kimi | `kimi` | — (PyPI `kimi-cli`, installed by you) | `subprocess` | `stream-json` (NDJSON) |
| Muxcode | `muxcode` | `@agentmuxai/muxcode` | `subprocess` | `stream-json` (NDJSON) — reuses the Claude translator |
| Antigravity | `agy` | — (Google's installer) | `subprocess` | `stream-json` (NDJSON) in its own schema, with its own translator (`agy-stream-json`) |
| OpenClaw | `openclaw` | `openclaw` | `acp` | ACP: JSON-RPC 2.0 over stdio |
| GitHub Copilot CLI | `copilot` | `@github/copilot` | `acp` | ACP |
| Pi | `pi-acp` | `pi-acp`, with `@earendil-works/pi-coding-agent` | `acp` | ACP |
| Kilo Code CLI | `kilo` | `@kilocode/cli` | `acp` | ACP |
| Cline CLI | `cline` | `cline` | `acp` | ACP |
| OpenCode | `opencode` | `opencode-ai` | `acp` | ACP |
| goose | `goose` | — (GitHub release, installed by you) | `acp` | ACP |
| Grok Build | `grok` | — (xAI's installer) | `acp` | ACP |
| DeepSeek Harness | `dsh` | `@deepseek-ai/dsh` | `acp` | ACP |
| Aider | `aider` | — (PyPI `aider-chat`, through Aider's installer) | `terminal` | None: its own UI in a terminal pane |
| Crush | `crush` | `@charmland/crush` | `terminal` | None: its own UI in a terminal pane |
| Muse Code | `muse` | — (Meta's installer) | `terminal` | None: its own UI in a terminal pane |

The **controller type** determines the spawn strategy: `persistent` keeps the CLI process alive between turns (Claude Code); `subprocess` spawns a fresh process per turn; `acp` keeps one process speaking the Agent Client Protocol over stdio; `terminal` opens a terminal pane that runs the CLI's own UI (see [The terminal tier](#the-terminal-tier)).

:::note
**Muxcode** is AgentMux's own first-party agentic coding CLI, not a typo — see [Auth flows](/auth/). **Antigravity** is Google's agentic coding CLI. Its stream-json looks like Gemini CLI's but is its own schema, so it has its own translator, and it takes the prompt as an argument (`-p <prompt>`) rather than on stdin.
:::

Provider definitions live in `frontend/app/view/agent/providers/catalog.ts` (frontend) and `crates/srv/src/backend/providers.rs` (backend, source of truth for the table above).

## Provider (harness) vs. model vendor

"Provider" throughout this page — and "harness" in some older code/specs, the same axis under a different name — means *which CLI tool is driving the session*: Claude Code, Codex, Gemini, and so on. That is a distinct concept from **model vendor**: the underlying LLM backend actually serving responses for that session.

Each provider declares its default vendor(s) via `supported_vendors` in `crates/srv/src/backend/providers.rs` — most-default-first, e.g. Claude Code → `["anthropic"]`, Codex → `["openai"]`, OpenClaw → `["openai", "anthropic", "google"]` since it's model-agnostic. This is purely descriptive/display data (drives the dual-icon vendor badge and the agent picker's default-vendor inference); it doesn't gate anything at spawn time.

What *does* gate spawn-time behavior is `base_url_env_var` — the environment variable a provider reads to redirect its model vendor backend off the default endpoint (e.g. Claude Code's `ANTHROPIC_BASE_URL`, pointing it at Bedrock, Vertex, OpenRouter, or a custom proxy). This is set only where independently verified per provider, not guessed — as of this writing only Claude Code has a confirmed one.

The **effective vendor** an agent is actually using is computed, not stored: a non-empty model-vendor base URL override (`modelVendorBaseUrl`) means the provider has been redirected off its default backend, so the effective vendor reads as `"custom"` regardless of what the provider declares — an empty/absent override means the provider is talking to its own default vendor, the first entry in the provider's `supportedVendors` (or the provider id itself as a fallback, for an uncataloged provider). See `resolveEffectiveVendor()` in `frontend/app/view/agent/providers/catalog.ts`.

## Step 1 — CLI resolution

Before spawning, AgentMux resolves the CLI binary path via the `ResolveCliCommand` RPC. The resolution order is:

1. **AgentMux-managed install**, for a provider with an npm package: `~/.agentmux/shared/cli/<provider>/<pinned version>/`, shared by every AgentMux version and channel on the machine. AgentMux installs it there at the pinned version the first time it's needed, so agents run a known, tested version regardless of what the user has globally installed.
2. **System PATH, then the installer's own folder**, for a provider with no npm package (Kimi, Antigravity, goose, Grok Build, Aider, Muse Code). AgentMux never runs their installers. It looks on `PATH`, then in the folder each vendor's installer uses by default, because a running AgentMux keeps the `PATH` it started with. If neither has the CLI, the launch fails with the vendor's install command as a hint.

Source: `crates/srv/src/server/cli_handlers.rs`, `crates/srv/src/backend/cli_install.rs`, and `known_install_paths` in `crates/srv/src/backend/providers.rs`.

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

The **blockcontroller** (`crates/srv/src/backend/blockcontroller/shell/mod.rs`) is the component that creates and supervises the PTY. It owns the agent subprocess from birth to death.

### PTY creation

```rust
let pty_system = native_pty_system();
let pair = pty_system.openpty(pty_size)?;
```

`native_pty_system()` from the `portable-pty` crate selects the platform implementation:

- **Windows:** ConPTY (Windows Pseudo Console API)
- **Unix:** a POSIX pseudo-terminal (openpty)

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

Each provider emits a different JSON format. The backend defines a `Translator` trait (`crates/srv/src/agents/translator/mod.rs`) for mapping provider-specific JSON frames to the internal `AgentEvent` enum, designed to be provider-agnostic (the runner holds `Box<dyn Translator>`):

```rust
pub trait Translator: Send {
    fn translate(&mut self, frame: Value) -> Vec<AgentEvent>;
}
```

Three implementations exist, in `crates/srv/src/agents/translator/`: `ClaudeTranslator` (`claude.rs`) is what the drone Agent-block's headless runner (`crates/srv/src/agents/runner.rs`) uses; `CodexTranslator` (`codex.rs`) and `GeminiTranslator` (`gemini.rs`) read only the answer text, for the one-shot `/btw` side question (`crates/srv/src/server/agent_handlers/side_question.rs`). The interactive subprocess-controller path, which drives an agent pane, doesn't route frames through this trait: the controller captures the session id and publishes the raw frames, and the frontend's per-provider translators render them (for Codex, see the note below).

### Line buffering and fast-reject

Raw bytes from the PTY are accumulated in a line buffer before JSON parsing:

- Lines not starting with `{` are fast-rejected (terminal UI output, not structured events)
- The buffer preserves raw bytes (not lossy-decoded strings) so multi-byte UTF-8 sequences that span chunk boundaries are handled correctly
- Buffer cap is 1 MiB (`AGENT_LINE_BUFFER_CAP`); reset if no newline is found within that window

Parsed events are published on the WPS scope `agent_event:<block_id>` and simultaneously written as raw bytes to the xterm.js renderer.

Source: `crates/srv/src/backend/blockcontroller/shell/translation.rs` `extract_agent_events()`.

### Claude stream-json event types

| Frame type | Maps to |
|---|---|
| `stream_event.content_block_delta.text_delta` | `AssistantText` event |
| `stream_event.content_block_stop` (tool_use) | `ToolUse` event |
| `result` frame with `cost_usd` | `Cost` + `Done` events |
| `result` frame with `is_error: true` | Failure classification |

Source: `crates/srv/src/agents/translator/claude.rs`.

### ACP

OpenClaw, GitHub Copilot CLI, Pi, Kilo Code CLI, Cline CLI, OpenCode, goose, Grok Build and DeepSeek Harness speak the Agent Client Protocol: JSON-RPC 2.0 over stdio rather than NDJSON. One controller drives all of them (`crates/srv/src/backend/blockcontroller/acp.rs`), and one translator renders them (`frontend/app/view/agent/providers/acp-translator.ts`), so a new ACP harness needs configuration, not protocol code.

- **Session start.** After `initialize`, the controller sends `session/new`, or `session/load` to resume when the agent says it supports that. Both carry the agent's MCP servers from its `.mcp.json`, AgentMux's own `agentmux` server included, in ACP's shape. Every ACP agent gets the stdio servers; HTTP and SSE servers go only to an agent whose `initialize` response says it takes them.
- **Permissions.** AgentMux approves tool use by default, as it does for every harness: it answers `session/request_permission` with the agent's "allow always" option, else "allow once". AgentMux adds no permission flags to an ACP harness's command line.
- **Before launch.** Two harnesses need a file in their own config folder first. Grok Build reads project rules only in a trusted folder, so AgentMux adds the agent's own folder to Grok's trusted folders, and nothing else. DeepSeek Harness uploads its session logs to DeepSeek unless a profile patch turns that off, so AgentMux writes that patch when there is none yet.

### Codex JSONL

Codex is launched as `codex exec --json --dangerously-bypass-approvals-and-sandbox -` (`launch_args` in `crates/srv/src/backend/providers.rs`): the `exec` subcommand runs non-interactively, `--json` emits **JSONL** — newline-delimited JSON, one frame per line, not a single JSON document — and the trailing `-` reads the prompt from stdin. Its init frame looks like `{"type":"thread.started","thread_id":"..."}`, contrasted with Claude's `{"type":"system","subtype":"init","session_id":"..."}` and Gemini's `{"type":"init","session_id":"..."}` — Codex is the one provider keyed on `thread_id` rather than `session_id` (`session_id_field: "thread_id"`).

Codex frames go through the same line-buffered, fast-reject front door described above. In an interactive pane they are not translated by the `Translator` trait: the subprocess controller captures the session id (`crates/srv/src/backend/blockcontroller/subprocess/host_spawn.rs`) and publishes the raw frames as WPS events, and the frontend renders them with `frontend/app/view/agent/providers/codex-translator.ts`. The Rust `CodexTranslator` handles only the answer text of a one-shot turn, for `/btw`.

## The terminal tier

Aider, Crush and Muse Code have no interface AgentMux can parse: no ACP, and no structured output it can read (Muse Code's own protocol needs a controller of its own, which doesn't exist yet). They use the `terminal` controller type. Launching one turns the agent's pane into a terminal pane (`view: "term"`, an interactive command run on start) that runs the CLI with its launch arguments in the agent's folder (`TERMINAL_PANE_META` in `frontend/app/view/agent/launch-args.ts`).

AgentMux still does the launch work it does for every harness: it writes the startup instructions file (`AGENTS.md`) and sets the CLI's config folder and opt-out variables. Where the CLI won't read the file by itself, the launch passes it: Aider runs as `aider --read AGENTS.md`. Muse Code runs with `--trust-workspace`, so it reads project rules in the agent's folder.

What the terminal tier doesn't get: an AgentMux transcript, token counts, resume, AgentMux's MCP tools, or a model picker. The CLI's own UI does those. A terminal-tier CLI also can't be a `.cmd` wrapper on Windows, so for Muse Code AgentMux runs the native binary its installer downloaded.

Crush moves to ACP when upstream ships it, and Muse Code when AgentMux has a controller for its protocol.

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

Source: `crates/srv/src/backend/blockcontroller/shell/lifecycle.rs` `stop()`.

### Unexpected crash handling

When the CLI exits unexpectedly:

1. Stdout/stderr readers are drained with a 2-second timeout
2. The `result` frame's `is_error` flag is checked
3. In-band API errors (401 auth failure, rate limits) are detected from synthetic `assistant` frames
4. The last ~40 lines of stderr are retained for failure classification
5. `crate::agents::failure::AgentFailure` classifies the exit into a structured failure type surfaced to the UI

Source: `crates/srv/src/backend/blockcontroller/subprocess/mod.rs`.

### Session resume

Session IDs are captured from the CLI's stdout and persisted in block metadata. Most providers resume with a trailing flag: on the next turn, the frontend appends `--resume <session_id>` (Claude) or `-r <session_id>` (Gemini) so conversation context is restored without re-sending history.

**Codex is different: it resumes via a subcommand, not a flag.** Its continuation invocation is `codex exec resume <thread_id> [flags] -`, not `codex exec [flags] - --resume <thread_id>`. `ProviderConfig::resume_strategy_str()` (`crates/srv/src/backend/providers.rs`) reports this as `"codex-exec"` (every other provider reports `"flag"` or `"none"`), and `build_turn_argv`/`build_codex_argv` in `crates/srv/src/backend/blockcontroller/subprocess/argv.rs` handle it by inserting `resume <thread_id>` immediately after the `exec` subcommand while keeping the trailing stdin marker `-` last — a plain flag-append would produce an invalid Codex invocation.

## Provider abstraction summary

The abstraction is **hybrid** — not a single unified interface throughout:

| Layer | Approach |
|---|---|
| Frontend provider definitions | Static lookup table (`PROVIDERS` record), conditional branching on `provider.id` |
| Argument construction | Conditional logic per provider in `buildRuntimeArgs.ts` |
| Backend spawn | Conditional on `ProviderDefinition.controllerType` (persistent / subprocess / acp / terminal) |
| Backend stream parsing | Abstract `Translator` trait (`translate(frame) -> Vec<AgentEvent>`) with Claude, Codex and Gemini implementations; the Codex and Gemini ones read only the answer text for `/btw`, and other providers' interactive-pane frames are parsed by the frontend (see Step 4's Codex note) |

## See also

- [Conversation overhead & provider mechanics](/internals/conversation-overhead/) — what gets injected into the system prompt per turn and how prompt caching affects token cost
- [MuxAPI](/internals/muxapi/) — the MCP tools and REST endpoints available to running agents
- [Environment variable contract](/internals/env-vars/) — full list of env vars injected at agent launch
- [Architecture overview](/internals/architecture/) — the four-process model and how the blockcontroller fits into the sidecar
