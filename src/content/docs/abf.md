---
title: "Armory Bundle Format (ABF)"
description: A portable, versioned unit for an agent's instructions, skills, MCP servers, native memory, and credential requirements — composing existing standards instead of inventing new ones.
---

:::caution[Beta specification]
ABF is now a **v0.2 beta spec** (up from v0.1) — the manifest and requirements schemas below may still change before 1.0. AgentMux's own exporter and importer have shipped (Armory's Bundles rail: export any bundle as a single `.abf` file, import one with a selective, collision-aware review step); OCI registry distribution (`armory push/pull`) has not been built yet. Since 2026-08-15, binding a bundle to an agent is no longer optional — see [every agent gets its own ABF](#every-agent-gets-its-own-abf) — and since 2026-08-18 a bundle can also carry its own MCP Server and Skill references — see [bundle-as-container v2](#bundle-as-container-v2-mcp-servers-and-skills-at-the-bundle-level). See the [rollout plan](#rollout-plan) for what's built vs. planned, and [report feedback](https://github.com/agentmuxai/agentmux/issues).
:::

ABF is a portable, versioned unit for an agent's instructions, skills, MCP servers, native memory, and credential requirements — composing already-established standards (Agent Skills, MCP `server.json`, AGENTS.md) instead of inventing new ones, and standardizing only the two things nobody else has: the composition manifest and the credential-requirement declaration.

Full research behind this proposal — four adversarially-verified deep-research passes, ~61 confirmed claims — lives in [`docs/specs/REPORT_ARMORY_BUNDLE_STANDARD_RESEARCH_2026_07_16.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/REPORT_ARMORY_BUNDLE_STANDARD_RESEARCH_2026_07_16.md) in the AgentMux repo.

## Why a new format?

No standard — formal or de facto — bundles an agent's instructions, MCP configs, skills, and credential references together. What exists instead is a layered landscape of strong per-category standards with nothing owning composition:

| Category | Standard | Armory today | Distance |
|---|---|---|---|
| Skills | **Agent Skills (SKILL.md)** — vendor-neutral | Proprietary slash-commands | Misaligned — biggest single win available |
| MCP configs | **`server.json` + `mcpServers`** | Emits standard `mcpServers` | Nearly aligned already |
| Instructions | **AGENTS.md** — Linux Foundation governed | `instructions` + `context_files` in DB | Alignable, no schema to adopt |
| Credentials | None, by universal design | `SecretRef` typed pointers | Ahead of the field already |
| Dynamic memory | None — least converged category of all | Bundleable as of v0.2 (agent-scoped export/import) | Still AgentMux-native — no external standard exists to align to, and none is expected |
| Composition | Young (APM, AFPS, Claude plugins) | DB-only, no export | The open space — nothing owns it yet |

ABF's design principle: **compose already-established standards, invent only where nothing exists.**

## On-disk format

A bundle is a directory (or a zip of one). Every component sub-path is a verbatim instance of its own existing standard — ABF doesn't reformat SKILL.md or `server.json`, it just points at them.

```
my-bundle/
├── armory.json              # manifest -- the only invented schema
├── instructions/
│   ├── AGENTS.md            # default instruction file (AGENTS.md convention)
│   ├── context/…            # context files, referenced from AGENTS.md
│   └── <provider>/AGENTS.md # optional harness-specific variant (v0.2+, e.g. claude/)
├── skills/
│   └── <skill-name>/
│       └── SKILL.md         # Agent Skills spec, verbatim -- no extensions
├── mcp/
│   └── <server-name>.server.json   # MCP server.json schema, verbatim
├── memory/                  # native memory files (v0.2+, agent-scoped export only)
│   └── <filename>
└── accounts/
    └── requirements.json    # credential REQUIREMENTS -- never secrets
```

`memory/` is populated only by an agent-scoped export (`bundle.export_for_agent`) — a plain bundle export skips it entirely, since native memory belongs to one specific agent's accumulated session state, not to a bundle in the abstract. See [ABF v0.2](#abf-v02-provider-aware-components-and-native-memory) below.

## `armory.json` manifest

The only invented schema. `components` is deliberately open-ended — unrecognized keys are ignored, matching the tolerance pattern Claude Code plugins use, which is exactly what let v0.2 add `memory` without a breaking version bump.

**Raw JSON Schema (v0.1 shape, still importable):** [`/schemas/armory-bundle/v0.1/bundle.schema.json`](/schemas/armory-bundle/v0.1/bundle.schema.json) — a versioned v0.2 schema publication is tracked but not yet up at a stable URL; the importer already accepts both shapes (see below), this page describes the current v0.2 shape.

```jsonc
{
  "$schema": "https://docs.agentmux.ai/schemas/armory-bundle/v0.2/bundle.schema.json",
  "name": "acme-backend-dev",
  "version": "1.2.0",
  "description": "Backend dev bundle: repo conventions, GH tooling, deploy skills",
  "provider": "claude",
  "model": "anthropic",
  "components": {
    "instructions": {
      "default": ["instructions/AGENTS.md"],
      "claude": ["instructions/claude/AGENTS.md"]
    },
    "skills": ["skills/deploy-checklist"],
    "mcpServers": ["mcp/github.server.json"],
    "memory": ["memory/MEMORY.md"],
    "accounts": "accounts/requirements.json"
  },
  "compatibility": { "agentmux": ">=0.55" },
  "metadata": {}
}
```

Top-level `provider`/`model` are the bundle's own **harness** fields — which AgentMux provider (`claude`, `codex`, `gemini`, …) and resolved model vendor (`anthropic`, or `custom` for a non-default base URL) the bundle needs to run, not a specific model checkpoint. They're `null` on an export from a bundle that predates this field. See [every agent gets its own ABF](#every-agent-gets-its-own-abf) for why they exist and why they're readonly.

## Credential requirements

The other invented piece — and the thing no other format in the landscape solves. Declares *what identities a bundle needs*, resolved locally against the importer's own accounts at import/launch time. Secret values never serialize, matching the universal reference-don't-bundle pattern every credential format in the research converged on independently.

**Raw JSON Schema:** [`/schemas/armory-bundle/v0.1/requirements.schema.json`](/schemas/armory-bundle/v0.1/requirements.schema.json)

```jsonc
{
  "requirements": [
    {
      "id": "gh-main",
      "credentialProvider": "github",
      "kind": "oauth",
      "scopes": ["repo", "workflow"],
      "env": "GITHUB_TOKEN",
      "optional": false
    }
  ]
}
```

This field was renamed from `provider` to `credentialProvider` in v0.2 (see below) — the importer still accepts a v0.1 `armory.json`/`requirements.json` carrying the old key name unchanged.

## ABF v0.2: provider-aware components and native memory

Shipped 2026-08-10. v0.1's own manifest example accidentally used `"provider"` for two unrelated things in the same document — a bundle-level harness hint (never actually implemented in v0.1) and a per-credential-requirement provider (`"github"`, `"anthropic"`, etc., the one that did ship). v0.2 resolves the collision and uses the freed-up name for real, harness-scoped content:

- **`credentialProvider` replaces `provider` in `accounts/requirements.json`** (above). The bare `"provider"` key is reserved for the harness sense from here on.
- **`components.instructions` becomes harness-scoped.** Instead of a flat path array, it's an object keyed by AgentMux provider ID, with a reserved `"default"` key for the provider-agnostic file every bundle already had. This lets a bundle carry, say, a Claude-specific instructions variant alongside its default `AGENTS.md`, for the (still uncommon) case where one harness genuinely needs different guidance than another. `skills` and `mcpServers` stay flat arrays in v0.2 — no evidence yet either needs to vary per harness.
- **Native memory is now a bundle-able component.** `components.memory` points at snapshotted files from `db_agent_native_memory` — the same durable store behind an agent's Stash Memory tab (the Brain). Because native memory is inherently per-agent, not per-bundle, it only round-trips through the **agent-scoped** export/import RPCs, `bundle.export_for_agent`/`bundle.import_for_agent`, not the generic `bundle.export`/`bundle.import` path — a generic import that encounters a `memory` component skips it with an explicit warning rather than silently dropping it. Import is deliberately conservative: it only writes into a target agent that has zero existing native memory of its own, refusing outright rather than risking an overwrite.

**What v0.2 doesn't do yet, to be upfront about it:** storing, exporting, and importing a harness-scoped instructions variant is fully shipped, but nothing yet *consumes* the non-default variant at launch — the file materializer that writes instructions into a running agent's working directory is Claude-only today and doesn't read bundle content live at spawn time. A v0.2 bundle's `claude`/`codex`/etc. variants travel correctly through export/import; wiring a specific variant into an actual launch is tracked as follow-up work, not yet built.

## Every agent gets its own ABF

Shipped 2026-08-15 (v0.55.9). Binding a bundle to an agent is no longer optional. Previously an agent could exist and launch indefinitely with no bundle bound at all, silently falling back to a shared, empty `blank` singleton. Now:

- **Every agent definition auto-provisions its own dedicated `db_bundles` row** at creation time, across all six creation paths (new agent, template clone, fork, Claude import, bulk import, `agent.define`) — not just the launch modal that used to be the only place a real (non-blank) bundle was actually enforced.
- **Existing agents were backfilled** by a one-time migration that gave each one a fresh, dedicated bundle derived from that agent's own already-known provider (not a hardcoded guess), so nothing already running lost its configuration.
- **Harness and model vendor moved onto the bundle itself, readonly once set.** The fields freed up by v0.2's naming fix — top-level `provider` (the harness, e.g. `claude`) and `model` (the resolved vendor, e.g. `anthropic`, or `custom` for a non-default base URL) — are now populated on every bundle and locked after creation, enforced on the backend (not just the Armory bundle editor's UI) so no RPC caller can drift a bundle's harness out from under an agent that depends on it. This is what makes an ABF the actual portable unit: exporting one now carries not just instructions/skills/MCP servers/memory but which harness and vendor it needs, so an importing instance can tell upfront whether it can run the bundle at all.
- **Full export/import support** carries the new `provider`/`model` fields through the existing `.abf` round trip.

This is a default, not a hard restriction — you can still deliberately bind an existing bundle to more than one agent if you want shared instructions. Deleting an agent orphans its bundle rather than deleting it, so an exported or intentionally-reused bundle survives; Armory's Bundles list shows an "owned by `<agent>`" indicator on agent-provisioned bundles instead of hiding them.

## Bundle-as-container v2: MCP Servers and Skills at the bundle level

Shipped 2026-08-18. A bundle can now carry its own MCP Server and Skill *references* directly, the same way an agent already could, not just export/import them as inline copies:

- The Armory bundle editor gained **MCP Servers** and **Skills** sections, reusing the same bind/create pattern as the equivalent per-agent modals, scoped to the bundle instead of an agent.
- At launch time, an agent's effective MCP servers and skills are now the **union** of its own agent-level references plus its bound bundle's references — a bundle's MCP/skill refs are live inputs to a running agent, not just inert data that only mattered for `.abf` export.
- This also fixed a real bug: a bundle referencing a private skill or MCP server used to silently **discard** the agent's own legacy inline skill/MCP config instead of combining with it. The two now compose correctly.

Bundle-level **Account** references and bundle-level **native Memory** references were both deliberately left out of this delivery — real open product/security questions (should a bundle-level account reference be a live credential FK, or an abstract per-provider requirement? should native memory get a standalone referenceable primitive at all?) that haven't been resolved yet. A bundle's MCP/Skill containment is real today; its Account/Memory containment isn't.

## Rollout plan

Ordered so every phase is independently shippable and none blocks the others.

| Phase | What | Status |
|---|---|---|
| **Phase 0** | Align skills with Agent Skills — add SKILL.md support to `db_skills`, materialize agent-skill-format entries as `.claude/skills/<name>/SKILL.md` at launch alongside the existing slash-command path. | Shipped |
| **Phase 1** | Exporter — the `bundle.export` RPC, serializing a bundle + referenced skills/MCP servers into the on-disk ABF layout (`bundle_export.rs`). Pure read-side, zero schema risk. | Shipped |
| **Phase 2** | Importer + validation — JSON Schema validation of `armory.json`, Agent Skills/`server.json` reference validation, account-requirement resolution against the local account store. | Shipped |
| **Phase 3** | Armory UI — export/import buttons on the Bundles rail, with an import-review sheet showing exactly what will be created before anything is. | Shipped |
| **Phase 4** | OCI distribution — `armory push/pull` against any OCI registry, following the Dev Container Features packaging blueprint. Private registries (Harbor, Artifactory, GHCR) work day one. | Planned |
| **Phase 5** | Registry + spec publication — publish the `armory.json`/`requirements.json` schemas at stable, versioned URLs, open a metadata-only bundle index. This page and its schemas are that publication. | Shipped |
| **Phase 6** | ABF v0.2 — `credentialProvider` rename, harness-scoped `components.instructions`, `components.memory` (agent-scoped export/import). Storage/authoring/export/import shipped; launch-time consumption of a non-default instructions variant is not yet wired. | Shipped (partial — see [ABF v0.2](#abf-v02-provider-aware-components-and-native-memory)) |
| **Phase 7** | Mandatory per-agent bundles — every agent auto-provisions and owns its own bundle; harness/model become readonly bundle fields; existing agents backfilled. | Shipped |
| **Phase 8** | Bundle-as-container v2 — bundle-level MCP Server and Skill references, unioned with agent-level references at launch. | Shipped |

## See also

- [Armory](/armory/) — the app-wide hub these bundles compose (Accounts, Bundles, Skills, MCP Servers)
- [Full research report](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/REPORT_ARMORY_BUNDLE_STANDARD_RESEARCH_2026_07_16.md) — four research passes, landscape analysis, and the original proposal this page is based on
- [ABF v0.2 spec](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/SPEC_ABF_V0_2_PROVIDER_AWARE_COMPONENTS_AND_NATIVE_MEMORY_2026_08_10.md) — provider-aware components and native memory design
- [Mandatory ABF architecture doc](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/ARCHITECTURE_MANDATORY_ABF_RETHINK_2026_08_14.md) — why every agent now owns a dedicated bundle, and the readonly harness/model design
- [Bundle-as-container v2 spec](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/SPEC_BUNDLE_AS_CONTAINER_V2_2026_08_17.md) — bundle-level MCP Server and Skill references
- [Report feedback](https://github.com/agentmuxai/agentmux/issues) on GitHub
