---
title: "Contributing"
---

We welcome contributions to AgentMux. Here's how to get involved.

## Ways to Contribute

- Report bugs or request features via [GitHub Issues](https://github.com/agentmuxai/agentmux/issues)
- Fix outstanding [issues](https://github.com/agentmuxai/agentmux/issues)
- Improve documentation
- Star the repository

Please respect our [Code of Conduct](https://github.com/agentmuxai/agentmux/blob/main/CODE_OF_CONDUCT.md).

## Getting Started

1. [Build from source](/building) — Set up your development environment
2. Create a feature branch from `main`
3. Make your changes
4. Submit a pull request

### Branch Naming

Use the format: `yourname/feature-description`

```bash
git checkout -b yourname/fix-terminal-scroll
```

### Contributor License Agreement

On your first pull request, you'll be prompted to sign a CLA. You retain copyright — this gives us permission to distribute your contribution.

## Development Workflow

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/agentmux.git
cd agentmux

# 2. Install dependencies
npm install

# 3. Create feature branch
git checkout -b yourname/feature-name

# 4. Start dev server
task dev

# 5. Make changes
# - Frontend changes auto-reload
# - Rust backend changes: task build:backend, restart task dev

# 6. Run tests
task test

# 7. Commit and push
git commit -m "feat: description of change"
git push -u origin yourname/feature-name

# 8. Open a pull request on GitHub
```

## Project Structure

```
agentmux/
├── src-tauri/              # Tauri v2 shell (Rust)
├── agentmuxsrv-rs/         # Rust async backend (Tokio + Axum)
├── wsh-rs/                 # Shell integration binary (Rust)
├── frontend/               # SolidJS + TypeScript (Vite)
│   ├── app/view/           # Pane view implementations
│   ├── app/block/          # Block/pane rendering
│   ├── app/store/          # State management
│   └── app/element/        # Reusable UI components
├── schema/                 # JSON schema definitions
├── docs/                   # Architecture docs and specs
└── Taskfile.yml            # Build tasks
```

### Key Directories

- **`frontend/app/view/`** — Each pane type has its own directory (agent, term, forge, sysinfo, etc.)
- **`frontend/app/block/block.tsx`** — Block registry where view types are registered
- **`frontend/app/store/`** — State management and RPC client
- **`agentmuxsrv-rs/src/`** — Rust backend (block controllers, WebSocket, SQLite, PTY)

## Style Guide

- **Language:** American English
- **Formatting:** [Prettier](https://prettier.io) and [EditorConfig](https://editorconfig.org)
- **UI Components:** Documented in [Storybook](https://storybook.js.org) — run `task storybook`

## Pull Request Guidelines

- Check existing PRs and issues before starting
- Develop on a branch — never work directly on `main`
- Include tests for anything beyond minor fixes
- Reference the relevant issue in your PR body
- For minor changes, open a PR directly
- For major changes, [create an issue](https://github.com/agentmuxai/agentmux/issues/new) first to discuss

## Version Bumping

If your change affects the published package, bump the version before committing:

```bash
bump patch -m "Description of change" --commit
bump verify
```

See [Building from Source](/building) for full version management details.

## License

AgentMux is licensed under Apache-2.0. By contributing, you agree that your contributions will be licensed under the same terms.

## See Also

- [Building from Source](/building) — Development setup
- [Agent App API](/agent-app-api) — RPC API reference
