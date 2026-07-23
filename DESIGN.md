# AgentMux Docs — Design Spec

Style guide for `agentmux-docs`, derived from `agentmux-landing` as the canonical design source.

---

## 1. Color Palette

All values are lifted verbatim from `agentmux-landing/src/styles/globals.css`.

### Dark mode (default)

| Role | Token | Value |
|---|---|---|
| Background | `--color-bg` | `#0a0a0f` |
| Background gradient end | `--color-bg-end` | `#0d0b1c` |
| Surface (card / panel) | `--color-surface` | `#111118` |
| Surface hover | `--color-surface-hover` | `#1a1a24` |
| Border | `--color-border` | `#1e293b` |
| Border hover | `--color-border-hover` | `#334155` |
| Text — primary | `--color-text` | `#e2e8f0` |
| Text — strong | `--color-text-strong` | `#ffffff` |
| Text — muted | `--color-text-muted` | `#94a3b8` |
| Brand / primary | `--color-primary` | `#6366f1` |
| Brand light (highlights) | `--color-primary-light` | `#818cf8` |
| Accent (cyan) | `--color-accent` | `#22d3ee` |
| Highlight (rose) | `--color-highlight` | `#be3455` |
| Highlight light | `--color-highlight-light` | `#e05474` |
| Success | `--color-ok` | `#22c55e` |
| Success light | `--color-ok-light` | `#4ade80` |
| Warning | `--color-warn` | `#f59e0b` |
| Warning light | `--color-warn-light` | `#fbbf24` |
| Warning badge bg | — | `#fbbf24` |
| Warning badge fg | — | `#451a03` |

### Light mode (`html.light`)

| Role | Value |
|---|---|
| Background | `#f8fafc` |
| Background gradient end | `#ede9ff` |
| Surface | `#ffffff` |
| Surface hover | `#f1f5f9` |
| Border | `#e2e8f0` |
| Border hover | `#94a3b8` |
| Text — primary | `#1e293b` |
| Text — strong | `#0f172a` |
| Text — muted | `#64748b` |
| Brand / primary | `#4f46e5` |
| Brand light | `#4f46e5` |
| Accent | `#0891b2` |
| Highlight | `#9b1b30` |
| Highlight light | `#c0384f` |
| Success | `#16a34a` |
| Warning | `#d97706` |

---

## 2. Typography

### Fonts

| Use | Family |
|---|---|
| UI / headings | `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` |
| Body / prose | `"SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace` |
| Code blocks | same as body (landing page is mono-first throughout) |

> The landing page is monospace-first for body copy. The docs site currently uses sans-serif for body (`--sl-font`) and mono for code (`--sl-font-mono`). This is intentional — Starlight prose is more readable in sans; mono is reserved for code. Keep as-is.

### Scale (landing page reference)

| Element | Size | Weight | Notes |
|---|---|---|---|
| h1 | `clamp(3rem, 2rem + 1.5vw, 5rem)` | 700 | tracking-tight, lh 1.05 |
| h2 | `clamp(1.875rem, 1.25rem + 1vw, 3.25rem)` | 700 | leading-tight |
| Feature heading (wide) | `text-2xl` (1.5rem) | 600 | |
| Body | `text-base`–`text-lg` | 400 | leading-relaxed |
| Label / tag | `text-xs`–`text-sm` | 500 | uppercase, tracking-wide |

---

## 3. Spacing

Landing page uses Tailwind defaults. Key values:

| Context | Value |
|---|---|
| Section vertical padding | `py-24` (6rem) — `py-28` (7rem) |
| Card padding | `p-6` (1.5rem) — `p-8` (2rem) |
| Component gap | `gap-4` (1rem) — `gap-8` (2rem) |
| Nav padding | `px-6 py-4` |
| Button (primary) | `px-6 py-3` |
| Button (secondary) | `px-4 py-2` |

---

## 4. Shape & Elevation

| Property | Value |
|---|---|
| Border radius | **`0px` (sharp corners everywhere)** — set via `@theme { --radius-*: 0px }` |
| Shadows | Not used for elevation; layering via border + surface bg color |
| Backdrop blur | `backdrop-blur-md` (dropdowns, overlays) |

---

## 5. Breakpoints

Landing page extends Tailwind with ultra-wide breakpoints:

| Name | Min-width |
|---|---|
| `3xl` | 1920px |
| `4xl` | 2560px |
| `5xl` | 3440px |

Container widths scale up to 120rem at 5xl. Docs inherits Starlight's own breakpoints; no action needed unless adding ultra-wide layouts.

---

## 6. Mapping to Starlight CSS Variables

Current `custom.css` alignment with the landing palette:

| Starlight token | Current value | Landing source | Status |
|---|---|---|---|
| `--sl-color-accent-low` | `#1e1b4b` dark / `#eef2ff` light | — | ✓ ok (Starlight internal use) |
| `--sl-color-accent` | `#6366f1` | `--color-primary` | ✓ matches |
| `--sl-color-accent-high` | `#818cf8` dark / `#3730a3` light | `--color-primary-light` dark ✓ / light diverges | Δ light mode uses darker blue; landing uses `#4f46e5` — update if needed |
| `--sl-color-gray-1` (text) | `#e2e8f0` dark / `#1e293b` light | `--color-text` | ✓ matches |
| `--sl-color-gray-2` (muted) | `#94a3b8` dark / `#475569` light | `--color-text-muted` dark ✓ / light is `#64748b` | Δ light mode muted text is `#475569`, matching neither the old `#334155` nor the `#64748b` recommendation below |
| `--sl-color-gray-3` (muted-2) | `#7c8aa0` dark / `#64748b` light | between muted/border | ✓ reasonable |
| `--sl-color-gray-4` (surface) | `#111118` dark / `#94a3b8` light | `--color-surface` is `#111118` | ✓ applied — matches landing |
| `--sl-color-gray-5` (surface-2) | `#0d0b1c` dark / `#cbd5e1` light | `--color-bg-end` dark ✓ | ✓ dark matches |
| `--sl-color-gray-6` (bg) | `#0a0a0f` dark / `#f8fafc` light | `--color-bg` dark ✓ / light is `#f8fafc` | ✓ applied — matches landing |
| `--sl-color-black` | `#050508` dark / `#ffffff` light | near `--color-bg` | ✓ ok |
| `--sl-color-white` | `#ffffff` dark / `#181926` light | `--color-text-strong` | ✓ ok |
| `--sl-font` | system sans | UI / headings font | ✓ correct choice for docs prose |
| `--sl-font-mono` | SF Mono, Fira Code… | landing body font | ✓ matches |

### Recommended fixes

1. ~~**Light mode `--sl-color-gray-6`** → `#f8fafc`~~ — done.
2. **Light mode `--sl-color-gray-2`** → `#64748b` (current `#475569` is still darker than landing's muted text; a prior pass moved this from `#334155` toward the target but didn't land on it)
3. ~~**Dark mode `--sl-color-gray-4`** → `#111118`~~ — done.

---

## 7. Dark/Light Mode Toggle

Landing: `ThemeToggle.tsx` adds/removes `html.light` class, persists to `localStorage("theme")`.  
Docs: Starlight handles this via its own `<ThemeSelect>` component with `data-theme` attribute on `:root`. The two systems are independent; no sync needed.

---

## 8. Motion

Landing defines reveal animations (translateY 8px → 0, opacity 0 → 1) on scroll via Intersection Observer.  
Docs: all motion hacks removed from `custom.css` except the sidebar scroll guard (opacity guard on `#starlight__sidebar`, lifted by `.sl-scroll-ready` at DOMContentLoaded). No additional motion needed.

Wrap any future motion in `@media (prefers-reduced-motion: no-preference)`.
