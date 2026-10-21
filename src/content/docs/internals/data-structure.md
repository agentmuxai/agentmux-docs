---
title: Data structure
description: Every database and file AgentMux keeps on disk — where it lives, what it holds, which builds share it, and how it moves to a new version.
---

This page is the map of everything AgentMux stores: eight SQLite databases, a set of JSON records and logs, and the folders that hold them. [Data layout](/internals/data-layout/) explains how channels, versions and dev builds pick their folders. [Persistence](/internals/persistence/) explains how srv's reducer loads and writes `objects.db`.

Checked against `agentmux` main on 2026-10-20. Every database is opened by `agentmux-srv`, the running server or its `migrate` subcommand: it is the only crate that links SQLite. The launcher and the CEF host never open one.

## Four scopes

Every file belongs to one of four scopes. The scope decides which builds see it.

| Scope | Folder | Shared by |
|---|---|---|
| **Machine-wide** | `~/.agentmux/shared/`, plus `~/.agentmux/agents/`, `widgets/`, `logs/` and a few other root folders | Every AgentMux on the computer: every channel, every version and every `task dev` build |
| **Channel-wide** | `~/.agentmux/channels/<channel>/` | Every version of one channel |
| **Per version** | `~/.agentmux/channels/<channel>/versions/<version>/` | One version only |
| **Per agent** | `~/.agentmux/agents/<slug>/` | One agent, in every channel |

A `task dev` build has no version level: its per-version folders are at `~/.agentmux/dev/<branch>/<clone-id>/`. Everything machine-wide is shared with it, including the shared databases. See [Shared across builds](#shared-across-builds).

```text
~/.agentmux/
├── shared/                      machine-wide
│   ├── store.db                 accounts, bundles and Global Memory, drones, cron, credentials metadata
│   ├── identity-store.db        agent ↔ account links, Skills and MCP catalogs, work queue, vault
│   ├── migrations.lock.db       serializes migration runs across every AgentMux
│   ├── agents/
│   │   ├── definitions/         one JSON record per user agent (+ retired/ tombstones)
│   │   ├── registry/            one JSON record per named agent (+ leases/, retired/)
│   │   └── transcripts/filestore.db   every agent's conversation, Global Memory record
│   ├── identities/, providers/  provider login folders (one per account, one default per provider)
│   ├── backups/                 pre-migration copies, kept 30 days
│   └── …                        CLI installs, layouts, browser bookmarks, audit log (see below)
├── agents/<slug>/               agent working folders
├── widgets/<id>/                installed widgets
├── logs/                        launcher log, migration error log
├── channels/
│   ├── settings.json            settings for the stable channel
│   └── <channel>/
│       ├── config/              settings for non-stable channels, per-agent gh config
│       ├── wan-identity/wan.db  WAN keys and peer cache
│       ├── logs/                pointer to the current host log
│       ├── updates/<version>/   fallback location for an unpacked update
│       └── versions/<version>/
│           ├── data/
│           │   ├── db/          objects.db, filestore.db, sagas.db, migrations.lock.db
│           │   ├── snapshots/   pre-migration snapshots
│           │   └── …            event logs, attachments, update downloads, locks
│           ├── logs/            host and srv logs
│           ├── cef-cache/       Chromium profiles: cookies, local storage, sign-ins
│           └── runtime/         created, currently unused
└── dev/<branch>/<clone-id>/     a dev build's data/, logs/, cef-cache/, config/, wan-identity/
```

## Databases at a glance

| Database | Path | Scope | Schema version | What it holds |
|---|---|---|---|---|
| `objects.db` | `versions/<v>/data/db/` | Per version | 44 | Windows, workspaces, tabs, blocks, layouts; agents and their per-agent rows and keys |
| `filestore.db` | `versions/<v>/data/db/` | Per version | 1 | Per-block files: terminal scrollback, agent output and its index |
| `sagas.db` | `versions/<v>/data/db/` | Per version | 1 | Multi-step commands, for undo after a crash |
| `store.db` | `shared/` | Machine-wide | 12 | Accounts, bundles and Global Memory, drones, cron jobs, MuxBus sign-in metadata, native memory |
| `identity-store.db` | `shared/` | Machine-wide | 11 | Agent ↔ account links, Skills and MCP catalogs, work queue, coordination posts, vault |
| transcripts `filestore.db` | `shared/agents/transcripts/` | Machine-wide | 2 | Every agent's conversation, the Global Memory record, per-agent memory records |
| `wan.db` | `channels/<ch>/wan-identity/` | Channel-wide | — (own counter, 3) | WAN instance and agent keys, peer records, replay guard |
| `migrations.lock.db` | `shared/` and `versions/<v>/data/db/` | Both | — | No data: a lock held while migrations run |

All eight use WAL journaling except the lock files. srv opens each with one writer connection; `filestore.db` also keeps a small pool of read-only readers and checkpoints its WAL from a background thread.

**Isolated auth.** With `AGENTMUX_ISOLATED_AUTH=1`, srv replaces `shared/store.db` with `<instance>/identity-store.db`, a separate file with the **`store.db` schema** despite its name, at `channels/<ch>/identity-store.db` or `dev/<branch>/<clone-id>/identity-store.db`. `shared/identity-store.db` itself is never redirected. Channels created before 2026-10-03, when isolation was the default, have one of these files too; srv [adopts](#how-data-reaches-a-new-version) their contents into `shared/store.db` once.

## `objects.db`

Source: [`store.rs`](https://github.com/agentmuxai/agentmux/blob/main/crates/srv/src/backend/storage/store.rs), schema in [`migrations.rs`](https://github.com/agentmuxai/agentmux/blob/main/crates/srv/src/backend/storage/migrations.rs) (`run_object_schema`).

### Session objects

Each object type has its own table with the same three columns: `oid` (primary key), `version` (bumped on every update) and `data`, the object's whole JSON.

| Table | Object |
|---|---|
| `db_client` | The client record: which windows exist |
| `db_window` | An OS window and the workspace it shows |
| `db_workspace` | A workspace: its tabs, pinned tabs, active tab |
| `db_tab` | A tab: its blocks and layout |
| `db_layout` | A tab's pane tree |
| `db_block` | A pane: its view and meta (agent id, URL, scroll position, …) |

Objects point at each other by oid inside the JSON (client → windows → workspace → tabs → layout and blocks), not with SQL foreign keys. `db_temp` is created but unused.

### Agents

| Table | Holds |
|---|---|
| `db_agents` | One row per agent (keyed by its uid): definition, template links, account, bundle, last launch state, session id |
| `db_agent_content` | Per-agent content: instructions, MCP config, environment, UI settings |
| `db_agent_skills`, `db_agent_skills_ref`, `db_agent_mcp_ref` | Inline skills, and the agent's picks from the Skills and MCP catalogs |
| `db_agent_bundles` | The bundles picked for an agent, in order |
| `db_bundle_skills_ref` | Skills a bundle brings |
| `db_agent_history`, `db_agent_former_names` | History journal; every name the agent has had (written by trigger) |
| `db_agent_input_history`, `db_agent_input_drafts` | What the user typed to each agent; the unsent draft |
| `db_agent_project_instructions` | Hash and time of project instruction files an agent read (never their content) |
| `db_agent_activity_summaries`, `db_background_tasks`, `db_agent_groups` | Activity summary cache; declared background tasks; fleet groups |

### Keys, trust and messaging

| Table | Holds |
|---|---|
| `db_agent_tokens` | Each agent's identity token |
| `db_agent_jekt_keys` | Per-agent key for signing host-tier messages |
| `db_agent_lan_keys_by_uid`, `db_agent_wan_keys_by_uid` | Per-agent signing keys, keyed by uid (the older name-keyed `db_agent_lan_keys` / `db_agent_wan_keys` are being replaced) |
| `db_agent_key_tombstones` | Names of deleted agents, so a name can't silently inherit an old key |
| `db_lan_peer_uid_pins`, `db_lan_peer_pubkey_pins` | Keys first seen for remote agents (trust on first use) |
| `db_jekt_held` | Messages held for an agent that isn't running |
| `db_conversation_trust_grants` | Which peers may request an agent's transcript |
| `db_viewer_devices` | Paired viewer devices |
| `db_widget_storage` | Widgets' key/value storage |

### Fallback copies

`objects.db` also has `db_accounts`, `db_agent_identity_links`, `db_bundles`, `db_bundle_versions`, `db_drone_definitions`, `db_skills`, `db_mcp_servers`, `db_mcp_server_reach`, `db_muxbus_credentials`, `db_agent_credentials` and `db_agent_native_memory(_versions)`. srv uses them only when it can't open the shared stores, which normally hold this data. `db_drone_runs` is live here: drone runs are per version. `db_bundle_mcp_ref` has been empty since migration m0036 and is kept for older builds.

`db_migrations` records which channel-scope migrations have run on this file (see [Migrations](#schema-versions-and-migrations)).

## `store.db` (shared)

Source: `run_shared_store_schema` in [`migrations.rs`](https://github.com/agentmuxai/agentmux/blob/main/crates/srv/src/backend/storage/migrations.rs). srv's handle for it is `id_store`.

| Table | Holds |
|---|---|
| `db_accounts` | Provider accounts. Secrets are referenced, not stored: they live in the OS keychain or the account's login folder |
| `db_bundles`, `db_bundle_versions` | Bundles, including Global Memory, and their history |
| `db_drone_definitions` | Drone graphs |
| `db_cron_jobs` | Scheduled prompts |
| `db_muxbus_credentials` | MuxBus sign-in metadata; the tokens themselves are in the OS keychain |
| `db_agent_credentials` | Per-agent cloud credentials |
| `db_agent_native_memory`, `db_agent_native_memory_versions` | A mirror of each agent's native memory files, with history |
| `db_agent_identity_links` | Legacy: the live links are in `identity-store.db` |
| `db_migrations` | Which global-scope migrations have run |

## `identity-store.db` (shared)

Source: `run_identity_store_schema` in [`migrations.rs`](https://github.com/agentmuxai/agentmux/blob/main/crates/srv/src/backend/storage/migrations.rs). srv's handle for it is `identity_store`.

| Table | Holds |
|---|---|
| `db_agent_identity_links` | Which account each agent uses, per provider |
| `db_accounts` | A mirror of `store.db`'s accounts, so credential lookups work from either store |
| `db_skills`, `db_mcp_servers`, `db_mcp_server_reach` | The Skills and MCP server catalogs |
| `db_work_queue`, `db_work_claims` | The shared task queue and claims |
| `db_coord_posts` | Coordination channel posts |
| `db_vault_entries`, `db_vault_activity`, `db_vault_on_screen` | Vault entries (sealed), its activity log (never values), and visibility |

It also defines the bundle, drone, cron, credential and native-memory tables for schema parity with `store.db`; they stay empty.

## `filestore.db` (per version and shared transcripts)

Both files use one schema ([`filestore/core.rs`](https://github.com/agentmuxai/agentmux/blob/main/crates/srv/src/backend/storage/filestore/core.rs)). A file is addressed by a **zone** and a **name**:

- `db_wave_file` — one row per file: `(zoneid, name)`, size, times, options, meta, and line counters.
- `db_file_data` — the content in 64 KB parts: `(zoneid, name, partidx)`. A file can be circular, with a maximum size.

Triggers keep a revision counter and an incarnation id per file, so readers can tell an appended file from a replaced one.

| Store | Zones |
|---|---|
| Per version | One zone per block (its oid): `term` (terminal scrollback), `output` (agent output), and per-block state and index files |
| Shared transcripts | `agent:<id>:current` and `agent:<id>:archive:<time>` (conversations), `agent-uid:<uid>:memory` (memory record), `agent-uid:<uid>:bundle`, `global-memory:<scope>` |

The shared store has the same schema but is stamped version 2 rather than 1. The number is a lock: builds that bundle SQLite older than 3.51.3, whose WAL-reset bug can corrupt a database several processes write, refuse to open it and run without it.

An agent's conversation is written to both: its block's `output` in the per-version store and `agent:<id>:current` in the shared one, so it survives a new version and opens from any channel. The shared file is used by every srv on the computer; one of them, the holder of `filestore.db.owner`, truncates its WAL.

## `sagas.db`

Source: [`sagas/log.rs`](https://github.com/agentmuxai/agentmux/blob/main/crates/srv/src/sagas/log.rs). Two tables: `saga` (one row per multi-step command: name, state, input, failure reason) and `saga_step` (one row per step: command, output, state). Steps go `pending` → `succeeded`, `failed` or `compensated`. At startup srv undoes any saga that didn't finish (see [Persistence](/internals/persistence/#sagasdb--sidecar-saga-coordinator)).

## `wan.db`

Source: [`wan_identity.rs`](https://github.com/agentmuxai/agentmux/blob/main/crates/srv/src/backend/storage/wan_identity.rs). Channel-wide, so every version of a channel uses the same WAN identity, and two running versions open it together.

| Table | Holds |
|---|---|
| `wan_instance` | This install's instance keypair |
| `wan_agent_keys`, `wan_agent_key_publications` | Agent WAN keys and where each is published |
| `wan_peer_records`, `wan_known_instances` | Cached records of peers and instances seen |
| `wan_seen_sigs` | Replay guard |
| `wan_meta` | Its own schema counter (3); the schema only ever grows |

## Files that aren't databases

### Machine-wide

| Path | Format | Holds |
|---|---|---|
| `shared/agents/definitions/<id>.json`, `retired/` | JSON | A copy of every user agent's definition, so it appears in every channel; tombstones stop a deleted agent coming back ([Persistence](/internals/persistence/#cross-channel-agent-persistence)) |
| `shared/agents/registry/<id>.json`, `retired/`, `leases/` | JSON, lock files | Named agents across channels; leases decide which process drives an agent's turns |
| `shared/agents/reactive/<agent>/<channel>.json` | JSON | Where each running agent can be reached; removed when it stops |
| `shared/identities/<id>/<provider>/` | Provider's own files | One provider login folder per account: credentials, settings, conversation files, Personal Memory (`projects/<path>/memory/`) |
| `shared/providers/<provider>/` | Provider's own files | The default login folder per provider |
| `shared/cli/<provider>/<version>/` | npm install | Provider CLIs AgentMux installed; unused ones are pruned after 30 days |
| `shared/backups/pre-migration-<version>-<time>/` | SQLite copies | `store.db` and `objects.db` before migrations ran; kept 30 days |
| `shared/adoption-ledger.json` | JSON | Which older per-channel stores have been adopted |
| `shared/history/`, `audit/jekt-audit.jsonl`, `lan/instances/`, `layouts/`, `muxbus-locks/` | JSON, JSONL, locks | Session metadata cache, message audit log, LAN instances, saved layouts, sign-in refresh locks |
| `shared/browser-bookmarks.json`, `browser-profiles.json`, `browser-start-page.json` | JSON | Browser pane bookmarks, named profiles, start page |
| `agents/<slug>/` | Folder | An agent's working folder: its startup instructions file (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, …), `.mcp.json`, `.claude/` settings and skills |
| `widgets/<id>/` | Folder | Installed widgets: `widget.json`, signature, files |
| `shell/<hash>/` | Scripts | Shell integration files each terminal sources, one folder per instance |
| `tools/`, `cache/scratch/`, `state/`, `tmp/` | Mixed | Tool store, editor scratch buffers (30 days), command-wrapper state, window captures (1 hour) |
| `logs/agentmux-launcher.log` | Text | Launcher log; rotates at 50 MB, keeps 3 |
| `logs/migration-error.log` | Text | The last failed `migrate` run |

### Channel-wide

| Path | Holds |
|---|---|
| `channels/settings.json`, `channels/widgets.json` | Settings and widget bar for the **stable** channel (or any channel with `AGENTMUX_ISOLATED_SETTINGS=0`) |
| `channels/<ch>/config/` | `settings.json` and `widgets.json` for other channels; a GitHub CLI config folder per agent; remote-host and SSH records; voice models |
| `channels/<ch>/wan-identity/wan.db` | See [`wan.db`](#wandb) |
| `channels/<ch>/logs/current-host-v<v>.path` | The path of the current host log |
| `channels/<ch>/updates/<version>/` | An unpacked update, when it can't be placed beside the running install |
| `channels/<ch>/agentmux-last-version.json`, `agent-cli-versions.json`, `agentmux-stopped-at-quit.json` | Upgrade notice state, provider CLI versions seen, agents stopped by a quit |

### Per version

| Path | Holds |
|---|---|
| `data/db/` | `objects.db`, `filestore.db`, `sagas.db`, `migrations.lock.db` |
| `data/snapshots/<ch>-pre-v<ver>-<time>.bak/` | Pre-migration snapshots of the three per-version databases; 5 kept |
| `data/launcher-events.log`, `data/srv-events.log` | JSONL event logs; rotate at 8 MiB to `.log.old` |
| `data/incidents.jsonl`, `data/background-audit.jsonl` | Recent incidents; background-work audit |
| `data/srv.lock`, `data/ipc-port-<hash>` | srv's lock (with its pid); the host's IPC port |
| `data/authkey.dev` | Connection details for local tools. Sensitive: readable by the owner only |
| `data/attachments/` | Files attached to agent messages; 30 days by default (`attachments:retentiondays`) |
| `data/updates/<version>/` | Update downloads and installers |
| `data/agents/`, `data/shell/` | Reactive registry for this instance; shell helper scripts |
| `data/*.flag` | Markers left by old one-time migrations |
| `logs/` | `agentmux-host-v<v>.log.<date>`, `agentmuxsrv-v<v>.log.<date>` (7 days), `cef-debug.log`, pointer files |
| `cef-cache/` | Chromium user data: `Default/`, `profile-<id>/` (named browser profiles), `Local State`, dictionaries |
| `runtime/` | Created, currently unused |

### Outside `~/.agentmux`

The launcher's single-instance pipe (`\\.\pipe\agentmux-<hash>` on Windows) or socket (`$XDG_RUNTIME_DIR/agentmux/<hash>.sock`), crash dumps (`CrashDumps\agentmuxsrv`, `CrashDumps\agentmux-host-hang`), `~/.ssh/config.agentmux-backup` when AgentMux edits your SSH config, `~/.agentmux-remote/` on remote hosts, and the portable marker and recorded channel inside a portable install's folder.

## Shared across builds

| | Other versions, same channel | Other channels | `task dev` builds |
|---|---|---|---|
| `shared/store.db`, `identity-store.db`, transcripts | Shared | Shared | Shared |
| Agent definitions and registry (JSON) | Shared | Shared | Shared |
| Provider login folders | Shared | Shared (unless isolated auth) | Shared (unless isolated auth) |
| Agent working folders, widgets | Shared | Shared | Shared |
| `wan.db`, channel config | Shared | Separate | Separate |
| `objects.db`, `filestore.db`, `sagas.db` | Copied once, then separate | Separate | Separate |
| Browser profiles (`cef-cache`) | Copied once, then separate | Separate | Separate |
| Settings | Shared within the channel | Stable has its own; each other channel has its own | Separate |

Because the shared databases are opened read-write by every running AgentMux at once, a schema change there reaches older builds too. A build that raises a shared database's schema version locks older builds out of it (see below), so shared tables only ever gain columns and tables, without a version bump where older builds must keep working.

## How data reaches a new version

srv never changes its data while it starts. When the launcher starts srv, srv first checks, read-only, whether this version's data needs preparing:

- a newer version's first start, with an older version of the channel to copy from;
- a fresh install or a new channel, whose databases don't exist yet;
- a migration this build brings that hasn't run on this data;
- or a database it can't read, since a doubt counts as "needs preparing".

If so, srv exits before writing anything (`AGENTMUXSRV-NEEDS-PREPARE`, exit code 4). The launcher then runs one upgrade step, `agentmux-srv migrate --prepare`, which the splash shows as **Updating data** with a row for each part:

1. **Copy forward.** If this version has no `data/db/objects.db`, it copies `filestore.db`, `sagas.db` and then `objects.db` from the newest older version of the same channel, with SQLite's `VACUUM INTO`. The older version may still be running; its folder is left as it was. If the copy fails, the step fails: the new version doesn't start on empty data, and the next start tries again.
2. **Back up** the stores the migrations may write (see below).
3. **Migrate**: run the migrations this data hasn't had.

The launcher then starts srv again. Every later start of that version finds nothing to prepare and goes straight to opening its stores: no copy, no backup, no migration lock.

Separately, on a version's first start the host copies browser sign-ins (cookies, local storage, IndexedDB, saved logins and `Local State`) from the previous version's `cef-cache`, unless that version is still running.

Everything else under `data/` starts empty: attachments, event logs, update downloads. Dev builds and `task package` builds have no older version to copy from. Nothing deletes old version folders.

**Without the launcher** (a headless srv, `task dev:standalone`), srv does the same work itself during startup. It also takes a snapshot of the per-version databases first when `objects.db`'s schema version is older than the build's, except after a copy-forward, since the older version's folder already holds that data.

**Adoption.** Channels created before 2026-10-03 kept their accounts and memory in their own `identity-store.db`. At startup srv copies what it hasn't yet into `shared/store.db` and records it in `shared/adoption-ledger.json`.

## Schema versions and migrations

Two mechanisms change the schema:

- **Schema setup** runs every time a database is opened: it creates missing tables and indexes and adds missing columns. It then stamps `PRAGMA user_version`. A build that finds a **higher** version than its own refuses to open the file (`SchemaTooNew`), so an older build never writes to a newer schema. `wan.db` has no such guard.
- **Migrations** are numbered data changes, `m0000`–`m0038` ([`crates/srv/src/migrations/`](https://github.com/agentmuxai/agentmux/tree/main/crates/srv/src/migrations)). Each runs once and is recorded in a `db_migrations` table: global-scope migrations in `shared/store.db`, channel-scope ones in `objects.db`. Rows travel with `objects.db` when it's copied forward, so a migration doesn't run twice on the same data.

Before a batch of migrations, `migrate --prepare` takes `migrations.lock.db` (shared first, then the version's), so only one AgentMux on the computer migrates at a time; the splash shows a row while it waits. It then copies `store.db`, `identity-store.db` and `objects.db` to `shared/backups/pre-migration-<version>-<time>/` with `VACUUM INTO`, leaving out `objects.db` when it was just copied forward. A failed step stops srv from starting: the launcher shows the error, and the next start retries, running only the migrations that haven't completed. Nothing is restored automatically.

The oldest version that can upgrade directly is in the release notes as `min-upgrade-from` (currently 0.55.0). Older installs upgrade in two steps.

## Backing up and restoring

- **Close AgentMux first** for a complete copy. Copy all of `~/.agentmux/shared/`, `~/.agentmux/channels/` and `~/.agentmux/agents/`. Copying only a version's `data/` misses the shared databases, which most of your accounts, agents and conversations depend on.
- **While AgentMux is running**, copy a single database with `sqlite3 <file> ".backup <copy>"` or `VACUUM INTO`. A plain file copy can miss recent writes, which sit in the `-wal` file until a checkpoint.
- **To restore**, stop AgentMux, put the files back, and remove any `-wal` and `-shm` files left beside them. A database restored from a newer version than the build you run is refused (`SchemaTooNew`).
- **Automatic copies** are in `shared/backups/` (`store.db`, `identity-store.db` and `objects.db`, before migrations, kept 30 days) and, when srv prepares its data itself, `versions/<v>/data/snapshots/` (the per-version databases, before a schema change). Neither covers the transcripts store or `wan.db`.

## See also

- [Data layout](/internals/data-layout/) — how channels, versions and dev builds resolve their folders, and log discovery
- [Persistence](/internals/persistence/) — how srv loads and writes `objects.db`, cross-channel agents, sagas
- [Multi-instance & dev mode](/multi-instance/)
- [Identity](/identity/) and [Memory](/memory/)
