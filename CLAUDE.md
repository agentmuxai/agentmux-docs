# AgentMux Docs

## Project

- **Site:** https://docs.agentmux.ai
- **Framework:** Astro + Starlight (static docs site)
- **GitHub:** agentmuxai/agentmux-docs
- **Type:** Static MPA (no client-side routing, no SPA)

## Architecture

Starlight generates a fully static multi-page site. Every page is a standalone HTML file — there is no client-side router or JS framework hydration.

### Key Files

| Path | Purpose |
|------|---------|
| `astro.config.mjs` | Starlight config: sidebar, social links, logo, favicon, custom CSS |
| `src/content/docs/*.md` | Documentation pages (Markdown with frontmatter) |
| `src/styles/custom.css` | Theme overrides — colors, fonts (synced with agentmux.ai) |
| `src/assets/logo.svg` | Site logo (used via Astro image import, NOT public/) |
| `public/favicon.svg` | Favicon (SVG) |
| `public/favicon.ico` | Favicon (ICO fallback) |

### Starlight Theming

Custom CSS overrides Starlight's CSS custom properties. Key details:

- **Gray scale is INVERTED between dark and light mode.** In dark mode, `gray-1` is the lightest color (text) and `gray-6` is the darkest (background). In light mode, `gray-1` is the darkest (text) and `gray-6` is the lightest (background).
- **`--sl-color-white` and `--sl-color-black` swap semantic meaning.** In dark mode, `white` = white text. In light mode, `white` = dark text color. `black` is the opposite.
- **`--sl-color-gray-7` exists only in light mode.** It's used for `--sl-color-bg-nav` (the navigation background). It is a valid Starlight variable despite only appearing in light mode definitions.
- **No workarounds for the AgentMux browser pane.** Don't hide, delay, fade or re-lay-out page chrome (header, sidebar, body) to mask how the AgentMux app's browser pane renders the site, for example its resize during load. Such masks become flashes in every other browser: the header and sidebar guards removed on 2026-10-05 did exactly that. A rendering problem that appears only in the pane is a bug in agentmuxai/agentmux; file it there. Don't hide page chrome until JavaScript runs at all, and test UI changes in a standard browser, cold and warm cache.
- **Selectors matter.** Dark mode uses `:root`. Light mode MUST use `:root[data-theme='light']` to match Starlight's specificity. Using `[data-theme='light']` without `:root` will be overridden.

### Deployment

No CDK. Static S3 + CloudFront. **Deploys are on demand** via `.github/workflows/deploy.yml`
(`workflow_dispatch` only, since 2026-11-01, to save cost). **A merge to `main` publishes
nothing:** the change reaches `docs.agentmux.ai` only when someone runs the workflow. Don't
tell a user a merged change is live; say it is merged and waits for the next deploy.

How it behaves:

- **Run it by hand:** `gh-agent workflow run deploy.yml -R agentmuxai/agentmux-docs` (it builds
  `main`). Ask the person who owns releases before you do: the plan is one deploy per
  AgentMux release, and each run costs money.
- **A newer run cancels one still running** (`concurrency: deploy-prod`,
  `cancel-in-progress: true`). Only the latest run has to succeed.
- **It takes about 4–7 minutes** (median 4.7 over the 37 successful runs from 2026-10-05 to
  2026-10-20). The page is live when the run is green: its last step checks the live site.
- **PRs still build and check links.** `pr-check.yml` runs `build:typedoc` + `build` (not
  `build:full`) and skips `/api/rust/` in its link check, so a broken `cargo doc` shows up
  only in the deploy run, which then fails before uploading anything.

The CI job runs exactly this sequence (also useful to reproduce locally when debugging
a failed run):

```bash
git submodule update --init --recursive   # one-time, makes src/agentmux available
npm run build:full                         # build:typedoc + build:rust-docs + build
node scripts/check-links.mjs               # every link and #anchor; a failure stops the deploy before upload

# 1. Sync non-HTML assets first, without --delete (new CSS/JS is there before anything is removed)
aws s3 sync dist/ s3://<docs-bucket>/ --exclude "*.html"
# 2. Upload the HTML whose content changed (MD5 against the object's ETag), then delete every
#    key dist/ no longer has, HTML included. Add --dry-run to see the counts and change nothing.
node scripts/publish-html.mjs --bucket <docs-bucket>

# 3. Invalidate CF and wait for full propagation before reporting success
INVAL=$(aws cloudfront create-invalidation --distribution-id <distribution-id> --paths "/*" --query 'Invalidation.Id' --output text)
aws cloudfront wait invalidation-completed --distribution-id <distribution-id> --id $INVAL

# 4. Verify — CSS hash in live HTML must match what's in S3/_astro/
curl -s "https://docs.agentmux.ai/user-guide/" | grep -o 'href="[^"]*common[^"]*\.css"'
aws s3 ls s3://<docs-bucket>/_astro/ | grep common
```

**Why HTML has its own step:** `normalize-mtimes.mjs` sets all dist file mtimes to a fixed
epoch so unchanged files aren't re-uploaded. But when the CSS bundle hash changes, the
HTML files referencing it have the same byte length and the same mtime → `s3 sync` skips
them. The old CSS gets deleted but the stale HTML stays → CF serves HTML that references
a missing CSS file → site unstyled. So HTML never goes through `s3 sync`:
`scripts/publish-html.mjs` compares content, so a deploy uploads only the pages that
changed (it used to re-upload all of them, about 15k PUTs, every time). It also deletes
the keys `dist/` no longer has, HTML included, after the new HTML is up: stale rustdoc and
typedoc pages used to pile up in the bucket and stay reachable. It refuses to delete when
`dist/` looks broken (too few files, no `index.html` / `user-guide/index.html`, or the plan would delete more than half the bucket,
which means a section such as the Rust reference is missing; `--allow-large-delete` overrides). Its
unit tests run in the PR check (`node --test scripts/publish-html.test.mjs`).

**`build:full` is required for production.** Plain `npm run build` skips the typedoc and rustdoc generation steps, which means `/api/typescript/` and `/api/rust/` would be served as fallback indices that link to crate paths that the publish step's delete pass just removed. Use `build:full` so the dist tree includes the generated reference content. The CI workflow always uses `build:full`; only fall back to plain `build` for local style/structure iteration (see Build section below).

`build:full` requires:
- `cargo` on `PATH` (rustup minimal toolchain is enough).
- The `src/agentmux` submodule initialized.
- On Linux, the -sys crates' dev packages: `pkg-config libwayland-dev libxkbcommon-dev libdbus-1-dev libxcb1-dev` (the deploy workflow installs them). No CEF download is needed: `agentmux-cef` is documented with `--features cef/dox`.

If any of these is missing, or `cargo doc` fails, `build:rust-docs` behaves differently by environment. Locally it warns and exits 0, and `/api/rust/` shows only the placeholder, whose crate links 404. In CI (`CI` set, as on GitHub Actions) it exits 1 and fails the deploy, so a broken Rust reference can't go live unseen again (#131). `RUST_DOCS_OPTIONAL=1` restores the lenient behaviour in CI for a deliberate one-off deploy.

- **AWS account / S3 bucket / CloudFront distribution / deploy role:** shown as placeholders
  (`<account-id>`, `<docs-bucket>`, `<distribution-id>`, `<deploy-role>`). `deploy.yml` reads the
  real values from the repository's Actions secrets (`DOCS_BUCKET`, `DOCS_DISTRIBUTION_ID`,
  `DOCS_DEPLOY_ROLE_ARN`); the resources are defined in a private infrastructure repo.
  This repository is public: never write those values into a file, commit message or PR.
- **Domain:** `docs.agentmux.ai` (DNS alias to the CloudFront distribution)
- **Deploy status:** `gh-agent run list --repo agentmuxai/agentmux-docs --workflow deploy.yml` — check this after you run a deploy, don't assume success (agents use `gh-agent`; plain `gh` is not signed in for them)

### Content Source

Documentation content is sourced from the main `agentmuxai/agentmux` repository codebase. When updating docs, reference the app's actual source code for accuracy.

## Build

```bash
npm run build       # Local/iterative build — skips typedoc + rustdoc
npm run build:full  # Production build — runs typedoc + rustdoc, then build
npm run dev         # Local dev server
```

Use `build:full` before any production deploy. `build` is fine for iterating on docs site styling/structure.

## Review Checklist

- Version bumped in package.json for code changes (still done in the PR here: this repo has no release step; the changeset is the changelog entry, not the version bump)
- `npm run build` passes (check page count in output); for prod-bound PRs, `npm run build:full` passes and `dist/api/{typescript,rust}/` contain real reference content (not just the umbrella index)
- Both dark AND light mode tested when changing `custom.css`
- No CSS or head script that hides or delays page chrome until JS runs, or that works around the AgentMux browser pane (see Starlight Theming)
- Logo/image assets go in `src/assets/` (Astro optimizes them), not `public/`
- Favicons go in `public/` (served as-is)

## Post-Deploy Verification (required)

`deploy.yml`'s own last step already does this check in CI and fails the run on a
mismatch — this manual version is for confirming a deploy that happened outside CI
(a manual re-run of the sequence above) or for debugging a run that reported success
but the site still looks stale:

```bash
# CSS hash in live page must match what's in S3
curl -s "https://docs.agentmux.ai/user-guide/" | grep -o 'href="[^"]*\.css"'
aws s3 ls s3://<docs-bucket>/_astro/ | grep css
# Hashes must match. If not: HTML wasn't uploaded — run the force-upload step again.
```

## Weekly drift pass (Mondays)

The docs describe the app as it is today. Each Monday one agent compares them with the week's changes to agentmux `main` and fixes the drift in one PR. The comparison is the same one every time, so any agent can run it.

1. **Find the window.** The last pass is the last commit that moved the `src/agentmux` pin (`git log -1 --format=%cs -- src/agentmux`). Fetch agentmux and note its `main` commit and the version in its `VERSION_HISTORY.md`.
2. **List what merged.** `VERSION_HISTORY.md` entries above the pin's version are the hint; the merged PRs and their changesets are the source: `gh-agent pr list --repo agentmuxai/agentmux --state merged --search "merged:>=<last pass date>" --limit 200 --json number,title,files`. Keep what a user or an agent can see or call: panes, menus, settings, keys, tools and their actions, commands, defaults, limits, removed features and renames. Skip internal work (refactors, CI, tests, UI-kit changes with no visible effect).
3. **Check each one against the docs.** `rg -n -i "<the term>" src/content` for the feature's name, its old name, its setting key and its tool action. Then read the code, not the changelog line, for the exact labels, defaults and behaviour. Sort each into: *undocumented*, *wrong* (the page says something the code no longer does), or *removed* (the page describes something that is gone: delete it and every link to it).
4. **Move the pin.** In `src/agentmux` check out the `main` commit you compared against, then `git add src/agentmux`. The build checks every source link (`frontend/app/...` in backticks) at the pin, so a cited file that no longer exists fails it: fix or drop the citation.
5. **Write the fix.** One PR for the week's drift, titled `docs: the week's drift (<first version>–<last version>)`. Follow the pages' own style (second person, present tense, the labels exactly as the app spells them). Screenshots that are now wrong are retaken from the released app, never from a dev build. A changeset, `npm run build` and `node scripts/check-links.mjs` before you push.
6. **Say what is left.** End the PR body with a short list of what is still undocumented or unverified and why. Merge on approval, then send the requester one line: the PR and that list.

Public repo rules apply to everything above: describe the product's behaviour only. No private repository contents, secret-store details, cloud resource names, account ids or incident data.

## Changesets (required on every PR)

Every PR adds a changeset: `scripts/changeset.sh <patch|minor|major> "<one-line summary>"`, then commit the file it writes to `.changesets/`. The `changeset` CI check fails without one; a PR that genuinely needs no entry gets the `no-changeset` label. See `.changesets/README.md`.
