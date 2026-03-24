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

No CDK. Static S3 + CloudFront, deployed manually:

```bash
npm run build
aws s3 sync dist/ s3://agentmux-docs-prod/ --delete
aws cloudfront create-invalidation --distribution-id EF4XTPT79GHLS --paths "/*"
```

- **S3 Bucket:** `agentmux-docs-prod`
- **CloudFront:** `EF4XTPT79GHLS`
- **Domain:** `docs.agentmux.ai` (Route53 alias to CloudFront, uses `*.agentmux.ai` wildcard cert)

### Content Source

Documentation content is sourced from the main `agentmuxai/agentmux` repository codebase. When updating docs, reference the app's actual source code for accuracy.

## Build

```bash
npm run build    # Full production build (outputs to dist/)
npm run dev      # Local dev server
```

## Review Checklist

- Version bumped in package.json for code changes
- `npm run build` passes (check page count in output)
- Both dark AND light mode tested when changing `custom.css`
- Logo/image assets go in `src/assets/` (Astro optimizes them), not `public/`
- Favicons go in `public/` (served as-is)
