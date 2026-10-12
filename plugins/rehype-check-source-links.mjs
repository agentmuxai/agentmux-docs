/**
 * rehype-check-source-links
 *
 * Runs LAST, after remark-github-source-links and rehype-github-source-table,
 * so it sees every link into the agentmux repo however it was written: a
 * backticked path, a table's bare line range, or a Markdown link typed out in
 * full. For each one it:
 *
 * - points it at the commit `src/agentmux` is pinned to, if it named `main`
 *   or another commit, so no source link drifts with later changes;
 * - checks the file or folder exists at that commit, and that a line range
 *   is within the file.
 *
 * A bad link is marked in the page (`data-source-link-error`, saying why) and
 * listed on the console. It doesn't throw: Starlight's content loader catches
 * a plugin's error, logs it and builds the page anyway, so a throw can't fail
 * the build. The mark is what does, twice over: sourceLinksIntegration()
 * below fails the build when any page carries one, and scripts/check-links.mjs
 * fails CI on it. Dead source links used to reach the live site silently (54
 * of them by 2026-10-12, specs/AUDIT_DEAD_LINKS_2026_10_12.md).
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { visit } from 'unist-util-visit';
import { CONTENT_DIR, isDir, isFile, lineCount, parseSourceUrl, pinnedCommit, sourceUrl } from './source-links.mjs';

export default function rehypeCheckSourceLinks() {
  return (tree, file) => {
    const problems = [];
    const page = file.path ? relative(CONTENT_DIR, file.path).replace(/\\/g, '/') : '';
    const flag = (node, href, why) => {
      node.properties.dataSourceLinkError = why;
      problems.push(`${href}\n      ${why}`);
    };
    visit(tree, 'element', (node, _index, parent) => {
      if (node.tagName !== 'a') return;
      const href = node.properties?.href;
      if (typeof href !== 'string') return;
      const link = parseSourceUrl(href);
      if (!link) return;

      const { path, lineStart, lineEnd } = link;
      if (!isFile(path) && !isDir(path)) {
        flag(node, href, `${path} doesn't exist at the pinned commit`);
        return;
      }
      if (lineStart !== undefined) {
        if (!isFile(path)) {
          flag(node, href, 'a line range on a folder');
          return;
        }
        const last = lineEnd ?? lineStart;
        const lines = lineCount(path);
        if (last > lines || lineStart > last) {
          flag(node, href, `lines ${lineStart}${lineEnd ? `-${lineEnd}` : ''} are outside the file (${lines} lines)`);
          return;
        }
      }
      node.properties.href = sourceUrl(path, lineStart, lineEnd);
      // Where a line link is written, so scripts/check-line-links.mjs can tell a
      // link this PR edited (its author re-checked it) from one it didn't.
      const line = (node.position ?? parent?.position)?.start?.line;
      if (lineStart !== undefined && page && line) node.properties.dataSrcLine = `${page}:${line}`;
    });

    if (problems.length > 0) {
      console.error(
        `[source-links] ${file.path}: ${problems.length} link(s) into the agentmux source don't resolve at the pinned commit ` +
          `(src/agentmux @ ${pinnedCommit().slice(0, 9)}):\n` +
          problems.map((p) => `  - ${p}`).join('\n') +
          "\nFix the path or line, or, for a path that isn't a repo file, add it to notSourcePaths in plugins/source-links.mjs.",
      );
    }
  };
}

/** Every `data-source-link-error` mark in the built HTML under `dir`, as "page: href — why". */
export function markedSourceLinkErrors(dir) {
  const found = [];
  const walk = (d) => {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      if (statSync(full).isDirectory()) {
        if (relative(dir, full).replace(/\\/g, '/') !== 'api/rust') walk(full);
      } else if (entry.endsWith('.html')) {
        const html = readFileSync(full, 'utf8');
        if (!html.includes('data-source-link-error')) continue;
        const page = '/' + relative(dir, full).replace(/\\/g, '/');
        const decode = (s) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
        for (const m of html.matchAll(/<a\b[^>]*?\sdata-source-link-error="([^"]*)"[^>]*>/g)) {
          const href = /\shref="([^"]*)"/.exec(m[0])?.[1] ?? '';
          found.push(`${page}: ${decode(href)} — ${decode(m[1])}`);
        }
      }
    }
  };
  walk(dir);
  return found;
}

/** Fails `astro build` when any page carries a broken source link. */
export function sourceLinksIntegration() {
  return {
    name: 'agentmux-source-links',
    hooks: {
      'astro:build:done': ({ dir }) => {
        const errors = markedSourceLinkErrors(fileURLToPath(dir));
        if (errors.length > 0) {
          throw new Error(
            `${errors.length} link(s) into the agentmux source don't resolve at the pinned commit ` +
              `(see the [source-links] lines above):\n` +
              errors.map((e) => `  - ${e}`).join('\n'),
          );
        }
      },
    },
  };
}
