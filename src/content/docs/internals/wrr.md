---
title: Window Reality Reconciliation (WRR)
description: How AgentMux keeps its model of windows in sync with what Win32 actually thinks is happening — the drift kinds, the corrective actions, and how to read the reducer event log.
---

:::note[Windows-only by design]
WRR hooks into Win32 (`WM_PAINT`, `SetWindowPos`, `GetForegroundWindow`). A full macOS/Linux WRR observation layer is **not planned** — its drift classes are largely Windows-specific defenses, and Wayland exposes no portable per-window / monitor-topology event API. The cross-platform safety net is instead the host's **orphan reconciler**; the one genuinely cross-platform gap (detecting a window that dies without `on_before_close`) is tracked in [#1569](https://github.com/agentmuxai/agentmux/issues/1569), not as a WRR port. On macOS and Linux, `task dev` runs without WRR drift detection. See [Platform support](/internals/platform-support/).
:::

WRR — Window Reality Reconciliation — is the layer that keeps AgentMux's launcher reducer in sync with the OS. Win32 has a thousand quiet ways for window state to mutate without telling us: a different process steals focus, a monitor goes to sleep, the user drags a window across DPI boundaries, an OEM utility minimizes everything to clear the desktop, an Alt+Tab cycle reorders things mid-paint. WRR notices and corrects.

This page is the model + glossary. The day-to-day "how do I find the WRR record for a specific event?" recipes live in [Debugging](/internals/debugging/#wrr-drift-diagnostics).

## Why WRR exists

AgentMux's launcher is the single writer for window state — process spawn, window create, monitor topology, focus, drag, tear-off. The reducer's view of "what windows are open and where" needs to be authoritative for everything downstream (the host's pool, the renderer's title bar, the saga coordinator's tab placement decisions).

But the reducer can only know what the **host** tells it via the named pipe. The host knows what **CEF + Win32** tell it via WS_EX_NOREDIRECTIONBITMAP, WindowProc messages, and explicit GetWindowRect / GetForegroundWindow probes. Each of those is observation-window-bounded: between the host's poll and the next IPC tick, the OS may have done something the host hasn't reported.

WRR is the launcher arm that says: "I have a model. Here are the host's reports of what Win32 looked like a few hundred microseconds ago. Where do my model and that snapshot disagree, and what's the corrective action?"

## The drift kinds

WRR records drift events as `Event::HwndDriftDetected { kind, .. }` (see `agentmux-launcher/src/reducer/`). Common kinds:

| Drift kind | What it means |
|---|---|
| `HiddenSinceOpen` | A window the launcher believes is foreground hasn't reported a `WM_PAINT` since being opened. Usually benign during the open transient (the OS fires multiple `SetWindowPos` calls during HWND placement); the WRR arm distinguishes "in transient" from "stuck hidden". |
| `HwndWithoutBrowser` | The host has a window HWND but no CefBrowserView attached. Indicates a partial open that the host didn't finish. |
| `MonitorChanged` | The window's containing monitor changed since the last report — DPI / scaling / position need refresh. |
| `BoundsDiverged` | The Win32 bounds (GetWindowRect) don't match what the launcher believes. Could be DPI scaling, could be user drag the launcher missed. |

The reducer applies a corrective action specific to each kind: re-emit a layout fix, queue a `RepositionWindow` command, fire a focus rebalance, or simply log the drift if it's within an acceptable transient window.

## The "just promoted" bridge

A subtle one. Tear-off (the user explicitly drags a tab into its own window) goes through a `ReportPoolWindowRemoved → ReportPoolWindowPromoted → ReportWindowOpened` sequence. Between the promote and the open, the launcher has **no mirror** for that window — `state.pool.contains(label)` is false, `state.windows.get(&label)` is None.

Without compensation, the open-transient corrective logic for `HiddenSinceOpen` would fire indefinitely on the post-promote reposition (multiple `SetWindowPos` during HWND placement). Each fire is a launcher event broadcast to all renderers; without the guard, the host fans the same drift event out across the bridge until the renderer's V8 isolate runs out of stack and crashes.

The reducer's `state.just_promoted_labels` set bridges that microsecond gap: the promote handler inserts into it, the next `ReportWindowOpened` for the same label drains it and starts the new mirror with `foregrounded_since_open: true`. This is `apply_hwnd_visibility_changed`'s gate.

The full forensic write-up is in [`docs/specs/ANALYSIS_DRIFT_STORM_RENDERER_CRASH_2026-05-06.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/ANALYSIS_DRIFT_STORM_RENDERER_CRASH_2026-05-06.md). The PR that closed the gap end-to-end is #709.

## Order tolerance

WRR commands assume the IPC is **out-of-order tolerant**. The host's actual emit order at promote time is `ReportPoolWindowRemoved → ReportPoolWindowPromoted → ReportWindowOpened`, but a fuzzed sequence, replayed log, or buffered burst can reorder them.

So `handle_report_pool_window_promoted` checks: if the open already created the mirror (out-of-order), mark it foregrounded directly and don't bother with the bridge set. Otherwise, insert into `just_promoted_labels` and let the open-time path drain it.

A proptest in `reducer/tests.rs` (`just_promoted_labels_drained_by_open_or_close`) asserts the set is always drained — either by the next open for the same label, or by a close. Bug found on PR #709 round 2.

## Where WRR lives

| Location | Role |
|---|---|
| `agentmux-launcher/src/reducer/` | The reducer arms that consume host reports and emit drift events |
| `agentmux-launcher/src/ipc/server.rs` | The launcher-side WRR observability: takes timestamps, broadcasts drift to subscribers |
| `agentmux-cef/src/commands/window_pool.rs` | The host's emit side — `ReportPoolWindowRemoved`, `ReportPoolWindowPromoted`, `ReportWindowOpened` |
| `<data-dir>/data/launcher-events.log` | The durable event log where every WRR record lands (JSONL) |

## Reading the event log

```bash
# All WRR drift events
grep -E "HiddenSinceOpen|HwndWithoutBrowser|WRR-DRIFT|wfr:gate|wfr:runner|pending=" \
    "$AGENTMUX_DATA_DIR/launcher-events.log"

# Just the promote → open bridge
grep -E "PoolWindowPromoted|ReportWindowOpened|just_promoted" \
    "$AGENTMUX_DATA_DIR/launcher-events.log"
```

`WRR-DRIFT` lines include the connection id (`conn_id=`), the kind, the label, and the HWND — enough to correlate with what the host saw.

See [Debugging](/internals/debugging/) for live-tail recipes (`muxlog`, pointer files), and [Persistence](/internals/persistence/) for the broader role of `launcher-events.log` in the durable log layer.

## Why this is hard to test offline

Win32 races aren't reproducible from unit tests. The reducer's coverage relies on:

- **Proptests** that fuzz the order of arrival of `ReportPool*` and `ReportWindow*` commands within a session and assert invariants (no leaked `just_promoted_labels`, no double-mirrors, no drift storm).
- **Integration tests** that drive the launcher through a real host process, with a real CEF, against a real Chromium, on a real Windows desktop — the only way to catch a regression like the v0.33.655 storm.

The bug pattern in PR #709 — a regression that only surfaced under specific monitor configurations — is the canonical reminder that **proptests + integration is required**, not optional.

## See also

- [Architecture overview](/internals/architecture/) — process topology
- [Reducer stack](/internals/reducer-stack/) — Layer 1 / Layer 2 split
- [Debugging](/internals/debugging/) — drift greps + log discovery
- [Persistence](/internals/persistence/) — `launcher-events.log` durability
