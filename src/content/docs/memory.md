---
title: "Bundles"
description: Reusable packages of an agent's instructions, MCP servers, memory and skills, managed in Knowledge → Bundles and chosen at launch. Also covers native memory.
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

A **Bundle** packages what an agent starts with: its instructions (system prompt, "Soul"), context files, MCP servers, skills and memory. You manage bundles in [Knowledge → Bundles](/knowledge/#bundles) and choose one for an agent when you create it. A bundle can be exported as, and imported from, an [Agent Bundle Format (ABF)](/abf/) file.

:::note[Earlier names]
Bundles were called "Memory bundles", and before that "Presets". See [Agent App API](/internals/agent-app-api/#bundle) for the `bundle.*` RPC surface; the older `preset.*` compatibility aliases have been retired (`crates/srv/src/backend/rpc_types/commands.rs`).
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
| `skills` | **Skill primitive IDs** — see [Knowledge → Skills](/knowledge/#skills). | Yes, after saving |

A "vanilla CLI session" is the singleton `is_blank` bundle at the top of the Launch modal — not a bundle with fields merely left empty.

## Session zones and default-continue

A bundle keeps a sequence of **session zones** — one per agent-anchored conversation thread. When you re-launch the same bundle, the agent defaults to **continuing the most recent session** rather than starting fresh: previous turns load into the new pane, the agent's context carries over, and you pick up mid-thread.

If you want a brand-new conversation instead, the Launch modal's **Recent sessions** tab lets you pick a specific older session to re-attach to (or click + to start a fresh zone). The default is "continue most recent" because that matches the workflow people actually have — close a pane, reopen, keep going.

Session zones are anchored to the agent's identity (`agent_id`), not the pane that hosts the conversation. Moving an agent to a new pane preserves its zones; deleting the pane preserves them too.

## Where bundles are managed

Bundles are managed **app-wide only**:

1. Click **Knowledge** in the widget bar, or choose **Knowledge** from the hamburger menu (≡).
2. Switch to the **Bundles** section.

In an agent pane, **Stash** → **Startup** picks which existing bundle supplies that agent's startup instructions; it links to **Knowledge → Bundles** but doesn't edit bundles itself.

:::caution[Bundles are not native memory]
An agent pane's **Stash** → **Personal Memory** tab, and the **Global** and **Personal** sections of [Knowledge](/knowledge/), do **not** open the Bundle editor described on this page — they open **Global Memory** and **native memory**, different primitives covered below and on the Knowledge page.
:::

The view registration (`view: "memory"`) and `MemoryPaneViewModel` exist so `pane.open` RPC and right-click menus can reach a bundle-scoped view, but the primary path is Knowledge → Bundles.

## Native memory

Distinct from a Bundle, **native memory** is a set of free-form `.md` files an already-running agent reads and writes about itself — notes, running context, anything it wants to persist across turns, independent of any bundle definition. (Earlier releases labeled it "Brain".)

- **Per-agent:** open an Agent pane → **Stash** icon (`backpack`) → **Personal Memory** tab.
- **App-wide:** **Knowledge** → **Personal**, browsing every agent's notes in one place. This is also where you adopt an agent's earlier memory and release its memory folders — see [Knowledge → Personal](/knowledge/#personal).

Both surfaces, and an agent acting on itself, go through the same primitive:

| Surface | Commands |
|---|---|
| App API | `memory.list`, `memory.read`, `memory.write` |
| MCP tools (agent-callable) | `MemoryList`, `MemoryRead`, `MemoryWrite`, `MemoryHistory`, `MemoryDiff`, `MemoryRevert` |

See [Agent App API](/internals/agent-app-api/#memory-native-memory--brain) for the full parameter reference.

### The memory record: memory follows the agent

A provider keeps an agent's memory files in a folder tied to its account and working directory (for Claude Code, `$CLAUDE_CONFIG_DIR/projects/<cwd>/memory`), so switching account, working directory or channel used to leave them behind. AgentMux now keeps its own **memory record** for each agent, keyed by the agent's ID rather than by account, folder or channel, and treats it as the source of truth (`crates/srv/src/backend/memory_record.rs`). The record keeps every version of every file, which is what the history, diff and revert views show.

- **At each launch**, before the provider CLI starts, AgentMux reconciles the agent's memory folder with the record: files missing from the folder are written back, and changes found on disk are recorded (`crates/srv/src/backend/memory_reconcile.rs`). If a file changed on both sides, the disk version wins and the other is kept beside it as a `<name>__conflict_<id>.md` file. This is how memory follows an agent into a new account, working directory or channel.
- **While the agent runs**, AgentMux watches its memory folder and records a file Claude writes once it has been unchanged for about 2 seconds, with a periodic sweep as a backup (`crates/srv/src/backend/native_memory_drift.rs`).
- **AgentMux's own writes** — `MemoryWrite`, edits in Knowledge → Personal, revert — go into the record first, then to the file.
- **Shared folders:** two agents can end up with the same memory folder (same account and working directory, for example). AgentMux only syncs the record with a folder it can show belongs to this agent alone; a shared folder is left as it is (`crates/srv/src/backend/memory_dir_claims.rs`). The first time an agent's record meets a folder, a file whose content another agent's record already has is held for you to review instead of being taken over; it shows up in the adoption panel in Knowledge → Personal.

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

The table is defined in `crates/srv/src/backend/storage/migrations.rs`, both in `objects.db`'s flat schema (`run_object_schema`) and in the shared store's schema (`run_shared_store_schema`). [Global Memory](/knowledge/#global) entries are rows in the same table with `is_global` set. Memory replaced the earlier "Forge" concept; the agent-definition catalog ("Forge agents") now lives separately in `db_agent_definitions`.

## Bundles and per-instance overrides

A bundle is the **definition** — reusable across many agent instances, edited in [Knowledge → Bundles](/knowledge/#bundles).

When you launch an agent, AgentMux composes the bundle's settings with whatever overrides the running pane has accumulated, then spawns the provider's CLI with the resulting `launchArgs` and env. Two agents using the same bundle but different overrides land on different actual configs at launch.

## See also

- [Knowledge](/knowledge/) — where Bundles, Global Memory, native memory and Skills are managed
- [Connectors](/connectors/) — accounts and MCP servers
- [Agent Bundle Format (ABF)](/abf/) — the bundle file format
- [Identity bundles](/identity/) — the other half of agent composition
- [First Agent Setup](/first-agent/) — provider login flows
- [Pane Types](/pane-types/) — where Bundles and native memory surface in the UI
