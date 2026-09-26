---
title: "Trust model"
description: "What AgentMux protects against, what it doesn't, and the trust boundaries it relies on."
---

AgentMux is a desktop application that runs as the logged-in user. It installs no system service and has no setuid binaries. A few optional actions ask for administrator rights through the operating system's own prompt: on Linux, one-click installs of Node.js, Git or Python (`pkexec`) and the AppArmor sandbox fix. This page documents the trust boundaries AgentMux relies on, so you can decide whether the defaults suit your deployment.

## The short version

- **Your OS user account is the security boundary.** Anything running as you can control AgentMux, read its data, and act as any of your agents.
- **Every terminal pane and every agent holds the key to the local AgentMux API.** An agent, or any program it runs, can do anything you can do in the AgentMux UI.
- **Agents on the host are not sandboxed.** They run as you, with your files and your network.
- **On a machine shared with other OS users, the defaults are not enough.** See [Shared machines](#shared-multi-user-machines).

## The processes and what they trust

AgentMux runs a launcher, a CEF host (the window and UI), the server `agentmux-srv`, and one `agentmux-mcp` process per agent. See [Architecture overview](/internals/architecture/) for the full topology.

| Boundary | Mechanism |
|---|---|
| Launcher → server and CEF host | At each launch the launcher generates a UUIDv4 **auth key** and a separate **host-registration secret**, and passes both to the server and the CEF host in environment variables. The server removes them from its own environment after reading them. |
| UI → CEF host | A bearer token generated at each start of the host, passed to the UI in the page URL. The host returns the server auth key to the UI over this channel. |
| UI → server | The auth key, in the `X-AuthKey` header or, for the WebSocket, the `?authkey=` query parameter. |
| Terminal panes and agents → server | **The same auth key**, as `AGENTMUX_AUTH_KEY`, with the server URL as `AGENTMUX_LOCAL_URL`. See the next section. |
| CEF host → server, host-only services | The host-registration secret. Panes and agents don't receive it. It guards the browser-password broker, adopting or releasing an agent's earlier memory folders (confirmed in a host window), and the host's registration for UI automation. |
| Agent → server, UI automation | The agent's own signing key (`AGENTMUX_JEKT_KEY`) proves which pane the agent may automate. |
| Other instances on this machine | Each other's auth keys, read from registry files under `~/.agentmux/` (mode `0600` on Unix). |
| LAN peers | The `lan_key`, which opens four routes: three for messaging and one that says whether an agent is running on this machine. It is broadcast on the LAN while LAN discovery is on. See [Network exposure](/security/network-exposure/). |

## The auth key is in every pane

AgentMux puts `AGENTMUX_AUTH_KEY` and `AGENTMUX_LOCAL_URL` into the environment of **every terminal pane and every agent process** (`agentmux-srv/src/backend/pane_env.rs`, `PANE_ENV_KEEP`). The helper CLIs (`muxsh`, `muxopen`) and each agent's `agentmux-mcp` need them to reach the server. Every child process inherits them too: a shell an agent starts, its MCP servers, build scripts, `npm install` lifecycle scripts.

The key grants the same local API the AgentMux UI uses. With it, a process can, among other things:

- run commands in new shells (`/api/v1/shell/create`, the RPC service);
- read any file your user can read (`/agentmux/stream-local-file`);
- read other agents' live transcripts;
- send messages into any agent's conversation, stop agents, and close panes;
- change settings.

A few things need more than the auth key. The browser-password broker, memory-folder adoption and host registration require the host-registration secret. UI automation of a pane (`UIScreenshot`, `UIClick`, `UIQuery`, the `Browser*` tools) requires that pane's agent signing key. `SearchHistory` searches only the history of the agent whose identity token the request carries (see the next section).

**Implication:** anything you run inside AgentMux (an agent, a tool call, a package install script, a command you paste into a terminal pane) can control AgentMux as fully as you can, and through it act as you. The MCP tool list shows what an agent is *offered*, not a limit on what it can do.

**Mitigation:** run code you don't trust outside AgentMux panes. A process's environment is also readable by other processes running as the same user (for example `/proc/<pid>/environ` on Linux), so the key is not secret from anything else running as you.

When you are signed in to MuxBus Cloud, every agent process also receives `MUXBUS_TOKEN`, your account's MuxBus access token.

## Per-agent identity

An agent created from a definition has a UID (its row id). At each spawn, AgentMux sets two variables in the agent's process:

- `AGENTMUX_AGENT_UID`, the UID;
- `AGENTMUX_AGENT_TOKEN`, a random 256-bit token minted once per agent, stored in the instance database and deleted when the agent is deleted.

A quick-launch pane that has no definition gets neither. The server always overwrites or removes both at spawn, so a stale value from a reused pane can't carry over.

The agent's MCP server sends the token as `X-Agent-Token`. The server then **attributes** the request to that UID in audit records, the work queue and cron (`agentmux-srv/src/server/caller.rs`). This is attribution, not authorization. A request with no token, or an unknown one, is still accepted; it is just unattributed. The exception is `SearchHistory` (`/agentmux/reactive/history/search`), which searches the history of the token's own agent and refuses a request without a token (`agentmux-srv/src/server/reactive.rs`). A token is only honored on requests that also carry the full auth key, never on `lan_key` requests. The agent's child processes inherit the token.

**Name resolution refuses to guess.** Two agents can hold the same name. A message, lookup or unregister addressed to a name that two or more live agents hold is refused with the list of candidates (UID, pane, name), so the caller can retry by UID (`agentmux-srv/src/backend/reactive/handler.rs`). Before delivering, the server also checks the target pane's own identity and rejects a mismatch.

Agent-to-agent messages carry a separate, signature-based trust label; see [Reactive event bus](/security/reactive-event-bus/).

### One live instance per agent

An agent (its UID) runs in at most one place at a time, so two copies don't drive the same conversation and credentials (`agentmux-srv/src/backend/agent_admission.rs`):

- **This machine.** Before an agent's CLI process starts, its pane claims a lease on the agent's UID in a lease store shared by every AgentMux instance on the machine, and holds it while the process runs. A pane whose agent is running in another instance is refused, with a message naming that instance's channel and version; the user can choose **Take over**, which asks the other instance to stop its copy (`POST /agentmux/agent/release`, full auth key only). Registering the agent for messages is refused the same way (HTTP 409 from `/agentmux/reactive/register`).
- **LAN** (LAN discovery on). The instance asks each peer `GET /agentmux/agent/holding?uid=<uid>` before starting the agent, and again every 30 seconds while it runs. A peer on another host that says it holds the agent refuses the start. If both hosts are already running it, the one that started later stops its copy (starts within 10 seconds of each other go to the lower hostname).
- **WAN** (signed in to MuxBus Cloud). The instance claims the agent's lease on the relay (`/agents/lease`, keyed by agent name) before it pulls the agent's messages, and renews it every 20 seconds. While another instance holds the lease, the relay answers this instance's pulls with 409 and the local copy is stopped (`agentmux-srv/src/muxbus/wan_lease.rs`).

This is coordination, not a security boundary. Each tier fails open: an unreachable peer or relay doesn't stop an agent from starting. The LAN answers come from peers found by unauthenticated mDNS, so a device on the LAN can claim to hold an agent it doesn't run.

## What an agent can do to other panes and windows

These MCP tools act beyond the calling agent's own pane:

| Tool | Scope | Guard |
|---|---|---|
| `ClosePane` | Any pane, by block id | The caller proves its own identity with its signing key and is recorded in the audit log. The target is not restricted, but another agent's pane closes only after a 15-second window in which you can keep it (a banner in the pane and an OS notification). |
| `FleetBulkStop` | Any agents, by block id | The auth key; the caller's signature is optional and only names it in the banner and audit log. Targets running on this instance get the same 15-second window. |
| `CaptureWindow` | Any window owned by your OS user: other AgentMux instances, and **other applications such as your browser or password manager** | Windows owned by other OS users are refused. Every call is appended to a local audit log, `capture-window-audit.log`. |
| `DiscoverWindows` | Lists AgentMux windows; with `include_foreign`, other applications' windows and titles too | Audited the same way |
| `SendMessage` | Any agent's conversation | Sender identity is labelled; see [Reactive event bus](/security/reactive-event-bus/) |
| `GetAgentTranscript` | Any agent's live transcript on this machine | The auth key only |

`UIScreenshot`, `UIClick`, `UIQuery` and the `Browser*` tools act only on the caller's own pane. The server derives that pane from the caller's signature and never takes a pane id from the request. The same holds for `QuitSelf` and for `ClosePane` with no block id, which end the caller's own session. `QuitSelf` skips the 15-second window only when the user's own message started the current turn and asked for the quit; `ClosePane` with no block id always waits for it (`agentmux-srv/src/server/app_api/pane.rs`).

The 15-second window is a safeguard on the routes these MCP tools use, not a limit on the auth key: the same key reaches the UI's own stop command (`fleet.bulk-stop` over the RPC channel), which acts at once.

## What AgentMux protects against

- **Network access with LAN discovery off.** Nothing listens on a non-loopback address. See [Network exposure](/security/network-exposure/).
- **Web pages driving the local server.** The server requires the auth key on every route except a version endpoint and the WhatsApp webhook (which checks Meta's signature), and reflects CORS only for loopback origins.
- **Replay of old keys.** The auth key, the host-registration secret, the host's bearer token and the `lan_key` are all regenerated at each launch.
- **Casual impersonation between agents.** A message that claims the name of an agent whose key this instance holds, without that agent's signature, is labelled and forced to the sensitive tier. See [Reactive event bus](/security/reactive-event-bus/).
- **Instance cross-talk.** Panes don't inherit AgentMux's internal environment variables beyond an allow-list, so a second AgentMux started from a pane doesn't adopt the first one's data directory.
- **Tampered tool-catalog downloads.** jq and ripgrep from the tool catalog are checked against a SHA-256 in the catalog. This does not cover agent CLIs, which are installed from npm; see [Update model](/security/update-model/).

## What AgentMux does not protect against

- **Anything running as your OS user.** It can read the auth key from a pane's environment, `authkey.dev` in the data directory, the registry files, every agent's signing keys in its `.mcp.json`, and the install's WAN instance key in `wan.db`. With those it can do anything AgentMux can, including signing messages as any agent.
- **A malicious or manipulated agent.** An agent has your permissions and the auth key. AgentMux records what agents do but does not sandbox them.
- **Malicious model output.** The agent CLI talks directly to its provider. If a model tells an agent to run `rm -rf ~`, only the agent's own safeguards stand in the way.
- **Other OS users on a shared machine.** See the next section.
- **Root, sudo or an administrator** on the machine, who can read everything above.
- **Compromised dependencies an agent installs.** Package integrity is the package manager's job.

## Shared multi-user machines

Two defaults expose you to other OS users on the same machine:

1. **The Chromium remote-debugging port is always on and unauthenticated.** Loopback is shared by every account, so another user can attach to your AgentMux window and, through it, control AgentMux as you. See [Network exposure](/security/network-exposure/#chromium-remote-debugging-port). No setting turns it off; use a per-user firewall rule on the port if your OS supports one.
2. **On Windows, AgentMux's named pipes use Windows' default pipe security**, which Microsoft documents as granting read access to Everyone. See [Local IPC](/security/network-exposure/#local-ipc).

The data directory itself is closed to other users by default:

- **Unix:** at each launch AgentMux creates `~/.agentmux` with mode `0700`, or removes group and other permissions from an existing one (`ensure_owner_only_dir` in `agentmux-common/src/data_paths.rs`). Files inside still get your umask, but other users can't reach them through the closed directory. This is best effort: if AgentMux can't change the mode (for example, the directory belongs to another user), it logs a warning and starts anyway, so check it with `ls -ld ~/.agentmux`.
- **Windows:** `%USERPROFILE%\.agentmux` inherits your profile folder's access control, which by default admits only you, SYSTEM and administrators.

Agent working directories outside `~/.agentmux` are not covered by this. The `.mcp.json` AgentMux writes there is owner-only (`0600`) on Unix, but the rest of the directory keeps whatever permissions it has.

## Posture by deployment

- **Personal machine, single user.** The defaults are designed for this. Treat every agent and everything you run in a pane as trusted code.
- **Shared multi-user machine.** Apply the mitigations above, and don't run AgentMux while users you don't trust are logged in, because of the remote-debugging port.
- **Codespace or dev container.** Safe to the extent that everything else in the container is yours. Any other process running as your user can reach AgentMux.
- **CI or unattended runners.** Not a supported topology. AgentMux is an interactive workstation tool.
- **Air-gapped network.** AgentMux itself runs offline, but agents need to reach a model endpoint and agent CLIs have to be installed. See [Data sovereignty](/security/data-sovereignty/#offline-and-air-gapped-use).

## Reporting issues

Report security issues privately to **security@agentmux.ai**, not in a public GitHub issue. Include a description and impact, reproduction steps, the AgentMux version and your OS. The policy in the repository's `SECURITY.md` commits to an acknowledgement within 3 business days and coordinated disclosure.

---

**Source-of-truth references**:
- `agentmux-launcher/src/srv_spawner.rs` — auth key and host-registration secret generation
- `agentmux-srv/src/config.rs` — reading and scrubbing the keys; `lan_key` generation
- `agentmux-srv/src/backend/pane_env.rs` (`PANE_ENV_KEEP`) — what reaches pane environments
- `agentmux-srv/src/server/agent_handlers/input.rs` (`carry_agent_uid_env`) — agent UID and token
- `agentmux-srv/src/server/caller.rs`, `agentmux-srv/src/backend/storage/agent_tokens.rs` — attribution
- `agentmux-srv/src/server/ui_handlers.rs` (`verified_block_id`), `agentmux-srv/src/server/app_api/pane.rs` (`handle_close_pane`, `handle_quit_self`) — own-pane checks
- `agentmux-srv/src/sagas/pending_shutdown.rs`, `agentmux-srv/src/server/app_api/fleet.rs` (`fleet_bulk_stop_with_override`) — the 15-second override window
- `agentmux-srv/src/backend/agent_admission.rs`, `agentmux-srv/src/server/agent_takeover.rs`, `agentmux-srv/src/muxbus/wan_lease.rs` — one live instance per agent
- `agentmux-mcp/src/window_capture.rs` (`CaptureTier`) — window capture scope
- `agentmux-srv/src/server/service/credential.rs`, `agentmux-srv/src/server/service/memory_adopt.rs` — host-only services
- `agentmux-common/src/data_paths.rs` (`ensure_owner_only_dir`) — owner-only data root on Unix
- `agentmux-cef/src/dev_authfile.rs` — `authkey.dev` permissions
- `agentmux-srv/src/server/muxbus_handlers.rs` (`inject_muxbus_env`) — `MUXBUS_TOKEN` in agent environments
