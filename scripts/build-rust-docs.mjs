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
// Failure mode depends on where it runs:
//   - Local dev: if cargo is missing, the submodule is missing, or
//     `cargo doc` fails, print a helpful message and exit 0. Astro's
//     build still succeeds and /api/rust/ shows the placeholder, whose
//     crate links 404. Local dev should not be blocked.
//   - CI (`CI` env var set, as on every GitHub Actions runner): the same
//     conditions exit 1 and fail the build. The deploy used to stay green
//     while shipping only the placeholder (agentmux-docs#131), so a broken
//     Rust reference must now stop the deploy instead of going live
//     unseen. Set RUST_DOCS_OPTIONAL=1 to get the local behaviour in CI
//     (for example, to ship an urgent content fix while the Rust build is
//     broken); do that deliberately, never as a standing default.
//
// System libraries: `cargo doc` still runs every dependency's build
// script, so on Linux the -sys crates need their dev packages
// (libwayland-dev, libxkbcommon-dev, libdbus-1-dev, libxcb1-dev,
// pkg-config). The deploy workflows install them; see deploy.yml.

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, cpSync, readdirSync, readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const submodule = resolve(root, "src", "agentmux");
const target = resolve(root, "public", "api", "rust");

const CRATES = ["agentmux-cef", "agentmux-srv", "agentmux-launcher", "agentmux-common"];

// See "Failure mode" above. Any non-empty CI value other than "false"
// counts, matching how GitHub Actions and most CI systems set it.
const isCI = !!process.env.CI && process.env.CI !== "false";
const strict = isCI && process.env.RUST_DOCS_OPTIONAL !== "1";

// Skip generation: a warning locally, a build failure in CI.
function skip(...lines) {
    for (const line of lines) {
        (strict ? console.error : console.warn)(`[build-rust-docs] ${line}`);
    }
    if (strict) {
        console.error("[build-rust-docs] Failing because CI is set: /api/rust/ would ship only the placeholder.");
        console.error("[build-rust-docs]   Set RUST_DOCS_OPTIONAL=1 to deploy without the Rust reference on purpose.");
        process.exit(1);
    }
    console.warn("[build-rust-docs]   Site build continues; /api/rust/ will show the placeholder.");
    process.exit(0);
}

function have(cmd) {
    try {
        execSync(`${cmd} --version`, { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
}

if (!have("cargo")) {
    skip(
        "cargo not found on PATH — skipping Rust API doc generation.",
        "  Install Rust + cargo to populate /api/rust/.",
    );
}

if (!existsSync(join(submodule, "Cargo.toml"))) {
    skip(
        `submodule missing or not checked out at ${submodule}.`,
        "  Run: git submodule update --init --recursive",
    );
}

console.log(`[build-rust-docs] cargo doc @ ${submodule}`);

const cargoDocArgs = [
    "doc",
    "--no-deps",
    "--workspace",
    ...CRATES.flatMap((c) => ["-p", c]),
    // `cef/dox` is the docs-only mode of the `cef` crate (docs.rs builds it
    // the same way): it turns `cef-dll-sys`'s build script into a no-op, so
    // documenting agentmux-cef no longer downloads the ~hundreds-of-MB CEF
    // binary distribution or compiles its C++ wrapper with cmake/ninja.
    // The Rust API surface is unchanged; only the native build is skipped.
    "--features",
    "cef/dox",
];

// Run cargo doc on stable Rust — no nightly-only flags (the previous
// `--enable-index-page -Zunstable-options` would have failed on stable
// toolchains).
try {
    execSync(`cargo ${cargoDocArgs.join(" ")}`, {
        cwd: submodule,
        stdio: "inherit",
    });
} catch (err) {
    skip(
        `cargo doc failed: ${err.message}`,
        "  For the full Rust reference, fix the build above and rerun `npm run build:rust-docs`.",
    );
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

// The placeholder index links to one page per crate in CRATES. Make sure
// each exists, so a green build means /api/rust/ has no dead crate links.
const missingCrates = CRATES.map((c) => c.replaceAll("-", "_")).filter(
    (dir) => !existsSync(join(target, dir, "index.html")),
);
if (missingCrates.length > 0) {
    console.error(`[build-rust-docs] cargo doc produced no index.html for: ${missingCrates.join(", ")}.`);
    process.exit(1);
}

console.log(`[build-rust-docs] done: ${CRATES.join(", ")}.`);
