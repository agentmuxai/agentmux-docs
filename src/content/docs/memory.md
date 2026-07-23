---
title: "Memory bundles"
description: Reusable, provider-agnostic agent capability stacks — instructions, MCP, skills — selectable at launch.
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

A **Memory bundle** is a reusable, **provider-agnostic** capability pack — system prompt ("Soul"), instructions, context files, MCP servers, skills. Provider and model belong to the agent, chosen separately at launch, not to the bundle. Selectable at launch from the Launch Agent modal.

:::note[Also called "Bundle"]
The UI now labels this primitive **Bundle** (the [Armory](/armory/)'s tab is "Bundles"), part of a broader rename that split the old "Preset" into independent primitives — see [Agent App API](/internals/agent-app-api/#bundle) for the `bundle.*` RPC surface. The underlying storage, page name, and concepts on this page are unchanged; only the label changed. The App API's older `preset.*` commands still work today as compatibility aliases for `bundle.*`.
:::

## What goes in a Memory

Bundles are **provider-agnostic** — provider and model belong to the agent, chosen at launch, not to the bundle. Today's New/Edit Bundle form exposes Name, Description, and Instructions; Context files, MCP servers, and Skills are persisted in the schema (round-trip cleanly) but aren't yet editable through the form:

| Field | Purpose | Editable in the UI today? |
|---|---|---|
| `instructions` | System prompt / Soul. Long-form text describing the agent's personality, priorities, and behavior. Prepended to the context at launch. | Yes |
| `context_files` | Array of `{path, content}` entries — files (typically project-scoped, like `AGENTS.md` or `CLAUDE.md`) loaded into context on launch. | Not yet — persisted as JSON |
| `mcp_servers` | Per-bundle MCP server configuration, stored as an **inline JSON copy** — not a reference to the [MCP Server primitive](/armory/#mcp-servers) catalog. Editing a catalog server after the fact doesn't change what's already baked into a bundle. | Not yet — persisted as JSON |
| `skills` | Array of **Skill primitive IDs** (a real reference, unlike `mcp_servers`/`context_files`) — see [Skills in the Armory](/armory/#skills). | Not yet — persisted as JSON |
| `provider` / `model` | Vestigial DB columns from before bundles went provider-agnostic. Not exposed in the form; not consumed at launch. | No |

A "vanilla CLI session" is the singleton `is_blank` Memory bundle at the top of the Launch modal — not a bundle with fields merely left empty.

## Session zones and default-continue

A Memory bundle keeps a sequence of **session zones** — one per agent-anchored conversation thread. When you re-launch the same Memory bundle, the agent defaults to **continuing the most recent session** rather than starting fresh: previous turns load into the new pane, the agent's context carries over, and you pick up mid-thread.

If you want a brand-new conversation instead, the Launch modal's **Recent sessions** tab lets you pick a specific older session to re-attach to (or click + to start a fresh zone). The default is "continue most recent" because that matches the workflow people actually have — close a pane, reopen, keep going.

Session zones are anchored to the agent's identity (`agent_id`), not the pane that hosts the conversation. Moving an agent to a new pane preserves its zones; deleting the pane preserves them too. The Swarm pane's history tab is the canonical browser for zones across all your agents.

## How Memory bundles are reached

Bundles are **app-wide only today** — there is no per-agent "Bundle" tab in the current agent-pane setup modal.

**App-wide manager:**
1. Click the hamburger (≡) at the top of the tab bar.
2. Choose **Armory**.
3. Switch to the **Bundles** tab.

:::caution[Naming collision with the per-agent "Memory" tab]
An agent pane's own setup modal (**Agent setup** icon → **Memory** tab) does **not** open the Bundle editor described on this page — it opens the agent's **native memory** ("Brain") notes instead, a different primitive covered below. This is a real, easy-to-trip naming collision: "Memory bundle" (this page, now labeled "Bundle") and "native memory" (below, labeled "Brain" in the Armory) are two distinct things that happen to share the word "memory."
:::

The view registration (`view: "memory"`) and `MemoryPaneViewModel` exist so `pane.open` RPC and right-click menus can reach a bundle-scoped view, but the primary path today is the Armory's Bundles tab.

## Native memory ("Brain")

Distinct from a Bundle, **native memory** is a set of free-form `.md` files an already-running agent reads and writes about itself — notes, running context, anything it wants to persist across turns, independent of any bundle definition.

- **Per-agent:** open an Agent pane → **Agent setup** icon (`id-card`) → **Memory** tab.
- **App-wide:** hamburger menu (≡) → **Armory** → **Brain** tab, browsing every agent's notes in one place.

Both surfaces, and an agent acting on itself, go through the same primitive:

| Surface | Commands |
|---|---|
| App API | `memory.list`, `memory.read`, `memory.write` |
| MCP tools (agent-callable) | `MemoryList`, `MemoryRead`, `MemoryWrite` |

See [Agent App API](/internals/agent-app-api/#memory-native-memory--brain) for the full parameter reference.

## Launch flow

The Launch Agent modal exposes a single **Memory** dropdown alongside the Identity dropdown:

```
┌────────────────────────────────────────────────┐
│ New Agent Instance                              │
│  Name:         [my-instance______]              │
│  Runtime:      [local | container]              │
│                                                 │
│  Identity:     [▼ — Blank (no creds) —    ]     │
│  Memory:       [▼ — Blank (vanilla CLI) — ]     │
│                                                 │
│  [Cancel]              [Launch]                 │
└────────────────────────────────────────────────┘
```

If Memory is blank, the agent launches with the provider's defaults — no instructions, no context files, no per-bundle MCP overrides. A real Memory selection composes the provider's launch args with the bundle's settings.

## Persistence

Memory bundles live in `db_memory_bundles` in the sidecar's `objects.db`:

```
id              TEXT PRIMARY KEY
name            TEXT NOT NULL UNIQUE
description     TEXT
is_blank        INTEGER NOT NULL DEFAULT 0
provider        TEXT
model           TEXT
instructions    TEXT
context_files   TEXT  -- JSON
mcp_servers     TEXT  -- JSON
skills          TEXT  -- JSON
created_at      TEXT NOT NULL
updated_at      TEXT NOT NULL
```

`db_memory_bundles` is part of `objects.db`'s flat schema (`run_object_schema`). Memory replaced the earlier "Forge" concept; the agent-definition catalog ("Forge agents") now lives separately in `db_agent_definitions`.

## Memory and per-instance overrides

A Memory bundle is the **definition** — reusable across many agent instances, edited from the [Armory](/armory/)'s Bundles tab.

When you launch an agent, AgentMux composes the bundle's settings with whatever overrides the running pane has accumulated, then spawns the provider's CLI with the resulting `launchArgs` and env. Two agents using the same Memory bundle but different overrides land on different actual configs at launch.

## See also

- [Armory](/armory/) — where Bundles, native memory, MCP Servers, and Skills are all managed
- [Identity bundles](/identity/) — the other half of agent composition
- [First Agent Setup](/first-agent/) — provider login flows
- [Pane Types](/pane-types/) — where Bundles and native memory surface in the UI
