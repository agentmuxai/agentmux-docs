---
title: "Identity & Accounts"
description: Accounts are per-provider credential pointers; an agent binds at most one Account per provider directly, no intermediate grouping object.
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

**As of `SPEC_PRESET_TO_BUNDLE_REFACTOR_2026_07_02.md` Phase 3, there is no Identity-bundle grouping object.** Earlier releases modeled Identity as a named, swappable *collection* of credentials (`instance → identity_bundle → binding → account`). That layer was collapsed: an agent instance now binds **directly** to Accounts, one per provider (`instance/agent → account`, enforced at resolve time). "Identity" today means *this agent's set of directly-bound accounts* — a derived view, not a stored object. This decouples *what an agent does* (configured by the agent's [Bundle](/memory/) and provider) from *who it acts as* (its bound Accounts).

## What an Account is

An **Account** is a single credential pointer — one provider, one kind, one secret reference:

| Provider class | Credential kind | Examples |
|---|---|---|
| `github` | Personal access token | repo scopes, gh CLI auth |
| `aws` | Profile name (referenced from `~/.aws/`) | dev, qa, prod |
| `anthropic` | API key or OAuth | Claude API access |
| `openai`, `google`, `slack` | API key or OAuth | provider-specific |
| `custom` | Free-form key/value | Any provider-specific token |

`AccountProvider` is `"github" | "openai" | "aws" | "anthropic" | "google" | "slack" | "custom" | "agentmux"` today, with `custom` covering anything that doesn't fit a named slot. An agent can bind **at most one Account per provider** — a conflict (e.g. trying to bind a second `github` account) is a surfaced validation error at resolve time, not a silent pick.

## OAuth credentials as Accounts

OAuth logins are Accounts, not a separate concept. Each Claude / Codex / Copilot OAuth login lives in its own auth-config directory, referenced by the Account's `SecretRef` (`oauth_config_dir` backend — see [Identity & credential storage](/security/identity-credential-storage/)). Two Accounts for the same provider hold genuinely distinct OAuth sessions (work vs. personal, etc.), each with a **status** field (`valid` / `expired` / `invalid` / `unknown` / `checking`) surfaced in the Armory so credential health is visible without launching an agent.

The OAuth invariant: a successful OAuth flow **always** lands bound to an Account — the CLI's own `OAuthConfigDir` belongs to that Account directly, so there's no intermediate grouping object to provision (log in → Account → bind to an agent).

For the (now-superseded) original design, see [`SPEC_OAUTH_IDENTITY_BUNDLES_2026_05_22.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/archive/SPEC_OAUTH_IDENTITY_BUNDLES_2026_05_22.md) in the main repo.

## How Identity is reached

Identity is **not a widget-bar entry.** Two paths reach it:

**Per-agent (read-only):**
1. Open an Agent pane (pinned in the widget bar).
2. Click the **Agent setup** icon (`id-card`) in the pane header — this single icon replaced the older separate Memory-icon/Identity-icon pair.
3. Switch to the **Identity** tab — a read-only Provider/Account/Status table of this agent's direct account links (`AgentIdentityLinksPanel`). No create/edit/delete/bind/unbind *here*; this tab is display-only.

**App-wide manager (hamburger menu):**
1. Click the hamburger (≡) at the top of the tab bar.
2. Choose **Armory** (formerly "Trust Center").
3. Switch to the **Accounts** tab — create, edit, and delete Accounts. There is no standalone "Identities" rail tab in the Armory (removed in the Phase 5 consolidation — Armory stays scoped to shared/reusable resources; per-agent bindings live on the agent pane instead).

New account↔agent links are created from **two** places, not one: the agent's own launch flow (selecting an Account per provider dropdown, as below), and — as of the Armory's **"Bind to Agent"** right-click context menu on an account row — from the Accounts tab itself. Right-clicking an account row opens a submenu listing the channel's compatible agents, annotated with which agent is already bound to this account (checkmark) and which is bound to a *different* account for the same provider ("bound: work-claude"); clicking an agent creates or rebinds the link. See [Armory → Binding an account to an agent](/armory/#binding-an-account-to-an-agent) for the full mechanics (candidate filtering, live-apply on a running agent, etc.). This means the Accounts tab is no longer create/edit/delete-only — bind is a fourth, Armory-initiated action available there.

The view registration (`view: "identity"`) and `IdentityPaneViewModel` exist for `pane.open` RPC and right-click menu paths, but the primary paths are the two above.

## Launch flow

The Launch Agent modal binds Accounts directly, one dropdown per provider the agent needs. Selecting an Account at launch:

1. Resolves the Account's `SecretRef`.
2. Computes the per-provider env vars (`GH_TOKEN`, `AWS_PROFILE`, …) the agent's CLI needs.
3. Spawns the agent process with those env vars set.
4. Writes the `(agent_id, provider) → account_id` row to `db_agent_identity_links`.

You can rebind an agent's Account for a provider by reopening its launch dialog and picking a different one — the spawn-time env injection re-applies on next turn.

If the selected provider requires OAuth (or an API key) and isn't authenticated yet, the modal's [Pre-Launch Auth panel](/auth/#pre-launch-oauth-panel) appears inline and gates the Launch button.

## Persistence

Accounts and their agent bindings live in two SQLite tables (not the per-channel `objects.db` — see [Persistence](/internals/persistence/) and [Data layout](/internals/data-layout/) for the full split between per-channel and shared databases), but as of `SPEC_IDENTITY_STORE_SPLIT_2026_08_17.md` **the two tables no longer live in the same physical store**:

| Table | Owns | Where it lives |
|---|---|---|
| `db_accounts` | The credential record: id, name, provider, kind, display_name, `secret_ref`, context, status | The **account store** — account-wide `store.db` under `~/.agentmux/shared/` on the `stable` channel, but a per-channel-isolated store by default on every other channel. This is the same conditional default covered in [Auth flows → Isolated auth by channel](/auth/#isolated-auth-by-channel); it applies to the Armory's connectable-account *list*, not to a link once created (next row). |
| `db_agent_identity_links` | Direct binding: `(agent_id, provider) → account_id`, one row per agent+provider | A separate, **permanently-global identity store** — never redirected by channel or by the isolated-auth setting, regardless of which channel created the link. |

**Why this split matters:** a link an agent already has to an Account survives a channel or version switch even though the Armory's underlying account *list* may reset to empty on a fresh non-`stable` channel (see [Auth flows](/auth/#isolated-auth-by-channel)) — don't conflate the two. To keep an existing link resolvable even when its target account row isn't present in the current channel's (possibly-isolated) account store, the account row is also mirrored into the always-global identity store at the moment a link is created; resolving a binding at agent-spawn time falls back to that mirror copy if the channel-local account store doesn't have it. This is what makes "my agent still launches with the right account after I switch channels" hold even though "the Armory account list itself" doesn't.

`db_agent_identity_links` is a direct junction between an agent definition and `db_accounts` — there is no intermediate bundle/grouping table. The earlier `db_identity_bundles`/`db_identity_bindings` tables it replaced were dropped once Phase 3's backfill migrated every row to a direct link; see `docs/specs/SPEC_PRESET_TO_BUNDLE_REFACTOR_2026_07_02.md` and `docs/specs/SPEC_IDENTITY_DIRECT_LINKS_PHASE3_PRC_2026_07_10.md` in the main repo for that migration, and `docs/specs/SPEC_IDENTITY_STORE_SPLIT_2026_08_17.md` for the store split described above.

## What Identity is not

- **Not a credential vault.** AgentMux doesn't encrypt or audit credential access at the OS level today. An Account is a pointer — the credential still lives wherever the provider's CLI or secret store puts it.
- **Not a grouping object.** There is no bundle/collection layer between an agent and its Accounts — bindings are direct, one Account per provider.
- **Not a top-level pane.** No widget-bar entry. See [Pane types](/pane-types/) for the full pane catalog.

## See also

- [Bundles](/memory/) — the other half of agent composition (instructions + context files)
- [First Agent Setup](/first-agent/) — provider login flows
- [Auth flows](/auth/) — per-provider auth-dir isolation, and the conditional isolated-auth-by-channel default
- [Armory](/armory/#binding-an-account-to-an-agent) — the "Bind to Agent" context menu, the second path to creating an account↔agent link
- [Pane Types](/pane-types/) — where Identity surfaces in the UI
