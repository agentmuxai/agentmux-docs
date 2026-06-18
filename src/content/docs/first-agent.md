---
title: "First Agent Setup"
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

This guide walks through what it means for an agent to be first-class in AgentMux. Each agent gets its own structured pane — not a terminal wrapper — with a real identity bundle, a memory bundle, a streaming parser, and a lifecycle. AgentMux supports seven providers: `claude`, `codex`, `gemini`, `openclaw`, `kimi`, `copilot`, and `pi`. The full list lives in `frontend/app/view/agent/providers/index.ts:PROVIDERS` in the main repo.

## You don't need to preinstall the agent CLIs

AgentMux is self-contained. Pick a provider in the Agent picker and — if the CLI isn't already in AgentMux's per-version cache — an **install modal** opens inline, runs the install for you, and streams the output in an xterm panel. Click **Install now** to start, **Continue to Launch** when it finishes. The cached binary is reused on subsequent launches for the same AgentMux version.

| Provider | Package | Install path |
|---|---|---|
| **Claude Code** | `@anthropic-ai/claude-code` | Auto-installed (npm) |
| **Codex CLI** | `@openai/codex` | Auto-installed (npm, pinned) |
| **Gemini CLI** | `@google/gemini-cli` | Auto-installed (npm, pinned) |
| **OpenClaw** | `openclaw` | Auto-installed (npm) |
| **GitHub Copilot CLI** | `@github/copilot` | Auto-installed (npm) |
| **Pi** | `@mariozechner/pi-coding-agent` | Auto-installed (npm) |
| **Kimi Code CLI** | `kimi-cli` (pip) | Manual today — `pip install kimi-cli`. In-app auto-install for pip-based providers is on the roadmap. |

### System prerequisites

A handful of providers (Claude Code, OpenClaw) need `git` available on your `PATH` at runtime. If it's missing when you launch, AgentMux opens a separate **prereq modal** with the upstream install link — install it on your machine, click **Refresh**, and proceed.

### Auth happens inline too

After the install completes (or immediately, when the CLI is already cached), AgentMux runs the provider's login flow inside the Launch modal via the **Pre-Launch Auth Panel** — OAuth in your browser for Claude / Codex / Gemini / Copilot, an inline key field for OpenClaw / Pi / Kimi. AgentMux isolates each provider's auth config to a per-channel subdirectory using the provider's own `*_HOME` / `*_CONFIG_DIR` environment variable. See [Auth flows](/auth/) for the per-provider isolation map and OAuth state diagram.

## Configure an Agent via Memory bundles

1. Open an agent pane: `Cmd+Shift+A` / `Alt+Shift+A`, or click the **Agent** icon in the top bar.
2. Open the agent pane's settings panel (cog icon in the pane header) and switch to the **Memory** tab.
3. Click **+ New Memory** to create a new bundle (or pick an existing one to edit).
4. Fill in the bundle configuration:

### Basic Settings

| Field | Description |
|-------|-------------|
| **Name** | A human-readable name (e.g., `backend-claude`) |
| **Provider** | Claude Code, Codex CLI, Gemini CLI, OpenClaw, Kimi Code CLI, GitHub Copilot CLI, or Pi |
| **Model** | Model identifier passed to the provider. The picker is provider-aware — selecting Claude Code shows Claude models (opus, sonnet, haiku), Codex shows gpt-5.x models, etc. |
| **Working Directory** | The project directory the agent works in |

### Provider Command

Each provider ships with default launch arguments tuned for non-interactive multi-turn use. The full set lives in `PROVIDERS[id].launchArgs`:

```
Claude Code:        claude -p --output-format stream-json --verbose --include-partial-messages --dangerously-skip-permissions
Codex CLI:          codex exec --json --dangerously-bypass-approvals-and-sandbox -
Gemini CLI:         gemini --output-format stream-json --yolo -p ""
OpenClaw:           acpx --agent openclaw
Kimi Code CLI:      kimi --print --output-format stream-json --yolo -p ""
GitHub Copilot CLI: copilot --acp
Pi:                 pi --json
```

Three providers (OpenClaw, Copilot, Pi) use the Agent Client Protocol (ACP) over stdio; the others use streaming-JSON modes specific to each CLI. AgentMux's controller layer abstracts the difference. You can override `launchArgs` per Memory bundle.

### Bundle Content

A Memory bundle holds four kinds of content per agent:

- **Soul** — The agent's system prompt and personality. Defines how the agent behaves and what it prioritizes.
- **Instructions** — Project-specific instructions (equivalent to `CLAUDE.md` or similar). Loaded into the agent's context on launch.
- **MCP** — Model Context Protocol server configuration. Add tools the agent can use (filesystem access, GitHub, databases, etc.).
- **Env** — Environment variables passed to the agent process. Use this for API keys, feature flags, and project-specific config.

## Launch the Agent

Open the Launch Agent modal (the same one you reach from the Agent picker). The picker is **two-tier**:

- **My Agents** appears on top — every agent you've already created, sorted by recency. This is the fast path for re-launching something you've used before.
- **+ New from template** below — opens the template gallery for spinning up a fresh agent. Templates are hidden until you explicitly open them (they were Phase-1 friction noise when the My Agents list grew).

The modal also has a **Recent sessions** tab — re-attach to a prior conversation in a specific agent instead of starting a fresh turn. Useful when you closed a pane and want to pick up where you left off; the agent's history loads in the new pane and you continue from that point.

Pick your Memory bundle (or accept the one the agent already has), optionally pick an [Identity bundle](/identity/) for credentials, and click **Launch**. A new agent pane opens in your workspace.

The agent pane shows:

- **Streaming output** — Text as the agent generates it
- **Tool calls** — Each tool invocation with name and arguments
- **File diffs** — Side-by-side diffs when the agent modifies files
- **Status** — Active, idle, or completed
- **Disconnected banner** — surfaces if the WebSocket drops mid-turn; click to reconnect

## Sending shell commands directly

Prefix any message in the composer with `!cmd` to run it as a shell command in the agent's working directory instead of sending it to the model. Useful for quick checks without leaving the pane:

```
!cmd git status
!cmd cat .env.example
!cmd ls -la dist/
```

The output streams into the pane thread like a tool result.

## AskUserQuestion

Agents can pause and ask you a question via the **AskUserQuestion panel** — an interactive prompt that appears inline in the pane above the composer. Answer directly and submit; the agent resumes automatically. If the agent stalls after receiving your answer, AgentMux auto-resumes it after a short delay.

## When an agent fails

AgentMux classifies failures so you know exactly what happened and what to do:

| Error class | What you see | Recovery |
|---|---|---|
| **Auth** | Red banner — credentials rejected or expired | **Re-authenticate** button opens the inline OAuth / key flow — no restart |
| **Rate limit** | Banner with estimated retry delay | Auto-retries after the delay (5 s default) |
| **OOM / memory** | Banner — model exceeded memory budget | Start a fresh session or reduce attached context |
| **Context overflow** | Banner — context window full | Summarize and continue in a new turn |
| **Crash** | Banner with crash class | **Restart** button; the prior partial turn is preserved |

## Agent Types

### Host Agents

Run directly on your machine. The agent CLI process spawns as a child process with access to your local filesystem and tools.

### Container Agents

Run inside Docker containers. AgentMux connects to the container and manages the agent lifecycle. Useful for isolated environments or when agents need specific toolchains.

### Import from Claw

If you use [Claw](https://github.com/a5af/claw) for container agent management, you can import existing agent configurations directly into Memory bundles. Click **Import from Claw** in the empty state or from the Memory pane's header menu.

## Skills

Each agent can have custom skills — reusable prompt templates, commands, workflows, or MCP tool configurations. Manage skills from the Memory bundle's detail view under the **Skills** tab.

Skill types:

| Type | Description |
|------|-------------|
| `prompt` | A reusable prompt template |
| `command` | A shell command or script |
| `workflow` | A multi-step sequence |
| `mcp-tool` | An MCP tool configuration |

## Next Steps

- [Memory bundles](/memory/) — full bundle reference (provider, model, instructions, MCP, skills)
- [Pane Types](/pane-types) — All pane types including agent panes
- [Configuration](/config) — Global and per-agent settings
