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
import { existsSync, mkdirSync, rmSync, cpSync } from "node:fs";
import { resolve, dirname } from "node:path";
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

execSync(`cargo ${cargoDocArgs.join(" ")}`, {
    cwd: submodule,
    stdio: "inherit",
    env: { ...process.env, RUSTDOCFLAGS: "--enable-index-page -Zunstable-options" },
});

const generatedDir = resolve(submodule, "target", "doc");
if (!existsSync(generatedDir)) {
    console.error(`[build-rust-docs] cargo doc finished but ${generatedDir} is missing.`);
    process.exit(1);
}

console.log(`[build-rust-docs] copying ${generatedDir} → ${target}`);
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(generatedDir, target, { recursive: true });

console.log("[build-rust-docs] done.");
