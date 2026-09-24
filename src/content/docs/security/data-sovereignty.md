---
title: "Data sovereignty"
description: "What stays on your machine, what AgentMux sends out and when, and what works offline — itemized."
---

AgentMux runs locally and has no telemetry. It still makes some network calls of its own, a few of them automatically. This page lists every one, so you can verify the claims and decide what to allow.

## What stays on your machine

These are stored only on the local filesystem, under `~/.agentmux` (see [Identity & credential storage](/security/identity-credential-storage/#where-agentmux-keeps-data) for the layout):

- **Session state:** panes, layout, settings, terminal scrollback, and agent output, in local SQLite databases.
- **Conversation transcripts**, including held messages and continuity summaries.
- **Identity metadata:** accounts, bundles, and pointers to credentials. Secrets themselves are in the OS secret store or the provider CLIs' own login directories.
- **Logs** and, on Windows, crash dumps (written to `C:\CrashDumps\agentmuxsrv\`, never uploaded).

AgentMux doesn't upload any of this. But your prompts and your agents' work do leave the machine whenever an agent talks to its model provider, and AgentMux itself sends excerpts of Claude agents' conversations to Anthropic (see [Background model calls](#background-model-calls)).

## What AgentMux never does

- **No telemetry, analytics or usage pings.** The frontend's telemetry hooks have no backend: the server accepts `TelemetryUpdate` and discards it. The `telemetry:*` settings only control the local system-stats graph.
- **No crash reporting.** Crash dumps stay on disk.
- **No update or version check** for AgentMux itself. See [Update model](/security/update-model/).
- **No license check.** AgentMux is open source under Apache 2.0.
- **No Chromium background traffic.** The embedded Chromium is started with background networking, component updates, domain reliability reporting and field trials disabled (`agentmux-cef/src/app/mod.rs`).

## What leaves your machine, and when

### Your agents' model traffic

Each agent CLI (Claude Code, Codex, Gemini, and the rest) talks directly to its provider over HTTPS. **AgentMux is not a proxy for this traffic.** The provider's own terms govern the data. To inspect or block it, use OS-level tools (proxy, firewall, packet capture); the CLIs use whatever you configure.

### Automatic, without a click

| Call | Destination | What is sent | When |
|---|---|---|---|
| Claude model list | `https://api.anthropic.com/v1/models` | Your Claude login token | At each launch, if a Claude login is found in `~/.agentmux/shared/providers/claude/` or in `CLAUDE_CODE_OAUTH_TOKEN` (`agentmux-srv/src/backend/model_catalog.rs`) |
| Background model calls | Anthropic, through the Claude agent's own CLI | Excerpts of that agent's conversation | See [Background model calls](#background-model-calls) |
| Link favicons | `https://www.google.com/s2/favicons?domain=<host>` | The hostname of each result | Whenever an agent's web-search or web-fetch results are shown |
| Markdown images | The image's own server | An ordinary image request | Whenever rendered Markdown contains an image URL |
| Browser pane start page | `https://agentmux.ai` | An ordinary page load | When a browser pane opens without a URL. Text typed into the address bar that isn't a URL goes to Google search |
| MuxBus Cloud | `wss://muxbus-ws.agentmux.ai`, `https://muxbus.agentmux.ai` | Your local agent names (to subscribe), relayed message bodies and sender names, keep-alives | **Only after you sign in**; from then on, at every launch until you sign out |
| LAN discovery | Your local network | See [Network exposure](/security/network-exposure/#mdns-and-the-udp-probe-what-they-reveal) | **Only with LAN discovery on** (off by default) |

MuxBus Cloud is AgentMux's hosted relay for agent-to-agent messages across machines. Relayed messages travel over TLS but are not end-to-end encrypted, so the service can read them. Signed out, the app makes no MuxBus connections.

### Background model calls

For a Claude agent that belongs to an agent definition, AgentMux runs extra, short model calls through that agent's own Claude CLI and account (model `claude-haiku-4-5-20251001`, `invoke_ambient_haiku_call` in `agentmux-srv/src/server/app_api/session.rs`). These calls send excerpts of the agent's conversation to Anthropic, the same provider the agent already uses. The purposes defined in code are:

- a running **continuity summary** of the conversation, written after the first completed turn and refreshed once three new user turns have accumulated, or after ten minutes with at least one new turn (`agentmux-srv/src/backend/continuity_state.rs`). Set `agent:continuity` to `off` on an agent pane to stop it;
- activity summaries, agent-definition summaries, names for subagents and dispatches, next-prompt suggestions, and narration.

Obvious secrets are redacted from the continuity-summary prompt, but it is still your conversation.

### When you ask for it

| Feature | Destination |
|---|---|
| Installing an agent CLI | Your npm registry (`registry.npmjs.org` by default) |
| Toolchain pane version check | `registry.npmjs.org/<package>/latest`, when the pane opens (cached 6 hours) or on request |
| Installing jq or ripgrep from the tool catalog | GitHub release downloads |
| One-click Node.js, Git or Python install | winget, Homebrew, or your Linux package manager |
| Validating a credential in the Armory | `api.github.com/user`, `api.openai.com/v1/models`, `api.anthropic.com/v1/models`, or Slack `auth.test`, carrying the credential. An agent can also trigger this with the `IdentityValidate` tool. |
| Signing in to MuxBus Cloud | AgentMux's sign-in service (`auth.muxbus.agentmux.ai`) and `muxbus.agentmux.ai` |
| OAuth sign-in for Google, Microsoft, GitHub or Slack accounts | That provider's OAuth endpoints. AgentMux ships no OAuth client ids, so this runs only with your own OAuth app's credentials. |
| Voice input | Groq's transcription API by default, and only once you set a Groq API key. The local Whisper engine runs offline, but downloads its model from Hugging Face the first time unless you point it at a model file. |
| Discord, Telegram, Slack and WhatsApp bridges | Those services' APIs. Each bridge is off until you enable it and supply a token. |
| Drone workflow API steps | The URLs you configure. Private addresses are blocked. |

### MCP servers

MCP servers are programs your agents run. What they connect to is up to them. AgentMux's default MCP catalog includes servers that reach the internet when used (fetch, playwright, context7), and every default server is downloaded from npm or PyPI when an agent first starts it (see [Update model](/security/update-model/#default-mcp-servers)).

## What you control

| Setting | Default | Effect |
|---|---|---|
| LAN discovery | Off | LAN listeners, mDNS, UDP discovery, messages to and from LAN peers |
| MuxBus Cloud sign-in | Signed out | All MuxBus traffic |
| `agent:continuity` (per agent pane) | On for Claude agents with a definition | Continuity-summary model calls |
| Voice engine | Groq (inactive without a key) | Where audio is sent |
| Messaging bridges | Off | Discord, Telegram, Slack, WhatsApp |
| Crash reporting, update check | Not applicable: neither exists | — |

## Offline and air-gapped use

**The AgentMux app itself works offline:** terminals, editors, layout, stored conversations, and local agent-to-agent messaging. Calls that need the network degrade: the Claude model list falls back to a built-in one, favicons don't load, MuxBus is unavailable.

**Agents need a model endpoint.** Without network access to a provider, an agent can't work. What AgentMux itself supports:

- A **Claude Code** agent can be pointed at another Anthropic-compatible endpoint, for example one inside your network, with the agent definition's model vendor base URL. AgentMux passes it as `ANTHROPIC_BASE_URL` (`agentmux-srv/src/backend/providers.rs`).
- For every other provider, AgentMux has no base-URL setting and rejects one. An agent definition's environment block can set extra variables, but not ones AgentMux already sets.
- AgentMux has no setting of its own for a local model with Mux Code or any other provider. Whether a CLI can use a local model is up to that CLI.

**Agent CLIs must be installed first.** AgentMux installs them from npm. On an isolated network, point npm at an internal mirror, which AgentMux's installs honor. Alternatively, install on a connected machine running the same AgentMux version: CLIs live in `~/.agentmux/instances/v<agentmux-version>/cli/<provider>/`. Remove or pre-install the default MCP servers, which are otherwise downloaded on first use.

## Verifying the claims

- **Watch the traffic.** Run AgentMux behind a proxy or packet capture. Expect your agents' provider traffic, the model-list call at launch, favicon and image loads, and the features you use from the tables above.
- **Read the source.** Outbound HTTP in the Rust code goes through `reqwest`: search for `reqwest::Client`, `http_client` and `https://` under `agentmux-srv/src`, `agentmux-cef/src` and `agentmux-launcher/src`. The frontend's external loads are the favicon URLs in `frontend/app/view/agent/components/tool-renderers/SearchResults.tsx` and `WebFetchResult.tsx`, and the browser pane's `DEFAULT_BROWSER_URL` in `frontend/app/view/browser/browser-model.ts`.
- **Inspect the databases.** The `.db` files under `~/.agentmux` are ordinary SQLite files; open them with the `sqlite3` CLI.

---

**Source-of-truth references**:
- `agentmux-srv/src/server/service/client.rs` — `TelemetryUpdate` accepted and ignored
- `agentmux-srv/src/backend/model_catalog.rs`, `agentmux-srv/src/server/providers_handlers.rs` — model-list call
- `agentmux-srv/src/server/app_api/session.rs`, `agentmux-srv/src/backend/continuity_state.rs` — background model calls
- `agentmux-srv/src/muxbus/cloud_subscriber.rs`, `agentmux-srv/src/muxbus/relay.rs`, `agentmux-srv/src/muxbus/pkce.rs` — MuxBus Cloud
- `agentmux-srv/src/identity/key_validator.rs`, `agentmux-srv/src/identity/oauth_client.rs` — validation and OAuth
- `agentmux-srv/src/server/cli_handlers.rs`, `agentmux-srv/src/backend/tool_store.rs`, `agentmux-srv/src/server/system_install_handlers.rs` — installs
- `agentmux-srv/src/server/voice.rs` — voice input
- `agentmux-cef/src/app/mod.rs` — Chromium background networking switches

**Marketing claims this page substantiates**: "zero telemetry" on [agentmux.ai](https://agentmux.ai).
