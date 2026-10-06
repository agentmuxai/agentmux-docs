---
title: "Knowledge"
description: The Knowledge pane — Global instructions, each agent's Personal memory, Skills, and the Bundles that package them.
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

**Knowledge** is the app-wide pane for what agents know and carry: the instructions every agent starts with, what each agent writes in its own memory, skills, and the bundles that package them. Its companion pane, [Connectors](/connectors/), holds what agents connect to outside AgentMux: accounts and MCP servers.

Knowledge is a regular pane (icon: `book`), opened from the widget bar like any other. It has four sections, in a rail down the left side (`frontend/app/view/knowledge/knowledge.tsx`):

| Section | What it manages |
|---|---|
| **Global** | Instructions composed into every agent's startup file (Global Memory) |
| **Personal** | What each agent writes in its own memory (its native memory files), with history |
| **Skills** | The Skill catalog: global skills plus any agent-private ones |
| **Bundles** | Instructions, MCP servers, memory and skills packaged to bind to an agent; imports [ABF](/abf/) (`.abf`) files |

Knowledge opens on **Global**. The pane title names the section, for example "Knowledge · Skills". In a narrow pane the rail becomes a tab bar across the top. `Ctrl` + mouse wheel zooms the pane.

## Opening Knowledge

- **Widget bar:** click **Knowledge**. It is pinned by default. If a Knowledge pane is already open in the tab, the click focuses it instead of opening another.
- **Hamburger menu:** click ≡ in the top tab bar and choose **Knowledge**.
- **Command palette:** run **Knowledge**. Searching for "memory", "skills" or "bundles" also finds it.
- **macOS app menu:** **Knowledge…**.

Links elsewhere in the app open Knowledge on the right section:

- In an agent's Stash, the **Skills** tab's **Browse all in Knowledge →** button and its **edit it there** link open **Skills**.
- The Stash's **Startup** tab links to **Knowledge → Bundles**.

A pane or layout saved while it was the Armory (the earlier pane that held both Connectors and Knowledge) opens as the matching new pane: Memory, Skills and Bundles as Knowledge, the rest as Connectors.

## Global

**Global Memory** is a set of entries that every agent inherits at launch (`frontend/app/view/global-bundle/global-bundle-manager.tsx`). The section reads "Every agent inherits this at launch — takes effect after a restart. Drag entries to change their order." It shows a tile per entry, a read-only `CLAUDE.md` tile, a **Combined preview** of what agents receive, and **+ Add memory**. Click a tile to open the entry with its history, a diff view and revert.

Claude Code agents also get their memory again whenever Claude Code starts a new session, including after `/clear` and after a compaction, but not when a session is resumed. AgentMux delivers it through Claude Code's `SessionStart` hook: Global Memory, AgentMux's Operator Config entries and the agent's Personal Memory, split into parts of about 10,000 characters (`crates/bashwrap/src/sessionstart.rs`). Once it has been delivered, the agent pane shows a notice such as "🧠 Memory reinjected — 3 global, 2 personal (~4.1k tok, est.)"; hover it for each entry's size.

Every change to Global Memory is also written to a Global Memory record that keeps each entry's versions and the order of entries (`crates/srv/src/backend/global_memory_record.rs`). Channels that share your main accounts share one Global Memory; an isolated channel (for example a development build) keeps its own.

On an isolated channel, the Global section shows a banner when another scope has entries this channel doesn't: "This channel keeps its own Global Memory. … has N entries it doesn't: …". **Bring them here** copies them in (an entry whose name is already taken is renamed); agents get them at their next launch. Nothing is shared without this click (`frontend/app/view/global-bundle/GlobalMemoryImportBanner.tsx`).

Agents can read and change Global Memory with the `GlobalMemoryList`, `GlobalMemoryRead`, `GlobalMemoryWrite`, `GlobalMemoryRemove`, `GlobalMemoryHistory`, `GlobalMemoryDiff` and `GlobalMemoryRevert` MCP tools.

## Personal

The app-wide view of every agent's **native memory** — free-form `.md` files an agent reads and writes about itself (notes, running context, anything it wants to persist between turns). This is a different primitive from a Bundle: a Bundle is a reusable *definition* you choose for an agent; native memory is a scratchpad an already-running agent maintains for itself. Pick an agent, then a file, to see its content, history and diffs, and to revert to an earlier version. See [Bundles → Native memory](/memory/#native-memory) for how AgentMux keeps it.

Above an agent's files, two collapsible panels (`frontend/app/view/native-memory/`):

- **Earlier memory found under N other account(s)** appears when the agent has memory folders from accounts it used before, or files held back because their content matches another agent's memory. Tick the folders and choose **Adopt selected…**.
- **Memory folders this agent claims (N)** lists the folders the agent holds, when each was claimed, and whether other agents also use it. **Release…** gives a folder up, so another agent that uses it can sync its memory there; if the agent still uses it, its next launch claims it again.

Adopting and releasing are confirmed in a separate AgentMux window ("Adopt earlier memory into *agent*?" with **Cancel** / **Adopt**; "Release *agent*'s claim on this folder?" with **Cancel** / **Release**), not in the pane, so an agent driving the UI can't confirm them for you. A request left unanswered expires after 10 minutes (`crates/cef/src/memory_adoption.rs`). Adopted files appear in the agent's folder at its next launch.

An **Unverified folder** badge next to the agent's name means AgentMux found the folder from the agent's settings rather than from the agent's own launch; it is read-only until the agent launches.

Per-agent, the same memory is reached via the agent pane's **Stash → Personal Memory** tab. Agents use the `MemoryList`, `MemoryRead`, `MemoryWrite`, `MemoryHistory`, `MemoryDiff` and `MemoryRevert` MCP tools on their own memory — see [Agent App API](/internals/agent-app-api/).

## Skills

The catalog of Skill primitives, with the same global-vs-private shape as [MCP servers](/connectors/#mcp-servers) (`skill.catalog.*` for global, `skill.*` for agent-scoped). Click **+ New skill** to add a global one. An agent's own Skills tab (Stash → Skills) lists what that agent can see and lets it bind or unbind global skills. See [Agent App API](/internals/agent-app-api/#skill) for the full RPC reference.

## Bundles

The app-wide view of all Bundles. A bundle packages an agent's instructions, MCP servers, memory and skills; you choose one for an agent when you create it. **+ New Bundle** creates one; **Import Bundle** brings in an `.abf` file, and any bundle can be exported as one. See [Bundles](/memory/) for the full reference and [Agent Bundle Format (ABF)](/abf/) for the file format.

Bundles are managed app-wide from this section only. In an agent's Stash, the **Startup** tab picks which existing bundle supplies that agent's startup instructions; it doesn't create or edit bundles.

## Per-agent: the Stash

Some sections have a per-agent equivalent reached from inside an agent pane:

1. Open any Agent pane → click the **Stash** icon (`backpack`) in the pane header.
2. A drawer opens under the pane header with tabs: **Accounts · Personal Memory · MCP Servers · Skills · Startup · Registration** (`frontend/app/view/agent/components/AgentStashModal.tsx`). Each tab is scoped to that agent rather than the app-wide catalog.

**Personal Memory**, **Skills** and **Startup** are the per-agent side of Knowledge; **Accounts** and **MCP Servers** are the per-agent side of [Connectors](/connectors/#per-agent-the-stash).

## Portable bundles (beta spec)

**[Agent Bundle Format (ABF)](/abf/)** is a beta specification for packaging a Bundle's instructions, skills, MCP servers, and credential requirements into one portable, versioned directory — composing existing standards (Agent Skills/SKILL.md, MCP server.json, AGENTS.md) rather than inventing new ones. The Bundles section has an **Import Bundle** button for bringing in an ABF bundle. See the [rollout plan](/abf/#rollout-plan) for what's built vs. planned.

## See also

- [Connectors](/connectors/) — Accounts and MCP servers
- [Bundles](/memory/) — full Bundle reference, and how AgentMux keeps native memory
- [Agent Bundle Format (ABF)](/abf/) — beta spec for portable, exportable bundles
- [Agent App API](/internals/agent-app-api/) — `skill.*`, `bundle.*` and `memory.*` RPC catalogs
- `docs/specs/SPEC_MEMORY_FOLLOWS_THE_AGENT_2026_09_24.md` in the main repo — the memory record, adoption and folder claims
