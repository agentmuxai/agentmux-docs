---
title: "Identity & credential storage"
description: "Where AgentMux keeps credentials and keys at rest, how they reach agent processes, and what the file permissions actually are."
---

The [Identity bundles](/identity/) page covers the *feature*: accounts, bundles, and assigning them at launch. This page covers the *security model*: where every credential and key lives at rest, how credentials reach agent processes, and what protects them.

## Where AgentMux keeps data

Everything lives under one root, `~/.agentmux` (`%USERPROFILE%\.agentmux` on Windows); dev builds use `~/.agentmux/dev/<branch>/` for their per-channel part. See [Data layout](/internals/data-layout/) for the full tree. The parts that matter for security:

| Path | Contents |
|---|---|
| `channels/<channel>/versions/<version>/data/db/objects.db` | Panes and their settings, agent definitions, agents' signing keys and identity tokens, held messages |
| `channels/<channel>/versions/<version>/data/db/filestore.db`, `sagas.db` | Pane output and terminal scrollback; the operation log |
| `channels/<channel>/versions/<version>/data/authkey.dev`, `ipc-port-<hash>` | The current launch's auth key and host IPC token (see below) |
| `channels/<channel>/versions/<version>/cef-cache/` | Chromium profile for browser panes: cookies, site storage, cache |
| `shared/store.db` | Identity accounts, memory bundles, drone definitions, MuxBus credential metadata, per-agent MuxBus machine credentials |
| `shared/identity-store.db` | Agent-to-account links, skills, MCP servers, the work queue |
| `shared/agents/transcripts/filestore.db` | Agent conversation transcripts |
| `shared/providers/<provider>/`, `shared/identities/<account>/<provider>/` | Agent CLIs' own login directories (see [provider CLI logins](#oauthconfigdir-provider-cli-logins)) |
| `agents/<slug>/` | Default agent working directories, each with an `.mcp.json` holding that agent's signing keys |
| `agents/<name>.json`, `shared/agents/reactive/` | Registries of running agents, each entry including its instance's auth key |

On channels other than `stable`, `shared/store.db` and `shared/identities/` are replaced by per-channel copies (`channels/<channel>/identity-store.db`, `channels/<channel>/identities/`) unless `AGENTMUX_ISOLATED_AUTH=0` is set (`isolated_auth_enabled` in `agentmux-common/src/data_paths.rs`).

## File permissions

**Unix:** AgentMux creates `~/.agentmux` and its subdirectories with a plain recursive create (`DataPaths::ensure_dirs` in `agentmux-common/src/data_paths.rs`), so they get your process umask; nothing forces `0700`. Databases, `.mcp.json` files, logs and transcripts are written with default permissions too. With a typical umask of `022`, other users on the machine can read them unless your home directory stops them.

Only these are explicitly restricted:

| File or directory | Mode |
|---|---|
| `authkey.dev` | `0600` |
| Registry files `agents/<name>.json` and `shared/agents/reactive/<agent>/<channel>.json` | `0600`, set at creation |
| The launcher's IPC socket directory (`$XDG_RUNTIME_DIR/agentmux/` or `/tmp/agentmux-<uid>/`) | `0700`, and refused if owned by another user |
| The macOS sign-in helper script, a self-deleting temp file | `0700`, set at creation |

Everything else under `~/.agentmux` depends on your umask, including the `ipc-port-<hash>` file, whose token can be exchanged for the auth key.

**On a multi-user Unix machine, run `chmod 700 ~/.agentmux`.** That closes the whole tree regardless of the modes of the files inside it. If you point agents at working directories outside `~/.agentmux`, those directories' `.mcp.json` files need the same care.

**Windows:** files inherit the access control of your profile folder, which by default admits only you, SYSTEM and administrators. `authkey.dev` additionally gets an owner-only access list that doesn't inherit from its folder.

## Credentials, by kind

A credential attached to an identity account is stored as a `SecretRef`, a pointer that says where the value is (`agentmux-srv/src/backend/storage/identities.rs`). Resolution is in `resolve_secret` (`agentmux-srv/src/identity/resolver/secret.rs`).

### `Keychain`: OS secret store

API keys and tokens you add in the Armory (a GitHub personal access token, an Anthropic or OpenAI API key, and so on) are stored in the OS secret store through the `keyring` crate: macOS Keychain, Windows Credential Manager, or Linux Secret Service. The entry uses service `agentmux` and account `acct:<account id>`; the database holds only this pointer and non-secret metadata (`agentmux-srv/src/identity/secret_store.rs`). The value is read at agent launch.

On Linux you need a running Secret Service (GNOME Keyring, KWallet or similar). Without one, saving the key fails with an error; AgentMux has no plaintext fallback.

### `Env`: environment variable

AgentMux stores only the variable name and reads the value at launch from **the AgentMux server's own environment**. That is the environment AgentMux itself was started with, which for an app started from the Start menu, Dock or a desktop launcher is not your shell's. The value is never written to disk by AgentMux.

### `OAuthConfigDir`: provider CLI logins

For Claude Code, Codex, Gemini, Copilot and OpenClaw logins, AgentMux stores only a directory path, and points the CLI at it with the CLI's config-directory variable (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `GEMINI_CLI_HOME`, `COPILOT_HOME`, `OPENCLAW_HOME`). The CLI writes and refreshes its own tokens there, in its own format; AgentMux does not encrypt them. The directories are:

- `shared/providers/<provider>/`, the default login shared by every agent of that provider, on every channel;
- `shared/identities/<account>/<provider>/`, one per account in an identity bundle;
- the CLI's usual location in your home directory (for example `~/.claude`), for an agent set to use the ambient login.

AgentMux reads one of these tokens itself: at each launch it uses the Claude login from `shared/providers/claude/` to fetch the current model list from Anthropic. See [Data sovereignty](/security/data-sovereignty/).

### `PlaintextDev`: debug builds only

The value is stored as-is in the database. `resolve_secret` returns it only in debug builds (`cfg(debug_assertions)`); release builds refuse it with an error.

### `SecretsManager`: not implemented

The variant exists, and resolving it always returns an "unsupported" error.

### Credentials that aren't `SecretRef`s

| Credential | Where | At rest |
|---|---|---|
| MuxBus Cloud sign-in (access, refresh and ID tokens) | OS secret store; email and expiry in `shared/store.db` | OS secret store |
| Per-agent MuxBus machine credentials (client id, client secret, cached access token) | `shared/store.db`, table `db_agent_credentials` | **Plaintext** |
| Passwords saved for HTTP Basic auth in browser panes | OS secret store, one entry per identity and site (`agentmux-srv/src/identity/browser_credential_store.rs`) | OS secret store |
| Browser-pane cookies and site storage | `cef-cache/` | Chromium is started with `--password-store=basic` (and, on macOS, `--use-mock-keychain`) so it never touches the OS keychain; by the code's own description the cookie store then has only obfuscation-level encryption. Treat it as plaintext. |
| Agents' signing keys: HMAC key, LAN and WAN Ed25519 private keys | `objects.db`, and the agent's `.mcp.json` in its working directory | **Plaintext** |
| Agents' identity tokens (`AGENTMUX_AGENT_TOKEN`) | `objects.db` | **Plaintext** |
| `KEY=VALUE` lines in an agent definition's environment | `objects.db`, and copied into the pane's settings | **Plaintext** |
| Instance auth key and host IPC token | `authkey.dev` (`0600`), `ipc-port-<hash>` (default permissions), registry files (`0600`) | Plaintext; regenerated at every launch |

### Signing keys in `.mcp.json`

At every launch, AgentMux writes the agent's HMAC key and its LAN and WAN private keys into the `mcpServers.agentmux.env` block of `.mcp.json` in the agent's **working directory**, where its MCP server reads them (`inject_jekt_signing_keys_into_mcp_json` in `agentmux-srv/src/backend/agent_config.rs`). The file is written with default permissions and replaces any `.mcp.json` already there.

The default working directory, `~/.agentmux/agents/<slug>/`, is excluded from git by a `*` rule in `~/.agentmux/.gitignore`. **If you set an agent's working directory to a project repository, AgentMux overwrites that project's `.mcp.json` with its own, including the agent's signing keys. Add `.mcp.json` to the project's `.gitignore` and don't commit it.** Anyone holding these keys can sign messages as that agent; see [Reactive event bus](/security/reactive-event-bus/#signing-keys).

## How credentials reach agent processes

At each agent launch (`inject_identity_env` in `agentmux-srv/src/identity/resolver/inject.rs`):

1. AgentMux looks up the accounts linked to the agent's definition.
2. For an **API-key** account it resolves the `SecretRef` and sets the provider's variables in the process environment: `GITHUB_TOKEN` and `GH_TOKEN` for GitHub, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `MOONSHOT_API_KEY` (Kimi), `AWS_ACCESS_KEY_ID`. A failed resolution is logged and skipped.
3. For an **OAuth** account it sets the CLI's config-directory variable. If the account can't be resolved, the launch is refused, unless the agent is set to use the ambient login.
4. Credentials go into the process environment, never onto the command line. Container agents receive them through the Docker API, not `docker exec -e`.
5. The log records account ids, providers and the number of variables injected, not the values.

AgentMux adds its own variables to every agent process as well: `AGENTMUX_AUTH_KEY` (full control of the local AgentMux server), `AGENTMUX_AGENT_TOKEN`, and, while you're signed in to MuxBus Cloud, `MUXBUS_TOKEN`, your MuxBus account's access token. See the [trust model](/security/trust-model/#the-auth-key-is-in-every-pane).

## Rotation

- **`Keychain`**: update the account's key; AgentMux rewrites the OS secret-store entry. Agents pick it up at their next launch.
- **`Env`**: change the variable in the environment AgentMux is started from, then restart AgentMux, not just the agents: the value is read from the server's own environment.
- **`OAuthConfigDir`**: sign in again through the CLI, or the account's sign-in flow in AgentMux. The CLI refreshes tokens itself.
- **Agent signing keys**: the HMAC key is replaced at the agent's next launch once it is 24 hours old. LAN and WAN keys are not rotated. All three are deleted with the agent, unless another agent still uses that name.
- **Instance auth key, host IPC token, `lan_key`**: new at every launch.

## What's not protected

- **Anything running as your OS user** can read the database files, the `.mcp.json` files, the CLI login directories, and the environment of agent processes (for example `/proc/<pid>/environ` on Linux). On Windows and Linux it can also read AgentMux's OS secret-store entries; on macOS the Keychain may prompt first. The OS secret store protects against other users and offline disk access, not against your own processes.
- **A credential in an agent's environment is available to everything that agent runs.** If you give an agent a GitHub token and it runs `npm install`, every install script gets `GH_TOKEN` too.
- **The `Env` variant trusts AgentMux's environment.** Whatever set that variable before AgentMux started decides what gets injected.
- **Root or an administrator** can read all of the above.

These follow from running agents as you. If you need stronger isolation, use OS-level separation: a separate user account, a VM, or a container agent.

---

**Source-of-truth references**:
- `agentmux-common/src/data_paths.rs` — data root, `ensure_dirs`, `identities_dir`, `provider_auth_dir`, `isolated_auth_enabled`
- `agentmux-srv/src/backend/storage/identities.rs` — `SecretRef`
- `agentmux-srv/src/identity/resolver/secret.rs` (`resolve_secret`), `agentmux-srv/src/identity/resolver/inject.rs`, `agentmux-srv/src/identity/resolver/provider.rs` — resolution and injection
- `agentmux-srv/src/identity/secret_store.rs`, `agentmux-srv/src/identity/browser_credential_store.rs`, `agentmux-srv/src/backend/storage/muxbus.rs` — OS secret store use
- `agentmux-srv/src/backend/storage/agent_credentials.rs` — per-agent MuxBus machine credentials
- `agentmux-srv/src/backend/agent_config.rs` (`inject_jekt_signing_keys_into_mcp_json`) — signing keys in `.mcp.json`
- `agentmux-srv/src/backend/reactive/registry.rs`, `agentmux-cef/src/dev_authfile.rs`, `agentmux-launcher/src/ipc/mod.rs` — the explicitly restricted files
- `agentmux-cef/src/app/mod.rs` — Chromium password-store switches

**Related**: [Identity bundles](/identity/) (the feature), [Data sovereignty](/security/data-sovereignty/), [Trust model](/security/trust-model/).
