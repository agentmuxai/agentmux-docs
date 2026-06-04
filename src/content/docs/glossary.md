---
title: "Glossary"
description: "Canonical definitions for AgentMux terminology."
---

AgentMux has its own vocabulary. This page is the authoritative source — when two pages use a term differently, this one wins.

## Terms

**agentbus** — The cross-process, cross-machine message bus that lets agents (and the panes they live in) exchange messages. Two delivery models: [jekt](#jekt) and [message](#message). See [Reactive event bus](/security/reactive-event-bus/) (Wave 2) for the full surface.

**Agent App API** — The typed RPC surface an agent uses to call back into the AgentMux workspace — spawn panes, set titles, render dashboards, update status. See [/internals/agent-app-api](/internals/agent-app-api/).

**agent pane** — A pane that runs an AI agent session. Streams the agent's tool calls, reasoning, and file diffs into a structured view. See [Pane types](/pane-types/).

**block** — An immutable persisted unit of pane state. A block is the smallest thing the reducer writes. Terminal output, code block, diff, chat message — each is one or more blocks. Layered structure with reducer-driven mutations. See [The reducer stack](/internals/reducer-stack/).

<a id="browser-pane"></a>**browser pane** — A [pane](#pane) of type `browser` — an embedded `CefBrowserView` (a child Chromium browser, not an iframe). Each browser pane runs in its own [renderer](#renderer) process; opening more browser panes adds more renderer processes. See [Browser pane](/browser-pane/) and [Pane types](/pane-types/).

**CEF** — Chromium Embedded Framework. The host process embeds Chromium via CEF to render the SolidJS frontend; this replaces the platform WebView and gives AgentMux a consistent Chromium 148 runtime on Windows, macOS, and Linux. See [Architecture overview](/internals/architecture/).

<a id="host"></a>**host** — The CEF process (`agentmux-cef`). One per [instance](#instance). Owns the OS [windows](#window), the [browser panes](#browser-pane), the JS bridge, and IPC fan-out to every [renderer](#renderer). Spawned by the [launcher](#launcher); spawns the Chromium subprocesses. (The [sidecar](#sidecar) is also spawned by the launcher, which owns its lifecycle — see [Architecture overview](/internals/architecture/).)

**Identity bundle** — A named credential set bound to an agent at launch. Decouples *who an agent acts as* (GitHub PAT, AWS profile, API keys) from *what an agent does* (the Memory bundle). The same Memory can run as multiple identities — work, personal, demo — without restart. See [Identity bundles](/identity/).

<a id="instance"></a>**instance** — One AgentMux **process tree**, rooted at one [launcher](#launcher), with its own [sidecar](#sidecar), [host](#host), [renderer](#renderer)(s), and Job Object. Each launch of `agentmux-launcher` creates a new instance. Multiple instances run side-by-side. The "other AgentMux instances on LAN" entries shown in the status bar each correspond to a separate instance. See [Multi-instance & dev mode](/multi-instance/).

> Note: "instance" is *not* one process — a baseline single-window dev session has 4 processes ([launcher](#launcher) + [sidecar](#sidecar) + [host](#host) + 1 [renderer](#renderer)), plus shared GPU/utility Chromium subprocesses, plus more renderers as windows and browser panes are opened.

> Note: instances and **data dirs** don't always map 1:1. The data dir is keyed by [*channel*](/internals/data-layout/), not by instance. Two portables on the same channel launched from different folders are two distinct instances (two process trees, two Job Objects) that share the same on-disk SQLite database — see [Multi-instance & dev mode](/multi-instance/) for the per-instance vs per-channel split.

**jekt** — Verb. Inject a message directly into a target agent's terminal stdin. Synchronous, immediate processing. Counterpart to [message](#message). The MCP tool `mcp__agentbus__inject_terminal` is the primary entry point.

<a id="launcher"></a>**launcher** — The 325 KB shim process (`agentmux-launcher`) that boots AgentMux. Spawns the host and sidecar, holds the IPC auth-key, tracks window reality. See [Architecture overview](/internals/architecture/).

**Memory bundle** — An agent personality + capability stack: provider, model, instructions, MCP servers, skills, environment. Reusable across launches. Memory is *what an agent does*; [Identity](#identity-bundle) is *who it does it as*. See [Memory bundles](/memory/).

**message** — Verb. Deliver a message to the recipient's mailbox; the recipient reads it when they're ready. Asynchronous counterpart to [jekt](#jekt). The MCP tool `mcp__agentbus__send_message` is the primary entry point.

**MCP** — Model Context Protocol. A JSON-RPC protocol that AI agents use to talk to external tools and data sources. Agents subscribe to MCP servers; MCP servers expose tools, resources, and prompts.

**OAC** — Origin Access Control. The AWS CloudFront mechanism that restricts S3-bucket access to a specific distribution. Used by the docs and landing infrastructure; not a runtime AgentMux concept.

<a id="pane"></a>**pane** — A UI slot in the workspace layout. Panes have types: terminal, agent, code editor, browser, swarm, subagent, system metrics, code preview. The user composes a workspace by mounting panes in a grid. The `browser` type is a special case — see [browser pane](#browser-pane).

<a id="process"></a>**process** — An OS process. **Avoid in user-facing copy** — one [instance](#instance) has 4+ processes ([launcher](#launcher), [sidecar](#sidecar), [host](#host), [renderer](#renderer)s, plus Chromium GPU/utility subprocesses), so "this AgentMux process" is ambiguous. Reserve "process" for internal docs that genuinely discuss the process tree.

**reducer stack** — AgentMux's layered state model. Each layer (launcher / host / sidecar / frontend slice) owns a slice of state, with dispatch ordered top-to-bottom. The single canonical place to look for "why did X change?" See [The reducer stack](/internals/reducer-stack/).

<a id="renderer"></a>**renderer** — A Chromium renderer process (`agentmux-cef --type=renderer`). Runs the SolidJS frontend JS for one browser context. **Not a singleton** — every OS [window](#window) gets its own renderer, and every [browser pane](#browser-pane) inside a window adds another. Multiple renderers per [instance](#instance) is the normal case.

<a id="sidecar"></a>**sidecar** — The Rust app-domain server process (`agentmux-srv`). Owns workspaces, tabs, blocks, layouts, agents, identity. Persists to SQLite. Bound to 127.0.0.1 only. See [Architecture overview](/internals/architecture/).

**streaming buffer** — In the [agent pane](#agent-pane) virtualization model: the trailing ~50 message rows that are always mounted in normal flow and not recycled. Eliminates measurement lag during token streams. See [Agent pane virtualization](/internals/agent-pane-virtualization/).

**subagent** — An agent spawned by another agent. Claude Code's sub-agent feature is the canonical example. AgentMux's Subagent Watcher tracks these and gives each one its own focused activity-stream pane. See [Subagent Watcher](/subagent-watcher/).

**swarm** — The multi-agent orchestration view. Shows every active and completed [subagent](#subagent) across your workspace, with event counts, models, and last-activity timestamps.

<a id="window"></a>**window** — An OS window owned by an [instance](#instance)'s [host](#host). One instance can have many windows. Each window has a backend `windowId` (UUID), a launcher `label` (`"main"`, `"window-pool-..."`, internal/IPC), and a [window rank](#window-rank). Renamable via the bottom-right window-list popover (open it via the version chip → double-click a row, or press F2).

<a id="window-rank"></a>**window rank** — A window's 1-based position within its [instance](#instance), shown after the version in the status bar as `(2)`, `(3)`, etc. when more than one window is open. Cosmetic only — the underlying identity of a window is the `windowId`, not the rank.

**WRR (Window Reality Reconciliation)** — The launcher's loop that reconciles desired window state (what AgentMux *wants*) against actual OS state (what the OS *says*). Defends against state drift when external tools or the user move/resize/close windows. See [Window Reality Reconciliation](/internals/wrr/).

---

If a term is used somewhere in the docs and isn't here, that's a gap — please file an issue or PR.
