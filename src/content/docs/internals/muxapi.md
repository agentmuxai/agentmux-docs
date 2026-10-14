---
title: MuxAPI
description: The API that lets agents operate the AgentMux workspace — open panes, rename tabs, message peers, navigate the UI.
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

**MuxAPI** (formerly the Agent App API) is what makes AgentMux an *operating* environment, not just a workspace. Every agent running inside a pane has access to a typed API that lets it drive the environment itself: open new panes, rename tabs and windows, navigate between tabs, discover and message peer agents. No human in the loop required.

The API has two equivalent surfaces — **MCP tools** (for agents that use MCP-capable providers) and a **REST API** (direct HTTP, for any language). Both authenticate with the same key and express the same capabilities. The MCP tools are what most agents will reach for; the REST endpoints are there for scripts, webhooks, and advanced use.

## How agents get access

When AgentMux launches an agent, the sidecar injects three environment variables into the agent's PTY:

| Env var | Value | Purpose |
|---|---|---|
| `AGENTMUX_LOCAL_URL` | `http://127.0.0.1:<port>` | Sidecar base URL |
| `AGENTMUX_BLOCKID` | `<pane UUID>` | The pane this agent lives in — used as self-context default |
| `AGENTMUX_AGENT_ID` | `<agent name>` | Agent's registered name — used by `SendMessage` routing |

`AGENTMUX_AUTH_KEY` is **not classified as a PTY env var** (see [Environment variables](/internals/env-vars/) — "Available In Pane? No"). The sidecar strips it from its own process environment at startup (security PR #801) and re-injects it per spawn only for internal tooling that requires it (`agentmux-bashwrap`, the streaming bash runner). `agentmux-mcp` receives it through its own spawn configuration, not from the agent's PTY environment.

```
Agent CLI (claude / codex / gemini / …)
  └─ spawns agentmux-mcp (MCP stdio server)
       ├─ receives AGENTMUX_LOCAL_URL + AGENTMUX_AUTH_KEY + AGENTMUX_BLOCKID
       └─ advertises a curated set of MCP tools → routes each to the REST API
```

Agents using MCP tools never touch `X-AuthKey` directly — the MCP sidecar handles it. The REST API is for scripts or tooling that run with explicit access to the auth key (e.g. inside the sidecar itself, or a trusted subprocess you spawn with the key explicitly).

## Two layers: MCP tools vs. the MuxAPI RPC surface

It helps to keep two layers separate:

- **MCP tools** — the curated, agent-facing verbs that `agentmux-mcp` advertises and maps onto REST endpoints. These are the high-level "operate your workspace" actions (`WhoAmI`, `Layout`, `SetName`, `OpenEditor`, `Shell`, `SendMessage`, …) listed in [MCP tools](#mcp-tools-curated-agent-facing-slice) below. This is the curated surface most agents use.
- **The MuxAPI RPC surface** — the full set of JSON-RPC commands the backend (`agentmux-srv`) registers over its WebSocket transport. The frontend and internal tooling drive AgentMux through these. They include agent lifecycle, process management, session/blockfile persistence, agent-definition CRUD, identity, memory, drones, and more. The MCP tools are a thin, curated slice of this larger surface.

The catalog below documents the **MuxAPI RPC commands** by group, with each command's exact name verified against source. This is the *current* surface and grows actively — treat it as a snapshot, not a frozen contract.

## MuxAPI RPC catalog

These commands are registered in `agentmux-srv`: the MuxAPI handlers are split by domain into the files of `crates/srv/src/server/app_api/` (registered from `crates/srv/src/server/app_api/mod.rs`), the agent-management handlers into `crates/srv/src/server/agent_handlers/` (registered from `crates/srv/src/server/agent_handlers/mod.rs`), and the command-name constants are in `crates/srv/src/backend/rpc_types/commands.rs`. They are and dispatched over the WebSocket JSON-RPC transport described at the bottom of this page.

### Agent lifecycle (`agent_open.rs`, `agent_io.rs`, `agent_define.rs` in `app_api/`)

| Command | Purpose |
|---|---|
| `agent.open` | Open (or idempotently reattach) an agent pane in a tab from an agent definition. Routes through the reducer/`CreateBlock` for saga consistency (PR #1681). |
| `agent.send` | Send a message/turn to a running agent (host subprocess, persistent, or container). |
| `agent.stop` | Stop a running agent's controller (graceful or `SIGKILL`/`SIGTERM`). |
| `agent.status` | Read one agent block's status, provider, controller type, session id. |
| `agent.list` | List all agent blocks across tabs with status + session id. |
| `agent.output` | Read paginated persisted output lines for an agent block. |
| `agent.define` | Create or upsert an agent definition (broadcasts `agents:changed`). |

### Agent process management (`agent_io.rs` in `app_api/`)

| Command | Purpose |
|---|---|
| `agent.process-list` | List OS processes tracked for an agent block, with tracking confidence. |
| `agent.tracked-blocks` | List every block currently tracked (swarm aggregate view). |
| `agent.kill-process` | Terminate a single tracked PID within a block's process tree. |
| `agent.kill-tree` | Terminate a block's entire process tree (job object / cgroup / killpg). |

### Panes (`pane.rs` in `app_api/`)

| Command | Purpose |
|---|---|
| `pane.open` | Open a non-agent pane (editor / term / browser / sysinfo / help), docked or floating. Like `agent.open`, routes through the reducer/`CreateBlock` for saga consistency (PR #1681). This is what the `OpenEditor` MCP tool calls. |

### Blockfile pagination (`blockfile.rs` in `app_api/`)

| Command | Purpose |
|---|---|
| `blockfile:line_count` | Count lines in a block's transcript file. |
| `blockfile:read_range` | Read a line range from a block's transcript file. |
| `blockfile:read_state` | Read a block's persisted state JSON. |
| `blockfile:write_state` | Write a block's persisted state JSON. |

### Session (`session.rs` in `app_api/`)

| Command | Purpose |
|---|---|
| `session:resume_preflight` | Before a pane opens, answer whether its conversation will resume or start new, without spawning anything. |
| `session:archive` | Archive a session. |
| `session:restore` | Restore a previously archived session. |
| `session:export` | Export a session. |
| `session:activity_summary` | Per-turn live activity summary (writes `term:ambient_summary`). |
| `session:next_prompt_suggestion` | Per-turn ghost-text suggestion for the next prompt (writes `term:next_prompt_suggestion`). |

### Agent-anchored session zone (`session.rs` in `agent_handlers/`)

A session zone is bound to the agent *definition* (`definition_id`), so every block of the same agent shares it.

| Command | Purpose |
|---|---|
| `agent:session:read` | Read the agent definition's current session zone. |
| `agent:session:write_state` | Write state into the agent's session zone. |
| `agent:session:append_output` | Append output to the agent's session zone. |
| `agent:session:archive` | Snapshot the agent's session zone to an archive. |
| `agent:session:list_archives` | List the agent's session-zone archives. |

### Native memory (`native_memory_handlers.rs`)

| Command | Purpose |
|---|---|
| `agent:memory:list` | List an agent's native memory files. |
| `agent:memory:read_file` | Read one native memory file. |
| `agent:memory:write_file` | Write one native memory file. |

### Broader `agent_handlers/` surface (grouped)

The backend also registers a large set of management RPCs that the frontend (and tooling) use. These are grouped here rather than exhaustively expanded; names are verified against `crates/srv/src/backend/rpc_types/commands.rs`.

| Group | Commands |
|---|---|
| Agent-definition CRUD | `listagents`, `createagent`, `updateagent`, `deleteagent`, `forkagentdefinition`, `forkagentdefinitionsuggest`, `agentdefcreatefromtemplate`, `agentdefhide`, `agentdefunhide`, `agentdeflisthiddentemplates` |
| Agent content | `getagentcontent`, `setagentcontent`, `getallagentcontent` — `setagentcontent` persists per-agent content (e.g. `ui:zoom`, `env`) keyed to the agent definition |
| Skills CRUD | `listagentskills`, `createagentskill`, `updateagentskill`, `deleteagentskill` |
| History | `appendagenthistory`, `listagenthistory`, `searchagenthistory` |
| Import / export / seed | `importagentfromclaw`, `importagents`, `exportagents`, `reseedagents` |
| Identity accounts | `listidentityaccounts`, `getidentityaccount`, `upsertidentityaccount`, `deleteidentityaccount`, `account.key.verify`, `account.oauth.start`, `account.oauth.poll`, `account.oauth.cancel` |
| Agent ↔ identity junction | `linkagentidentity`, `unlinkagentidentity`, `listagentidentities` |
| Bundles (formerly presets) | `listmemories`, `getmemory`, `upsertmemory`, `deletememory`, `reorderglobalbrain` |
| Agent instances | `listagentinstances`, `getagentinstance`, `createagentinstance`, `updateagentinstance`, `deleteagentinstance`, `listnamedagents`, `hidenamedagent`, `listrecentsessions` |
| Container runtime | `containerruntimeavailable` |
| Drones | `listdrones`, `getdrone`, `upsertdrone`, `deletedrone`, `rundrone`, `listdroneruns` |

### Identity, Memory (native), MCP, Skill & Bundle — shipped MuxAPI namespaces

Five higher-level, agent-scoped namespaces wrap the low-level handlers above behind MuxAPI's permission boundary. All are registered today, from `crates/srv/src/server/app_api/` (`identity.rs`, `memory.rs`, `mcp.rs`, `skill.rs` and `bundle/`).

#### `identity.*`

| Command | Purpose | Params |
|---|---|---|
| `identity.self.accounts` | List the calling agent's linked accounts (secrets masked) | `agent_id` |
| `identity.account.upsert` | Store/rotate a credential in the OS keychain, upsert the `IdentityAccount` row, and (re)link it to the agent for that provider | `agent_id`, `provider`, `name`, `kind?`, `secret`, `validate?`, `account_id?` |
| `identity.account.validate` | Validate a stored account (by `account_id`) or an ad-hoc `provider`+`secret` pair (WS-only, not exposed over REST/MCP) | `account_id`+`agent_id`, or `provider`+`secret` |
| `identity.self.unlink` | Unlink an account from a provider for this agent | `agent_id`, `provider` |

#### `memory.*` (native memory / "Brain")

| Command | Purpose | Params |
|---|---|---|
| `memory.list` | List `.md` files in the agent's native-memory dir, with preview + frontmatter type | `agent_id` |
| `memory.read` | Read one file's content | `agent_id`, `filename` |
| `memory.write` | Write/overwrite one file (atomic tmp+rename), 10 MB cap | `agent_id`, `filename`, `content` |

This is Personal Memory (stored as "native memory", once labelled "Brain") — see [Memory → Personal](/memory/#personal). It's distinct from a Bundle (below).

#### `mcp.*`

| Command | Purpose | Params |
|---|---|---|
| `mcp.list` | List an agent's accessible MCP servers | `agent_id` |
| `mcp.get` | Fetch one server (accessibility-checked) | `agent_id`, `id` |
| `mcp.upsert` | Create/update a private (non-global) server, name-unique per agent | `agent_id`, `id?`, `name`, `transport?` (default `"stdio"`), `config?` (JSON string, default `"{}"`) |
| `mcp.delete` | Delete a server bound to the agent (forbidden if global) | `agent_id`, `id` |
| `mcp.bind` | Bind an agent to an existing global (or already-bound) server | `agent_id`, `mcp_id` |
| `mcp.unbind` | Unbind | `agent_id`, `mcp_id` |
| `mcp.catalog.list` | List all global servers (the Connectors → MCP servers catalog, no agent scoping) | — |
| `mcp.catalog.upsert` | Create/edit a global server (cannot promote a private one) | `id?`, `name`, `transport?`, `config?` |
| `mcp.catalog.delete` | Delete a global server (cannot delete a private one via the catalog) | `id` |

#### `skill.*`

Same shape as `mcp.*`:

| Command | Purpose | Params |
|---|---|---|
| `skill.list` | List agent's accessible skills | `agent_id` |
| `skill.get` | Fetch one skill | `agent_id`, `id` |
| `skill.upsert` | Create/update a private skill | `agent_id`, `id?`, `name`, `trigger?`, `skill_type?` (default `"prompt"`), `description?`, `content?` |
| `skill.delete` | Delete (forbidden if global) | `agent_id`, `id` |
| `skill.bind` | Bind to a global (or already-bound) skill | `agent_id`, `skill_id` |
| `skill.unbind` | Unbind | `agent_id`, `skill_id` |
| `skill.catalog.list` | List all global skills | — |
| `skill.catalog.upsert` | Create/edit a global skill | `id?`, `name`, `trigger?`, `skill_type?`, `description?`, `content?` |
| `skill.catalog.delete` | Delete a global skill | `id` |

#### `bundle.*`

The reusable agent-definition primitive (see [Bundles](/bundles/)):

| Command | Purpose | Params |
|---|---|---|
| `bundle.list` | List all bundles | — |
| `bundle.get` | Fetch one bundle by `id` or `name` | `id` or `name` |
| `bundle.upsert` | Create/update a bundle (the `Memory` row shape — provider, model, instructions, `context_files`, `mcp_servers`, `skills`) | bundle fields |
| `bundle.delete` | Delete a bundle | `id` |
| `bundle.self.get` | Resolve the calling agent's currently-bound bundle (or the blank singleton) | `agent_id` |

`bundle.*` is backed by `crates/srv/src/backend/storage/bundles.rs` (table `db_bundles`). The old WebSocket `preset.*` aliases are retired; the `PresetList` and `PresetGet` MCP tools still reach bundles through the REST routes `/api/v1/agent/preset/list` and `/api/v1/agent/preset/get`.

Prerequisite these all share: `RpcContext` carries an `agent_id` field populated from `bus_agent_id` in `websocket.rs`, enforcing per-agent scope (an agent can only read/write its own links, private primitives, and bindings — not another agent's).

### Widget RPCs (`cli_handlers.rs`)

Recent additions for widget panes that run a local HTTP server (PR #1689). The frontend passes a per-widget **port** so a widget can override the default and AgentMux still reaches it:

| Command | Purpose |
|---|---|
| `widget.health` | Liveness probe a widget's local server (`{ port, health_check_path, health_check_body_contains? }` → `{ healthy, status_code }`). |
| `widget.api` | HTTP proxy to a widget's local server, bypassing browser CORS (`{ port, path, method?, headers?, body? }` → `{ ok, status_code, body, error? }`). Agents use it to call e.g. ComfyUI `/prompt` or Grafana `/api/query`. |

## MCP tools (curated agent-facing slice)

These are the high-level tools registered by `agentmux-mcp`. All providers that support MCP (Claude Code, Codex, Gemini, OpenClaw, Kimi) get them automatically. Each one calls the sidecar over HTTP; the [REST API](#rest-api) table lists the endpoints behind the core tools.

### Self-context

#### `WhoAmI`

Resolve the calling agent's position in the UI tree — pane, tab, window, workspace.

```json
// Returns:
{
  "block_id": "uuid",
  "block_title": "pane title",
  "tab_id": "uuid",
  "tab_name": "Tab Label",
  "window_id": "uuid",
  "window_name": "Window Title",
  "workspace_id": "uuid",
  "workspace_name": "Workspace Name"
}
```

No parameters. Call this before any navigation verb to get a stable reference to your own context.

---

### Layout introspection

#### `Layout`

Read the AgentMux UI structure. Single tool with a `query` discriminator.

| `query` | Returns |
|---|---|
| `"layout"` (default) | Full hierarchical tree: Windows → Workspaces → Tabs → Panes |
| `"windows"` | Flat list of all windows |
| `"workspaces"` | Flat list of all workspaces |
| `"tabs"` | Tabs in the calling agent's workspace |

```json
// Layout("layout") returns:
{
  "windows": [
    {
      "window_id": "uuid",
      "window_name": "AgentMux",
      "workspaces": [
        {
          "workspace_id": "uuid",
          "workspace_name": "Main",
          "tabs": [
            {
              "tab_id": "uuid",
              "tab_name": "Tab 1",
              "active": true,
              "panes": [
                { "block_id": "uuid", "view": "agent", "title": "claude" }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

---

### Naming

#### `SetName`

Rename any UI element. Self-defaults: omit the explicit target ID and the agent's own context is used.

| `target` | What it renames | Char limit |
|---|---|---|
| `"pane"` | The agent's own pane header title | 128 |
| `"tab"` | The current tab label | 128 |
| `"window"` | The OS window title bar | 64 |
| `"workspace"` | The workspace name | 128 |

Parameters: `target` (required), `name` (required).

```
// Rename own pane
SetName(target="pane", name="Research")

// Rename the current tab
SetName(target="tab", name="Build pipeline")

// Rename the window
SetName(target="window", name="Project Athena")
```

---

### Navigation

#### `SetActiveTab`

Switch the active tab within the current workspace.

Parameters: `tab_id` (required, from `Layout("tabs")`).

#### `NewTab`

Create a new tab in the current workspace.

Parameters: `name` (optional string).

#### `FocusWindow`

Bring an AgentMux window to the OS foreground.

Parameters: `window_id` (optional — defaults to the calling agent's own window).

---

### Pane operations

#### `OpenEditor`

Open a file in an editor pane.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `file` | string (required) | — | Absolute path to the file |
| `title` | string | file name | Tab/pane title |
| `split` | `"right"` \| `"left"` \| `"down"` \| `"up"` | `"right"` | Split direction relative to the calling pane |
| `collapse_tree` | boolean | `false` | Open with the file-tree sidebar collapsed |
| `floating` | boolean | `false` | Open in a floating overlay window instead of a docked split |

Returns `{ block_id, tab_id, view, created }`.

#### More pane tools

| Tool | What it does |
|---|---|
| `OpenMedia` | Open an image, video or audio file (absolute host path) in a media pane next to the conversation. |
| `OpenFiles` | Open a folder in a Files pane next to the conversation, optionally with some entries selected. Navigation only; it changes nothing on disk. Takes `connection` for a folder on an SSH host. |
| `OpenAgent` | Launch an agent from My Agents (by name or definition id) into a new pane in the target tab. Idempotent: an agent already open in that tab returns its existing pane. Templates are refused. |
| `ClosePane` | Close a pane. With a `block_id` it closes any pane, logged with your verified identity; another agent's pane waits 15 seconds for its user to keep it. With no arguments it closes your own pane after the same window. |
| `QuitSelf` | End your own session and close your own tab, only when the user has told you to in this conversation. Unless the user's own message started the current turn, the user gets a 15-second window to keep you running. |
| `RegisterDevServer` | Container agents only: register a dev server running in your own container with AgentMux's reverse proxy, at `http://<project>-<agent-id>.localhost:8090`. |

---

### Widgets

See [Build a widget](/build-a-widget/) for the package format.

| Tool | What it does |
|---|---|
| `WidgetList` | List installed widgets: id, name, version, kind, state, permissions, folder and the views each adds. |
| `WidgetInstall` | Install a widget package you built (a folder, its `widget.json`, or a `.zip`) and ask the user to approve it. Returns `installed`, `declined`, `pending`, or the validation error. You can't approve it yourself. |
| `OpenWidget` | Open a view of an installed, approved widget (`ext:<id>/<pane>`) next to the conversation, optionally setting keys of its pane state. |

---

### UI automation

These reach your own pane and the shared app chrome (status bar, menus, window controls), never another pane or agent's UI. Pass `pane` (from `OpenBrowser`) to act on a browser pane you opened.

| Tool | What it does |
|---|---|
| `UIScreenshot` | Screenshot your own pane, clipped to it. Returns a file path. |
| `UIQuery` | Find elements matching a CSS selector: tag, text, attributes, bounding rect and focus state. |
| `UIClick` | Click an element with a real synthesized mouse click. Refused on a pane you opened with `OpenBrowser`; use `BrowserClick` there. |
| `ListShortcuts` | List the keyboard shortcuts as the Help pane shows them, with the user's remaps: command id, label, keys, context and the pane that handles each. |
| `RunCommand` | Run a shortcut's command by id (from `ListShortcuts`) in your own window, optionally focusing a target pane first. Commands keep the user's protections: `tab:close` asks first, and permanent deletes are refused. |
| `PressKeys` | Press a shortcut from the table as real key events in your own window and report which command it resolved to. Keys bound to permanent delete or `pane:close` are refused. |
| `CaptureWindow` | Screenshot a top-level window on this machine (another AgentMux instance, your own floating windows, or another application) by pid or title. Windows owned by another OS user are withheld; every call is audited. |
| `DiscoverWindows` | List top-level windows (pid, title, executable, whether each can be captured) to pick a `CaptureWindow` target. Other applications are listed only with `include_foreign`. |

---

### Browser panes

`OpenBrowser` opens a browser pane next to yours and makes you its owner. The other tools take that pane's id as `pane`; without it they act on your own pane, if it is a browser pane. You can drive only browser panes you opened, and page content is untrusted.

| Tool | What it does |
|---|---|
| `OpenBrowser` | Open a browser pane at an http(s) URL. `allowed_origins` keeps it on the sites the task needs; a page that tries to leave them is stopped and the user is asked. |
| `BrowserSnapshot` | Read the page as an accessibility snapshot, one line per element, with a `ref` on each one you can act on. |
| `BrowserClick` | Click an element by `ref` with a real mouse click. A click that submits a form, or is named like Submit, Send, Pay or Delete, waits for the user to approve it. |
| `BrowserFill` | Replace a text field's value by `ref`, as typed input, and read it back. Refuses password, one-time-code and card fields. |
| `BrowserSelect` | Choose an option of a `<select>` by `ref` and the option's label or value. |
| `BrowserCheck` | Set a checkbox, radio button or switch by `ref`. |
| `BrowserSetFiles` | Put files from your own workspace into a file input by `ref`, up to 25 MB in all. Every upload is logged. |
| `BrowserWaitFor` | Wait until the page shows some text, its URL contains something, or an element is gone. |
| `BrowserHandoff` | Hand the pane to the user for something you must not do (signing in, two-factor codes, payment details) and wait for Done or Cancel. |
| `BrowserNavigate` | Navigate to a URL. |
| `BrowserBack` / `BrowserForward` / `BrowserReload` | Walk history back or forward, or reload the page. |
| `BrowserEval` | Run JavaScript in the page and return the result. Refused on a pane you opened with `OpenBrowser`. |
| `BrowserDispatchKey` | Type text or a named key into whatever has focus in the pane, optionally focusing a selector first. Enter and Space are refused on a pane you opened with `OpenBrowser`. |
| `BrowserFocusElement` | Call `.focus()` on the first element matching a CSS selector. |
| `BrowserFocusInfo` | Report the currently focused element, in `UIQuery`'s shape. |

---

### Shell management

#### `Shell`

Start a persistent background shell process pinned to the activity dock.

| Parameter | Type | Description |
|---|---|---|
| `cmd` | string (required) | Shell command to run |
| `cwd` | string | Working directory (defaults to agent's working dir) |
| `title` | string | Label shown in the activity dock |
| `env` | object | Extra env vars for the shell process |

Returns `{ shell_id }`. The shell process stays alive until `ShellStop` is called or the pane closes. Use it for long-running background processes.

#### `ShellStop`

Stop a running shell by ID.

Parameters: `shell_id` (required, from `Shell` response).

#### `ShellInput`

Write to the stdin of a running shell started by `Shell`. Only works if that shell was created with `capture_stdin=true` — otherwise its stdin is `/dev/null` and the write is discarded (the tool tells you so).

Parameters: `shell_id` (required), `text` (required — a newline is appended automatically).

Returns a plain-text status string, e.g. `"wrote to shell <shell_id>"`, or an explanation of why the write was discarded (`StdinNotCaptured`, shell already exited, etc.).

#### `ShellStatus`

Query whether a shell started by `Shell` is still running.

Parameters: `shell_id` (required).

Returns a plain-text summary: running state, exit code (if exited), and total output line count so far.

#### Interactive shell (PTY) and connections

`PtyShell` attaches to the pane's one interactive shell: the same real terminal the user sees in the shell drawer, so programs that need a PTY (password prompts, `sudo`, `ssh`, REPLs) work. While you type into it, the user's own keyboard input to it is locked out for a few seconds.

| Tool | What it does |
|---|---|
| `PtyShell` | Attach to (or create) the pane's interactive shell; returns a `shell_id`. Takes `connection` to run in WSL or on an SSH host. |
| `PtyShellInput` | Write raw text, exactly as typed: no newline is appended, and `\u0003` is Ctrl+C. |
| `PtyShellRead` | Read back the output tail as text (default the last 200 lines). |
| `PtyShellResize` | Resize the terminal (default 25 rows by 200 columns). |
| `PtyShellStatus` | Whether the shell is still running, and its exit code once it ended. |
| `PtyShellStop` | Release your keyboard lock at once. It doesn't stop the shell. |
| `ConnList` | List the connections `Shell` and `PtyShell` can take as `connection`: this machine, each WSL distribution, the user's ssh config hosts, and their status. An SSH host asks the user to allow you the first time. |

---

### Scheduling

#### `Loop`

Repeatedly inject a prompt to an agent on a fixed interval, from inside the current MCP session.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `prompt` | string (required) | — | Text to inject each fire |
| `interval` | string | `"10m"` (min `"10s"`) | Fire interval, e.g. `"5m"`, `"30s"` |
| `to` | string | self | Target agent name |
| `immediate` | boolean | `false` | Fire once immediately, then on the interval |
| `max_iterations` | integer | unlimited | Auto-stop after this many fires (equivalent to calling `LoopStop` once reached) |

Returns a plain-text confirmation naming the loop (e.g. `loop-3`) and how to stop it. Loops are **session-scoped** — they live only as long as the current MCP process/agent session and do not survive a restart.

#### `LoopStop`

Stop a running loop by ID (e.g. `loop-3`, from the `Loop` response).

#### `LoopList`

List every loop running in the current agent session — id, prompt preview, target, interval, fire count, and remaining cap if any. No parameters.

#### `CronCreate`

Create a **durable, DB-persisted** scheduled job — unlike `Loop`, a cron job survives `agentmux-srv` restarts and isn't tied to any one agent session.

| Parameter | Type | Description |
|---|---|---|
| `name` | string (required) | Job name |
| `expression` | string (required) | 5-field UTC cron expression, e.g. `"0 9 * * 1-5"` |
| `prompt` | string (required) | Text to inject on each fire |
| `to` | string (required) | Target agent id |
| `max_fires` | integer (optional) | Auto-disable after N fires; omit for unlimited |

Returns the created job's id, schedule, and next fire time.

#### `CronDelete`

Permanently delete a cron job by `id` and cancel its scheduled task.

#### `CronList`

List every persistent cron job (enabled and paused), with schedule, next fire time, and fire count. No parameters.

#### `CronPause` / `CronResume`

Pause or resume a cron job by `id`. A paused job's definition stays in the database but doesn't fire until resumed.

---

### Agent coordination

#### `DiscoverAgents`

List reachable agents across the MuxBus tiers (Host / LAN / WAN).

No parameters. Returns:

```json
{
  "host": {
    "addressable": [
      { "agent_id": "claude", "block_id": "uuid", "provider": "claude" }
    ],
    "agents": [ /* full agent records */ ]
  },
  "lan": [ { "host": "peer-machine", "agents": [ /* … */ ] } ],
  "wan": { "subscribed_agents": [ /* … */ ] }
}
```

Use the `addressable` list to find agents you can `SendMessage` to.

#### `SendMessage`

Send a message to another agent by name. Routes through the MuxBus.

Parameters: `to` (target agent name, required), `message` (string, required).

Returns `{ success, error? }`. The message is delivered to the target agent's pane as if a user typed it — the agent picks it up on its next turn.

#### More coordination tools

| Tool | What it does |
|---|---|
| `GetAgentTranscript` | Read the tail of another agent's transcript by name, and whether it has a turn in flight. Reaches agents on this host, including other channels; not LAN or WAN. |
| `ListConversations` | Every agent's latest activity across host, other channels, LAN and WAN in one call. Host and cross-channel entries carry a preview line and what the agent is working on; LAN and WAN entries are liveness only. |
| `SearchHistory` | Search your own past conversations, including ended or compacted sessions, by text or by tool call. Only `complete: true` with no hits means it didn't happen. |
| `WhoIsWorkingOn` | Which other agents are working on a file, folder, repository, branch, topic or open PR. Informational; nothing is locked. |
| `ClaimWork` | Say what you're working on (a path, branch or topic, with a note) so other agents see it in `WhoIsWorkingOn` and get a note if they edit inside it. Lapses after `ttl_minutes` (default 120). |
| `ReleaseWork` | Release one of your claims by id, or all of them. |
| `SupervisorNudge` | For a Warden Supervisor watcher: record a decision about an agent that ended its turn. `nudge` sends a fixed, server-owned continuation message; `decline` only logs. |
| `FleetList` | List every reachable agent with the target ids `FleetBroadcast` and `FleetBulkStop` take. |
| `FleetBroadcast` | Send the same message to many agents, each delivered and signed as `SendMessage` would. |
| `FleetBulkStop` | Stop many agent panes at once, optionally in stages that abort on a high failure rate. Stopping an agent you don't own waits 15 seconds for its user to keep it. |

### Muxqueue — the shared work queue

`SendMessage` is **push, addressed, immediate**: it names a recipient and delivers now. Muxqueue is **pull and deferred** — work is enqueued, and an agent takes it when it asks, rather than being handed it.

By default an item is also **unaddressed**: it names nobody, and whichever agent claims next gets it. That is the common case and the reason the queue exists. It is *optionally* addressable though — `target_agent` restricts an item to one agent, `target_group` to the members of an agent group, and a restricted item is simply invisible to everyone else's `WorkClaim`. Targeting narrows *who* may claim; it never changes *when* — the item still waits to be claimed rather than being delivered.

Reach for it when you don't need a *specific* agent, or need something done *eventually* rather than now: "someone should repro this", "this PR needs review when a reviewer frees up". Items survive pane closes, app restarts, and version/channel changes, and are visible to every agent on the machine.

| Instead of | Use |
|---|---|
| A specific agent, right now | `SendMessage` |
| On a schedule | `CronCreate` |
| **Anyone, when they're free** | **`WorkEnqueue`** |
| A specific agent, but whenever they get to it | `WorkEnqueue` with `target_agent` |

#### Claiming is a lease, not ownership

`WorkClaim` grants a **time-limited lease** (default 2 minutes). Heartbeat during long work, then complete or release. An expired lease is what stops a crashed agent from blocking an item forever — but two details matter, and both are easy to assume wrong:

- **Reaping is lazy.** Nothing sweeps in the background. An expired item stays `claimed` until the next time *some* agent calls `WorkClaim`, which is when the reaper runs. So a queue can show items as `claimed` with nobody working them; [`muxspect work`](/internals/debugging/) flags exactly that.
- **An expired item does not always come back.** It returns to the pool only if it has attempts left. If the expired claim consumed the item's **final** permitted attempt, it is parked as `failed` and never offered again — the same rule that makes a release on the final attempt terminal.

So "the agent crashed, it'll be retried" holds *until the attempts run out*, and not after.

The claim response includes an **`attempt` number that every later call must echo back**. It fences one claim instance from another: because `agent_id` is stable across claims, a delayed call left over from an expired claim would otherwise operate on a *newer* claim of the same item by the same agent. A stale fence gets HTTP 409, and the only recovery is to claim again.

:::caution
Claiming an item does **not** grant authority you wouldn't otherwise have. The payload is a prompt; every action in it is still subject to its own normal confirmation rules.
:::

#### `WorkEnqueue`

| Parameter | Type | Description |
|---|---|---|
| `title` | string (required) | Short human-scannable summary |
| `payload` | string (required) | The full instruction injected into whoever claims it. Write it standalone — the claimant has none of your context |
| `kind` | string (optional) | Free-form tag for filtering claims (`review`, `repro`, …) |
| `target_agent` | string (optional) | Restrict to one agent id. Mutually exclusive with `target_group` |
| `target_group` | string (optional) | Restrict to an agent-group id. Mutually exclusive with `target_agent` |
| `priority` | integer (optional) | Higher claims first; ties break oldest-first. Default 0 |
| `not_before` | integer (optional) | Unix ms; not claimable before this |
| `max_attempts` | integer (optional) | Claims before the item is parked as failed. Default 3 |

#### `WorkClaim`

Take the next eligible item and become its holder. Returns `{claimed: false}` when nothing is available — a normal answer, not an error, so it's safe to call speculatively.

| Parameter | Type | Description |
|---|---|---|
| `kind` | string (optional) | Only claim items with this tag |
| `lease_ms` | integer (optional) | Lease length. Default 120000 |

If a previous agent handed the item back, their reason is included — read it before repeating their approach.

#### `WorkHeartbeat` / `WorkComplete` / `WorkRelease`

All three take `id` and the `attempt` fence from your claim.

- **`WorkHeartbeat`** — extend the lease while still working.
- **`WorkComplete`** — finish. `result` is **required**: once an item is done, it's the only record the work happened.
- **`WorkRelease`** — hand back with a `reason`. Prefer this over letting a lease lapse; it frees the item immediately and records why. A release still consumes an attempt, and releasing on the **final** attempt parks the item as `failed` rather than reopening it — work nobody can do should stop circulating.

#### `WorkList`

The shared backlog. Filter by `state` (`open`, `claimed`, `done`, `failed`, `cancelled`) and `limit`. Read-only — useful before enqueueing, to avoid duplicates.

For a richer view from a terminal, including stuck-lease detection, see [`muxspect work`](/internals/debugging/).

---

### Memory

Personal memory is the calling agent's own native memory files; Global Memory is the workspace-wide list every agent gets at launch. Every write keeps a version. See [Memory](/memory/).

| Tool | What it does |
|---|---|
| `MemoryList` | List your own memory files: filename, whether it is the index, type, size and modified time. |
| `MemoryRead` | Read one of your memory files. |
| `MemoryWrite` | Create or overwrite one of your memory files, atomically. |
| `MemoryHistory` | List a memory file's recorded versions, newest first, with who wrote each. |
| `MemoryDiff` | Line diff between two versions of a memory file. |
| `MemoryRevert` | Restore a memory file to an earlier version, recorded as a new version. |
| `GlobalMemoryList` | List Global Memory entries (id, name, updated, `system`). AgentMux's own system entries are listed but can't be read, changed or removed here. |
| `GlobalMemoryRead` | Read one Global Memory entry. |
| `GlobalMemoryWrite` | Create an entry, or update one by id. Changes what every agent gets at its next launch. |
| `GlobalMemoryRemove` | Take an entry off the Global Memory list (the entry itself isn't deleted). |
| `GlobalMemoryHistory` | List an entry's recorded versions, newest first. |
| `GlobalMemoryDiff` | Line diff between two versions of an entry. |
| `GlobalMemoryRevert` | Restore an entry to an earlier version, recorded as a new version. |

---

### Presets and identities

| Tool | What it does |
|---|---|
| `PresetList` | List the presets (bundles) available to you, summary fields only. |
| `PresetGet` | Fetch a preset by id or name; with neither, your own bound preset. |
| `IdentityAccounts` | List your own linked accounts: id, provider, name, kind, status and a masked tail. Secrets are never returned. |
| `IdentityValidate` | Check one of your linked accounts against its provider with the stored key. |

---

## REST API

The core MCP tools have these REST endpoints on `$AGENTMUX_LOCAL_URL`. All requests require `X-AuthKey: $AGENTMUX_AUTH_KEY`.

:::note
This table covers the **curated MCP-tool slice** only. It is not a 1:1 map of the full MuxAPI RPC catalog above — most RPC commands (agent lifecycle, sessions, blockfiles, identity, memory, drones, widgets) are reached over the WebSocket JSON-RPC transport, not via a dedicated `/api/v1/*` REST route.
:::

| Method | Endpoint | MCP equivalent |
|---|---|---|
| `GET` | `/api/v1/self?block_id=<id>` | `WhoAmI` |
| `GET` | `/api/v1/layout` | `Layout("layout")` |
| `GET` | `/api/v1/windows` | `Layout("windows")` |
| `GET` | `/api/v1/workspaces` | `Layout("workspaces")` |
| `GET` | `/api/v1/tabs?block_id=<id>` | `Layout("tabs")` |
| `POST` | `/api/v1/pane/title` | `SetName(target="pane")` |
| `POST` | `/api/v1/tab/name` | `SetName(target="tab")` |
| `POST` | `/api/v1/window/name` | `SetName(target="window")` |
| `POST` | `/api/v1/workspace/name` | `SetName(target="workspace")` |
| `POST` | `/api/v1/tab/activate` | `SetActiveTab` |
| `POST` | `/api/v1/tab/new` | `NewTab` |
| `POST` | `/api/v1/window/focus` | `FocusWindow` |
| `POST` | `/api/v1/pane/open` | `OpenEditor` |
| `POST` | `/api/v1/shell/create` | `Shell` |
| `POST` | `/api/v1/shell/stop` | `ShellStop` |
| `POST` | `/api/v1/shell/input` | `ShellInput` |
| `GET` | `/api/v1/shell/status` | `ShellStatus` |
| `GET` | `/agentmux/discovery` | `DiscoverAgents` |
| `POST` | `/agentmux/reactive/inject` | `SendMessage` |
| `POST` | `/agentmux/work` | `WorkEnqueue` |
| `GET` | `/agentmux/work` | `WorkList` |
| `POST` | `/agentmux/work/claim` | `WorkClaim` |
| `POST` | `/agentmux/work/:id/heartbeat` | `WorkHeartbeat` |
| `POST` | `/agentmux/work/:id/complete` | `WorkComplete` |
| `POST` | `/agentmux/work/:id/release` | `WorkRelease` |
| `DELETE` | `/agentmux/work/:id` | *(cancel — no MCP tool; operator action)* |

:::note
`Loop`/`LoopStop`/`LoopList` (see [Scheduling](#scheduling)) have no route of their own: a loop lives in the `agentmux-mcp` process and each fire is a `POST /agentmux/reactive/inject`. The `Cron*` tools use `/agentmux/cron` (`POST` to create, `GET` to list, `DELETE /agentmux/cron/:id`, and `PATCH /agentmux/cron/:id` to pause or resume).
:::

Example — rename the current tab from a trusted script that has access to the auth key (e.g. an `agentmux-mcp` subprocess or a sidecar utility, not an agent's own PTY shell):

```bash
curl -s -X POST "$AGENTMUX_LOCAL_URL/api/v1/tab/name" \
  -H "X-AuthKey: $AGENTMUX_AUTH_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"block_id\": \"$AGENTMUX_BLOCKID\", \"name\": \"Done\"}"
```

## Transport (WebSocket JSON-RPC)

The underlying protocol is WebSocket, JSON-RPC 2.0 — the same transport the frontend uses. The MCP tools and REST endpoints are thin wrappers over this. Direct WebSocket access is available for advanced use (streaming events, subscriptions):

- **Protocol:** WebSocket, JSON-RPC 2.0
- **Endpoint:** `ws://127.0.0.1:<port>/ws?authkey=<AGENTMUX_AUTH_KEY>`
- **Auth:** `authkey` query param on connect (custom headers not supported by the browser WS API)

The WebSocket connection receives server-pushed JSON-RPC notifications for live agent output and workspace events — use these instead of polling the REST endpoints.

## Permission boundary

Agents are *sub-trusted*: they run as the user but do not hold the sidecar's full auth key at the OS level. MuxAPI is the curated surface across that boundary — scoped, reversible operations.

What the curated MCP tool surface allows today: open panes, browser panes and widgets, rename UI elements, navigate, drive its own pane's UI, discover and message peers, manage shells, and read and write its own memory and Global Memory. The broader MuxAPI RPC surface (agent lifecycle, sessions, identity, memory, drones) is driven by the frontend and internal tooling over the authenticated WebSocket transport.

What it does not expose: access to other agents' file systems, or raw `dispatch_service` destructive commands. An agent can ask to close another agent's pane (`ClosePane` with a `block_id`) or stop it (`FleetBulkStop`), but that waits 15 seconds for the pane's user to keep it running. A finer-grained per-agent permission model (allow-lists, scoped capabilities) is on the roadmap.

**Practical advice:** don't inject `AGENTMUX_AUTH_KEY` into agent instructions when running less-trusted agents. The API is designed for agents you authored or trust, not for arbitrary model output from external sources.

## See also

- [Trust model](/security/trust-model/) — full trust boundary description
- [Reactive event bus](/security/reactive-event-bus/) — auth model and endpoint reference for the messaging layer
- [Connectors](/connectors/) and [Memory](/memory/) — the app-wide UI for Accounts and MCP servers, and for Global and Personal memory, Skills and Bundles
- [Pane Types](/pane-types/) — pane types OpenEditor can create
- [Identity/Presets/Memory spec](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/archive/SPEC_AGENT_APP_API_IDENTITY_PRESETS_BRAIN_2026_06_27.md) — original implementation spec for the (now-shipped) `identity.*`/`memory.*` namespaces
- [Preset→Bundle rename spec](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/SPEC_PRESET_TO_BUNDLE_REFACTOR_2026_07_02.md) — `bundle.*`, `mcp.*`, `skill.*` primitive model
