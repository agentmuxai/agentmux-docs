// Post-processes typedoc's Markdown output to add the YAML frontmatter
// Starlight requires (`title`, optional `description`). typedoc emits
// the page heading as the first H1; we lift that into frontmatter and
// strip the leading `# Heading` so Starlight's auto-rendering doesn't
// duplicate it.

import { readFileSync, writeFileSync, statSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "src", "content", "docs", "api", "typescript");

function* walk(dir) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) yield* walk(full);
        else if (full.endsWith(".md")) yield full;
    }
}

let count = 0;
for (const file of walk(root)) {
    const original = readFileSync(file, "utf8");

    // Skip files that already have frontmatter — idempotent.
    if (original.startsWith("---\n")) continue;

    // Pull the first H1 as the title; fall back to the filename slug.
    const m = original.match(/^# +(.+?)\s*$/m);
    const title = (m?.[1] ?? relative(root, file).replace(/\.md$/, "").split(/[\/\\]/).join(" / "))
        .replace(/"/g, '\\"');

    // Strip the H1 line so Starlight doesn't double-render it.
    const body = m ? original.replace(/^# +.+?\s*$/m, "").replace(/^\n+/, "") : original;

    const frontmatter = `---\ntitle: "${title}"\n---\n\n`;
    writeFileSync(file, frontmatter + body, "utf8");
    count++;
}

console.log(`[post-typedoc] frontmatter applied to ${count} file(s)`);
