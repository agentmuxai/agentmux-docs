---
title: TypeScript API
description: Generated reference for the AgentMux frontend public API surface.
---

This page is the placeholder for the TypeScript API reference. The full per-module documentation is generated from the pinned `src/agentmux` submodule via:

```bash
npm run build:typedoc
```

That step produces a tree of pages under `src/content/docs/api/typescript/` (this directory) covering the curated public-API entry points. The default `npm run build` deliberately skips it so the docs site iterates without running typedoc; release builds use `npm run build:full`.

## Modules indexed when the generator runs

- **`agent-document-store`** — slice #1 of the frontend reducer roadmap. Per-pane document state cell with register / dispatch / unregister lifecycle.
- **`agent-pane-state-store`** — slice #4. Bundles the per-pane lifecycle/turn/tool/tokens state with cohesive invariants.
- **`launcher-event-reducer`** — slice #6. Mirrors launcher-side window state into the frontend.
- **`command-source`** — the audit-trail dispatcher every slice routes through.

If you're seeing only this placeholder in production, the release build skipped the typedoc step. Local dev sees this until `npm run build:typedoc` runs.

## Cross-references

- Rust API reference: [/api/rust/](/api/rust/)
- Source repository: [agentmuxai/agentmux](https://github.com/agentmuxai/agentmux)
