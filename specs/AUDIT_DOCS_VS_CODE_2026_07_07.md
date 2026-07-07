# Docs vs. Code Audit — 2026-07-07

**Scope:** `agentmux-docs` last had its content genuinely synced to the code on
2026-06-23 (PR #93, submodule bump to `v0.48.0-31`). Code `main` HEAD is now
2026-07-06/07 (`v0.50.3`-ish, commit `43f02344`). This audit covers ~2 weeks /
~230 changesets of code drift, plus a pass over all 56 existing doc pages for
pre-existing internal inconsistencies that are independent of the new code.

**Method:** one agent built a feature inventory from `VERSION_HISTORY.md`,
`.changesets/`, `docs/specs/`, `docs/handoff/`, `docs/retro*/`, and source
reads in the code repo; a second agent read all 56 files under
`src/content/docs/` in full and summarized what each currently claims. This
report cross-references the two.

**Bottom line:** the docs aren't just missing new features — several pages
actively assert things that are now **wrong** (old product names, modal
surfaces that became pane views, a settings default that contradicts itself
across three pages). Fix P0/P1 before adding new-feature coverage, since a
wrong doc is worse than a missing one.

---

## P0 — Docs are actively wrong (rename/relocation, not just stale)

| # | Issue | Pages affected | Fix |
|---|---|---|---|
| 1 | **"Trust Center" renamed to "Armory"** everywhere in-product (distinct vault icon, new MCP Servers + Skills catalog tabs added). Docs still call it Trust Center throughout. | `trust-center.md`, `auth.md`, `identity.md`, `getting-started.md`, `internals/agent-app-api.md` | Rename page/concept to Armory (keep a redirect/alias for old URL), document new MCP Servers + Skills tabs. |
| 2 | **"Preset" renamed to "Bundle"** — a Bundle is now a named collection of *references* to primitives, not a copy. The whole "6 primitives" model (Account, Memory, MCP Server, Skill, Brief, Bundle) replaces the old Preset/Memory-bundle-does-everything model. | `memory.md`, `trust-center.md`, `first-agent.md`, `internals/agent-app-api.md` | These pages need a structural rewrite, not a find-replace — MCP servers and Skills are no longer fields inside a Memory bundle, they're independent primitives with their own bind/unbind lifecycle. |
| 3 | **Settings / Toolchain Manager / Trust Center (Armory) moved from modals to widget-bar pane views.** Docs describe them as modals triggered from icons. | `settings.md`, `trust-center.md`, likely `main-menu.md` | Update navigation instructions — these are now persistent panes, not overlays. |
| 4 | **Per-agent pane-header icons consolidated.** The old Brain/Memory icon + Identity/id-card icon are now a single "Agent setup" icon opening one tabbed modal (Accounts · Memory · MCP · Skills · Briefs · Bundle). | `identity.md`, `memory.md`, `pane-types.md` (Agent section) | Replace "two icons" description with the single tabbed modal; document the 6 tabs. |
| 5 | **`identity.*`/`preset.*`/`memory.*` App API namespaces**, documented in `agent-app-api.md` as "planned, not shipped," are superseded by shipped `mcp.*`/`skill.*` namespaces under the new primitives model. | `internals/agent-app-api.md` | Replace the "planned" callout with the actual shipped `mcp.list/get/upsert/delete/bind/unbind` and `skill.*` RPC tables. |

---

## P1 — Shipped features with no doc coverage at all

| # | Feature | Suggested page | Notes |
|---|---|---|---|
| 6 | **Ghost-text next-prompt suggestion** in composer (Tab to accept) | `pane-types.md` (Agent section) or new subsection | Built on the new Ambient Model Call framework (#13). |
| 7 | **Cron + Loop persistent scheduler** — `CronCreate`/`CronDelete`/`CronList`/`CronPause`/`CronResume` MCP tools, plus `LoopList` and `max_iterations` on `Loop` | `internals/agent-app-api.md` MCP tool table | High priority — this agent's own tool list includes these and they're entirely undocumented. |
| 8 | **`ShellInput` / `ShellStatus` MCP tools** (Phase 3b persistent shell) | `internals/agent-app-api.md` MCP tool table | Same table as #7 — add alongside existing `Shell`/`ShellStop`. |
| 9 | **JEKT security markers + trust tiers** (`[JEKT:FROM=... TIER=... TRUST=...]`, `host-verified` vs `network-claimed`, sensitive-keyword auto-escalation) | `security/trust-model.md` + `internals/interagent-comms.md` | This is now codified in the code repo's own root `CLAUDE.md` as a hard security rule — should be user-visible in the trust model doc, not just an internal convention. |
| 10 | **Versioned, API-sourced model dropdowns** (live-fetched from provider `/v1/models`, cached per provider+CLI version, overlaid on a fallback list) | `first-agent.md`, `quickstart.md` | These pages currently imply a fixed/curated model list; note it's now live. |
| 11 | **Agent Shell sub-block + Resizable Details Drawer** (embedded xterm+PTY terminal under the composer, drag-resizable, height persisted per pane) | `pane-types.md` (Agent section) | New UI surface, no mention anywhere. |
| 12 | **Per-window opacity now persisted** across host crash/restart (`Window.opacity` field + `SetWindowOpacity` RPC) | `window-appearance.md` | Currently silent on persistence — worth calling out since it's a real behavior change (survives crash, not just session). |
| 13 | **Ambient Model Call (AMC) framework** — the internal gateway coalescing/canceling all background LLM calls (activity summaries, ghost text) | `internals/architecture.md` or a new internals page | Architectural, but load-bearing for two now-user-visible features (#6 and the periodic Haiku activity summaries). |
| 14 | **MuxBus Cloud sign-in chip** (status bar), branded `auth.muxbus.agentmux.ai` domain, dedicated `wss://muxbus-ws.agentmux.ai` | `auth.md` or `interagent-comms.md` | No existing doc mentions the cloud sign-in UI at all. |
| 15 | **Composer strip redesign** — Mode/Model/Effort as drop-up controls, real running-total stats | `pane-types.md` (Agent section) | Minor but visible on every agent pane. |
| 16 | **Tab palette expansion (14 colors) + right-click "Pane Color" context menu** | `keybindings.md` or `pane-types.md` (Pane Management) | Minor UI addition. |
| 17 | **Toolchain capability detection unified** (single source of truth for Docker/tool availability) + "Check latest versions" button | `pane-types.md` (Toolchain) if it exists, else skip | Mention the "Check latest versions" button as the main user-visible bit. |

---

## P2 — In progress / partially shipped — document as roadmap, not as available

| # | Feature | Status | Docs action |
|---|---|---|---|
| 18 | **Swarm live-feed redesign** | Backend (workflow grouping, `workflow:updated`, pushed Haiku summaries) shipped; frontend virtualized/flattened feed UI still "Draft" per spec | Update `subagent-watcher.md` / `pane-types.md` Swarm section for the shipped backend behavior (periodic per-agent summaries), but don't describe the new virtualized UI as available yet. |
| 19 | **Floating-pane placement/size persistence** (other half of #12's opacity spec) | Designed, not started | Don't document. |
| 20 | **External App Driving / Blender connector** | Design doc only, no code | Don't document as available; optionally mention on a roadmap/vision page if one exists. |
| 21 | **MCP hot-loading into a running session** | Feasibility-verified design only | Don't document. |
| 22 | **MuxBus multi-tenant security gap** (any valid muxbus credential can address any `agent_id`) | Audited 2026-07-06, tracked upstream (`agentmux-cloud#2`), **not fixed** | `security/trust-model.md` should already be conservative about muxbus multi-tenant trust — verify it doesn't overstate isolation; if it's silent, add an explicit caveat rather than a "vulnerability disclosure." |

---

## P3 — Internals docs likely stale from architecture changes (lower priority, dev-facing)

- `internals/reducer-stack.md` / `internals/state-model.md` — the "layout single-writer collapse" (SPEC #864, all 5 phases shipped) likely resolves the SRV-02 open finding and changes slice-#9 status; re-verify the status tables in both pages.
- `internals/agent-app-api.md`, `internals/env-vars.md`, `internals/ipc-catalog.md`, `internals/state-model.md` — all four are explicitly version-pinned snapshots (e.g. "0.44.1", specific commit hashes) with source-line citations. The large-tier modularization sweep (`agent_handlers`, `app_api`, `rpc_types`, `service.rs`, CEF `client/mod.rs`, launcher `main.rs`, frontend `rpc-api`) split these files into submodules — line-number and sometimes file-path citations in these four docs are now likely wrong even where the described behavior hasn't changed.
- New `useAgentFailure` unified reducer (fixes a real "stuck in Waiting for 3 min" bug) — worth a short internals note since it's a state-machine consolidation others may reference.
- Migration framework rewrite (launcher-owned, replaces startup one-shot migrations) — `internals/building.md` or a new internals doc if migrations are documented anywhere for contributors.

---

## P4 — Pre-existing doc-vs-doc inconsistencies (independent of the code drift above)

Found while reading all 56 pages; these are worth fixing in the same pass since they're cheap and undermine trust in the docs:

1. **`telemetry:enabled` default contradiction** — `settings.md` says default `true`; `config.md` says default `false` ("AgentMux collects zero telemetry by default"); `security/data-sovereignty.md` asserts no telemetry exists at all. Pick one truth and fix all three.
2. **`~/.agentmux/state.db` vs. the real persistence model** — `security/data-sovereignty.md` and `security/identity-credential-storage.md` both reference a single `state.db`, but `internals/persistence.md` and `internals/data-layout.md` describe `objects.db`/`filestore.db`/`sagas.db` under `channels/<channel>/versions/<v>/data/db/`. The security pages look stale/wrong here.
3. **`wsh` documented as live in `keybindings.md` and `system-metrics.md`**, but `internals/env-vars.md` itself notes `wsh` was retired. Remove or flag as legacy in the two pages still describing it as current.
4. **Provider list inconsistency** — canonical list is 7 providers (claude/codex/gemini/openclaw/kimi/copilot/pi) everywhere except `internals/provider-cli-integration.md`, which has an unexplained extra "Muxcode" row. Verify whether that's a real provider or a leftover/typo.
5. **Pane-type list omits Warden** in `getting-started.md` while `installation.md` and `pane-types.md` include it. Add it for consistency.
6. **Host IPC CORS gap not disclosed** — `internals/ipc-catalog.md` (Channel A) flags `CorsLayer::permissive()` on host IPC as an unmitigated finding, but `security/network-exposure.md`'s CORS description doesn't mention it and reads as more reassuring than the internals doc. Reconcile — either the gap was closed (update ipc-catalog) or the security page should disclose it.
7. **Channel/version/data-layout scheme duplicated in 4 places** (`config.md`, `settings.md`, `multi-instance.md`, `internals/data-layout.md`) — not wrong today, but any future change to this model has 4 places to update in lockstep. Consider consolidating to one source of truth with the others linking to it.
8. **Warden capability status duplicated** in both `warden.md` (user) and `internals/warden.md` (internals) — same unshipped-capabilities list in two places; keep them in sync as Warden ships more.

---

## Recommended sequencing

1. **P0 rename/relocation fixes** (Armory, Bundle, modal→pane-view, consolidated agent-setup icon) — these make existing docs actively misleading to a user following along today.
2. **P4 quick inconsistency fixes** — cheap, high trust-impact, no research needed beyond picking the correct current value.
3. **P1 missing-feature docs** — prioritize #7/#8 (Cron/Loop/ShellInput/ShellStatus — directly affects every agent using this docs site as a tool reference) and #9 (JEKT security markers — security-relevant) first.
4. **P2 roadmap items** — add only if there's an existing "roadmap" convention on these pages (several already use status tables with unshipped rows); otherwise skip.
5. **P3 internals staleness** — lowest priority, dev-facing only; do a citation sweep (file paths/line numbers) across the 4 version-pinned internals docs once the modularization sweep has fully settled.
