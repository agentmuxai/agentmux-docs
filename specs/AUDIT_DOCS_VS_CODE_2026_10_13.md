# Docs vs. code audit (2026-10-13)

**Status:** Internals half fixed (branch `camper/docs-internals-catch-up`, against agentmux `main` at 46ed5351c): every item under "P2: Internals out of step with the code" except `settings.md`; from P1, the `.7z` lines in `internals/building.md` and `internals/platform-support.md` and both Contributing items; from P3, the personal path, the submodule pin and the spec status lines. The User Guide, Security and `.github/` items are open.
**Checked against:** agentmux `main` at 78f171c56 (v0.59.24 plus pending changesets); this repo at fa36a15
**Follows:** `AUDIT_DOCS_VS_CODE_2026_08_10.md`

What on the site no longer matches the product, and what shipped without a page. Docs paths are relative to this repo. Product paths are relative to agentmux.

## Inventory

- **Pages:** 32 in the User Guide (including the index and glossary), 25 in Internals, 7 in Security and 1 generated TypeScript API page. All are in the sidebar, and no page has TODO, TBD or "coming soon" text.
- **Thin pages:** `user-guide.mdx`, `internals/index.mdx`, `api/typescript/index.md`, `report-issues.md` and `tower.md`.

## P1: wrong in a way users hit

- **The PR-title check skips every agent PR.** `.github/workflows/agent-pr-title.yml:3,26,34` only checks PRs from `genericagentx-workflow[bot]`, and the App is now `muxagent[bot]`. Accept both names, as agentmux's copy of the workflow does.
- **Window appearance.** `window-appearance.md:10-14,29` and `main-menu.md:21-22` describe one global ☰ Opacity setting that works only on Windows. Since 0.59.23, theme and opacity are set per window, on every platform.
- **The Windows portable build is a `.7z`, not a ZIP.** Update:
  - `installation.md:22,44-46`
  - `getting-started.mdx:38`
  - `quickstart.md:15`
  - `security/update-model.md:23,35`
  - `multi-instance.md:15`
  - `internals/building.md:95`
  - `internals/platform-support.md:29`
- **Default shell.**
  - `settings.md:117-118` and `config.md:44` say `term:localshellpath` defaults to `/bin/bash`. When it's unset, AgentMux picks a shell for the platform, and `term:localshellopts` now takes effect.
  - The new Settings ▸ Default shell picker (agentmux #4837) is undocumented (`settings.md:54-56`).
- **Terminal font default.** `settings.md:112` says JetBrains Mono; the code default is Hack (`frontend/.../termfontfamily.ts:22`).
- **Contributing.**
  - `internals/contributing.md:110-123` names the review bot `reagentx-workflow[bot]`; it is now muxreview (`@muxreview`).
  - `:136-147` says to use `bump-cli`; the product uses changesets (`building.md:105` already says so).

## P2: Internals out of step with the code

- **The reducer stack.**
  - `internals/architecture.md:62` calls the host reducer "in flight", and `internals/reducer-stack.md:28` calls it "partial". It now owns 27 commands (windows, browsers, drag, both pools, quit, opacity).
  - `reducer-stack.md:66-70` says sagas live only in srv.
  - `persistence.md:146` lists launcher sagas that don't exist. The real ones are `pool_respawn` and `window_cleanup` (`crates/launcher/src/saga/`).
  - Explain both saga frameworks and link agentmux `docs/architecture/DECISION_SAGA_REDUCER_TWO_FRAMEWORKS_2026_09_07.md`.
- **The window-pool source path** in `internals/architecture.md:38` is `client/mod.rs`. The code is in `crates/cef/src/commands/window_pool.rs` and `pane_pool.rs`.
- **Crates.** The site says four processes plus "a fifth crate" (`architecture.md:21`, `building.md:113-125`, `contributing.md:71-86`). There are 8 crates, including `agentmux-remote` and `agentmux-procstats`. `scripts/build-rust-docs.mjs:45` documents only 4.
- **`internals/building.md`:**
  - It says Node 22; it's Node 24.
  - It cites `task test`, which doesn't exist (also `contributing.md:60`), and `task format`, which doesn't exist (`contributing.md:102`).
  - It calls `package:macos` and `package:msix` "TODO stubs", but both are real tasks.
  - It gives the launcher's size as "≈325 KB" (also `contributing.md:73`).
  - It refers to a top-level `specs/` directory, which doesn't exist, and to "remote `wsh`", which is outdated.
- **`internals/contributing.md:80`** says the frontend uses jotai; nothing imports it.
- **`internals/debugging.md`:**
  - Line 6 says "three-process".
  - Line 117 cites old review history.
  - Line 241 gives the wrong crash-dump path, and `platform-support.md:27` repeats it. The path is `C:\CrashDumps\agentmuxsrv\` (`crates/srv/src/crash_monitor.rs:42`).
- **`internals/platform-support.md:24-25`** says the Linux splash is not implemented, and that macOS/Linux transparency is in progress. Both ship.
- **`internals/muxapi.md`:**
  - Lines 35-44 still say "App-API RPC catalog" and cite `app_api.rs` and `agent_handlers.rs`, which are now directories.
  - 37 MCP tools are never named, including ClaimWork, ReleaseWork, WhoIsWorkingOn, PtyShell*, OpenAgent, OpenBrowser, RunCommand, PressKeys, IdentityAccounts, ConnList, Preset*, ListConversations, WidgetList and ListShortcuts.
- **`settings.md`:**
  - 62 of 132 schema keys are undocumented, including `term:durable`, `term:showstatsbadge`, `browser:searchsuggestions`, `tab:confirmclose`, `widget:pinned`, `widget:hidden`, `viewer:shareterminals`, `cloud:publishpresence`, `swarm:sharesummaries`, `agent:mcpselfheal`, `agent:overlapnotes`, `conn:helper`, `notify:*` and `voice:*`.
  - `app:defaultmodel` (`:157`) and `widget:showhelp` (`:212`) no longer exist.

## P2: shipped without docs (0.59.20 – 0.59.24)

- **Browser:** address-bar suggestions, the Search suggestions setting, and Incognito (Ctrl+Shift+N). Add them to `browser-pane.md` and the Browser tab in `settings.md:48`.
- **SSH:** durable sessions, the helper-install prompt, and remote terminals naming their remote in the tab title (`connectors.md`).
- **Agent coordination:** ClaimWork, ReleaseWork and WhoIsWorkingOn, overlap notes, MCP self-heal, and `agentmux-mcp doctor`.
- **Panes:** Editor and Media "Move to New Pane" and edge-drop, Esc cancelling a tab drag, and merging a window's tab into another window.
- **Widgets:** the widget bar's pin, More and hide controls, pinning widgets from packages, and `display:grouponly`.
- **Terminal:** the stats-badge panel (DOM/WebGL renderer per terminal).

## P3

- **Pending in agentmux:** the Stash button is now a toolbox, so `pane-types.md:42` should no longer say backpack; the maximize/restore glyphs are new.
- **Paired devices** (`lan-discovery.md`, the Paired devices tab in `settings.md`): the phone's pane list, read-only terminal sharing, Swarm summary lines, and Publish this computer.
- **A personal path:** use a generic username in `internals/data-layout.md:119`.
- **The source-link submodule pin** is 121 commits behind agentmux `main`.
- **Spec status lines:**
  - `SPEC_INFORMATIONAL_GRAPHICS_2026_10_11.md`: Phase 1 shipped (#180).
  - `AUDIT_DOCS_VS_CODE_2026_08_10.md`: mostly done.
  - `SPEC_DOCS_MIA_2026_05_11.md`: draft since May.
  - `two-tone-site-title.md`: implemented.
  - The two `PLAN_*` docs have no status line.
