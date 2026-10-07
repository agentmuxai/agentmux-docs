---
title: "Glossary"
description: "Canonical definitions for AgentMux terminology."
---

AgentMux has its own vocabulary. This page is the authoritative source — when two pages use a term differently, this one wins.

## Terms

<a id="abf"></a>**ABF (Agent Bundle Format)** — The file format for exporting and importing a [bundle](#bundle) as a single `.abf` file: instructions, skills, MCP servers, native memory and credential requirements, composing existing standards (Agent Skills, MCP `server.json`, AGENTS.md). It was called the Armory Bundle Format; the letters and the `.abf` extension are unchanged. See [Agent Bundle Format (ABF)](/abf/).

**agent operating environment** — How AgentMux positions itself: more than a workspace, it's an environment where agents are first-class residents with stable identity, memory, a streaming parser, lifecycle management, and access to the [Agent App API](#agent-app-api). An agent running inside AgentMux can open panes, rename tabs, discover peers, and send messages — not just process text.

**Agent App API** — The typed RPC surface an agent uses to call back into the AgentMux workspace — spawn panes, set titles, render dashboards, update status. See [/internals/agent-app-api](/internals/agent-app-api/).

**AppImage** — The Linux distribution format for AgentMux. A single self-contained executable (`.AppImage`) that bundles the app, the Chromium runtime, and all shared libraries. Run directly: `chmod +x AgentMux_amd64.AppImage && ./AgentMux_amd64.AppImage`. On first launch it extracts itself to `~/.local/share/agentmux/extracted/<version>/` for faster subsequent starts. See [Installation](/installation/#linux).

**agent pane** — A pane that runs an AI agent session. Streams the agent's tool calls, reasoning, and file diffs into a structured view. See [Pane types](/pane-types/).

<a id="ambient"></a>**ambient** — A model call AgentMux makes on its own, not one you asked for: pane titles, activity summaries, ghost-text prompt suggestions, narration and the continuity summary. These use a small, fast model and are counted as "AgentMux internal" in token usage. "Ambient" says how something was produced, never where it goes: text sent into the agent is a [context delivery](#context-delivery). (The same word also appears in *ambient login*, the host's own CLI login; that's unrelated.)

<a id="block"></a>**block** — One view instance: an Agent, a Terminal, an Editor, a Browser and so on, with its own settings (its *meta*: the view type, the file or URL, zoom, colour) persisted by the [sidecar](#sidecar). Each [pane tab](#pane-tab) is one block. The layout records which blocks sit in which pane. Blocks are not pieces of output: a terminal's output or an agent's messages live inside their block. See [Persistence](/internals/persistence/) and [Pane types](/pane-types/).

<a id="bundle"></a><a id="memory-bundle"></a>**bundle** (formerly "Preset") — A reusable package of an agent's instructions, MCP servers, memory and skills. An agent takes several, in order: its own bundle first (created with the agent), then the ones picked in the new-agent form's **Bundles** field, the launch modal or the [Stash](#stash). Each picked bundle's instructions go into the agent's startup file after [Global Memory](#global-memory). A bundle is *what an agent does*; its [Identity](#identity-bundle) is *who it does it as*. Managed in [Memory → Bundles](/memory/#bundles); exported and imported as [ABF](#abf) files. See [Bundles](/bundles/).

<a id="browser-pane"></a>**browser pane** — A [pane](#pane) of type `browser` — an embedded `CefBrowserView` (a child Chromium browser, not an iframe). Each browser pane runs in its own [renderer](#renderer) process; opening more browser panes adds more renderer processes. See [Browser pane](/browser-pane/) and [Pane types](/pane-types/).

**CEF** — Chromium Embedded Framework. The host process embeds Chromium via CEF to render the SolidJS frontend; this replaces the platform WebView and gives AgentMux a consistent Chromium runtime on Windows, macOS, and Linux. See [Architecture overview](/internals/architecture/).

<a id="channel"></a>**channel** — A named on-disk data-dir scope that groups AgentMux builds for shared agent definitions and settings. Key channels: `stable` (installed + released portables), `local-<branch>` (locally built portables), `dev-<branch>-<clone>` (dev-mode builds). Agent definitions and `settings.json` persist within a channel across version upgrades; runtime databases (SQLite, CEF cache, IPC artifacts) are scoped per `(channel, version)`. See [Multi-instance & dev mode](/multi-instance/).

<a id="connectors"></a>**Connectors** — The app-wide pane for what agents connect to outside AgentMux, in two sections: **Accounts** (sign-ins to providers and services such as Claude, Codex, GitHub, Google Workspace, AWS, OpenAI, Anthropic, Slack and AgentMux Cloud, bound to agents) and **MCP servers**. Opened from the widget bar, the hamburger menu (≡) or the command palette. Together with [Memory](#memory) it replaced the Armory. See [Connectors](/connectors/).

<a id="context-delivery"></a>**context delivery** — Content an agent is given without you typing it, such as Claude Code's conversation summary after a compaction. The agent pane shows each one as a collapsed card with a title, a size and a one-line excerpt; click it to read the full text. See [Conversation overhead](/internals/conversation-overhead/).

<a id="document-tab"></a>**document tab** — One file inside one [block](#block), shown in a tab strip under the pane header: the Editor's files and the Media pane's files. The innermost of the three kinds of tab, after [window tabs](#window-tab) and [pane tabs](#pane-tab). A document tab is another document in the same pane; Agent, Terminal and Browser panes have none.

<a id="global-memory"></a>**Global Memory** — Entries composed into every agent's startup file (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, …) at launch, as `# [Workspace] <name>` sections, after AgentMux's own Operator Config entries (`# [AgentMux System]`). Managed in [Memory → Global](/memory/#global); agents use the `GlobalMemory*` MCP tools. Shared by the channels that share your main accounts.

<a id="host"></a>**host** — The CEF process (`agentmux-cef`). One per [instance](#instance). Owns the OS [windows](#window), the [browser panes](#browser-pane), the JS bridge, and IPC fan-out to every [renderer](#renderer). Spawned by the [launcher](#launcher); spawns the Chromium subprocesses. (The [sidecar](#sidecar) is also spawned by the launcher, which owns its lifecycle — see [Architecture overview](/internals/architecture/).)

<a id="identity-bundle"></a><a id="identity"></a>**Identity** — An agent's directly-bound [accounts](/connectors/#accounts), at most one per provider: *who an agent acts as*, as its [bundles](#bundle) are *what it does*. A new agent takes the provider's first account; **Bind** changes it. See [Identity & Accounts](/identity/).

<a id="instance"></a>**instance** — One AgentMux **process tree**, rooted at one [launcher](#launcher), with its own [sidecar](#sidecar), [host](#host), [renderer](#renderer)(s), and process-isolation container (Job Object on Windows / [process group](#process-group) on Linux + macOS). Each launch of `agentmux-launcher` creates a new instance. Multiple instances run side-by-side. The "other AgentMux instances on LAN" entries shown in the status bar each correspond to a separate instance. See [Multi-instance & dev mode](/multi-instance/).

> Note: "instance" is *not* one process — a baseline single-window dev session has 4 processes ([launcher](#launcher) + [sidecar](#sidecar) + [host](#host) + 1 [renderer](#renderer)), plus shared GPU/utility Chromium subprocesses, plus more renderers as windows and browser panes are opened.

> Note: instances and **data dirs** don't always map 1:1. The data dir is keyed by [*channel*](/internals/data-layout/), not by instance. Two portables on the same channel launched from different folders are two distinct instances (two process trees, two process-isolation containers) that share the same on-disk SQLite database — see [Multi-instance & dev mode](/multi-instance/) for the per-instance vs per-channel split.

<a id="jekt"></a>**jekt** — Verb. Inject a message directly into a target agent's terminal stdin. Synchronous, immediate processing. Counterpart to [message](#message). Use the `SendMessage` MCP tool (Agent App API) or `POST /agentmux/reactive/inject` to jekt an agent.

<a id="knowledge"></a>**Knowledge** — The former name of the [Memory](#memory) pane. Panes, layouts, keybindings (`app:knowledge`) and links (`/knowledge/`) that use it still reach Memory.

<a id="launcher"></a>**launcher** — The 325 KB shim process (`agentmux-launcher`) that boots AgentMux. Spawns the host and sidecar, holds the IPC auth-key, tracks window reality. See [Architecture overview](/internals/architecture/).

<a id="memory"></a>**Memory** — The app-wide pane for what agents know and carry, in four sections: **Global** ([Global Memory](#global-memory)), **Personal** ([Personal Memory](#personal-memory)), **Skills** and **Bundles**. Opened from the widget bar, the hamburger menu (≡) or the command palette. Formerly [Knowledge](#knowledge); together with [Connectors](#connectors) it replaced the Armory. "Memory" on its own means this pane; the other kinds are always qualified as Global or Personal Memory. See [Memory](/memory/).

<a id="message"></a>**message** — Verb. Deliver a message to the recipient's mailbox; the recipient reads it when they're ready. Asynchronous counterpart to [jekt](#jekt). Use the `SendMessage` MCP tool (Agent App API) with the target agent's name.

<a id="agentbus"></a>**MuxBus** — The cross-process, cross-machine interagent messaging substrate, in three tiers: **Host** (in-process reactive handler, same AgentMux instance), **LAN** (mDNS peer-to-peer forwarding, same network, v0.46+), and **WAN** (opt-in cloud relay you operate). Two delivery models: [jekt](#jekt) and [message](#message). Powers the `DiscoverAgents` and `SendMessage` Agent App API tools. See [Interagent Communication](/internals/interagent-comms/) and [Reactive event bus](/security/reactive-event-bus/). (Formerly called *agentbus*.)

**MCP** — Model Context Protocol. A JSON-RPC protocol that AI agents use to talk to external tools and data sources. Agents subscribe to MCP servers; MCP servers expose tools, resources, and prompts.

<a id="muxqueue"></a>**Muxqueue** — The shared work queue: durable items any agent can enqueue and claim later. The **pull** counterpart to [MuxBus](#agentbus)'s **push** — `SendMessage` names a recipient and delivers now; a Muxqueue item waits to be claimed instead (usually by anyone, optionally restricted to one agent or group). Claiming grants a time-limited *lease*, not ownership, so a crashed claimant's item can be re-offered — though only while it has attempts left, and only once some agent's next claim triggers the lazy reaper. Lives in the always-global store, so items cross channels and survive restarts. Exposed as the `Work*` Agent App API tools and `muxspect work`. See [Agent App API](/internals/agent-app-api/#muxqueue--the-shared-work-queue).

**OAC** — Origin Access Control. The AWS CloudFront mechanism that restricts S3-bucket access to a specific distribution. Used by the docs and landing infrastructure; not a runtime AgentMux concept.

<a id="pane"></a>**pane** — A UI slot in the workspace layout. A pane holds one or more [pane tabs](#pane-tab). Panes have types: terminal, agent, code editor, browser, media, swarm, system metrics and more (see [Pane Types](/pane-types/)). The user composes a workspace by mounting panes in a grid. The `browser` type is a special case — see [browser pane](#browser-pane).

<a id="pane-tab"></a>**pane tab** — One [block](#block) stacked in a [pane](#pane), shown in the pane header's tab strip: an Agent and a Terminal can share one pane as two pane tabs. The middle of the three kinds of tab, between [window tabs](#window-tab) and [document tabs](#document-tab). A pane tab is a different pane in the same slot. See [Pane tabs](/pane-types/#pane-tabs).

<a id="personal-memory"></a>**Personal Memory** — An agent's own memory files: notes it reads and writes about itself, kept by its provider (for Claude Code, a `memory` folder and its `MEMORY.md` index) and versioned by AgentMux's memory record, so they follow the agent across accounts and channels. Shown in [Memory → Personal](/memory/#personal) and the agent's [Stash](#stash) → Personal Memory; agents use the `Memory*` MCP tools. "Native memory" is its storage's name in the code; it was once labelled "Brain".

<a id="process"></a>**process** — An OS process. **Avoid in user-facing copy** — one [instance](#instance) has 4+ processes ([launcher](#launcher), [sidecar](#sidecar), [host](#host), [renderer](#renderer)s, plus Chromium GPU/utility subprocesses), so "this AgentMux process" is ambiguous. Reserve "process" for internal docs that genuinely discuss the process tree.

<a id="process-group"></a>**process group** — The Linux + macOS equivalent of a Windows Job Object for AgentMux's process-isolation needs. The launcher places the host and sidecar in a process group. On Linux, `PR_SET_PDEATHSIG` ensures child processes terminate when the launcher exits — this prevents orphaned `agentmux-cef` or `agentmux-srv` processes if the launcher crashes. On macOS, crashed-parent children are reparented to launchd rather than killed; the process group provides isolation but not automatic orphan cleanup.

**reducer stack** — AgentMux's layered state model. Each layer (launcher / host / sidecar / frontend slice) owns a slice of state, with dispatch ordered top-to-bottom. The single canonical place to look for "why did X change?" See [The reducer stack](/internals/reducer-stack/).

<a id="renderer"></a>**renderer** — A Chromium renderer process (`agentmux-cef --type=renderer`). Runs the SolidJS frontend JS for one browser context. **Not a singleton** — every OS [window](#window) gets its own renderer, and every [browser pane](#browser-pane) inside a window adds another. Multiple renderers per [instance](#instance) is the normal case.

<a id="sidecar"></a>**sidecar** — The Rust app-domain server process (`agentmux-srv`). Owns workspaces, tabs, blocks, layouts, agents, identity. Persists to SQLite. Bound to 127.0.0.1 only. See [Architecture overview](/internals/architecture/).

<a id="skill"></a>**skill** — A reusable instruction an agent can call, as a `/trigger` or a Claude Code skill file. Global skills are in [Memory → Skills](/memory/#skills); an agent can also have private ones, and its bundles add theirs at launch.

<a id="stash"></a>**Stash** — The per-agent drawer behind the `backpack` icon in an agent pane's header, with tabs **Accounts**, **Personal Memory**, **MCP Servers**, **Skills**, **Bundles** and **Registration**: the per-agent side of [Connectors](#connectors) and [Memory](#memory). Its **Bundles** tab was **Startup**. See [Pane types → Subsections](/pane-types/#subsections).

**streaming buffer** — In the [agent pane](#agent-pane) virtualization model: the trailing ~50 message rows that are always mounted in normal flow and not recycled. Eliminates measurement lag during token streams. See [Agent pane virtualization](/internals/agent-pane-virtualization/).

<a id="subagent"></a>**subagent** — An agent spawned by another agent. Claude Code's sub-agent feature is the canonical example. For Claude Code agents, the [Swarm](/subagent-watcher/) pane tracks these and expands each one's activity inline under its parent agent.

**swarm** — The multi-agent overview pane. Lists every running agent pane on this instance as a tree, with each agent's [subagents](#subagent), todos, shells, cron jobs and background commands, plus a fleet toolbar. See [Swarm](/subagent-watcher/).

**Unix domain socket** — The IPC mechanism the launcher uses on Linux and macOS to communicate with the host. The socket lives at `$XDG_RUNTIME_DIR/agentmux/<hash>.sock` (primary) or `/tmp/agentmux-<uid>/<hash>.sock` (fallback when `$XDG_RUNTIME_DIR` is unset), where `<hash>` is derived from `(data_dir + version)` — the same isolation key as the Windows named pipe. The counterpart Windows primitive is a **named pipe** (`\\.\pipe\agentmux-<hash>`). Both carry the same wire protocol (the reducer command set defined in `crates/common/src/ipc`). See [Platform support → Linux](/internals/platform-support/#linux).

<a id="window"></a>**window** — An OS window owned by an [instance](#instance)'s [host](#host). One instance can have many windows. Each window has a backend `windowId` (UUID), a launcher `label` (`"main"`, `"window-pool-..."`, internal/IPC), and a [window rank](#window-rank). Renamable via the bottom-right window-list popover (open it via the version chip → double-click a row, or press F2).

<a id="window-rank"></a>**window rank** — A window's 1-based position within its [instance](#instance), shown after the version in the status bar as `(2)`, `(3)`, etc. when more than one window is open. Cosmetic only — the underlying identity of a window is the `windowId`, not the rank.

<a id="window-tab"></a>**window tab** — A whole layout of [panes](#pane), shown in the tab bar along the top of the window (Tab 1, Tab 2, …). The outermost of the three kinds of tab, before [pane tabs](#pane-tab) and [document tabs](#document-tab).

**WRR (Window Reality Reconciliation)** — The launcher's loop that reconciles desired window state (what AgentMux *wants*) against actual OS state (what the OS *says*). Defends against state drift when external tools or the user move/resize/close windows. See [Window Reality Reconciliation](/internals/wrr/).

---

If a term is used somewhere in the docs and isn't here, that's a gap — please file an issue or PR.
