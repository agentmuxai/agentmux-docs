/**
 * rehype-github-source-table
 *
 * Runs AFTER remark-github-source-links. Finds table rows where one cell
 * already contains a GitHub blob link (placed by the remark plugin) and
 * subsequent cells contain only a bare line number or range (e.g. "506–611").
 * Converts those bare numbers into anchored links to the same file.
 *
 * Example row:
 *   | PTY env injection | `shell.rs` | 506–611 |
 *                           ↑ already a link    ↑ becomes #L506-L611
 */

import { visit } from 'unist-util-visit';
import { toString } from 'hast-util-to-string';

// Matches a bare line number or range (with ASCII hyphen or en/em-dash).
// The entire cell text must be ONLY the number/range — no other content.
const BARE_LINES = /^(\d+)[–—-](\d+)$|^(\d+)$/;

/** Returns the href of the first GitHub blob link found inside a hast node. */
function findGithubHref(node) {
  if (node.type === 'element' && node.tagName === 'a') {
    const href = node.properties?.href ?? '';
    if (href.startsWith('https://github.com/')) return href;
  }
  for (const child of node.children ?? []) {
    const found = findGithubHref(child);
    if (found) return found;
  }
  return null;
}

export default function rehypeGithubSourceTable() {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'tr') return;

      // Only look at <td> / <th> element children (skip whitespace text nodes)
      const cells = node.children.filter(
        (c) => c.type === 'element' && (c.tagName === 'td' || c.tagName === 'th'),
      );

      let rowFileUrl = null; // base blob URL (no anchor) from the file-path cell

      for (const cell of cells) {
        // Check if this cell contains a GitHub link placed by Plugin A
        const href = findGithubHref(cell);
        if (href) {
          // Strip any existing #L anchor so we can attach our own
          rowFileUrl = href.replace(/#L.*$/, '');
          continue;
        }

        // If no file established yet in this row, keep scanning
        if (!rowFileUrl) continue;

        // Check if the entire cell text is a bare line number / range
        const text = toString(cell).trim();
        const m = BARE_LINES.exec(text);
        if (!m) continue;

        const [, rangeStart, rangeEnd, single] = m;
        const anchor = rangeStart
          ? `#L${rangeStart}-L${rangeEnd}`
          : `#L${single}`;

        // Replace cell children with a single anchor element
        cell.children = [
          {
            type: 'element',
            tagName: 'a',
            properties: {
              href: rowFileUrl + anchor,
              className: ['src-line'],
            },
            children: [{ type: 'text', value: text }],
          },
        ];
      }
    });
  };
}
