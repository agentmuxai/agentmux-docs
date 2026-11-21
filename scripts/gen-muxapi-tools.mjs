#!/usr/bin/env node
// Writes the MCP tool reference in src/content/docs/internals/muxapi.md from the tool definitions agents are
// shown (crates/mcp/src/tool_schemas.rs in the pinned agentmux source), so the page cannot drift from them.
//
//   node scripts/gen-muxapi-tools.mjs           rewrite the generated regions
//   node scripts/gen-muxapi-tools.mjs --check   fail if the page differs from what the source gives
//
// Two regions of the page are generated, between `<!-- BEGIN GENERATED: mcp-area-table -->` and
// `<!-- BEGIN GENERATED: mcp-tools -->` markers (each with its END). Everything else on the page is prose.
// A tool in the source that is in no AREAS entry below fails the run: say where it belongs. Hand-written prose that goes
// with a tool lives in scripts/muxapi-notes/<Tool>.before.md (above its description) and <Tool>.after.md (below its table).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMAS = join(root, "src/agentmux/crates/mcp/src/tool_schemas.rs");
const PAGE = join(root, "src/content/docs/internals/muxapi.md");
const check = process.argv.includes("--check");

/** The page's areas, in reading order: the heading, the tools in it, and a note for a tool only some agents see. */
const AREAS = [
    { title: "Where you are, and the panes around you", tools: ["Pane", "UI"] },
    { title: "Browser panes", tools: ["Browser"] },
    { title: "Terminals and commands", tools: ["Terminal"] },
    { title: "Other agents", tools: ["Agents", "Message", "Presence", "Stop", "Sensitive"] },
    { title: "Work and schedules", tools: ["Tasks", "Schedule", "Drone"] },
    { title: "Memory, secrets and accounts", tools: ["Memory", "Skills", "Vault", "Identity"] },
    { title: "Widgets and AgentMux itself", tools: ["Widget", "App", "Desktop", "RegisterDevServer"] },
    { title: "Google", tools: ["Google", "Calendar", "Drive", "Gmail"] },
];

const source = readFileSync(SCHEMAS, "utf8");

/** Every `const X_TOOL: &str = r#"{...}"#;` in the source, parsed. */
function readTools() {
    const tools = new Map();
    for (const m of source.matchAll(/pub\(crate\) const (\w+): &str = r#"([\s\S]*?)"#;/g)) {
        const def = JSON.parse(m[2]);
        tools.set(def.name, { ...def, constName: m[1] });
    }
    const advertised = source.match(/const ADVERTISED: &\[&str\] = &\[([\s\S]*?)\];/);
    const granted = source.match(/const GRANTED: &\[\(&str, &str\)\] = &\[([\s\S]*?)\];/);
    if (!advertised || !granted) throw new Error("tool_schemas.rs has no ADVERTISED or GRANTED list");
    const shown = new Set([...advertised[1].matchAll(/(\w+_TOOL)/g)].map((x) => x[1]).concat([...granted[1].matchAll(/(\w+_TOOL)/g)].map((x) => x[1])));
    for (const [name, t] of tools) if (!shown.has(t.constName)) tools.delete(name);
    return tools;
}

/** Text made safe for Markdown: no raw tags, no emphasis from `until_*`. */
const safe = (s) => String(s).replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\*/g, "\\*");
const cell = (s) => safe(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
const quoted = (v) => JSON.stringify(v);

function typeOf(p) {
    if (p.enum) return p.enum.map((v) => `\`${quoted(v)}\``).join(" \\| ");
    if (p.type === "array") return `\`array of ${p.items?.type ?? "value"}\``;
    if (Array.isArray(p.type)) return `\`${p.type.join(" or ")}\``;
    return `\`${p.type ?? "value"}\``;
}

/** The description with a paragraph break before each `action:` it describes, so a long one reads as a list. */
function paragraphs(t) {
    const actions = t.inputSchema?.properties?.action?.enum ?? [];
    let text = t.description.trim();
    for (const a of actions) text = text.replace(new RegExp(`(?<=[.!?)] )(${a}(?:, [a-z_]+)*(?: and [a-z_]+)?(?: \\([^)]*\\))?: )`), "\n\n$1");
    return text
        .split("\n\n")
        .map((p) => safe(p.trim()).replace(/^([a-z_]+(?:, [a-z_]+)*(?: and [a-z_]+)?): /, (_, names) => `${names.split(/, | and /).map((n) => `\`${n}\``).join(", ")}: `))
        .filter(Boolean)
        .join("\n\n");
}

function renderTool(t, heading) {
    const required = new Set(t.inputSchema?.required ?? []);
    const rows = Object.entries(t.inputSchema?.properties ?? {}).map(
        ([name, p]) => `| \`${name}\`${required.has(name) ? " (required)" : ""} | ${typeOf(p)} | ${cell(p.description ?? "")} |`
    );
    const note = (when) => {
        const file = join(root, "scripts/muxapi-notes", `${t.name}.${when}.md`);
        return existsSync(file) ? readFileSync(file, "utf8").trim() : null;
    };
    const parts = [`${heading} \`${t.name}\``, note("before"), paragraphs(t), ["| Parameter | Type | Description |", "|---|---|---|", ...rows].join("\n"), note("after")];
    return parts.filter(Boolean).join("\n\n");
}

function anchor(name) {
    return name.toLowerCase();
}

function render(tools) {
    const placed = new Set(AREAS.flatMap((a) => a.tools));
    const missing = [...tools.keys()].filter((n) => !placed.has(n));
    if (missing.length) throw new Error(`gen-muxapi-tools: tool(s) in no area: ${missing.join(", ")}. Add them to AREAS.`);
    const gone = [...placed].filter((n) => !tools.has(n));
    if (gone.length) throw new Error(`gen-muxapi-tools: AREAS names tool(s) the source no longer has: ${gone.join(", ")}.`);

    const table = ["| Area | Tools |", "|---|---|", ...AREAS.map((a) => `| ${a.title} | ${a.tools.map((n) => `[\`${n}\`](#${anchor(n)})`).join(", ")} |`)].join("\n");
    const body = AREAS.map((a) => [`### ${a.title}`, "", a.tools.map((n) => renderTool(tools.get(n), "####")).join("\n\n")].join("\n")).join("\n\n");
    return { table, body };
}

function splice(page, name, text) {
    const begin = `<!-- BEGIN GENERATED: ${name} -->`;
    const end = `<!-- END GENERATED: ${name} -->`;
    const a = page.indexOf(begin);
    const b = page.indexOf(end);
    if (a < 0 || b < a) throw new Error(`gen-muxapi-tools: ${PAGE} has no ${begin} ... ${end}`);
    return `${page.slice(0, a + begin.length)}\n${text}\n${page.slice(b)}`;
}

const { table, body } = render(readTools());
const page = readFileSync(PAGE, "utf8");
const next = splice(splice(page, "mcp-area-table", table), "mcp-tools", body);

if (next === page) {
    console.log("gen-muxapi-tools: ok");
} else if (check) {
    console.error("gen-muxapi-tools: the MCP tool reference in internals/muxapi.md is out of date. Run: node scripts/gen-muxapi-tools.mjs");
    process.exit(1);
} else {
    writeFileSync(PAGE, next);
    console.log("gen-muxapi-tools: wrote internals/muxapi.md");
}
