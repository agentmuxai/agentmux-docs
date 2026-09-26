---
title: "Memory bundles"
description: Reusable, provider-agnostic agent capability stacks — instructions, MCP, skills — selectable at launch.
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

A **Memory bundle** is a reusable, **provider-agnostic** capability pack — system prompt ("Soul"), instructions, context files, MCP servers, skills. Provider and model belong to the agent, chosen separately at launch, not to the bundle. Selectable at launch from the Launch Agent modal.

:::note[Also called "Bundle"]
The UI now labels this primitive **Bundle** (the [Armory](/armory/)'s tab is "Bundles"), part of a broader rename that split the old "Preset" into independent primitives — see [Agent App API](/internals/agent-app-api/#bundle) for the `bundle.*` RPC surface. The page name and concepts on this page are unchanged. The App API's older `preset.*` compatibility aliases have been retired; `bundle.*` is the only command set now (`agentmux-srv/src/backend/rpc_types/commands.rs`).
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

Session zones are anchored to the agent's identity (`agent_id`), not the pane that hosts the conversation. Moving an agent to a new pane preserves its zones; deleting the pane preserves them too.

## How Memory bundles are reached

Bundles are **app-wide only today** — there is no per-agent "Bundle" tab in the current agent-pane setup modal.

**App-wide manager:**
1. Click the hamburger (≡) at the top of the tab bar.
2. Choose **Armory**.
3. Switch to the **Bundles** tab.

:::caution[Naming collision with the "Memory" tabs]
An agent pane's **Stash** → **Personal Memory** tab, and the Armory's **Memory** tab, do **not** open the Bundle editor described on this page — they open **native memory** and **Global Memory**, different primitives covered below and on the [Armory](/armory/#memory) page. "Memory bundle" (this page, now labeled "Bundle") and "native memory" are two distinct things that happen to share the word "memory."
:::

The view registration (`view: "memory"`) and `MemoryPaneViewModel` exist so `pane.open` RPC and right-click menus can reach a bundle-scoped view, but the primary path today is the Armory's Bundles tab.

## Native memory

Distinct from a Bundle, **native memory** is a set of free-form `.md` files an already-running agent reads and writes about itself — notes, running context, anything it wants to persist across turns, independent of any bundle definition. (Earlier releases labeled it "Brain".)

- **Per-agent:** open an Agent pane → **Stash** icon (`backpack`) → **Personal Memory** tab.
- **App-wide:** hamburger menu (≡) → **Armory** → **Memory** tab → **Personal**, browsing every agent's notes in one place. This is also where you adopt an agent's earlier memory and release its memory folders — see [Armory → Personal](/armory/#personal).

Both surfaces, and an agent acting on itself, go through the same primitive:

| Surface | Commands |
|---|---|
| App API | `memory.list`, `memory.read`, `memory.write` |
| MCP tools (agent-callable) | `MemoryList`, `MemoryRead`, `MemoryWrite`, `MemoryHistory`, `MemoryDiff`, `MemoryRevert` |

See [Agent App API](/internals/agent-app-api/#memory-native-memory--brain) for the full parameter reference.

### The memory record: memory follows the agent

A provider keeps an agent's memory files in a folder tied to its account and working directory (for Claude Code, `$CLAUDE_CONFIG_DIR/projects/<cwd>/memory`), so switching account, working directory or channel used to leave them behind. AgentMux now keeps its own **memory record** for each agent, keyed by the agent's ID rather than by account, folder or channel, and treats it as the source of truth (`agentmux-srv/src/backend/memory_record.rs`). The record keeps every version of every file, which is what the history, diff and revert views show.

- **At each launch**, before the provider CLI starts, AgentMux reconciles the agent's memory folder with the record: files missing from the folder are written back, and changes found on disk are recorded (`agentmux-srv/src/backend/memory_reconcile.rs`). If a file changed on both sides, the disk version wins and the other is kept beside it as a `<name>__conflict_<id>.md` file. This is how memory follows an agent into a new account, working directory or channel.
- **While the agent runs**, AgentMux watches its memory folder and records a file Claude writes once it has been unchanged for about 2 seconds, with a periodic sweep as a backup (`agentmux-srv/src/backend/native_memory_drift.rs`).
- **AgentMux's own writes** — `MemoryWrite`, edits in the Armory, revert — go into the record first, then to the file.
- **Shared folders:** two agents can end up with the same memory folder (same account and working directory, for example). AgentMux only syncs the record with a folder it can show belongs to this agent alone; a shared folder is left as it is (`agentmux-srv/src/backend/memory_dir_claims.rs`). The first time an agent's record meets a folder, a file whose content another agent's record already has is held for you to review instead of being taken over; it shows up in the Armory's adoption panel.

The older `db_agent_native_memory` mirror is still written through on list, read and write, but it is no longer the main mechanism. See `docs/specs/SPEC_MEMORY_FOLLOWS_THE_AGENT_2026_09_24.md` in the main repo for the design.

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

Memory bundles live in the `db_bundles` table (named `db_memory_bundles` before a storage rename):

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

The table is defined in `agentmux-srv/src/backend/storage/migrations.rs`, both in `objects.db`'s flat schema (`run_object_schema`) and in the shared store's schema (`run_shared_store_schema`). [Global Memory](/armory/#global) entries are rows in the same table with `is_global` set. Memory replaced the earlier "Forge" concept; the agent-definition catalog ("Forge agents") now lives separately in `db_agent_definitions`.

## Memory and per-instance overrides

A Memory bundle is the **definition** — reusable across many agent instances, edited from the [Armory](/armory/)'s Bundles tab.

When you launch an agent, AgentMux composes the bundle's settings with whatever overrides the running pane has accumulated, then spawns the provider's CLI with the resulting `launchArgs` and env. Two agents using the same Memory bundle but different overrides land on different actual configs at launch.

## See also

- [Armory](/armory/) — where Bundles, Global Memory, native memory, MCP Servers, and Skills are all managed
- [Identity bundles](/identity/) — the other half of agent composition
- [First Agent Setup](/first-agent/) — provider login flows
- [Pane Types](/pane-types/) — where Bundles and native memory surface in the UI
