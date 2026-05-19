# Spec: Two-Tone "AgentMux" Site Title in Docs Header

## Problem

The "AgentMux" wordmark at the top-left of the landing page (`agentmux.ai`) and the docs site (`docs.agentmux.ai`) render differently:

- **Landing (`Nav.tsx`):** `<span class="text-[var(--color-primary-light)]">Agent</span>Mux` — "Agent" is colored with the brand primary accent, "Mux" is in the default text color.
- **Docs (Starlight default):** "AgentMux Docs" rendered as a single uniform-color string via Starlight's built-in `SiteTitle` component.

## Goal

Make the docs header wordmark match the landing page by:
1. Coloring "Agent" with the brand accent color (`--sl-color-accent-high`)
2. Leaving "Mux" in the default text color
3. Dropping the " Docs" suffix from the visible wordmark (title stays in config for SEO/tab title)

## Approach

Override Starlight's `SiteTitle` component with a custom Astro component at `src/components/SiteTitle.astro`. Wire it up in `astro.config.mjs` via the `components` override map.

### Component behavior
- Renders the logo SVG (from `Astro.props.logo`) on the left
- Renders `<span class="agent-text">Agent</span>Mux` as the wordmark
- "Agent" color: `var(--sl-color-accent-high)` (already defined in `custom.css` for both dark/light)
- Wraps in an `<a>` pointing to site root

### CSS
One rule added to `custom.css`:
```css
.site-title-agent { color: var(--sl-color-accent-high); }
```

## Files changed
- `src/components/SiteTitle.astro` — new custom component
- `src/styles/custom.css` — one new CSS rule
- `astro.config.mjs` — add `components.SiteTitle` override

## Non-goals
- No font changes
- No layout changes to the header
- Landing page is not touched
