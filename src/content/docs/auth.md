---
title: "Auth flows"
description: Per-provider sign-in (OAuth vs API key), how AgentMux runs each CLI's login, and where it keeps provider credentials.
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

AgentMux supports ten providers: `claude`, `codex`, `muxcode`, `gemini`, `qwen`, `kimi`, `openclaw`, `pi`, `copilot` and `antigravity`. Each provider's CLI does its own sign-in and keeps its own credentials. AgentMux doesn't implement those logins: it runs the CLI's own login command and points the CLI at a config directory AgentMux manages, through the environment variable that CLI already supports (for example `CLAUDE_CONFIG_DIR` or `CODEX_HOME`).

`muxcode` ("Mux Code") is AgentMux's own agentic coding CLI (npm: `@agentmuxai/muxcode`). It emits Claude-compatible stream-JSON, so AgentMux reuses the Claude translator for it.

The per-provider values come from `frontend/app/view/agent/providers/catalog.ts` (`PROVIDERS`: `authType`, `authCheckCommand`, `authLoginCommand`, `authConfigDirEnvVar`) and `agentmux-srv/src/backend/providers.rs`.

## Per-provider summary

| Provider | `authType` | Login command AgentMux runs | Config dir env var |
|---|---|---|---|
| Claude Code | `oauth` | `claude auth login` | `CLAUDE_CONFIG_DIR` |
| Codex CLI | `oauth` | `codex login` | `CODEX_HOME` |
| Mux Code | `api-key` | `muxcode auth login` | `MUXCODE_CONFIG_DIR` |
| Gemini CLI | `oauth` | `gemini auth login` | `GEMINI_CLI_HOME` (plus `GEMINI_FORCE_FILE_STORAGE=true`) |
| Qwen Code | `api-key` | `qwen auth` | `QWEN_HOME` |
| Kimi Code CLI | `api-key` | `kimi login` | `KIMI_SHARE_DIR` |
| OpenClaw | `oauth` | `openclaw models auth login --provider openai-codex` | `OPENCLAW_HOME` |
| GitHub Copilot CLI | `oauth` | `copilot auth login` | `COPILOT_HOME` |
| Pi | `api-key` | `pi config` | `PI_HOME` |
| Antigravity (AGY) | `oauth` | `agy auth login` | `ANTIGRAVITY_CONFIG_DIR` (plus `ANTIGRAVITY_FORCE_FILE_STORAGE=true`) |

AgentMux checks whether a CLI is signed in by running its own status command (for example `claude auth status --json` or `codex login status`).

## OAuth providers

Six providers use a browser login: Claude Code, Codex CLI, Gemini CLI, OpenClaw, GitHub Copilot CLI and Antigravity. OpenClaw's login is OpenAI's "Sign in with ChatGPT" flow, because OpenClaw uses Codex as its backing model. OpenClaw also needs its own Gateway daemon running; `openclaw onboard` sets that up.

AgentMux does not pass an API-key environment variable to these CLIs as a fallback. If you want one of them to use an API key instead, configure that in the CLI yourself.

## API-key providers

Four providers are configured with their own CLI's login or config command and a key: Mux Code, Qwen Code, Kimi Code CLI and Pi. Mux Code also counts as signed in when a local model is installed; its `auth login` pulls a default local model when nothing is configured. Qwen Code talks to an OpenAI-compatible endpoint (for example OpenRouter), set through `OPENAI_BASE_URL`, `OPENAI_API_KEY` and `OPENAI_MODEL`.

## Signing in from an agent pane

When an agent pane launches, AgentMux runs the CLI's auth check. If it fails, the pane shows **Not signed in** with **Log in**, **Login via terminal**, and **Armory → Accounts** (or **Bind** when an existing account for the provider can be linked). See [First Agent Setup](/first-agent/#sign-in).

**Log in** goes through `frontend/app/view/agent/flows/run-provider-login.ts` (`runProviderLogin`):

1. For Claude Code, Codex CLI, Gemini CLI, GitHub Copilot CLI and OpenClaw, AgentMux first creates an Armory account with its own config directory and points the login there.
2. It runs the login command and looks for a login link in the CLI's output. If it finds one, it opens it in your browser. Claude Code and OpenClaw run the login in a pseudo-terminal and accept the authorization code you paste back into the pane.
3. If the CLI prints no link, AgentMux opens a terminal window for the login and waits up to 5 minutes for the CLI's auth check to succeed.
4. On success, the account is saved and linked to the agent.

For the other providers (the four API-key providers, and Antigravity), no account is created: the login writes to the ambient directory described next.

## Where credentials are stored

There are two places.

**Ambient directory.** An agent with no account bound (**(ambient credentials)** in the create dialog) points its CLI at the provider's shared directory:

```
~/.agentmux/shared/providers/claude/
~/.agentmux/shared/providers/codex/
~/.agentmux/shared/providers/gemini/
…
```

This is `DataPaths::provider_auth_dir` in `agentmux-common/src/data_paths.rs`. The subdirectory name is the provider's `authDirName` (`claude`, `codex`, `muxcode`, `gemini`, `qwen`, `kimi`, `openclaw`, `copilot`, `pi`, `antigravity`). It is account-wide: every channel, version and instance on the machine shares it.

**Account directories.** An OAuth login made through AgentMux for Claude Code, Codex CLI, Gemini CLI, GitHub Copilot CLI or OpenClaw is saved as an Armory account with its own directory, `<identities>/<account_id>/<provider>/`. When an agent is bound to such an account, AgentMux points the CLI's config-dir variable there instead of at the ambient directory. Where `<identities>` lives depends on the channel, as described next.

### Isolated auth by channel

Armory accounts are isolated per channel by default, except on `stable` (`agentmux-common/src/data_paths.rs`, `isolated_auth_enabled` and `identities_dir`):

- **`stable`** (every release build) shares one account list and one account-directory tree, `~/.agentmux/shared/identities/`.
- **Any other channel**, such as a `dev-<branch>` build from `task dev` or a local `task package` build's `local-<branch>-<hash>-<build-id>` channel, gets its own account list and keeps account directories under that channel's own directory. A fresh non-`stable` channel starts with no Armory accounts.
- **The ambient directory is never isolated.** It stays account-wide on every channel.
- **Override:** `AGENTMUX_ISOLATED_AUTH=1` forces isolation, even on `stable`. Setting the variable to any other value turns isolation off, even on a non-`stable` channel.

This exists so that dev and local builds exercise real login code paths instead of silently inheriting a signed-in global session. See [Identity & Accounts](/identity/#persistence) for how an agent's link to an account survives a channel switch, and [Multi-instance & dev mode](/multi-instance/) for channels in general.

### History

Earlier builds kept provider credentials per channel, so switching channels meant signing in again. agentmux#1291 (June 2026) moved them to the account-wide `shared/providers/` directory.

## Armory: Accounts tab

The **Accounts** tab of the [Armory](/armory/) (**≡ → Armory → Accounts**) manages accounts. It shows a tile per service: **AgentMux**, **GitHub**, **Google**, **AWS**, **OpenAI**, **Anthropic**, **Slack** and **Custom** (`frontend/app/view/accounts/accounts-catalog.ts`, `SERVICE_CATALOG`). Clicking a tile offers **Connect with OAuth**, **Add API key / token**, or both:

- **Anthropic → Connect with OAuth** runs the Claude Code login inside AgentMux.
- **GitHub** OAuth uses GitHub's device flow; **Google** and **Slack** use a PKCE browser login. None of the three ships a built-in OAuth client: you create your own OAuth app and paste its client ID (and, for Slack, its client secret).
- **AgentMux** signs in to AgentMux Cloud.
- **Add API key / token** opens the Add Account form. Keys are stored in your OS keychain by default. **Validate & Save** checks the key against the service first; this is available for GitHub, OpenAI and Anthropic keys. **Save without validating** skips the check.

Each account shows a status dot: green (valid), red (expired or invalid) or grey (unknown). For accounts created by a CLI login, the status is refreshed from the credential files each time a bound agent starts.

To bind an account to an agent, right-click it and choose **Bind to Agent**, or use the **Accounts** tab of the agent's **Stash**. When an agent bound to an API-key account starts, AgentMux sets that account's key in the agent's environment:

| Account | Environment variables |
|---|---|
| GitHub | `GITHUB_TOKEN`, `GH_TOKEN` |
| Anthropic | `ANTHROPIC_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| Kimi | `MOONSHOT_API_KEY` |
| AWS | `AWS_ACCESS_KEY_ID` |

These mappings are in `agentmux-srv/src/identity/resolver/provider.rs` (`provider_class`).

## Accounts vs the ambient directory

These are independent layers:

- **The ambient directories** are account-wide, provider-scoped and always global. Every instance on the machine shares them.
- **[Accounts](/identity/)** are bound per agent and chosen when you create it (the **Identity** field), or later with **Bind**. They override the ambient directory for that agent. Unlike the ambient directories, they follow the [Isolated auth by channel](#isolated-auth-by-channel) default.

Two agents in the same instance can use different accounts for the same provider.

## Pre-launch OAuth panel

The agent **launch dialog** contains a sign-in panel, **Connect to &lt;provider&gt;**, which creates an account and selects it. Nothing in the current agent picker opens that dialog: creating an agent from a template uses the **Create new agent from &lt;template&gt;** dialog, which has no sign-in panel, and relaunching an agent from **My Agents** launches it directly. Sign-in happens in the agent pane instead, as described in [Signing in from an agent pane](#signing-in-from-an-agent-pane).

## Manual login

You can sign a CLI in to the ambient directory yourself, outside AgentMux, by setting its config-dir variable first:

```bash
export CLAUDE_CONFIG_DIR=~/.agentmux/shared/providers/claude
claude auth login
```

Agents that use **(ambient credentials)** then pick up the login. This is rarely needed; **Log in** in the agent pane covers the usual case.

## See also

- [First Agent Setup](/first-agent/): provider install and sign-in
- [Identity & Accounts](/identity/): per-agent account binding
- [Multi-instance & dev mode](/multi-instance/): instance and channel layout
- [Settings reference](/settings/): settings and environment variables
