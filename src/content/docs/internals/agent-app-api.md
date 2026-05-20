---
title: Agent App API
description: The high-level intent-based API for driving AgentMux from an agent — agent.open, agent.send, pane.open — plus the low-level RPC catalog.
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

AgentMux exposes two layers of RPC surface: a **high-level App API** for agents and integrations, and a **low-level command catalog** for direct manipulation. Both transport over the same JSON-RPC 2.0 WebSocket and share the same auth.

The App API is what you should reach for first. It expresses **intent** ("open this agent in a pane, idempotently") and orchestrates the underlying `CreateBlock` / `SetMeta` / `ControllerResync` calls. The low-level catalog is for cases that don't fit the intent shape (tooling, testing, custom panes).

## Transport

- **Protocol:** WebSocket, JSON-RPC 2.0
- **Server:** `agentmux-srv` (Rust, Tokio + Axum)
- **Client:** `RpcApi` / `TabRpcClient` in the frontend (`frontend/app/store/rpc-api.ts`)
- **Auth:** Token-based; pass via `authenticate` or `authenticatetoken` on connect

The host auto-spawns a sidecar per instance on a dynamic port; terminals opened inside AgentMux receive `AGENTMUX_PORT` and an auth token via the [shell integration](/multi-instance/#shell-helpers) env block.

## App API

High-level commands defined in [`agentmux-srv/src/server/app_api.rs`](https://github.com/agentmuxai/agentmux/blob/main/agentmux-srv/src/server/app_api.rs). Idempotent, intent-based.

### Agent lifecycle

| Command | Description |
|---|---|
| `agent.open` | Open an agent (from the agent-definition catalog) in a pane. Idempotent — if the agent already has a block in the target tab, returns it. Resolves provider, sets controller meta, registers the controller. |
| `agent.send` | Send a message to a running agent. Honors the agent's CLI provider (Claude Code, Codex CLI, Gemini CLI, OpenClaw, Kimi Code CLI, GitHub Copilot CLI, Pi). |
| `agent.stop` | Cleanly stop an agent (asks the CLI to wrap up). |
| `agent.status` | Query an agent's current state — controller status, last activity, block id. |
| `agent.list` | List every running agent across the workspace, with provider + status. |
| `agent.output` | Fetch the last N lines of an agent's terminal output (post-stream-buffer). |

### Process tracking

| Command | Description |
|---|---|
| `agent.process-list` | List every OS process currently tracked for a given agent block (PIDs, RSS, command line). |
| `agent.tracked-blocks` | List every block the process tracker is following — for the swarm aggregate view. |
| `agent.kill-process` | Terminate one PID, only if it's a tracked member of the named block (safety-checked). |
| `agent.kill-tree` | Terminate the entire process tree for a given block. |

The process tracker has three confidence levels (`high`, `best_effort`, `none`) that callers should respect when interpreting results.

### Panes

| Command | Description |
|---|---|
| `pane.open` | Open a pane of one of the supported view types: `editor` (requires `file`), `term`, `browser` (requires `url`), `sysinfo`, or `help`. Returns the new block id. |

### Sessions

| Command | Description |
|---|---|
| `session:archive` | Archive the current session state to a portable bundle. |
| `session:restore` | Restore a previously archived session into a fresh workspace. |
| `session:export` | Export a session digest (read-only, shareable). |
| `session:digest` | Compute a digest of the current session for diff / hashing. |

## Low-level RPC catalog

The primitives the App API is built on. These are stable but lower-level — most consumers should prefer the App API where one exists.

### Block management

| Command | Description |
|---|---|
| `createblock` | Create a new block (pane) in a tab |
| `createsubblock` | Create a sub-block within a parent block |
| `deleteblock` | Delete a block |
| `deletesubblock` | Delete a sub-block |
| `blockinfo` | Get block metadata and file info |
| `blockslist` | List all blocks, optionally filtered by window or workspace |

### Block control

| Command | Description |
|---|---|
| `controllerinput` | Send input to a block's controller (terminal input, signals, resize) |
| `controllerresync` | Resync or restart a block's controller |
| `controllerrestart` | Restart a block's controller |
| `controllerstop` | Stop a block's controller |
| `captureblockscreenshot` | Capture a screenshot of a block's content |

### File operations

| Command | Description |
|---|---|
| `fileread` | Read a file's contents |
| `filewrite` | Write contents to a file |
| `filecreate` | Create a new file |
| `filedelete` | Delete a file |
| `fileappend` | Append data to a file |
| `filecopy` | Copy a file |
| `filemove` | Move/rename a file |
| `filemkdir` | Create a directory |
| `filelist` | List files in a directory |
| `fileliststream` | Stream a directory listing (for large directories) |
| `filereadstream` | Stream file contents |
| `filestreamtar` | Stream a tar archive of files |
| `fileinfo` | Get file metadata |
| `filejoin` | Join file paths |

### Event system

| Command | Description |
|---|---|
| `eventpublish` | Publish an event to the event bus |
| `eventrecv` | Receive/handle an event |
| `eventsub` | Subscribe to events by type and scope |
| `eventunsub` | Unsubscribe from a specific subscription |
| `eventunsuball` | Unsubscribe from all subscriptions |
| `eventreadhistory` | Read historical events |

### Connection management

| Command | Description |
|---|---|
| `connconnect` | Connect to a remote host |
| `conndisconnect` | Disconnect from a remote host |
| `connensure` | Ensure a connection is established |
| `connlist` | List active connections |
| `connlistaws` | List available AWS connections |
| `connstatus` | Get status of all connections |

### Metadata + configuration

| Command | Description |
|---|---|
| `getmeta` | Get metadata for a wave object |
| `setmeta` | Set metadata on a wave object |
| `setview` | Set a block's view type |
| `getfullconfig` | Get the complete configuration |
| `getvar` / `setvar` | Get / set a config variable |

### Authentication

| Command | Description |
|---|---|
| `authenticate` | Authenticate with a token string |
| `authenticatetoken` | Authenticate with structured token data |

## Streaming commands

A few commands return async streams instead of single responses:

- `fileliststream` — directory entries progressively
- `filereadstream` — file contents in chunks
- `filestreamtar` — tar archive bytes

The frontend client surfaces these as `AsyncGenerator` objects; over the wire each chunk is a JSON-RPC notification on the same connection. For live agent output, subscribe to the relevant agent block via `eventsub` rather than polling `agent.output`.

## Permission boundary

Be aware of what the API currently does and does not enforce.

By the [trust model](/security/trust-model/), agent processes are *sub-trusted*: they run as the user but are not given the sidecar's auth key. That's the intended boundary. The Agent App API is the narrow surface across that boundary — the only RPC entry points an agent can reach.

In the current implementation, an agent that authenticates to the App API gets broad access to the workspace: spawn panes, mutate workspace state, send messages, read and write blocks. There is no per-tool permission scope, no allow-list of which RPCs a given agent may call, no rate limiting beyond what the underlying RPC machinery provides.

**Concrete advice:**

- Treat the Agent App API as a privilege boundary you opt into per agent. An agent you don't trust should not be given API access.
- Default-deny in your own workflow: don't enable the API for agents whose Memory bundle isn't from a source you trust.
- The audit endpoint logs every RPC call. If you're running a less-trusted agent, watch the log.

A finer-grained permission model (per-agent allow-lists, scoped RPC capabilities) is on the roadmap. This page will be updated when it lands.

## See also

- [Trust model](/security/trust-model/) — the broader trust boundaries this API sits inside
- [Interagent Communication](/internals/interagent-comms/) — the event pub-sub system the `event*` commands plug into
- [Persistence](/internals/persistence/) — how state changes flow into SQLite
- [Reducer stack](/internals/reducer-stack/) — what's RPC-driven vs reducer-driven (migration in flight)
- [Configuration](/config/) — settings + MCP config
- [Building from Source](/internals/building/) — backend architecture
