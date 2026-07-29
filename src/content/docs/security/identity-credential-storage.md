---
title: "Identity & credential storage"
description: "Where Identity bundle credentials live, how they reach agent processes, and what the audit trail looks like."
---

The [Identity bundles](/identity/) page covers the *feature* — what they are, how to create them, how to assign them at launch. This page covers the *security model* — where the data lives at rest, how it flows into agent processes, and what an evaluator can verify.

## SecretRef — the storage abstraction

A credential in AgentMux is always represented by a `SecretRef` — a *pointer* to the credential, not the value itself. There are three variants:

### `Env` — environment variable lookup

The credential lives in the user's shell environment. AgentMux stores only the **name** of the variable (`GH_TOKEN`, `AWS_PROFILE`, `ANTHROPIC_API_KEY`, etc.) in the bundle. At agent-launch time, the sidecar reads the value from its own environment and injects it into the agent process.

This is the default and recommended option. The credential never touches disk via AgentMux. Lifetime is the user's shell session.

### `SecretsManager` — AWS Secrets Manager

Reserved for future use. The enum variant exists; the resolver is not yet implemented in shipped releases.

When wired up, the bundle will store the secret ARN; AgentMux will fetch the value at agent-launch time using the user's ambient AWS credentials, inject it into the agent process, and not persist it.

### `PlaintextDev` — plaintext, debug builds only

For local development convenience. Stores the credential value directly in `store.db` (the account-wide SQLite store under `~/.agentmux/shared/`). **`cfg(debug_assertions)`-gated** — calling this variant in a release build is a hard error at resolve time, not a silent fallback.

If you build AgentMux from source for development, this variant works; the binary releases on `agentmux.ai/download` do not allow it.

## What's in the database

`store.db` (the account-wide SQLite store under `~/.agentmux/shared/`) contains, for each Identity bundle:

- Bundle name and description
- Per-provider account list (provider class + display name)
- For each account: the `SecretRef` (variant + reference data — env-var name or future ARN)
- Created/updated timestamps

**What's not in the database:**

- Token values for `Env` and (future) `SecretsManager` variants — they're never persisted.
- Token values for `PlaintextDev` — present, but only in debug builds.

The database file inherits its permissions from the user's data directory. On Unix, the data directory is mode `0700` (owner-only). On Windows, default ACLs restrict access to the owning user.

## How credentials reach agent processes

At launch time, the spawn flow is:

1. The user picks a Memory + Identity in the Launch Agent modal.
2. The sidecar resolves the Identity's `SecretRef`s to actual credential values:
   - `Env` → read from `std::env::var(name)` in the sidecar's environment.
   - `SecretsManager` → fetch from AWS (when implemented).
   - `PlaintextDev` → read from the database (debug only).
3. The sidecar computes the per-provider environment variables the agent CLI expects (`GH_TOKEN`, `AWS_PROFILE`, etc.).
4. The agent process is spawned with those env vars set; nothing else from the Identity bundle is exposed.
5. After spawn, the resolved values are dropped from memory.

The credential is never:

- Written to a temp file.
- Passed on a command line (where it would show in `ps`).
- Echoed in logs.

## Log redaction

AgentMux logs the *names* of credentials it resolves (so you can debug which Identity an agent ran with) but never the *values*. Specifically:

- The log line for a successful resolve records: bundle name, provider class, env-var name (or ARN reference), and "resolved=ok".
- The log line for a failed resolve records: same fields plus a human-readable error category (`missing-env-var`, `aws-fetch-failed`, etc.). The actual value (or attempted value) is never logged.

You can audit this for yourself: `grep -r "redact\|secret\|password\|token" agentmux-srv/src/identity/` — every interpolation into a log macro should reference only metadata.

## Rotation

To rotate a credential:

- **`Env`** — update the env var in your shell and restart any running agents that reference it. The bundle itself doesn't change.
- **`SecretsManager`** (future) — rotate at the AWS side; AgentMux fetches the current value on next agent launch.
- **`PlaintextDev`** — update the value through the Identity editor in the UI; takes effect on next agent launch.

The Identity bundle itself is durable across credential rotations; only the referenced value changes.

## What the audit verified

The 2026-05-11 security audit ([source](/security/trust-model/)) confirmed:

- `PlaintextDev` is genuinely gated to debug builds (`cfg(debug_assertions)` at resolve time).
- Tokens are not logged on resolve.
- The spawn path injects via env vars, not command line.
- `store.db` (the account-wide store under `~/.agentmux/shared/`) permissions inherit from the parent dir (`0700` on Unix).

## What's not protected

Be honest about the limits:

- Once a credential is resolved into an agent process's environment, **any code that process runs can read it.** If you grant an agent a GitHub PAT and the agent runs `npm install`, the lifecycle scripts of every installed package have `GH_TOKEN` in their environment.
- The OS-level `/proc/<pid>/environ` (Linux) and `procfs` equivalents expose the running process's env to anyone who can read it. By default this is owner-only, but a co-administrator or root can read it. AgentMux does not work around this.
- The `Env` variant trusts your shell environment. If a malicious script earlier in your shell session set `GH_TOKEN=...`, AgentMux will inject that. The credential's quality is your shell's quality.

These are intentional trade-offs of running agents as the user. If you need stronger isolation, the answer is OS-level (containers, sandboxing) — not something AgentMux can paper over.

---

**Source-of-truth references**:
- `agentmux-srv/src/backend/storage/identities.rs` — `SecretRef` enum + database schema
- `agentmux-srv/src/identity/resolver/` — resolution (`inject.rs`, `secret.rs`) + `cfg(debug_assertions)` gate
- `agentmux-srv/src/backend/blockcontroller/subprocess/` — agent spawn + env injection (`host_spawn.rs`, `container_spawn.rs`)
- `store.db` (the account-wide store under `~/.agentmux/shared/`) — SQLite at rest

**Related**: [Identity bundles](/identity/) (the feature), [Data sovereignty](/security/data-sovereignty/), [Trust model](/security/trust-model/).
