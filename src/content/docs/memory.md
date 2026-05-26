---
title: "Memory bundles"
description: Reusable agent personality + capability stacks — provider, model, instructions, MCP, skills — selectable at launch.
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

A **Memory bundle** is a reusable agent definition — everything that makes the agent behave like itself. Provider, model, system prompt ("Soul"), instructions, context files, MCP servers, skills. Selectable at launch from the Launch Agent modal.

## What goes in a Memory

| Field | Purpose |
|---|---|
| `provider` | One of the seven supported providers — `claude`, `codex`, `gemini`, `openclaw`, `kimi`, `copilot`, `pi`. Determines the CLI binary, controller type, and stream parser. |
| `model` | Model identifier passed to the provider (e.g. `claude-sonnet-4-6`). |
| `instructions` | System prompt / Soul. Long-form text describing the agent's personality, priorities, and behavior. Prepended to the context at launch. |
| `context_files` | Array of `{path, content}` entries — files (typically project-scoped, like `AGENTS.md` or `CLAUDE.md`) loaded into context on launch. |
| `mcp_servers` | Per-bundle MCP server configuration. Overrides the global `mcp:servers` setting. |
| `skills` | Reusable capabilities (prompts, commands, workflows, MCP tools) attached to the bundle. |

A "vanilla CLI session" is a Memory bundle with all fields blank except `provider`. The singleton blank Memory at the top of the Launch modal selects exactly this case.

## How Memory is reached

Memory is **not a widget-bar entry.** Two paths reach it:

**Per-agent (the original surface):**
1. Open an Agent pane (pinned in the widget bar).
2. Click the cog (⚙) in the pane header.
3. Switch to the **Memory** tab.

Same shape as the Identity tab — list of bundles on the left, detail editor on the right.

**App-wide manager (hamburger menu):**
1. Click the hamburger (≡) at the top of the tab bar.
2. Choose **Identity & Memory**.
3. The shared bundle manager opens — Memory and Identity bundles live side-by-side in the same modal.

The hamburger path opens a singleton modal: if already open in another window, clicking focuses that window rather than spawning a duplicate.

The view registration (`view: "memory"`) and `MemoryPaneViewModel` exist so `pane.open` RPC and right-click menus can reach the view, but the primary paths are the two above.

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

A Memory bundle is the **definition** — reusable across many agent instances. The Memory tab inside an Agent pane is the editor for the bundle plus any per-instance overrides on top.

When you launch an agent, AgentMux composes the bundle's settings with whatever overrides the running pane has accumulated, then spawns the provider's CLI with the resulting `launchArgs` and env. Two agents using the same Memory bundle but different overrides land on different actual configs at launch.

## See also

- [Identity bundles](/identity/) — the other half of agent composition
- [First Agent Setup](/first-agent/) — provider login flows
- [Pane Types](/pane-types/) — where Memory bundles surface in the UI
