#!/usr/bin/env node
// Copyright 2026, AgentMux Corp.
// SPDX-License-Identifier: Apache-2.0
//
// gen-settings-reference.mjs: writes the key tables of src/content/docs/settings-json-reference.md from the settings
// schema of the agentmux repo (schema/settings.json), so the page names every key once, with its type, default,
// allowed values, platform and description.
//
//   node scripts/gen-settings-reference.mjs --schema <agentmux>/schema/settings.json --baseline <agentmux>/scripts/check-settings-keys.baseline
//
// The page is the text between the two `generated` markers: run this to replace it, and write prose outside them by hand.
// Left out: the families (`app:*`, `widget:hidden@<widget>`), and every key the baseline lists as `schema-not-read`
// (nothing reads it, so setting it does nothing; the Settings Reference page lists those by name).
// A secret key never shows a default or an example.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.join(here, "..", "src", "content", "docs", "settings-json-reference.md");
const BEGIN = "<!-- generated: node scripts/gen-settings-reference.mjs -->";
const END = "<!-- end generated -->";

/** The order the groups appear in (the order of the generated settings.json); a section not listed fails. */
export const SECTION_ORDER = [
    "Terminal", "Drag and drop", "Animations", "Window", "Panes and tabs", "Keyboard", "Shell environment", "App",
    "Telemetry", "Connections", "Notifications", "Voice input", "Attachments", "Agents", "Swarm supervisor",
    "Kanban", "Browser panes", "Jobs", "Disk cleanup", "Desktop control", "Files pane", "Editor", "Network", "Cloud and sharing", "Messaging",
];
const PLATFORM = { windows: "Windows", macos: "macOS", linux: "Linux" };
const isFamily = (key) => /[*@<]/.test(key);

/** Descriptions that are worded for the file's comment in a way the docs cannot use as they are: they tell the story of an
 *  earlier behaviour, or name code. The words here are the current behaviour only. */
const REWORDED = {
    "attachments:enabled": "Paste or drop files (images and any other kind) into the agent composer as attachments, shown as tiles above the text. When false, pasted and dropped files are copied into the working folder.",
    "agent:turnscopedtail": "Agent panes keep only the turn in flight (plus anything still running) always mounted; older messages are virtualized. When false, the last 50 messages stay mounted. Takes effect when a pane is next opened.",
    "agents:always_available": "Closing an agent's pane does not stop the agent: it keeps running and can still be messaged, until the idle and cap limits stop it. Off by false, \"false\", \"off\", \"no\", \"0\" or 0.",
    "voice:engine": "Speech-to-text engine. 'groq' (the default, and what an absent key means) sends captured audio to the hosted Groq Whisper backend; 'whisper-local' uses a local whisper.cpp binary; 'webspeech' uses the browser API, which only development builds support.",
    "launcher:recent": "The widget keys opened last, newest first (at most 12): the Shortcuts pane shows these tiles first. Kept by the app; empty until a widget is opened.",
    "supervisor:enabled": "The Swarm Supervisor's master switch. While off, nothing is judged or continued, a pane can't be set to Steady or Drive, and a mode set earlier is not read.",
};

/** A description is written for the comment in settings.json; the pointers to specs are for the code's readers, not the docs'. */
export function forReaders(text, key) {
    if (REWORDED[key]) return REWORDED[key];
    return String(text)
        .replace(/[;,]?\s*[Ss]ee docs\/specs\/.*$/s, "")
        .replace(/\s*\((?:see )?(?:docs\/specs\/|SPEC_)[^)]*\)/g, "")
        .replace(/\s*Default (?:true|false)\.(?=\s|$)/g, "")
        .replace(/\s*Key name kept for compatibility; it covers all sounds\./, " It covers all sounds.")
        .replace(/([^.!?])\s*$/, "$1.");
}

/** Text for a table cell: one line, `|` escaped, and `<` outside backticks shown as text rather than read as a tag. */
export function cell(text) {
    return String(text)
        .replace(/\s+/g, " ")
        .trim()
        .split("`")
        .map((part, i) => (i % 2 === 1 ? part.replace(/\|/g, "\\|") : part.replace(/\|/g, "\\|").replace(/</g, "&lt;").replace(/>/g, "&gt;")))
        .join("`");
}
const code = (text) => "`" + String(text).replace(/\|/g, "\\|") + "`";

function typeOf(def) {
    if (def.oneOf) return "string or object";
    const t = Array.isArray(def.type) ? def.type : [def.type];
    if (t[0] === "array") {
        const item = def.items?.type;
        return item ? `list of ${item === "string" ? "strings" : item === "object" ? "objects" : item + "s"}` : "list";
    }
    return t.filter(Boolean).join(" or ") || "any";
}

function allowedOf(def, key) {
    if (def.oneOf) {
        const words = def.oneOf.find((o) => o.enum)?.enum;
        return words ? `${words.map(code).join(", ")}, or an object (see the description)` : "—";
    }
    if (def.enum) return def.enum.map((v) => code(JSON.stringify(v))).join(", ");
    const lo = def.minimum, hi = def.maximum;
    if (lo !== undefined && hi !== undefined) return `${lo} to ${hi}`;
    if (lo !== undefined) return `${lo} or more`;
    if (hi !== undefined) return `${hi} or less`;
    if (def.exclusiveMinimum !== undefined) return `more than ${def.exclusiveMinimum}`;
    if (key === "keybindings") return "objects with `command` and optionally `key`, `when`, `platform`";
    return "—";
}

function defaultOf(def) {
    if (def["x-secret"] === true) return "—";
    if ("default" in def) {
        const v = def.default;
        return code(typeof v === "string" ? JSON.stringify(v) : JSON.stringify(v));
    }
    return "Unset";
}

export function tables(schema, baselineText) {
    const unread = new Set(
        baselineText.split("\n").filter((l) => l.startsWith("schema-not-read\t")).map((l) => l.split("\t")[1]),
    );
    const props = schema.$defs.SettingsType.properties;
    const by = new Map();
    for (const [key, def] of Object.entries(props)) {
        if (isFamily(key) || unread.has(key)) continue;
        const section = def["x-section"];
        if (!section) throw new Error(`${key} has no x-section`);
        if (!SECTION_ORDER.includes(section)) throw new Error(`${key}: section "${section}" is not in SECTION_ORDER`);
        if (!def.description) throw new Error(`${key} has no description`);
        if (!by.has(section)) by.set(section, []);
        by.get(section).push([key, def]);
    }
    const out = [];
    let count = 0;
    for (const section of SECTION_ORDER) {
        const rows = by.get(section);
        if (!rows) continue;
        out.push(`## ${section}`, "", "| Key | Type | Default | Allowed values | Platform | Description |", "|---|---|---|---|---|---|");
        for (const [key, def] of rows) {
            const platform = (def["x-platform"] ?? []).map((p) => PLATFORM[p] ?? p).join(", ") || "All";
            const left = def["x-nodefault"] && def["x-secret"] !== true && !REWORDED[key] ? ` When left out: ${def["x-nodefault"]}.` : "";
            out.push(`| ${code(key)} | ${typeOf(def)} | ${defaultOf(def)} | ${allowedOf(def, key)} | ${platform} | ${cell(forReaders(def.description, key) + left)} |`);
            count++;
        }
        out.push("");
    }
    return { text: out.join("\n"), count };
}

function arg(name) {
    const i = process.argv.indexOf(name);
    return i > 0 ? process.argv[i + 1] : undefined;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const schemaPath = arg("--schema"), baselinePath = arg("--baseline");
    if (!schemaPath || !baselinePath) {
        console.error("usage: gen-settings-reference.mjs --schema <schema/settings.json> --baseline <scripts/check-settings-keys.baseline>");
        process.exit(2);
    }
    const { text, count } = tables(JSON.parse(fs.readFileSync(schemaPath, "utf8")), fs.readFileSync(baselinePath, "utf8"));
    const page = fs.readFileSync(PAGE, "utf8");
    const a = page.indexOf(BEGIN), b = page.indexOf(END);
    if (a < 0 || b < a) throw new Error("the page has no generated markers");
    fs.writeFileSync(PAGE, `${page.slice(0, a + BEGIN.length)}\n\n${text}\n${page.slice(b)}`);
    console.log(`wrote ${count} keys`);
}
