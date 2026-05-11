---
title: "Trust model"
description: "What AgentMux protects against, what it doesn't, and the trust boundaries it relies on."
---

AgentMux is a desktop application that runs as the logged-in user, with no privilege escalation, no setuid, and no system service. Its security posture flows from that starting point. This page documents the trust boundaries the product actually relies on so you can decide whether the defaults suit your deployment.

## The processes and what they trust

AgentMux runs four processes coordinated by a single launcher — see [Architecture overview](/internals/architecture/) for the full topology. The trust relationship between them is:

| Boundary | Trust | Mechanism |
|---|---|---|
| Launcher ↔ sidecar | Mutual | Launcher generates a per-launch UUIDv4 auth key, passes it to the sidecar via env var, and shares it with the CEF host via a 0600 file. |
| CEF host ↔ sidecar | Authenticated | Host presents the auth key in the `X-AuthKey` header on every WebSocket / HTTP call to the sidecar. |
| CEF renderer (your UI) ↔ CEF host | Bearer token | Frontend reads a one-shot bearer token at startup and presents it on the host's IPC HTTP server. |
| Agent processes ↔ sidecar | Sub-trusted | Agents run as the user but are not given the sidecar auth key. They reach the [Agent App API](/internals/agent-app-api/) over a separate, narrower surface. |
| Local non-AgentMux processes ↔ sidecar | **Not trusted** | Every endpoint requires the auth key. Localhost is not a trust boundary on its own. |

The shorthand is: *the user is trusted; everything else needs to present a key.*

## What AgentMux protects against

- **Other users on the same machine.** The auth key file is owner-only (Unix mode `0600`; on Windows a protected DACL with a single ACE for the user). Another user on the box cannot read it. They also cannot reach the sidecar over the network because it binds 127.0.0.1 only.
- **Inbound network connections.** AgentMux opens no inbound network listener that accepts non-localhost traffic by default. mDNS discovery on `0.0.0.0:5353` is opt-in and disabled out of the box.
- **Drive-by web pages reaching localhost via the browser.** The sidecar enforces an origin allow-list reflecting the CEF frontend's exact origin; a page in any other browser the user happens to have open cannot drive AgentMux even if it discovers the port.
- **Replay of leaked auth keys.** Each launch generates a fresh UUIDv4 auth key. A key from a previous session is rejected.
- **Tampered tool downloads.** The optional tool catalog SHA-pins every binary AgentMux fetches on the user's behalf; a download whose hash doesn't match the catalog is discarded. See [Update model](/security/update-model/).
- **Plaintext credentials at rest.** Identity bundles store *references* to credentials (env-var names or future Secrets Manager entries), not values. See [Identity & credential storage](/security/identity-credential-storage/).

## What AgentMux does not protect against

Be honest about what's out of scope:

- **A user who has chosen to run a malicious agent CLI.** Once you launch an agent, that agent has every permission the user has. AgentMux gives you visibility into what it does (every tool call is captured) but does not sandbox the agent process itself.
- **A user who pastes a malicious shell command into a terminal pane.** Terminal panes are real PTY sessions running your real shell. They are exactly as safe as your shell is.
- **A malicious LLM provider returning malicious content.** The agent CLI talks directly to its provider; AgentMux is not in the data path. If your provider returns instructions to run `rm -rf ~`, the agent's safety policies — not AgentMux — are what stop it.
- **A co-user with root or sudo on a shared machine.** Root can read any file, including the auth key. AgentMux is not designed for hostile-multi-tenant deployments.
- **Side channels in shared dev containers.** A Codespace, dev container, or CI runner where another process can attach to your PID or read `/proc/<pid>/environ` defeats the localhost-bind boundary.
- **Compromised dependencies pulled by the agent itself.** When an agent runs `npm install`, the integrity of those packages is npm's problem, not AgentMux's.

## Posture by deployment

- **Personal machine.** Defaults are appropriate. No extra hardening needed.
- **Shared multi-user workstation.** AgentMux is designed for this; the auth-key ACLs are the boundary. The risk is a co-administrator (root / sudo / Domain Admin) who can read user-owned files. If that's part of your threat model, AgentMux alone won't help — you need OS-level isolation.
- **Codespace / cloud dev environment.** Safe so long as the codespace is single-user. If another process in the same container is untrusted, the local-process boundary leaks. Use a dedicated codespace per user.
- **CI / agent-runner.** Not a supported deployment topology. AgentMux is an interactive workstation tool; running it as a service exposes you to threats it isn't designed to handle.
- **Air-gapped network.** Fully supported. AgentMux has no required outbound network calls — see [Data sovereignty](/security/data-sovereignty/).

## Reporting issues

If you find a security issue, please report it privately rather than opening a public issue. Email the maintainers (see the project README on GitHub for the current address) and include reproduction steps. We'll coordinate disclosure on a sensible timeline.

---

**Source-of-truth references** *(verify against current code if these change)*:
- `agentmux-launcher/src/srv_spawner.rs` — auth-key generation
- `agentmux-cef/src/dev_authfile.rs` — auth-key file ACLs (Unix + Windows)
- `agentmux-srv/src/server/mod.rs` — CORS + auth middleware
- `agentmux-srv/src/main.rs` — sidecar bind (`127.0.0.1` only; mDNS opt-in)
