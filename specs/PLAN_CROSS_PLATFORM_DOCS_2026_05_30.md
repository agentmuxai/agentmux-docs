# Plan: Cross-Platform Documentation (add macOS & Linux)

**Date:** 2026-05-30
**Repo:** `agentmuxai/agentmux-docs` (Astro + Starlight, static MPA, docs.agentmux.ai)
**Goal:** The docs are Windows-centric. Make every user-facing and internals page cover **macOS** and **Linux** to the same standard as Windows — without regressing the Windows content.
**Collaboration:** Two authors work in parallel — **asaf (macOS owner)** and a **Linux agent (Linux owner)** — plus shared cross-cutting work. This plan partitions the work so the two can run concurrently with minimal merge conflict.

---

## 1. Current state (assessment)

The site is structurally sound and already has a few **gold-standard** cross-platform pages. The problem is uneven coverage: install + a handful of pages handle all three OSes well, while most prose, examples, and internals silently assume Windows (paths, `.exe`, PowerShell, Win32/HWND, named pipes, Job Object, Windows Firewall).

**Gold-standard pages to emulate (do NOT rewrite — copy their pattern):**
- `internals/platform-support.md` — the authoritative per-OS parity table. This is the hub everything else links to.
- `internals/clipboard.md` — per-OS implementation block (`Win32` / `pbcopy` / `wl-copy`+`xclip`).
- `security/update-model.md` — per-OS signed-artifact + per-OS verify commands.
- `security/trust-model.md`, `security/identity-credential-storage.md` — Unix mode `0600`/`0700` **and** Windows DACL both stated.
- `internals/debugging.md`, `internals/wrr.md` — correct use of `:::note[Windows-only]` admonitions with the macOS/Linux roadmap stated inline.

**Already balanced (no work, just spot-verify):** `getting-started.md`, `main-menu.md`, `window-appearance.md` (Windows-only but correctly flagged), `internals/persistence.md`, `internals/lan-discovery.md`, `security/data-sovereignty.md`, `security/reactive-event-bus.md`, `index.mdx`, `user-guide.mdx`.

**Accuracy caveat — verify against current app source.** Docs are sourced from `agentmuxai/agentmux`. Several macOS/Linux behaviors changed very recently and some are still in flight; the previous "Windows-only" framing is now partly stale. Confirm each before writing:
- macOS floating-pane **tear-off**, **redock**, and **drag slide-back suppression** now work (PRs #1185/#1186/#1194, merged). The "tear a tab into a new instance — Windows only" framing in `multi-instance.md` needs re-checking against what macOS actually does today.
- The **launcher** now drives `srv + host` on macOS/Linux `task dev` (PR #1193, in review) — this changes the "launcher is Windows-only / Unix invokes host directly" claims in `building.md`, `internals/architecture.md`, `internals/reducer-stack.md`, and `parent_process` framing.
- **Window transparency** is still Windows-only (`window-appearance.md` is correct).
- **WRR** is still Windows-only (`internals/wrr.md` is correct).

---

## 2. Guiding patterns (codify once, apply everywhere)

To keep both authors consistent, standardize on these five patterns (all already exist somewhere in the repo — we're just making them universal). **These should be added to `CLAUDE.md` as a "Cross-platform writing guide" section (Workstream 0).**

1. **Per-OS command blocks** — when a command differs, show all three, labeled, in this order (Windows, macOS, Linux) OR (macOS, Windows, Linux) — pick ONE order and use it everywhere. Recommend **macOS · Windows · Linux** (alphabetical-ish, and matches `installation.md`).
2. **Feature-availability admonitions** — `:::note[Windows-only today]` / `:::caution[Not yet on Linux]` with the per-OS roadmap stated inline and a link to `/internals/platform-support/`. Never leave a platform unmentioned — "not yet" is information.
3. **Path notation** — lead with `~/.agentmux/...` (works as prose on all three), then give the literal per-OS resolution where it matters: macOS `~/Library/Application Support/...` or `~/.agentmux`, Windows `%APPDATA%\AgentMux` / `%LOCALAPPDATA%\AgentMux`, Linux `~/.agentmux` / `$XDG_*`. (Confirm actual dirs from `agentmux-common/src/data_paths.rs`.)
4. **Concept-binding one-liners** — when naming a platform primitive, name all three: "named pipe (Windows) / Unix domain socket (macOS + Linux)", "Job Object (Windows) / process group (macOS + Linux)", "HWND child window (Windows) / NSView (macOS) / X11/Wayland surface (Linux)".
5. **Code-location callouts** — point at the real source and its `#[cfg]` split so the claim is verifiable: "`agentmux-cef/src/commands/clipboard.rs` — Windows `OpenClipboard`, macOS `pbcopy`, Linux `wl-copy`".

A reusable Starlight snippet/partial (e.g. `src/components/PlatformMatrix.astro` or a documented MDX include) for the 3-column availability badge would reduce copy-paste — **optional**, decide in Workstream 0.

---

## 3. Ownership model (two agents in parallel)

Partition by **page ownership** to avoid conflicts. Each page has ONE owner who writes the whole page; for pages that need a platform the owner can't verify, the owner writes the structure + a `TODO(linux)` / `TODO(macos)` cell and the other agent fills it in a follow-up commit (never two agents editing the same page simultaneously).

| Owner | Scope |
|-------|-------|
| **Shared (do first, together)** | Workstream 0: conventions in `CLAUDE.md`, the per-OS command order decision, the optional `PlatformMatrix` component, and a refresh of `internals/platform-support.md` as the single source of truth. Everything else links here. |
| **asaf — macOS** | All macOS cells: Gatekeeper/notarization/quarantine, macOS firewall (no prompt; `~/Library` paths), `.app` bundle, `pbcopy`/`pbpaste`, `NSWorkspace`/`NSView`/Cocoa, `Cmd` keybindings, Crash Reporter (`~/Library/Logs/DiagnosticReports`), `xcode-select`/Homebrew/arm64-vs-x86_64 build notes, the **recently-landed macOS tear-off / redock / floating-pane** UX, launcher-on-macOS-dev. |
| **Linux agent — Linux** | All Linux cells: AppImage + `.deb` install, glibc/FUSE requirements, `chmod +x`, ufw/firewalld/SELinux, Wayland vs X11 (and compositor-dependent features like transparency), `wl-copy`/`xclip`/`xsel`, `apt`/`rustup`/`ninja-build` build deps, `systemd-coredump`/`apport` crash paths, `$XDG_*` / `~/.agentmux` paths, urgency-hint window attention, launcher-on-Linux-dev. |
| **Either (claim in tracking issue)** | Platform-neutral reframing of Windows-centric prose (e.g. rewriting an HWND-only sentence into a 3-way concept one-liner), glossary additions, IPC concept table — these touch shared pages, so claim per-page before starting. |

**Branch/PR hygiene:** one branch per page (or per small page-group) named `docs/xplat-<page>`; small PRs; each PR bumps `package.json` version per the repo's review checklist; each PR runs `npm run build` and reports the page count. Land Workstream 0 first so both authors build on the agreed conventions.

---

## 4. Work breakdown (by effort, with owner + the concrete gap)

### Workstream 0 — Conventions & hub (SHARED, do first)
- [ ] `CLAUDE.md` — add "Cross-platform writing guide" (the 5 patterns in §2, the chosen command order). **Owner: shared.**
- [ ] Decide & (optionally) build `src/components/PlatformMatrix.astro` availability badge. **Owner: shared.**
- [ ] `internals/platform-support.md` — refresh the parity table against current source (tear-off, redock, launcher-on-Unix-dev, drag slide-back). Confirm it is the canonical hub every admonition links to. **Owner: shared (asaf drafts, Linux agent verifies Linux rows).**

### HEAVY (substantial new content)
- [ ] `internals/building.md` — macOS arm64-vs-x86_64 detection + Homebrew specifics (**macOS**); Linux compositor/graphics deps, `ninja-build`, X11/Wayland (**Linux**). Re-verify the launcher build steps now that the launcher builds on Unix.
- [ ] `lan-discovery.md` — add macOS section (Gatekeeper/local-network permission, no Windows-Firewall prompt) (**macOS**) and Linux section (ufw/firewalld rules, SELinux) (**Linux**) parallel to the existing Windows-Firewall section.
- [ ] `internals/reducer-stack.md` + `internals/architecture.md` — replace "named pipe IPC / Win32 hooks" with the 3-way concept binding; add a small IPC-mechanism table. Re-verify against the now-cross-platform launcher. **Owner: either (claim together — they overlap).**

### MODERATE (sectioned additions)
- [ ] `installation.md` — Windows uninstall/upgrade + MSIX-vs-portable semantics; confirm macOS `.dmg`/notarization wording (**macOS**) and Linux AppImage/`.deb` wording (**Linux**) are current.
- [ ] `multi-instance.md` — explain the Job Object concept for non-Windows readers + the macOS/Linux process-group equivalent; **re-check the "tear a tab into a new instance — Windows only" claim** against current macOS behavior (it may now be partly available). **Owner: macOS (feature changed on macOS), with Linux cell.**
- [ ] `internals/modal-system.md` — cross-platform modal stacking over native panes (Win32 region clip vs macOS NSView vs Linux surface). **Owner: either.**
- [ ] `pane-types.md` — expand the taskbar-flash / dock-bounce / urgency-hint attention behavior per OS; file-tree roots already cover all three (verify).

### LIGHT (one-liners / examples / a cell)
- [ ] `settings.md` — Windows default shell (`pwsh.exe`/Git Bash) vs Unix `/bin/bash` for `term:localshellpath`.
- [ ] `config.md` — add a Windows shell-path example alongside `/bin/bash`.
- [ ] `quickstart.md` — add the Cmd-vs-Alt keybinding callout (link to `keybindings.md`).
- [ ] `browser-pane.md` — brief macOS (Cocoa) / Linux (X11/Wayland) browser-embedding note alongside the HWND detail.
- [ ] `glossary.md` — add entries: HWND, named pipe / Unix domain socket, Job Object / process group, Gatekeeper, AppImage.
- [ ] `security/network-exposure.md` — note Windows DACL alongside the Unix `0600`.
- [ ] `internals/data-layout.md` — add per-OS literal path examples for the `~/.agentmux/` tree.
- [ ] `keybindings.md` — footnote on why `Ctrl+P` / `Ctrl+Shift+Arrow` stay `Ctrl` on macOS (verify against the app).

### VERIFY-ONLY (likely no change)
- [ ] `getting-started.md`, `main-menu.md`, `window-appearance.md`, `internals/wrr.md`, `internals/clipboard.md`, `internals/debugging.md`, `internals/persistence.md`, `internals/lan-discovery.md`, `security/{trust-model,update-model,identity-credential-storage,data-sovereignty,reactive-event-bus}.md`, `index.mdx`, `user-guide.mdx`.

---

## 5. Sequencing

1. **Workstream 0** (shared) — conventions + `platform-support.md` hub. Blocks nothing else hard, but doing it first prevents rework.
2. **Parallel platform passes** — asaf sweeps macOS cells across HEAVY→LIGHT; Linux agent sweeps Linux cells. Page ownership keeps them out of each other's diffs.
3. **Shared-prose reframing** (the "either" pages: architecture/reducer-stack/modal/glossary) — claim per page in a tracking issue.
4. **Final verify pass** — re-read the VERIFY-ONLY list; run `npm run build`, confirm page count didn't drop and no broken `/internals/platform-support/` links.

---

## 6. Validation & done-criteria

- `npm run build` passes for every PR; page count is stable or grows (note it in the PR).
- No page leaves a platform **unmentioned** for a feature — "not yet on Linux" counts as covered.
- Every `:::note[...-only]` admonition links to `/internals/platform-support/`.
- Command/path examples follow the §2 patterns and the chosen OS order.
- Claims are backed by current `agentmuxai/agentmux` source (cite the file + `#[cfg]` split).
- For any `custom.css` change (e.g. a `PlatformMatrix` component), test **both** dark and light mode (repo checklist).
- **Definition of done:** a macOS or Linux user can read install → quickstart → first-agent → features → troubleshooting end-to-end and never hit a Windows-only instruction without a labeled alternative or an explicit "not yet" note.

---

## 7. Tracking

Suggest a GitHub issue (or a checklist PR) in `agentmux-docs` mirroring §4, with each line assigned to **macOS** / **Linux** / **shared**, so the two agents can claim items and avoid double-work. Keep this plan file as the living spec; update the checkboxes as pages land.
