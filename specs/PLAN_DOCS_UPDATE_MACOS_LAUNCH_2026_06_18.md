# PLAN: Docs updates for the macOS launch-coherence work

- **Date:** 2026-06-18
- **Author:** AgentO (Masty)
- **Driver:** PR [#1568](https://github.com/agentmuxai/agentmux/pull/1568) (merged to agentmux `main`, commit `e9a05074`) — macOS **channel-scoped bundle id** + **unix `open_new_window` forward**. Plus the WRR cross-platform analysis (`docs/specs/ANALYSIS_WRR_CROSS_PLATFORM_2026_06_18.md`, issue [#1569](https://github.com/agentmuxai/agentmux/issues/1569)) and the reopen-on-double-click follow-up ([#1572](https://github.com/agentmuxai/agentmux/pull/1572)).
- **Status:** ✅ **implemented** on branch `agento/docs-macos-launch` (this PR), 2026-06-18 — `multi-instance.md`, `internals/wrr.md`, `internals/architecture.md`. Re-verified fresh against the merged docs sprints (#73/#75); those did not touch any macOS launch facts.

## What changed (the facts the docs must reflect)

1. **macOS app identity now follows the channel.** `CFBundleIdentifier = ai.agentmux.cef.<channel>` (default/release channel → `ai.agentmux.cef.stable`; a local build → `ai.agentmux.cef.local-<branch>`). Helpers inherit the suffix. Before this, every build shared `ai.agentmux.cef`, so double-clicking a second macOS version reactivated the running one and hung with **"AgentMux is not responding."**
2. **Cross-version coexistence on macOS has TWO layers, not one.** The launcher socket/pipe hash (already documented) is the *launcher* layer; the bundle id is the *LaunchServices* layer. Both must agree.
   - Different **channels** (a `local-<branch>` dev build vs `stable`) are now distinct macOS apps → double-click-launchable side by side.
   - Two **stable releases** still share `ai.agentmux.cef.stable` by design → LaunchServices reactivates the running one on double-click. Running two stable releases at once needs `open -n /path/AgentMux.app` or the in-app **"+ Open another window."**
3. **A second window** on macOS: a plain Finder/Dock double-click of a *running* AgentMux now opens a new window ([#1572](https://github.com/agentmuxai/agentmux/pull/1572) — an NSApplication-delegate `applicationShouldHandleReopen:`, since CEF's raw AppleEvent handler was inert). `open -n` and the in-app **"+ Open another window"** (status-bar instance chip) remain alternatives.
4. **WRR is Windows-only by design** (not "on the roadmap"). The cross-platform safety net is the orphan reconciler; the one real gap (crash-orphan detection) is issue #1569, not a WRR port.

---

## A. agentmux-docs (public site — `src/content/docs/`)

| # | Page | Pri | Change |
|---|---|---|---|
| **A1** | `multi-instance.md` | **HIGH** | §"Running different versions side-by-side" (~L121-127) currently credits macOS multi-version coexistence **only** to the launcher socket hash — add the **bundle-id/LaunchServices layer** (fact #2 above): different channels = distinct apps; two stable releases share `.stable` so double-click reactivates → use `open -n` / in-app new-window. Note the pre-#1568 "not responding" was fixed. **Also fix the stale channel name (~L16):** local `task package` channel is **`local-<branch>`**, not `dev-portable-<branch>` (`agentmux-common/src/data_paths.rs:51,95`) — and the macOS bundle id is derived from it. |
| **A2** | `internals/wrr.md` | MED | The "Windows-only today" admonition (L6-8) says "macOS and Linux equivalents are on the roadmap." Reframe to **Windows-only by design**: a full observation layer is not planned (Windows-specific defenses; Wayland has no portable API). Cross-platform safety net = orphan reconciler; the only real gap is crash-orphan detection (issue #1569). Cross-link `ANALYSIS_WRR_CROSS_PLATFORM_2026_06_18.md`. Keep the `/internals/platform-support/` link (page exists). |
| **A3** | `internals/platform-support.md` | MED | Match A2's "by design, not roadmap" WRR framing; add the macOS *bundle-id-follows-channel* fact to the macOS multi-instance row. |
| **A4** | `installation.md` | LOW | macOS section: optional one-liner — run multiple versions via `open -n` (xref multi-instance); a one-time macOS permission re-prompt can occur on the update that changed the bundle id (`ai.agentmux.cef` → `ai.agentmux.cef.stable`). |
| **A5** | `security/update-model.md` | REVIEW | macOS app *identity* changed (channel-scoped bundle id). If this page covers macOS update/identity (Gatekeeper/notarization/in-place update), note the id change and the one-time permission/login-item reset. *(verify page content)* |
| **A6** | multi-instance.md or pane-types.md | LOW | Document the macOS "open a second window" paths (`open -n`, in-app "+ Open another window"); note plain double-click focuses (reopen-new-window is a follow-up). |

## B. agentmux repo (internal docs + comments)

| # | File | Pri | Change |
|---|---|---|---|
| **B1** | `CLAUDE.md` | MED | "Multiple Instances Run in Parallel" / I1–I6: add the macOS bundle-id-follows-channel fact (stable = `.stable`; dev/local = distinct apps; `open -n` for two stable releases). The I1–I6 invariants cover pipe/socket keying but **not** the LaunchServices/bundle-id identity layer — add a cross-ref so future agents know the OS-identity layer exists on macOS. |
| **B2** | `agentmux-cef/src/wrr/mod.rs:34` (comment) | LOW | Stub says "WRR is Windows-only — Phase 7 will revisit." Reframe to "Windows-only by design; cross-platform safety net is the orphan reconciler (#1569)." |
| **B3** | `docs/specs/SPEC_MACOS_LAUNCH_COHERENCE_2026_06_18.md` | — | Already accurate (§7 status). No change. |

## Suggested order
1. **A1** (user-facing + currently misleading).
2. **A2 / A3** (WRR roadmap framing).
3. **B1** (keeps future agents accurate).
4. A4 / A5 / A6 / B2 (cleanup).

## Open verifications before landing
- Confirm `multi-instance.md`'s `dev-portable-<branch>` vs code's `local-<branch>` (may be a pre-existing drift to fix wholesale, not just for macOS).
- Read `security/update-model.md` to decide if A5 is needed.
- Confirm the reopen-handler follow-up outcome before writing A6 as final (if the swizzle lands, double-click *will* open a new window and A6/fact #3 change).
