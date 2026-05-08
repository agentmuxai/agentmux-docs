// Build rustdoc HTML for the agentmux crates and stage it under
// public/api/rust/ so Astro serves it as static assets at
// /api/rust/<crate>/. Wired from package.json's `build:rust-docs`
// script and the higher-level `build:full` script.
//
// This is opt-in: `npm run build` (the default) skips this step so
// people can iterate on the docs site without the Rust toolchain.
// CI / release builds use `npm run build:full`.
//
// Inputs:
//   - src/agentmux (git submodule, pinned in agentmux-docs's .gitmodules)
//
// Outputs:
//   - public/api/rust/<crate>/index.html ... (rustdoc HTML)
//   - public/api/rust/index.html (rustdoc's umbrella index)
//
// Failure mode: if cargo isn't available, prints a helpful message
// and exits 0 — Astro's build still succeeds, the /api/rust/ link
// just 404s. CI should fail loudly; local dev should not be blocked.

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, cpSync, readdirSync, readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const submodule = resolve(root, "src", "agentmux");
const target = resolve(root, "public", "api", "rust");

const CRATES = ["agentmux-cef", "agentmux-srv", "agentmux-launcher", "agentmux-common"];

function have(cmd) {
    try {
        execSync(`${cmd} --version`, { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
}

if (!have("cargo")) {
    console.warn("[build-rust-docs] cargo not found on PATH — skipping Rust API doc generation.");
    console.warn("[build-rust-docs]   Install Rust + cargo to populate /api/rust/.");
    process.exit(0);
}

if (!existsSync(submodule)) {
    console.warn(`[build-rust-docs] submodule missing at ${submodule}.`);
    console.warn("[build-rust-docs]   Run: git submodule update --init --recursive");
    process.exit(0);
}

console.log(`[build-rust-docs] cargo doc @ ${submodule}`);

const cargoDocArgs = [
    "doc",
    "--no-deps",
    "--workspace",
    ...CRATES.flatMap((c) => ["-p", c]),
];

// Run cargo doc on stable Rust — no nightly-only flags (the previous
// `--enable-index-page -Zunstable-options` would have failed on stable
// toolchains). Wrap in try/catch so a build failure here doesn't take
// down the whole site build; we treat it the same as cargo-not-found.
try {
    execSync(`cargo ${cargoDocArgs.join(" ")}`, {
        cwd: submodule,
        stdio: "inherit",
    });
} catch (err) {
    console.warn(`[build-rust-docs] cargo doc failed: ${err.message}`);
    console.warn("[build-rust-docs]   Site build continues; /api/rust/ will show the placeholder.");
    console.warn("[build-rust-docs]   For the full Rust reference, fix the build above and rerun `npm run build:rust-docs`.");
    process.exit(0);
}

const generatedDir = resolve(submodule, "target", "doc");
if (!existsSync(generatedDir)) {
    console.error(`[build-rust-docs] cargo doc finished but ${generatedDir} is missing.`);
    process.exit(1);
}

console.log(`[build-rust-docs] copying ${generatedDir} → ${target}`);
mkdirSync(target, { recursive: true });

// Capture the committed placeholder bytes BEFORE the copy so we can
// detect overwrite-by-cargo (not just deletion). cargo doc on stable
// without `--enable-index-page` does NOT emit a root index.html, but
// a future release could flip that on, and a content check is the
// only way to notice the silent overwrite.
const placeholderPath = join(target, "index.html");
const expectedPlaceholderBytes = existsSync(placeholderPath)
    ? readFileSync(placeholderPath)
    : null;

// Only remove entries that cargo is about to replace, by name —
// anything not produced by cargo (the placeholder) survives.
const generatedEntries = readdirSync(generatedDir);
for (const name of generatedEntries) {
    const dest = join(target, name);
    if (existsSync(dest)) {
        rmSync(dest, { recursive: true, force: true });
    }
    cpSync(join(generatedDir, name), dest, { recursive: true });
}

// Verify the placeholder survived BIT-FOR-BIT. existsSync alone would
// pass even if cargo overwrote the file with its own index.
if (expectedPlaceholderBytes !== null) {
    if (!existsSync(placeholderPath)) {
        console.error(`[build-rust-docs] placeholder ${placeholderPath} missing after copy.`);
        process.exit(1);
    }
    const actualBytes = readFileSync(placeholderPath);
    if (!actualBytes.equals(expectedPlaceholderBytes)) {
        console.error(`[build-rust-docs] placeholder ${placeholderPath} was OVERWRITTEN by cargo.`);
        console.error("[build-rust-docs]   Cargo doc started emitting a root index.html. Update this script:");
        console.error("[build-rust-docs]     - either remove the placeholder and use cargo's index, or");
        console.error("[build-rust-docs]     - skip cargo's index in the copy loop above.");
        process.exit(1);
    }
}

console.log("[build-rust-docs] done.");
