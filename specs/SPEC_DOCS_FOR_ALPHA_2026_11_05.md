# SPEC: Docs for alpha — describe only the current release, and clean out the legacy and renamed material

**Status:** draft for the operator's OK. Kanban #25119 (this spec); the build is #25120.
**Date:** 2026-11-05
**Author:** Clamk (Clamk@narko)
**Measured against:** `agentmuxai/agentmux-docs` `main` `5360ce5`, and `agentmuxai/agentmux` `main` `c655acddd` (= v0.60.17).
**Operator's direction (2026-11-05, verbatim):** "we are in alpha and so we dont need to carry legacy docs about past versions, it is assumed to be a fast moving api, and it will just collect. anything renamed, should simply be forgetten, like warden, old abf. ... Once we enter beta, we'll be more rigorious with backward compatability, but during our alpha that isnt needed (we can retain itin the code docs) override if a userfacing really does need information about the past, but nearly everytime it can be dropped". And: "we need to update the ABF doc, it looks old."

## 1. The direction (the docs' own contributor rule)

To be pasted, as written, into `agentmux-docs/CLAUDE.md` (a new section next to "Weekly drift pass") and into `internals/contributing.md` under Style. It applies until beta.

> **In alpha, the docs describe only what the current release does.**
> - No "since 0.59.x", "previously", "formerly", "was renamed from", "used to be", "deprecated", "no longer", migration notes, "earlier names" boxes or version tables.
> - A renamed or removed thing (Warden, the Armory, Knowledge, Presets, the old `.abf` manifest `armory.json`, an old pane, tool or setting name) is simply gone from the docs. Use the new name and say nothing about the old one.
> - What the app does today to open an old save (a saved pane, a layout file, an old setting key) is behaviour, not documentation. It stays in the code and its comments, and in `docs/` in the agentmux repo.
> - **Exception, rare:** a page that cannot be used without one fact about the past. Say it in one line, on that page only, and add the page and term to the allow list (section 4). Most pages have none.
> - **What the drift pass does with a rename:** change the label everywhere and delete the old one; do not add a note. A removed feature is deleted with every link to it (the drift pass already says so).
> - Describe what the code does now. If the code still accepts an old spelling, that is one line in an aliases table with no history prose. If the code does nothing with it any more, the entry goes.
> - This holds until beta. In beta, backward compatibility gets rigorous and a compatibility page returns.

What stays and is **not** "legacy": a version number that is part of a wire format or contract (the jekt protocol's "version 1" and its signature domain prefixes `…-v1`/`…-v2`; the ABF `$schema` version), how an upgrade copies data forward (current behaviour, many users hit it every release), `min-upgrade-from`, "older" meaning older data of the user's own (older turns, older runs, old versions kept as the way back). The rule bans narrating the product's past, not the words "old" and "older".

## 2. Inventory of `agentmux-docs`

`src/content/docs` has 262 pages. 40 are generated API reference (`api/**`, `typedoc`, not in git): **out of scope**; their wording comes from code comments, so it is fixed there if at all. A search of the 222 written pages for the legacy vocabulary hits 44 files (232 lines with the 40 generated pages; ~200 without). Lines below are at `5360ce5`. Each row says: **Drop** (delete the passage or page), **Rewrite** (say the present thing), or **Keep** (with the reason).

### 2.1 Pages to delete

| Page | What it is | Action |
|---|---|---|
| `warden.md` ("Warden (split up)", sidebar `astro.config.mjs:112`) | A map of where the Warden's sections went, plus the old-pane compatibility rules | **Drop the page.** Its one live piece, "The token pill" (lines ~40–56: the AgentMux-internal row and the Requests/Accepted/Kept/Refused/Skipped/Failed table), moves to `window.md` → Status bar, in the present tense. The network pill is already in `lan-discovery.md#the-network-pill`. |
| `internals/warden.md` (sidebar `:177`) | Design of a widget that no longer exists (three sections Host/LAN/Internet, a stub, polling cadence, planned phases) | **Drop the page.** It describes code that is gone (only a thin `warden` view shell for Jobs remains) and plans that were never built. The design record is `docs/specs/` in the agentmux repo. |

Both leave the sidebar. Add redirects `/warden` and `/internals/warden` → `/pane-types/` in `astro.config.mjs` beside the existing `/the-forge`, `/knowledge`, `/armory` redirects (kept: they are URL redirects that no reader sees, and they keep external links alive).

### 2.2 Passages that point at the Warden (all **Drop**)

Delete the sentence or bullet; the page reads the same without it.

`audit.md:19, :71` · `history.md:19, :58` · `jobs.md:14` (last sentence), `:87` · `kanban.md:12` (last two sentences), `:20` (last sentence), `:128` · `vault.md:24`, `:148` · `subagent-watcher.md:366, :381, :388` (the two "see Warden" links retarget to `window.md#token-pill`; the "Warden" See-also bullet goes) · `widget-gallery.md:68` (last sentence "They replace the Warden pane…") · `widgets.md:133` (the paragraph about `"view": "warden"` entries), `:137` (the "old name" clause of the Settings ▸ Widgets flag list) · `widget-api.md:135` (the `am.panes.open("warden", …)` compatibility sentences; keep the sentence on an unknown section id and the error for a section that is not a pane) · `pane-types.md:13` (last sentence) · `glossary.md:56` ("it used to be a section of the Warden, then of the Swarm") · `main-menu.md:68` (last sentence, "The older Identity & Memory command is gone").

### 2.3 Renamed or removed things in user pages (all **Rewrite** to the present, or **Drop** the note)

| Page and line | Passage | Action |
|---|---|---|
| `memory.md:26, :34, :40` | "This pane was called Knowledge, and before that … Armory"; the `app:knowledge` keybinding migration; "An Armory pane is moved to…" | Drop all three. Keep `app:memory`. |
| `connectors.md:36` | Armory pane saved under the earlier name | Drop. |
| `glossary.md:58` | Entry "Knowledge — the former name of Memory" | Drop the entry (and its `#knowledge` anchor; check inbound links). |
| `glossary.md:10, :64`, `pane-types.md:13` | ABF entry "It was called the Armory Bundle Format"; Memory entry "Formerly Knowledge"; "Remotes, once a widget of its own, is now a section of Connectors" | Drop each clause. |
| `glossary.md:14` | "MuxAPI (formerly the Agent App API)" and the `#agent-app-api` anchor | Rewrite: "MuxAPI — …". Drop the old anchor. |
| `glossary.md:26` | "bundle (formerly "Preset")" | Rewrite; also the rest of the entry (see 3: no own bundle, no MCP servers). |
| `internals/muxapi.md:10, :129` | "(formerly the Agent App API)", "Bundles (formerly presets)" | Rewrite. |
| `bundles.md:13` | "Earlier names" note: Presets, `/memory/` page, retired `preset.*` aliases | Drop the note. |
| `bundles.md:35` and the "Persistence" block | "A new agent doesn't get one … See every agent gets its own ABF"; `default_memory_id`; `mcp_servers` column; "Memory replaced the earlier Forge concept" | Rewrite: see 3.2. |
| `subagent-watcher.md:19` | `:::note[This page used to be "Subagent Watcher"]` | Drop. |
| `pane-types.md:39` | "Formerly Knowledge" | Drop the phrase. |
| `pane-types.md:63, :344` | "Media … No longer a pane of its own"; a saved Media pane opens as an Editor (`media-migration.ts`) | Drop the Media row's history and the migration paragraph; keep the Editor's own viewer description. |
| `pane-types.md:432` | Shell button "(formerly labeled "Log")" | Drop the parenthesis. |
| `glossary.md:40` | "(Media is no longer a pane of its own)" | Drop the parenthesis. |
| `glossary.md:76` | "Older notes and settings call this runtime `host`" | Rewrite to state that the stored value is `host` (it appears in settings and files), without "older". |
| `installation.md:176` | "OpenCode, goose, Crush and Aider used to be listed there too. They are harnesses now…" | Rewrite to the present: they are agent CLIs, listed with the others. |
| `first-agent.md:217` | `/shutdown` "(or its older names, `/quit` and `/exit`)" | Keep both names if the code still takes them (one list, no "older"); drop them if it does not. Check at build. |
| `agent-pane-messages.md:62` | "…through the older `mux` or `ject` route" | Rewrite to name the route only if it still exists. |
| `settings.md:217` | `window:reducedmotion` "Deprecated and ignored" | Drop the row. |
| `settings.md:609`, `multi-instance.md:64, :66, :56` | "the historical migration from per-version → channels → channels-plus-version…", "Pre-channels (legacy)", "Dev mode keeps the legacy single-dir layout", "`task package` no longer bumps" | Drop the history bullets and clauses; the current layout stays. |
| `widget-api.md:73` | "An AgentMux older than 0.60.1 refuses a manifest that lists `links:open`…" | Drop. |
| `widget-api.md:210` | "An older AgentMux ignores them." | Drop. |
| `widgets.md:116` | `display:hidden` "The older name … still works" | Keep only if the code reads it, as an alias (one clause); otherwise drop. Check at build. |
| `window.md:55` | "Labels that used to be the browser's slow native hover text use the same tooltip." | Drop the sentence. |
| `window.md:115` | "the copies of the pane history that older versions kept are listed as Old copies, per version" | **Keep**: it is the label of a current row in the disk panel. |
| `memory.md:116` | "The older `db_agent_native_memory` mirror is still written through…" | Rewrite to what Personal Memory does now; move the mirror to internals if it needs saying. |
| `memory.md:109` | "…switching account … used to leave them behind." | Rewrite to what AgentMux keeps now. |
| `identity.md:97` | "as of SPEC_IDENTITY_STORE_SPLIT_2026_08_17.md the two tables no longer live in the same physical store" | Rewrite to where they live (with the cited spec as a code reference, no "no longer"). |
| `workspaces.md:20, :22`, `installation.md:84, :98`, `container-agents.md:61`, `window.md:37`, `jobs.md:37`, `settings.md:185, :269, :276–278, :528`, `lan-discovery.md:106`, `subagent-watcher.md:93, :157, :173` | "older copy", "older Linux distributions", "older turns", "older output", "folders of older versions", "A line older than 30 minutes" | **Keep**: current behaviour; "old/older/no longer" here is about the user's own data or a stated limit. |

### 2.4 Internals (code docs)

The operator allows the past to stay "in the code docs". The internals pages are the reference for the **current** code, so the same rule holds with one allowance: a legacy name the code still honours is one line in an aliases table, without history prose.

| Page | Passage | Action |
|---|---|---|
| `internals/env-vars.md` | The decommissioned `AGENTMUX_AGENT_COLOR` / `AGENTMUX_AGENT_TEXT_COLOR` section (":101 Decommissioned on 2026-09-20 … Who reads them: Nothing"), `WAVEMUX_AGENT_ID`/`_COLOR`, `AGENTMUX_DATA_HOME`, `AGENTMUX_CONFIG_HOME`, `AGENTMUX_DEV` ("Group 7 — Legacy / Transition Variables", "legacy" wording at :10, :72, :77, :125–129, :154, :181, :195, :416–421, :684–696, :713–714, :733, :753–754) | **Drop** every row nothing reads (the decommissioned colour variables; `AGENTMUX_DEV`, "no longer set by the launcher", if nothing reads it). **Rewrite** the still-read aliases (`WAVEMUX_AGENT_ID`, `AGENTMUX_DATA_HOME`, `AGENTMUX_CONFIG_HOME`) into one "Aliases" table: alias → current variable → who reads it. Group 7's name goes. `:541` "A dev host on Windows used to ignore the hand-off" → drop the sentence; `:535` "(Windows too since v0.58.0)" → drop; `:660` "now a plain `1`" → state the value. |
| `internals/data-layout.md` | `:12` history of per-version → channels; `:50` legacy `dev/<branch>/` layout; `:65` "Older versions wrote them to…"; `:94` "Older docs use `<data-dir>`"; `:134` "Older versions wrote srv's log…"; `:147` legacy basename pointer | **Drop** each. `:147`: keep the pointer-format description only for formats the helper still reads, as present behaviour. Keep the rollback and snapshot text (`:56`, `:67`, `:69`): current mechanism. |
| `internals/data-structure.md` | `:115` "older name-keyed … being replaced"; `:125` "kept for older builds"; `:142` "Legacy: the live links are in `identity-store.db`"; `:241` "Markers left by old one-time migrations"; `:263` "reaches older builds too" | **Drop** the "older/legacy/being replaced" qualifiers; list a table only if the code still has it. **Keep** `:174` (the version lock on shared stores), `:271`–`:287` (copy forward on a new version's first start), `:291`–`:307` (schema versions, migrations, `min-upgrade-from`): current upgrade behaviour. |
| `internals/persistence.md` | `:56` "The older quit-time session record … is still written for one release"; `:74` "Migration status: workspaces are reducer-driven…" | **Drop** `:56`'s sentence and `:74`'s status line. Keep `:58`, `:64`, `:66` (current load fallbacks, copy-forward, export format). |
| `internals/ipc-catalog.md` | `:385` "Backward-compat: Pre-CPD-2 launchers emit bare `Event` JSON…"; `:537` `bus:inject` "(legacy; agents use the `Message` tool)" | **Drop** `:385`; `:537` rewrite to what the command does for the callers that exist. |
| `internals/state-model.md`, `internals/reducer-stack.md` | Reducer-stack migration status: "✅ 6/7 migrated", "Migration status", `:309`–`:315` ("master status … older than the work"), `:403` and `:424` (tab colour history), `:489` "*Removed:* `persistToBackend()`…", `:532` "The dual path is gone", `:559` "Version races: gone with the second writer"; `reducer-stack.md:8, :113` (tracker links) | **Drop** the "removed / is gone / gone with" narration and the migration scoreboards. **Keep** the model as it is today. The tracker links go with the scoreboards (the specs stay in the repo). |
| `internals/jekt-protocol.md` | `:33` Former slug; §9 Versioning; §10 Known gaps; **§11 History** (`:376`); source list "(from 0.59.39)"; `:253` "the retired `reagent-v1-dev` key" | **Keep** §9 and §10 (the protocol's version number and signature prefixes are the contract; the gaps are the open spec, not history) and the Former-slug definition (a live rule). **Drop** §11 History (move its one useful pointer, "the design records are `docs/specs/SPEC_JEKT_*`", into the Source-of-truth list), the "(from 0.59.39)" clause, and the word "retired" at `:253` (the rule, that a signature valid only under the dev key fails, stays). |
| `security/reactive-event-bus.md` | `:68, :69` "Legacy local message-bus API. Nothing in AgentMux calls it", "Legacy. … no poller runs"; `:24` "the legacy `/api/bus/inject` route"; `:110, :115, :119` "a WAN key an older version wrote" | **Rewrite** `:68–69`: if the routes exist, describe them as routes; the "nothing calls it" fact is a candidate for deleting the route in code (see 5, Q3). **Drop** the "older version wrote" clauses. |
| `security/identity-credential-storage.md:95` | "removes a WAN key an older version wrote" | Drop the clause. |
| `internals/provider-cli-integration.md:46` | "and 'harness' in some older code/specs" | Drop the clause. |
| `internals/architecture.md:76, :98`, `internals/building.md:170`, `internals/debugging.md:29`, `internals/modal-system.md:192`, `internals/lan-discovery.md:97, :145`, `internals/clipboard.md:66`, `internals/zoom.md:79`, `internals/agent-pane-virtualization.md:35`, `internals/muxapi.md` (others) | "migration plan", "legacy basename-only pointer", "Design history: …", "older" meaning older data | **Keep** except: `building.md:170` ("DevTools is no longer a widget-bar entry (moved to…)") drop the parenthesis; `debugging.md:29` drop "legacy"; `modal-system.md:192` drop the design-history sentence (a repo spec reference). |

### 2.5 Redirects and files that are not prose

- `astro.config.mjs` redirects `/the-forge`, `/knowledge`, `/armory`: **keep** (invisible, protect external links). Add the two Warden ones.
- `public/schemas/armory-bundle/{v0.1,v0.2}`: **keep the files served, unlinked** from every page. They are the `$schema` URLs inside `.abf` files people already have; deleting them breaks validators for nothing. The `agent-bundle/v0.3/` schemas stay and are linked from the ABF page.
- `src/assets/screenshots/**`: a screenshot that shows a removed thing is retaken only when the page it sits on is rewritten; no sweep.

## 3. The ABF page and the Bundles page

`abf.md` is 212 lines, written in layers (v0.1 research → v0.2 → v0.3 → mandatory ABF → bundle-as-container → rollout table), and it is wrong in places, not only old. `bundles.md` has the same stale parts. Both are **rewritten from the current code and UI**, not edited line by line.

### 3.1 What the ABF page says that the code and the Bundles tab don't do (checked on `c655acddd`)

1. **"Export any bundle as a single `.abf` file" from Memory → Bundles** (banner) and "Phase 3 … export/import buttons in the Bundles list". The Bundles list has **New** and **Import Bundle** only; nothing in `frontend/app` calls `bundle.export*`. Export is the RPC `bundle.export` (plus `bundle.export_for_agent` and `bundle.export_for_agent_with_history`), reachable through MuxAPI; no MCP tool exposes it. The page itself says "There's no export button in the app yet" lower down, so it contradicts itself.
2. **`mcp/<server>.server.json` and `accounts/requirements.json` in the on-disk tree, `mcpServers` and `accounts` in the manifest example, and the whole "Credential requirements" section as something an export produces.** The exporter has written neither since #4475 (`bundle_export.rs`: "No `mcp/` or `accounts/`. A bundle carries no MCP servers; they belong to Connectors"). The importer still reads both from older archives: it ignores MCP servers (preview section **Not imported: MCP servers**) and uses `requirements.json` to match accounts (preview section **Account requirements**).
3. **"Bundle-as-container v2: MCP Servers and Skills at the bundle level"** (and "At launch an agent's effective MCP servers are the union…"): MCP servers left bundles in #4475/`m0036`. The bundle editor has a **Skills** section and no MCP section. Skills are still bundle-level.
4. **"Every agent gets its own ABF"**, and Rollout phase 7: reversed by #6382 and `m0047` (an agent has no bundle of its own; a new agent gets none, and the bundles it picks are `db_agent_bundles`). The page's own note says so and then keeps the whole old section under it. `bundles.md` repeats it (":35", "its own bundle comes first", `default_memory_id`).
5. **"Harness and model moved onto the bundle, readonly once set"**: reversed in v0.3 (the agent owns its provider; the bundle has a hint). The page narrates both.
6. **Manifest example fields `compatibility: { agentmux: ">=0.55" }` and `metadata`**: nothing writes or reads `compatibility` (only a comment mentions the word); `metadata` is written as `{}`. The example also shows `version: "1.2.0"`; the exporter writes `"0.1.0"` and leaves bumping to the author.
7. **Missing from the page, present in the code:** `components.projectInstructions` (recorded in an import for reference, never installed); `components.history` and the `history/<provider>/<session>.jsonl` files from `bundle.export_for_agent_with_history` (opt-in; ≤200 MB per transcript, ≤500 MB total); the agent-scoped import's rule (writes memory only into an agent with none; check at build whether it reads `history/`); the import review's actual steps and sections (**Bundle name**, **Include instructions**, **Context files**, **Not imported: MCP servers**, **Account requirements**, skills, widgets, **Dismiss warnings**).
8. **Version story:** the page is "a v0.3 beta spec"; widget code comments call the widget-carrying format "v0.4", but no v0.4 exists (no `SCHEMA_V0_4`; `$schema` stays the v0.3 URL, as the page's widgets section says). The v0.4 plan (`memory.global`, `memory.personal`) is in `SPEC_BUNDLE_CONTENTS_MEMORY_NOT_MCP_2026_10_07.md` D5 and has not shipped, so the page must not mention it.
9. **The "Why a new format?" landscape table** has an "AgentMux today" column that is stale ("Proprietary slash-commands", "DB-only, no export") and a "Distance" column that is marketing. Research stays in `docs/specs/REPORT_ARMORY_BUNDLE_STANDARD_RESEARCH_2026_07_16.md`.
10. **"ABF v0.2" and "ABF v0.3" sections, the v0.2→v0.3 table, "The name" note ("was the Armory Bundle Format"), "Compatibility … imports v0.1, v0.2 and v0.3 … an older AgentMux can't import v0.3", the 11-row Rollout plan, "See also" links to five repo specs.** Pure history.
11. **Banner "ABF is a v0.3 beta spec … may change before 1.0"**: keep the meaning (alpha, the format can change), in the alpha banner's words, not a version tag.

Also wrong on `bundles.md` (check against the Bundles tab at build): the field table lists `mcp_servers` ("Yes, after saving"); the intro says a bundle packages "MCP servers"; "**MCP servers** from the bundles are added when the agent is opened through MuxAPI"; the `db_bundles` listing shows `mcp_servers`; the description in the front matter says "instructions, MCP servers, memory and skills". The "Session zones and default-continue" section (`bundles.md:54`) is about an agent's conversation threads ("anchored to the agent's identity"), not about bundles: verify against the code and move it to the agent pages, or drop it.

### 3.2 The rewrite

- **`abf.md` becomes one page about the file, in the present tense:** what an `.abf` is (a zip of the layout below) and what goes in it today; the layout (`bundle.json`, `instructions/AGENTS.md`, `instructions/<provider>/AGENTS.md`, `instructions/context/…`, `skills/<name>/SKILL.md`, `widgets/<id>/…`, and, from an agent-scoped export, `memory/…`, `history/…`); the manifest with the fields the exporter writes (`$schema`, `name`, `version`, `description`, `suggestedFor`, `components`, `metadata`); widgets in a bundle (that section is current and stays, minus its "no export button yet" and "older AgentMux imports the rest" lines); how to import (Memory → Bundles → **Import Bundle**, the review, what is and isn't imported); how to export (MuxAPI RPC names, honestly, with the agent-scoped and with-history variants); the published schemas. **One line** on reading earlier files: "AgentMux also imports bundles written by earlier AgentMux releases" (the override the operator allowed: a user with an old `.abf` needs it). No version table, no phases, no research.
- **`bundles.md`** loses MCP servers, "its own bundle", the Earlier-names note and the stale schema block (point at the code for the table instead of copying it; or keep a table that matches `db_bundles` exactly, with the check script, section 4). It keeps: what goes in a bundle (instructions, per-provider instructions, suggested-for hint, skills; context files are stored but not delivered at launch and not editable: say so), an agent's picks and their order, how launch composes them, where bundles are managed.
- **`glossary.md`** `abf` and `bundle` entries are rewritten to match; **`memory.md:204`** (the ABF blurb) and **`widgets.md:79`** (ABF link text) too.
- **Open product note:** `REPORT_AGENT_BUNDLES_REFINE_OR_DROP_2026_11_03.md` step 3 (carry an agent by reference; `.abf` becomes the file form of a fork) is approved but not built. The ABF page describes what exists on the build date; if step 3 lands before the build, the page follows it.

## 4. How it stays clean

**Contributor rule** (section 1) in `CLAUDE.md` and `internals/contributing.md`, plus one line in the weekly drift pass, step 5: "A rename changes the label everywhere and leaves no note; a removal deletes the passage and its links."

**A tripwire in CI, with no new code.** `pr-check.yml` already runs `check-doc-references.mjs --deny scripts/doc-references.deny`, which fails a PR when a page contains a listed term (case-sensitive substring, anywhere on the page, code blocks included; the generated `api/` pages do not exist yet at that step). Add to `scripts/doc-references.deny`:

```
Warden => removed; the Vault, History, Audit, Jobs and Swarm are panes of their own
Armory => removed; say Connectors or Memory
armory.json => the bundle manifest is bundle.json
Knowledge pane => the pane is Memory
formerly => in alpha the docs describe only the current release
Formerly => in alpha the docs describe only the current release
used to be => in alpha the docs describe only the current release
was renamed => in alpha the docs describe only the current release
renamed from => in alpha the docs describe only the current release
Earlier names => in alpha the docs describe only the current release
```

What this does not do: it is not prose analysis. Ambiguous words ("previously", "no longer", "older", "legacy") are not denied, because many uses are fine (section 2.3, Keep rows); the weekly drift pass and review catch those. One honest gap: the deny list has no per-page exception, so the rare "override" page (section 1) cannot carry a denied term. If the first such page appears, extend the checker (`agentmux/scripts/check-doc-references.mjs`) with a `term @ path` form and move the pinned ref in `pr-check.yml`. That is a small separate PR, not part of the first cleanup.

**The `Warden` term has legitimate uses outside the docs** (`frontend/app/view/warden/`, the `warden` view id in code). Those are code paths in the agentmux repo, which this check never sees; a docs page that cites one by path should cite the Jobs pane instead, and the build checks for it.

## 5. Build plan (#25120), questions, and risks

**Order**, each a PR on `agentmux-docs` signed Clamk@narko with a changeset, merged on muxreview approval; the site is deployed **once**, at the end, with `deploy.yml` (a deploy is on demand and each run costs money), and the live pages are checked:

1. **ABF and Bundles rewrite** (`abf.md`, `bundles.md`, glossary entries, `memory.md:204`, `widgets.md:79`), first, as the operator asked.
2. **Warden gone:** delete both pages and the sidebar entries, add the redirects, move the token pill into `window.md`, remove every Warden passage in 2.2, fix the anchors that pointed at `/warden/#the-token-pill`.
3. **Renamed and removed things in user pages:** 2.3.
4. **Internals:** 2.4 (env-vars, data-layout, data-structure, persistence, ipc-catalog, state-model, reducer-stack, jekt-protocol §11, security pages).
5. **The rule and the tripwire:** `CLAUDE.md`, `internals/contributing.md`, `doc-references.deny`. Last, so the earlier PRs don't fail their own check while they land. If the operator would rather have the tripwire first, it can go first with the existing hits listed in a `--baseline` file (the checker supports one), emptied as each PR lands.

Each PR runs `npm run build` and `node scripts/check-links.mjs` before the push; the reference check runs in CI against the pinned code. The build task moves the `src/agentmux` pin to current `main` in PR 1, so citations match what the page says.

**Questions for the operator** (each has a default; the build uses it unless told otherwise):

- **Q1. Delete the Warden pages with a redirect to Pane types?** Default: yes.
- **Q2. Old schema files (`armory-bundle/v0.1`, `v0.2`) stay served but unlinked?** Default: yes.
- **Q3. Code that exists only for the past** (`armory.json` and v0.1/v0.2 import, `WAVEMUX_AGENT_ID`, `AGENTMUX_DATA_HOME`, the `/api/bus/*` and `/agentmux/reactive/poller/*` routes that "nothing calls", the `warden` view shell, saved-pane migrations for Knowledge/Armory/Media): in alpha these could be deleted in code too, which would shrink the docs further. That is a separate decision for the owners, not part of this cleanup. Default: leave the code; the docs describe it in one line where it is still read, and nowhere else.
- **Q4. Internals: one "Aliases" table for legacy names the code still honours?** Default: yes, as in 2.4.

**Risks.** The cleanup touches about 40 pages; a link or an `#anchor` can break (the build's `check-links.mjs` catches both). `memory.md`/`connectors.md`'s saved-pane notes are the only place a user could meet a rename after upgrading: a pane saved under "Knowledge" still opens as Memory (the code does that), so dropping the note costs a puzzled sentence at worst. The ABF rewrite's export section depends on the RPC names being stable; it cites them from `crates/srv/src/backend/rpc_types/commands.rs` so the reference check will flag a rename.

## 6. Done means

Every row in 2.1–2.4 is dropped, rewritten or kept as written; `abf.md` and `bundles.md` match the code in 3.1; the deny list is in place and CI is green on `main`; the rule is in `CLAUDE.md` and `internals/contributing.md`; the live pages (`/abf/`, `/bundles/`, `/window/#status-bar`, `/warden/` redirecting) are checked after the deploy; the task #25120 result lists the PRs and the deploy run.
