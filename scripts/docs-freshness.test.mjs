// Copyright 2026, AgentMux Corp.
// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cleanSubject, decide, ISSUE_AUTHOR, ISSUE_TITLE, issueBody, lastDeploy, syncIssue, unpublishedCommits } from "./docs-freshness.mjs";

const NOW = Date.parse("2026-11-20T12:00:00Z");
const daysAgo = (n) => new Date(NOW - n * 86400000).toISOString();
const commit = (n, subject = "docs: a page (#1)") => ({ sha: `c${n}`.padEnd(40, "0"), at: daysAgo(n), subject });
const deployed = { sha: "d".repeat(40), at: daysAgo(10) };
const limits = { now: NOW, maxDays: 7, maxCommits: 15 };

describe("decide", () => {
    it("is not behind when everything merged is live", () => {
        const d = decide({ deployed, commits: [], ...limits });
        assert.equal(d.behind, false);
        assert.equal(d.count, 0);
    });

    it("is not behind for a few recent changes", () => {
        const d = decide({ deployed, commits: [commit(1), commit(3)], ...limits });
        assert.equal(d.behind, false);
        assert.equal(d.count, 2);
    });

    it("is behind when the oldest unpublished change is more than the limit old, and says how old", () => {
        const d = decide({ deployed, commits: [commit(1), commit(8)], ...limits });
        assert.equal(d.behind, true);
        assert.equal(d.oldestAgeDays, 8);
        assert.match(d.reasons[0], /8 days old \(the limit is 7\)/);
    });

    it("is not behind at exactly the limit", () => {
        assert.equal(decide({ deployed, commits: [commit(7)], ...limits }).behind, false);
    });

    it("is behind when there are more unpublished changes than the limit, however recent", () => {
        const commits = Array.from({ length: 16 }, (_, i) => commit(1, `docs: page ${i}`));
        const d = decide({ deployed, commits, ...limits });
        assert.equal(d.behind, true);
        assert.match(d.reasons.join(" "), /16 unpublished changes \(the limit is 15\)/);
    });

    it("is behind when no deploy is on record", () => {
        const d = decide({ deployed: null, commits: [], ...limits });
        assert.equal(d.behind, true);
        assert.match(d.reasons[0], /no successful deploy is on record/);
    });
});

describe("cleanSubject and issueBody", () => {
    it("drops the author's prefix and keeps the PR number", () => {
        assert.equal(cleanSubject("Opaz@charlie: docs: settings.json reference (#306)"), "docs: settings.json reference (#306)");
        assert.equal(cleanSubject("docs: no prefix (#2)"), "docs: no prefix (#2)");
    });

    const body = (commits, over = {}) =>
        issueBody({ deployed, head: "a".repeat(40), decision: decide({ deployed, commits, ...limits, ...over }), commits });

    it("names days and commits, never a clock time or an author", () => {
        const text = body([commit(1, "Winny@narko: docs: Headless (#300)"), commit(9, "Opaz@charlie: docs: Sysinfo (#305)")]);
        assert.match(text, /last built from `d{7}` \(deployed 2026-11-10\)/);
        assert.match(text, /Main is at `a{7}`/);
        assert.match(text, /- 2026-11-19 docs: Headless \(#300\)/);
        assert.doesNotMatch(text, /\d\d:\d\d/);
        assert.doesNotMatch(text, /Winny|Opaz|narko|charlie/);
        assert.match(text, /gh workflow run deploy\.yml/);
    });

    it("lists the newest twenty and counts the rest", () => {
        const commits = Array.from({ length: 25 }, (_, i) => commit(1 + i, `docs: page ${i}`));
        const text = body(commits);
        assert.equal(text.split("\n").filter((l) => /^- 2026-/.test(l)).length, 20);
        assert.match(text, /- and 5 older/);
    });
});

/** A fake GitHub: open issues in, the writes it was sent out. */
function fakeApi(issues) {
    const calls = [];
    const api = async (method, path, body) => {
        calls.push({ method, path, body });
        if (method === "GET") return issues;
        return null;
    };
    return { api, calls };
}
const ours = (over = {}) => ({ number: 5, title: ISSUE_TITLE, body: "old", user: { login: ISSUE_AUTHOR }, ...over });
const quiet = () => {};

describe("syncIssue keeps one issue", () => {
    it("opens it when behind and there is none", async () => {
        const { api, calls } = fakeApi([]);
        assert.equal(await syncIssue({ api, repo: "o/r", behind: true, body: "B", log: quiet }), "opened");
        assert.deepEqual(calls[1], { method: "POST", path: "/repos/o/r/issues", body: { title: ISSUE_TITLE, body: "B" } });
    });

    it("updates its text when the gap changed", async () => {
        const { api, calls } = fakeApi([ours()]);
        assert.equal(await syncIssue({ api, repo: "o/r", behind: true, body: "new", log: quiet }), "updated");
        assert.deepEqual(calls[1], { method: "PATCH", path: "/repos/o/r/issues/5", body: { body: "new" } });
    });

    it("writes nothing when the text is the same", async () => {
        const { api, calls } = fakeApi([ours({ body: "same" })]);
        assert.equal(await syncIssue({ api, repo: "o/r", behind: true, body: "same", log: quiet }), "unchanged");
        assert.equal(calls.length, 1);
    });

    it("closes it, with a comment, once the site has caught up", async () => {
        const { api, calls } = fakeApi([ours()]);
        assert.equal(await syncIssue({ api, repo: "o/r", behind: false, body: "x", log: quiet }), "closed");
        assert.equal(calls[1].path, "/repos/o/r/issues/5/comments");
        assert.deepEqual(calls[2], { method: "PATCH", path: "/repos/o/r/issues/5", body: { state: "closed", state_reason: "completed" } });
    });

    it("does nothing when not behind and there is none", async () => {
        const { api, calls } = fakeApi([]);
        assert.equal(await syncIssue({ api, repo: "o/r", behind: false, body: "x", log: quiet }), "none");
        assert.equal(calls.length, 1);
    });

    it("only counts an issue the Actions bot opened, with that title, that is not a pull request", async () => {
        const { api, calls } = fakeApi([
            ours({ number: 1, user: { login: "someone" } }),
            ours({ number: 2, title: "Another issue" }),
            ours({ number: 3, pull_request: {} }),
        ]);
        assert.equal(await syncIssue({ api, repo: "o/r", behind: true, body: "B", log: quiet }), "opened");
        assert.equal(calls.length, 2);
    });

    it("keeps the oldest of several and closes none of them on a guess", async () => {
        const { api, calls } = fakeApi([ours({ number: 9, body: "x" }), ours({ number: 4, body: "x" })]);
        await syncIssue({ api, repo: "o/r", behind: true, body: "new", log: quiet });
        assert.equal(calls[1].path, "/repos/o/r/issues/4");
        assert.equal(calls.length, 2);
    });

    it("reports and writes nothing in a dry run", async () => {
        const { api, calls } = fakeApi([]);
        const said = [];
        await syncIssue({ api, repo: "o/r", behind: true, body: "B", write: false, log: (m) => said.push(m) });
        assert.equal(calls.length, 1);
        assert.match(said[0], /opening one/);
    });
});

describe("unpublishedCommits and lastDeploy", () => {
    it("reads the commits since the deployed one that touch what the site shows", () => {
        const seen = [];
        const git = (args, quiet) => {
            seen.push(args);
            if (args[0] === "cat-file") return "";
            return ["a1\t2026-11-19T01:00:00Z\tdocs: one (#1)", "b2\t2026-11-12T01:00:00Z\tdocs: two\twith a tab (#2)"].join("\n");
        };
        const commits = unpublishedCommits({ git, deployed });
        assert.deepEqual(commits.map((c) => c.sha), ["a1", "b2"]);
        assert.equal(commits[1].subject, "docs: two\twith a tab (#2)");
        const log = seen.find((a) => a[0] === "log");
        assert.ok(log.includes(`${deployed.sha}..HEAD`));
        assert.deepEqual(log.slice(log.indexOf("--") + 1), ["src", "public", "astro.config.mjs"]);
    });

    it("falls back to the deploy's date when the deployed commit is not in the clone", () => {
        const git = (args) => (args[0] === "cat-file" ? null : "");
        let used;
        unpublishedCommits({ git: (a, q) => ((used = a[0] === "log" ? a : used), git(a, q)), deployed });
        assert.ok(used.includes(`--since=${deployed.at}`));
    });

    it("reads the newest deploy run that succeeded, or none", async () => {
        const run = { head_sha: "abc", updated_at: "2026-11-10T08:00:00Z" };
        assert.deepEqual(await lastDeploy(async () => ({ workflow_runs: [run] }), "o/r"), { sha: "abc", at: run.updated_at });
        assert.equal(await lastDeploy(async () => ({ workflow_runs: [] }), "o/r"), null);
    });
});
