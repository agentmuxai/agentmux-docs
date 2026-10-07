---
title: "Connectors"
description: The Connectors pane — Accounts (sign-ins to providers and services) and MCP servers, the things agents connect to outside AgentMux.
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

**Connectors** is the app-wide pane for what agents connect to outside AgentMux: the accounts they sign in with and the MCP servers they use. Its companion pane, [Memory](/memory/), holds what agents know and carry: Global and Personal Memory, Skills and Bundles.

Connectors is a regular pane (icon: `plug`), opened from the widget bar like any other. It has two sections, as tabs along the top of the pane (`frontend/app/view/connectors/connectors.tsx`):

| Section | What it manages |
|---|---|
| **Accounts** | Sign-ins to providers and services: Claude, Codex, GitHub, Google Workspace, AWS, OpenAI, Anthropic, Slack, AgentMux Cloud and a custom bearer token. Each account can be bound to agents. |
| **MCP servers** | The MCP server catalog: global servers plus any agent-private ones |

Connectors opens on **Accounts**. The pane title names the section, for example "Connectors · Accounts". In a narrow pane the tabs show only their icons; in a wide one they stop growing and sit at the left. `Ctrl` + mouse wheel zooms the pane.

An agent's own linked accounts and MCP servers are shown in its [Stash](#per-agent-the-stash).

## Opening Connectors

- **Widget bar:** click **Connectors**. It is pinned by default. If a Connectors pane is already open in the tab, the click focuses it instead of opening another.
- **Hamburger menu:** click ≡ in the top tab bar and choose **Connectors**.
- **Command palette:** run **Connectors**. Searching for "accounts" or "mcp" also finds it.
- **macOS app menu:** **Connectors…**.

Links elsewhere in the app open Connectors on the right section:

- An agent pane that can't sign in shows **Connectors → Accounts** in its error row, and **Accounts (switch / upgrade)** when a usage limit is reached. See [First Agent Setup → Sign in](/first-agent/#sign-in).
- In an agent's Stash, the **MCP Servers** tab's **Browse all in Connectors →** button and its **edit it there** link open **MCP servers**.

A pane or layout saved while it was the Armory (the earlier pane that held both Connectors and Memory) opens as the matching new pane: Accounts and MCP servers as Connectors, the rest as Memory.

## Accounts

The Accounts section shows every service AgentMux can connect to. Each entry displays the service logo, connection status, and the active credential type.

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

Ambient provider credentials (used by agents with no Account explicitly bound) are stored account-wide under `~/.agentmux/shared/providers/<provider>/` — always global, unconditionally shared across every channel and version. Credentials for an explicitly-connected or bound **Account**, by contrast, follow a conditional default: shared account-wide on the `stable` channel, but isolated to that one channel by default everywhere else (a fresh non-`stable` channel — a `task dev` branch, or a local `task package` build — starts with no accounts). See [Auth flows → Isolated auth by channel](/auth/#isolated-auth-by-channel) for the full rule and the override env var.

### Relationship to Identities

The Accounts section is the **credential store**. To see which accounts a given agent is linked to, open that agent's Stash → **Accounts** tab. See [Identity & Accounts](/identity/) for how agents and accounts are linked.

## MCP servers

The catalog of MCP Server primitives available to agents:

- **Global servers** — visible to and bindable by any agent. Created/edited here via the catalog (`mcp.catalog.upsert`/`mcp.catalog.delete`).
- **Private servers** — created by a specific agent (`mcp.upsert`), visible only to that agent until bound elsewhere.

An agent's own MCP Servers tab (Stash → MCP Servers) lists what that agent can see and lets it bind/unbind global servers or manage its own private ones. A [bundle](/bundles/) can also include MCP servers. See [Agent App API](/internals/agent-app-api/#mcp) for the full RPC reference.

## Per-agent: the Stash

Some sections have a per-agent equivalent reached from inside an agent pane:

1. Open any Agent pane → click the **Stash** icon (`backpack`) in the pane header.
2. A drawer opens under the pane header with tabs: **Accounts · Personal Memory · MCP Servers · Skills · Bundles · Registration** (`frontend/app/view/agent/components/AgentStashModal.tsx`). Each tab is scoped to that agent rather than the app-wide catalog.

**Accounts** and **MCP Servers** are the per-agent side of Connectors; **Personal Memory**, **Skills** and **Bundles** are the per-agent side of [Memory](/memory/#per-agent-the-stash). The Registration tab shows the agent's message-delivery registration.

## See also

- [Memory](/memory/) — Global and Personal Memory, Skills and Bundles
- [Auth flows](/auth/) — per-provider OAuth flows, API key storage, and credential storage model
- [Identity & Accounts](/identity/) — how agents and accounts are linked
- [Agent App API](/internals/agent-app-api/) — `mcp.*` and `identity.*` RPC catalogs
- [First Agent Setup](/first-agent/) — connecting your first provider
