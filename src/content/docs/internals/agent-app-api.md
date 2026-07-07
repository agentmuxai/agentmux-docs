---
title: Agent App API
description: The API that lets agents operate the AgentMux workspace — open panes, rename tabs, message peers, navigate the UI.
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

The **Agent App API** is what makes AgentMux an *operating* environment, not just a workspace. Every agent running inside a pane has access to a typed API that lets it drive the environment itself: open new panes, rename tabs and windows, navigate between tabs, discover and message peer agents. No human in the loop required.

The API has two equivalent surfaces — **MCP tools** (for agents that use MCP-capable providers) and a **REST API** (direct HTTP, for any language). Both authenticate with the same key and express the same capabilities. The MCP tools are what most agents will reach for; the REST endpoints are there for scripts, webhooks, and advanced use.

## How agents get access

When AgentMux launches an agent, the sidecar injects three environment variables into the agent's PTY:

| Env var | Value | Purpose |
|---|---|---|
| `AGENTMUX_LOCAL_URL` | `http://127.0.0.1:<port>` | Sidecar base URL |
| `AGENTMUX_BLOCKID` | `<pane UUID>` | The pane this agent lives in — used as self-context default |
| `AGENTMUX_AGENT_ID` | `<agent name>` | Agent's registered name — used by `SendMessage` routing |

`AGENTMUX_AUTH_KEY` is **not classified as a PTY env var** (see `internals/env-vars.md` — "Available In Pane? No"). The sidecar strips it from its own process environment at startup (security PR #801) and re-injects it per spawn only for internal tooling that requires it (`agentmux-bashwrap`, the streaming bash runner). `agentmux-mcp` receives it through its own spawn configuration, not from the agent's PTY environment.

```
Agent CLI (claude / codex / gemini / …)
  └─ spawns agentmux-mcp (MCP stdio server)
       ├─ receives AGENTMUX_LOCAL_URL + AGENTMUX_AUTH_KEY + AGENTMUX_BLOCKID
       └─ advertises a curated set of MCP tools → routes each to the REST API
```

Agents using MCP tools never touch `X-AuthKey` directly — the MCP sidecar handles it. The REST API is for scripts or tooling that run with explicit access to the auth key (e.g. inside the sidecar itself, or a trusted subprocess you spawn with the key explicitly).

## Two layers: MCP tools vs. the app-API RPC surface

It helps to keep two layers separate:

- **MCP tools** — the curated, agent-facing verbs that `agentmux-mcp` advertises and maps onto REST endpoints. These are the high-level "operate your workspace" actions (`WhoAmI`, `Layout`, `SetName`, `OpenEditor`, `Shell`, `SendMessage`, …) documented in the next section. This is the intentionally small surface most agents use.
- **The app-API RPC surface** — the full set of JSON-RPC commands the backend (`agentmux-srv`) registers over its WebSocket transport. The frontend and internal tooling drive AgentMux through these. They include agent lifecycle, process management, session/blockfile persistence, agent-definition CRUD, identity, memory, drones, and more. The MCP tools are a thin, curated slice of this larger surface.

The catalog below documents the **app-API RPC commands** by group, with each command's exact name verified against source. This is the *current* surface and grows actively — treat it as a snapshot, not a frozen contract.

## App-API RPC catalog

These commands are registered in `agentmux-srv` (see `agentmux-srv/src/server/app_api.rs`, `agentmux-srv/src/server/agent_handlers.rs`, and the command-name constants in `agentmux-srv/src/backend/rpc_types.rs`) and dispatched over the WebSocket JSON-RPC transport described at the bottom of this page.

### Agent lifecycle (`app_api.rs`)

| Command | Purpose |
|---|---|
| `agent.open` | Open (or idempotently reattach) an agent pane in a tab from an agent definition. Routes through the reducer/`CreateBlock` for saga consistency (PR #1681). |
| `agent.send` | Send a message/turn to a running agent (host subprocess, persistent, or container). |
| `agent.stop` | Stop a running agent's controller (graceful or `SIGKILL`/`SIGTERM`). |
| `agent.status` | Read one agent block's status, provider, controller type, session id. |
| `agent.list` | List all agent blocks across tabs with status + session id. |
| `agent.output` | Read paginated persisted output lines for an agent block. |
| `agent.define` | Create or upsert an agent definition (broadcasts `agents:changed`). |

### Agent process management (`app_api.rs`)

| Command | Purpose |
|---|---|
| `agent.process-list` | List OS processes tracked for an agent block, with tracking confidence. |
| `agent.tracked-blocks` | List every block currently tracked (swarm aggregate view). |
| `agent.kill-process` | Terminate a single tracked PID within a block's process tree. |
| `agent.kill-tree` | Terminate a block's entire process tree (job object / cgroup / killpg). |

### Panes (`app_api.rs`)

| Command | Purpose |
|---|---|
| `pane.open` | Open a non-agent pane (editor / term / browser / sysinfo / help), docked or floating. Like `agent.open`, routes through the reducer/`CreateBlock` for saga consistency (PR #1681). This is what the `OpenEditor` MCP tool calls. |

### Blockfile pagination (`app_api.rs`)

| Command | Purpose |
|---|---|
| `blockfile:line_count` | Count lines in a block's transcript file. |
| `blockfile:read_range` | Read a line range from a block's transcript file. |
| `blockfile:read_state` | Read a block's persisted state JSON. |
| `blockfile:write_state` | Write a block's persisted state JSON. |

### Session (`app_api.rs`)

| Command | Purpose |
|---|---|
| `session:digest` | Produce a digest/summary of a session. |
| `session:archive` | Archive a session. |
| `session:restore` | Restore a previously archived session. |
| `session:export` | Export a session. |
| `session:activity_summary` | Per-turn live activity summary (writes `term:activity`). |

### Agent-anchored session zone (`agent_handlers.rs`)

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

### Broader `agent_handlers.rs` surface (grouped)

The backend also registers a large set of management RPCs that the frontend (and tooling) use. These are grouped here rather than exhaustively expanded; names are verified against `agentmux-srv/src/backend/rpc_types.rs`.

| Group | Commands |
|---|---|
| Agent-definition CRUD | `listagents`, `createagent`, `updateagent`, `deleteagent`, `forkagentdefinition`, `forkagentdefinitionsuggest`, `agentdefcreatefromtemplate`, `agentdefhide`, `agentdefunhide`, `agentdeflisthiddentemplates` |
| Agent content | `getagentcontent`, `setagentcontent`, `getallagentcontent` — `setagentcontent` persists per-agent content (e.g. `ui:zoom`, `env`) keyed to the agent definition |
| Skills CRUD | `listagentskills`, `createagentskill`, `updateagentskill`, `deleteagentskill` |
| History | `appendagenthistory`, `listagenthistory`, `searchagenthistory` |
| Import / export / seed | `importagentfromclaw`, `importagents`, `exportagents`, `reseedagents` |
| Identity accounts | `listidentityaccounts`, `getidentityaccount`, `upsertidentityaccount`, `deleteidentityaccount`, `account.key.verify`, `account.oauth.start`, `account.oauth.poll`, `account.oauth.cancel` |
| Agent ↔ identity junction | `linkagentidentity`, `unlinkagentidentity`, `listagentidentities` |
| Identity bundles | `listidentitybundles`, `getidentitybundle`, `upsertidentitybundle`, `deleteidentitybundle`, `bindidentityaccount`, `unbindidentityaccount`, `listidentitybindings` |
| Memory bundles (presets) | `listmemories`, `getmemory`, `upsertmemory`, `deletememory`, `reorderglobalbrain` |
| Agent instances | `listagentinstances`, `getagentinstance`, `createagentinstance`, `updateagentinstance`, `deleteagentinstance`, `listnamedagents`, `hidenamedagent`, `listrecentsessions` |
| Container runtime | `containerruntimeavailable` |
| Drones | `listdrones`, `getdrone`, `upsertdrone`, `deletedrone`, `rundrone`, `listdroneruns` |

### Identity, Memory (native), MCP, Skill & Bundle — shipped App API namespaces

Five higher-level, agent-scoped namespaces wrap the low-level handlers above behind the App API permission boundary. All are registered in `agentmux-srv/src/server/app_api/mod.rs` today — none of these are "planned," despite earlier drafts of this page saying so.

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

This is the "Brain" primitive — see [Memory bundles → Native memory](/memory/#native-memory-brain) and the [Armory](/armory/#brain). It's distinct from a Bundle (below).

#### `mcp.*` {#mcp}

| Command | Purpose | Params |
|---|---|---|
| `mcp.list` | List an agent's accessible MCP servers | `agent_id` |
| `mcp.get` | Fetch one server (accessibility-checked) | `agent_id`, `id` |
| `mcp.upsert` | Create/update a private (non-global) server, name-unique per agent | `agent_id`, `id?`, `name`, `transport?` (default `"stdio"`), `config?` (JSON string, default `"{}"`) |
| `mcp.delete` | Delete a server bound to the agent (forbidden if global) | `agent_id`, `id` |
| `mcp.bind` | Bind an agent to an existing global (or already-bound) server | `agent_id`, `mcp_id` |
| `mcp.unbind` | Unbind | `agent_id`, `mcp_id` |
| `mcp.catalog.list` | List all global servers (Armory-level, no agent scoping) | — |
| `mcp.catalog.upsert` | Create/edit a global server (cannot promote a private one) | `id?`, `name`, `transport?`, `config?` |
| `mcp.catalog.delete` | Delete a global server (cannot delete a private one via the catalog) | `id` |

#### `skill.*` {#skills}

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

#### `bundle.*` {#bundle}

The reusable agent-definition primitive (see [Memory bundles](/memory/) — the page name predates this rename, the content is current):

| Command | Purpose | Params |
|---|---|---|
| `bundle.list` | List all bundles | — |
| `bundle.get` | Fetch one bundle by `id` or `name` | `id` or `name` |
| `bundle.upsert` | Create/update a bundle (the `Memory` row shape — provider, model, instructions, `context_files`, `mcp_servers`, `skills`) | bundle fields |
| `bundle.delete` | Delete a bundle | `id` |
| `bundle.self.get` | Resolve the calling agent's currently-bound bundle (or the blank singleton) | `agent_id` |

`bundle.*` is backed by the same storage as the older `preset.*` commands (`agentmux-srv/src/backend/storage/memory_bundles.rs`, table `db_memory_bundles`) — `preset.*` still works today as a compatibility alias registered against the identical handlers, but new code should use `bundle.*`.

Prerequisite these all share: `RpcContext` carries an `agent_id` field populated from `bus_agent_id` in `websocket.rs`, enforcing per-agent scope (an agent can only read/write its own links, private primitives, and bindings — not another agent's).

### Widget RPCs (`cli_handlers.rs`)

Recent additions for widget panes that run a local HTTP server (PR #1689). The frontend passes a per-widget **port** so a widget can override the default and AgentMux still reaches it:

| Command | Purpose |
|---|---|
| `widget.health` | Liveness probe a widget's local server (`{ port, health_check_path, health_check_body_contains? }` → `{ healthy, status_code }`). |
| `widget.api` | HTTP proxy to a widget's local server, bypassing browser CORS (`{ port, path, method?, headers?, body? }` → `{ ok, status_code, body, error? }`). Agents use it to call e.g. ComfyUI `/prompt` or Grafana `/api/query`. |

## MCP tools (curated agent-facing slice)

These are the high-level tools registered by `agentmux-mcp`. All providers that support MCP (Claude Code, Codex, Gemini, OpenClaw, Kimi) get them automatically. Each maps to a REST endpoint (see the [REST API](#rest-api) table), which in turn drives an app-API RPC command from the catalog above.

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

---

## REST API

Every MCP tool has an equivalent REST endpoint on `$AGENTMUX_LOCAL_URL`. All requests require `X-AuthKey: $AGENTMUX_AUTH_KEY`.

:::note
This table covers the **curated MCP-tool slice** only. It is not a 1:1 map of the full app-API RPC catalog above — most RPC commands (agent lifecycle, sessions, blockfiles, identity, memory, drones, widgets) are reached over the WebSocket JSON-RPC transport, not via a dedicated `/api/v1/*` REST route.
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

:::note
`Loop`/`LoopStop`/`LoopList` and `CronCreate`/`CronDelete`/`CronList`/`CronPause`/`CronResume` (see [Scheduling](#scheduling)) aren't in this REST table — they're MCP-only today, with no dedicated `/api/v1/*` route.
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

Agents are *sub-trusted*: they run as the user but do not hold the sidecar's full auth key at the OS level. The Agent App API is the curated surface across that boundary — scoped, reversible operations.

What the curated MCP tool surface allows today: open panes, rename UI elements, navigate, discover and message peers, manage shells. The broader app-API RPC surface (agent lifecycle, sessions, identity, memory, drones) is driven by the frontend and internal tooling over the authenticated WebSocket transport.

What it does not expose: delete arbitrary panes belonging to other agents, access other agents' file systems, or call raw `dispatch_service` destructive commands. A finer-grained per-agent permission model (allow-lists, scoped capabilities) is on the roadmap.

**Practical advice:** don't inject `AGENTMUX_AUTH_KEY` into agent instructions when running less-trusted agents. The API is designed for agents you authored or trust, not for arbitrary model output from external sources.

## See also

- [Trust model](/security/trust-model/) — full trust boundary description
- [Reactive event bus](/security/reactive-event-bus/) — auth model and endpoint reference for the messaging layer
- [Armory](/armory/) — credential + primitive management UI (Accounts, Identities, Brain, Bundles, MCP Servers, Skills)
- [Pane Types](/pane-types/) — pane types OpenEditor can create
- [Identity/Presets/Memory spec](https://github.com/agentmuxai/agentmux/blob/main/specs/SPEC_AGENT_APP_API_IDENTITY_PRESETS_BRAIN_2026_06_27.md) — original implementation spec for the (now-shipped) `identity.*`/`memory.*` namespaces
- [Preset→Bundle rename spec](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/SPEC_PRESET_TO_BUNDLE_REFACTOR_2026_07_02.md) — `bundle.*`, `mcp.*`, `skill.*` primitive model
