---
title: "Auth flows"
description: Per-provider auth model — OAuth vs API key — and how AgentMux stores provider credentials account-wide under shared/providers/.
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

AgentMux supports nine providers (`claude`, `codex`, `muxcode`, `gemini`, `qwen`, `kimi`, `openclaw`, `pi`, `copilot`). Each ships with its own auth model and its own auth-config directory. A plain agent spawn (no Armory Account explicitly bound) always authenticates via each provider's **ambient** auth-config dir under `~/.agentmux/shared/providers/<provider>/` — unconditionally account-wide, persisting across channel upgrades and shared across every instance on the machine, regardless of channel.

Provider credentials connected through the Armory's **Accounts tab** (as opposed to the ambient path above) follow a different, conditional rule as of a more recent change — see [Isolated auth by channel](#isolated-auth-by-channel) below before assuming "account-wide" applies unconditionally to everything on this page.

`muxcode` ("Mux Code") is AgentMux's own first-party agentic coding CLI (npm: `@agentmuxai/muxcode`); it emits Claude-compatible stream-json output, so it reuses the Claude translator internally.

The canonical source is `frontend/app/view/agent/providers/index.ts:PROVIDERS`. Each entry has an `authType`, `authCheckCommand`, `authLoginCommand`, and `authConfigDirEnvVar`.

## Armory: Accounts tab

The primary UI for managing provider credentials is the **Accounts tab** inside the [Armory](/armory/) (hamburger menu ≡ → Armory → Accounts).

Each service shows as a tile with its current connection status. Click a tile to connect, reconnect, or revoke:

- **OAuth providers** — clicking **Connect** opens a PKCE or Device Flow browser login. The resulting token is stored in a per-account credential directory under `~/.agentmux/shared/identities/<account_id>/<provider>/` (distinct from the ambient `shared/providers/<provider>/` path described above — this one belongs to a specific Armory Account, and its storage location follows the conditional [Isolated auth by channel](#isolated-auth-by-channel) rule, not the always-global ambient path) and validated on load (expired tokens show a ⚠ badge).
- **API key providers** — clicking **Connect** opens an inline key field. The key is validated against the live service before saving.

The Accounts tab manages the underlying provider tokens. These tokens persist in the auth-config dir and are validated on each launch — if a stored token is valid, no re-authentication is needed. This is separate from [Identity bundles](/identity/), which are session-scoped in the current release (Phase B): completing OAuth through the Pre-Launch panel doesn't yet persist the credentials into a named bundle. See the [Pre-launch OAuth panel](#pre-launch-oauth-panel) section below.

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

:::note
Two additional providers (`muxcode`, `qwen`) exist in the current provider registry but aren't yet reflected in this table — their exact `authType`/login command/env var weren't re-verified for this pass. Check `frontend/app/view/agent/providers/index.ts:PROVIDERS` for the authoritative current values.
:::

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

Credentials at this path persist across channel upgrades and are shared across all channels and instances on the same machine — authenticate once and every AgentMux build picks up the same tokens. This is the **ambient default** path (`provider_auth_dir()`) — unconditionally global, what a plain agent spawn with no Armory Account bound to it always uses. It is not affected by the isolated-auth default described next.

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

### Isolated auth by channel

The ambient path above is always global. **Explicitly-bound Armory Accounts are not, as of a more recent change:** on any channel other than `stable` — a `dev-<branch>` `task dev` build, or a local `task package` build's per-build `local-<branch>-<hash>-<build-id>` channel — AgentMux now **defaults to an isolated, per-channel Armory account list**. A fresh non-`stable` channel starts with **zero** Armory accounts; connecting one there, or binding one to an agent, only affects that channel's own isolated store, not the machine-wide one.

- **`stable` is unaffected** — it always shares the full, account-wide list, exactly as before this default changed.
- **Plain agent spawns are unaffected regardless of channel** — an agent with no Armory Account bound to it always resolves auth via the ambient `provider_auth_dir()` path above, which stays global no matter what. This isolation default only matters once an agent is explicitly bound to an Armory Account (see [Identity bundles](/identity/)).
- **Override:** `AGENTMUX_ISOLATED_AUTH=1` forces isolation even on `stable`; `AGENTMUX_ISOLATED_AUTH=0` forces the old global-sharing behavior on a non-`stable` channel. The explicit env var always wins over the channel-based default.

See `docs/specs/SPEC_ISOLATED_AUTH_DEFAULT_BY_CHANNEL_2026_08_06.md` in the main repo for the full rationale (it exists so dev/local builds actually exercise real login/relogin code paths instead of silently inheriting a fully-authenticated global session). [Identity & Accounts](/identity/#persistence) and [Armory](/armory/#accounts) cover the same conditional default from the account-binding and Armory-UI angles respectively; [Multi-instance & dev mode](/multi-instance/) covers it from the per-channel-isolation angle.

### Historical note

Prior to v0.45, credentials were stored per-channel under `~/.agentmux/channels/<channel>/config/auth/<provider>/`. This required re-authentication when switching channels (e.g. `stable` → `local-<branch>`) even though the underlying account hadn't changed. Moving credentials to the account-wide `shared/providers/` path fixed this regression — a single OAuth login is now valid across all channels and versions on the same machine.

## Identity bundles vs provider credentials

These are independent layers:

- **Ambient provider credentials** (the `provider_auth_dir()` auth-config dirs above) are account-wide, provider-scoped, and always global. Every instance on the same machine shares them, regardless of channel.
- **[Identity bundles](/identity/)** (Armory Accounts, bound to an agent) are per-agent and selectable at launch. They override or extend the ambient credentials — e.g., "for this agent, use the *work* GitHub PAT, not the ambient one." Unlike the ambient path, these follow the conditional [Isolated auth by channel](#isolated-auth-by-channel) default — shared on `stable`, isolated per-channel by default elsewhere.

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

In the current release (Phase B), a successful OAuth completion via the Pre-Launch panel **does not create an Identity bundle**. The Identity dropdown stays on the blank singleton. On the next launch, the pre-launch panel will still show **Connected** (the provider token persisted in `shared/providers/` is valid), but no named Identity bundle exists to select — you can't hand this credential set to a different agent by name.

Persistent bundle storage (named Identity bundles created from the panel's OAuth completion) is **Phase C** — still in design. Once it lands, completing the panel's OAuth will create or update a `db_identity_bundles` row and let you reuse the credentials by selecting the bundle on subsequent launches. Track progress against `SPEC_OAUTH_IN_IDENTITY_BUNDLES_2026_05_13.md` in the main repo.

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
