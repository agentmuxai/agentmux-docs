---
title: "Agent App API"
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

AgentMux exposes an RPC API via WebSocket (JSON-RPC 2.0) for communication between the frontend, backend, and `wsh` shell helper. This page documents the key API commands.

## Transport

- **Protocol:** WebSocket with JSON-RPC 2.0
- **Backend:** agentmuxsrv-rs (Rust, Tokio + Axum)
- **Client:** `WshClient` in the frontend, `wsh` binary on remote hosts

## Command Categories

### Block Management

| Command | Description |
|---------|-------------|
| `createblock` | Create a new block (pane) in a tab |
| `createsubblock` | Create a sub-block within a parent block |
| `deleteblock` | Delete a block |
| `deletesubblock` | Delete a sub-block |
| `blockinfo` | Get block metadata and file info |
| `blockslist` | List all blocks, optionally filtered by window or workspace |

### Block Control

| Command | Description |
|---------|-------------|
| `controllerinput` | Send input to a block's controller (terminal input, signals, resize) |
| `controllerresync` | Resync or restart a block's controller |
| `controllerstop` | Stop a block's controller |
| `controllerappendoutput` | Append output to a block's controller |
| `captureblockscreenshot` | Capture a screenshot of a block's content |

### File Operations

| Command | Description |
|---------|-------------|
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

### Event System

| Command | Description |
|---------|-------------|
| `eventpublish` | Publish an event to the event bus |
| `eventrecv` | Receive/handle an event |
| `eventsub` | Subscribe to events by type and scope |
| `eventunsub` | Unsubscribe from a specific subscription |
| `eventunsuball` | Unsubscribe from all subscriptions |
| `eventreadhistory` | Read historical events |

### Connection Management

| Command | Description |
|---------|-------------|
| `connconnect` | Connect to a remote host |
| `conndisconnect` | Disconnect from a remote host |
| `connensure` | Ensure a connection is established |
| `connlist` | List active connections |
| `connlistaws` | List available AWS connections |
| `connstatus` | Get status of all connections |
| `connreinstallwsh` | Reinstall wsh on a remote host |
| `connupdatewsh` | Update wsh on a remote host |

### AI / Agent

| Command | Description |
|---------|-------------|
| `aisendmessage` | Send a message to an AI agent |
| `fetchsuggestions` | Get AI-generated suggestions |
| `disposesuggestions` | Clean up suggestion resources |

### Metadata and Configuration

| Command | Description |
|---------|-------------|
| `getmeta` | Get metadata for a wave object |
| `setmeta` | Set metadata on a wave object |
| `getfullconfig` | Get the complete configuration |
| `getupdatechannel` | Get the current update channel |
| `getvar` | Get a variable value |
| `setvar` | Set a variable value |

### Window and Tab Management

| Command | Description |
|---------|-------------|
| `focuswindow` | Focus a specific window |
| `gettab` | Get tab information |

### Authentication

| Command | Description |
|---------|-------------|
| `authenticate` | Authenticate with a token string |
| `authenticatetoken` | Authenticate with structured token data |

### Activity Tracking

| Command | Description |
|---------|-------------|
| `activity` | Report activity metrics (foreground time, AI requests, block counts, etc.) |

## Streaming Commands

Some commands return async streams instead of single responses:

- `fileliststream` — Stream directory entries progressively
- `filereadstream` — Stream file contents in chunks
- `filestreamtar` — Stream tar archive data

These use the `wshRpcStream` method and return `AsyncGenerator` objects.

## wsh CLI

The `wsh` binary provides shell-level access to the API:

```bash
wsh view myfile.txt       # Open file in a preview pane
wsh edit myfile.txt       # Open file in editor pane
```

The `wsh` binary communicates with the backend over WebSocket and is automatically deployed to remote hosts on SSH connection.

## See Also

- [Interpane Communication](/interpane-comms) — Event pub-sub system
- [Building from Source](/building) — Backend architecture
- [Configuration](/config) — Settings and MCP configuration
