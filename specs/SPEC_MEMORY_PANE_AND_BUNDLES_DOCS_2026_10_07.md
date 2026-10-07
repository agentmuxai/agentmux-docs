# SPEC: Docs for the Memory pane, several bundles per agent, and top-only section tabs

**Date:** 2026-10-07
**Author:** agent3 (Agent3@narko), at the operator's request
**Status:** active — shipped in one docs PR.
**Source:** agentmux's `docs/specs/SPEC_RENAME_KNOWLEDGE_TO_MEMORY_2026_10_06.md` §4.2–4.3 (the plan this implements) and what has shipped in agentmuxai/agentmux since:

| PR | What changed in the app |
|---|---|
| #4425 | The **Knowledge** pane is renamed **Memory**, view `memory`, icon `brain`; `knowledge` still opens it. The new-agent form loses its **Identity** field. |
| #4433, #4434 | An agent has an ordered **Bundles** list: picked in the new-agent form, the launch modal and the Stash, whose **Startup** tab became **Bundles**. Each picked bundle's instructions go into the startup file after Global Memory. |
| #4436 | Memory, Connectors, Warden and Settings keep their section tabs **along the top at every width**; the side rail is gone. |

## 1. The problem

The docs still describe the app before those changes:

- The Memory pane is documented as **Knowledge**, at `/knowledge/`, while `/memory/` is the **Bundles** page. The word "memory" means three things on the site.
- The new-agent form is described with **Identity** and **Memory** fields. It now has neither: the account is the provider's first, and the field is **Bundles**, a list.
- The **Stash → Startup** tab is described in five pages. It is now **Bundles**, and it no longer sends a bundle as the agent's first message.
- Connectors, Memory and Warden are described as having "a rail down the left side".
- The widget bar's default order, the hamburger menu and the command and keybinding ids are out of date.
- The glossary defines **block** wrongly and has no entries for Memory, Global Memory, Personal Memory, the Stash or the three kinds of tab.

## 2. Page moves and redirects (D3 of the source spec)

| Before | After |
|---|---|
| `knowledge.md` (`/knowledge/`, "Knowledge") | `memory.md` (`/memory/`, "Memory"), rewritten for the Memory pane |
| `memory.md` (`/memory/`, "Bundles") | `bundles.md` (`/bundles/`, "Bundles") |

- **Redirects** (`astro.config.mjs`): add `/knowledge` → `/memory`. `/the-forge` (the predecessor of bundles) moves to `/bundles`. `/armory` and `/trust-center` stay on `/connectors`.
- **Anchors kept.** The Memory page keeps `#global`, `#personal`, `#skills` and `#bundles`, so `/knowledge/#…` links still land. The Personal section carries `native-memory` and `the-memory-record-memory-follows-the-agent` anchors, so old `/memory/#native-memory` links land on the content they meant.
- **Native memory moves.** The Bundles page's "Native memory" and "memory record" sections are Personal Memory, not bundles, so they move into the Memory page's Personal section. The Bundles page links there.
- **Sidebar.** "Knowledge" becomes "Memory" (slug `memory`), and "Bundles" points at `bundles`. "Identity bundles" becomes "Identity & Accounts", the page's own title: there has been no identity-bundle object since the Preset-to-Bundle refactor.
- **Every inbound link** to `/memory/` that means bundles changes to `/bundles/`, and every `/knowledge/` link changes to `/memory/`.

## 3. The Memory page (`memory.md`)

- **Name and shape.** It's a regular pane, icon `brain`, with four sections — **Global**, **Personal**, **Skills**, **Bundles** — as tabs along the top at every width. They are icon-only when the pane is narrow, and stop growing and sit at the left when it is wide. The title reads "Memory · Skills". The source is `frontend/app/view/memory/memory.tsx`.
- **Opening it.** From the widget bar (pinned, 3rd), the hamburger menu, or the command palette's **Memory** command, which "knowledge", "skills" and "bundles" also find. The macOS app menu has **Memory…**. The keybinding id is `app:memory`, and `app:knowledge` still works.
- **Links in.** The Stash's **Skills** tab has **Browse all in Memory →** and **edit it there**. The Stash's **Bundles** tab links to **Memory → Bundles**.
- **Earlier names.** One line: Knowledge, and before that the Armory's Memory, Skills and Bundles tabs. Saved panes and layouts open here.
- **Personal.** Per §2, it gets the native-memory and memory-record content.
- **The Stash list.** **Accounts · Personal Memory · MCP Servers · Skills · Bundles · Registration**.

## 4. The Bundles page (`bundles.md`)

- **What a bundle is.** It stays as now. The "managed in Memory → Bundles" pointer and the Skills link are updated.
- **New: an agent's Bundles.**
  - An agent starts with an ordered list. Its **own bundle** comes first and is fixed; it is created with the agent and holds what's bound to just that agent. The bundles you pick follow it.
  - Picked in the new-agent form (**Bundles**, empty by default), the launch modal (saved to the agent when you click Launch; no bundle is required) and **Stash → Bundles** (saved on each change). It's the same control everywhere: up, down, remove, and "Add a bundle…".
  - **At launch:** each picked bundle with instructions becomes a `# [Bundle] <name>` section in the startup file, after Global Memory, in list order. Skills are added from every bundle in the list; when two bundles name the same one, the first wins.
  - **MCP servers:** these are added when the agent is opened through the Agent App API (`agent.open`). The Launch button in the agent pane doesn't add a bundle's MCP servers yet. Say so plainly, and don't claim more.
  - **The old Startup tab** sent one bundle as the agent's first message. That pick moves into the list automatically, and the first message no longer carries bundle instructions.
  - The provider stays the agent's own; a picked bundle doesn't change it.
- **The Launch-flow diagram.** It shows Identity and Memory dropdowns, so it's replaced with the current form.
- **Drop the paragraph** on the `view: "memory"` / `MemoryPaneViewModel` bundle view; that view is the Memory pane now.
- **The "vanilla CLI" sentence.** It says the blank bundle sits "at the top of the Launch modal", which is no longer true. An empty list is the vanilla case.
- **Persistence.** Add the per-channel `db_agent_bundles (agent_id, bundle_id, position)` table.

## 5. Other pages

| Page | Change |
|---|---|
| `getting-started.md` | Widget list order; no **Identity** field (the account is the provider's first, changed later from the Stash); the **Bundles** field |
| `quickstart.md` | The widget order; the Create step (no Identity; **Bundles** starts empty); "Choose the bundle as Memory" → "add it under Bundles" |
| `first-agent.md` | Fields 5–6 → one **Bundles** field; the account sentence; "(vanilla CLI)" → an empty list; Knowledge → Memory links; the bundle MCP sentence made accurate (§4) |
| `installation.md` | Widget bar default order (Agent, Swarm, Memory, Hangar, Connectors, Terminal, Editor, Browser, Messengers, Sysinfo, Help; **more**: Drone, Warden, Media, Toolchain, Remotes, Settings); hamburger list (Layouts has Save and Open layout…; Memory) |
| `pane-types.md` | Widget order; the table row (Memory, `brain`, `memory`); "Memory (native/'Brain')", Bundles and Skills rows; the Stash list (Bundles tab, `AgentBundlesTab`); `view: "memory"` sentence |
| `connectors.md` | Tabs along the top, not a rail; Knowledge → Memory; the Stash tab list |
| `warden.md` | Tabs along the top, not a rail |
| `main-menu.md` | Memory menu entry and palette searches |
| `keybindings.md` | `app:memory`; `app:knowledge` still works |
| `auth.md` | No **Identity** field at creation |
| `abf.md` | Knowledge → Memory links and names (Armory history stays as it is) |
| `identity.md`, `config.md`, `settings.md` | `/memory/` → `/bundles/` |
| `internals/agent-app-api.md` | Links; "Brain" wording → Personal Memory |
| `internals/conversation-overhead.md` | The Global Memory row; add a row for the picked bundles' sections |

**Not changed:** `security/reactive-event-bus.md` lists `armory` as a literal keyword the server matches, so it stays.

## 6. The glossary (§4.3 of the source spec)

- **New:** **Memory** (the pane), **Global Memory**, **Personal Memory** ("native memory" is the storage's code name), **Stash**, **Skills**, **window tab**, **pane tab**, **document tab**:
  - a window tab is a layout of panes;
  - a pane tab is one block stacked in a pane;
  - a document tab is one file inside one block, as in the Editor and Media panes; Browser has none.
- **Knowledge** becomes a "former name of Memory" entry. Its `#knowledge` anchor stays.
- **bundle:** an agent has an ordered list of them, its own first; picked in the **Bundles** field and the Stash.
- **block:** the current definition ("an immutable persisted unit of pane state … terminal output, code block, diff, chat message") is wrong. A block is one view instance: one pane tab, with its own meta.
- **Identity bundle:** there's no such object any more. The entry becomes **Identity**, an agent's directly-bound accounts, one per provider. The `#identity-bundle` anchor stays.
- **Connectors:** "together with Memory".
- **Check the rest:** read every remaining entry once against the code, and fix any drift found. This pass doesn't re-verify numbers that need a build, such as the launcher's binary size.

## 7. Delivery

One PR on agentmuxai/agentmux-docs. It carries a changeset and a `package.json` patch bump (this repo's checklist), and `npm run build` must pass. Merging deploys.
