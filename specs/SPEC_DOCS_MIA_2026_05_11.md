# SPEC — Docs MIA (missing-in-action)

**Date:** 2026-05-11
**Author:** agent1
**Status:** draft (pending review)
**Companion:** `/workspace/SECURITY_AUDIT_2026_05_11.md` (the audit this gap analysis is drawn from)

---

## Problem

The 2026-05-11 security audit (`/workspace/SECURITY_AUDIT_2026_05_11.md`) surfaced a wider issue than the security findings themselves: AgentMux has a non-trivial security posture (intentional architectural choices around credential handling, network exposure, supply-chain integrity, telemetry, updates, sandboxing) that is **invisible to users** because it isn't documented anywhere.

This shows up three ways:

1. **Marketing makes claims docs can't substantiate.** `agentmux.ai` says "zero telemetry," "data sovereignty," "shadow AI prevention," "audit trails." A reader who clicks through to `docs.agentmux.ai` finds none of these substantiated — there's no architecture-level page that explains *what* runs locally, *what* leaves the machine, or *under what conditions*.
2. **Enterprise / IT evaluators can't get to "yes."** The trust/governance pitch has no docs counterpart. A security-review checklist (network ports, file permissions, credential storage, update model) cannot be filled in from the current docs without reading source.
3. **Users can't make informed decisions about local trust.** The audit found that several sidecar endpoints implicitly trust "local process" (Criticals C1/C2/C3 in the app). Even after those are fixed, users on shared machines, dev containers, or CI agents need to know *what AgentMux's trust model actually is* so they can run it safely. Today there is no page describing this.

The gap is in the docs, not in the product. The product has all the right behaviors. Users can't tell.

---

## Goal

Add a coherent "Security & posture" docs section that:

- Documents the trust boundaries AgentMux actually relies on.
- Itemises what stays local vs. what leaves the machine.
- Explains how identities, credentials, and tool downloads are handled.
- Describes the update model (manual, SHA-pinned).
- Surfaces the network exposure profile (ports, interfaces, auth).
- Gives the reactive event bus / agentbus / inter-instance comms a single canonical page.

Cross-cutting outcomes:

- An evaluator can do a security review of AgentMux **without reading source code**.
- Marketing claims on `agentmux.ai` can be linked one-click into a substantiating docs page.
- The terminology (memory, identity, block, pane, jekt, message, swarm, subagent) is fixed in a glossary.

## Non-goals

- Don't document specific unfixed vulnerabilities. Where current behavior is being tightened by ongoing security work (audit Criticals C1/C2/C3 and the H-tier findings), the relevant page **must wait until the fix lands** — otherwise docs publish a falsified trust model. Each affected page below lists its **gating PR(s)**.
- Don't replace `/internals/architecture` with security content. Security pages sit alongside, not on top.
- Don't auto-generate these from source. Most of these pages are stable narrative; auto-gen reduces care.
- Don't add a "compliance" page in this scope. Compliance posture is part-marketing, part-legal, part-engineering — wrong owner mix for this round.

---

## Approach

### Sidebar reorganisation

Add a new top-level section **Security & posture** between **Internals** and **API reference**. The current sidebar is:

```
User Guide
Internals
  ├── Architecture (incl. interagent comms)
  ├── Building
  ├── API reference
```

Proposed:

```
User Guide
Internals
  ├── Architecture (incl. interagent comms)
  ├── Building
Security & posture           ← new section
  ├── Trust model
  ├── Data sovereignty
  ├── Identity & credential storage
  ├── Network exposure
  ├── Update model
  ├── Reactive event bus
API reference
  ├── Agent App API (existing; gains a "permission boundary" subsection)
  ├── TypeScript API
  ├── Rust Crates
```

Six new pages, one enhancement to an existing page.

### Source-of-truth pointers

Each new page below names the file(s) in `/workspace/agentmux` (or this repo) that are the canonical reality the page documents. When those change, the page must be updated. We will NOT auto-generate from these, but we will link to them in the page header so future maintainers can verify the page against current code.

### Style consistency

Match the existing internals pages (`/internals/architecture`, `/internals/reducer-stack`, `/internals/wrr`) — long-form prose, ASCII diagrams where useful, no excessive headers, links into code via the rustdoc/typedoc references. Frontmatter format identical to current internals pages.

### Dependency on the security work

The Critical/High audit findings change the *factual content* of several proposed pages. Documenting current-state behavior for those pages would publish a known-broken security posture. The dependency tree below lists which pages can ship immediately vs. which gate on a security PR landing first.

```
Ship now (no audit-gated content):
  • Trust model (high-level, doesn't depend on specific endpoint behavior)
  • Update model
  • Data sovereignty (mostly already-true behavior)
  • Glossary

Ship after C1+C2 fix (agentmux-srv reactive routes under auth_middleware):
  • Reactive event bus  ← page would otherwise lie about /agentmux/reactive/* auth

Ship after C3 fix (strict CORS origin allow-list + drop query-string authkey):
  • Network exposure   ← page would otherwise lie about CORS posture

Ship after H2 fix (readeditorfile path restriction):
  • Identity & credential storage  ← related discussion of file-read trust surface

Ship after Agent App API permission work (no PR yet):
  • Agent App API permission boundary subsection
```

We intentionally separate the docs work so it can run in parallel with security PRs and merge as fixes land.

---

## Pages

### Page 1 — `/security/trust-model`

**Audience:** evaluators, IT teams, anyone running AgentMux on a non-personal machine.
**Owner:** TBD.
**Gating:** none (architectural overview, can ship immediately).

**What goes on the page:**

- The three processes (`agentmux-launcher`, `agentmux-cef`, `agentmux-srv`) and the trust relationship between them. Launcher spawns srv and cef and holds the IPC auth-key. Srv is the sidecar; cef is the frontend host.
- Trust boundaries:
  - The user. AgentMux runs as the logged-in user with full user privileges. No privilege escalation; no setuid.
  - Local processes on the same machine. **Not trusted as a class** — sidecar enforces auth on every endpoint. Same-user processes on a non-shared machine are practically trusted because they could read the auth-key off disk; on a shared machine they are not.
  - Agent processes (Claude Code, Codex, Gemini, etc.). These are sub-trusted: they run as the user but are not given access to the IPC bridge or sidecar auth-key beyond the well-defined Agent App API.
  - Network. AgentMux binds 127.0.0.1 only by default. No inbound network listener accepts non-localhost connections without explicit user action (mDNS at `0.0.0.0:5353` is opt-in).
  - The CEF browser pane. Loads user-chosen URLs in a sandboxed renderer. JS in the pane cannot reach the IPC bridge.
- What this means for the user:
  - On a personal machine: no extra hardening needed.
  - On a shared multi-user machine: the user's `~/.agentmux/authkey.dev` (0600) is the boundary. A co-user with root or sudo bypasses it; standard threat-model reality.
  - On a CI / agent runner: AgentMux is not designed to be run as a service; document this.
  - On a Codespace / cloud dev environment: the localhost-only bind protects against external reach but not against other processes in the same container.
- What AgentMux explicitly does **not** protect against (be honest):
  - A malicious agent process the user explicitly launches and grants API access to.
  - A malicious shell command typed into a terminal pane.
  - A compromised LLM provider returning malicious content (the agent layer's responsibility, not AgentMux's).

**Anti-scope:**
- Don't list every endpoint here — that's the Network exposure page.
- Don't itemise credential storage details — that's the Identity & credential storage page.

**Source-of-truth pointers:**
- `agentmux-launcher/src/srv_spawner.rs:112` — auth-key generation
- `agentmux-cef/src/dev_authfile.rs:99-218` — auth-key file ACLs
- `agentmux-srv/src/server/mod.rs:97-162` — CORS + auth middleware
- `agentmux-srv/src/main.rs:476-481` — sidecar bind

**Length target:** 700-1000 words plus one ASCII diagram of the three-process model.

---

### Page 2 — `/security/data-sovereignty`

**Audience:** evaluators, privacy-sensitive users, anyone evaluating "what leaves my machine?"
**Owner:** TBD.
**Gating:** none (current behavior is already factual).

**What goes on the page:**

- The "zero telemetry" claim, explicit: AgentMux itself makes no outbound HTTP calls to any AgentMux-controlled endpoint. No analytics, no usage pings, no crash reporting, no version checks. (Verified by the security audit; reference `agentmux-srv/src/backend/tool_store.rs:362-374` as the only outbound HTTP path, and explain it.)
- What stays local: sessions, messages, prompts, file contents read by agents, terminal output, identity tokens, workspace layout, all SQLite data. Listed by file/directory: `~/.agentmux/`, `~/.agentmux/state.db`, workspace-local files.
- What leaves the machine — and when:
  - **LLM API traffic.** When an agent runs, the agent's CLI (Claude, Codex, etc.) makes HTTPS calls to the respective provider. AgentMux does not intercept or proxy these. Document that AgentMux is *not* in the data path for LLM calls.
  - **Tool downloads.** When the user installs a tool via the tool store, the binary is fetched from a SHA-pinned URL. List the SHA-pin model.
  - **MCP server connections.** Whatever the user configures their MCPs to talk to.
  - **Cross-instance forwarding via agentbus poller** (opt-in; defaults off; explain how to turn it on and what it sends).
  - **mDNS discovery** (opt-in; disabled by default; documents the LAN-broadcast posture).
- A clear list of "things AgentMux specifically does **not** do":
  - No automatic update checks.
  - No crash reporting.
  - No usage analytics.
  - No license-server check-in.

**Anti-scope:**
- Don't go into IPC auth-key details here — that's Trust model.
- Don't reproduce the privacy policy from `agentmux.ai/privacy`. Link to it.

**Source-of-truth pointers:**
- `agentmux-srv/src/backend/tool_store.rs:362-395` — tool download path + SHA pinning
- `agentmux-srv/src/server/reactive.rs:50` — cross-instance forwarding
- `agentmux-srv/src/main.rs:493-514` — mDNS opt-in default-off

**Length target:** 600-900 words.

---

### Page 3 — `/security/identity-credential-storage`

**Audience:** evaluators, security-conscious users running multiple identities (work / personal / demo).
**Owner:** TBD.
**Gating:** **partial** — the page can describe the *current* SecretRef model (Env / SecretsManager / debug-only Plaintext) immediately. The "trust boundary around `readeditorfile`" caveat must wait until **H2** lands.

**What goes on the page:**

- What an Identity bundle is, at the *data* level (the existing `/identity/` page covers the feature; this page covers the security model).
- `SecretRef` variants and what each means at rest:
  - `Env` — credential resolved from the environment at agent-launch time. Never persisted by AgentMux. Lifetime: the user's shell session.
  - `SecretsManager` — *future*; reserved enum variant, not implemented in current release. Reference the implementation status honestly.
  - `PlaintextDev` — debug builds only. `cfg(debug_assertions)`-gated. In a release build, attempting to use this variant is a hard error at resolve time. Reference the audit's I3 finding.
- Where Identity bundle *metadata* (provider, key name, scope) is stored: `~/.agentmux/state.db` (SQLite). File mode and ownership.
- How credentials flow into agent processes: `cmd:env` injection (post-H3 fix: with env-var allow/deny list); no shell wrapping; no plaintext logging.
- Log redaction: AgentMux logs only the env-var *name* and the provider, never the value (reference the audit's I3).
- Rotation guidance: how to update a SecretRef without losing the bundle.

**Anti-scope:**
- Don't describe the UI flow for creating an identity — that's `/identity/`.
- Don't describe MCP-server credential handling here — that's MCP's own responsibility; link to it.

**Source-of-truth pointers:**
- `agentmux-srv/src/backend/storage/wstore.rs:1010-1024` — `SecretRef` enum
- `agentmux-srv/src/backend/identity/resolver.rs:76-86` — `cfg(debug_assertions)` gate
- `agentmux-srv/src/backend/blockcontroller/subprocess.rs:324-327` — env injection (post-H3-fix details here)

**Length target:** 800-1200 words.

---

### Page 4 — `/security/network-exposure`

**Audience:** IT teams, network admins, firewall configurators.
**Owner:** TBD.
**Gating:** **C3 fix** must land first. Documenting current behavior would publish `Access-Control-Allow-Origin: *` and the `?authkey=` query-string fallback as if they were intentional posture. They are not; both are tracked for removal.

**What goes on the page:**

- A table of every port AgentMux binds, with: process, interface (always `127.0.0.1` by default unless noted), purpose, auth required, opt-in/default.
- The sidecar HTTP/WS listener: per-launch port (random ephemeral), 127.0.0.1-only, `auth_middleware` on every route (post-C1+C2 fix), strict origin allow-list (post-C3 fix).
- The CEF host's embedded IPC server (separate from the sidecar): same posture, bearer-token gated.
- mDNS: `0.0.0.0:5353`, opt-in, disabled by default. Document how to enable it and what it broadcasts.
- Outbound: enumerated in the Data Sovereignty page; cross-link.
- Firewall config: AgentMux requires *no* inbound firewall rule by default. Cross-process IPC is all loopback.
- DNS rebinding: explicit note that 127.0.0.1-only bind does **not** protect against DNS rebinding attacks targeting localhost from a malicious web page in the user's browser. The post-C3-fix CORS allow-list is what closes that vector.

**Anti-scope:**
- Don't describe what each endpoint does in detail — that's the Agent App API / Reactive event bus pages.

**Source-of-truth pointers:**
- `agentmux-srv/src/main.rs:476-481, 493-514` — sidecar + mDNS bind
- `agentmux-srv/src/server/mod.rs:97-110` — CORS posture (post-C3-fix)
- `agentmux-cef/src/ipc.rs:78-95` — CEF host IPC server

**Length target:** 600-900 words plus a port table.

---

### Page 5 — `/security/update-model`

**Audience:** all users; especially security-conscious users and air-gapped/enterprise deployments.
**Owner:** TBD.
**Gating:** none (current behavior is final and intentional).

**What goes on the page:**

- AgentMux does not auto-update. Verified: no update endpoint in launcher, no version-check on launch, no background fetch. Reference the audit's I5 / I28.
- How updates actually happen: manual download from `agentmux.ai`, SHA-256 published in `release.json`, optional verification step in the docs.
- The release pipeline (light touch): how `release.json` is built, how SHA-256 is computed, where the GitHub release artifacts come from.
- Tool downloads (separate from app updates): SHA-pinned in the catalog (`tool_store.rs:380-395`). A new tool version requires a catalog update; the user is never asked to trust an arbitrary download URL.
- Air-gapped operation: AgentMux runs without internet. Only LLM API calls require network. List the network-dependent features (agent CLIs, MCP servers, tool downloads) and which can be pre-staged offline.
- What the user has to do to stay current: subscribe to the GitHub releases atom feed, or check `agentmux.ai/download` periodically. (Be explicit: no notification system.)

**Anti-scope:**
- Don't claim "secure update mechanism" — the mechanism is **deliberately manual**. Frame this as the security posture, not a missing feature.

**Source-of-truth pointers:**
- `agentmux-landing/public/release.json` — release manifest
- `agentmux-srv/src/backend/tool_store.rs:380-395` — SHA-pinning
- Absence of any update endpoint in the launcher/sidecar (negative finding from audit)

**Length target:** 500-700 words.

---

### Page 6 — `/security/reactive-event-bus`

**Audience:** anyone using inter-agent communication; integrators; advanced users.
**Owner:** TBD.
**Gating:** **C1 + C2 fix** must land first. Currently `/agentmux/reactive/*` is unauthenticated; the page would otherwise misrepresent the security model.

**What goes on the page:**

- What the reactive event bus is: the cross-pane and cross-instance message bus. Distinct from the in-process Tokio channels used inside the sidecar.
- The two delivery models: **jekt** (immediate terminal injection) vs **message** (mailbox / async). Cross-link to the MCP tools that drive them.
- The endpoint surface (post-C1+C2 fix, with auth):
  - `POST /agentmux/reactive/inject` — fan-out to the named agent's PTY/stdin.
  - `POST /agentmux/reactive/poller/config` — configure the cloud agentbus poller URL/token. Auth-gated; explain the trust boundary it crosses.
  - `GET /agentmux/reactive/poller/status` — observation only; tokens redacted (post-fix).
- The agentbus poller, in narrative form: how messages flow from the cloud agentbus into a local agent's PTY. Explicit note that the cloud agentbus is an **opt-in** feature; default is off.
- The cross-instance forwarding model: AgentMux instances on the same machine discover each other via a local file registry (`~/.agentmux/instances/`) and forward messages on 127.0.0.1.
- How to disable cloud agentbus entirely (config flag, env var, whatever the actual switch ends up being).

**Anti-scope:**
- Don't reproduce the message schema in detail — link to the typedoc/rustdoc reference.
- Don't describe MCP tools here — those live under their own MCP docs.

**Source-of-truth pointers:**
- `agentmux-srv/src/server/reactive.rs` — all endpoints
- `agentmux-srv/src/backend/reactive/handler.rs:179-280` — `inject_message`

**Length target:** 800-1100 words plus one ASCII diagram of the message flow.

---

### Page 7 — `/internals/agent-app-api` (enhancement)

**Audience:** agent / pane-type authors; security evaluators.
**Owner:** TBD.
**Gating:** can ship a "current state" version immediately; should be revised when an Agent App API permission model lands (no PR exists for that yet — track separately).

**What's added:**

- A new "Permission boundary" subsection, honest about current state:
  - Today, the API gives an authenticated agent broad access (spawn panes, mutate workspace state, send messages). The audit found that *agent processes are sub-trusted by trust-model design but not by code*.
  - This is documented as a known limitation, not a feature. Future work tracked in (issue link TBD).
  - Concrete advice for now: agents you don't trust should not be granted the Agent App API. Default-deny.

**Anti-scope:**
- Don't claim a sandbox that doesn't exist.

**Source-of-truth pointers:**
- `agentmux-srv/src/server/app_api.rs` — current API surface
- (Future) the permission-model PR when one is opened.

---

### Page 8 — `/glossary` (small but useful)

**Audience:** all users.
**Owner:** TBD.
**Gating:** none.

**What goes on the page:**

A flat list, alphabetical:

- **agentbus** — the cross-process/cross-machine message bus. Two delivery models: jekt and message.
- **block** — an immutable persisted unit of pane state (terminal output, code block, diff, message). Layered structure with reducer-driven mutations.
- **identity (bundle)** — named credential set bound to an agent at launch. Mappable across Memory bundles.
- **jekt** — verb. Inject a message directly into a target agent's terminal. Synchronous delivery, immediate processing.
- **memory (bundle)** — agent personality + capability stack: provider, model, instructions, MCP servers, skills, env. Reusable across launches.
- **message** — verb. Deliver to the recipient's mailbox; read when convenient. Asynchronous.
- **pane** — a UI slot in the workspace layout. Terminal, agent, code editor, browser, swarm, etc.
- **reducer stack** — the layered state model: launcher / host / sidecar / frontend slices each owning a slice of state, dispatched in order.
- **subagent** — an agent spawned by another agent (Claude Code can spawn helpers; the Subagent Watcher tracks these).
- **swarm** — multi-agent orchestration view; lists active and completed sub-agents.
- **WRR (Window Reality Reconciliation)** — the launcher's loop that reconciles desired window state against actual OS state.

Cross-link each term to its primary docs page.

**Length target:** as long as it needs to be; will grow.

---

## Sequencing

**Wave 1** (can start immediately, no security dependency):
- Trust model
- Data sovereignty
- Update model
- Glossary
- Agent App API permission boundary subsection (honest about current state)

**Wave 2** (after C1+C2 fix lands — see audit):
- Reactive event bus
- Identity & credential storage (most of it can ship in Wave 1; the readeditorfile note waits)

**Wave 3** (after C3 fix lands):
- Network exposure

Each wave is roughly one PR worth of content. Pages within a wave can ship in parallel if multiple people have time.

---

## Cross-cutting concerns

### Style

Match `/internals/architecture` and `/internals/reducer-stack`:
- First-person plural ("we") used sparingly; prefer plain declarative.
- ASCII diagrams where they earn their keep; not for every page.
- No marketing language. The marketing claim goes on `agentmux.ai`; the docs page substantiates it.
- Cross-links to source files using the deployed `/api/rust/` and `/api/typescript/` references.

### Terminology consistency

The glossary is the source of truth. Existing pages that drift should be updated as part of this work:
- `/memory/` — confirm we say "Memory bundle", not "Forge agent".
- `/identity/` — confirm we say "Identity bundle", not "credential set" (or both, with glossary canonicalizing).
- `/internals/interagent-comms` — rename internal references from "interpane" to "interagent" (already done in URL; double-check copy).

### Source-of-truth pointers in page headers

Each page header should include a stable "Source" line at the bottom, listing the canonical files in `agentmuxai/agentmux` that the page describes. This lets a future maintainer verify against current code. Pattern:

```md
---
Source: `agentmux-srv/src/server/mod.rs`, `agentmux-srv/src/backend/identity/resolver.rs`
Last verified against agentmux@<sha> — <date>
```

### Marketing → docs linkage

After Wave 1 lands, file an `agentmux-landing` follow-up to add deep links from marketing claims:
- `agentmux.ai` "zero telemetry" → `/security/data-sovereignty`
- `agentmux.ai` "data sovereignty" → `/security/data-sovereignty`
- `agentmux.ai` "shadow AI prevention" → `/security/trust-model#agent-processes`
- `agentmux.ai` "immutable audit trail" → `/internals/reducer-stack` (extend with audit-trail subsection if not already there)

This is a separate PR in the landing repo; tracked here for visibility.

---

## Open questions

1. **Page-7 honesty.** The Agent App API page would have to disclose that "agents are sub-trusted by design but not by code." That's a real gap, currently honest, but exposing it in docs raises pressure to do the permission-model work. Acceptable? (Recommended: yes — honest docs > comfortable docs.)
2. **Update Model framing.** Some users will read "no autoupdate" as a missing feature. Recommend framing it as a deliberate security posture in the page intro to head off the wrong reading. Alternative: rename page to "Manual update model" so the choice is signalled in the URL. Pick one.
3. **mDNS docs.** Worth a top-level page, or a section under Network Exposure? (Recommend: section, not page. Low audience.)
4. **Where to land the security pages in the file tree?** Either `src/content/docs/security/*.md` (matches URL) or `src/content/docs/security.md` index + subdirs. Recommend the directory approach for room to grow.

---

## Out of scope (deferred)

- **Compliance posture page** (SOC 2 / ISO 42001 / EU AI Act readiness). Cross-functional, needs legal sign-off. Track separately.
- **Enterprise deployment guide.** Touches on licensing, install paths, SSO/SAML (none of which exist yet). Worth a page when there's something to install enterprise-wide.
- **Threat models for specific deployment topologies** (CI runner, multi-tenant dev container, codespace, cloud workstation). Each is a real document; out of scope for this round. Should be linked from Trust model when written.
- **Auto-generation of port tables / API surface tables from source.** A nice-to-have; not in scope. The pages are manually maintained for now with `Last verified against` markers.
- **Glossary auto-cross-linking** (replace term mentions with linked text site-wide). Doable with a remark plugin; not in scope.

---

## Approval & next steps

If approved:

1. Open a tracking issue listing all 6 pages + glossary + Agent App API enhancement.
2. Wave 1 PR: Trust model + Data sovereignty + Update model + Glossary + Agent App API permission-boundary section. One PR, four-and-a-half new pages.
3. Wave 2 + Wave 3 PRs filed when the gating security fixes merge (audit Criticals C1/C2/C3 + High H2).
4. Marketing-linkage follow-up PR in `agentmux-landing` after Wave 1.

Estimated effort: Wave 1 ~ 1-2 days of focused writing for one person. Waves 2/3 ~ half a day each.
