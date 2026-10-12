#!/usr/bin/env node
// When a PR moves the src/agentmux pin, every link to a line of the agentmux
// source moves with it, to the same line number in the new code. This lists
// each one whose cited lines changed between the old pin and the new, so a
// person re-checks it, and fails (exit 1) while any is left.
//
//   node scripts/check-line-links.mjs [--base origin/main]
//
// Run after a build (it reads the line links from dist/). The old pin is
// src/agentmux's gitlink at the merge base with --base; nothing to do if the
// PR doesn't move it. A link whose Markdown line this PR edited is skipped:
// its author already re-checked it against the new code. For a cited block
// that only moved, the new line numbers are suggested.
//
// A link whose lines changed but still cite the right code (a reworded
// comment, say) can't be told apart here: after checking, add the
// `line-links-reviewed` label to the PR, which skips this step in pr-check.
//
// Added with specs/AUDIT_DEAD_LINKS_2026_10_12.md: line links pinned to `main`
// had drifted onto unrelated code in 3 of 4 sampled.

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CONTENT_DIR, SOURCE_DIR, parseSourceUrl, pinnedCommit } from "../plugins/source-links.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const args = process.argv.slice(2);
const baseAt = args.indexOf("--base");
const baseRef = baseAt >= 0 ? args[baseAt + 1] : "origin/main";

const git = (cwd, ...a) => execFileSync("git", ["-C", cwd, ...a], { encoding: "utf8", maxBuffer: 64 << 20 });
const tryGit = (cwd, ...a) => {
    try {
        return git(cwd, ...a);
    } catch {
        return null;
    }
};

const mergeBase = git(root, "merge-base", baseRef, "HEAD").trim();
const oldPin = git(root, "ls-tree", mergeBase, "src/agentmux").split(/\s+/)[2];
const newPin = pinnedCommit();
if (oldPin === newPin) {
    console.log("check-line-links: the PR doesn't move src/agentmux — nothing to check");
    process.exit(0);
}
if (!tryGit(SOURCE_DIR, "cat-file", "-e", `${oldPin}^{commit}`)) {
    git(SOURCE_DIR, "fetch", "--quiet", "--depth=1", "origin", oldPin);
}
console.log(`check-line-links: src/agentmux ${oldPin.slice(0, 9)} -> ${newPin.slice(0, 9)}`);

// Markdown lines this PR changed, per page file ("internals/env-vars.md" -> Set of new line numbers).
const edited = new Map();
let file = null;
for (const line of git(root, "diff", "--unified=0", mergeBase, "HEAD", "--", "src/content/docs").split("\n")) {
    const f = /^\+\+\+ b\/src\/content\/docs\/(.*)$/.exec(line);
    if (f) {
        file = f[1];
        edited.set(file, new Set());
        continue;
    }
    const h = /^@@ -\S+ \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (h && file) {
        const start = Number(h[1]);
        const count = h[2] === undefined ? 1 : Number(h[2]);
        for (let i = start; i < start + count; i++) edited.get(file).add(i);
    }
}

// Every line link in the built site, with where it is written.
const links = new Map(); // "path#Lx-Ly" -> { path, start, end, sources: Set }
function* htmlFiles(dir) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            if (entry !== "rust") yield* htmlFiles(full);
        } else if (entry.endsWith(".html")) yield full;
    }
}
if (!existsSync(dist)) {
    console.error("check-line-links: no dist/ — run the build first");
    process.exit(2);
}
for (const html of htmlFiles(dist)) {
    const text = readFileSync(html, "utf8");
    for (const m of text.matchAll(/<a\b[^>]*?\shref="([^"]+)"[^>]*>/g)) {
        const link = parseSourceUrl(m[1].replace(/&amp;/g, "&"));
        if (!link || link.lineStart === undefined) continue;
        const src = /\sdata-src-line="([^"]+)"/.exec(m[0])?.[1];
        const end = link.lineEnd ?? link.lineStart;
        const key = `${link.path}#L${link.lineStart}-L${end}`;
        if (!links.has(key)) links.set(key, { path: link.path, start: link.lineStart, end, sources: new Set() });
        if (src) links.get(key).sources.add(src);
    }
}

const fileAt = new Map();
function linesAt(pin, path) {
    const key = `${pin}:${path}`;
    if (!fileAt.has(key)) {
        const text = tryGit(SOURCE_DIR, "show", key);
        fileAt.set(key, text === null ? null : text.split("\n"));
    }
    return fileAt.get(key);
}

const norm = (lines) => lines.map((l) => l.trim());
const changed = [];
let compared = 0;
for (const link of links.values()) {
    const sources = [...link.sources];
    const untouched = sources.filter((s) => {
        const [page, line] = [s.slice(0, s.lastIndexOf(":")), Number(s.slice(s.lastIndexOf(":") + 1))];
        return !edited.get(page)?.has(line);
    });
    if (sources.length > 0 && untouched.length === 0) continue; // every place citing it was edited in this PR
    const before = linesAt(oldPin, link.path);
    const after = linesAt(newPin, link.path);
    if (!before || !after) continue; // new file, or one the build already rejected
    compared++;
    const was = norm(before.slice(link.start - 1, link.end));
    const now = norm(after.slice(link.start - 1, link.end));
    if (was.join("\n") === now.join("\n")) continue;
    // Did the cited block just move? Look for it, once, in the new file.
    const all = norm(after);
    const hits = [];
    for (let i = 0; i + was.length <= all.length && hits.length < 2; i++) {
        if (was.every((l, k) => all[i + k] === l)) hits.push(i + 1);
    }
    const suggest = hits.length === 1 ? `moved: now lines ${hits[0]}${was.length > 1 ? `-${hits[0] + was.length - 1}` : ""}` : "changed in place, or moved and edited";
    changed.push({ ...link, untouched: untouched.length ? untouched : ["(no source line recorded)"], suggest });
}

console.log(`check-line-links: ${links.size} line links, ${compared} compared against the old pin`);
if (changed.length === 0) {
    console.log("check-line-links: ok");
    process.exit(0);
}
console.error(`\ncheck-line-links: ${changed.length} line link(s) cite lines that changed with the new pin:`);
for (const c of changed) {
    console.error(`  ${c.path}#L${c.start}${c.end !== c.start ? `-L${c.end}` : ""} — ${c.suggest}`);
    for (const s of c.untouched) console.error(`      cited at src/content/docs/${s}`);
}
console.error(
    "\nUpdate each to the code it describes. If a link's lines changed but it still cites the right code, " +
        "add the `line-links-reviewed` label to the PR once checked.",
);
process.exit(1);
