# Docs Update Plan — v0.40.1 through v0.41.1
**Date:** 2026-06-01  
**Covers:** Features shipped since last deploy (v0.0.50, commit e3ed165, ~2026-05-28)  
**Current local version:** 0.0.51 (not yet deployed)

---

## What's in scope

Features that shipped in the app since the last docs deploy, assessed for user-visible documentation gaps.

---

## Tier 1 — Ship first (user-facing, high visibility)

### 1. `pane-types.md` — Predictive local echo

**What shipped:** v0.41.0 — `feat(term): predictive local echo for terminal input`. Characters appear in the same frame as the keystroke; confirmed against the PTY echo and rolled back on divergence. Default **on**. Setting: `term:predictiveecho` (boolean, default `true`).

**Docs gap:** No mention anywhere. Users will notice characters appearing before the shell confirms them — without docs, this looks like a bug.

**Changes needed:**
- Add a "### Predictive echo" subsection under the Terminal section in `pane-types.md`
- Explain: characters are rendered locally the moment you type, before the PTY round-trip completes. The server echo is still authoritative — if it disagrees the local glyph is corrected instantly.
- Note safety: password prompts and TUI apps (vim, less, htop) are safe — echo detection disarms prediction automatically.
- Mention the setting: set `term:predictiveecho = false` in `settings.json` to disable.

**Also:** Add `term:predictiveecho` row to the Terminal Settings table in `settings.md`.

---

### 2. `pane-types.md` — File drag-and-drop

**What shipped:** v0.40.1 — `feat(dnd): file drop on terminal + agent panes (phase 1)`.

**Docs gap:** Not mentioned. Users who drag files onto panes will either get a pleasant surprise or wonder why nothing happened on unsupported platforms.

**Changes needed:**
- Add "### File drag-and-drop" section to `pane-types.md`
- **Terminal panes:** dragging a file inserts its path at the cursor (ready for `cat`, `vim`, etc.)
- **Agent panes:** file content is attached to the agent's context
- Platform status: Windows shipped in Phase 1. macOS/Linux Phase 2.

---

### 3. `multi-instance.md` — Version isolation + tear-off platform status

**What shipped:**
- v0.41.1 — `fix(launcher)`: two different release versions no longer share a single-instance domain. Users can now run 0.40.x and 0.41.x simultaneously without one activating the other's window.
- v0.41.0 — Linux floating-pane tear-off (Phase A): tearing a pane on Linux now produces a chromeless floating window, matching Windows and macOS.

**Docs gap:**
- The tear-off section currently says "Platform support: Windows only". This is stale — macOS shipped in #1182, Linux shipped in v0.41.0.
- No mention that different versions can safely coexist.

**Changes needed:**
- Update the tear-off platform status table: Windows ✅, macOS ✅ (v0.40+), Linux ✅ Phase A (v0.41+, Wayland-only for drag).
- Add a "### Running different versions side-by-side" subsection. Before v0.41.1, launching an older portable while a newer one was running silently focused the wrong window. As of v0.41.1, each version has its own single-instance domain — both launch independently.

---

### 4. `settings.md` — `term:predictiveecho` and `term:predictiveecho:thresholdms`

**Changes needed:**
- Add to the Terminal Settings table:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `term:predictiveecho` | boolean | `true` | Render typed characters locally before PTY confirmation. Disable if you prefer strict server-echo-only behavior. |
| `term:predictiveecho:thresholdms` | number | `0` | Only predict when rolling p50 round-trip ≥ this value (ms). `0` = always predict when armed. |

---

### 5. `installation.md` — MSIX / Microsoft Store option

**What shipped:** v0.40.1 — `feat(packaging): Microsoft Store MSIX packaging`.

**Docs gap:** Windows installation section only mentions `.exe` installer and portable. MSIX is a third option with different update semantics.

**Changes needed:**
- Add a "#### Microsoft Store (MSIX)" subsection under Windows:
  - Automatic updates via Windows Update / Store
  - Sandboxed install (no UAC prompt)
  - Note: uses the same `stable` data channel as the `.exe` installer
  - Link to Store page once published

---

## Tier 2 — Complete docs coverage (cross-platform + architecture accuracy)

### 6. `internals/platform-support.md` — Refresh launcher and version-isolation rows

**Changes needed:**
- Launcher row: macOS/Linux `task dev` now runs through the launcher (v0.41.0). Update status from "🟡 in progress" to "✅" for `task dev`; note installed/portable on macOS/Linux is still in progress.
- Add a "Version isolation" row: as of v0.41.1, each release version has its own single-instance domain and versioned data directory (`channels/<channel>/versions/<semver>/data/`). Agents and settings are still shared within a channel.

### 7. `internals/architecture.md` — Neutralize Win32-centric framing

**Current:** The "Why three processes" section describes the launcher's WRR layer in Win32-specific terms ("Win32 surprise", "monitor disconnection"). This misleads Linux/macOS readers.

**Changes needed:**
- Reframe: the launcher is the resilience and lifecycle layer. On Windows it reconciles against Win32 window state (WRR). On macOS/Linux the reconciliation layer is on the roadmap.
- Remove or bracket all `Win32`-specific language with "(Windows)" qualifiers.

### 8. `internals/building.md` — Update launcher build section

**What shipped:** v0.41.0 — `feat(launcher): drive srv and host via agentmux-launcher on macOS/Linux task dev (Phase 1)`. `task dev` now goes through the launcher on all platforms.

**Changes needed:**
- Remove or update any "Windows only" qualifier on the launcher section.
- Add a note that `task dev` on macOS/Linux exercises the launcher code path as of v0.41.0.

---

## Tier 3 — Polish (nice-to-have)

### 9. `pane-types.md` — New-message enter animation (agent pane)

New messages fade+slide in over 120ms when streamed to an agent pane (v0.41.0). History rows on open/restore are unaffected. Respects `window:reducedmotion`.

Add one sentence to the Agent pane section: "New messages animate into view as they stream in; this can be suppressed by enabling `window:reducedmotion`."

### 10. `pane-types.md` — Floating pane reliability note

The floating-pane window resolver was rewritten in v0.40.1 (canonical `resolve_window_hwnd(label)`). Redock-onto-main and minimize/maximize now reliably target the correct window. No new user-facing behavior to document, but the existing floating-pane section can drop any "known issue" or "in progress" caveats if they exist.

### 11. `glossary.md` (if it exists) — New concepts

Add:
- **Predictive echo** — client-side rendering of terminal input before PTY echo confirmation
- **Single-instance domain** — the identity boundary that prevents two processes from treating each other as "already running". As of v0.41.1, scoped per version, not per channel.
- **Channel** — a stable data-directory identifier that spans versions, used to persist agents and settings across upgrades. Different from version isolation.

---

## Not needed

| Feature | Reason |
|---|---|
| macOS Dock display fix | Bug fix, not a user-learned feature |
| CEF credential-access fix | Security hardening, no user action needed |
| backdrop-filter → will-change perf | Internal, invisible to users |
| EarlyEstablishGpuChannel | Internal, invisible to users |
| Double-RAF removal | Internal, invisible to users |
| Agent-pane tool output caps | UI behaviour change, but subtle enough to skip |

---

## Cross-platform plan alignment

Per `specs/PLAN_CROSS_PLATFORM_DOCS_2026_05_30.md`:

| Page | Cross-platform plan verdict | This update |
|---|---|---|
| `getting-started.md` | Already balanced | No change |
| `multi-instance.md` | Tear-off Windows-only claim stale | Fix in Tier 1 #3 |
| `pane-types.md` | Needs verification | Add predictive echo + DnD |
| `installation.md` | Already balanced | Add MSIX |
| `settings.md` | Needs `term:predictiveecho` | Add in Tier 1 #4 |
| `internals/building.md` | Needs launcher update | Fix in Tier 2 #8 |
| `internals/platform-support.md` | Needs launcher + version rows | Fix in Tier 2 #6 |
| `internals/architecture.md` | Win32-centric language | Fix in Tier 2 #7 |

---

## Implementation order

1. **pane-types.md** — predictive echo section + DnD section + floating-pane note + animation note
2. **settings.md** — add `term:predictiveecho` and `term:predictiveecho:thresholdms` rows
3. **multi-instance.md** — tear-off platform table + version isolation section
4. **installation.md** — MSIX subsection
5. **internals/platform-support.md** — launcher + version-isolation rows
6. **internals/architecture.md** — neutralize Win32 framing
7. **internals/building.md** — launcher cross-platform note
8. **pane-types.md** (polish) — animation + floating-pane reliability

All in one PR. Bump docs to v0.0.52 and deploy.

