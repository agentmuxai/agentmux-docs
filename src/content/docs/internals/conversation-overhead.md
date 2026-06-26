---
title: Conversation overhead & provider mechanics
description: What AgentMux injects into every agent session, what the underlying provider CLI injects, and how prompt caching affects the real token cost per turn.
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

When an agent pane is open and you send a message, there are two distinct layers that add context to the conversation before it reaches the AI provider. Understanding both layers — and how provider-side prompt caching interacts with them — is what distinguishes "sent every turn" (technically true) from "costs full tokens every turn" (not true, after turn 1).

## The two layers

### Layer 1 — AgentMux injects once, at agent launch

Before the provider CLI process starts, AgentMux assembles and writes a `CLAUDE.md` file (or equivalent) to the agent's working directory. This file is built from:

| Component | Source | Purpose |
|---|---|---|
| Soul | Agent definition | Core identity and behaviour instructions |
| Agent MD | Agent definition | Per-agent task instructions |
| Global memory bundles | Brain bundles (ordered) | Shared knowledge prepended to every agent |
| Skills index | Installed skills | `# Available Skills` section listing callable skills |
| Template vars | Runtime | `{{AGENT}}`, `{{DATE}}`, `{{WORKING_DIR}}` substituted at write time |

Source: `agentmux-srv/src/backend/agent_config.rs` `build_config_files()`, `agentmux-srv/src/server/app_api.rs` `write_agent_config_files()`.

This file is written **once per agent launch**, not once per turn. AgentMux does not call the provider's API directly — it hands the file off to the CLI and steps back.

**Startup payload (separate from the CLAUDE.md file):** On the first turn of a new session (not on `--resume`), AgentMux also sends a structured user-turn message containing runtime identity, assigned accounts, peer agents, date/version, and any custom startup instructions. This is a one-time cost, not repeated. Source: `frontend/app/view/agent/buildStartupPayload.ts`, invoked from `frontend/app/view/agent/agent-view.tsx`.

### Layer 2 — The provider CLI injects on every API call

The provider CLI reads its project instructions file from disk — `CLAUDE.md` for Claude Code, `AGENTS.md` for Codex, `GEMINI.md` for Gemini — and includes its contents as the **system prompt** on every HTTP request it makes to the provider's API. From the API's perspective, the system prompt is re-sent on every turn.

This is where prompt caching matters.

## Prompt caching and the real per-turn cost

Each provider CLI manages system prompt caching using its own provider-specific mechanism. The details below cover Claude Code, which is the most documented case. Other providers use different caching APIs with different semantics.

### Claude Code (Anthropic)

The Claude Code CLI applies `cache_control: {"type": "ephemeral"}` to the system prompt block — this is Anthropic's explicit prompt caching header (`anthropic-beta: prompt-caching-2024-07-31`). The Anthropic API caches the system prompt server-side after the first request; subsequent turns in the same session pay cache-read rates.

| Turn | Token type charged | Notes |
|---|---|---|
| Turn 1 | `cache_creation_input_tokens` | Full cost to write the cache entry |
| Turn 2+ | `cache_read_input_tokens` | ~10× cheaper than full input tokens |

AgentMux tracks all three token types — `input_tokens`, `cache_creation_input_tokens`, and `cache_read_input_tokens` — in `TokenCounts` (`agentmux-srv/src/backend/types.rs`) and sums them to show real context size. The correct formula is:

```
real_context_tokens = input_tokens + cache_creation_input_tokens + cache_read_input_tokens
```

Source: `frontend/app/view/agent/claude-translator.ts` (token accumulation), `docs/specs/SPEC_CONTEXT_VISIBILITY_2026_06_17.md`.

### Codex (OpenAI)

OpenAI applies prompt caching automatically for inputs over 1,024 tokens — no explicit header is required. Common prompt prefixes are cached server-side; the cost reduction is reflected in the `cached_tokens` field of the usage response. AgentMux does not currently surface Codex cache token counts separately.

### Gemini (Google)

Gemini supports context caching via a separate explicit API call (not an in-request header). The Gemini CLI manages this internally. Token cost reporting follows Gemini's usage response format, which differs from Anthropic's.

## What makes AgentMux's system prompt larger than a bare CLI session

A standard `claude` CLI session uses whatever CLAUDE.md files it finds in the project directory hierarchy. AgentMux replaces that with its assembled file, which bundles soul + memory bundles + skills index on top of the agent's own instructions. The assembled file is typically larger than a bare project's CLAUDE.md.

Practical implications:

- **Turn 1 is more expensive** — the cache-write covers a larger payload.
- **Per-turn cost (turn 2+) is the same model** — cache-read is cache-read regardless of size (though larger = more cache-read tokens).
- **Cache invalidation resets the cost to turn-1 levels** — see below.

## Cache invalidation: when turn-1 cost recurs

The provider's cached system prompt entry is invalidated whenever the system prompt content changes. For AgentMux agents, this happens when:

- The agent's soul, agentmd, or memory bundle content is edited
- A memory bundle is added to or removed from the agent
- The skills index changes (skill installed/removed)
- A new session is started without `--resume` (the session ID changes, and the CLI opens a fresh context)
- The working directory changes (affects `{{WORKING_DIR}}` substitution)

On invalidation, turn 1 of the next session pays full `cache_creation_input_tokens` again.

## Conversation history ownership

AgentMux does **not** accumulate or re-send conversation history. History ownership depends on the controller type:

- **`persistent` (Claude Code):** The CLI subprocess stays alive between turns and owns the `messages` array for the session. AgentMux communicates via PTY stdin and reads structured events from stdout — it never reconstructs or replays history.
- **`subprocess` (Codex, Gemini, others):** A fresh CLI process is spawned per turn. The provider's API holds session state server-side (via a session or thread ID), so history is not re-sent by the client on each turn either — it is referenced by ID.

In both cases AgentMux itself never holds or replays the conversation history.

Context compaction (automatic truncation when the context window fills up) is handled entirely inside the CLI. AgentMux detects compaction by watching for a large drop in the reported token count in the CLI's output stream, but does not trigger or control it.

Compaction threshold for Claude Code CLI: `contextWindow - 33,000` tokens.

## Provider summary

| Provider | API call maker | Caching applied | History owner | AgentMux API calls |
|---|---|---|---|---|
| Claude Code CLI | CLI subprocess | Yes (`prompt-caching-2024-07-31`) | CLI subprocess | None |
| Codex CLI | CLI subprocess | Yes (provider-side) | CLI subprocess | None |
| Gemini CLI | CLI subprocess | Yes (provider-side) | CLI subprocess | None |

AgentMux makes zero direct HTTP calls to any AI provider API. All provider interaction flows through the CLI subprocess via PTY.

## See also

- [Provider CLI integration](/internals/provider-cli-integration/) — how the CLI subprocess is spawned, PTY mechanics, and per-provider launch arguments
- [Memory bundles](/memory/) — how memory bundle content is assembled and ordered
- [Agent App API](/internals/agent-app-api/) — the API surface available to running agents
- [Environment variable contract](/internals/env-vars/) — env vars injected into the agent PTY at launch
