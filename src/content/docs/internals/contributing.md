---
title: "Contributing"
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

We welcome contributions to AgentMux. This page covers how to set up, where the code lives, and the conventions we follow for the things that have hurt us the most when they were ignored.

## Ways to contribute

- Report bugs or request features on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues)
- Fix outstanding [issues](https://github.com/agentmuxai/agentmux/issues)
- Improve the documentation
- Star the repository

Please respect our [Code of Conduct](https://github.com/agentmuxai/agentmux/blob/main/CODE_OF_CONDUCT.md).

## Getting started

1. [Build from source](/internals/building/) — set up your dev environment
2. Create a feature branch from `main`
3. Make your changes
4. Submit a pull request

### Branch naming

Use `yourname/feature-description`:

```bash
git checkout -b yourname/fix-terminal-scroll
```

### Contributor License Agreement

On your first pull request you'll be prompted to sign a CLA. You retain copyright — this gives us permission to distribute your contribution.

## Development workflow

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/agentmux.git
cd agentmux

# 2. Install dependencies
npm install

# 3. Create a feature branch
git checkout -b yourname/feature-name

# 4. Start the dev server (Vite + host hot-reload)
task dev

# 5. Make changes
#    - Frontend changes auto-reload
#    - Rust crates: task build:backend (or task build:host) and restart task dev

# 6. Run tests
task test

# 7. Commit and push
git commit -m "feat: description of change"
git push -u origin yourname/feature-name

# 8. Open a pull request on GitHub
```

## Project structure

```
agentmux/
├── agentmux-launcher/        # 325 KB launcher: spawns the host, owns Layer 1 reducer
├── agentmux-cef/             # Host: embeds Chromium via CEF, owns the OS window
├── agentmux-srv/             # Sidecar: app domain — workspaces / tabs / blocks / agents / sagas
├── agentmux-common/          # Shared utilities: path resolution, runtime mode
├── frontend/                 # SolidJS + TypeScript renderer (Vite)
│   ├── app/view/             # Pane view implementations (term, browser, agent, forge, …)
│   ├── app/block/            # Block / pane rendering + registry
│   ├── app/store/            # State management (jotai atoms, slice stores, RPC client)
│   └── app/element/          # Reusable UI components
├── docs/                     # Specs, plans, status documents
│   └── specs/                # Architecture specs (read these for design context)
├── schema/                   # JSON schema definitions
└── Taskfile.yml              # Build tasks
```

### Where to look

| You're touching | Start here |
|---|---|
| A new pane type | `frontend/app/view/<view>/` + `frontend/app/block/block.tsx` to register |
| RPC commands the frontend calls | `agentmux-srv/src/server/app_api.rs` (high-level) or the per-domain handler files |
| Window / pool / OS state | `agentmux-launcher/src/reducer/` + `docs/specs/` |
| Browser pane behavior | `frontend/app/view/browser/` + `agentmux-cef/src/commands/browser.rs` |
| Persistence | `agentmux-srv/src/persist*.rs`, `agentmux-srv/src/sagas/`, `agentmux-launcher/src/event_log.rs` |
| Reducer-stack work | [`docs/specs/MASTER_REDUCER_STACK_STATUS_2026-05-05.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/MASTER_REDUCER_STACK_STATUS_2026-05-05.md) and [Discussion #707](https://github.com/agentmuxai/agentmux/discussions/707) — append PRs and analyses there, don't fork threads |

## Style

- **Language:** American English
- **Formatting:** Prettier + EditorConfig (`task format`)
- **TypeScript:** strict mode; prefer narrow return types; avoid `any`
- **Rust:** `cargo fmt` + `cargo clippy --workspace -- -D warnings` before pushing

## Pull request guidelines

- Branch from `main`; don't commit directly to `main`
- Link the relevant issue or spec in the PR body — every architectural change should reference a spec or discussion thread
- Bump the version using `bump-cli` (see below) — required for the `reagentx-workflow` bot
- For minor changes (a typo, a one-line fix), open a PR directly
- For major changes (a new pane type, a reducer slice, a saga refactor), open an issue or comment on [Discussion #707](https://github.com/agentmuxai/agentmux/discussions/707) first

### Reviews

Every PR is auto-reviewed by:

- **`reagentx-workflow[bot]`** — surfaces P1/P2/P3 issues; addresses correctness, missing tests, and consistency
- **`chatgpt-codex-connector[bot]`** — second-opinion review focused on code quality and architecture

Address every `CHANGES_REQUESTED` finding from reagent. Codex inline comments are P2-level signal — read both `/pulls/N/comments` (inline) and `/issues/N/comments` (top-level). Codex auto-fires on PR open and on `@codex review` comments.

### State-machine discipline

If your change touches the reducer stack or a saga:

- Read [`docs/specs/MASTER_REDUCER_STACK_STATUS_2026-05-05.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/MASTER_REDUCER_STACK_STATUS_2026-05-05.md) first
- For new slices, follow [`frontend-reducer-conventions-2026-05-03.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/frontend-reducer-conventions-2026-05-03.md) (Command/event types, slot lifecycle, audit, echo-loop guard)
- Test inputs MUST replay the production emit order; out-of-order tests give false confidence
- Property test inputs MUST pass the SUT's filter — add an anti-vacuity assertion before the property loop

These rules are written into the AgentA team's working memory because they each cost real PR rounds. The reducer-stack maintainers will push back hard on changes that don't follow them.

## Version management

Use `@a5af/bump-cli` for every version bump — never edit version numbers manually:

```bash
bump patch -m "Description of change" --commit
bump verify
```

`bump --commit` stages and commits **only** the version files. Stage and commit code changes **first**, separately — otherwise they'll be silently dropped.

See [Building from Source](/internals/building/) for full version management details.

## License

AgentMux is licensed under Apache-2.0. By contributing, you agree that your contributions will be licensed under the same terms.

## See also

- [Architecture overview](/internals/architecture/) — what each crate owns
- [Reducer stack](/internals/reducer-stack/) — the state model new contributors hit first
- [Debugging](/internals/debugging/) — log discovery + drift diagnostics
- [Building from Source](/internals/building/) — environment setup
- [Agent App API](/internals/agent-app-api/) — RPC surface
