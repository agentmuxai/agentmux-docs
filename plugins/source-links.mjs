/**
 * Links into the agentmuxai/agentmux source: one place for how the docs name
 * source files and which commit those names mean.
 *
 * Every source link points at the commit `src/agentmux` is pinned to, not at
 * `main`: a link then shows the code the page was written against, and never
 * breaks or drifts until the pin moves. The same pinned checkout is what the
 * build checks each link against (rehype-check-source-links.mjs), and what
 * scripts/check-line-links.mjs compares when a PR moves the pin.
 *
 * Used by astro.config.mjs (both plugins) and scripts/check-line-links.mjs.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_URL = 'https://github.com/agentmuxai/agentmux';
export const SOURCE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'agentmux');
export const CONTENT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'content', 'docs');

/**
 * Short names the prose uses for files. A backticked `name` or `name:<line>`
 * links to the file it maps to; a name with no slash links only when listed
 * here (`reducer.ts` alone could be any of several).
 */
export const aliases = {
    // Rust / shell (env-vars page)
    'shell.rs': 'crates/srv/src/backend/blockcontroller/shell/lifecycle.rs',
    'data_paths.rs': 'crates/common/src/data_paths.rs',
    'runtime_mode.rs': 'crates/common/src/runtime_mode.rs',
    'srv_spawner.rs': 'crates/launcher/src/srv_spawner.rs',
    'launcher/main.rs': 'crates/launcher/src/main.rs',
    'shellintegration.rs': 'crates/srv/src/backend/shellintegration.rs',
    'bash.sh': 'crates/srv/src/backend/shellintegration/bash.sh',
    'pwsh.ps1': 'crates/srv/src/backend/shellintegration/pwsh.ps1',
    'websocket.rs': 'crates/srv/src/server/websocket.rs',
    // Layout model (state-model page)
    'layoutModel.ts': 'frontend/layout/lib/layoutModel.ts',
    'layoutTree.ts': 'frontend/layout/lib/layoutTree.ts',
    'layoutFocus.ts': 'frontend/layout/lib/layoutFocus.ts',
    'layoutPersistence.ts': 'frontend/layout/lib/layoutPersistence.ts',
    'layoutAtom.ts': 'frontend/layout/lib/layoutAtom.ts',
    'layoutNodeModels.ts': 'frontend/layout/lib/layoutNodeModels.ts',
    // Agent-pane-state store (state-model page §3)
    'types.ts': 'frontend/app/store/agent-pane-state/types.ts',
    'reducer.ts': 'frontend/app/store/agent-pane-state/reducer.ts',
    'browser-pane-state-store.ts': 'frontend/app/store/browser-pane-state-store.ts',
    'editor-pane-state-store.ts': 'frontend/app/store/editor-pane-state-store.ts',
    // Block rendering (state-model page §4–5)
    'autotitle.ts': 'frontend/app/block/autotitle.ts',
    'blockframe.tsx': 'frontend/app/block/blockframe.tsx',
    'blocktypes.ts': 'frontend/app/block/blocktypes.ts',
    'block.scss': 'frontend/app/block/block.scss',
    'tabbar.tsx': 'frontend/app/tab/tabbar.tsx',
    // Global store / type defs
    'global.ts': 'frontend/app/store/global.ts',
    'mos.ts': 'frontend/app/store/mos.ts',
    'srv-types.d.ts': 'frontend/types/srv-types.d.ts',
};

/** Path prefixes the prose shortens: `specs/X.md` is `docs/specs/X.md`. */
export const pathMap = {
    'specs/': 'docs/specs/',
};

/**
 * Backticked paths that look like source files but aren't files in the repo,
 * so they stay plain code: paths inside an archive, in the reader's own
 * project, or written at runtime.
 */
export const notSourcePaths = new Set([
    'accounts/requirements.json', // inside an .abf archive (abf.md)
    'dist/widget.json', // the reader's own widget build (build-a-widget.mdx)
    '.claude/.agentmux-managed-mcp-servers.json', // written into an agent's workspace at runtime
]);

let pinned;
/** The commit `src/agentmux` is checked out at. */
export function pinnedCommit() {
    if (pinned === undefined) {
        if (!existsSync(join(SOURCE_DIR, '.git'))) {
            throw new Error(
                'src/agentmux is not checked out, so source links cannot be pinned or checked. ' +
                    'Run `git submodule update --init src/agentmux`.',
            );
        }
        pinned = execFileSync('git', ['-C', SOURCE_DIR, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    }
    return pinned;
}

/** `blob` or `tree` URL of `path` at the pinned commit, with an optional line range. */
export function sourceUrl(path, lineStart, lineEnd) {
    const kind = isDir(path) ? 'tree' : 'blob';
    let url = `${REPO_URL}/${kind}/${pinnedCommit()}/${path}`;
    if (lineStart) url += `#L${lineStart}${lineEnd ? `-L${lineEnd}` : ''}`;
    return url;
}

/** The repo path a backticked name stands for (alias, then prefix rewrite). */
export function resolveName(name) {
    let resolved = aliases[name] ?? name;
    for (const [prefix, replacement] of Object.entries(pathMap)) {
        if (resolved.startsWith(prefix)) return replacement + resolved.slice(prefix.length);
    }
    return resolved;
}

function stat(path) {
    try {
        return statSync(join(SOURCE_DIR, path));
    } catch {
        return null;
    }
}

export function isFile(path) {
    return stat(path)?.isFile() ?? false;
}

export function isDir(path) {
    return path === '' || (stat(path)?.isDirectory() ?? false);
}

const lineCounts = new Map();
/** Number of lines in `path` at the pinned commit. */
export function lineCount(path) {
    if (!lineCounts.has(path)) {
        const text = readFileSync(join(SOURCE_DIR, path), 'utf8');
        lineCounts.set(path, text.length === 0 ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0));
    }
    return lineCounts.get(path);
}

/**
 * `{ kind, path, lineStart, lineEnd }` for a link to a file or folder of the
 * agentmux repo at `main` or at any commit; null for any other URL (issues,
 * pull requests, other repos).
 */
export function parseSourceUrl(href) {
    const m = /^https:\/\/github\.com\/agentmuxai\/agentmux\/(blob|tree)\/([^/]+)\/([^#?]*)(?:#L(\d+)(?:-L(\d+))?)?$/.exec(href);
    if (!m) return null;
    return {
        kind: m[1],
        ref: m[2],
        path: decodeURIComponent(m[3]).replace(/\/$/, ''),
        lineStart: m[4] ? Number(m[4]) : undefined,
        lineEnd: m[5] ? Number(m[5]) : undefined,
    };
}
