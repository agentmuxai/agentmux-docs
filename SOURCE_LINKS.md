# Source Link Spec — GitHub file & line hyperlinking

Auto-convert source file references in docs prose and tables into hyperlinks
pointing at the corresponding location in the agentmux GitHub repo.

**Target repo:** `https://github.com/agentmuxai/agentmux/blob/main/`  
**Approach:** Two Astro/remark/rehype plugins — one for inline text, one for tables.

---

## 1. Pattern inventory

Audit of all 11 reference patterns found across 91 doc files:

| # | Pattern | Example | Files |
|---|---------|---------|-------|
| P1 | Inline code — file path only | `` `agentmux-srv/src/server/mod.rs` `` | prose, source sections |
| P2 | Inline code — path + single line | `` `layoutModel.ts:359` `` | prose, API refs |
| P3 | Inline code — path + line range | `` `types.ts:269-336` `` | prose, watchdog tables |
| P4 | Table cell — bare line number | `506–611` in a "Lines" column | env-vars.md, state-model.md |
| P5 | Plain text path (no backticks) | `agentmux-srv/src/main.rs` in prose | lan-discovery.md |
| P6 | `## Source` bullet list | `` - `agentmux-srv/src/server/reactive.rs` — HTTP handlers `` | reactive-event-bus.md, warden.md, lan-discovery.md |
| P7 | Existing GitHub markdown link | `[termwrap.ts](https://github.com/...)` | clipboard.md, browser-pane.md |
| P8 | Abbreviation glossary | `` `shell.rs` = `agentmux-srv/src/backend/blockcontroller/shell.rs` `` | env-vars.md |
| P9 | Path in code comment | `// frontend/util/clipboard.ts` inside a code block | clipboard.md |
| P10 | Structured reference table | File column + separate Lines column | env-vars.md, state-model.md |
| P11 | Spec/markdown doc ref | `` `docs/specs/MASTER_REDUCER_STACK_STATUS_2026-05-05.md` `` | reducer-stack.md, contributing.md |

---

## 2. Scope — what to automate

| Pattern | Automate? | Notes |
|---------|-----------|-------|
| P1 | **Yes** | Core case — backticked path → GitHub blob link |
| P2 | **Yes** | Backticked path:line → blob + `#L{n}` |
| P3 | **Yes** | Backticked path:start-end → blob + `#L{start}-L{end}` |
| P4 | **Yes** | Table row where another cell has a P1–P3 ref — link bare numbers to same file |
| P5 | **No** | False positive risk too high (prose words that happen to look like paths) |
| P6 | **Yes** | Bullet list items already use backticked paths → handled by P1 rule |
| P7 | **No** | Already linked — skip |
| P8 | **Plugin config** | Support `aliases` map; env-vars.md defines it in its preamble |
| P9 | **No** | Inside fenced code blocks — must not mutate |
| P10 | **Yes** | Separate rehype plugin for table-level linking |
| P11 | **Yes** | Same plugin as P1–P3; spec files link to `docs/specs/` in the repo |

---

## 3. File detection heuristic

A backticked inline code value is treated as a source reference if it matches **all** of:

1. **Has a recognised extension** (last path segment ends in one of):
   `.rs` `.ts` `.tsx` `.js` `.mjs` `.cjs` `.toml` `.json` `.md` `.sh` `.ps1` `.scss` `.css`
2. **Has a path separator** (`/`) OR is a known short-name alias (from `aliases` config)
3. **Does NOT start with `http`** (already a URL — skip)
4. **Does NOT contain spaces** (prose phrases, not paths)
5. **Does NOT contain special shell characters** that aren't valid in file paths (`$`, `{`, `}`, `*`, `?`)
6. Optionally followed by `:N` or `:N-M` (line annotation)

This deliberately excludes:
- Plain symbol names like `` `isStreamSubscribed` ``
- Shell commands like `` `npm ci` ``
- Header values like `` `X-AuthKey` ``
- Config keys like `` `esbuild` ``

---

## 4. URL construction

| Input | Output URL |
|-------|-----------|
| `` `agentmux-srv/src/reducer.rs` `` | `.../agentmux-srv/src/reducer.rs` |
| `` `types.ts:658` `` | `.../types.ts#L658` |
| `` `types.ts:269-336` `` | `.../types.ts#L269-L336` |
| `` `types.ts:269–336` `` (em-dash) | same — normalise dash chars to `-` before parsing |
| `` `shell.rs:604` `` + alias `shell.rs → agentmux-srv/src/backend/blockcontroller/shell.rs` | `.../agentmux-srv/src/backend/blockcontroller/shell.rs#L604` |
| `` `docs/specs/MASTER_REDUCER_STACK_STATUS_2026-05-05.md` `` | `.../docs/specs/MASTER_REDUCER_STACK_STATUS_2026-05-05.md` |
| `` `specs/lan-discovery-toggle.md` `` | `.../docs/specs/lan-discovery-toggle.md` (prefix `specs/` → `docs/specs/`) |

Base: `https://github.com/agentmuxai/agentmux/blob/main/`

---

## 5. Plugin A — `remark-github-source-links`

**Stage:** remark (Markdown AST)  
**Language:** ES module, `plugins/remark-github-source-links.mjs`

### What it does

Visits every `inlineCode` node. If the value passes the heuristic:

1. Parse `value` into `{ filePath, lineStart?, lineEnd? }`
2. Resolve aliases if configured
3. Construct the GitHub URL
4. Replace the `inlineCode` node with a `link` node wrapping an `inlineCode` child — preserving the monospace rendering while making it a hyperlink

```
inlineCode { value: "types.ts:269-336" }
  →
link { url: "https://github.com/…/types.ts#L269-L336" }
  └── inlineCode { value: "types.ts:269-336" }
```

The text shown to the reader is unchanged. Only the node type changes.

### Config

```js
// astro.config.mjs
import remarkGithubSourceLinks from './plugins/remark-github-source-links.mjs';

markdown: {
  remarkPlugins: [
    [remarkGithubSourceLinks, {
      baseUrl: 'https://github.com/agentmuxai/agentmux/blob/main/',
      // Short aliases used in env-vars.md and other files
      aliases: {
        'shell.rs':           'agentmux-srv/src/backend/blockcontroller/shell.rs',
        'data_paths.rs':      'agentmux-common/src/data_paths.rs',
        'runtime_mode.rs':    'agentmux-common/src/runtime_mode.rs',
        'srv_spawner.rs':     'agentmux-launcher/src/srv_spawner.rs',
        'launcher/main.rs':   'agentmux-launcher/src/main.rs',
        'shellintegration.rs':'agentmux-srv/src/backend/shellintegration.rs',
        'websocket.rs':       'agentmux-srv/src/server/websocket.rs',
      },
      // Map path prefix to repo prefix (for spec docs)
      pathMap: {
        'specs/': 'docs/specs/',
      },
    }],
  ],
}
```

### Implementation sketch

```js
// plugins/remark-github-source-links.mjs
import { visit } from 'unist-util-visit';

const EXTENSIONS = /\.(rs|ts|tsx|js|mjs|cjs|toml|json|md|sh|ps1|scss|css)$/;
const LINE_SUFFIX = /^(.+?)(?::(\d+)(?:[-–](\d+))?)?$/;

export default function remarkGithubSourceLinks(opts = {}) {
  const { baseUrl, aliases = {}, pathMap = {} } = opts;

  return (tree) => {
    visit(tree, 'inlineCode', (node, index, parent) => {
      const raw = node.value;

      // Skip if already inside a link
      if (parent?.type === 'link') return;

      // Parse path + optional line(s)
      const m = LINE_SUFFIX.exec(raw);
      if (!m) return;
      let [, path, lineStart, lineEnd] = m;

      // Must have a recognised extension
      if (!EXTENSIONS.test(path)) return;

      // Must have a slash OR be a known alias
      if (!path.includes('/') && !aliases[path]) return;

      // Skip if it looks like a URL
      if (path.startsWith('http')) return;

      // Resolve alias
      let resolved = aliases[path] ?? path;

      // Apply path prefix remapping
      for (const [prefix, replacement] of Object.entries(pathMap)) {
        if (resolved.startsWith(prefix)) {
          resolved = replacement + resolved.slice(prefix.length);
          break;
        }
      }

      // Build URL
      let url = baseUrl + resolved;
      if (lineStart) {
        url += `#L${lineStart}`;
        if (lineEnd) url += `-L${lineEnd}`;
      }

      // Rewrite node: inlineCode → link > inlineCode
      parent.children[index] = {
        type: 'link',
        url,
        title: null,
        children: [{ type: 'inlineCode', value: raw }],
      };
    });
  };
}
```

---

## 6. Plugin B — `rehype-github-source-table`

**Stage:** rehype (HTML AST, after remark)  
**Language:** ES module, `plugins/rehype-github-source-table.mjs`

### The problem

In structured reference tables (Pattern 10), file path and line numbers appear in **separate columns** of the same row:

```markdown
| PTY env injection | `agentmux-srv/src/.../shell.rs` | 506–611 |
```

Plugin A handles the middle cell (`shell.rs`). Plugin B handles the right cell (`506–611`) — a bare number or range with no file context, which requires looking sideways at its sibling cell.

### Detection rule

For each `<tr>` in a `<table>`:
1. Scan cells left-to-right for any cell whose text content (after stripping tags) **already contains a GitHub link** (i.e., Plugin A already converted it) — that link's `href` is the **row file**.
2. For every subsequent cell in the same row whose entire text content matches `^\d+[–-]\d+$` or `^\d+$` (bare number/range, no other text), convert the cell text into:
   ```html
   <a href="{rowFile}#L{n}" class="src-line">{original text}</a>
   ```
   where `{n}` is the line number (for a range, `{n}-L{m}`).

### Why rehype (not remark)

Table cell siblings are represented as a flat list of `tableCell` nodes in `mdast`, but the file link in a sibling cell won't be resolved until Plugin A has run. Operating at the rehype stage lets Plugin B see the already-rendered `<a>` tags from Plugin A, making detection trivial — just look for an `<a href="https://github.com/…">` in a sibling `<td>`.

### Config

```js
// astro.config.mjs
import rehypeGithubSourceTable from './plugins/rehype-github-source-table.mjs';

markdown: {
  rehypePlugins: [rehypeGithubSourceTable],
}
```

No config needed — it detects GitHub links already placed by Plugin A.

### Implementation sketch

```js
// plugins/rehype-github-source-table.mjs
import { visit } from 'unist-util-visit';
import { toString } from 'hast-util-to-string';

const BARE_LINES = /^(\d+)[–-](\d+)$|^(\d+)$/;

export default function rehypeGithubSourceTable() {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'tr') return;

      let rowFileUrl = null;

      for (const cell of node.children.filter(c => c.type === 'element')) {
        // Find first GitHub link in this cell
        const link = findGithubLink(cell);
        if (link) {
          // Strip any existing #L anchor — we'll add our own
          rowFileUrl = link.properties.href.replace(/#L.*$/, '');
          continue;
        }

        // If we have a file from a previous cell, check if this cell is bare lines
        if (!rowFileUrl) continue;
        const text = toString(cell).trim();
        const m = BARE_LINES.exec(text);
        if (!m) continue;

        const [, rangeStart, rangeEnd, single] = m;
        const anchor = rangeStart
          ? `#L${rangeStart}-L${rangeEnd}`
          : `#L${single}`;

        // Replace cell content with a link
        cell.children = [{
          type: 'element',
          tagName: 'a',
          properties: { href: rowFileUrl + anchor, className: ['src-line'] },
          children: [{ type: 'text', value: text }],
        }];
      }
    });
  };
}

function findGithubLink(node) {
  if (node.type === 'element' && node.tagName === 'a') {
    const href = node.properties?.href ?? '';
    if (href.startsWith('https://github.com/')) return node;
  }
  for (const child of node.children ?? []) {
    const found = findGithubLink(child);
    if (found) return found;
  }
  return null;
}
```

---

## 7. Styling

Both plugins produce standard `<a>` links. The inline code links (`plugin A`) inherit the existing `<code>` styling. Add minimal CSS to distinguish source links from regular links:

```css
/* src/styles/custom.css — source reference links */
a.src-line {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* Suppress underline on inline-code links so the code style dominates */
code a,
a code {
  text-decoration: none;
}
code a:hover,
a:hover code {
  text-decoration: underline;
}
```

---

## 8. What is NOT converted

- Content inside fenced code blocks (remark never visits `code` nodes, only `inlineCode`)
- Plain-text paths without backticks (P5) — false positive risk
- Paths that are already `<a>` links (P7) — Plugin A checks `parent.type !== 'link'`
- Symbol names, shell commands, HTTP headers, env var names (heuristic filters)
- The abbreviation glossary preamble in `env-vars.md` itself — the `alias → full path` lines will be converted, but that's correct behaviour (the alias definitions become links to the full-path files)

---

## 9. Edge cases

| Case | Handling |
|------|----------|
| em-dash vs hyphen in line ranges (e.g. `506–611`) | Normalise both `–` and `-` to `-` before parsing |
| Trailing slash (directory refs like `agentmux-srv/src/reducer/`) | No extension match → skipped (link to a directory, not a file) |
| Backticked path followed by prose anchor like `` `reducer.rs` — comment `` | The dash and text are outside the backticks → Plugin A only sees `reducer.rs` |
| `specs/` prefix vs `docs/specs/` in repo | `pathMap` config remaps `specs/` → `docs/specs/` at URL construction time |
| Line numbers that are zero (`types.ts:0`) | Treated as valid — GitHub will show the file at the top |
| Generated API docs already have `[file:line](url)` links | Plugin A skips `inlineCode` inside existing `link` nodes |
| Short alias with line number (`` `shell.rs:604` ``) | Alias resolved first, then line appended to resolved path URL |

---

## 10. Implementation order

1. Install `unist-util-visit` and `hast-util-to-string` (dev deps)
2. Write `plugins/remark-github-source-links.mjs` — Plugin A
3. Wire into `astro.config.mjs` with full `aliases` + `pathMap`
4. Run `npm run build`, audit a sample of pages (env-vars, state-model, ipc-catalog, lan-discovery)
5. Write `plugins/rehype-github-source-table.mjs` — Plugin B
6. Wire into `rehypePlugins` (must come after Plugin A)
7. Re-audit reference tables in env-vars.md and state-model.md
8. Add CSS to `custom.css`
9. Open PR (fold spec file into same PR)

---

## 11. Files touched

| File | Change |
|------|--------|
| `plugins/remark-github-source-links.mjs` | New — Plugin A |
| `plugins/rehype-github-source-table.mjs` | New — Plugin B |
| `astro.config.mjs` | Wire both plugins, add aliases + pathMap |
| `src/styles/custom.css` | Add `src-line` and `a code` styles |
| `package.json` | Add `unist-util-visit`, `hast-util-to-string` as devDeps |
| `SOURCE_LINKS.md` | This spec (folded into impl PR) |
