---
title: "Auth flows"
description: Per-provider sign-in (OAuth vs API key), how AgentMux runs each CLI's login, and where it keeps provider credentials.
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

AgentMux supports ten providers: `claude`, `codex`, `muxcode`, `gemini`, `qwen`, `kimi`, `openclaw`, `pi`, `copilot` and `antigravity`. Each provider's CLI does its own sign-in and keeps its own credentials. AgentMux doesn't implement those logins: it runs the CLI's own login command and points the CLI at a config directory AgentMux manages, through the environment variable that CLI already supports (for example `CLAUDE_CONFIG_DIR` or `CODEX_HOME`).

`muxcode` ("Mux Code") is AgentMux's own agentic coding CLI (npm: `@agentmuxai/muxcode`). It emits Claude-compatible stream-JSON, so AgentMux reuses the Claude translator for it.

The per-provider values come from `frontend/app/view/agent/providers/catalog.ts` (`PROVIDERS`: `authType`, `authCheckCommand`, `authLoginCommand`, `authConfigDirEnvVar`, `authExtraEnv`) and `agentmux-srv/src/backend/providers.rs`.

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

Five of them (Claude Code, Codex CLI, Gemini CLI, OpenClaw and GitHub Copilot CLI) are account-backed: an agent using one of them must have an Armory account bound for that provider, or AgentMux refuses to start the CLI (`provider_class` in `agentmux-srv/src/identity/resolver/provider.rs`, enforced in `inject_identity_env` in `agentmux-srv/src/identity/resolver/inject.rs`). Antigravity is marked `oauth` in the catalog but is not account-backed; it uses the ambient directory described below.

AgentMux does not pass an API-key environment variable to these CLIs as a fallback.

## API-key providers

Four providers are configured with their own CLI's login or config command and a key: Mux Code, Qwen Code, Kimi Code CLI and Pi. Mux Code also counts as signed in when a local model is installed; its `auth login` pulls a default local model when nothing is configured. Qwen Code talks to an OpenAI-compatible endpoint (for example OpenRouter), set through `OPENAI_BASE_URL`, `OPENAI_API_KEY` and `OPENAI_MODEL`.

## Signing in from an agent pane

When an agent pane launches, AgentMux runs the CLI's auth check. If it fails, the pane shows **Not signed in** with **Log in**, **Login via terminal**, and **Armory → Accounts**. When an existing account for the provider can be bound instead, the last action becomes **Bind: &lt;account&gt;** (one candidate) or **Bind account** (several). After a turn has been rejected for auth, **Log in** reads **Login Again**. See [First Agent Setup](/first-agent/#sign-in).

**Log in** goes through `frontend/app/view/agent/flows/run-provider-login.ts` (`runProviderLogin`):

1. For the five account-backed providers (Claude Code, Codex CLI, Gemini CLI, GitHub Copilot CLI and OpenClaw), AgentMux first allocates an Armory account directory and points the login there. If the agent already has an account bound for the provider, that account's directory is reused.
2. It runs the login command and waits about 15 seconds for a login link in the CLI's output. If it finds one, it opens it in your browser and shows the link in the pane with a box for pasting an authorization code, which is passed to the running login command. Claude Code and OpenClaw run the login in a pseudo-terminal. AgentMux then waits up to 5 minutes for the login to finish.
3. If the CLI prints no link, AgentMux opens a terminal window for the login. For the account-backed providers it waits up to 5 minutes for the CLI's auth check to succeed in the account directory. For the other providers it can't detect completion: finish the login in the terminal, then log in again from the pane.
4. On success, the account is saved and linked to the agent.

**Login via terminal** skips step 2 and goes straight to the terminal window.

For the other providers (the four API-key providers, and Antigravity), no account is created: the login writes to the ambient directory described next.

## Where credentials are stored

There are two places.

**Ambient directory.** AgentMux points every agent's CLI at the provider's shared directory unless a bound account overrides it (`agentmux-srv/src/server/app_api/agent_open.rs`):

```
~/.agentmux/shared/providers/claude/
~/.agentmux/shared/providers/codex/
~/.agentmux/shared/providers/gemini/
…
```

This is `DataPaths::provider_auth_dir` in `agentmux-common/src/data_paths.rs`. The subdirectory name is the provider's `authDirName` (`claude`, `codex`, `muxcode`, `gemini`, `qwen`, `kimi`, `openclaw`, `copilot`, `pi`, `antigravity`). It is account-wide: every channel, version and instance on the machine shares it.

Only Mux Code, Qwen Code, Kimi Code CLI, Pi and Antigravity actually run on the ambient directory. The five account-backed providers need a bound account; choosing **(ambient credentials)** in the create dialog for one of them leaves the agent unable to start until you sign in or bind an account.

**Account directories.** An OAuth login made through AgentMux for Claude Code, Codex CLI, Gemini CLI, GitHub Copilot CLI or OpenClaw is saved as an Armory account with its own directory, `<identities>/<account_id>/<provider>/`, where `<provider>` is the `authDirName`. When an agent is bound to such an account, AgentMux points the CLI's config-dir variable there instead of at the ambient directory. Where `<identities>` lives depends on the channel, as described next.

### Isolated auth by channel

Armory accounts are isolated per channel by default, except on `stable` (`agentmux-common/src/data_paths.rs`, `isolated_auth_enabled` and `identities_dir`):

- **`stable`** (every release build) shares one account list and one account-directory tree, `~/.agentmux/shared/identities/`.
- **Any other channel**, such as a `dev-<branch>` build from `task dev` or a local `task package` build's `local-<branch>-<hash>-<build-id>` channel, gets its own account list and keeps account directories under that channel's own directory (`<channel dir>/identities/`). A fresh non-`stable` channel starts with no Armory accounts.
- **The ambient directory is never isolated.** It stays account-wide on every channel.
- **Override:** `AGENTMUX_ISOLATED_AUTH=1` forces isolation, even on `stable`. Setting the variable to any other value turns isolation off, even on a non-`stable` channel.

This exists so that dev and local builds exercise real login code paths instead of silently inheriting a signed-in global session. See [Identity & Accounts](/identity/#persistence) for how an agent's link to an account survives a channel switch, and [Multi-instance & dev mode](/multi-instance/) for channels in general.

### History

Earlier builds kept provider credentials per instance, so switching channels or versions meant signing in again. agentmux#1291 (June 2026) moved them to the account-wide `shared/providers/` directory.

## Armory: Accounts tab

The **Accounts** tab of the [Armory](/armory/) (**≡ → Armory → Accounts**) manages accounts. It shows a tile per service: **AgentMux**, **GitHub**, **Google**, **AWS**, **OpenAI**, **Anthropic**, **Slack** and **Custom** (`frontend/app/view/accounts/accounts-catalog.ts`, `SERVICE_CATALOG`). Clicking **AgentMux** opens its own sign-in panel for AgentMux Cloud. Clicking any other tile offers **Connect with OAuth**, **Add API key / token**, or both:

- **Anthropic → Connect with OAuth** runs the Claude Code login inside AgentMux.
- **GitHub** OAuth uses GitHub's device flow; **Google** and **Slack** use a PKCE browser login. None of the three ships a built-in OAuth client: you create your own OAuth app and paste its client ID (and, for Slack, its client secret) (`frontend/app/view/accounts/oauth-catalog.ts`).
- **AWS**, **OpenAI** and **Custom** offer only **Add API key / token**.
- **Add API key / token** opens the Add Account form. Keys are stored in your OS keychain by default. **Validate & Save** checks the key against the service first; this is available for GitHub, OpenAI and Anthropic keys. **Save without validating** skips the check.

Each account shows a status dot: green (valid), red (expired or invalid), amber (checking) or grey (unknown). For Claude Code, Codex CLI and OpenClaw accounts, the status is refreshed from the account's credential file each time AgentMux starts a bound agent's CLI.

To bind an account to an agent, right-click it and choose **Bind to Agent**, or use the **Accounts** tab of the agent's **Stash**. When an agent bound to one of these accounts starts, AgentMux sets that account's key in the agent's environment:

| Account | Environment variables |
|---|---|
| GitHub | `GITHUB_TOKEN`, `GH_TOKEN` |
| Anthropic | `ANTHROPIC_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| Kimi | `MOONSHOT_API_KEY` |
| AWS | `AWS_ACCESS_KEY_ID` |

These mappings are in `agentmux-srv/src/identity/resolver/provider.rs` (`provider_class`). Keys for other services are not put in the environment. The Add Account form has no Kimi option.

## Accounts vs the ambient directory

These are independent layers:

- **The ambient directories** are account-wide, provider-scoped and always global. Every instance on the machine shares them.
- **[Accounts](/identity/)** are bound per agent and chosen when you create it (the **Identity** field), or later with **Bind**. They override the ambient directory for that agent, and the five account-backed providers require one. Unlike the ambient directories, they follow the [Isolated auth by channel](#isolated-auth-by-channel) default.

Two agents in the same instance can use different accounts for the same provider.

## Pre-launch OAuth panel

The agent **launch dialog** contains a sign-in panel, **Connect to &lt;provider&gt;**, which creates an account and selects it. Nothing in the current agent picker opens that dialog: creating an agent from a template uses the **Create new agent from &lt;template&gt;** dialog, which has no sign-in panel, and relaunching an agent from **My Agents** launches it directly. Sign-in happens in the agent pane instead, as described in [Signing in from an agent pane](#signing-in-from-an-agent-pane).

## Manual login

For a provider that runs on the ambient directory, you can sign its CLI in yourself, outside AgentMux, by setting its config-dir variable first:

```bash
export KIMI_SHARE_DIR=~/.agentmux/shared/providers/kimi
kimi login
```

Agents using that provider without a bound account then pick up the login. This doesn't work for the five account-backed providers: a login in the ambient directory doesn't satisfy their account requirement, so use **Log in** in the agent pane or the Armory. This is rarely needed; **Log in** in the agent pane covers the usual case.

## See also

- [First Agent Setup](/first-agent/): provider install and sign-in
- [Identity & Accounts](/identity/): per-agent account binding
- [Multi-instance & dev mode](/multi-instance/): instance and channel layout
- [Settings reference](/settings/): settings and environment variables
