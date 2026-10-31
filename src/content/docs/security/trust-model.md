---
title: "Trust model"
description: "What AgentMux protects against, what it doesn't, and the trust boundaries it relies on."
---

AgentMux is a desktop application that runs as the logged-in user. It installs no system service and has no setuid binaries. A few optional actions ask for administrator rights through the operating system's own prompt: on Linux, one-click installs of Node.js, Git or Python (`pkexec`) and the AppArmor sandbox fix. This page documents the trust boundaries AgentMux relies on, so you can decide whether the defaults suit your deployment.

## The short version

- **Your OS user account is the security boundary.** Anything running as you can control AgentMux, read its data, and act as any of your agents.
- **Every terminal pane and every agent holds the key to the local AgentMux API.** An agent, or any program it runs, can do anything you can do in the AgentMux UI.
- **Native agents are not sandboxed.** They run as you, with your files and your network.
- **On a machine shared with other OS users, the defaults are not enough.** See [Shared machines](#shared-multi-user-machines).

## The processes and what they trust

AgentMux runs a launcher, a CEF host (the window and UI), the server `agentmux-srv`, and one `agentmux-mcp` process per agent. See [Architecture overview](/internals/architecture/) for the full topology.

| Boundary | Mechanism |
|---|---|
| Launcher → server and CEF host | At each launch the launcher generates a UUIDv4 **auth key** and a separate **host-registration secret**, and passes both to the server and the CEF host in environment variables. The server removes them from its own environment after reading them. |
| UI → CEF host | A bearer token generated at each start of the host, passed to the UI in the page URL. The host returns the server auth key to the UI over this channel. |
| UI → server | The auth key, in the `X-AuthKey` header or, for the WebSocket, the `?authkey=` query parameter. |
| Terminal panes and agents → server | **The same auth key**, as `AGENTMUX_AUTH_KEY`, with the server URL as `AGENTMUX_LOCAL_URL`. See the next section. Container agents get a narrower per-agent token instead; see [Container agents](#container-agents). |
| CEF host → server, host-only services | The host-registration secret. Panes and agents don't receive it. It guards the browser-password broker, adopting or releasing an agent's earlier memory folders (confirmed in a host window), and the host's registration for UI automation. |
| Agent → server, UI automation | The agent's own signing key (`AGENTMUX_JEKT_KEY`) proves which pane the agent may automate. |
| Other instances on this machine | Each other's auth keys, read from registry files under `~/.agentmux/` (mode `0600` on Unix). |
| LAN peers | The `lan_key`, which opens a short list of routes: messaging, agent names and states, and whether an agent is running on this machine. It is broadcast on the LAN while LAN discovery is on. A request for a [remote operation](#remote-operations-on-another-machine) must also be signed by a pinned agent key. See [Network exposure](/security/network-exposure/). |

## The auth key is in every pane

AgentMux puts `AGENTMUX_AUTH_KEY` and `AGENTMUX_LOCAL_URL` into the environment of **every terminal pane and every agent process on the host** (`crates/srv/src/backend/pane_env.rs`, `PANE_ENV_KEEP`). The helper CLIs (`muxsh`, `muxopen`) and each agent's `agentmux-mcp` need them to reach the server. Every child process inherits them too: a shell an agent starts, its MCP servers, build scripts, `npm install` lifecycle scripts.

The key grants the same local API the AgentMux UI uses. With it, a process can, among other things:

- run commands in new shells (`/api/v1/shell/create`, the RPC service);
- read any file your user can read (`/agentmux/stream-local-file`);
- read other agents' live transcripts;
- send messages into any agent's conversation, stop agents, and close panes;
- change settings.

A few things need more than the auth key. The browser-password broker, memory-folder adoption and host registration require the host-registration secret. UI automation of a pane (`UI` `screenshot`, `click` and `query`, and the `Browser` tool) requires that pane's agent signing key. `Agents` `search_history` searches only the history of the agent whose identity token the request carries (see the next section).

**Implication:** anything you run inside AgentMux (an agent, a tool call, a package install script, a command you paste into a terminal pane) can control AgentMux as fully as you can, and through it act as you. The MCP tool list shows what an agent is *offered*, not a limit on what it can do.

**Mitigation:** run code you don't trust outside AgentMux panes. A process's environment is also readable by other processes running as the same user (for example `/proc/<pid>/environ` on Linux), so the key is not secret from anything else running as you.

Agents don't receive your MuxBus Cloud login. AgentMux removes `MUXBUS_TOKEN` and `MUXBUS_COGNITO_DOMAIN` from every agent's environment on every spawn path, even when they come from a saved `cmd:env` (`crates/srv/src/backend/account_login_guard.rs`); the server makes every cloud call with its own stored login. That login is still on disk, so an agent that goes looking for it can read it like any other file of yours. This keeps it out of agents' hands by default; it isn't an OS boundary.

### Container agents

A [container agent](/container-agents/)'s `AGENTMUX_AUTH_KEY` is not the instance auth key but a per-pane token starting `amxc_` (`crates/srv/src/backend/container_credential.rs`). The rule is that a container agent can do what a Native agent can, except directly change or run things on your computer. The server accepts the token on every route except those that:

- run commands on your computer: shells, PTYs, remote connections and the askpass helper;
- drive your desktop;
- read your files outside the container's mounts for the app's windows (a container agent reads its own `/workspace`, and shows a file by opening it in the editor, which opens a read-only snapshot);
- write Global Memory (it can read it), or upgrade AgentMux;
- belong to the app itself or to other AgentMux instances: approvals, the cloud relay, the WebSocket and RPC service, and the routes between instances.

A refused route answers with 403, the reason and what to do instead (`crates/srv/src/backend/container_routes.rs` lists them). A route added later is open to container agents unless it is added to that list. Messaging, the work queue, Kanban, the Vault, Browser and UI tools, widgets, dev servers, and opening or creating agents all work. The token is tied to the agent it was minted for, so a container can't claim another agent's identity with it. It lives only in the server's memory, and is revoked when the pane closes.

## Per-agent identity

An agent created from a definition has a UID (its row id). At each spawn, AgentMux sets two variables in the agent's process:

- `AGENTMUX_AGENT_UID`, the UID;
- `AGENTMUX_AGENT_TOKEN`, a random 256-bit token minted once per agent, stored in the instance database and deleted when the agent is deleted.

A quick-launch pane that has no definition gets neither. The server always overwrites or removes both at spawn, so a stale value from a reused pane can't carry over.

The agent's MCP server sends the token as `X-Agent-Token`. The server then **attributes** the request to that UID in audit records, the work queue and cron (`crates/srv/src/server/caller.rs`). This is attribution, not authorization. A request with no token, or an unknown one, is still accepted; it is just unattributed. The exception is `Agents` `search_history` (`/agentmux/reactive/history/search`), which searches the history of the token's own agent and refuses a request without a token (`crates/srv/src/server/reactive.rs`). A token is only honored on requests that also carry the full auth key, never on `lan_key` requests. The agent's child processes inherit the token.

**Name resolution refuses to guess.** Two agents can hold the same name. A message, lookup or unregister addressed to a name that two or more live agents hold is refused with the list of candidates (UID, pane, name), so the caller can retry by UID (`crates/srv/src/backend/reactive/handler.rs`). Before delivering, the server also checks the target pane's own identity and rejects a mismatch.

Agent-to-agent messages carry a separate, signature-based trust label; see [Reactive event bus](/security/reactive-event-bus/).

### One live instance per agent

An agent (its UID) runs in at most one place at a time, so two copies don't drive the same conversation and credentials (`crates/srv/src/backend/agent_admission.rs`):

- **This machine.** Before an agent's CLI process starts, its pane claims a lease on the agent's UID in a lease store shared by every AgentMux instance on the machine, and holds it while the process runs. A pane whose agent is running in another instance is refused, with a message naming that instance's channel and version; the user can choose **Take over**, which asks the other instance to stop its copy (`POST /agentmux/agent/release`, full auth key only). Registering the agent for messages is refused the same way (HTTP 409 from `/agentmux/reactive/register`).
- **LAN** (LAN discovery on). The instance asks each peer `GET /agentmux/agent/holding?uid=<uid>` before starting the agent, and again every 30 seconds while it runs. A peer on another host that says it holds the agent refuses the start. If both hosts are already running it, the one that started later stops its copy (starts within 10 seconds of each other go to the lower hostname).
- **WAN** (signed in to MuxBus Cloud). The instance claims the agent's lease on the relay (`/agents/lease`, keyed by agent name) before it pulls the agent's messages, and renews it every 20 seconds. While another instance holds the lease, the relay answers this instance's pulls with 409 and the local copy is stopped (`crates/srv/src/muxbus/wan_lease.rs`).

This is coordination, not a security boundary. Each tier fails open: an unreachable peer or relay doesn't stop an agent from starting. The LAN answers come from peers found by unauthenticated mDNS, so a device on the LAN can claim to hold an agent it doesn't run.

## Remote operations on another machine

With LAN discovery on, an agent can ask another machine to do something there, for example to start an agent, list its accounts or file a task (the `host` argument of the MuxAPI tools; see [Remote operations](/lan-discovery/#remote-operations)). The receiving machine decides:

- **The signature is the authority, not the `lan_key`.** The asking machine signs the request with the agent's own key. The receiver checks that the key is the one it pinned for that agent's name, that the request names this machine, is less than a minute old, was not seen before and was signed after this AgentMux started. Anything else is refused and not downgraded to a prompt.
- **Proof grows with the stakes.** A read of the version or health goes on the pinned key. A change, or a read of personal data (account emails, the task board, Global Memory entries, logs), also needs a certificate from an install this machine trusts: one it has pinned a key from, or one the signed-in MuxBus Cloud account lists as live and not revoked. A peer only seen for the first time is refused.
- **Same rules as a local call.** The operation runs the code a local call runs, as that agent, never as the operator. What is sensitive on the receiving machine still goes through its super agent and the countdown with a veto.
- **Nothing the request says is run or shown as an instruction.** Its text is never given to one of the receiver's agents; the banner and the audit row are built from the structured fields.
- **Recorded on both machines** under `agent@machine`, in the [Audit](/audit/) pane. Requests refused before they are proven leave one row a minute for each address.
- **An off switch per machine:** `"network:remote_ops": false` in `settings.json` refuses every one.

A device on the LAN can't use this without an agent key this machine has pinned. A machine that pinned a key for an attacker's device on first sight (mDNS discovery is unauthenticated) has trusted that key for reads; changes still need a certificate from an install it trusts.

## Who each action is recorded as

Every state-changing call on the RPC channel (the WebSocket the UI and agents use) leaves one line in the audit log, `GET /agentmux/reactive/audit` and the audit file: who made it, the command, the agent or pane it acted on, the identifier it acted on (an account id, a widget id, a path), and whether it was done or refused. Who made it comes from the connection, never from anything in the request:

- **An agent** is a connection registered as that agent with its token, recorded as `agent:<id>`.
- **The operator** is a connection the AgentMux host has proved is its own window, recorded as `operator`.
- **Anything else** is recorded as `unproven`. Holding the auth key is not enough to be recorded as the operator, and an agent registered on a connection is the agent.

The record names what was acted on, not what was sent: keys, tokens, message text and file contents are not in it. Reads and live terminal input are not recorded, and the window's own view state (layout, tabs, drafts) is recorded only when something other than the proven window changes it.

What this is for: agents run as your OS user with a shell, so these checks stop misuse through AgentMux's own APIs and keep the record honest about who did what through them. They are not a barrier against a determined local process, which can act as you without going through AgentMux. A [container agent](#container-agents) is the boundary that holds.

## What an agent can do to other panes and windows

These MCP tools act beyond the calling agent's own pane:

| Tool | Scope | Guard |
|---|---|---|
| `Stop` `pane` | A pane that holds no agent, by block id | The caller proves its own identity with its signing key and is recorded in the audit log. A pane that holds an agent is refused, with a pointer to `Stop` `agents`. Otherwise the target is not restricted, but the pane closes only after a 30-second window in which you can keep it. |
| `Stop` `agents` | Any agents, by block id | The auth key; the caller's signature is optional and only names it in the banner and audit log. Targets running on this instance get a 30-second window in which you can keep them. |
| `UI` `window` | Any window owned by your OS user: other AgentMux instances, and **other applications such as your browser or password manager** | Windows owned by other OS users are refused. Every call is appended to a local audit log, `capture-window-audit.log`. |
| `UI` `windows` | Lists AgentMux windows; with `include_foreign`, other applications' windows and titles too | Audited the same way |
| `Message` `send` | Any agent's conversation | Sender identity is labelled; see [Reactive event bus](/security/reactive-event-bus/) |
| `Agents` `transcript` | Any agent's live transcript on this machine | The auth key only |

`UI` `screenshot`, `click` and `query` and the `Browser` tool act on the caller's own pane, or on a browser pane the caller opened itself (`Browser` `open`, then that pane's id as `pane`). The server takes the caller from its signature and drives a pane only if that caller opened it: the record of who opened which pane is written only after checking the opener's signed identity, and ends when the user takes the pane over or closes it (`crates/srv/src/server/browser_owner.rs`). The caller's own pane needs no id. `Stop` `self` likewise acts only on the caller, which ends the caller's own session. It skips the 15-second window only when the user's own message started the current turn and asked for the quit (`crates/srv/src/server/app_api/pane.rs`).

The 30-second window is a safeguard on the routes these MCP tools use, not a limit on the auth key: the same key reaches the UI's own stop command (`fleet.bulk-stop` over the RPC channel), which acts at once.

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

Two things expose you to other OS users on the same machine:

1. **The Chromium remote-debugging port, when it is on, is unauthenticated.** Release builds don't start it unless `AGENTMUX_CDP_PORT` turns it on; dev builds start it by default. Loopback is shared by every account, so while it runs another user can attach to your AgentMux window and, through it, control AgentMux as you. See [Network exposure](/security/network-exposure/#chromium-remote-debugging-port). Leave it off on a shared machine (`AGENTMUX_CDP_PORT=0` for a dev build).
2. **On Windows, AgentMux's named pipes use Windows' default pipe security**, which Microsoft documents as granting read access to Everyone. See [Local IPC](/security/network-exposure/#local-ipc).

The data directory itself is closed to other users by default:

- **Unix:** at each launch AgentMux creates `~/.agentmux` with mode `0700`, or removes group and other permissions from an existing one (`ensure_owner_only_dir` in `crates/common/src/data_paths.rs`). Files inside still get your umask, but other users can't reach them through the closed directory. This is best effort: if AgentMux can't change the mode (for example, the directory belongs to another user), it logs a warning and starts anyway, so check it with `ls -ld ~/.agentmux`.
- **Windows:** `%USERPROFILE%\.agentmux` inherits your profile folder's access control, which by default admits only you, SYSTEM and administrators.

Agent working directories outside `~/.agentmux` are not covered by this. The `.mcp.json` AgentMux writes there is owner-only (`0600`) on Unix, but the rest of the directory keeps whatever permissions it has.

## Posture by deployment

- **Personal machine, single user.** The defaults are designed for this. Treat every agent and everything you run in a pane as trusted code.
- **Shared multi-user machine.** Apply the mitigations above, and don't run a dev build, or a release build with `AGENTMUX_CDP_PORT` set, while users you don't trust are logged in, because of the remote-debugging port.
- **Codespace or dev container.** Safe to the extent that everything else in the container is yours. Any other process running as your user can reach AgentMux.
- **CI or unattended runners.** Not a supported topology. AgentMux is an interactive workstation tool.
- **Air-gapped network.** AgentMux itself runs offline, but agents need to reach a model endpoint and agent CLIs have to be installed. See [Data sovereignty](/security/data-sovereignty/#offline-and-air-gapped-use).

## Reporting issues

Report security issues privately to **security@agentmux.ai**, not in a public GitHub issue. Include a description and impact, reproduction steps, the AgentMux version and your OS. The policy in the repository's `SECURITY.md` commits to an acknowledgement within 3 business days and coordinated disclosure.

---

**Source-of-truth references**:
- `crates/launcher/src/srv_spawner.rs` — auth key and host-registration secret generation
- `crates/srv/src/config.rs` — reading and scrubbing the keys; `lan_key` generation
- `crates/srv/src/backend/pane_env.rs` (`PANE_ENV_KEEP`) — what reaches pane environments
- `crates/srv/src/server/agent_handlers/input.rs` (`carry_agent_uid_env`) — agent UID and token
- `crates/srv/src/server/caller.rs`, `crates/srv/src/backend/storage/agent_tokens.rs` — attribution
- `crates/srv/src/server/ui_handlers.rs` (`verified_block_id`), `crates/srv/src/server/app_api/pane.rs` (`handle_close_pane`, `handle_quit_self`) — own-pane checks
- `crates/srv/src/sagas/pending_shutdown.rs`, `crates/srv/src/server/app_api/fleet.rs` (`fleet_bulk_stop_with_override`) — the 30-second override window
- `crates/srv/src/backend/agent_admission.rs`, `crates/srv/src/server/agent_takeover.rs`, `crates/srv/src/muxbus/wan_lease.rs` — one live instance per agent
- `crates/mcp/src/window_capture.rs` (`CaptureTier`) — window capture scope
- `crates/srv/src/server/service/credential.rs`, `crates/srv/src/server/service/memory_adopt.rs` — host-only services
- `crates/common/src/data_paths.rs` (`ensure_owner_only_dir`) — owner-only data root on Unix
- `crates/cef/src/dev_authfile.rs` — `authkey.dev` permissions
- `crates/srv/src/backend/account_login_guard.rs` (`strip_account_login`) — the MuxBus login kept out of agent environments
- `crates/srv/src/backend/container_credential.rs` (`container_route_allowed`) — the container agent token
- `crates/srv/src/backend/container_routes.rs` — the routes a container agent can't call
