---
title: "Trust Center"
description: The AgentMux credential hub — Accounts (OAuth + API keys), Identity bundles, and Memory bundles — all in one place.
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

The **Trust Center** is the app-wide credential and configuration hub. Open it from the hamburger menu (≡) in the top tab bar.

It has three tabs:

| Tab | What it manages |
|---|---|
| **Accounts** | Service connections — OAuth logins and API keys for every provider |
| **Identity** | Identity bundles — named credential sets assigned to agents at launch |
| **Memory** | Memory bundles — agent definitions (provider, model, instructions, MCP, skills) |

## Accounts

The Accounts tab shows every service AgentMux can connect to. Each entry displays the service logo, connection status, and the active credential type.

### Connecting a service

Click any service tile to connect or manage credentials:

- **OAuth providers** (Claude, Codex, Gemini, GitHub Copilot) — clicking **Connect** opens a PKCE or Device Flow browser login. The resulting token is stored in the provider's auth-config dir under `~/.agentmux/shared/providers/<provider>/` (account-wide, never plaintext via AgentMux). Tokens are validated against the live service on load — an expired token shows a ⚠ badge.
- **API key providers** (OpenClaw, Kimi, Pi) — clicking **Connect** opens an inline key entry field. The key is validated against the service before it's saved and stored in the provider's auth-config dir with restricted permissions.

Supported providers:

| Service | Auth type | Notes |
|---|---|---|
| Anthropic (Claude) | OAuth (PKCE) | `CLAUDE_API_KEY` env var also accepted as fallback |
| OpenAI (Codex) | OAuth (PKCE) | `OPENAI_API_KEY` env var also accepted |
| Google (Gemini) | OAuth | `GEMINI_API_KEY` env var also accepted |
| GitHub Copilot | OAuth (Device Flow) | |
| OpenClaw | API key | |
| Kimi Code | API key | |
| Pi | API key | |

### Credential storage

Provider credentials are stored account-wide under `~/.agentmux/shared/providers/<provider>/` — they persist across channel upgrades and version changes without re-authentication. See [Auth flows](/auth/) for the credential storage model and per-provider details.

### Relationship to Identity bundles

The Accounts tab is the **credential store**. Identity bundles (the Identity tab) are **named pointers** into that store — they group credentials and assign a name so you can tell an agent "act as my work identity" at launch. Think of Accounts as the vault and Identity bundles as keys to specific drawers.

## Identity

The Identity tab is the app-wide view of all Identity bundles. See [Identity bundles](/identity/) for the full reference.

The quick version: an Identity bundle is a named credential set — GitHub PAT, AWS profile, API keys — that you assign to an agent at launch. The same agent definition (Memory bundle) can run as different identities without restarting.

## Memory

The Memory tab is the app-wide view of all Memory bundles. See [Memory bundles](/memory/) for the full reference.

The quick version: a Memory bundle is a reusable agent definition — provider, model, system prompt, instructions, MCP servers, skills. Select one in the Launch Agent modal and the agent inherits the whole stack.

## Opening Trust Center

**Hamburger menu path:**
1. Click ≡ in the top tab bar.
2. Choose **Trust Center**.
3. The singleton manager opens. If it's already open in another window, that window is focused instead of opening a duplicate.

**Per-agent shortcut** (Identity and Memory only):
- Open any Agent pane → click the cog (⚙) in the pane header → switch to the **Identity** or **Memory** tab. This scopes to that agent rather than showing all bundles.

## See also

- [Auth flows](/auth/) — per-provider OAuth flows, API key storage, and credential storage model
- [Identity bundles](/identity/) — full Identity bundle reference
- [Memory bundles](/memory/) — full Memory bundle reference
- [First Agent Setup](/first-agent/) — connecting your first provider
