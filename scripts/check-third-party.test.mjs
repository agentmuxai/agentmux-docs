import assert from "node:assert/strict";
import { test } from "node:test";
import { cssReferences, hostOf, htmlReferences, isAnalyticsTag, isCookieless, isOurs, problemsInCss, problemsInHtml } from "./check-third-party.mjs";

const TAG = `<script src="https://traffic.agentmux.ai/sdk.js" data-app="agentmux" data-cookieless async></script>`;

test("a page that loads only from itself and its own subdomains has no problems", () => {
    const html = `<html><head>
        <link rel="stylesheet" href="/assets/index-abc.css">
        <link rel="icon" href="/favicon.svg">
        <link rel="canonical" href="https://agentmux.ai/privacy">
        ${TAG}
        <style>@font-face{font-family:A;src:url(/assets/archivo.woff2)} .x{background:url("data:image/svg+xml;base64,AAAA")}</style>
        </head><body>
        <img src="/shots/a.webp" srcset="/shots/a.webp 1x, /shots/a@2x.webp 2x">
        <video poster="/shots/p.webp"><source src="/clips/a.mp4"></video>
        <a href="https://github.com/agentmuxai/agentmux">GitHub</a>
        </body></html>`;
    assert.deepEqual(problemsInHtml(html), []);
});

test("a link a visitor clicks, or a canonical link to another site, is not a load", () => {
    assert.deepEqual(problemsInHtml(`<a href="https://example.com/x">x</a><link rel="alternate" href="https://example.com/feed">`), []);
});

test("each kind of third-party load is reported with its host", () => {
    const cases = [
        [`<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">`, "fonts.googleapis.com"],
        [`<link rel="preconnect" href="https://fonts.gstatic.com">`, "fonts.gstatic.com"],
        [`<script src="//cdn.example.com/a.js"></script>`, "cdn.example.com"],
        [`<img src="https://img.shields.io/badge/x.svg">`, "img.shields.io"],
        [`<img src="/a.webp" srcset="/a.webp 1x, https://cdn.example.com/a@2x.webp 2x">`, "cdn.example.com"],
        [`<iframe src="https://www.youtube.com/embed/x"></iframe>`, "www.youtube.com"],
        [`<video poster="https://cdn.example.com/p.webp"></video>`, "cdn.example.com"],
        [`<object data="https://cdn.example.com/x.svg"></object>`, "cdn.example.com"],
        [`<style>@import "https://fonts.googleapis.com/css";</style>`, "fonts.googleapis.com"],
        [`<div style="background:url('https://cdn.example.com/bg.png')"></div>`, "cdn.example.com"],
        [`<svg><image href="https://cdn.example.com/a.png"/></svg>`, "cdn.example.com"],
        [`<svg><use xlink:href="https://cdn.example.com/a.svg#a"/></svg>`, "cdn.example.com"],
        [`<svg><filter><feImage href="https://cdn.example.com/f.png"/></filter></svg>`, "cdn.example.com"],
        [`<body background="https://cdn.example.com/bg.png">`, "cdn.example.com"],
    ];
    for (const [html, host] of cases) {
        const problems = problemsInHtml(html);
        assert.equal(problems.length, 1, html);
        assert.match(problems[0], new RegExp(`from ${host.replaceAll(".", "\\.")}`), html);
    }
});

test("the analytics tag without data-cookieless is a problem; with it, none", () => {
    assert.deepEqual(problemsInHtml(TAG), []);
    const stripped = TAG.replace(" data-cookieless", "");
    const problems = problemsInHtml(stripped);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /no data-cookieless/);
    // An attribute that only starts the same way doesn't count.
    assert.equal(problemsInHtml(TAG.replace("data-cookieless", "data-cookieless-off")).length, 1);
    // Nor does one switched off by its value; an empty or "true" value is on.
    for (const off of [`data-cookieless="false"`, "data-cookieless=false", `data-cookieless="0"`, `data-cookieless='off'`]) {
        assert.equal(problemsInHtml(TAG.replace("data-cookieless", off)).length, 1, off);
    }
    for (const on of [`data-cookieless=""`, `data-cookieless="true"`]) assert.deepEqual(problemsInHtml(TAG.replace("data-cookieless", on)), [], on);
});

test("the SDK's tag is still the analytics tag when it moves to another of our hosts", () => {
    const moved = `<script src="https://stats.agentmux.ai/sdk.js" data-app="agentmux" async></script>`;
    assert.equal(isAnalyticsTag(moved), true);
    assert.match(problemsInHtml(moved)[0], /no data-cookieless/);
    assert.equal(isAnalyticsTag(`<script src="/assets/index-abc.js" type="module"></script>`), false);
    assert.equal(isAnalyticsTag(`<script data-app="agentmux">inline()</script>`), false);
    assert.equal(isCookieless(TAG), true);
});

test("an SVG that points inside the page, or at our own files, is not a problem", () => {
    assert.deepEqual(problemsInHtml(`<svg><use href="#icon"/><image href="/shots/a.webp"/></svg><div data-background="https://cdn.example.com/x.png"></div>`), []);
});

test("a stylesheet's url() and @import are read, and a third-party one is reported", () => {
    assert.deepEqual(cssReferences(`a{background:url( "/a.png" )} b{background:url(/b.png)} @import 'c.css';`), ["/a.png", "/b.png", "c.css"]);
    assert.deepEqual(problemsInCss(`@font-face{src:url(/assets/a.woff2)}`), []);
    assert.equal(problemsInCss(`@font-face{src:url(https://fonts.gstatic.com/s/a.woff2)}`).length, 1);
});

test("hosts: ours is agentmux.ai and its subdomains, never a look-alike", () => {
    assert.equal(isOurs("agentmux.ai"), true);
    assert.equal(isOurs("docs.agentmux.ai"), true);
    assert.equal(isOurs("notagentmux.ai"), false);
    assert.equal(isOurs("agentmux.ai.example.com"), false);
    assert.equal(hostOf("/assets/x.js"), "agentmux.ai");
    assert.equal(hostOf("data:image/png;base64,AAAA"), null);
    assert.equal(hostOf("#top"), null);
    assert.equal(hostOf("//CDN.Example.com/x.js"), "cdn.example.com");
    assert.equal(htmlReferences(`<img src="/a.webp">`).length, 1);
});
