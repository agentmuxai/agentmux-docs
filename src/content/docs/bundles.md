---
title: "Bundles"
description: Reusable packages of an agent's instructions, MCP servers, memory and skills, managed in Memory → Bundles. An agent takes several, in order.
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

A **Bundle** packages what an agent starts with: its instructions (system prompt, "Soul"), context files, MCP servers, skills and memory. You manage bundles in [Memory → Bundles](/memory/#bundles). An agent takes [several, in order](#an-agents-bundles), picked when you create it and changed later from its Stash. A bundle can be exported as, and imported from, an [Agent Bundle Format (ABF)](/abf/) file.

:::note[Earlier names]
Bundles were called "Memory bundles", and before that "Presets". This page was at `/memory/`, which is now the [Memory](/memory/) pane's page. See [Agent App API](/internals/agent-app-api/#bundle) for the `bundle.*` RPC surface; the older `preset.*` compatibility aliases have been retired (`crates/srv/src/backend/rpc_types/commands.rs`).
:::

## What goes in a bundle

The New/Edit Bundle form has Name, Description, an optional **Suggested for** (provider and vendor), Instructions and per-provider instruction overrides. After a bundle is saved, its detail view adds **MCP Servers** and **Skills** sections. See [First Agent Setup → Bundles](/first-agent/#bundles) for the form, field by field.

| Field | Purpose | Editable in the UI today? |
|---|---|---|
| `instructions` | System prompt / Soul. Long-form text describing the agent's personality, priorities, and behavior, delivered through the provider's startup instructions file. | Yes |
| `instructions_by_provider` | Per-provider overrides that replace `instructions` when the bundle runs on that provider. | Yes |
| `provider` / `model` | **Suggested for**: the provider and vendor the bundle was made with in mind. A hint only; the agent's own provider decides which harness runs. Optional. | Yes |
| `context_files` | Array of `{path, content}` entries — files (typically project-scoped, like `AGENTS.md` or `CLAUDE.md`) loaded into context on launch. | Not yet — persisted as JSON |
| `mcp_servers` | MCP servers for the bundle: servers from the [MCP servers](/connectors/#mcp-servers) catalog, or servers private to the bundle. | Yes, after saving |
| `skills` | **Skill primitive IDs** — see [Memory → Skills](/memory/#skills). | Yes, after saving |

An agent with no bundles picked runs the harness as it comes ("vanilla CLI"), plus Global Memory and its own bundle. The singleton `is_blank` bundle that once stood for this is never offered in a picker.

## An agent's bundles

An agent starts with an ordered list of bundles:

1. **Its own bundle** comes first, always. AgentMux creates it with the agent (named "&lt;agent&gt; — ABF") to hold what's bound to just that agent, and it can't be removed from the list. See [every agent gets its own ABF](/abf/#every-agent-gets-its-own-abf).
2. **The bundles you pick** follow, in the order you put them.

You pick them in three places, all with the same control: each picked bundle has **Move up**, **Move down** and **Remove**, and **Add a bundle…** lists the rest.

| Where | When it's saved |
|---|---|
| The new-agent form's **Bundles** field | When you click **Create**. It starts empty. |
| The launch modal's **Bundles** row | When you click **Launch**, if you changed it. A bundle isn't required to launch. |
| **Stash → Bundles** in the agent pane | On each change. |

**At launch,** in list order:

- **Instructions:** each picked bundle with instructions becomes a section of the agent's startup file (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, …), headed `# [Bundle] <name>`, after the Global Memory sections (`crates/srv/src/backend/storage/agent_bundles.rs`). The instructions are no longer sent as the agent's first message. A bundle deleted since it was picked is skipped.
- **Skills** from every bundle in the list are added to the agent's own. When two bundles name the same skill, the first one wins.
- **MCP servers** from the bundles are added when the agent is opened through the Agent App API (`agent.open`). The Launch button in the agent pane doesn't add a bundle's MCP servers yet.
- **The provider** stays the agent's own. A picked bundle doesn't change which harness runs.

The Stash's **Startup** tab, which picked one bundle to send as the agent's first message, became the **Bundles** tab. A bundle picked there is moved into the list the first time the list is read.

The list is kept per [channel](/glossary/#channel), like the agent's own bundle. Deleting a bundle takes it out of this channel's lists.

## Session zones and default-continue

A bundle keeps a sequence of **session zones** — one per agent-anchored conversation thread. When you re-launch the same bundle, the agent defaults to **continuing the most recent session** rather than starting fresh: previous turns load into the new pane, the agent's context carries over, and you pick up mid-thread.

If you want a brand-new conversation instead, the Launch modal's **Recent sessions** tab lets you pick a specific older session to re-attach to (or click + to start a fresh zone). The default is "continue most recent" because that matches the workflow people actually have — close a pane, reopen, keep going.

Session zones are anchored to the agent's identity (`agent_id`), not the pane that hosts the conversation. Moving an agent to a new pane preserves its zones; deleting the pane preserves them too.

## Where bundles are managed

Bundles are managed **app-wide only**:

1. Click **Memory** in the widget bar, or choose **Memory** from the hamburger menu (≡).
2. Switch to the **Bundles** section.

In an agent pane, **Stash** → **Bundles** picks which bundles that agent starts with; it links to **Memory → Bundles** but doesn't edit bundles itself.

:::caution[Bundles are not Personal Memory]
An agent pane's **Stash** → **Personal Memory** tab, and the **Global** and **Personal** sections of [Memory](/memory/), do **not** open the Bundle editor described on this page. They open **Global Memory** and **Personal Memory**, different primitives covered on the [Memory](/memory/#personal) page.
:::

## Native memory

Personal Memory, the notes an agent keeps about itself (stored as "native memory"), is not a bundle. It's covered on the [Memory](/memory/#personal) page, with the memory record that makes it follow an agent across accounts and channels.

## Launch flow

The **Create new agent** form, opened from a template card in the agent picker:

```
┌────────────────────────────────────────────────┐
│ Create new agent from Claude Code               │
│  Name:      [my-agent_________]                 │
│  Runtime:   (•) host   ( ) container            │
│  Model:     [▼ opus ]                           │
│  Bundles:   Reviewer                 ↑ ↓ ✕      │
│             [▼ Add another bundle… ]            │
│                                                 │
│  [Cancel]                          [Create]     │
└────────────────────────────────────────────────┘
```

It has no account field: the agent takes the provider's first account, which you can change later from **Stash → Accounts**. The launch modal for an existing agent has an **Identity** (account) row, which is required, and the same **Bundles** row, with the agent's own bundle shown first.

## Persistence

Bundles live in the `db_bundles` table (named `db_memory_bundles` before a storage rename):

```
id                        TEXT PRIMARY KEY
name                      TEXT NOT NULL UNIQUE
description               TEXT
is_blank                  INTEGER  -- the "vanilla CLI session" bundle
is_global                 INTEGER  -- a Global Memory entry
provider                  TEXT
model                     TEXT
instructions              TEXT
instructions_by_provider  TEXT  -- JSON
context_files             TEXT  -- JSON
mcp_servers               TEXT  -- JSON
skills                    TEXT  -- JSON
sort_order                INTEGER
created_at                INTEGER
updated_at                INTEGER
is_system                 INTEGER
```

The table is defined in `crates/srv/src/backend/storage/migrations.rs`, both in `objects.db`'s flat schema (`run_object_schema`) and in the shared store's schema (`run_shared_store_schema`). [Global Memory](/memory/#global) entries are rows in the same table with `is_global` set.

An agent's picked bundles are rows of the per-channel `db_agent_bundles` table (`agent_id`, `bundle_id`, `position`). Its own bundle is `db_agents.default_memory_id`. Memory replaced the earlier "Forge" concept; the agent-definition catalog ("Forge agents") now lives separately in `db_agent_definitions`.

## Bundles and per-instance overrides

A bundle is the **definition** — reusable across many agent instances, edited in [Memory → Bundles](/memory/#bundles).

When you launch an agent, AgentMux composes the bundle's settings with whatever overrides the running pane has accumulated, then spawns the provider's CLI with the resulting `launchArgs` and env. Two agents using the same bundle but different overrides land on different actual configs at launch.

## See also

- [Memory](/memory/) — where Bundles, Global Memory, Personal Memory and Skills are managed
- [Connectors](/connectors/) — accounts and MCP servers
- [Agent Bundle Format (ABF)](/abf/) — the bundle file format
- [Identity & Accounts](/identity/) — the other half of agent composition
- [First Agent Setup](/first-agent/) — provider login flows
- [Pane Types](/pane-types/) — where Bundles and Personal Memory surface in the UI
