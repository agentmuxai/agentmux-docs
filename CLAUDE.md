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
- **Selectors matter.** Dark mode uses `:root`. Light mode MUST use `:root[data-theme='light']` to match Starlight's specificity. Using `[data-theme='light']` without `:root` will be overridden.

### Deployment

No CDK. Static S3 + CloudFront. **Deploys automatically** via `.github/workflows/deploy.yml`
on every push to `main` (added 2026-06-27, PR #97) — merging a PR *is* deploying to
production. There is no separate manual step in the normal flow; don't tell a user
"merged, but not deployed" without checking the workflow run.

The CI job runs exactly this sequence (also useful to reproduce locally when debugging
a failed run):

```bash
git submodule update --init --recursive   # one-time, makes src/agentmux available
npm run build:full                         # build:typedoc + build:rust-docs + build

# 1. Sync non-HTML assets first (new CSS/JS available before old ones are removed)
aws s3 sync dist/ s3://<docs-bucket>/ --delete --exclude "*.html"
# 2. Force-upload all HTML files (bypasses mtime comparison — normalize-mtimes sets
#    a fixed epoch so s3 sync skips HTML when only the CSS hash inside it changes)
aws s3 cp dist/ s3://<docs-bucket>/ --recursive --exclude "*" --include "*.html"

# 3. Invalidate CF and wait for full propagation before reporting success
INVAL=$(aws cloudfront create-invalidation --distribution-id <distribution-id> --paths "/*" --query 'Invalidation.Id' --output text)
aws cloudfront wait invalidation-completed --distribution-id <distribution-id> --id $INVAL

# 4. Verify — CSS hash in live HTML must match what's in S3/_astro/
curl -s "https://docs.agentmux.ai/user-guide/" | grep -o 'href="[^"]*common[^"]*\.css"'
aws s3 ls s3://<docs-bucket>/_astro/ | grep common
```

**Why the two-step sync:** `normalize-mtimes.mjs` sets all dist file mtimes to a fixed
epoch so unchanged files aren't re-uploaded. But when the CSS bundle hash changes, the
HTML files referencing it have the same byte length and the same mtime → `s3 sync` skips
them. The old CSS gets deleted but the stale HTML stays → CF serves HTML that references
a missing CSS file → site unstyled. Always force-upload HTML separately.

**`build:full` is required for production.** Plain `npm run build` skips the typedoc and rustdoc generation steps, which means `/api/typescript/` and `/api/rust/` would be served as fallback indices that link to crate paths the `--delete` sync just removed. Use `build:full` so the dist tree includes the generated reference content. The CI workflow always uses `build:full`; only fall back to plain `build` for local style/structure iteration (see Build section below).

`build:full` requires:
- `cargo` on `PATH` (rustup minimal toolchain is enough).
- The `src/agentmux` submodule initialized.
- On Linux, the -sys crates' dev packages: `pkg-config libwayland-dev libxkbcommon-dev libdbus-1-dev libxcb1-dev` (the deploy workflows install them). No CEF download is needed: `agentmux-cef` is documented with `--features cef/dox`.

If any of these is missing, or `cargo doc` fails, `build:rust-docs` behaves differently by environment. Locally it warns and exits 0, and `/api/rust/` shows only the placeholder, whose crate links 404. In CI (`CI` set, as on GitHub Actions) it exits 1 and fails the deploy, so a broken Rust reference can't go live unseen again (#131). `RUST_DOCS_OPTIONAL=1` restores the lenient behaviour in CI for a deliberate one-off deploy.

- **AWS account / S3 bucket / CloudFront distribution / deploy role:** shown above as
  placeholders (`<docs-bucket>`, `<distribution-id>`), but the concrete values are hardcoded
  directly in `.github/workflows/deploy.yml` (and `deploy-prod.yml`) in this repo — account
  `167667034757`, bucket `agentmux-docs-prod-167667034757`, distribution `E4EAW1TLB65KC`,
  role `arn:aws:iam::167667034757:role/agentmux-docs-deploy`. There is no private
  infrastructure repo holding these; check the workflow files directly.
- **Domain:** `docs.agentmux.ai` (DNS alias to the CloudFront distribution)
- **Deploy status:** `gh run list --repo agentmuxai/agentmux-docs --workflow deploy.yml` — check this after merging, don't assume success

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

## Changesets (required on every PR)

Every PR adds a changeset: `scripts/changeset.sh <patch|minor|major> "<one-line summary>"`, then commit the file it writes to `.changesets/`. The `changeset` CI check fails without one; a PR that genuinely needs no entry gets the `no-changeset` label. See `.changesets/README.md`.
