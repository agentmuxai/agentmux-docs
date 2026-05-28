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

## Per-channel auth-dir isolation

AgentMux sets each provider's `authConfigDirEnvVar` to a subdirectory under the channel's data dir at `<data-dir>/config/` (where `<data-dir>` is `~/.agentmux/channels/<channel>/` — `stable` for installed and released portable, `dev-portable-<branch>` for local `task package` builds, `dev-<branch>` for `task dev`). For example, on the `stable` channel:

```
~/.agentmux/channels/stable/config/auth/claude/
~/.agentmux/channels/stable/config/auth/codex/
~/.agentmux/channels/stable/config/auth/gemini/
…
```

See [Data layout](/internals/data-layout/) for the broader channels model. The short version: every AgentMux build within a channel shares the same data dir (and therefore the same auth dirs), and different channels are isolated.

Per-provider:

| Provider | Env var | Resolves to |
|---|---|---|
| Claude Code | `CLAUDE_CONFIG_DIR` | `<data-dir>/config/auth/claude/` |
| Codex CLI | `CODEX_HOME` | `<data-dir>/config/auth/codex/` |
| Gemini CLI | `GEMINI_CLI_HOME` | `<data-dir>/config/auth/gemini/` |
| OpenClaw | `OPENCLAW_HOME` | `<data-dir>/config/auth/openclaw/` |
| Kimi Code CLI | `KIMI_SHARE_DIR` | `<data-dir>/config/auth/kimi/` |
| GitHub Copilot CLI | `COPILOT_HOME` | `<data-dir>/config/auth/copilot/` |
| Pi | `PI_HOME` | `<data-dir>/config/auth/pi/` |

The `authDirName` field in `PROVIDERS` is what becomes the subdirectory name (`claude`, `codex`, `gemini`, `openclaw`, `kimi`, `copilot`, `pi` respectively).

### Why isolate

Without isolation, running an installed AgentMux and a `task dev` build on the same machine would mean both writing to the same `~/.claude/` (or equivalent) directory. Auth tokens, account state, and dictionary downloads would collide.

With per-channel isolation:

- The `stable` channel keeps its Claude OAuth token while a `dev-<branch>` build does its own login flow against a separate auth dir.
- `task dev` from a feature branch gets its own auth state — login flows in the dev build don't disturb the installed build.
- Two simultaneous portables of the same channel share auth state because they share the data dir. They're separate [instances](/glossary/#instance) (separate process trees) but one shared on-disk auth set per channel — there's only one set of provider tokens worth tracking per channel.

## Identity bundles vs auth-dir isolation

These are independent layers:

- **Auth-dir isolation** is per-instance and provider-scoped. It separates v1's Claude state from v2's Claude state.
- **[Identity bundles](/identity/)** are per-agent-instance and selectable at launch. They override or extend the ambient auth — e.g., "for this agent, use the *work* GitHub PAT, not the ambient one."

You can run two agents inside the same AgentMux instance with different Identity bundles. Both share the same provider auth dirs (auth-dir isolation is per AgentMux instance, not per agent), but the env vars AgentMux injects per agent at spawn override per-account-scoped credentials.

## Pre-launch OAuth panel

The Launch Agent modal gates the **Launch** button on completed provider auth. If you select a provider that requires OAuth (or an API key) and you aren't authenticated yet, a **Pre-Launch Auth Panel** appears inline in the modal — between the provider/identity dropdowns and the Launch button — with one of four states:

| State | What you see |
|---|---|
| **Unauthenticated / Expired** | A "Connect with [Provider]" button, e.g. *Connect to Claude Code*. Hint: "Opens browser → [Provider] login → returns to AgentMux." |
| **Waiting** | "🔐 Waiting for OAuth…" with the auth URL (copyable) and a paste field to drop the redirect URL manually if the browser doesn't auto-open. Cancel button included. |
| **Ready** | Green banner: "✓ Connected. Ready to launch." Launch button enables. |
| **Failed** | Red error banner with a Retry button. |

Internally the panel calls `auth.start` over RPC, which spawns the provider's CLI (`claude auth login` / `codex login` / etc.) under the per-version auth-dir env vars described above. The browser-based OAuth flow runs against that subprocess; the panel polls `auth.poll` once per second until the CLI reports success.

For API-key providers (OpenClaw, Kimi, Pi), there is no browser; the panel either accepts a pasted key inline or, for Copilot's device-code path, displays a verification URL and one-time code.

### Session-scoped today, bundle-scoped later

In the current release (Phase B), a successful OAuth completion authenticates the **session** — the agent that's about to launch can use the credentials, but they are **not yet persisted into an Identity bundle**. The Identity dropdown stays on the blank singleton, and the next launch repeats the OAuth flow.

Persistent bundle storage ("log in once, reuse across launches") is **Phase C** — still in design. Once it lands, completing the panel's OAuth will create or update a `db_identity_bundles` row and let you reuse the credentials by selecting the bundle on subsequent launches. Track progress against `SPEC_OAUTH_IN_IDENTITY_BUNDLES_2026_05_13.md` in the main repo.

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
