---
title: "Auth flows"
description: Per-provider auth model — OAuth vs API key — and how AgentMux stores provider credentials account-wide under shared/providers/.
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

AgentMux supports seven providers (`claude`, `codex`, `gemini`, `openclaw`, `kimi`, `copilot`, `pi`). Each ships with its own auth model and its own auth-config directory. Provider credentials are stored **account-wide** under `~/.agentmux/shared/providers/<provider>/` — they persist across channel upgrades and are shared when running multiple instances on the same machine.

The canonical source is `frontend/app/view/agent/providers/index.ts:PROVIDERS`. Each entry has an `authType`, `authCheckCommand`, `authLoginCommand`, and `authConfigDirEnvVar`.

## Trust Center: Accounts tab

The primary UI for managing provider credentials is the **Accounts tab** inside [Trust Center](/trust-center/) (hamburger menu ≡ → Trust Center → Accounts).

Each service shows as a tile with its current connection status. Click a tile to connect, reconnect, or revoke:

- **OAuth providers** — clicking **Connect** opens a PKCE or Device Flow browser login. The token is stored in the OS keychain or the provider's auth-config dir and validated on load (expired tokens show a ⚠ badge).
- **API key providers** — clicking **Connect** opens an inline key field. The key is validated against the live service before saving.

The Accounts tab is the replacement for managing credentials through the pre-launch modal alone. Credentials stored here are reused across launches without re-authenticating.

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

## Auth-config dir storage

AgentMux sets each provider's `authConfigDirEnvVar` to a subdirectory under the account-wide shared directory:

```
~/.agentmux/shared/providers/claude/
~/.agentmux/shared/providers/codex/
~/.agentmux/shared/providers/gemini/
…
```

Credentials at this path persist across channel upgrades and are shared across all channels and instances on the same machine — authenticate once and every AgentMux build picks up the same tokens.

Per-provider:

| Provider | Env var | Resolves to |
|---|---|---|
| Claude Code | `CLAUDE_CONFIG_DIR` | `~/.agentmux/shared/providers/claude/` |
| Codex CLI | `CODEX_HOME` | `~/.agentmux/shared/providers/codex/` |
| Gemini CLI | `GEMINI_CLI_HOME` | `~/.agentmux/shared/providers/gemini/` |
| OpenClaw | `OPENCLAW_HOME` | `~/.agentmux/shared/providers/openclaw/` |
| Kimi Code CLI | `KIMI_SHARE_DIR` | `~/.agentmux/shared/providers/kimi/` |
| GitHub Copilot CLI | `COPILOT_HOME` | `~/.agentmux/shared/providers/copilot/` |
| Pi | `PI_HOME` | `~/.agentmux/shared/providers/pi/` |

The `authDirName` field in `PROVIDERS` is what becomes the subdirectory name (`claude`, `codex`, `gemini`, `openclaw`, `kimi`, `copilot`, `pi` respectively).

### Historical note

Prior to v0.45, credentials were stored per-channel under `~/.agentmux/channels/<channel>/config/auth/<provider>/`. This required re-authentication when switching channels (e.g. `stable` → `dev-portable-<branch>`) even though the underlying account hadn't changed. Moving credentials to the account-wide `shared/providers/` path fixed this regression — a single OAuth login is now valid across all channels and versions on the same machine.

## Identity bundles vs provider credentials

These are independent layers:

- **Provider credentials** (the auth-config dirs above) are account-wide and provider-scoped. Every instance on the same machine shares them.
- **[Identity bundles](/identity/)** are per-agent and selectable at launch. They override or extend the ambient credentials — e.g., "for this agent, use the *work* GitHub PAT, not the ambient one."

You can run two agents inside the same AgentMux instance with different Identity bundles. Both share the same account-wide provider auth dirs, but the env vars AgentMux injects per agent at spawn can override the shared credentials.

## Pre-launch OAuth panel

The Launch Agent modal gates the **Launch** button on completed provider auth. If you select a provider that requires OAuth (or an API key) and you aren't authenticated yet, a **Pre-Launch Auth Panel** appears inline in the modal — between the provider/identity dropdowns and the Launch button — with one of four states:

| State | What you see |
|---|---|
| **Unauthenticated / Expired** | A "Connect with [Provider]" button, e.g. *Connect to Claude Code*. Hint: "Opens browser → [Provider] login → returns to AgentMux." |
| **Waiting** | "🔐 Waiting for OAuth…" with the auth URL (copyable) and a paste field to drop the redirect URL manually if the browser doesn't auto-open. Cancel button included. |
| **Ready** | Green banner: "✓ Connected. Ready to launch." Launch button enables. |
| **Failed** | Red error banner with a Retry button. |

Internally the panel calls `auth.start` over RPC, which spawns the provider's CLI (`claude auth login` / `codex login` / etc.) under the auth-config-dir env vars described above. The browser-based OAuth flow runs against that subprocess; the panel polls `auth.poll` once per second until the CLI reports success.

For API-key providers (OpenClaw, Kimi, Pi), there is no browser; the panel either accepts a pasted key inline or, for Copilot's device-code path, displays a verification URL and one-time code.

### Session-scoped today, bundle-scoped later

In the current release (Phase B), a successful OAuth completion authenticates the **session** — the agent that's about to launch can use the credentials, but they are **not yet persisted into an Identity bundle**. The Identity dropdown stays on the blank singleton, and the next launch repeats the OAuth flow.

Persistent bundle storage ("log in once, reuse across launches") is **Phase C** — still in design. Once it lands, completing the panel's OAuth will create or update a `db_identity_bundles` row and let you reuse the credentials by selecting the bundle on subsequent launches. Track progress against `SPEC_OAUTH_IN_IDENTITY_BUNDLES_2026_05_13.md` in the main repo.

## Manual login

If you need to log in outside an Agent pane, set the env var first:

```bash
export CLAUDE_CONFIG_DIR=~/.agentmux/shared/providers/claude
claude auth login
```

This is rarely needed — opening an Agent pane and using the agent normally is enough; AgentMux handles the env var for you.

## See also

- [First Agent Setup](/first-agent/) — initial provider install and login
- [Identity bundles](/identity/) — per-agent credential selection
- [Multi-instance & dev mode](/multi-instance/) — instance-dir layout
- [Settings reference](/settings/) — full env var list
