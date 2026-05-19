---
title: Terminal echo-latency benchmark
description: How to measure terminal keystroke echo latency programmatically using the AgentMux App API, and how to interpret before/after results.
---

`tools/tests/bench-term-echo.mjs` is a Node.js benchmark that drives a
terminal pane entirely through the AgentMux WebSocket API — no mouse,
no UI automation. It measures the **wall-clock interval from sending a
command into a PTY until its echo appears in the output stream**, then
reports p50/p95/p99/max across configurable sample counts.

The benchmark was written to validate the `writeInFlight` fix in PR #926
and to give agents a repeatable, CI-friendly instrument for catching future
regressions in the terminal render path.

## Prerequisites

- A running `task dev` instance (release builds don't expose the auth file).
- Node.js 20+ with the `ws` package available (it's in the repo's
  `package.json` devDependencies).

```bash
npm install   # if not already done
```

## Quick start

```bash
# Quiet terminal — 60 samples, 5 warmup
node tools/tests/bench-term-echo.mjs

# Add the busy-terminal scenario and save results
node tools/tests/bench-term-echo.mjs --busy --output-file results.json
```

Sample output:

```
AgentMux terminal echo-latency benchmark
Instance: v0.34.1  WS: ws://127.0.0.1:57208/ws

Opening terminal pane... block=b3a1...

=== Quiet terminal (60 samples, 5 warmup) ===
  Waiting for shell prompt... ok
  p50:  4.2 ms  p95: 12.1 ms  p99: 15.8 ms  max: 18.4 ms

=== Busy terminal (concurrent seq 1 50000) (60 samples, 5 warmup) ===
  Waiting for shell prompt... ok
  p50:  4.9 ms  p95: 13.4 ms  p99: 16.2 ms  max: 22.1 ms

Results saved to results.json
```

## CLI options

| Flag | Default | Description |
|------|---------|-------------|
| `--count <n>` | `60` | Samples per scenario |
| `--warmup <n>` | `5` | Warmup samples to discard (not counted) |
| `--busy` | off | Also run the busy-terminal scenario (concurrent PTY output) |
| `--output-file <path>` | none | Write raw JSON results for comparison |
| `--ws-url <url>` | from authkey.dev | Override WebSocket endpoint |
| `--auth-key <key>` | from authkey.dev | Override auth key |

## Authentication

The script reads `~/.agentmux/dev/<branch>/data/authkey.dev`, the per-session
auth file that `task dev` writes at startup. It picks the newest file whose
recorded `host_pid` is still alive. See
[Test-harness access](/internals/debugging#test-harness-access) for the full
format and security model.

For a release or portable instance you can pass credentials manually:

```bash
node tools/tests/bench-term-echo.mjs \
  --ws-url ws://127.0.0.1:PORT \
  --auth-key YOUR_KEY_HERE
```

## How it works

1. **`pane.open`** — creates a fresh terminal pane programmatically.
2. **`eventsub`** — subscribes to `blockfile` events for that pane; PTY
   output arrives as `eventrecv` messages with a base64 payload.
3. **Sentinel echo** — sends `echo __BENCH_N__\r` for each sample, records
   send time, then waits for `__BENCH_N__` to appear in the PTY stream.
4. **Cleanup** — closes the pane when done (or on Ctrl+C).

The sentinel pattern avoids false matches from concurrent output or shell
prompts. The pane is isolated — the benchmark never touches existing tabs.

## Scenarios

| Scenario | How it's set up | What it reveals |
|----------|----------------|-----------------|
| **Quiet** | Shell at prompt, no concurrent output | Baseline echo path, scheduler cost |
| **Busy** (`--busy`) | `seq 1 50000 > /dev/null &` running during measurement | RAF coalescing contention, `writeInFlight` interactions |

The **busy scenario** is the one most sensitive to xterm.js batching bugs. The
`writeInFlight` fix (PR #926) specifically targets this path: before the fix,
keystroke echoes fell through to the RAF queue when a large PTY batch was
in-flight, adding up to one frame (~16 ms) of jitter.

## Before/after comparison

Save results before and after a change, then diff with Node:

```bash
# Baseline (pre-fix branch or released version)
node tools/tests/bench-term-echo.mjs --busy --output-file before.json

# After applying the fix
node tools/tests/bench-term-echo.mjs --busy --output-file after.json

# Compare
node -e "
const b = JSON.parse(require('fs').readFileSync('before.json'));
const a = JSON.parse(require('fs').readFileSync('after.json'));
const fmt = (x) => x.toFixed(1) + ' ms';
console.log('           before  after');
console.log('quiet p95:', fmt(b.quiet.p95), ' ->', fmt(a.quiet.p95));
console.log('busy  p95:', fmt(b.busy.p95),  ' ->', fmt(a.busy.p95));
console.log('busy  p99:', fmt(b.busy.p99),  ' ->', fmt(a.busy.p99));
"
```

A meaningful improvement shows P95/P99 drop in the **busy** scenario.
The quiet scenario is less sensitive to the fix (it only activates when
another write is in-flight).

## Performance targets

These targets are guidelines, not CI gates (yet). The busy scenario is
the meaningful one because it exercises the edge the fix addresses.

| Metric | Target |
|--------|--------|
| Quiet P95 | ≤ 20 ms |
| Busy P95  | ≤ 20 ms (pre-fix was typically 25–40 ms on a loaded instance) |

## The fix context

`frontend/app/view/term/termwrap.ts` has two paths for writing xterm.js:

- **Fast path** (≤ 512 bytes, no queued data): calls `terminal.write()`
  directly — minimal latency.
- **RAF path**: coalesces multiple PTY chunks per frame — prevents cursor
  flicker from Ink redraws.

Before PR #926, the fast path additionally required `!this.writeInFlight`.
When any large PTY batch was in-flight, echoes missed the fast path and
waited up to one frame. xterm.js serialises `write()` calls internally, so
the guard was unnecessary and has been removed.

## Related

- [Debugging](/internals/debugging) — log access, CEF DevTools, perf HUD
- [Agent App API](/internals/agent-app-api) — full WS protocol reference
- [`tools/tests/authfile.ps1`](https://github.com/agentmuxai/agentmux/blob/main/tools/tests/authfile.ps1) — PowerShell helper for the same auth file
- [`scripts/bench-cdp.mjs`](https://github.com/agentmuxai/agentmux/blob/main/scripts/bench-cdp.mjs) — CDP-based scroll FPS + heap benchmark
