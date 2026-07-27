---
title: "Armory Bundle Format (ABF)"
description: A portable, versioned unit for an agent's instructions, skills, MCP servers, and credential requirements — composing existing standards instead of inventing new ones.
---

:::caution[Beta specification]
ABF is a **v0.1 beta spec, not a shipped AgentMux feature**. The manifest and requirements schemas below may change before 1.0, and AgentMux's own exporter/importer hasn't been built yet — this page documents the target format. See the [rollout plan](#rollout-plan) for what's built vs. planned, and [report feedback](https://github.com/agentmuxai/agentmux/issues).
:::

ABF is a portable, versioned unit for an agent's instructions, skills, MCP servers, and credential requirements — composing existing won standards (Agent Skills, MCP `server.json`, AGENTS.md) instead of inventing new ones, and standardizing only the two things nobody else has: the composition manifest and the credential-requirement declaration.

Full research behind this proposal — four adversarially-verified deep-research passes, ~61 confirmed claims — lives in [`docs/specs/REPORT_ARMORY_BUNDLE_STANDARD_RESEARCH_2026_07_16.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/REPORT_ARMORY_BUNDLE_STANDARD_RESEARCH_2026_07_16.md) in the AgentMux repo.

## Why a new format?

No standard — formal or de facto — bundles an agent's instructions, MCP configs, skills, and credential references together. What exists instead is a layered landscape of strong per-category standards with nothing owning composition:

| Category | Standard | Armory today | Distance |
|---|---|---|---|
| Skills | **Agent Skills (SKILL.md)** — vendor-neutral | Proprietary slash-commands | Misaligned — biggest single win available |
| MCP configs | **`server.json` + `mcpServers`** | Emits standard `mcpServers` | Nearly aligned already |
| Instructions | **AGENTS.md** — Linux Foundation governed | `instructions` + `context_files` in DB | Alignable, no schema to adopt |
| Credentials | None, by universal design | `SecretRef` typed pointers | Ahead of the field already |
| Dynamic memory | None — least converged category of all | None | Explicit non-goal for v0.1 |
| Composition | Young (APM, AFPS, Claude plugins) | DB-only, no export | The open space — nothing owns it yet |

ABF's design principle: **compose won standards, invent only where nothing exists.**

## On-disk format

A bundle is a directory (or a zip of one). Every component sub-path is a verbatim instance of its own existing standard — ABF doesn't reformat SKILL.md or `server.json`, it just points at them.

```
my-bundle/
├── armory.json              # manifest -- the only invented schema
├── instructions/
│   ├── AGENTS.md            # primary instruction file (AGENTS.md convention)
│   └── context/…            # context files, referenced from AGENTS.md
├── skills/
│   └── <skill-name>/
│       └── SKILL.md         # Agent Skills spec, verbatim -- no extensions
├── mcp/
│   └── <server-name>.server.json   # MCP server.json schema, verbatim
└── accounts/
    └── requirements.json    # credential REQUIREMENTS -- never secrets
```

## `armory.json` manifest

The only invented schema. `components` is deliberately open-ended — unrecognized keys are ignored, matching the tolerance pattern Claude Code plugins use, so a future `"memory"` key can land without a breaking version bump.

**Raw JSON Schema:** [`/schemas/armory-bundle/v0.1/bundle.schema.json`](/schemas/armory-bundle/v0.1/bundle.schema.json)

```jsonc
{
  "$schema": "https://docs.agentmux.ai/schemas/armory-bundle/v0.1/bundle.schema.json",
  "name": "acme-backend-dev",
  "version": "1.2.0",
  "description": "Backend dev bundle: repo conventions, GH tooling, deploy skills",
  "provider": { "preferred": "claude", "model": "claude-sonnet-5" },
  "components": {
    "instructions": ["instructions/AGENTS.md"],
    "skills": ["skills/deploy-checklist"],
    "mcpServers": ["mcp/github.server.json"],
    "accounts": "accounts/requirements.json"
  },
  "compatibility": { "agentmux": ">=0.54" },
  "metadata": {}
}
```

## Credential requirements

The other invented piece — and the thing no other format in the landscape solves. Declares *what identities a bundle needs*, resolved locally against the importer's own accounts at import/launch time. Secret values never serialize, matching the universal reference-don't-bundle pattern every credential format in the research converged on independently.

**Raw JSON Schema:** [`/schemas/armory-bundle/v0.1/requirements.schema.json`](/schemas/armory-bundle/v0.1/requirements.schema.json)

```jsonc
{
  "requirements": [
    {
      "id": "gh-main",
      "provider": "github",
      "kind": "oauth",
      "scopes": ["repo", "workflow"],
      "env": "GITHUB_TOKEN",
      "optional": false
    }
  ]
}
```

## Rollout plan

Ordered so every phase is independently shippable and none blocks the others.

| Phase | What | Status |
|---|---|---|
| **Phase 0** | Align skills with Agent Skills — add SKILL.md support to `db_skills`, materialize agent-skill-format entries as `.claude/skills/<name>/SKILL.md` at launch alongside the existing slash-command path. | In progress |
| **Phase 1** | Exporter — `armory export bundle <id>`, serializing a bundle + referenced skills/MCP servers into the on-disk ABF layout. Pure read-side, zero schema risk. | Planned |
| **Phase 2** | Importer + validation — JSON Schema validation of `armory.json`, Agent Skills/`server.json` reference validation, account-requirement resolution against the local account store. | Planned |
| **Phase 3** | Armory UI — export/import buttons on the Bundles rail, with an import-review sheet showing exactly what will be created before anything is. | Planned |
| **Phase 4** | OCI distribution — `armory push/pull` against any OCI registry, following the Dev Container Features packaging blueprint. Private registries (Harbor, Artifactory, GHCR) work day one. | Planned |
| **Phase 5** | Registry + spec publication — publish the `armory.json`/`requirements.json` schemas at stable, versioned URLs, open a metadata-only bundle index. This page and its schemas are that publication. | Shipped |

## See also

- [Armory](/armory/) — the app-wide hub these bundles compose (Accounts, Bundles, Skills, MCP Servers)
- [Full research report](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/REPORT_ARMORY_BUNDLE_STANDARD_RESEARCH_2026_07_16.md) — four research passes, landscape analysis, and the original proposal this page is based on
- [Report feedback](https://github.com/agentmuxai/agentmux/issues) on GitHub
