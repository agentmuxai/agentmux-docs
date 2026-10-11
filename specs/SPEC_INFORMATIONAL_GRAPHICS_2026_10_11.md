# SPEC: Informational graphics in the introductory and high-traffic pages

**Date:** 2026-10-11
**Author:** Lazo (Lazo@Area54), at the operator's request
**Status:** proposed
**Related:** agentmuxai/agentmux#4676 (the screenshot system: what exists, how to rerun it), agentmuxai/agentmux `docs/reports/REPORT_DOCS_SCREENSHOT_COVERAGE_PLAN_2026_10_10.md` (#4644, the coverage plan this follows), `DIAGRAMS.md` §1 (diagram design tokens), `README.md` "Diagrams" (how diagrams are made).

## 1. The problem

The screenshot work put 89 images on the site, but they sit on the feature pages a reader reaches second. The pages a new reader meets first are text only, and so are the long pages people come back to:

| Page | Words | Images | Role |
|---|---|---|---|
| `index.mdx` (splash) | 241 | 0 | the front door |
| `getting-started.md` (Introduction) | 679 | 0 | the "Get Started" button lands here |
| `user-guide.mdx` | 190 | 0 | hub of cards |
| `installation.md` | 1,901 | 0 | every new user |
| `quickstart.md` | 804 | 2 | the first walkthrough |
| `multi-instance.md` | 3,350 | 0 | long concept page |
| `auth.md` / `identity.md` | 1,915 / 1,381 | 0 / 0 | sign-in is the first thing that goes wrong |
| `browser-pane.md` | 2,064 | 0 | a headline feature on the splash page |
| `abf.md` | 2,691 | 0 | format reference |
| `build-a-widget.md` | 1,121 | 0 | tutorial |
| `security/*` (7 pages) | 1,000–4,600 each | 0 | read by evaluators, who skim |

All 8 diagrams on the site are in Internals. The User Guide and Security sections have none, although they explain the ideas a picture explains best: what talks to what, what is shared and what isn't, and what leaves the machine.

The site has no analytics, so "high traffic" here is a judgement: the Get Started path (splash → Introduction → Installation → Quickstart → First Agent), the pages the splash cards and the Introduction's Key Concepts link to, and the Security section, which people evaluating AgentMux read first.

## 2. Goals and non-goals

**Goals**
- A reader of an introductory page sees what AgentMux looks like before reading how it works, and has a picture of how its parts fit together before the details.
- Long concept pages get a diagram at the point where the text describes structure, flow or a boundary.
- The graphics are easy to maintain: screenshots regenerate with the existing tooling, and diagrams show concepts that change slowly.

**Non-goals**
- Not decoration. Each graphic must show something the text describes, at the place it describes it.
- Not reference pages. Tables of variables, ids, errors and shortcuts stay text (§5.4).
- No new screenshots of UI that is still changing while the UI settles. Phase 3 (§7) waits for that.
- No change to the screenshot tooling's design. New shots are new entries in the existing suites.

## 3. Four kinds of graphic, and when to use each

| Kind | Use it for | Lives in | Maintained by |
|---|---|---|---|
| **Screenshot** | What the user will see: a window, a pane, a form, a menu | `src/assets/screenshots/<area>/` | `refresh.mjs` in agentmuxai/agentmux `scripts/ui-screenshots/`, which retakes every shot and copies it over the same name |
| **Concept diagram** | How parts relate: processes, flows, boundaries, what is shared | `public/diagrams/*.svg` | by hand, per `README.md` "Diagrams" |
| **Clip** | An interaction a still can't show (drag, follow, open and close) | `src/assets/recordings/` | `record.mjs` in the same tooling |
| **Structural component** | Steps, alternatives by platform, folder layouts, link hubs | inline in the page (`<Steps>`, `<Tabs>`, `<FileTree>`, `<LinkCard>`) | the page text itself; it has no image to go stale |

Prefer them in this order, cheapest to keep correct first: structural component, then concept diagram, then screenshot, then clip. Use a screenshot when the point is what the user sees, and a diagram when the point is how things connect. A screenshot of a settings form shouldn't be redrawn as a diagram. A diagram of process boundaries shouldn't be faked with a screenshot.

The structural components ship with Starlight 0.42 (`@astrojs/starlight/components`). They need the page to be `.mdx`, or for `<Steps>` and `<FileTree>` the Markdown forms Starlight supports. Converting a page from `.md` to `.mdx` keeps its URL and anchors.

## 4. Placement rules

These keep the graphics graceful: they support the text and never interrupt it.

1. **Text first, then the picture.** An image comes directly after the sentence that introduces it, never before it and never as the first thing under a heading. The one exception is the page-opening image (rule 2).
2. **One opening image on an introductory page.** It goes after the first paragraph and shows the whole subject ("this is the window", "this is how the parts fit"). That gives the reader a picture to hang the following text on.
3. **At most one graphic per `##` section** on a feature page, unless the section walks through a sequence (a form, then its result). Never two images in a row with no text between them, except a deliberate before/after pair, which gets one sentence introducing both.
4. **No graphics inside tables, asides or list items.** Put the image after the list or table it belongs to.
5. **No image repeated on consecutive pages of the Get Started path.** The full window (`chrome-window.png`) belongs to Quickstart's "Launch and orient" step, where the text walks through it, and to the splash hero, which is two pages away. Installation's "First launch" covers the same layout, so it shows the parts its text adds instead: the widget bar and the hamburger menu.
6. **Alt text says what the image shows.** Write it as a full description, as the existing shots do ("The agent picker: three agents under My Agents, each with its account and last message, and the New Agent cards below"). For a diagram, the alt text carries the diagram's content in words, so the page reads completely without it.
7. **Crop to the subject.** A full-window shot only for orientation; everything else is cropped to the pane, form or menu in question, so its text renders at a readable size in the content column. The capture tooling's `clip` selectors do this.
8. **Clips are rare.** At most one per page, only for motion, and never on a page's opening. They load as animated WebP; keep each under 400 KB.

### 4.1 Density targets

- **Introductory pages:** one graphic per 300–400 words, including the opening image.
- **Feature pages:** one per `##` section that describes something visible or a structure.
- **Concept and security pages:** one diagram per page, two at most, where the text describes structure, flow or a boundary.
- **Reference pages:** none (§5.4).

### 4.2 Both themes

- Screenshots are taken in the app's dark theme. On the site's light theme a dark screenshot floats on a pale page, so add a 1px border to content images in `custom.css` (`.sl-markdown-content img` with `--sl-color-gray-5`), and check it in both themes per the Review Checklist in `CLAUDE.md`.
- Existing diagrams switch colours with `@media (prefers-color-scheme: dark)`. An SVG loaded through `<img>` can't see the theme the reader picked in Starlight's selector, so a reader on a dark OS who picks light gets a dark diagram. New diagrams ship as a light and a dark file, shown with Starlight's `light:sl-hidden` and `dark:sl-hidden` classes, which follow the selector. The 8 existing diagrams move to the same scheme in Phase 2.
- The splash hero takes `hero.image.dark` and `hero.image.light`, so it follows the selector too.

## 5. Page by page

Priorities: **P0** is the Get Started path, **P1** is high-traffic feature pages, **P2** is Security and the Internals overview. "Exists" means the image is already in `src/assets/` and needs no capture.

### 5.1 P0: the Get Started path

| Page | Graphic | Placement | Source |
|---|---|---|---|
| `index.mdx` | Hero image: the AgentMux window | `hero.image` (dark and light; light can reuse the dark shot until a light capture exists) | `chrome-window.png`, exists |
| `getting-started.md` | **Concept diagram "How AgentMux fits together"**: a window holds tabs, a tab holds panes; an agent pane runs a harness (the CLI) that talks to a model vendor; an account and bundles feed the agent; agents message each other over the MuxBus; the Agent App API lets agents operate the workspace | Opening image, after the first paragraph, before "What is AgentMux?" | New: `public/diagrams/concepts-overview{,-dark}.svg` |
| `getting-started.md` | The agent pane mid-turn | After "You see each tool call and file edit as it happens" | `agent-conversation-start.png`, exists |
| `getting-started.md` | Quick Install as `<Tabs>`: Windows, macOS, Linux | Replaces the three bullets | Structural |
| `installation.md` | The top bar: the hamburger menu, a window tab and the widget bar | "First launch", after the widget bar paragraph | `chrome-top-bar.png`, exists |
| `installation.md` | The hamburger menu | "First launch", after the hamburger menu paragraph | `chrome-hamburger-menu.png`, exists |
| `installation.md` | Each platform's install sequence as `<Steps>` where it is a sequence (AppImage, `.deb`, `.rpm`, portable) | In place | Structural |
| `installation.md` | The Toolchain pane: tools found, versions, install buttons | "First launch", after the Toolchain paragraph | New shot, Phase 3: shows paths and versions, so it needs the capture tooling's demo data or redaction |
| `quickstart.md` | The window split into several panes | "4. Add more panes" | `chrome-split-layout.png`, exists |
| `quickstart.md` | The Bundles list | "5. Add instructions with a bundle" | `memory-bundles.png`, exists |
| `first-agent.md` | Small diagram "harness and model vendor": the harness CLI in the pane, its default vendor, and a custom endpoint (Claude Code only) | "Harnesses and providers", after its first paragraph | New: `public/diagrams/harness-vendor{,-dark}.svg` |
| `first-agent.md` | The Skills list | "Skills" | `memory-skills.png`, exists |
| `user-guide.mdx` | None: it is a hub of cards, and the pages it links to carry the pictures | n/a | n/a |

### 5.2 P1: high-traffic feature pages

| Page | Graphic | Placement | Source |
|---|---|---|---|
| `auth.md` | A pane that isn't signed in, with Log in and Bind | "Signing in from an agent pane" | `agent-sign-in.png`, exists |
| `auth.md` | The add-account form | "Connectors: Accounts" | `connectors-account-add.png`, exists |
| `auth.md` | Diagram "where a login goes": OAuth and API-key accounts, the credential store, the per-channel auth folder, and the agent it is bound to | "Where credentials are stored", after its first paragraph | New: `public/diagrams/accounts-credentials{,-dark}.svg`, shared with `security/identity-credential-storage.md` |
| `identity.md` | The Accounts list | "What an Account is" | `connectors-accounts.png`, exists |
| `multi-instance.md` | Diagram "modes, channels and data": the three runtime modes, the channel each maps to, its data folder, and what is shared across all of them | "What's per-instance vs per-version vs per-channel", before the table | New: `public/diagrams/instances-channels{,-dark}.svg`, also used by `internals/data-layout.md` |
| `browser-pane.md` | The browser pane's navigation bar | "Navigation bar" | New shot, Phase 3. The bar is page chrome and can be captured; the web content is a native child window the tooling can't capture (#4676), so crop to the bar |
| `abf.md` | The bundle's folder layout as `<FileTree>` | "On-disk format" | Structural |
| `build-a-widget.md` | The widget folder as `<FileTree>` | "Your first widget" | Structural |
| `build-a-widget.md` | The approval prompt | "Install it and try it" | `settings-widget-approval.png`, exists |
| `build-a-widget.md` | The finished sample widget in a pane | "Install it and try it", after the approval prompt | New shot, Phase 3: the widgets suite installs a sample widget and captures its pane |
| `internals/interagent-comms.md` | Diagram "delivery tiers": host, channel, LAN and WAN, and which one a message takes | "Delivery tiers" (the Introduction's Key Concepts links here) | New: `public/diagrams/delivery-tiers{,-dark}.svg` |

Pages that already have enough (`window.md`, `pane-types.md`, `settings.md`, `memory.md`, `connectors.md`, `widget-gallery.md`) are left alone. The 14 medium-size widget shots that no page uses stay where they are, and are deleted from the repo if Phase 1 still finds no place for them.

### 5.3 P2: Security and the Internals overview

| Page | Graphic | Placement | Source |
|---|---|---|---|
| `security/trust-model.md` | Diagram "trust boundaries": the processes, the auth key every pane has, agents, container agents, and sandboxed widgets, each inside the boundary it is trusted within | "The processes and what they trust" | New: `public/diagrams/trust-boundaries{,-dark}.svg` |
| `security/data-sovereignty.md` | Diagram "what leaves your machine": the machine's edge, and the arrows that cross it (agents' model traffic, the calls it makes with no click, background model calls, what you ask for, MCP servers), each labelled with when | "What leaves your machine, and when" | New: `public/diagrams/data-egress{,-dark}.svg` |
| `security/widgets.md` | Diagram "a widget's call": the sandboxed frame, the SDK, the two permission checks, then AgentMux | "Every call is checked twice" | New: `public/diagrams/widget-call{,-dark}.svg` |
| `security/widgets.md` | The approval prompt | "Approval" | `settings-widget-approval.png`, exists |
| `security/identity-credential-storage.md` | The accounts diagram from `auth.md` | "How credentials reach agent processes" | Shared with `auth.md` |
| `internals/index.mdx` | The architecture diagram, linking to the Architecture overview | After the opening paragraph | `public/architecture.svg`, exists |

Each diagram must match the security page's own words. Write the diagram from the page, and if the page and the code disagree, fix the page first.

### 5.4 No graphics

Reference pages are read by lookup, and an image there only pushes the table down: `glossary.md`, `keybindings.md`, `config.md`, `widget-api.md`, `internals/env-vars.md`, `internals/error-catalog.md`, the API reference, `internals/terminal-latency-benchmark.md`, `internals/contributing.md`, `internals/building.md`, `internals/debugging.md`. `internals/ipc-catalog.md` keeps the diagram it has.

## 6. Making the graphics

### 6.1 Screenshots

- Every new screenshot is a shot in one of the capture suites in agentmuxai/agentmux `scripts/ui-screenshots/` (`chrome`, `agent`, `memory`, `widgets`). Its file name in the docs is its shot id, so `publish.mjs` finds it and `refresh.mjs` keeps it current. No hand-taken screenshots: they can't be retaken when the UI changes.
- The shot runs against the isolated capture instance with demo data, never a real account or machine. It sets `containsWorkspaceData` (false, or "review" when a person must check it), and the tooling's redaction runs. The README in that folder has the steps.
- Each new shot has a `verify` check, so a run fails rather than saving a wrong picture when the screen changes.

### 6.2 Concept diagrams

- Hand-authored SVG with explicit coordinates, following `README.md` "Diagrams" and the tokens in `DIAGRAMS.md` §1. Start from an existing file in `public/diagrams/`.
- Text stays text (no outlined glyphs), so it is crisp at any zoom, searchable and readable by screen readers. The site's click-to-zoom (`DiagramZoom.astro`) works on SVGs already.
- Two files per diagram, `<name>.svg` and `<name>-dark.svg` (§4.2).
- Each SVG starts with a comment naming the page text and the code it reflects, for example `<!-- Source: security/data-sovereignty.md "What leaves your machine"; crates/srv/... -->`, so a later edit knows what to check.
- Keep them small: 6–12 boxes, one idea each. If a diagram needs a legend longer than three lines, split it.
- Width at most 720px at 1×, the content column's width, so text isn't scaled down.

### 6.3 Weight

- Astro converts raster images to WebP at build time. Keep each introductory page's images under 1.5 MB in total in `dist/`. The splash page's hero must be under 300 KB.
- Images below the fold load lazily, which Astro's default `<img>` output does.

## 7. Phases

| Phase | What | Needs | PRs |
|---|---|---|---|
| **1** | Every row marked "exists" or "Structural" in §5; the image border in `custom.css`; `hero.image` on the splash page | Nothing new: images already in the repo, components already in Starlight | One agentmux-docs PR |
| **2** | The new concept diagrams, P0 first (`concepts-overview`, `harness-vendor`, `delivery-tiers`), then P1 (`instances-channels`, `accounts-credentials`), then P2 (`trust-boundaries`, `data-egress`, `widget-call`); the 8 existing diagrams move to light and dark files | Drawing; checking each against its page and the code | Two or three agentmux-docs PRs, one per priority |
| **3** | New screenshots: Toolchain, the browser navigation bar, the sample widget's pane; a light-theme hero | The UI settling (#4676), then new shots in the capture suites | One agentmux PR for the shots, then one agentmux-docs PR |

Phase 1 can start now. Phase 2 can start now too, since it depends on concepts, not on pixels. Phase 3 waits, like the rest of the screenshot work.

## 8. Acceptance

- `npm run build` passes, with the same page count as before.
- Every page in §5.1–5.3 has the graphics listed, at the places listed, and each image has alt text per rule 6.
- No page breaks a §4 rule: no image ahead of its introducing sentence, no two images back to back without text, no image in a table, aside or list item.
- Checked in a standard browser in light and dark themes, each with the selector set both ways: borders show on light, diagrams follow the selector, and the hero switches.
- Total images per introductory page within §6.3.
- Phase 3 shots appear in a `refresh.mjs` run and pass their `verify` checks.

## 9. Open questions

1. **A light-theme screenshot set.** The app has a light theme. Capturing every shot in both themes doubles the set and the review work. This spec only proposes a light hero (Phase 3), and leaves a full light set to #4676.
2. **Inline SVG instead of two files.** A small Astro component that inlines the SVG would let one file follow the selector through CSS variables. It would mean `.mdx` pages for every diagram, so two files are proposed for now.
3. **Measuring traffic.** With no analytics, §1's priorities are judgement. If the site gets privacy-respecting page counts later, revisit P1 and P2.
