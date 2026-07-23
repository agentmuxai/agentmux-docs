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
| **Bundles** | Bundles (formerly "Memory bundles"/Presets) — reusable agent definitions: provider, model, instructions, MCP servers, skills |
| **MCP Servers** | The MCP Server primitive catalog — global servers plus any agent-private ones |
| **Skills** | The Skill primitive catalog — global skills plus any agent-private ones |

## Accounts

The Accounts tab shows every service AgentMux can connect to. Each entry displays the service logo, connection status, and the active credential type.

### Connecting a service

Click any service tile to connect or manage credentials:

- **OAuth providers** (Claude, Codex, Gemini, GitHub Copilot) — clicking **Connect** opens a PKCE or Device Flow browser login. The resulting token is stored in the provider's auth-config dir under `~/.agentmux/shared/providers/<provider>/` (account-wide, never plaintext via AgentMux). Tokens are validated against the live service on load — an expired token shows a ⚠ badge.
- **API key providers** — clicking **Connect** opens an inline key entry field. The key is validated against the service before it's saved and stored in the provider's auth-config dir with restricted permissions.

See [Auth flows](/auth/) for the full per-provider table and credential storage model.

### Credential storage

Provider credentials are stored account-wide under `~/.agentmux/shared/providers/<provider>/` — they persist across channel upgrades and version changes without re-authentication. See [Auth flows](/auth/) for the credential storage model and per-provider details.

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

The quick version: a Bundle is a reusable agent definition — provider, model, system prompt, instructions, MCP servers, skills. Select one in the Launch Agent modal and the agent inherits the whole stack. Bundles are managed app-wide from this tab only today — there is currently no per-agent "Bundle" tab in the agent pane's setup modal.

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

## See also

- [Auth flows](/auth/) — per-provider OAuth flows, API key storage, and credential storage model
- [Identity bundles](/identity/) — full Identity bundle reference
- [Memory bundles](/memory/) — full Bundle reference
- [Agent App API](/internals/agent-app-api/) — `mcp.*`, `skill.*`, `bundle.*`, `identity.*`, and `memory.*` RPC catalogs
- [First Agent Setup](/first-agent/) — connecting your first provider
