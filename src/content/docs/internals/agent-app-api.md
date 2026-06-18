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

When AgentMux launches an agent, the sidecar injects four environment variables into the agent's process:

| Env var | Value | Purpose |
|---|---|---|
| `AGENTMUX_LOCAL_URL` | `http://127.0.0.1:<port>` | Sidecar base URL — all API calls go here |
| `AGENTMUX_AUTH_KEY` | `<per-instance secret>` | Auth key — pass as `X-AuthKey` header on every request |
| `AGENTMUX_BLOCKID` | `<pane UUID>` | The pane this agent lives in — used as self-context default |
| `AGENTMUX_AGENT_ID` | `<agent name>` | Agent's registered name — used by `SendMessage` routing |

The MCP server (`agentmux-mcp`) is a separate subprocess launched alongside the agent. It inherits these env vars and exposes them as tool inputs, so agents never have to handle auth or URL construction manually.

```
Agent CLI (claude / codex / gemini / …)
  └─ spawns agentmux-mcp (MCP stdio server)
       ├─ inherits AGENTMUX_LOCAL_URL + AGENTMUX_AUTH_KEY + AGENTMUX_BLOCKID
       └─ advertises 11 MCP tools → routes each to the REST API
```

## MCP tools (11 tools)

These are the 11 tools registered by `agentmux-mcp`. All providers that support MCP (Claude Code, Codex, Gemini, OpenClaw, Kimi) get them automatically.

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

Returns `{ shell_id }`. The shell stays open between turns — the agent can issue follow-up commands to the same session.

#### `ShellStop`

Stop a running shell by ID.

Parameters: `shell_id` (required, from `Shell` response).

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
| `GET` | `/agentmux/discovery` | `DiscoverAgents` |
| `POST` | `/agentmux/reactive/inject` | `SendMessage` |

Example — rename the current tab directly from a shell script inside a pane:

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

Subscribe to live agent output or workspace events via the `eventsub` command on the WebSocket rather than polling.

## Permission boundary

Agents are *sub-trusted*: they run as the user but do not hold the sidecar's full auth key at the OS level. The Agent App API is the curated surface across that boundary — scoped, reversible operations.

What the API allows today: open panes, rename UI elements, navigate, discover and message peers, manage shells.

What it does not expose: delete arbitrary panes belonging to other agents, access other agents' file systems, or call raw `dispatch_service` destructive commands. A finer-grained per-agent permission model (allow-lists, scoped capabilities) is on the roadmap.

**Practical advice:** don't inject `AGENTMUX_AUTH_KEY` into agent instructions when running less-trusted agents. The API is designed for agents you authored or trust, not for arbitrary model output from external sources.

## See also

- [Trust model](/security/trust-model/) — full trust boundary description
- [Interagent Communication](/internals/interagent-comms/) — MuxBus tiers and SendMessage routing
- [Trust Center](/trust-center/) — credential management UI
- [Pane Types](/pane-types/) — pane types OpenEditor can create
