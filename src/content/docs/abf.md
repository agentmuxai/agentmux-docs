---
title: "Agent Bundle Format (ABF)"
description: "The .abf file moves a bundle between AgentMux installs: instructions, context files, skills and widgets in one archive, built from existing standards."
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. The format below can change between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

**ABF** stands for **Agent Bundle Format**. An `.abf` file is a zip archive that carries a [bundle](/bundles/): its instructions, context files, skills and, if you choose, the [widgets](/widgets/) its agents use. An agent-scoped export adds that agent's Personal Memory. You import one from **Memory → Bundles → Import Bundle**, after a review that shows what is inside.

ABF composes standards that already exist: skills are [Agent Skills](https://agentskills.io) (`SKILL.md`) and instructions are `AGENTS.md` files, both verbatim. The only thing ABF defines itself is the manifest, `bundle.json`.

## What is in an `.abf`

A bundle is a folder in the archive, named after the bundle:

```
my-bundle/
├── bundle.json                  # the manifest
├── instructions/
│   ├── AGENTS.md                # the bundle's instructions
│   ├── <provider>/AGENTS.md     # instructions used only on that provider (for example claude/)
│   ├── context/…                # context files
│   └── project/…                # project instruction files (agent-scoped export only)
├── skills/
│   └── <skill-name>/SKILL.md    # one folder per skill
├── widgets/
│   └── <publisher.name>/…       # a whole widget package: widget.json, its files, widget.sig
├── memory/…                     # Personal Memory files (agent-scoped export only)
└── history/<provider>/…         # session transcripts (agent-scoped export with history only)
```

| Part | What it holds |
|---|---|
| Instructions | The bundle's instructions, plus one override per provider. A provider's override replaces the default when the bundle runs on that provider. |
| Context files | Files the bundle carries, such as `AGENTS.md` or `CLAUDE.md` for a project. |
| Skills | Only skills in the Agent Skills format. A skill in AgentMux's older prompt format is skipped and the export says which. |
| Widgets | Sandboxed widgets only. See [Widgets in a bundle](#widgets-in-a-bundle). |
| Personal Memory | The memory files of **one agent**. Only an agent-scoped export writes them. |
| Project instructions | The instruction files the agent was reading in its repository, recorded for reference. An import lists them and never installs them. |
| Session history | The agent's conversations, one `.jsonl` file per session. Only the export with history writes them. |

A bundle holds no MCP servers and no account requirements: MCP servers belong to [Connectors](/connectors/#mcp-servers) and are bound to agents there. An export never contains a secret.

## `bundle.json`

```json
{
  "$schema": "https://docs.agentmux.ai/schemas/agent-bundle/v0.3/bundle.schema.json",
  "name": "acme-backend-dev",
  "version": "0.1.0",
  "description": "Backend dev bundle: repo conventions, GitHub tooling, deploy skills",
  "suggestedFor": { "provider": "claude", "vendor": "anthropic" },
  "components": {
    "instructions": {
      "default": ["instructions/AGENTS.md"],
      "claude": ["instructions/claude/AGENTS.md"]
    },
    "skills": ["skills/deploy-checklist"]
  },
  "metadata": {}
}
```

| Field | Meaning |
|---|---|
| `$schema` | The format version. AgentMux writes the one above. |
| `name` | The bundle's name, as a folder-safe slug. |
| `version` | The bundle's own content version. AgentMux writes `0.1.0`; bump it yourself before you share the bundle. |
| `description` | The bundle's description. |
| `suggestedFor` | Which provider (`claude`, `codex`, `gemini`, …) and vendor (`anthropic`, `openai`, or `custom` for a non-default base URL) the bundle was made for. A hint, left out when the bundle has neither. The agent's own provider decides which CLI runs. |
| `components` | What the archive holds, as paths inside it. `instructions` is an object with a `default` list and one list per provider. A key AgentMux doesn't know is ignored. |
| `metadata` | Free-form, empty on export. |

The JSON Schemas are published at [`/schemas/agent-bundle/v0.3/bundle.schema.json`](/schemas/agent-bundle/v0.3/bundle.schema.json) and [`/schemas/agent-bundle/v0.3/requirements.schema.json`](/schemas/agent-bundle/v0.3/requirements.schema.json).

An agent-scoped export adds `components.memory` (the `memory/` files), `components.projectInstructions` (entries with the file's original `path`, a `contentHash` and an `owner`) and, with history, `components.history`.

## Widgets in a bundle

A bundle can carry the [widgets](/widgets/) its agents use. `bundle.json` lists them under `components.widgets`, each with its package's content hash, and the archive holds each package whole under `widgets/<id>/`, binary files included:

```json
"components": {
  "instructions": { "default": ["instructions/AGENTS.md"] },
  "widgets": [{ "id": "acme.board", "version": "1.2.0", "hash": "<content hash>" }]
}
```

- Only **sandboxed** widgets travel in a bundle; a trusted one is shown as not importable.
- Importing offers each widget with its version, who signed it and what it may do. Each one you keep is copied in and **asks for your approval** like any widget. A bundle never approves a widget; declining one leaves the rest of the bundle imported.
- A widget whose files don't match the hash `bundle.json` lists isn't offered.
- At most 20 widgets and 100 MB of widget files per bundle. Only a zip carries widgets.

## Importing

**Memory → Bundles → Import Bundle** asks for an `.abf` file and reads it. Nothing is created until you confirm. The review shows:

- **Bundle name**, with a hint and a suggested alternative when a bundle of that name already exists.
- **Include instructions**, with a preview of the text.
- **Context files** the archive carries.
- The skills, each of which you can leave out. A skill whose name is already in use is shown as a collision.
- The widgets, each with its signer and permissions.
- **Not imported: MCP servers**, when the archive lists any. Add them in [Connectors](/connectors/#mcp-servers).
- **Account requirements**, when the archive lists any, matched against your accounts. An unmatched one is shown as unresolved.

A warning on the review (a path that isn't safe, a missing file, an entry left out) can be dismissed with **Dismiss warnings**; the import itself never installs what it flagged. An archive is refused as a whole when it is over 100 MB, when one entry is over 10 MB uncompressed, or when its entries total over 50 MB uncompressed.

AgentMux also imports archives written by earlier AgentMux releases.

Personal Memory travels differently from the rest. The review's Import never writes it into a bundle, and says so. An agent-scoped import (`bundle.import_for_agent`) writes the `memory/` files into one agent, and only an agent that has no Personal Memory yet: it refuses rather than overwrite.

## Exporting

There is no export button in the app yet. Export is a MuxAPI command, so an agent or a script runs it:

| Command | What it writes |
|---|---|
| `bundle.export` | One bundle: its instructions, context files and skills. With `format: "zip"` it returns the archive, and `widgets: ["<id>", …]` adds installed sandboxed widgets. Without `format` it returns the file list. |
| `bundle.export_for_agent` | The same, plus one agent's Personal Memory and project instructions. |
| `bundle.export_for_agent_with_history` | The same, plus the agent's session transcripts under `history/`, newest first, until 500 MB in all. A transcript over 200 MB is skipped whole, with a warning. It always returns a zip. |

Every export lists what it could not carry: skills in the prompt format, a malformed context-file list, two paths that would collide. Read the warnings in the response before you share the file.

## See also

- [Bundles](/bundles/): what a bundle is and how an agent takes several.
- [Memory](/memory/): where bundles, skills and memory are managed.
- [Connectors](/connectors/): the accounts and MCP servers a bundle doesn't carry.
- [Widgets](/widgets/): the widget packages a bundle can carry.
