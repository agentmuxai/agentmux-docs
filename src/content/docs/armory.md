---
title: "Armory"
description: The AgentMux credential + primitive hub — Accounts, Memory (Global and Personal), Skills, MCP Servers and Bundles — all in one place.
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

The **Armory** is the app-wide hub for every reusable "primitive" an agent can be built from: credentials, memory, skills, MCP servers and bundles. It was called **Trust Center** in earlier releases — same pane, new name and a bigger scope.

Open it from the hamburger menu (≡) in the top tab bar, or pin it from the widget bar (icon: `vault`). Unlike the old Trust Center modal, the Armory is a regular **pane view** — it opens in the widget bar/tab layout like any other pane, not as a floating overlay.

It has five tabs, in a rail down the left side (`frontend/app/view/armory/armory-view.tsx`):

| Tab | What it manages |
|---|---|
| **Accounts** | Service connections — OAuth logins and API keys for every provider |
| **Memory** | **Global** memory every agent inherits at launch, and each agent's **Personal** memory (its native memory files) |
| **Skills** | The Skill primitive catalog — global skills plus any agent-private ones |
| **MCP Servers** | The MCP Server primitive catalog — global servers plus any agent-private ones |
| **Bundles** | Bundles (formerly "Memory bundles"/Presets) — reusable, provider-agnostic capability packs: instructions, MCP servers, skills |

Earlier releases also had an **Identities** tab and a separate **Brain** tab. Both are gone: Brain became Memory → Personal, and an agent's linked accounts are shown in its own [Stash](#opening-the-armory) → **Accounts** tab.

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

The Accounts tab is the **credential store**. The Armory no longer has a separate Identities tab; to see which accounts a given agent is linked to, open that agent's Stash → **Accounts** tab. See [Identity bundles](/identity/) for how agents and accounts are linked.

## Memory

The Memory tab has a **Global** / **Personal** switch at the top.

### Global

**Global Memory** is a set of entries that every agent inherits at launch (`frontend/app/view/global-bundle/global-bundle-manager.tsx`). The tab reads "Every agent inherits this at launch — takes effect after a restart. Drag entries to change their order." It shows a tile per entry, a read-only `CLAUDE.md` tile, a **Combined preview** of what agents receive, and **+ Add memory**. Click a tile to open the entry with its history, a diff view and revert.

Every change to Global Memory is also written to a Global Memory record that keeps each entry's versions and the order of entries (`agentmux-srv/src/backend/global_memory_record.rs`). Channels that share your main accounts share one Global Memory; an isolated channel (for example a development build) keeps its own.

On an isolated channel, the Global view shows a banner when another scope has entries this channel doesn't: "This channel keeps its own Global Memory. … has N entries it doesn't: …". **Bring them here** copies them in (an entry whose name is already taken is renamed); agents get them at their next launch. Nothing is shared without this click (`frontend/app/view/global-bundle/GlobalMemoryImportBanner.tsx`).

Agents can read and change Global Memory with the `GlobalMemoryList`, `GlobalMemoryRead`, `GlobalMemoryWrite`, `GlobalMemoryRemove`, `GlobalMemoryHistory`, `GlobalMemoryDiff` and `GlobalMemoryRevert` MCP tools.

### Personal

The app-wide view of every agent's **native memory** — free-form `.md` files an agent reads and writes about itself (notes, running context, anything it wants to persist between turns). This is a different primitive from a Bundle: a Bundle is a reusable *definition* you select at launch; native memory is a scratchpad an already-running agent maintains for itself. Pick an agent, then a file, to see its content, history and diffs, and to revert to an earlier version. See [Memory bundles → Native memory](/memory/#native-memory) for how AgentMux keeps it.

Above an agent's files, two collapsible panels (`frontend/app/view/native-memory/`):

- **Earlier memory found under N other account(s)** appears when the agent has memory folders from accounts it used before, or files held back because their content matches another agent's memory. Tick the folders and choose **Adopt selected…**.
- **Memory folders this agent claims (N)** lists the folders the agent holds, when each was claimed, and whether other agents also use it. **Release…** gives a folder up, so another agent that uses it can sync its memory there; if the agent still uses it, its next launch claims it again.

Adopting and releasing are confirmed in a separate AgentMux window ("Adopt earlier memory into *agent*?" with **Cancel** / **Adopt**; "Release *agent*'s claim on this folder?" with **Cancel** / **Release**), not in the pane, so an agent driving the UI can't confirm them for you. A request left unanswered expires after 10 minutes (`agentmux-cef/src/memory_adoption.rs`). Adopted files appear in the agent's folder at its next launch.

An **Unverified folder** badge next to the agent's name means AgentMux found the folder from the agent's settings rather than from the agent's own launch; it is read-only until the agent launches.

Per-agent, the same memory is reached via the agent pane's **Stash → Personal Memory** tab. Agents use the `MemoryList`, `MemoryRead`, `MemoryWrite`, `MemoryHistory`, `MemoryDiff` and `MemoryRevert` MCP tools on their own memory — see [Agent App API](/internals/agent-app-api/).

## Bundles

The app-wide view of all Bundles (see [Memory bundles](/memory/) for the full reference — the page name predates the Bundle rename but the content is current).

The quick version: a Bundle is a reusable, **provider-agnostic** capability pack — system prompt, instructions, MCP servers, skills. Provider and model belong to the agent, not the bundle, and are chosen separately at launch. Select a Bundle in the Launch Agent modal and the agent inherits the whole stack. Bundles are managed app-wide from this tab only today — there is currently no per-agent "Bundle" tab in the agent pane's setup modal.

## MCP Servers

The catalog of MCP Server primitives available to agents:

- **Global servers** — visible to and bindable by any agent. Created/edited here via the catalog (`mcp.catalog.upsert`/`mcp.catalog.delete`).
- **Private servers** — created by a specific agent (`mcp.upsert`), visible only to that agent until bound elsewhere.

An agent's own MCP Servers tab (Stash → MCP Servers) lists what that agent can see and lets it bind/unbind global servers or manage its own private ones. See [Agent App API](/internals/agent-app-api/#mcp) for the full RPC reference.

## Skills

The catalog of Skill primitives, with the same global-vs-private shape as MCP Servers (`skill.catalog.*` for global, `skill.*` for agent-scoped). See [Agent App API](/internals/agent-app-api/#skill) for the full RPC reference.

## Opening the Armory

**Hamburger menu path:**
1. Click ≡ in the top tab bar.
2. Choose **Armory**.

**Widget bar:** pin the Armory (`vault` icon) from the widget bar's overflow, or use the command palette.

**Per-agent shortcuts: the Stash** — several Armory tabs have a per-agent equivalent reached from inside an agent pane:
1. Open any Agent pane → click the **Stash** icon (`backpack`) in the pane header.
2. A drawer opens under the pane header with tabs: **Accounts · Personal Memory · MCP Servers · Skills · Startup · Registration** (`frontend/app/view/agent/components/AgentStashModal.tsx`). This scopes each tab to that specific agent rather than the app-wide catalog. The Startup tab selects which existing Bundle (if any) supplies this agent's Session Context startup instructions — it doesn't create or edit Bundles. The Registration tab shows the agent's message-delivery registration. (Full Bundle management is not in the Stash — use the Armory for that.)

## Portable bundles (beta spec)

**[Armory Bundle Format (ABF)](/abf/)** is a beta specification for packaging a Bundle's instructions, skills, MCP servers, and credential requirements into one portable, versioned directory — composing existing standards (Agent Skills/SKILL.md, MCP server.json, AGENTS.md) rather than inventing new ones. The Bundles tab has an **Import Bundle** button for bringing in an ABF bundle. See the [rollout plan](/abf/#rollout-plan) for what's built vs. planned.

## See also

- [Auth flows](/auth/) — per-provider OAuth flows, API key storage, and credential storage model
- [Identity bundles](/identity/) — full Identity bundle reference
- [Memory bundles](/memory/) — full Bundle reference
- [Bundle Format (ABF)](/abf/) — beta spec for portable, exportable bundles
- [Agent App API](/internals/agent-app-api/) — `mcp.*`, `skill.*`, `bundle.*`, `identity.*`, and `memory.*` RPC catalogs
- `docs/specs/SPEC_MEMORY_FOLLOWS_THE_AGENT_2026_09_24.md` in the main repo — the memory record, adoption and folder claims
- [First Agent Setup](/first-agent/) — connecting your first provider
