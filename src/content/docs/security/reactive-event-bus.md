---
title: "Reactive event bus"
description: "How agent-to-agent messages (jekts) are routed, authenticated, marked with a trust label, and held — on one machine, across the LAN, and through MuxBus Cloud."
---

The **reactive event bus** carries agent-to-agent messages ("jekts") between panes, between AgentMux instances on one machine, across the LAN, and through MuxBus Cloud. This page covers the security side: who may send, how a message is routed, what the trust marker on every delivered message means, and what it does not prove.

The exact rules (the request, the signature schemes, how `TRUST`, `TIER` and `ESCALATE` are decided, the marker format, and what a receiving agent must do) are specified in [Jekt protocol](/internals/jekt-protocol/). For the agent-facing overview (`Message` `send`, `Agents` `list`, return values), see [Interagent communication](/internals/interagent-comms/).

## How a message enters the bus

Agents send with the `Message` MCP tool (action `send`). The tool, running in the agent's own `agentmux-mcp` process, signs the message with the agent's keys (see [Signing keys](#signing-keys)) and posts it to its own AgentMux server, with the agent's identity token:

```
POST /agentmux/reactive/inject      X-AuthKey: <instance auth key>
                                    X-Agent-Token: <the agent's AGENTMUX_AGENT_TOKEN>
{ "target_agent", "message", "source_agent", "request_id", "ts_secs",
  "jekt_sig", "lan_sig", "lan_sig_v2", "channel_sig", "channel_sig_v2",
  "source_channel", "source_uid" }
```

`source_agent` comes from the agent's `AGENTMUX_AGENT_ID`. The tool does not set a tier or a priority, so a `Message` `send` jekt starts at `TIER=coord` and `PRIORITY=normal`.

Other senders reach the same delivery code: the cron scheduler, the Slack/Discord/Telegram/WhatsApp bridges, the WebSocket `bus:inject` message, and the legacy `/api/bus/inject` route. Any process holding the instance auth key can call `/agentmux/reactive/inject` directly and put any name in `source_agent`. What the receiver can say about that name is decided by signature checks, described below, not by the request body.

## Delivery order

`deliver` in `crates/srv/src/server/reactive.rs` tries each tier in turn and stops at the first that takes the message:

| Step | Where the target is | How it gets there | Marker `DELIVERY=` |
|---|---|---|---|
| 1 | This instance | In-process handler | `host` (or whatever tier the message arrived on) |
| 2a | Another AgentMux instance on this machine | HTTP to `127.0.0.1`, using the URL and auth key in the registry file `~/.agentmux/agents/<name>.json` | `channel` |
| 2b | Any other instance on this machine, freshest registration first | HTTP to a loopback URL from the shared registry `~/.agentmux/shared/agents/reactive/<name>/<channel>.json` | `channel` |
| 3 | An AgentMux instance on the LAN (LAN discovery on) | HTTP to the peer's LAN address, using the `lan_key` the peer advertised | `lan` |
| 4 | Nowhere running, and the target is a known agent of this channel | Held on this instance for up to 24 h | `host` |
| 5 | Anywhere else (signed in to MuxBus Cloud) | HTTPS to `https://muxbus.agentmux.ai`; the recipient's instance fetches it on its next sync | `wan` |
| 6 | The relay didn't take it, and the target is a known agent of this channel | Held, as in step 4 | `host` |

Notes on each step:

- **Target resolution (step 1).** A target is looked up by agent UID first, then by name. A name held by two or more live agents is **refused** with an error listing each candidate's `uid`, `block` and `name`, so the sender can retry by UID. An ambiguous name is not forwarded to other tiers.
- **Recipient verification (step 1).** Before delivering, the server asks the target pane's own controller who it is: its UID when the target was resolved by UID, otherwise its live and spawn-time agent ids. A mismatch rejects the delivery with `identity mismatch` and an audit entry. A controller that cannot answer is treated as unverifiable, and delivery proceeds.
- **Forward limit.** A message is forwarded at most 3 times (`MAX_FORWARD_HOPS`), which stops two stale registry entries from bouncing it forever.
- **Step 2b** only forwards to URLs that start with `http://127.0.0.1`, `http://localhost` or `http://[::1]`.
- **Step 5** runs only when this instance is signed in to MuxBus Cloud and the message has a `source_agent`. A message that arrived from the cloud is never relayed back to it. A 2xx from the relay means **queued**, not delivered.
- **Steps 4 and 6** run only for a request authenticated with the full auth key, arriving at `DELIVERY=host`, not from the cron scheduler, and whose target resolves to exactly one agent of this channel. Step 4 is skipped when another instance or a LAN peer reported the target running, or MuxBus Cloud says another install of your account runs it. See [Durable hold](#durable-hold).

When the sender is an agent on the same instance, a successful delivery also adds a copy of the marker to the sender's own pane, so it sees what the receiver saw.

## Who may call the bus

All routes live on the local AgentMux server (`agentmux-srv`). See [Network exposure](/security/network-exposure/) for where that server listens.

| Route | Accepted credential | Purpose |
|---|---|---|
| `POST /agentmux/reactive/inject` | Full auth key **or** `lan_key` | Deliver a jekt |
| `POST /agentmux/reactive/inject-files` | Full auth key **or** `lan_key` | Deliver a jekt with its files after it |
| `POST /agentmux/remote/op` | `lan_key` **and** a valid signature | Carry out a signed [remote operation](/security/trust-model/#remote-operations-on-another-machine) from an agent on a proven machine. The `lan_key` alone is refused |
| `GET /agentmux/fleet`, `/agentmux/fleet/events` | Full auth key **or** `lan_key` | The agents' names and states as a snapshot and a stream, for the mobile app and other peers |
| `GET /agentmux/reactive/agent?id=<name>` | Full auth key **or** `lan_key` | Look up one agent's registration and LAN public key |
| `GET /agentmux/reactive/agent-names` | Full auth key **or** `lan_key` | List the names of this instance's registered agents |
| `GET /agentmux/agent/holding?uid=<uid>` | Full auth key **or** `lan_key` | Say whether an agent UID is running on this machine: since when, in which channel and version. Used by LAN peers for [one live instance per agent](/security/trust-model/#one-live-instance-per-agent) |
| `GET /agentmux/reactive/agents`, `/audit`, `/transcript`, `/history/search` | Full auth key | List registrations, read the delivery audit log, read an agent's transcript, search the calling agent's own past conversations (needs its `X-Agent-Token`) |
| `POST /agentmux/reactive/register`, `/unregister` | Full auth key | Registration. `register` is refused (409) while the agent is running in another AgentMux instance on this machine |
| `POST /agentmux/agent/release` | Full auth key | Stop this instance's copy of an agent that another instance on this machine is taking over |
| `GET /agentmux/discovery` | Full auth key | The `Agents` `list` view |
| `/api/bus/*` | Full auth key | Legacy local message-bus API. Nothing in AgentMux calls it; its inject path runs the same signature check and marker |
| `/agentmux/reactive/poller/{config,status,stats}` | Full auth key | Legacy. `config` stores a URL and token, and nothing uses them: no poller runs |

The auth checks are `auth_middleware` and `lan_or_full_auth_middleware` in `crates/srv/src/server/mod.rs`.

**The full auth key** is the per-launch key every terminal pane and agent process receives as `AGENTMUX_AUTH_KEY`. Holding it is equivalent to being the AgentMux UI. See the [trust model](/security/trust-model/).

**The `lan_key`** is a second per-launch key (two random UUIDs). An instance with LAN discovery on broadcasts it in cleartext in its mDNS record and in replies to UDP discovery probes, so **anyone on the local network can obtain it**. It opens only the LAN-peer routes above. With it, a device on your LAN can:

- send a jekt to any agent on the instance. The message always arrives as `DELIVERY=lan`, whatever the request body claims;
- list the names and states of the instance's registered agents, and read one agent's registration: agent id, block id, tab id, UID, registration times, and its LAN public key;
- ask whether a given agent UID is running on the machine, and since when, in which channel and version;
- cause the instance to route a message it doesn't host onward, the same way a local send would: to other instances on the machine, to other LAN peers, and to MuxBus Cloud if the instance is signed in.

A message a LAN device sends is labelled `TRUST=network-claimed` unless it carries a valid LAN signature. Clean content still arrives at `TIER=coord`. That is, **with LAN discovery on, any device on the LAN can put text into your agents' conversations**, marked as an unverified network message.

## The trust marker

Every delivered message is wrapped in a marker that the receiving server computes. Its first line looks like this:

```
[JEKT:FROM=<sender> TO=<target> TIER=<tier> DELIVERY=<delivery> TRUST=<trust> MSGID=<id> PRIORITY=<priority> TS=<unix-seconds>]
```

with `HELD_FOR`, `INSTANCE`, `INSTANCE_STATUS`, `SIG`, `ESCALATE` and `FILES` added when they apply. The format, the escaping, and every rule below are specified in [Jekt protocol](/internals/jekt-protocol/#7-the-marker). For security, what matters is this:

- **`FROM` is a claim. `TRUST` says whether anything proved it.** `host-verified`, `channel-verified`, `lan-verified` and `wan-verified` mean a check passed (or, on the host tier, that the request carried the sending agent's own identity token). `unverified` means a check was possible and failed. `self-declared` and `network-claimed` mean nothing was checked. See [TRUST](/internals/jekt-protocol/#61-trust).
- **Sender text can't forge the marker.** Marker fields are limited to printable ASCII without spaces, `=`, `[` or `]`. The body is stripped of escape sequences and invisible characters, and anything in it that looks like a marker delimiter is rewritten to a `-QUOTED` form. See [Escaping and sanitizing](/internals/jekt-protocol/#72-escaping-and-sanitizing).
- **`TIER=sensitive` is forced** when a signature check failed (host on any tier, LAN, WAN or muxreview), when the sending install is revoked, when the sender uses a former agent id, when the sender declared it, when the body or a file name contains a credential or destructive keyword, or when the message is a transcript request. Lack of proof alone does not force it. See [TIER](/internals/jekt-protocol/#62-tier).
- **`ESCALATE=required`** tells the receiving agent to stop and ask a human, and that a confirming reply from another agent is not enough. **`ESCALATE=none`** appears only when no check failed and at least one verified. See [ESCALATE](/internals/jekt-protocol/#63-escalate).
- A failed cross-channel signature (`DELIVERY=channel`) is logged and prevents `ESCALATE=none`, but does **not yet** force the sensitive tier.

The marker is instruction text for the receiving agent. `ESCALATE=required` does not stop the agent from acting; whether it pauses depends on the agent following the instruction. The server-side parts are the labels, the tier, and a desktop notification with the fixed text "Open AgentMux to see the sender and trust level before it acts."

## Signing keys

`agentmux-mcp` signs every message an agent sends with `Message` with each key it has: the HMAC, LAN and cross-channel signatures. A WAN signature is made by the sending AgentMux server itself (see [WAN signing](#wan-signing)). The receiving server checks the one that fits the tier. The verification code is in `crates/common/src/jekt_sign.rs`. The HMAC and LAN key tables are in the instance's `objects.db`; WAN keys are in the channel's `wan.db` (see [WAN signing](#wan-signing)).

| Key | Scheme | Minted | Verified when | Lifetime |
|---|---|---|---|---|
| `AGENTMUX_JEKT_KEY` | HMAC-SHA256 | By AgentMux, per agent | On every request to the inject route, whatever its tier, whenever this instance holds a key for the claimed sender | The agent's MCP process fetches it with its identity token (`GET /agentmux/agents/self/keys`) at startup and again when it expires; a key older than 24 h is replaced on that fetch |
| `AGENTMUX_LAN_KEY` | Ed25519 private key | At the agent's first launch | `DELIVERY=lan` (against the sender's public key) and `DELIVERY=channel` (against the published copy) | Never rotated |
| The agent's WAN key | Ed25519 private key, certified by the install's instance key. Held only by AgentMux, never by the agent | At the agent's first launch, in the channel's `wan.db` (an older key from `objects.db` is carried over once) | `DELIVERY=wan`, for a sender on the same MuxBus Cloud account, once the key is published | Never rotated; kept across upgrades |
| muxreview `reagent-v1` | Ed25519, public key built into AgentMux | Held only by AgentMux's GitHub review-notification service | `DELIVERY=wan` | — |

Signatures cover the message id, sender, target, timestamp and body. Channel and WAN signatures also bind the sending channel (and, for WAN, the sending install's instance id), under their own domain prefix, so a signature from one tier can't be replayed on another. Freshness windows are 5 minutes for host and channel signatures, 10 minutes for LAN and muxreview signatures, and 35 minutes for WAN signatures (the relay's 30-minute delivery window plus 5 minutes; up to 5 minutes in the future).

The HMAC, LAN and WAN keys are keyed by agent name, not UID, and the name is compared ignoring case. A new agent whose name would differ from an existing one only in case gets a numbered name instead, and two older agents whose names differ only in case get no signing keys at all. The keys are deleted with the agent unless another agent still uses the name.

### Where the keys live

The agent's MCP server fetches its HMAC and LAN keys from AgentMux with its identity token (`GET /agentmux/agents/self/keys`, `crates/srv/src/server/agent_self_keys.rs`). As a fallback, AgentMux also writes them at every launch into the `mcpServers.agentmux.env` block of `.mcp.json` **in the agent's working directory** (`crates/srv/src/backend/agent_config.rs`). The WAN key is not written there: AgentMux signs WAN messages itself, and it removes a WAN key (`AGENTMUX_WAN_KEY`, `AGENTMUX_HOST_LABEL`) that an older version wrote. The file is written owner-only (`0600` on Unix) through a temporary file renamed into place. An existing `.mcp.json` is merged, not replaced: server entries AgentMux didn't write are kept, and the `agentmux` entry is always AgentMux's. A file that isn't valid JSON is left untouched, and the agent's MCP servers aren't written for that launch.

The default working directory is `~/.agentmux/agents/<slug>/`, which AgentMux excludes from git with a `*` rule in `~/.agentmux/.gitignore`. **If you point an agent at a project directory, AgentMux writes the agent's signing keys into that project's `.mcp.json`. Don't commit it: add `.mcp.json` to that project's `.gitignore`.**

### What a signature proves

A verified signature proves that the sender held the key, or, for WAN, that the sending install vouched for the agent its token named. Every key is stored in an AgentMux database, the HMAC and LAN keys also in the agent's `.mcp.json`, and any process running as your OS user can read both. That includes every agent, since agents run as your user and can read files. `host-verified`, `channel-verified`, `lan-verified` and `wan-verified` therefore protect against a sender that merely *claims* another agent's name. They do not protect against a same-user process, or an agent, that reads another agent's `.mcp.json` and signs with its keys. Nothing in this system can defend against that; see the [trust model](/security/trust-model/).

### LAN signing

The sender's public key is fetched from whichever LAN peer answers `GET /agentmux/reactive/agent?id=<sender>`. mDNS discovery is unauthenticated, so the first key seen for a name is **pinned** (`db_lan_peer_pubkey_pins`) and a later, different key for the same name is treated as a forgery. The first answer is trusted on first use: a device on the LAN that answers for a name before the real peer does has its own key pinned for that name.

### WAN signing

WAN signatures are checked only between installs signed in to the **same** MuxBus Cloud account. Each install (one per channel on a machine) has an instance keypair, created on first start and kept in `channels/<channel>/wan-identity/wan.db` together with its agents' WAN keys, so upgrades keep the same identity (`crates/srv/src/backend/storage/wan_identity.rs`). The instance id is derived from the instance public key: the first 128 bits of its SHA-256, as 26 base32 characters.

- **Publishing.** While you are signed in, the install certifies each agent's WAN public key with its instance key and publishes the record to the relay's key directory (`PUT /agents/<agent>/wan-key`, `crates/srv/src/muxbus/wan_publish.rs`). An unpublished key is retried every 5 minutes, or hourly while the relay has no key directory. A key counts as published per key directory, meaning per relay and account (`wan_agent_key_publications` in `wan.db`), so after you sign in to a different account, or the relay changes, the install publishes its keys again to the directory that hasn't seen them. Until it has, that agent's messages go out unsigned.
- **Sending.** The sending AgentMux signs the message itself, with the agent's key from `wan.db`, when it relays it, and only if all of these hold (`wan_sign_at_origin` in `crates/srv/src/muxbus/relay.rs`, `wan_signer` in `crates/srv/src/server/actor.rs`):
  - the request carried the agent's own identity token (`X-Agent-Token`), or is a scheduled job that agent created;
  - the token names the message's sender by its name, ignoring case, and no other agent on the install has a name that differs from it only in case (two such agents get no signing keys at all; a new agent whose name would differ only in case gets a numbered name instead);
  - this install is where the message started: a message forwarded from another install on the machine or the LAN carries no token and is never signed;
  - the agent's key is confirmed published.

  AgentMux sets every signed field except the message and its target: its own instance id and channel, its clock, and the message id. Otherwise the message is relayed unsigned and arrives `TRUST=network-claimed`. `muxsh agent send` run in an agent's own shell passes that agent's token and is signed; run in a terminal you opened, it carries no token and is not. In older versions the agent's MCP server signed WAN messages with its own copy of the key.
- **Receiving.** For a carried signature that the relay marks as same-account, the receiver checks the envelope and freshness, fetches the sender's key record from the directory (2-second timeout, at most 60 fetches a minute), checks that the instance key certified it, verifies the signature, and rejects a message id it has already delivered from that install and agent (`crates/srv/src/muxbus/wan_verify.rs`). A directory that is down or slow means "couldn't check", and the message is delivered as `network-claimed`.

`INSTANCE_STATUS` says what is known about the sending install:

| Status | Meaning | Effect |
|---|---|---|
| `approved` | This install itself. AgentMux has no control yet to approve another install | Counts as a verified sender: `ESCALATE=none` |
| `new` | Any other install on your account | Counts as a verified sender: `ESCALATE=none` |
| `revoked` | The relay holds a revocation for the install, signed with that install's own instance key (checked when the install is first seen, then at most hourly). AgentMux has no control yet to file one | Forced sensitive, `ESCALATE=required` |

Creating an install and publishing keys for it takes your MuxBus account login. Agents no longer receive that login in their environment (see the [trust model](/security/trust-model/#the-auth-key-is-in-every-pane)), so a `new` install is treated like any other verified sender (`crates/srv/src/backend/reactive/handler.rs`, `inject_message_inner`). The login is still stored on disk, though: a process running as your OS user can read it, or copy an install's `wan.db`, and sign as an install until it is revoked. That is a compromise of your machine, which nothing here defends against.

## Durable hold

When no tier can deliver a message to a known agent of this channel, the message is stored in `db_jekt_held` in the instance's `objects.db` (`crates/srv/src/backend/storage/jekt_held.rs`) and replayed when the agent registers. The replay loop also runs every 30 seconds:

- Held for up to **24 hours**, then deleted.
- At most **64** held messages per target agent, and **1,000** per channel (the instance). Past a cap, the send fails with `hold full`.
- The stored body is the sanitized, truncated text, kept in plaintext in the database.
- On replay, the trust verdicts from acceptance are reused, not re-checked (signatures expire after minutes). The marker shows the original `TS` and `HELD_FOR=<n>s`.
- A message the present agent refuses 20 times is dropped.
- Deleting the agent deletes its held messages.

Only requests authenticated with the full auth key are held. A LAN-key request never is.

## Audit log and limits

- Each instance keeps its last 100 delivery and registration events in memory, readable at `GET /agentmux/reactive/audit`. An entry records source, target, block, UID attribution, success or error, the message length plus a 64-bit hash, and, for a cloud-delivered message, the WAN verdict (instance, status, and why a signature didn't verify). The body is not stored, and the log is not persisted across restarts.
- Delivery is rate-limited to 10 messages per second per instance, across all senders.

## The WAN tier: MuxBus Cloud

The WAN tier is AgentMux's hosted MuxBus service. It is off until you sign in with the **MuxBus Cloud** control in the host popover (click the hostname in the status bar). After sign-in, the instance keeps a WebSocket open to `wss://muxbus-ws.agentmux.ai` for wake signals, fetches pending messages from `https://muxbus.agentmux.ai`, and relays outbound messages there. The relay stores message bodies and sender names so that it can forward them; they travel over TLS and are readable by the service. Signed out, the instance makes no MuxBus connections. There is no setting to point the desktop app at a different relay.

The relay also keeps one lease per agent name, so only one instance pulls an agent's messages at a time: a pull or acknowledgement from an instance that doesn't hold the lease gets HTTP 409 (see [one live instance per agent](/security/trust-model/#one-live-instance-per-agent)).

Two kinds of WAN message carry a signature the receiver verifies: muxreview's (`SIG=`), and those from agents on another install signed in to the same MuxBus Cloud account (`TRUST=wan-verified`, see [WAN signing](#wan-signing)). Any other `FROM=` on a WAN message is unverified.

## What it takes to drive your agents

| Path | What the attacker needs |
|---|---|
| Local API | The instance auth key: be a process in an AgentMux pane, read it from such a process's environment, or read `authkey.dev` from the data directory. Any process running as your user can do each of these, and, while it is turned on, processes of other users can get it through the [remote-debugging port](/security/network-exposure/#chromium-remote-debugging-port). |
| Another instance on this machine | That instance's auth key, from `~/.agentmux/agents/` or `~/.agentmux/shared/agents/reactive/` (mode `0600` on Unix). Same boundary: your OS user. |
| LAN | Nothing beyond network access while LAN discovery is on: the `lan_key` is broadcast. Messages arrive as `DELIVERY=lan`, `TRUST=network-claimed`. |
| WAN | A message that MuxBus Cloud accepts for your agent. Who may send one is decided by the service, not by the desktop app. Messages arrive as `DELIVERY=wan`, `TRUST=network-claimed`, unless they carry a verified same-account signature (`TRUST=wan-verified`). |
| Forging an agent's name | Detected, forced sensitive and marked `ESCALATE=required` only when a key for that name exists and the check fails: this instance holds its HMAC key, a LAN public key is found for it, or a same-account WAN signature is carried and fails. A name with no key anywhere (a bridge's, or a made-up one), or an unsigned WAN message, arrives as `self-declared` or `network-claimed` and is not flagged. Anyone holding the agent's keys, which any same-user process can read, can sign as it. |

---

**Source-of-truth references**:
- `crates/srv/src/server/reactive.rs` — `deliver` (tier order), `verify_jekt_signature`, `verify_reagent_signature`, `verify_lan_signature`, `verify_cross_channel_signature`, `resolve_transcript_request_tier_fields`, `hold_for_absent_target`, `try_cloud_relay`
- `crates/srv/src/backend/reactive/handler.rs` — target resolution, recipient verification, the forced-sensitive and `ESCALATE` rules
- `crates/srv/src/backend/reactive/sanitize.rs` — `wrap_jekt_message`, `marker_field`, `neutralize_markers`, keyword lists
- `crates/srv/src/server/mod.rs` — `lan_forward_routes`, `auth_middleware`, `lan_or_full_auth_middleware`
- `crates/common/src/jekt_sign.rs` — signature schemes and the muxreview key allow-list (`is_reagent_trusted_signing_key`)
- `crates/srv/src/backend/storage/agent_jekt_keys.rs` — 24 h HMAC key rotation
- `crates/srv/src/backend/agent_config.rs` — `inject_jekt_signing_keys_into_mcp_json`
- `crates/srv/src/backend/storage/jekt_held.rs`, `crates/srv/src/server/jekt_held.rs` — durable hold and replay
- `crates/srv/src/backend/lan_discovery.rs` — LAN key advertisement and public-key lookup
- `crates/srv/src/muxbus/cloud_subscriber.rs`, `crates/srv/src/muxbus/relay.rs` (`wan_sign_at_origin`), `crates/srv/src/muxbus/wan_lease.rs` — MuxBus Cloud
- `crates/srv/src/muxbus/wan_verify.rs`, `crates/srv/src/muxbus/wan_publish.rs`, `crates/srv/src/backend/storage/wan_identity.rs` — WAN signing
- `crates/srv/src/server/agent_takeover.rs` — `/agentmux/agent/holding` and `/agentmux/agent/release`
- `crates/mcp/src/identity.rs` — `sign_outgoing_jekt`; `crates/mcp/src/tools/fleet.rs` — the `Message` `send` handler

**Related**: [Interagent communication](/internals/interagent-comms/), [Trust model](/security/trust-model/), [Network exposure](/security/network-exposure/).
