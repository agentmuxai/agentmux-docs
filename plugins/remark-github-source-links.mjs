/**
 * remark-github-source-links
 *
 * Converts backticked file-path references in prose into GitHub blob links.
 * Handles three forms:
 *   `path/to/file.rs`          → blob link (no anchor)
 *   `path/to/file.rs:42`       → blob link + #L42
 *   `path/to/file.rs:42-78`    → blob link + #L42-L78
 *
 * Short-name aliases (e.g. shell.rs → agentmux-srv/src/.../shell.rs) and
 * path prefix remapping (e.g. specs/ → docs/specs/) are configurable.
 *
 * Nodes already inside a <link> are skipped. Fenced code blocks are never
 * visited (remark only exposes `inlineCode`, not `code` nodes, to visitors).
 */

import { visit } from 'unist-util-visit';

const EXTENSIONS = /\.(rs|ts|tsx|js|mjs|cjs|toml|json|md|sh|ps1|scss|css)$/i;

// Matches the path portion and an optional :line or :start-end suffix.
// Supports both ASCII hyphen and en-dash / em-dash in ranges.
const LINE_SUFFIX = /^([\w./-]+?)(?::([\d]+)(?:[–—-]([\d]+))?)?$/;

export default function remarkGithubSourceLinks(opts = {}) {
  const {
    baseUrl = 'https://github.com/agentmuxai/agentmux/blob/main/',
    aliases = {},
    pathMap = {},
  } = opts;

  return (tree) => {
    visit(tree, 'inlineCode', (node, index, parent) => {
      // Skip nodes that are already inside a link
      if (parent?.type === 'link') return;

      const raw = node.value;

      // Must not be a URL
      if (raw.startsWith('http')) return;

      // Must not contain spaces or shell-special chars
      if (/[\s${}*?]/.test(raw)) return;

      // Parse path + optional line range
      const m = LINE_SUFFIX.exec(raw);
      if (!m) return;

      const [, path, lineStart, lineEnd] = m;

      // Must end in a recognised source extension
      if (!EXTENSIONS.test(path)) return;

      // Must contain a slash OR be a known alias (single-word filenames are too
      // likely to be symbol names like `reducer.ts` without a path prefix)
      if (!path.includes('/') && !(path in aliases)) return;

      // Resolve alias
      let resolved = aliases[path] ?? path;

      // Apply path prefix remapping (e.g. specs/ → docs/specs/)
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

      // Replace inlineCode node with link > inlineCode, preserving the display text
      parent.children[index] = {
        type: 'link',
        url,
        title: null,
        children: [{ type: 'inlineCode', value: raw }],
        data: { hProperties: { className: ['src-ref'] } },
      };
    });
  };
}
