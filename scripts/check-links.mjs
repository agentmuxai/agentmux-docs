#!/usr/bin/env node
// Checks every link in the built site (dist/): each link to a page or file of
// the site must reach a built file, and each #fragment an id on that page.
// Fails (exit 1) listing every broken one. Links into the agentmux source are
// checked during the build itself (plugins/rehype-check-source-links.mjs).
//
//   node scripts/check-links.mjs [--skip-target /api/rust/] [--external]
//
// --skip-target PREFIX  don't check links into PREFIX (pr-check builds without
//                       the Rust reference, so its pages don't exist there).
// --external            also fetch every external URL. Failures are printed as
//                       warnings and never fail the run: sites refuse scripted
//                       requests (crates.io, npm) and networks flake.
//
// Added after 238 dead links had reached the live site unnoticed
// (specs/AUDIT_DEAD_LINKS_2026_10_12.md).

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { markedSourceLinkErrors } from "../plugins/rehype-check-source-links.mjs";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const args = process.argv.slice(2);
const skipTargets = args.flatMap((a, i) => (a === "--skip-target" ? [args[i + 1]] : []));
const checkExternal = args.includes("--external");

if (!existsSync(dist)) {
    console.error("check-links: no dist/ — run the build first");
    process.exit(2);
}

// Rustdoc's own pages: generated, internally consistent, and 7,000+ of them.
// Links into them are still checked.
const SOURCE_EXCLUDE = /^api\/rust\//;

function* htmlFiles(dir) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            if (!SOURCE_EXCLUDE.test(relative(dist, full).replace(/\\/g, "/") + "/")) yield* htmlFiles(full);
        } else if (entry.endsWith(".html")) yield full;
    }
}

const decode = (s) =>
    s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

const pages = new Map(); // "/path/index.html" -> { links, ids, redirect }
for (const file of htmlFiles(dist)) {
    const html = readFileSync(file, "utf8");
    const url = "/" + relative(dist, file).replace(/\\/g, "/");
    const ids = new Set([...html.matchAll(/\s(?:id|name)="([^"]*)"/g)].map((m) => decode(m[1])));
    const links = [];
    for (const m of html.matchAll(/<(a|img|source|script|link)\b[^>]*?\s(href|src)="([^"]*)"/g)) {
        links.push({ tag: m[1], value: decode(m[3]) });
    }
    pages.set(url, { links, ids, redirect: /http-equiv="refresh"/.test(html.slice(0, 2000)) });
}

/** The built file a site path is served from, or null. */
function builtFile(path) {
    const candidates = path.endsWith("/") ? [path + "index.html"] : [path, path + "/index.html", path + ".html"];
    for (const c of candidates) {
        const full = join(dist, decodeURIComponent(c));
        if (existsSync(full) && statSync(full).isFile()) return "/" + relative(dist, full).replace(/\\/g, "/");
    }
    return null;
}

const broken = [];
// Links into the agentmux source the build marked as not resolving
// (plugins/rehype-check-source-links.mjs).
for (const e of markedSourceLinkErrors(dist)) {
    const [page, rest] = [e.slice(0, e.indexOf(": ")), e.slice(e.indexOf(": ") + 2)];
    broken.push({ page, link: rest.slice(0, rest.indexOf(" — ")), why: rest.slice(rest.indexOf(" — ") + 3) });
}
const external = new Map(); // url -> [page]
for (const [url, page] of pages) {
    if (page.redirect) continue;
    for (const { value } of page.links) {
        const v = value.trim();
        if (!v || /^(mailto|tel|javascript|data):/i.test(v)) continue;
        if (/^(https?:)?\/\//i.test(v)) {
            // Links into the agentmux source were checked against the pinned
            // checkout during the build; fetching hundreds from GitHub would
            // only trip its rate limit.
            if (/^https:\/\/github\.com\/agentmuxai\/agentmux\/(blob|tree)\//.test(v)) continue;
            // These refuse scripted requests (404/403 for pages that exist).
            if (/^https:\/\/(crates\.io|www\.npmjs\.com)\//.test(v)) continue;
            const key = v.split("#")[0];
            if (!external.has(key)) external.set(key, []);
            external.get(key).push(url);
            continue;
        }
        const [target, fragment] = v.split("#");
        let file = url;
        if (target) {
            const path = new URL(target, "https://site" + url).pathname;
            if (skipTargets.some((p) => path.startsWith(p))) continue;
            file = builtFile(path);
            if (!file) {
                broken.push({ page: url, link: v, why: `no page or file at ${path}` });
                continue;
            }
        }
        if (fragment && file.endsWith(".html")) {
            const target = pages.get(file);
            const id = decodeURIComponent(fragment);
            if (target && !target.redirect && !target.ids.has(id)) {
                broken.push({ page: url, link: v, why: `no #${id} on ${file}` });
            }
        }
    }
}

let checked = 0;
for (const page of pages.values()) checked += page.links.length;
console.log(`check-links: ${pages.size} pages, ${checked} links`);

if (checkExternal) {
    const urls = [...external.keys()];
    const results = await Promise.all(
        urls.map(async (u) => {
            const full = u.startsWith("//") ? "https:" + u : u;
            try {
                const r = await fetch(full, { redirect: "follow", signal: AbortSignal.timeout(20000), headers: { "user-agent": "Mozilla/5.0 agentmux-docs-check-links" } });
                return [u, r.ok ? null : `HTTP ${r.status}`];
            } catch (e) {
                return [u, String(e?.cause?.code ?? e?.name ?? e)];
            }
        }),
    );
    const failed = results.filter(([, err]) => err);
    console.log(`check-links: ${urls.length} external URLs, ${failed.length} failed (warnings only)`);
    for (const [u, err] of failed) console.log(`  warning: ${u} — ${err} (on ${external.get(u)[0]})`);
}

if (broken.length > 0) {
    console.error(`\ncheck-links: ${broken.length} broken link(s):`);
    for (const b of broken) console.error(`  ${b.page}\n    ${b.link}  — ${b.why}`);
    process.exit(1);
}
console.log("check-links: ok");
