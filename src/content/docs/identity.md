---
title: "Identity bundles"
description: Named credential sets — GitHub PAT, AWS profile, API keys, SSH keys — assigned per agent at launch and swappable without restart.
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

An **Identity bundle** is a named credential set that AgentMux assigns to an agent instance at launch. The bundle decouples *what an agent does* (configured by the [Memory bundle](/memory/) and the agent's provider) from *who it acts as* (configured by Identity). The same Memory + provider can run as different identities — work, personal, demo — without restart.

## What goes in an Identity

An Identity is a logical grouping of per-provider credentials:

| Provider class | Credential type | Examples |
|---|---|---|
| `github` | Personal access token | repo scopes, gh CLI auth |
| `aws` | Profile name (referenced from `~/.aws/`) | dev, qa, prod |
| `anthropic` | API key | Claude API access (fallback to OAuth) |
| `custom` | Free-form key/value | Any provider-specific token |

The set of providers in a bundle is open-ended — `AccountProvider` is `"github" | "aws" | "anthropic" | "custom"` today, with `custom` covering anything that doesn't fit a named slot.

## How Identity is reached

Identity is **not a widget-bar entry.** It's a tab inside an active Agent pane:

1. Open an Agent pane (pinned in the widget bar).
2. Click the cog (⚙) in the pane header.
3. Switch to the **Identity** tab.

The view registration (`view: "identity"`) and `IdentityPaneViewModel` exist for `pane.open` RPC and right-click menu paths, but the primary path is the agent-pane subsection.

## Launch flow

The Launch Agent modal exposes a single **Identity** dropdown. The default selection is the singleton blank Identity ("no creds — use ambient environment"). Selecting a real Identity at launch:

1. Resolves the bundle's accounts.
2. Computes the per-provider env vars (`GH_TOKEN`, `AWS_PROFILE`, …) the agent's CLI needs.
3. Spawns the agent process with those env vars set.
4. Records the `identity_id` foreign key on the `db_agent_instances` row.

You can swap Identity on a running agent by reopening the Identity tab and picking a different bundle — the spawn-time env injection re-applies on next turn.

If the selected provider requires OAuth (or an API key) and isn't authenticated yet, the modal's [Pre-Launch Auth panel](/auth/#pre-launch-oauth-panel) appears inline and gates the Launch button. In the current release the OAuth result is session-scoped; persistent bundle storage that ties an OAuth login to a reusable Identity is Phase C and not yet shipped.

## Persistence

Identity bundles live in two SQLite tables in the sidecar's `objects.db`:

| Table | Owns |
|---|---|
| `db_identity_bundles` | Bundle metadata: id, name, description, `is_blank` flag |
| `db_identity_bindings` | Per-provider binding: `(identity_id, provider) → account_id` |

The actual credential records live in `db_identity_accounts` (the individual-credentials table). `db_identity_bindings` is a junction between Identity bundles and that table.

These tables are part of `objects.db`'s flat schema (`run_object_schema`). See [`SPEC_CONSOLIDATE_FORGE_IDENTITY_INTO_AGENT_2026_04_13.md`](https://github.com/agentmuxai/agentmux/blob/main/specs/SPEC_CONSOLIDATE_FORGE_IDENTITY_INTO_AGENT_2026_04_13.md) for the canonical model.

## What Identity is not

- **Not a credential vault.** AgentMux doesn't encrypt or audit credential access at the OS level today. The bundle is a grouping convenience — the credentials still live wherever the provider's CLI puts them.
- **Not the same as a session.** Identity is durable; the agent instance owns a foreign key to it. Sessions come and go; Identity survives.
- **Not a top-level pane.** No widget-bar entry. See [Pane types](/pane-types/) for the full pane catalog.

## See also

- [Memory bundles](/memory/) — the other half of agent composition
- [First Agent Setup](/first-agent/) — provider login flows
- [Auth flows](/auth/) — per-provider auth-dir isolation
- [Pane Types](/pane-types/) — where Identity bundles surface in the UI
