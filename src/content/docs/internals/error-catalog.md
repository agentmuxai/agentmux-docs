---
title: Error catalog
description: How AgentMux surfaces errors across the launcher / host / sidecar / renderer boundary — the typed `AgentMuxError` enum, stable `AMX-` codes, and the frontend translation table that renders friendly banners.
---

AgentMux has one shared error system across all four processes. The Rust crates produce a typed `AgentMuxError`; the RPC layer serializes it to a stable wire format; the frontend looks up a friendly title + message + recovery hint via a catalog. The wire format is the contract, the catalog is presentation.

## Why this exists

Before the catalog, RPC handlers returned bare strings (`Result<T, String>`), file I/O errors bubbled up as raw `rusqlite::Error` text, and the renderer pasted whatever JSON it received into the UI. A "no space left on device" condition during a portable build surfaced as `sqlite error: disk I/O error` in the agent picker — accurate, but unactionable. The catalog turns that into:

> **Device out of space**
> Couldn't write to `C:/Users/.../objects.db` — no space left on the disk.
> *Free up some space and try again.*
> `AMX-IO-001`

## The three layers

### 1. Rust enum (`agentmux-common::errors`)

[`agentmux-common/src/errors.rs`](https://github.com/agentmuxai/agentmux/blob/main/agentmux-common/src/errors.rs) defines `AgentMuxError`:

```rust
#[derive(Debug, thiserror::Error)]
pub enum AgentMuxError {
    #[error("device out of space writing {path}")]
    OutOfSpace { path: String, source_msg: String },

    #[error("CLI {cli} not installed for provider {provider}")]
    CliNotInstalled { provider: String, cli: String },

    #[error("OAuth subprocess requires an interactive TTY: {provider}")]
    AuthRequiresTty { provider: String },

    // ... more variants
    #[error("{0}")]
    Legacy(String), // fallback for un-migrated handlers
}
```

Every variant has a stable `AmxCode` — the `AMX-IO-001` style string the rest of the system grep-matches on. The enum and the codes are **the contract**; renaming a Rust variant doesn't change the code, so logs and bug reports remain searchable across versions.

The `From<std::io::Error>` impl routes by `ErrorKind` + raw OS code so call sites don't have to translate manually. ENOSPC=28 is portable; the Windows-specific `ERROR_HANDLE_DISK_FULL=39` and `ERROR_DISK_FULL=112` are gated behind `cfg(windows)` (Unix errno 112 is EHOSTDOWN — would mis-classify a disconnected CIFS mount as disk-full without the gate). Helper `AgentMuxError::from_io_with_path(path, err)` preserves the path context at call sites that know it.

### 2. Wire format

`AgentMuxError::to_wire()` serializes to a stable JSON shape:

```json
{
  "code": "AMX-IO-001",
  "message": "device out of space writing /home/x/.agentmux/instances/v0.33/cli/claude",
  "details": {
    "path": "/home/x/.agentmux/instances/v0.33/cli/claude",
    "source_msg": "No space left on device (os error 28)"
  }
}
```

RPC handlers serialize this into the existing `Result<T, String>` boundary today (the engine signature stays unchanged for migration ergonomics). The frontend's `translateError()` accepts the wire object, a `JS Error` whose `.message` is the JSON, or a raw string — always returning a renderable `TranslatedError`.

### 3. Frontend catalog (`frontend/app/errors/`)

[`catalog.ts`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/errors/catalog.ts) mirrors the Rust enum: each `AMX-` code maps to `{ title, message, retry }` with lambda renderers that consume the wire `details` object.

```ts
"AMX-IO-001": {
    title: "Device out of space",
    message: (d) => `Couldn't write to ${noPath(d.path)} — no space left on the disk.`,
    retry: "Free up some space and try again.",
},
"AMX-CLI-004": {
    title: "CLI not on PATH",
    message: (d) => `${d.cli} isn't on your PATH and ${d.provider} can't be auto-installed.`,
    // `retry` can be a function for entries that surface payload-specific text:
    retry: (d) => d.install_hint ? `Install it manually: ${d.install_hint}` : "Install the CLI manually and add it to your PATH.",
},
```

[`<ErrorBanner error={...} />`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/errors/ErrorBanner.tsx) is the canonical render: title + message + retry hint + a small `Show details` disclosure for the raw backend message + the `AMX-` code in monospace (so users can paste it into bug reports). The translator is memoized via `createMemo` so re-renders don't re-translate.

## Code categories

| Prefix | Domain | Examples |
|---|---|---|
| `AMX-IO-*` | Filesystem | `001` OutOfSpace, `002` PermissionDenied, `003` PathNotFound, `004` PathTraversal |
| `AMX-STORE-*` | Persistence | `001` MigrationFailed, `002` VersionMismatch |
| `AMX-CLI-*` | Provider CLI | `001` CliNotInstalled, `002` NpmInstallFailed, `003` CliShimMissing, `004` CliMissingOnPath |
| `AMX-AUTH-*` | OAuth / API key | `001` AuthRequiresTty, `002` AuthTimeout |
| `AMX-NET-*` | Network | `001` HttpError |
| `AMX-LIFECYCLE-*` | Startup | `001` SidecarBindFailed, `002` AlreadyRunning |
| `AMX-LEGACY` | Fallback | Free-text error from an un-migrated handler |

`AMX-LEGACY` exists so call sites that still return `Result<_, String>` work unchanged through the new pipeline. Their messages render as "Something went wrong" with the raw text in the body; once a handler migrates to `Err(AgentMuxError::Foo { ... }.to_wire().to_string())` it gets a proper banner.

## Adding a new code

1. Add the variant to `AgentMuxError` in `agentmux-common/src/errors.rs`. Use `thiserror`'s `#[error("...")]` for the Rust-side Display string — that's what ends up in `wire.message`.
2. Add the matching variant to `AmxCode` and its `as_str()` arm — pick the next unused number in the relevant prefix bucket.
3. Update `code()`, `to_wire()` (insert `details` keys), and the `code_strs_unique_and_stable` test in `agentmux-common/src/errors.rs`.
4. Add the matching entry to `frontend/app/errors/catalog.ts` with the friendly text. Use the lambda form of `retry` if the recovery hint depends on the details payload.
5. Migrate the call site: replace `Err(format!("..."))` with `Err(AgentMuxError::YourVariant { ... }.to_wire().to_string())`.
6. Wire any client-side log/banner sites through `translateError()` if they previously rendered `err.message` directly.

The contract: codes are *forever stable* once shipped. Renaming the Rust variant is fine; renaming `AMX-IO-001` is a breaking change for support requests, log search, and any user-visible documentation.

## When to NOT use the catalog

- **Internal-only errors that never reach the user.** A function that returns `Err` to its caller for control flow and the caller handles it without surfacing — fine to keep as `String` / `anyhow`.
- **Free-text diagnostics that aren't actionable.** A debug-only error from a poorly-bounded loop, for example, doesn't need a code; it'll never be in a support transcript.
- **Errors that need ALL their context preserved.** If the value of `Err` is a structured object the receiver pattern-matches on (rare in AgentMux today), the catalog's stringification loses too much. Use a domain-specific enum and convert to `AgentMuxError` only at the RPC boundary.

## See also

- Design spec: [`docs/specs/SPEC_ERROR_CATALOG_2026_05_17.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/SPEC_ERROR_CATALOG_2026_05_17.md) — full audit, migration plan, open questions.
- [Modal system (modal-v2)](/internals/modal-system/) — the universal chrome `<ErrorBanner>` integrates with.
- Source:
  - [`agentmux-common/src/errors.rs`](https://github.com/agentmuxai/agentmux/blob/main/agentmux-common/src/errors.rs)
  - [`frontend/app/errors/catalog.ts`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/errors/catalog.ts), [`translate.ts`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/errors/translate.ts), [`ErrorBanner.tsx`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/errors/ErrorBanner.tsx)
