---
title: "Auth flows"
description: Per-provider auth model — OAuth vs API key — and how AgentMux isolates each provider's auth dir per instance.
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

AgentMux supports seven providers (`claude`, `codex`, `gemini`, `openclaw`, `kimi`, `copilot`, `pi`). Each ships with its own auth model and its own auth-config directory. AgentMux **isolates** these per AgentMux instance so that two instances on the same machine — different versions, dev + portable, two portables — never share auth state.

The canonical source is `frontend/app/view/agent/providers/index.ts:PROVIDERS`. Each entry has an `authType`, `authCheckCommand`, `authLoginCommand`, and `authConfigDirEnvVar`.

## Per-provider summary

| Provider | `authType` | Login command | Auth config dir env var |
|---|---|---|---|
| Claude Code | `oauth` | `claude auth login` | `CLAUDE_CONFIG_DIR` |
| Codex CLI | `oauth` | `codex login` | `CODEX_HOME` |
| Gemini CLI | `oauth` | `gemini auth login` | `GEMINI_CLI_HOME` (+ `GEMINI_FORCE_FILE_STORAGE=true`) |
| OpenClaw | `api-key` | `openclaw onboard` | `OPENCLAW_HOME` |
| Kimi Code CLI | `api-key` | `kimi login` | `KIMI_SHARE_DIR` |
| GitHub Copilot CLI | `oauth` | `copilot auth login` | `COPILOT_HOME` |
| Pi | `api-key` | `pi config` | `PI_HOME` |

## OAuth providers

Four providers (Claude, Codex, Gemini, Copilot) use OAuth as the primary auth path. The first time you launch an agent of these providers (or run the CLI manually), the provider's CLI walks you through a browser-based login flow. The resulting token is stored under the provider's auth-config dir.

For Claude / Codex / Gemini, an `*_API_KEY` env var (`CLAUDE_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`) is also accepted as a fallback. OAuth is the recommended primary; the env-var fallback exists for headless or automation contexts.

## API-key providers

Three providers (OpenClaw, Kimi, Pi) use API keys, configured by their own login subcommand. The key is stored under the provider's auth-config dir.

## Per-instance auth-dir isolation

AgentMux sets each provider's `authConfigDirEnvVar` to a per-instance subdirectory under `<instance>/config/` (where `<instance>` is `~/.agentmux/versions/<version>/` for installed/portable, or `~/.agentmux/dev/<branch>/` for `task dev`). For example, in a v0.33.733 portable instance:

```
~/.agentmux/versions/0.33.733/config/auth/claude/
~/.agentmux/versions/0.33.733/config/auth/codex/
~/.agentmux/versions/0.33.733/config/auth/gemini/
…
```

Per-provider:

| Provider | Env var | Resolves to |
|---|---|---|
| Claude Code | `CLAUDE_CONFIG_DIR` | `<instance>/config/auth/claude/` |
| Codex CLI | `CODEX_HOME` | `<instance>/config/auth/codex/` |
| Gemini CLI | `GEMINI_CLI_HOME` | `<instance>/config/auth/gemini/` |
| OpenClaw | `OPENCLAW_HOME` | `<instance>/config/auth/openclaw/` |
| Kimi Code CLI | `KIMI_SHARE_DIR` | `<instance>/config/auth/kimi/` |
| GitHub Copilot CLI | `COPILOT_HOME` | `<instance>/config/auth/copilot/` |
| Pi | `PI_HOME` | `<instance>/config/auth/pi/` |

The `authDirName` field in `PROVIDERS` is what becomes the subdirectory name (`claude`, `codex`, `gemini`, `openclaw`, `kimi`, `copilot`, `pi` respectively).

### Why isolate

Without isolation, running two AgentMux instances of different versions side-by-side would mean both instances writing to the same `~/.claude/` (or equivalent) directory. Auth tokens, account state, and dictionary downloads would collide.

With isolation:

- v0.33.732 portable can keep its Claude OAuth token while you test v0.33.733 with a fresh login.
- `task dev` from a feature branch gets its own auth state — login flows in the dev build don't disturb the installed build.
- Two simultaneous portables of the same version share state (because they share the instance dir), which is the right answer because they're the same logical instance.

## Identity bundles vs auth-dir isolation

These are independent layers:

- **Auth-dir isolation** is per-instance and provider-scoped. It separates v1's Claude state from v2's Claude state.
- **[Identity bundles](/identity/)** are per-agent-instance and selectable at launch. They override or extend the ambient auth — e.g., "for this agent, use the *work* GitHub PAT, not the ambient one."

You can run two agents inside the same AgentMux instance with different Identity bundles. Both share the same provider auth dirs (auth-dir isolation is per AgentMux instance, not per agent), but the env vars AgentMux injects per agent at spawn override per-account-scoped credentials.

## Manual login

If you need to log in outside an Agent pane, set the env var first:

```bash
export CLAUDE_CONFIG_DIR=~/.agentmux/versions/0.33.733/config/auth/claude
claude auth login
```

This is rarely needed — opening an Agent pane and using the agent normally is enough; AgentMux handles the env var for you.

## See also

- [First Agent Setup](/first-agent/) — initial provider install and login
- [Identity bundles](/identity/) — per-agent credential selection
- [Multi-instance & dev mode](/multi-instance/) — instance-dir layout
- [Settings reference](/settings/) — full env var list
