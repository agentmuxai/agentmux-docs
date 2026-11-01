---
title: Agent pane virtualization
description: How the agent message list is rendered to stay snappy at 2000+ messages — hybrid virtualization with a streaming buffer, anchor-based scroll preservation, and per-kind perf probes.
---

The agent pane displays the conversation as an ordered list of `DocumentNode`s — one per assistant message, user message, tool call, agent-to-agent message, shell command, etc. Long sessions accumulate 500-2000+ nodes. Rendering all of them in the DOM at once made the layout tree heavy enough that tab-switching INTO a pane with an active agent stalled for 200-300ms.

The renderer (`frontend/app/view/agent/virtualization/`) keeps only the rows in view, plus 5 rows of overscan on each side, mounted in the virtualized region, and always mounts the trailing 50 nodes (the streaming buffer). Every other row is virtualized.

## Three architectural decisions

### 1. Hybrid virtualization

<img src="/diagrams/agent-pane-virtualization.svg" alt="Scroll region containment: outer scrollRef (.agent-document, purple border) contains two inner regions side by side — virtualized region (steel-blue, position:relative, rows absolute translateY) and streaming buffer (blue, always mounted last 50 rows, normal flex flow)." style="max-width:100%" />

The virtualized region is custom, not a virtualization library. Its rows sit at absolute positions taken from the layout slice (`frontend/app/store/agent-pane-layout/`), a reducer that holds each row's measured and estimated height and computes every position as a prefix sum of those heights, so neighbouring rows never overlap. Each mounted row reports its height to the slice through a `ResizeObserver`. The streaming buffer (the trailing 50 rows) is rendered with a normal `<Index>` so token deltas to active streaming nodes update in place — no recycling, no measurement lag. As rows age past the buffer, they transition into the virtualized region by which point their measurement has stabilized.

Why `<Index>` and not `<For>` for the streaming buffer: each token replaces a node's object reference (immutable update preserves id but produces a fresh value), and `<For>` reconciles by reference, which would unmount and remount the streaming row on every token. `<Index>` keys by position and exposes the item as a Solid signal, so the same `DocumentRow` stays mounted while its `props.node()` re-reads.

### 2. Scroll state in data, not DOM

Anchor and stick-to-bottom flags live in the Solid store (`AgentViewState`):

```ts
{
    nodes: Accessor<readonly DocumentNode[]>,
    nodeIndex: Accessor<ReadonlyMap<string, number>>,  // O(1) id → index
    stickToBottom: Accessor<boolean>,
    headAnchor: Accessor<{ nodeId: string, offsetPx: number } | null>,
    streamingNodeId: Accessor<string | null>,
    // ... atomic mutations: engageStickToBottom, captureHeadAnchor, ...
}
```

The view projects this state into the DOM; it does not derive state from layout reads. The one reader of `scrollTop` is the follow controller (`frontend/app/view/agent/scroll/`), a small state machine for whether the pane follows the newest output. Only a user gesture can leave the following state: a wheel-up, a key press, a selection or a jump to a node. A clamp, a layout adjustment or a history page-in cannot. When history pagination prepends 200 older nodes, the view captures the topmost-visible node id as an anchor, fetches, then restores scroll to that node's new offset. The arithmetic uses node ids, not pixel deltas — robust against `ResizeObserver`-driven height changes that haven't settled yet.

CSS `overflow-anchor: auto` on the scroll container is the cheap belt to the JS suspenders: Chromium auto-pins a visible anchor element when content above it changes height (image loads, tool block expand). The JS layer handles the cases CSS can't (programmatic scroll, remount).

### 3. Per-kind size estimators + intelligent perf probing

Each `DocumentNode` kind declares its own size estimator in the renderer registry:

| Kind | Estimator |
|---|---|
| `agent_message` | text-line heuristic, capped at 320px; collapsed → 32px |
| `user_message` | unwrapped text-line heuristic; a collapsed startup message → 32px |
| `tool` | expanded → 200px (a content-first tool uses the preview cap), collapsed → 32px |
| `markdown` | text-line heuristic plus a fixed allowance per inline image; a collapsed thought → 32px |
| `shell` | collapsed → 32px, expanded → 200px |
| `context_compacted` | 48px |
| Other one-line rows (`system_note`, `day_divider`, `history_link`, `resume_preflight`, `hidden_run` and so on) | a fixed height per kind |

`estimateNodeForState` gives an estimate for each open state, because the slice keeps measurements per row and state. The open or closed answer comes from one rule, `rowDisclosure` in `disclosure.ts`, shared by the rows, the slice and the estimators. These replace the single `estimateSize: () => 80` from the first retrofit attempt, which produced visible gaps because short messages were given 80px slots.

A dev-mode perf probe (`agent-pane-perf-section.tsx`, a section of the diagnostics panel, which dev builds toggle with Ctrl+Alt+Shift+F12, or Cmd+Alt+Shift+F12 on macOS) compares each row's measured size against its kind's estimate. When p50 measured size diverges from the estimate by more than 30%, the section flags the kind for recalibration. Per-kind p50/p95/max render times also surface here, plus layout-shift events scoped to the agent pane.

All probing is dev-only — `import.meta.env.DEV` is folded to a literal at build time, dead-code elimination drops the probe paths from production bundles.

## What changes for users

Nothing visible in the happy path. The pane scrolls, paginates, jumps to bookmarks, and streams content as before — just with a bounded layout-tree memory cost regardless of session length.

You may notice:
- **Tab-switch into a populated agent pane is dramatically faster.** The 200-300ms long-task storms during reflow are gone; the layout tree is constant-size.
- **Auto-scroll-to-bottom is more deterministic.** Sticky behavior is data-driven (`stickToBottom` flag) instead of read-from-DOM heuristics.
- **Pagination is smoother.** Anchor-based scroll preservation doesn't drift on slow image/font loads.

## Source layout

`frontend/app/view/agent/virtualization/`:

| File | Purpose |
|---|---|
| `state.ts` | `AgentViewState` factory — single source of truth for scroll + streaming state |
| `anchor.ts` | Pure scroll-anchor math (capture, restore, near-top/near-bottom) |
| `streaming-buffer.ts` | `partitionForVirtualization(nodes)` splits the document into virtualized + streaming halves |
| `renderers.ts` | Per-kind size estimators and streaming-capability flags |
| `disclosure.ts` | `rowDisclosure`: whether a row is open, shared by the rows, the slice and the estimators |
| `expansion-source.ts` | `currentExpansion`: maps that answer onto the layout slice's `Expansion` |
| `DocumentRow.tsx` | Single row component used by both regions; caller controls positioning via `style` + `ref` |
| `AgentDocumentVirtualList.tsx` | Hybrid renderer wiring everything together |
| `held-release.ts` | Releases rows held open after arriving live once they scroll off the top |
| `live-arrival.ts` | Decides whether a row arrived live or was loaded from history |
| `show-settle.ts` | Decides when the catch-up after the pane is shown again is done |
| `keep-on-screen.ts` | Keeps the rows on screen in place when rows above them are removed or added |
| `scroll-memo.ts` | Remembers where each pane was scrolled across a reload of its window |
| `zoom-anchor-adapter.ts` | Keeps the text under the pointer in place when the pane zoom changes |
| `verbosity.ts` | The view presets and switches that hide routine rows (a view-layer filter) |
| `perf-probe.ts` | Dev-mode per-kind timing + estimator-miss detection + layout-shift attribution |

Test files sit next to these.

`frontend/app/devtools/agent-pane-perf-section.tsx` — the diagnostics-panel section that polls `agentPerfStore.snapshot()` at 1 Hz and renders the per-kind table.

## Reference

- Spec: `docs/specs/SPEC_AGENT_PANE_VIRTUALIZATION_REDESIGN.md` (in main repo)
- PRs: #783 (foundation), #784 (virtualization layer), #786 (Show capture follow-up + reactive block components), #787 (perf probe)
- Issue: #782
