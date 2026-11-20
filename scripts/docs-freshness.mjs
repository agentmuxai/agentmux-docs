#!/usr/bin/env node
// Copyright 2026, AgentMux Corp.
// SPDX-License-Identifier: Apache-2.0
//
// Is the live docs site behind main? A merge to main publishes nothing (deploy.yml runs only on demand), so the site
// can lag without anything saying so. This check, run daily (.github/workflows/docs-freshness.yml), compares the commit
// the last successful deploy built with main, counts the commits since that change what the site shows, and keeps ONE
// issue open while the gap is more than MAX_DAYS days or MAX_COMMITS commits: it updates the issue as the gap changes
// and closes it once a deploy catches the site up. It reads; it never deploys, and it changes nothing about when the
// site is deployed.
//
//   node scripts/docs-freshness.mjs [--dry-run] [--deployed <sha>]
//
// Environment: GITHUB_TOKEN and GITHUB_REPOSITORY (set by Actions), MAX_DAYS (default 7), MAX_COMMITS (default 15).
// `--dry-run` reads everything and writes nothing (it says what it would do). `--deployed <sha>` names the deployed
// commit instead of looking up the last deploy run, for a local run.

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const ISSUE_TITLE = "The live docs site is behind main";
/** Whoever opens and keeps the issue: the Actions token's bot. Another author's issue of the same title is not ours. */
export const ISSUE_AUTHOR = "github-actions[bot]";
/** What the site shows: a change to anything else (scripts, CI, changesets) leaves the live pages as they are. */
export const SITE_PATHS = ["src", "public", "astro.config.mjs"];
/** How many of the commits an issue lists by name. */
const LISTED = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A commit subject as the issue shows it: the author's "Name@host: " prefix is dropped, the (#N) reference stays. */
export function cleanSubject(subject) {
    return subject.replace(/^[^\s:@]+@[^\s:]+:\s*/, "").trim();
}

/** `YYYY-MM-DD` of an ISO time: the issue names days, never clock times. */
const day = (iso) => iso.slice(0, 10);

/**
 * Is the site behind? `deployed` is the last successful deploy ({ sha, at }) or null when there is none on record;
 * `commits` are the commits since it that change what the site shows, newest first ({ sha, at, subject }).
 * Behind means at least one such commit, and either the oldest is more than `maxDays` days old or there are more than
 * `maxCommits` of them. A site with no deploy on record is behind by definition.
 */
export function decide({ deployed, commits, now, maxDays, maxCommits }) {
    const count = commits.length;
    const oldest = commits.length ? commits[commits.length - 1] : null;
    const oldestAgeDays = oldest ? Math.floor((now - Date.parse(oldest.at)) / DAY_MS) : 0;
    const reasons = [];
    if (!deployed) reasons.push("no successful deploy is on record");
    if (count > 0 && oldestAgeDays > maxDays) reasons.push(`the oldest unpublished change is ${oldestAgeDays} days old (the limit is ${maxDays})`);
    if (count > maxCommits) reasons.push(`${count} unpublished changes (the limit is ${maxCommits})`);
    return { behind: reasons.length > 0, reasons, count, oldestAgeDays };
}

/** The issue's text: what is live, what is not, and how to publish. Days only, no names, no private details. */
export function issueBody({ deployed, head, decision, commits }) {
    const lines = [];
    lines.push(
        deployed
            ? `The live docs site was last built from \`${deployed.sha.slice(0, 7)}\` (deployed ${day(deployed.at)}). Main is at \`${head.slice(0, 7)}\`.`
            : `No successful deploy is on record. Main is at \`${head.slice(0, 7)}\`.`
    );
    lines.push("");
    const n = decision.count;
    lines.push(`${n} change${n === 1 ? "" : "s"} to the site ${n === 1 ? "is" : "are"} merged and not live. The site is behind because:`);
    for (const r of decision.reasons) lines.push(`- ${r}`);
    if (commits.length > 0) {
        lines.push("");
        lines.push("Not live yet, newest first:");
        for (const c of commits.slice(0, LISTED)) lines.push(`- ${day(c.at)} ${cleanSubject(c.subject)}`);
        if (commits.length > LISTED) lines.push(`- and ${commits.length - LISTED} older`);
    }
    lines.push("");
    lines.push("A merge to main publishes nothing; the site changes only when the deploy workflow is run (`gh workflow run deploy.yml -R agentmuxai/agentmux-docs`).");
    lines.push("");
    lines.push("This issue is opened, updated and closed by the daily freshness check (`.github/workflows/docs-freshness.yml`). It closes itself when the site catches up.");
    return lines.join("\n");
}

/**
 * Keeps one issue: opens it when the site is behind and there is none, updates its text when that changed, closes it
 * when the site has caught up. Only an issue the Actions bot opened with this title counts. `api(method, path, body)`
 * is the GitHub REST call; `write` false only reports.
 */
export async function syncIssue({ api, repo, behind, body, write = true, log = console.log }) {
    const found = await api("GET", `/repos/${repo}/issues?state=open&creator=${encodeURIComponent(ISSUE_AUTHOR)}&per_page=100`);
    const ours = found.filter((i) => !i.pull_request && i.title === ISSUE_TITLE && i.user?.login === ISSUE_AUTHOR);
    // The oldest is the one kept: a second one (a manual copy, a race) is left alone rather than closed on a guess.
    const issue = ours.sort((a, b) => a.number - b.number)[0];
    if (behind) {
        if (!issue) {
            log("behind, no issue: opening one");
            if (write) await api("POST", `/repos/${repo}/issues`, { title: ISSUE_TITLE, body });
            return "opened";
        }
        if (issue.body === body) {
            log(`behind, issue #${issue.number} is current`);
            return "unchanged";
        }
        log(`behind, updating issue #${issue.number}`);
        if (write) await api("PATCH", `/repos/${repo}/issues/${issue.number}`, { body });
        return "updated";
    }
    if (issue) {
        log(`caught up, closing issue #${issue.number}`);
        if (write) {
            await api("POST", `/repos/${repo}/issues/${issue.number}/comments`, { body: "The live site has caught up with main. Closing." });
            await api("PATCH", `/repos/${repo}/issues/${issue.number}`, { state: "closed", state_reason: "completed" });
        }
        return "closed";
    }
    log("not behind, no issue");
    return "none";
}

/** The changes to what the site shows since the deployed commit, newest first. Without that commit in the clone, by date. */
export function unpublishedCommits({ git, deployed }) {
    const format = "--format=%H%x09%cI%x09%s";
    let range;
    if (!deployed) range = ["-n", "30"];
    else if (git(["cat-file", "-e", `${deployed.sha}^{commit}`], true) !== null) range = [`${deployed.sha}..HEAD`];
    else range = [`--since=${deployed.at}`];
    const out = git(["log", format, ...range, "--", ...SITE_PATHS]);
    return out
        .split("\n")
        .filter(Boolean)
        .map((l) => {
            const [sha, at, ...subject] = l.split("\t");
            return { sha, at, subject: subject.join("\t") };
        });
}

const realGit = (args, quiet = false) => {
    try {
        return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", quiet ? "ignore" : "inherit"] }).trim();
    } catch (e) {
        if (quiet) return null;
        throw e;
    }
};

function realApi(token) {
    return async (method, path, body) => {
        const res = await fetch(`https://api.github.com${path}`, {
            method,
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "docs-freshness",
                ...(body ? { "Content-Type": "application/json" } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status}`);
        return res.status === 204 ? null : res.json();
    };
}

/** The commit the last successful deploy built, and when it finished, or null. */
export async function lastDeploy(api, repo) {
    const r = await api("GET", `/repos/${repo}/actions/workflows/deploy.yml/runs?status=success&event=workflow_dispatch&per_page=1`);
    const run = r.workflow_runs?.[0];
    return run ? { sha: run.head_sha, at: run.updated_at } : null;
}

export async function main(argv = process.argv.slice(2), env = process.env) {
    const dryRun = argv.includes("--dry-run");
    const named = argv.indexOf("--deployed");
    const repo = env.GITHUB_REPOSITORY;
    const token = env.GITHUB_TOKEN;
    if (!repo || !token) throw new Error("GITHUB_REPOSITORY and GITHUB_TOKEN are required");
    const maxDays = Number(env.MAX_DAYS || 7);
    const maxCommits = Number(env.MAX_COMMITS || 15);
    const api = realApi(token);
    const deployed = named >= 0 ? { sha: argv[named + 1], at: new Date(0).toISOString() } : await lastDeploy(api, repo);
    const commits = unpublishedCommits({ git: realGit, deployed });
    const head = realGit(["rev-parse", "HEAD"]);
    const decision = decide({ deployed, commits, now: Date.now(), maxDays, maxCommits });
    console.log(`deployed ${deployed ? deployed.sha.slice(0, 7) : "none"}, main ${head.slice(0, 7)}, ${decision.count} unpublished, behind: ${decision.behind}`);
    for (const r of decision.reasons) console.log(`  ${r}`);
    const body = issueBody({ deployed, head, decision, commits });
    await syncIssue({ api, repo, behind: decision.behind, body, write: !dryRun });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    main().catch((e) => {
        console.error(e.message);
        process.exit(1);
    });
}
