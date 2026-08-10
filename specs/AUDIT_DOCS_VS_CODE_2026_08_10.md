# Docs vs. Code Audit — 2026-08-10

**Status:** Draft — findings only, no doc edits made in this pass.
**Correction (2026-08-10, post-codex-review):** the original version of this
doc computed drift from `f0ce9f85a`, read off a stale local checkout instead
of `origin/main`'s actual gitlink. The real pin, verified via
`git ls-tree origin/main src/agentmux`, is `1df15ce6e` (advanced by docs PR
#108 on 2026-07-29 as part of that PR's own doc sync — not a dedicated bump).
Every figure below is recomputed from the correct baseline.
**Scope:** `agentmux-docs`'s `src/agentmux` submodule is pinned at
`1df15ce6e` (`feat(srv): enforce cross-process session lease on host-mode
agent turns`, #2359, dated 2026-07-29). Code `main` HEAD is now `6ca8f8a3f` —
**137 commits / 40 `feat` commits of drift, spanning ~12 days** (2026-07-29 →
2026-08-10). Smaller than the 2026-07-07 audit's ~230-changeset/two-week
window, but the same shape: real user-facing features shipped with zero doc
follow-up.

**Relationship to other recent doc work:**
- The **2026-07-29 documentation analyst** run (13 findings, tracked in
  `a5af/shared-infrastructure`'s `specs/IMPL_SPEC_DOCUMENTATION_FINDINGS_2026_07_29.md`)
  is **fully resolved** as of this audit. Every finding that touched this repo
  shipped: trust-model route count (DOC-002, #108), dead source-of-truth paths
  (DOC-003, #108), ABF rollout table (DOC-006, #108 + #110), deploy-prod.yml
  (DOC-007, #108), identity.md db location (DOC-010, #108). The two findings
  scoped to `agentmuxai/agentmux` itself (DOC-008 double-click-magnify,
  DOC-009 tab-context-menu) are archived under that repo's `docs/specs/archive/`.
  The weekly documentation-analyst schedule was disabled during an unrelated
  hardening pass on the runner infra and was **just re-enabled today**
  (`weekly-documentation-analyst`, next run: Wednesday 06:00 PST) — its next
  run will re-scan against a codebase ~12 days newer than its last pass, so
  expect a fresh finding set that will likely overlap with P1 below.
- This audit is **not** a re-verification of the 2026-07-07 audit's 22 items —
  spot checks below (Armory rename, Bundle model) suggest most of its P0 items
  shipped, but a full re-check of all 22 is out of scope here. Flagged as a
  follow-up in §P3.

**Method:** one agent read the current content of 10 targeted doc pages
against the corresponding current app behavior (source reads in
`agentmuxai/agentmux`), chosen because they're the newest/highest-visibility
gaps an assessment pass like this should catch — not an exhaustive re-read of
all ~56 pages (that's what the 2026-07-07 audit did; this one is scoped to
what's changed since). Two of its ten findings were spot-verified independently
before writing this doc (grep-confirmed zero `muxspect` hits anywhere in
`src/`; zero `isolat`/`bind.*agent` hits in `auth.md`/`armory.md`).
**Codex's review of the PR that added this doc caught a real baseline error**
(the submodule pin was read from a stale local git checkout instead of
`origin/main`, understating drift-window precision though not its rough
size) **and two real scope gaps** (the isolated-auth and Bind-to-Agent
findings each affect two more pages than the first pass checked) — both
independently verified via direct file reads before being folded into P0/P1
above. Left in as a record of what review caught, not smoothed over.

**Bottom line:** unlike 2026-07-07, nothing found here is a page actively
lying about a renamed concept — the gap this time is mostly **coverage**, not
**correctness**. Two real exceptions, though wider than the first pass of
this doc realized: `memory.md` describes native memory as non-durable when
it's now cross-channel-durable, and **four** pages (`auth.md`, `armory.md`,
`identity.md`, `multi-instance.md`) unconditionally claim credentials/account
bindings are shared/creatable-only-one-way when neither is true anymore.
Everything else is a missing section, not a wrong one.

---

## P0 — Docs assert something that's now factually wrong

| # | Issue | Pages affected | Fix |
|---|---|---|---|
| 1 | **Native memory (Brain) described as plain free-form files**, with no mention it's now durably mirrored cross-channel (`db_agent_native_memory`, keyed by stable `AgentDefinition.id`, PR #2459). A user reading this page would still expect an agent's notes to be channel/build-relative — the exact problem `persistence.md`'s "Cross-channel agent persistence" section already documents solving for definitions/instances, just not memory. | `memory.md`, arguably a cross-link from `persistence.md` | Add a subsection describing the durable mirror: same content visible across channels/builds for the same agent identity, live-FS + mirror merge on read. |
| 2 | **Four pages, not two, unconditionally claim provider credentials/accounts are shared across every channel and instance.** As of PR #2431, any non-`stable` channel (dev branches, local `task package` builds) defaults to an **isolated**, empty Armory account list — the global-sharing claim is now conditionally false. Plain (non-identity-bound) agent spawns are unaffected; this only matters for explicitly-bound Armory accounts, but none of the four pages carve out that distinction. Codex review on this doc's own PR caught two of the four (`identity.md`, `multi-instance.md`) that the first pass missed. | `auth.md` ("Auth-config dir storage" section), `armory.md`, `identity.md:65-69` ("account store is visible across every channel/instance"), `multi-instance.md:46-52` ("Provider auth" listed unconditionally under "Account-wide... shared across every channel and version") | State the actual default in all four: `stable` channel shares globally; every other channel isolates by default (`AGENTMUX_ISOLATED_AUTH=0` opts back into the old behavior). Cross-reference between the four rather than restating in each. |

---

## P1 — Shipped features with no doc coverage (or "just enough to grep")

| # | Feature | Suggested page | Notes |
|---|---|---|---|
| 3 | **`muxspect`** — new live process/turn-state introspection tool (PRs #2380, #2390, #2432). Zero mentions anywhere in the docs site. | `internals/debugging.md` (new section, sibling to the existing "Logs at a glance" muxlog section) | Needs: what it is (live state vs. muxlog's history), invocation (`node ~/.agentmux/shell/muxspect.mjs list\|describe`), the `dock`/`dock clear` stuck-Activity-Dock remediation flow, the known gap where the bare shell function doesn't load in tool-spawned shells, and scope caveats (what it can't see). This is a new doc section, not a one-line addition — treat it as the highest-priority item in this list since it's a tool agents are expected to reach for and currently cannot discover from the docs at all. |
| 4 | **`muxlog`'s full command surface.** `debugging.md` currently shows exactly 3 tail recipes (`muxlog host`, `muxlog host '\[fe\]'`, `muxlog srv`) plus one grep-cheatsheet line — a reader would never learn this is a full multi-instance log-discovery tool. | `internals/debugging.md` | Add the target table (host/srv/launcher/fe/all), the option surface (`-i` instance targeting, `--grep`, `--level`, `--since`, `--raw`), and a short "how discovery works" note (most-recently-active instance by default — don't trust a single pointer). The app's own `docs/MUXLOG.md` is the source of truth to port from. |
| 5 | **In-app Claude OAuth login** (PRs #2410, #2413, #2425) has fully replaced the old `AuthUrlBox` copy-URL-and-paste flow `auth.md`'s "Pre-launch OAuth panel" section still describes. `AuthUrlBox` itself survives only as a code comment for UX parity — it's gone from the app. | `auth.md` | This section needs a rewrite, not an addition: the new flow logs in without leaving the app, is reused across first-launch/relogin-after-credential-loss/Armory-initiated login, and "spawn-gate auth classification" (#2413) now distinguishes why a spawn was blocked. |
| 6 | **Codex JSONL translation + resume** (#2476) and the **model vendor concept** (#2505, distinct from provider/harness) have no mention in `provider-cli-integration.md`, even though Codex itself is already listed there from earlier work. | `internals/provider-cli-integration.md` | Add a row/section for vendor as a concept the existing provider-abstraction table doesn't have, and note Codex's JSONL (not plain-JSON) wire format + resume semantics. |
| 7 | **Automatic per-agent display color** (#2477) — every agent now gets a deterministic color (`ui:color`, hash-based, backfilled for existing agents) shown on the pane frame border. `pane-types.md`'s only color content describes the unrelated **manual** right-click swatch pickers (`frame:hue`/`tab:color`) — a reader would reasonably assume that's the only coloring mechanism. | `pane-types.md` or `armory.md` | One short paragraph distinguishing "every agent has an intrinsic color" from "you can also manually recolor a pane/tab." |
| 8 | **Media pane** (#2299) — a real pane type (`defwidget@media`, pinned in the widget bar) with live directory-watch, missing from `pane-types.md`'s pane-type table entirely. No dedicated page exists either. | `pane-types.md` | Add a Media row + short section: what it watches, what it's for (viewing generator output — e.g. ComfyUI images/video). |
| 9 | **Armory "Bind to Agent" context menu** (#2485) — right-click an account row to attach an existing login to a specific agent, with live binding annotations. `armory.md`'s Accounts section only describes click-to-connect; zero mention of the bind menu. **Also actively contradicted, not just missing, in `identity.md`** (caught by codex review): line ~41 says new account links are created "only from the agent's own launch flow," and the Armory Accounts tab is described (line ~46) as create/edit/delete-only — both now false with the bind menu as a second path. | `armory.md`, `identity.md` | Add the bind-menu description to `armory.md`'s Accounts section, and correct `identity.md`'s two now-false workflow statements to mention the second (Armory-initiated) binding path. |
| 10 | **Background Bash visibility in the Activity Dock** (#2489, #2502 — "Running in background" status distinct from stuck-looking "Working…"). Confirmed shipped and wired end-to-end as of this audit (dispatch site `agent-view.tsx:1313` + consumer both present) — `pane-types.md`'s Activity Dock blurb only describes the older foreground-promotion behavior. | `pane-types.md` (Agent → Activity dock) | Add the background-task status distinction. |
| 11 | **Cross-process session-ownership lease** (#2355, #2359) — a file-per-session `LeaseStore` (`<registry_root>/leases/<instance_id>.lease.json`, TTL-based, `boot_id`-scoped) that now prevents two processes from fighting over one agent's turn in host-mode. Zero mention in either `internals/architecture.md`'s "State ownership" section or `internals/persistence.md`'s file-inventory table. **Note:** #2359 is the commit the submodule is currently pinned at — this isn't part of the 137-commit drift window above, it's a pre-existing gap from *before* the last sync that the drift computation wouldn't have caught. Found only because this page's targeted-page list happened to include it. | `internals/architecture.md`, `internals/persistence.md` | Dev-facing/lower-priority than 3–10, but it's exactly the kind of cross-process correctness detail those two pages exist to cover, and the lease files live outside the documented `<data-dir>/data/` tree entirely — worth noting as a gap in the "at a glance" file table's completeness, not just a missing feature description. |

---

## P2 — Root cause: the submodule pin itself

The actual first fix, before any content edit: **bump `src/agentmux` past
`1df15ce6e` to current `main` (`6ca8f8a3f`)** and re-run `git submodule
update --init --recursive`. Every source-file citation in the internals pages
(`agent-app-api.md`, `env-vars.md`, `ipc-catalog.md`, `state-model.md` — all
four already flagged as "version-pinned snapshot" pages in the 2026-07-07
audit's P3) is checked against whatever commit the submodule happens to sit
at; a stale pin means even a *correct* content edit made today can cite a
file path or line number that's already wrong. Bump first, then write content
against the bumped tree, not the other way around.

## P3 — Deferred verification (not re-audited this pass)

- **2026-07-07 audit's own P2–P4 items** (Swarm live-feed frontend status,
  floating-pane persistence, the 8 doc-vs-doc inconsistencies, internals
  citation staleness) were not re-checked here — confirm which shipped since
  before assuming any of them are still open.
- **Weekly documentation analyst's next run** (Wednesday, re-enabled today)
  will scan a ~12-day-newer codebase than its last pass — expect overlap
  with P1 above; don't duplicate fixes if its report lands before this spec
  is acted on.
- Full re-read of all ~56 pages, as the 2026-07-07 audit did, is due again —
  this pass deliberately scoped to the newest/highest-visibility gaps instead,
  given the size of the drift window.

---

## Recommended sequencing

1. **P2 submodule bump** — zero-risk, makes every subsequent edit's source
   citations trustworthy.
2. **P0 factual fixes** (native memory durability, auth channel-isolation
   default) — these are the two places today's docs would actively mislead a
   user, not just leave them uninformed.
3. **P1 items #3–#4 (muxspect, muxlog)** — highest reader impact: these are
   tools a user or agent following the docs as a reference would reach for
   directly and currently cannot discover at all.
4. **P1 items #5–#11** — independently mergeable, roughly effort-ordered
   (auth.md rewrite and provider-cli-integration.md are "small," the rest are
   "trivial" additions).
5. **P3 deferred items** — fold into or run alongside whatever the next
   documentation-analyst pass surfaces, rather than duplicating the work now.
