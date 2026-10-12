# Dead links audit — 2026-10-12

**Status:** Implemented — every finding below is fixed, and the safeguards in §4 are in place, in the same change as this audit (§5).
**Scope:** every page of the built site (`npm run build:full` at `main` @ `8c8d187`, #180), except the generated Rust reference (`/api/rust/`, rustdoc's own output); links *into* it were checked. Links into agentmuxai/agentmux were checked against that repo's `main` @ `b69e37ad9`. The live site serves the same build: the dead TypeScript reference links below 404 on docs.agentmux.ai too.
**Author:** Agent2@narko

## 1. Summary

| | Dead links | Distinct | Pages | Root cause | Fix |
|---|---|---|---|---|---|
| TypeScript API reference (`/api/typescript/`) | 181 | 134 | 40 of 41 | typedoc's `.md` links are never rewritten to site routes | one change in `scripts/post-typedoc.mjs` (§3.1) |
| Links to agentmux source files that aren't on `main` | 47 | 40 | 15 | moved, renamed or deleted files; partial paths; things that aren't repo files | edit each, plus two stale aliases (§3.2) |
| Line links past the end of their file | 7 | 7 | 3 | line numbers pinned to `main`, which moved on | §3.3 |
| Missing in-page anchors | 2 | 2 | 1 | glossary terms without an `<a id>` | §3.4 |
| External URLs | 1 | 1 | 1 | `agentmux.ai/download` returns 404 | §3.5 |
| **Total** | **238** | **184** | **57** | | |

Beyond the dead links, **most line-numbered source links point at the wrong code** without failing (§3.3): they are pinned to `main`, so every edit above a cited line shifts it. The sidebar, page-to-page links, redirects (`astro.config.mjs` `redirects`) and images all resolve.

## 2. How it was checked

1. `npm ci && npm run build:full`, exactly as `.github/workflows/deploy.yml` builds the site.
2. A script read every built HTML page and every `href`/`src` in it (14,343 links on 121 pages, mostly the sidebar on every page):
   - site links: the target file must exist in `dist/`, and a `#fragment` must match an `id` on the target page;
   - `github.com/agentmuxai/agentmux/blob|tree/main/…`: the path must exist on agentmux `main` (`git ls-tree`), and a `#Ln` must be within the file's line count;
   - every other URL (32): fetched. crates.io and npm refuse scripted requests (404/403); both packages exist (checked through their APIs) and are not counted.
3. Each finding was traced to its source line in `src/content/docs/`.

That one-off script became `scripts/check-links.mjs` and the build-time source-link check (§5).

## 3. Findings

### 3.1 TypeScript API reference: every cross-reference is dead

typedoc-plugin-markdown writes links between its own files: `functions/dispatch.md`, `../README.md`, `../type-aliases/AgentPaneEvent.md`. Starlight serves each file at a lowercased route without `.md`, one folder deeper than the file (`agent-document-store/functions/dispatch.md` → `/api/typescript/agent-document-store/functions/dispatch/`, `README.md` → `…/readme/`). `scripts/post-typedoc.mjs` adds frontmatter and leaves links alone, so every link between typedoc pages 404s.

Live example: https://docs.agentmux.ai/api/typescript/agent-document-store/readme/ links to `functions/dispatch.md`, which 404s; the page exists at `/api/typescript/agent-document-store/functions/dispatch/`.

**Fix:** in `post-typedoc.mjs`, rewrite each relative `.md` link to the absolute route of its target: resolve it against the source file's path, lowercase it, drop `.md`, map `README` to `readme`, prefix `/api/typescript/`, add a trailing `/`. One change fixes all 181. The umbrella `index.md` that script writes already uses routes and is fine.

Related: the reference is generated from the `src/agentmux` submodule, pinned at `848e4f37b` (2026-09-30, verified with `git ls-tree origin/main src/agentmux`), 607 commits behind agentmux `main`. Every source link in the prose points at `main` instead (§3.2). The two halves of the site describe different versions of the code.

### 3.2 Source links to files that aren't on `main`

`plugins/remark-github-source-links.mjs` turns every backticked path that contains a `/` (or is a configured alias) into a link to `github.com/agentmuxai/agentmux/blob/main/<path>`, without checking that the file exists. Five causes:

**a. Partial paths.** The prose names a path from inside a crate; the link resolves it from the repo root.

| Page (source line) | Written as | Should be |
|---|---|---|
| `internals/env-vars.md:186, 294, 335, 379, 422, 486, 586` | `srv/main.rs:<n>` | `crates/srv/src/main.rs` (now 360 lines: every cited line needs re-finding) |
| `internals/env-vars.md:470` | `cef/main.rs:532` | `crates/cef/src/main.rs` (13 lines; the code moved out of `main.rs`) |
| `internals/env-vars.md:279` | `commands/window/creation.rs:139` | `crates/cef/src/commands/window/creation.rs` |
| `internals/env-vars.md:294` | `registry/paths.rs:29` | `crates/srv/src/registry/paths.rs` |
| `internals/env-vars.md:539` | `client/mod.rs:1243` | `crates/cef/src/client/mod.rs` |
| `internals/ipc-catalog.md:609, 741` | `server/mod.rs:387…` | `crates/srv/src/server/mod.rs` (131 lines) |
| `internals/ipc-catalog.md:739` | `srv/server/mod.rs` | `crates/srv/src/server/mod.rs` |
| `internals/provider-cli-integration.md:131, 164` | `agents/translator/claude.rs`, `agents/runner.rs` | `crates/srv/src/agents/…` |
| `internals/state-model.md:632–634` | `agent-pane-state/types.ts`, `agent-document/types.ts`, `browser-pane-state/types.ts` | `frontend/app/store/…/types.ts` |
| `internals/wrr.md:51` | `reducer/tests.rs` | ambiguous: `crates/cef/src/reducer/tests.rs` or `crates/launcher/src/reducer/tests.rs` |
| `internals/zoom.md:94, 118` | `app_api/agent_open.rs` | `crates/srv/src/server/app_api/agent_open.rs` |

**b. Moved or renamed files.**

| Page (source line) | Link | What happened |
|---|---|---|
| `internals/state-model.md:441, 456, 460, 563, 630` | `frontend/app/store/wos.ts` (and `wos.ts:<n>`) | renamed `mos.ts` (#3287). The page still describes `WaveObject`/`wos`, so the prose is stale too. |
| `internals/state-model.md:423` | `gotypes.d.ts:1317` | renamed `frontend/types/srv-types.d.ts` (#3287) |
| `installation.md:161` | `frontend/app/view/agent/providers/toolchain-catalog.ts` | moved to `frontend/app/store/toolchain-catalog.ts` (#4550) |
| `internals/zoom.md:114` | `frontend/app/store/zoom.win32.ts` | became `frontend/app/store/zoom.ts` (#3034) |
| `internals/zoom.md:3, 21` | `frontend/app/store/zoom.platform.ts` | deleted (#3034): the platform forks were merged into `zoom.ts` |

**c. Deleted files.**

| Page (source line) | Link | What happened |
|---|---|---|
| `subagent-watcher.md:59` | `frontend/app/util/focus-block.ts` | deleted (#3972); blocks are revealed through `revealBlock` |
| `internals/warden.md:19, 132` | `frontend/app/view/warden/warden.scss` | gone since the Warden rebuild (#2553); styles are in `warden-view.scss` |
| `internals/terminal-latency-benchmark.md:162` | `scripts/bench-cdp.mjs` | deleted with other orphaned scripts (#1550); the page documents a tool that no longer exists |

**d. Hand-written spec links without `docs/`.** The `specs/` → `docs/specs/` rewrite (`pathMap` in `astro.config.mjs`) applies only to backticked paths, not to Markdown links written out in full.

| Page (source line) | Link | Fix |
|---|---|---|
| `internals/warden.md:27, 138`, `internals/lan-discovery.md:165` | `…/blob/main/specs/lan-awareness-and-embedded-jekt-api.md` | `…/blob/main/docs/specs/…` |
| `pane-types.md:200, 240` | `…/specs/SPEC_EDITOR_LSP_AND_THEMES_2026-05-26.md`, `…/specs/SPEC_EDITOR_FILE_TREE_2026-05-26.md` | `…/docs/specs/…` |
| `internals/agent-app-api.md:617` | `specs/SPEC_AGENT_APP_API_IDENTITY_PRESETS_BRAIN_2026_06_27.md` | archived: `docs/specs/archive/…` |

**e. Not repo files at all.** The plugin linked a path that names something else. These should stay plain code, for example by writing them as a code span the plugin skips or by adding a skip list to the plugin.

| Page (source line) | Written as | What it is |
|---|---|---|
| `abf.md:153` | `accounts/requirements.json` | a path inside an `.abf` archive |
| `build-a-widget.mdx:133` | `dist/widget.json` | a path in the reader's own widget project |
| `internals/agent-app-api.md:24` | `internals/env-vars.md` | a page of this site: link `/internals/env-vars/` instead |
| `security/identity-credential-storage.md:38` | `.claude/.agentmux-managed-mcp-servers.json` | a file AgentMux writes into an agent's workspace at runtime |

**Stale aliases.** Two entries in `astro.config.mjs` `aliases` point at files that no longer exist: `wos.ts` → `frontend/app/store/wos.ts` and `gotypes.d.ts` → `frontend/types/gotypes.d.ts`. They produce the `state-model.md` links in (b). The other 25 aliases resolve.

### 3.3 Line links: 7 dead, most of the rest wrong

The site has **124 links to a specific line, into 39 files, on 3 pages** (`internals/env-vars`, `internals/ipc-catalog`, `internals/state-model`). All point at `main`.

Seven are past the end of their file:

| Page (source line) | Link | File length now |
|---|---|---|
| `internals/env-vars.md:422` | `crates/srv/src/main.rs#L706-L708` | 360 |
| `internals/ipc-catalog.md:281` | `crates/cef/src/main.rs#L455-L463` | 13 |
| `internals/ipc-catalog.md:390` | `crates/srv/src/server/mod.rs#L387-L396` | 131 |
| `internals/ipc-catalog.md:459` | `crates/srv/src/server/mod.rs#L374-L406` | 131 |
| `internals/ipc-catalog.md:530` | `frontend/app/view/term/termosc.ts#L177-L335` | 330 |
| `internals/state-model.md:408` | `global.ts:888` (alias) | 518 |
| `internals/state-model.md:638` | `block.scss:489` (alias) | 488 |

The rest load, but a spot check of four found three on unrelated code:

| Page (source line) | Link | Described as | Line on `main` now |
|---|---|---|---|
| `internals/env-vars.md:441` | `srv_spawner.rs:112` | the launch UUID being generated | a doc comment for a dialog title; the UUID is at line 418 |
| `internals/env-vars.md:586` | `srv_spawner.rs:141` | where the launcher sets a variable | the tail of an error message string |
| `internals/env-vars.md:485` | `srv_spawner.rs:142` | where the launcher passes a variable | `reason` |
| `internals/env-vars.md:323` | `data_paths.rs:160` | `resolve_path_only` | correct |

A line link to `main` is wrong from the next edit above that line, and nothing reports it.

### 3.4 Glossary anchors

`glossary.md:12` links `#agent-app-api` and `glossary.md:88` links `#agent-pane`. Neither term has an `<a id="…">`, unlike most entries around them (`<a id="abf">`, `<a id="stash">`, `<a id="subagent">`).

### 3.5 External links

`security/update-model.md:19` links https://agentmux.ai/download, which returns 404 (`https://agentmux.ai/` itself is up). The other 31 external URLs resolve.

## 4. Recommendations

In order of links fixed per change:

1. **Fix `post-typedoc.mjs`** (§3.1): 181 links, one script change.
2. **Point source links at the submodule's commit, not `main`.** The plugin could build `blob/<pinned sha>/…` instead of `blob/main/…`. Links then show the code the page was written against, never break or drift, and move forward when the submodule is bumped. The plugin can also check each path against `src/agentmux` at build time and fail the build when it is missing. That catches §3.2 (a)–(c) and the stale aliases the moment they appear.
3. **Fix the 50 remaining dead links by hand** (§3.2–§3.5), most of them mechanical (tables above). The pages with the most: `internals/state-model` (13), `internals/env-vars` (12), `internals/ipc-catalog` (7). `state-model` also needs its prose updated for the `wos` → `mos` rename.
4. **Add a link check to CI.** Run on the built `dist/` (as in §2) in the PR workflow. Site links, anchors and source paths can fail the build; external URLs should only warn, since sites like crates.io refuse scripted requests.
5. **Line numbers:** with (2) in place, line links stay correct for the pinned commit. Without it, prefer naming the function or constant over a line number.

## 5. What this change does

**Fixes.**
- `src/agentmux` moves to agentmux `main` @ `b69e37ad9`, so the prose, the source links and the generated TypeScript reference describe the same code.
- `scripts/post-typedoc.mjs` rewrites typedoc's `.md` links to site routes (§3.1).
- Every finding in §3.2–§3.5 is fixed. The pages `internals/env-vars`, `internals/ipc-catalog` and `internals/state-model` had every line-numbered reference re-checked against the new pin, not only the dead ones (§3.3). `state-model` also follows the `wos` → `mos` rename and drops code that no longer exists; `zoom` describes the single `zoom.ts` and the `paneZoom` capability. Every glossary term has an anchor.

**Safeguards.**
1. **Source links are pinned and checked at build time.** `plugins/source-links.mjs` holds the aliases, path rules and the list of paths that aren't repo files. `plugins/rehype-check-source-links.mjs` runs last over every page: each link into agentmux, however written (backticked path, table line range, hand-typed URL), is pointed at the pinned commit, and the build fails if its file is missing or its line range is past the end of the file.
2. **Every built link is checked.** `scripts/check-links.mjs` checks each page link and `#anchor` in `dist/`, and fails on any broken one. It runs in `pr-check.yml` (now building the TypeScript reference too) and in `deploy.yml` before anything is uploaded. External URLs are fetched in `pr-check.yml` as warnings only.
3. **A pin bump re-checks line links.** `scripts/check-line-links.mjs` runs in `pr-check.yml` when a PR moves `src/agentmux`: it lists every line link whose cited code changed between the old pin and the new, suggesting new line numbers where the code only moved, and fails until they're fixed. Links whose Markdown line the PR edited are skipped. For one that changed but still cites the right code, a person adds the `line-links-reviewed` label after checking.

**Follow-ups found while fixing, not done here** (prose that no longer matches the code, with no dead link involved):
- `internals/ipc-catalog`: `get_env` now refuses secret-looking names, but the page says no allowlist or blocklist applies; `no_sandbox` is computed (0 with the `sandbox` feature), not always 1; the list of variables removed for non-agent panes is out of date; `AGENTMUX=1` from `shell.rs` couldn't be found; `crates/common/src/ipc.rs` is 2,268 lines, not 2,034.
- `internals/env-vars`: `AGENTMUX_AGENT_COLOR` and `AGENTMUX_AGENT_TEXT_COLOR` were retired on 2026-09-20, but the OSC payload, strip-list, Windows 11 border and text-colour sections still describe them; `AGENTMUX_INSTANCE_ID` reaches srv as `--instance`, not an env var; `launcher_is_genuine_parent` lives in `crates/cef/src/lib.rs`.
- `internals/state-model`: two diagrams (`public/diagrams/`) still show `waveObjectAtom` and "StreamStalled (60s)"; §4.1's colour sources describe `cmd:env AGENTMUX_COLOR`, but the border colour now comes from `computeBlockActiveBorderColor` (`frame:hue` / `frame:activebordercolor`).
