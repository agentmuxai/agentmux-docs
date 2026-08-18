---
title: "Armory"
description: The AgentMux credential + primitive hub — Accounts, Identities, Brain, Bundles, MCP Servers, and Skills — all in one place.
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

The **Armory** is the app-wide hub for every reusable "primitive" an agent can be built from: credentials, identities, native memory, bundles, MCP servers, and skills. It was called **Trust Center** in earlier releases — same pane, new name and a bigger scope.

Open it from the hamburger menu (≡) in the top tab bar, or pin it from the widget bar (icon: `vault`). Unlike the old Trust Center modal, the Armory is a regular **pane view** — it opens in the widget bar/tab layout like any other pane, not as a floating overlay.

It has six tabs:

| Tab | What it manages |
|---|---|
| **Accounts** | Service connections — OAuth logins and API keys for every provider |
| **Identities** | Identity bundles — named credential sets assigned to agents at launch |
| **Brain** | Native memory — free-form `.md` notes an agent reads/writes about itself, app-wide view |
| **Bundles** | Bundles (formerly "Memory bundles"/Presets) — reusable, provider-agnostic capability packs: instructions, MCP servers, skills |
| **MCP Servers** | The MCP Server primitive catalog — global servers plus any agent-private ones |
| **Skills** | The Skill primitive catalog — global skills plus any agent-private ones |

## Accounts

The Accounts tab shows every service AgentMux can connect to. Each entry displays the service logo, connection status, and the active credential type.

### Connecting a service

Click any service tile to connect or manage credentials:

- **OAuth providers** (Claude, Codex, Gemini, GitHub Copilot) — clicking **Connect** opens a PKCE or Device Flow browser login. The resulting token is stored in a per-account credential dir under `~/.agentmux/shared/identities/<account_id>/<provider>/` (never plaintext via AgentMux). Tokens are validated against the live service on load — an expired token shows a ⚠ badge.
- **API key providers** — clicking **Connect** opens an inline key entry field. The key is validated against the service before it's saved and stored in the provider's auth-config dir with restricted permissions.

See [Auth flows](/auth/) for the full per-provider table and credential storage model.

### Binding an account to an agent

Right-click an account row for a **"Bind to Agent"** context menu — a second path to link an account to an agent, alongside connecting from the agent's own launch flow. The submenu lists the current channel's user-owned agents, with live binding annotations so multi-account disambiguation stays legible at a glance:

- A checkmark on an agent already bound to **this** account.
- A sublabel showing the currently-bound account's name when it's a *different* account ("bound: work-claude"), or "no account bound".
- Agents with an open pane sort first with a running indicator; non-running agents are still bindable.

For CLI-OAuth accounts (Claude, Codex, Gemini, OpenClaw), only agents whose provider matches the account's are offered. For service accounts (GitHub, AWS, etc.), every agent is a candidate. Clicking an agent binds the account to it — if that agent already has a different account bound for the same provider, the click rebinds it (the link is a one-per-provider upsert, same as [Identity's direct links](/identity/)). If the target agent has an open pane, the new credentials apply live (a forced, session-preserving respawn) rather than waiting for the next manual restart.

### Credential storage

Ambient provider credentials (used by agents with no Account explicitly bound) are stored account-wide under `~/.agentmux/shared/providers/<provider>/` — always global, unconditionally shared across every channel and version. Credentials for an explicitly-connected or bound **Account**, by contrast, follow a conditional default: shared account-wide on the `stable` channel, but isolated to that one channel by default everywhere else (a fresh non-`stable` channel — a `task dev` branch, or a local `task package` build — starts with zero Armory accounts). See [Auth flows → Isolated auth by channel](/auth/#isolated-auth-by-channel) for the full rule and the override env var.

### Relationship to Identities

The Accounts tab is the **credential store**. Identities (the Identities tab) are **named pointers** into that store — they group credentials and assign a name so you can tell an agent "act as my work identity" at launch. Think of Accounts as the vault and Identities as keys to specific drawers.

## Identities

The app-wide view of all Identity bundles. See [Identity bundles](/identity/) for the full reference.

The quick version: an Identity bundle is a named credential set — GitHub PAT, AWS profile, API keys — that you assign to an agent at launch. The same agent definition (Bundle) can run as different identities without restarting.

## Brain

The app-wide view of every agent's **native memory** — free-form `.md` files an agent reads and writes about itself (notes, running context, anything it wants to persist between turns). This is a different primitive from a Bundle: a Bundle is a reusable *definition* you select at launch; native memory is a scratchpad an already-running agent maintains for itself.

Per-agent, the same primitive is reached via the agent pane's **Agent setup → Memory** tab (see [Pane Types](/pane-types/#agent)). Under the hood both surfaces call the same `memory.list` / `memory.read` / `memory.write` App API commands (and the `MemoryList` / `MemoryRead` / `MemoryWrite` MCP tools an agent can call on itself — see [Agent App API](/internals/agent-app-api/)).

## Bundles

The app-wide view of all Bundles (see [Memory bundles](/memory/) for the full reference — the page name predates the Bundle rename but the content is current).

The quick version: a Bundle is a reusable, **provider-agnostic** capability pack — system prompt, instructions, MCP servers, skills. Provider and model belong to the agent, not the bundle, and are chosen separately at launch. Select a Bundle in the Launch Agent modal and the agent inherits the whole stack. Bundles are managed app-wide from this tab only today — there is currently no per-agent "Bundle" tab in the agent pane's setup modal.

## MCP Servers

The catalog of MCP Server primitives available to agents:

- **Global servers** — visible to and bindable by any agent. Created/edited here via the catalog (`mcp.catalog.upsert`/`mcp.catalog.delete`).
- **Private servers** — created by a specific agent (`mcp.upsert`), visible only to that agent until bound elsewhere.

An agent's own MCP Servers tab (Agent setup → MCP Servers) lists what that agent can see and lets it bind/unbind global servers or manage its own private ones. See [Agent App API](/internals/agent-app-api/#mcp) for the full RPC reference.

## Skills

The catalog of Skill primitives, with the same global-vs-private shape as MCP Servers (`skill.catalog.*` for global, `skill.*` for agent-scoped). See [Agent App API](/internals/agent-app-api/#skill) for the full RPC reference.

## Opening the Armory

**Hamburger menu path:**
1. Click ≡ in the top tab bar.
2. Choose **Armory**.

**Widget bar:** pin the Armory (`vault` icon) from the widget bar's overflow, or use the command palette.

**Per-agent shortcuts** — several Armory tabs have a per-agent equivalent reached from inside an agent pane:
1. Open any Agent pane → click the **Agent setup** icon (`id-card`) in the pane header.
2. The modal opens with tabs: **Accounts · Memory (native, i.e. Brain) · MCP Servers · Skills · Startup**. This scopes each tab to that specific agent rather than the app-wide catalog. The Startup tab selects which existing Bundle (if any) supplies this agent's Session Context startup instructions — it doesn't create or edit Bundles. (Briefs and full Bundle management are not yet wired into this per-agent modal — use the Armory for those.)

Note: the previous design had two separate pane-header icons (a "Brain" icon for Memory and an "id-card" icon for Identity) — these are now consolidated into the single **Agent setup** icon.

## Portable bundles (beta spec)

The five Armory primitives above are stored in AgentMux's own SQLite database today, with no export/import path. **[Armory Bundle Format (ABF)](/abf/)** is a beta specification for packaging a Bundle's instructions, skills, MCP servers, and credential requirements into one portable, versioned directory — composing existing standards (Agent Skills/SKILL.md, MCP server.json, AGENTS.md) rather than inventing new ones. It's a proposal with published schemas, not a shipped feature yet — see the [rollout plan](/abf/#rollout-plan) for what's built vs. planned.

## See also

- [Auth flows](/auth/) — per-provider OAuth flows, API key storage, and credential storage model
- [Identity bundles](/identity/) — full Identity bundle reference
- [Memory bundles](/memory/) — full Bundle reference
- [Bundle Format (ABF)](/abf/) — beta spec for portable, exportable bundles
- [Agent App API](/internals/agent-app-api/) — `mcp.*`, `skill.*`, `bundle.*`, `identity.*`, and `memory.*` RPC catalogs
- [First Agent Setup](/first-agent/) — connecting your first provider
