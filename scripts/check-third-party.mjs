#!/usr/bin/env node
// Fails when a built page would make a visitor's browser load something from a host that isn't ours,
// or when the analytics tag has lost `data-cookieless`.
//
// Why: a font, script, image or frame fetched from someone else's server gives that server the reader's
// IP address without their consent. This site loads everything from itself, and this keeps it so. It has
// no analytics tag today; if one is added it must say `data-cookieless` (the SDK sets a cookie otherwise).
//
// What it reads: every .html file in dist/ and every .css file. In a page: script, link (unless its
// rel only points somewhere), img and srcset, source, video and its poster, audio, iframe, embed,
// object, track, input, the SVG image, use and feImage elements, a background="" attribute, inline
// <style> and style="". In a stylesheet: url(...) and @import. A link a visitor clicks (<a href>) is
// not a load.
// What it can't see: a request a script makes at run time, or a tag a script adds.
//
// Usage: npm run build && node scripts/check-third-party.mjs
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

/** Hosts the site may load from: itself and its own subdomains. */
export const OWN_HOST = "agentmux.ai";
/** The host of the analytics SDK, whose tag must say `data-cookieless`. */
export const ANALYTICS_HOST = "traffic.agentmux.ai";

/** `<link rel>` values that point somewhere without loading it. */
const LINK_RELS_THAT_LOAD_NOTHING = new Set(["canonical", "alternate", "author", "license", "me", "help", "next", "prev", "search", "bookmark", "tag", "nofollow", "noopener", "noreferrer", "external"]);
const LOADING_TAG = /<(script|link|img|image|use|feImage|source|video|audio|iframe|embed|object|track|input)\b[^>]*>/gi;
/** SVG elements that fetch what `href` (or the older `xlink:href`) names. */
const SVG_LOADERS = new Set(["image", "use", "feimage"]);

function attr(tag, name) {
    const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
    return m ? (m[1] ?? m[2] ?? m[3] ?? "") : null;
}

function hasAttr(tag, name) {
    return new RegExp(`\\s${name}(?=[\\s=>/])`, "i").test(tag);
}

/** The analytics SDK's tag: a script from the analytics host, or any script with a src that carries the SDK's `data-app`. */
export function isAnalyticsTag(tag) {
    const src = attr(tag, "src");
    return src !== null && (hostOf(src) === ANALYTICS_HOST || hasAttr(tag, "data-app"));
}

/** Whether a tag says `data-cookieless`: present, and not switched off by its value. */
export function isCookieless(tag) {
    if (!hasAttr(tag, "data-cookieless")) return false;
    return !["false", "0", "off", "no"].includes((attr(tag, "data-cookieless") ?? "").trim().toLowerCase());
}

/** The host a reference would be fetched from, or null when it stays on the page's own origin (or loads nothing). */
export function hostOf(reference) {
    const ref = reference.trim();
    if (!ref || ref.startsWith("#") || /^(data|blob|about|mailto|tel|javascript):/i.test(ref)) return null;
    let url;
    try {
        url = new URL(ref, `https://${OWN_HOST}/`);
    } catch {
        return null;
    }
    return url.protocol === "http:" || url.protocol === "https:" ? url.hostname.toLowerCase() : null;
}

export function isOurs(host) {
    return host === OWN_HOST || host.endsWith(`.${OWN_HOST}`);
}

/** Every reference in a stylesheet that the browser fetches. */
export function cssReferences(css) {
    const refs = [];
    for (const m of css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/gi)) refs.push(m[1] ?? m[2] ?? m[3] ?? "");
    for (const m of css.matchAll(/@import\s+(?:"([^"]*)"|'([^']*)')/gi)) refs.push(m[1] ?? m[2] ?? "");
    return refs;
}

/** Every reference in a page that the browser fetches while showing it, each with the tag it came from. */
export function htmlReferences(html) {
    const refs = [];
    const add = (ref, from) => {
        if (ref) refs.push({ ref, from });
    };
    for (const [tag, rawName] of html.matchAll(LOADING_TAG)) {
        const name = rawName.toLowerCase();
        if (name === "link") {
            const rels = (attr(tag, "rel") ?? "").toLowerCase().split(/\s+/).filter(Boolean);
            if (rels.length > 0 && rels.every((r) => LINK_RELS_THAT_LOAD_NOTHING.has(r))) continue;
            add(attr(tag, "href"), tag);
            continue;
        }
        if (SVG_LOADERS.has(name)) {
            add(attr(tag, "href"), tag);
            add(attr(tag, "xlink:href"), tag);
            continue;
        }
        add(attr(tag, name === "object" ? "data" : "src"), tag);
        if (name === "video") add(attr(tag, "poster"), tag);
        for (const candidate of (attr(tag, "srcset") ?? "").split(",")) add(candidate.trim().split(/\s+/)[0], tag);
    }
    // The legacy background="" attribute (body, table, td) loads an image too.
    for (const m of html.matchAll(/<[a-z][^>]*\sbackground\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/gi)) add(m[1] ?? m[2] ?? "", 'background=""');
    for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) for (const ref of cssReferences(m[1])) add(ref, "<style>");
    for (const m of html.matchAll(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) for (const ref of cssReferences(m[1] ?? m[2] ?? "")) add(ref, 'style=""');
    return refs;
}

/** What is wrong with one built page: third-party loads, and an analytics tag without `data-cookieless`. */
export function problemsInHtml(html) {
    const problems = [];
    for (const { ref, from } of htmlReferences(html)) {
        const host = hostOf(ref);
        if (host && !isOurs(host)) problems.push(`loads ${ref} from ${host}: ${from.slice(0, 160)}`);
    }
    for (const [tag] of html.matchAll(/<script\b[^>]*>/gi)) {
        if (isAnalyticsTag(tag) && !isCookieless(tag)) {
            problems.push(`the analytics tag has no data-cookieless (or it is switched off), so it would set a cookie: ${tag.slice(0, 160)}`);
        }
    }
    return problems;
}

/** What is wrong with one built stylesheet. */
export function problemsInCss(css) {
    const problems = [];
    for (const ref of cssReferences(css)) {
        const host = hostOf(ref);
        if (host && !isOurs(host)) problems.push(`loads ${ref} from ${host}`);
    }
    return problems;
}

function filesUnder(dir) {
    const out = [];
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) out.push(...filesUnder(path));
        else out.push(path);
    }
    return out;
}

function main() {
    const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
    const dist = join(root, "dist");
    if (!existsSync(join(dist, "index.html"))) {
        console.error("check-third-party: run `npm run build` first (no dist/index.html)");
        process.exit(2);
    }
    const served = filesUnder(dist);
    const pages = served.filter((f) => f.endsWith(".html"));
    const sheets = served.filter((f) => f.endsWith(".css"));
    let failed = 0;
    let analyticsTags = 0;
    for (const file of [...pages, ...sheets]) {
        const text = readFileSync(file, "utf8");
        const problems = file.endsWith(".html") ? problemsInHtml(text) : problemsInCss(text);
        if (file.endsWith(".html")) analyticsTags += [...text.matchAll(/<script\b[^>]*>/gi)].filter(([t]) => isAnalyticsTag(t)).length;
        for (const p of problems) {
            failed += 1;
            console.error(`check-third-party: ${relative(dist, file)}: ${p}`);
        }
    }
    if (failed > 0) {
        console.error(`check-third-party: ${failed} problem(s). The site loads only from ${OWN_HOST} and its subdomains, and an analytics tag stays cookieless.`);
        process.exit(1);
    }
    const analytics = analyticsTags > 0 ? `${analyticsTags} analytics tag(s), all cookieless` : "no analytics tag found, so nothing to keep cookieless";
    console.log(`check-third-party: ${pages.length} pages and ${sheets.length} stylesheets load nothing from a third party; ${analytics}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
