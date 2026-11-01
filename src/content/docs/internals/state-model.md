---
title: Frontend state model
description: How focus, layout, and pane state flow in the frontend — layout tree, pane-state reducers, and focus-ring resolution.
---

**Version:** 0.44.1 | **Main:** 6d282acf | **Date:** 2026-06-12

---

## Table of Contents

1. [Layout Tree — LayoutModel and localTreeStateAtom](#1-layout-tree)
2. [Pane-State Reducers](#2-pane-state-reducers)
3. [Reducer-Stack Initiative — Discussion #707](#3-reducer-stack-initiative)
4. [Focus / Selection Visual Highlight — 3-Source Color Resolution](#4-focus--selection-visual-highlight)
5. [MuxObject Store (MOS) — Block and Tab Persistence](#5-muxobject-store-mos)
6. [SRV-02 Finding — One Writer for LayoutState](#6-srv-02-finding--one-writer-for-layoutstate)
7. [Boundary Summary](#7-boundary-summary)

---

## 1. Layout Tree

### 1.1 LayoutModel — Class Overview

`LayoutModel` (`frontend/layout/lib/layoutModel.ts:101`) is the per-tab class that owns the entire tile-layout state at runtime. One instance is created per tab and cached in `layoutModelMap`. The class holds both the runtime tree and all reactive accessors; the rendering component (`TileLayout`) is a pure consumer.

**Key invariant:** `LayoutModel` lives in its own `createRoot` scope (`layoutModel.ts:419`). All memos — including the `isFocused` memo on every `NodeModel` — are created under this root and survive component mount/unmount cycles during tab switching. Without this root, the `isFocused` memo dies when `TileLayout` unmounts and the focus border freezes. (Bug analysis: `docs/specs/focus-border-tab-switch-bug.md`.)

### 1.2 localTreeStateAtom

```typescript
// layoutModel.ts:437-443
this.localTreeStateAtom = createSignalAtom<LayoutTreeState>({
    rootNode: undefined,
    focusedNodeId: undefined,
    magnifiedNodeId: undefined,
    leafOrder: undefined,
    pendingBackendActions: undefined,
});
```

`localTreeStateAtom` is a SolidJS `SignalAtom<LayoutTreeState>` (`layoutModel.ts:106`). It is the **in-memory runtime source of truth** for the layout tree during a session. It is distinct from the persisted MuxObject (`muxObjectAtom`, which points at `LayoutState` in the backend store).

The shape of `LayoutTreeState` (`frontend/layout/lib/types.ts:282-288`):

| Field | Type | Description |
|---|---|---|
| `rootNode` | `LayoutNode` | Root of the binary layout tree |
| `focusedNodeId` | `string?` | ID of the currently focused leaf node |
| `magnifiedNodeId` | `string?` | ID of the magnified leaf node (if any) |
| `leafOrder` | `LeafOrderEntry[]?` | Ordered leaf list (top-left to bottom-right) |
| `pendingBackendActions` | `LayoutActionData[]` | Queued backend-to-frontend layout mutations |

**Write path:** all mutations flow through `treeReducer()` (`layoutModel.ts:612`), which calls one of the pure tree functions in `layoutTree.ts`, then calls `this.localTreeStateAtom._set({ ...this.treeState })` (`layoutModel.ts:695`).

**Persistence:** the frontend never writes the layout row. `treeReducer()` applies a tree edit to the local tree at once and also queues it as a layout *intent* (`layoutModel.ts:629-635`). The intent goes to srv, whose reducer applies the same edit to its own copy of the tree and stores the result. The frontend then shows what srv stored. See [§5.3](#53-how-layoutstate-is-persisted) for the steps and [§6](#6-srv-02-finding--one-writer-for-layoutstate) for who writes each field.

### 1.3 focusedNodeId and the Focus Stack

```
model.treeState.focusedNodeId   ← authoritative in LayoutTreeState
model.focusedNodeIdStack        ← ordered history stack (most recent first)
model.focusedNodeId (getter)    ← returns focusedNodeIdStack[0]
model.focusedNode (memo)        ← reactive accessor → LayoutNode
```

`focusedNodeIdStack` (`layoutModel.ts:278,542`) is a plain `string[]` on the model. It tracks focus history so that when the currently focused node is deleted, focus falls back to the previous node rather than going to `leafOrder[0]`.

The getter `focusedNodeId` (`layoutModel.ts:739-741`) simply returns `this.focusedNodeIdStack[0]`.

The reactive memo `focusedNode` (`layoutModel.ts:532-542`) re-derives from `localTreeStateAtom` on every change:

```typescript
// layoutModel.ts:532-542
this.focusedNode = createMemo(() => {
    const ephemeralNode = this.ephemeralNode();
    const treeState = this.localTreeStateAtom();
    if (ephemeralNode) {
        return ephemeralNode;   // ephemeral node always wins focus
    }
    if (treeState.focusedNodeId == null) {
        return null;
    }
    return findNode(treeState.rootNode, treeState.focusedNodeId);
});
```

### 1.4 FocusNode Reducer Path

Dispatching focus goes through a dedicated action type:

```
User click / keyboard nav
  → model.focusNode(nodeId)            layoutFocus.ts:189
  → model.treeReducer({ type: FocusNode, nodeId })
  → focusNode(this.treeState, action)  layoutTree.ts (sets treeState.focusedNodeId)
  → localTreeStateAtom._set(...)       reactive update fans out
  → flushLayoutOutbox(model)           layoutIntents.ts (a "view" intent to srv)
  → focusManager.requestNodeFocus()    (only after state has committed)
  → focusedNode memo re-evaluates
  → NodeModel.isFocused() returns true for the new node
```

`FocusNode` is special: it skips `updateTree()` (no topology change) but it still updates `focusedNodeIdStack` inline (`layoutModel.ts:684-694`). Like every tree edit it is queued for srv, as a `view` intent: no tree change, just the focused and magnified node (`frontend/layout/lib/layoutIntentActions.ts:128-130`).

### 1.5 validateFocusedNode — Bootstrap and Stack Reconciliation

`validateFocusedNode` (`layoutFocus.ts:34`) runs inside `updateTree()` on every leaf-order recompute. It has two jobs:

1. **Bootstrap** (`layoutFocus.ts:38-45`): if neither `treeState.focusedNodeId` nor `focusedNodeIdStack` has a value (fresh tab, never persisted focus), auto-focus the first leaf (`defaultFocusLeaf`, `layoutFocus.ts:24-26`: the first pane in `leafOrder` that isn't an agent picker, else `leafOrder[0]`). This is the fix shipped as part of the 2026-06-12 border fix (`docs/specs/pane-highlight-fix-plan.md`).

2. **Reconcile** (`layoutFocus.ts:46-65`): if `treeState.focusedNodeId` diverges from `focusedNodeId` (e.g. a node was deleted), prune stale IDs from the stack and promote the next viable entry.

### 1.6 isFocused — Per-Node Derivation

Every `NodeModel` carries an `isFocused` accessor (`frontend/layout/lib/types.ts:466`). It is created as a `createMemo` inside `model.runInModelRoot()` so it outlives component lifecycles:

```typescript
// layoutNodeModels.ts:131-134
isFocused: createMemo(() => {
    const treeState = model.localTreeStateAtom();
    return treeState.focusedNodeId === nodeid;
}),
```

This is a pure equality check against `localTreeStateAtom().focusedNodeId`. There is no secondary signal. When `treeReducer(FocusNode)` fires and `localTreeStateAtom._set(...)` is called, every `isFocused` memo across all mounted nodes re-evaluates in the same reactive batch.

### 1.7 LayoutNode Shape

```typescript
// frontend/layout/lib/types.ts:197-202
export interface LayoutNode {
    id: string;                     // stable UUID for this tree node
    data?: TabLayoutData;           // { blockId: string } on leaf nodes only
    children?: LayoutNode[];        // set on branch nodes; absent on leaves
    flexDirection: FlexDirection;   // "row" | "column"
    size: number;                   // proportional size in parent flex container
}
```

Leaf nodes have `data.blockId` set and no `children`. Branch nodes have `children` and no `data`. The tree is always a binary flex tree where `flexDirection` alternates.

### 1.8 Layout Tree

<img src="/diagrams/state-model-layout.svg" alt="LayoutModel (purple) owns six children: localTreeStateAtom (steel-blue, holds focusedNodeId/magnifiedNodeId/rootNode/leafOrder), treeState (gray, mutable scratch), focusedNodeIdStack (gray), muxObjectAtom (steel-blue, a read-only view of the layout row srv stores), nodeModels (steel-blue, per-node isFocused/isMagnified), and treeReducer (purple, mutates state, triggers fan-out and queues a layout intent for srv)." style="max-width:100%" />

---

## 2. Pane-State Reducers

These reducers are **entirely separate from the layout tree**. They own what a pane is *doing* (streaming, loading, tabs open, etc.) — not where it sits or whether it is focused. Focus and highlight are layout-tree concerns only.

### 2.1 Shared Reducer Pattern

All frontend reducers follow the conventions from `docs/specs/frontend-reducer-conventions-2026-05-03.md`:

- Pure `update(state, command) → { state, events }` function.
- Per-block or per-pane slot store (`Map<blockId, Slot>`).
- `dispatch(blockId, command)` throws on unregistered id (silent drops would defeat the audit value).
- Typed `Command` union (what the caller wants) and `Event` union (what happened, for audit/subscribers).
- `recordDispatch()` writes to the command-source audit ring.

### 2.2 agent-pane-state — Slice #4

**Files:** `frontend/app/store/agent-pane-state/types.ts`, `reducer.ts`, `frontend/app/store/agent-pane-state-store.ts`

Models the per-agent-pane lifecycle. Does **not** model focus, highlight, or pane position.

#### AgentPaneState fields

| Field | Type | Description |
|---|---|---|
| `initPhase` | `InitPhase` | `InitPending → InitReady\|InitFailed` — history load lifecycle |
| `turnPhase` | `TurnPhase` | Single SoT for turn lifecycle (PR A–G series) |
| `streaming` | `StreamingState` | `agentId`, `bufferSize`, `lastEventTime` |
| `lastEventMs` | `number \| null` | Wall-clock of last stream activity; `!== null` ↔ stream subscribed |
| `sessionStats` | `SessionStats \| null` | Cumulative token usage for the session |
| `currentTool` | `string \| null` | Name of the tool currently executing |
| `turnTokens` | `TurnTokens \| null` | Per-turn input/output token deltas (cleared at TurnEnd) |
| `context` | `ContextReading \| null` | The context meter's reading (tokens in context, the model's window, and where each came from); set by `TokensIn`, survives TurnEnd, cleared on a reset, an invalidation or a compaction |
| `pending` | `PendingMessage[]` | Messages queued but not yet acknowledged by backend |
| `detailsOpen` | `boolean` | Whether the composer's Shell drawer is open |

#### TurnPhase discriminated union

<img src="/diagrams/state-model-turnphase.svg" alt="TurnPhase state machine: Idle → Submitting → Streaming → Interrupting, each with arrows to terminal Done (steel-blue) or Disconnected. Purple arrows show timeout/error transitions: SubmitTimeoutElapsed (30s), StreamStalled (60s), InterruptTimeoutElapsed (5s)." style="max-width:100%" />

**Selectors** (`types.ts:581-627`):

| Selector | Returns true when |
|---|---|
| `isWorking(state)` | `turnPhase.kind ∈ {Submitting, Streaming, Interrupting}` |
| `isDisconnected(state)` | `turnPhase.kind === "Disconnected"` |
| `isInitReady(state)` | `initPhase.kind === "InitReady"` |

**Watchdog constants** (`types.ts:1342-1394`):

| Constant | Value | Purpose |
|---|---|---|
| `STUCK_THRESHOLD_MS` | 45 000 ms | Diagnostic-only `stream-stuck` event; no state change |
| `SUBMIT_TIMEOUT_MS` | 30 000 ms | `Submitting → Done.errored` if no stream activity |
| `INTERRUPT_TIMEOUT_MS` | 5 000 ms | `Interrupting → Done.interrupted` if no ack |
| `LIVENESS_RECOVERY_MS` | 180 000 ms | Hung `Streaming` turn (no activity, no tool running, not rate-limited) `→ Idle` |

#### What this reducer does NOT model

- Whether the pane is focused (layout tree)
- The pane's position or size (layout tree)
- The pane's border color (layout tree + CSS)
- The message list content (agent-document reducer, separate slice)

### 2.3 agent-document — Slice #1

**Files:** `frontend/app/store/agent-document/types.ts`, `frontend/app/store/agent-document/reducer.ts`, `frontend/app/store/agent-document-store.ts`

Models the per-agent-pane message list. Separate from agent-pane-state per the "no god-reducer" rule.

| Field | Type | Description |
|---|---|---|
| `nodes` | `DocumentNode[]` | Ordered message/tool nodes for the conversation |
| `sessionPhase` | `"loading-history" \| "active" \| "ended"` | Stream lifecycle phase |
| `sessionStartedAt` | `number \| null` | Wall-clock of last `SessionStart` |
| `nodeIdSet` | `Set<string>` | Authoritative dedup index; kept in lockstep with `nodes` |

**Key commands:** `SessionStart`, `SessionEnd`, `HistoryLoaded`, `HistoryRestored`, `StreamFlush` (bulk append + in-place update), `ToolChunkAppend`, `ShellChunkAppend`, `StreamTruncate` (with 5 s grace window — `TRUNCATE_GRACE_MS`), `UserClear`, `ScrubOrphanedInProgress`.

This reducer does **not** model streaming state, token counts, or focus.

### 2.4 browser-pane-state — Slice #9

**Files:** `frontend/app/store/browser-pane-state/types.ts`, `frontend/app/store/browser-pane-state/reducer.ts`, `browser-pane-state-store.ts`

Models the multi-tab Browser pane. Phase 1A migrated from a single-URL flat state to a `tabs[]` array.

| Pane-level field | Description |
|---|---|
| `tabs` | `BrowserTab[]` — ordered list of browsing contexts |
| `activeTabId` | ID of the active tab (invariant: always in `tabs[]` or null) |
| `recentlyClosed` | Bounded stack (max 10) for Ctrl+Shift+T re-open |
| `closed` | Terminal flag set by `Disposed`; all subsequent commands are no-ops |

Per-tab (`BrowserTab`): `id`, `url`, `title`, `faviconUrl`, `loading`, `error`, `canGoBack`, `canGoForward`, `titleOverridden`, `faviconOverridden`, `isPreview`, `backendCreated`.

**Echo-loop guard:** backend-driven commands carry `source: "backend"`, suppressing the `navigate` event emission that would re-trigger a CEF navigation in an infinite loop.

This reducer does **not** model focus state or border highlight.

### 2.5 editor-pane-state — Slice #10

**File:** `frontend/app/store/editor-pane-state-store.ts`

Models the multi-file Editor pane tab strip.

| State field | Description |
|---|---|
| `tabs` | `EditorTab[]` — ordered list with `id, filePath, language, dirty, readOnly, contentLoaded, isPreview` |
| `activeTabId` | ID of active tab (invariant: always in `tabs[]` or null) |
| `recentlyClosed` | Bounded ring (max 10) for Ctrl+Shift+T |

**Preview semantics:** at most one tab may have `isPreview: true` per pane (VS Code single-click behavior). `MarkDirty` auto-pins the preview tab. Per-tab CodeMirror state lives **outside** this reducer (held by the view in a `Map<tabId, EditorView>`).

This reducer does **not** model focus or highlight.

### 2.6 Reducer Comparison Table

| Reducer | Slice | Models | Does NOT model |
|---|---|---|---|
| `agent-document` | #1 | Message nodes, session phase, dedup | Focus, tokens, streaming |
| `agent-pane-state` | #4 | Turn lifecycle, streaming, tokens, pending msgs | Focus, message content, position |
| `browser-pane-state` | #9 | Tab list, active tab, nav state, load state | Focus, pane position |
| `editor-pane-state` | #10 | File tab list, active tab, dirty flags | Focus, CodeMirror state |
| LayoutModel / layoutTree | — | Tree topology, focus, magnify, resize, leaf order | Turn phase, streaming, content |

---

## 3. Reducer-Stack Initiative

### 3.1 Discussion #707

GitHub Discussion **#707** ("Reducer-stack architecture: long-term tracking thread") is the umbrella tracking thread for the multi-layer reducer migration across launcher, host, srv, and frontend. References in codebase: `docs/specs/SPEC_OBJ_UPDATE_BRIDGE_2026-05-14.md:7`, `docs/analysis/LIFECYCLE_DISPATCH_LEAK_2026_05_15.md`.

### 3.2 Initiative Overview

The reducer-stack is a cross-process architecture where each process layer owns a canonical reducer for its domain:

```
Launcher (L1)  → OS process/window/pool/monitor facts        ✅ DONE
Host (L2)      → CEF browser/pane/drag/pool/quit state       ✅ 6/7 migrated
Srv (L3)       → workspace/tab/block/layout app domain       ✅ mostly done (E.4.B phases 5-7 open)
Frontend       → per-pane ephemeral state                    ✅ 8 slice reducers live
```

Cross-process dispatch (CPD-1 through CPD-5) is shipped for launcher→host communication.

### 3.3 Frontend Phases 0–1 — Dormant Foundation

The "reducer-stack initiative" as it applies to the **pane-state reducer** (`agent-pane-layout`) is tracked in `docs/specs/SPEC_AGENT_PANE_LAYOUT_REDUCER_2026_06_02.md`:

- **Phase 0:** Pure slice core, store, and tests implemented (`issue #1235`, PRs `#1231/#1233/#1234`). No render-path wiring.
- **Phase 1:** Render wiring — not yet started.

This slice (Slice #11, agent-pane-layout) unifies three previously uncoordinated sources of truth for row heights in the agent document virtual list: TanStack's `itemSizeCache`, per-component expansion signals, and CSS `zoom`. Phases 0–1 are the dormant foundation.

The existing `agent-pane-state` reducer (Slice #4) and `agent-document` reducer (Slice #1) are **fully live and wired** with all turn-phase PRs A–G merged. The "dormant" label applies only to the **agent-pane-layout** reducer (Slice #11).

### 3.4 SRV-Side Layout Reducer — Phases 5–7

The master status (`MASTER_REDUCER_STACK_STATUS_2026-05-05.md §0`) still lists `E.4.B` layout phases 6 and 7 as open. That document is older than the work; at the pinned commit all three phases are in the code:

| Phase | What | Status at the pin |
|---|---|---|
| 5 | Reducer arms calling pure helpers | ✅ shipped, including `LayoutApplyIntent` (`crates/srv/src/reducer/layout/intent.rs:26`) |
| 6 | Persist subscriber arms for layout events | ✅ shipped: tree, focus, magnify and the backend-action queue (`crates/srv/src/persist_subscriber.rs:216-261`) |
| 7 | Migrate legacy `rootnode` writers off wcore-direct | ✅ for every edit a window makes; srv refuses a whole-row `UpdateObject` of a layout row (`crates/srv/src/server/service/object_helpers.rs:54-61`). One direct write is left: the default layout a first launch seeds before the reducer has loaded. |

`specs/SPEC_STRONG_REDUCER_AUTHORITY_LAYOUT_2026_06_30.md` records the same, phase by phase. This retired the SRV-02 dual write path (see §6 below).

---

## 4. Focus / Selection Visual Highlight

### 4.1 The 3-Source Color Resolution

The focused pane border color is resolved at render time through three cascaded sources, evaluated in priority order:

```
Priority 1 (highest): tab/block meta override
  └── block.meta["pane-title:color"]   (user-set per-pane color)
  └── tab.meta["tab:color"]            (user-picked tab color, see §4.5)

Priority 2: agent environment color
  └── block.meta["cmd:env"]["AGENTMUX_COLOR"]   (set by AgentX/AgentY env vars)
  └── falls back to known-agent defaults (AgentA, AgentB, etc.)
  └── gated by isUsableFocusRingColor() — luminance ≥ 0.03 and alpha ≥ 0.5

Priority 3 (lowest / fallback): theme accent
  └── CSS var(--accent-color)
  └── always visible; used when sources 1 and 2 fail the usability gate
```

### 4.2 Resolution Code Path

The memo that performs the resolution is `blockAgentColor` in `BlockFrame_Default_Component` (`blockframe.tsx:1187-1196`):

```typescript
// blockframe.tsx:1187-1196
const blockAgentColor = createMemo(() => {
    if (!props.preview && paneTabCapability(blockData()?.meta?.view, "hueBorder")) {
        const isLightTheme = isLightThemeActive();
        const color = computeBlockActiveBorderColor(blockData()?.meta, isLightTheme);
        if (isUsableFocusRingColor(color)) {
            return color;
        }
    }
    return null;
});
```

The result is injected as a CSS custom property (`blockframe.tsx:1382`):

```
--block-agent-color: <color> | "transparent"
```

### 4.3 CSS Application

In `block.scss`:

```scss
// block.scss:298-320
&.block-focused {
    .block-mask {
        border-color: var(--accent-color);   // theme fallback
        z-index: 50;
    }
    // Agent-loaded terminals override with agent color
    &.has-agent-color .block-mask {
        border-color: var(--block-agent-color);
    }
}
```

The `has-agent-color` class is added when `blockAgentColor()` is truthy (`blockframe.tsx:1363`). `block-focused` comes from `NodeModel.isFocused()` which tracks `localTreeStateAtom().focusedNodeId` (see §1.6).

### 4.4 isUsableFocusRingColor — The Luminance Gate

`autotitle.ts:170-179`:

```typescript
export function isUsableFocusRingColor(color: string | null | undefined): boolean {
    const rgba = parseCssColor(color);
    if (!rgba) return false;          // unparseable color → theme accent
    if (rgba.a < 0.5) return false;  // near-transparent → theme accent
    return relativeLuminance(rgba) >= MIN_FOCUS_RING_LUMINANCE;  // 0.03
}
```

`MIN_FOCUS_RING_LUMINANCE = 0.03` (`autotitle.ts:51`). This deliberately low threshold accepts dark-but-visible agent colors (e.g. `#1e3a5f`, L≈0.041) while rejecting near-black (`#000`, L=0) that would erase the border on a dark background.

### 4.5 Tab Color System

Tabs no longer get a color automatically at creation; a user picks one from the 14-color `TAB_COLORS` palette (`frontend/app/tab/tab.tsx:34-49`):

| Name | Hex |
|---|---|
| Red | `#c22a2a` |
| Orange | `#b75e20` |
| Amber | `#9d6d1d` |
| Yellow | `#90731a` |
| Lime | `#5a821e` |
| Green | `#248749` |
| Teal | `#1e8479` |
| Cyan | `#1a8294` |
| Blue | `#2562c5` |
| Indigo | `#2d30cf` |
| Violet | `#5c29d2` |
| Fuchsia | `#ae2ac2` |
| Pink | `#c02b75` |
| Rose | `#c42742` |

Tab color is stored in `tab.meta["tab:color"]` (a MuxObject meta field, `srv-types.d.ts:736`). The startup tab is intentionally left without a color (`tabbar.tsx:271-276`). Tab color feeds **the tab bar indicator**, not the pane border directly — tab colors are a separate visual affordance from the pane focus ring.

### 4.6 The 2026-06-12 Border Fix

The focus border was broken by two bugs addressed in `docs/specs/pane-highlight-fix-plan.md`:

1. **Wrong metric bug:** `numBlocks` read `atoms.tabAtom().blockids` (frozen at window-init, includes non-visible blocks) and when it reached 1 applied `block-no-highlight` with `!important`, suppressing the border. Fix: remove `block-no-highlight` entirely. Files: `blockframe.tsx`, `blocktypes.ts`, `block.scss`.

2. **No-bootstrap bug:** `validateFocusedNode` was a no-op when both `treeState.focusedNodeId` and `focusedNodeIdStack` were `undefined` (fresh tab). Fix: auto-focus `leafOrder[0]` in the bootstrap case (now the first non-picker leaf, via `defaultFocusLeaf`). File: `layoutFocus.ts:38-45` (code now present at this location).

3. **LayoutModel memory leak:** `deleteLayoutModelForTab` did not call `model.dispose()` on tab drag-out, leaving a live reactive root. Fix: call `model.dispose()` after `MoveTabToWorkspace`. Files: `frontend/layout/lib/layoutModelHooks.ts:91-97` (`deleteLayoutModelForTab` now calls `model.dispose()`), called on drag-out from `frontend/app/drag/CrossWindowDropOverlay.tsx:122`.

---

## 5. MuxObject Store (MOS)

### 5.1 Architecture

`MOS` (`frontend/app/store/mos.ts`) is the frontend in-memory cache of all backend-persisted objects. Each object is identified by an `oref` of the form `"otype:oid"` (e.g. `"layout:abc123"`).

```
muxObjectValueCache: Map<oref, MuxObjectValue<T>>
```

Each `MuxObjectValue` holds a SolidJS signal pair (`getData` / `setData`) wrapping a `MuxObjectDataItemType<T>` (`{ value: T, loading: boolean }`).

### 5.2 API

| Function | Purpose |
|---|---|
| `getMuxObjectAtom<T>(oref)` | Returns a `SignalAtom<T>` — call to read (reactive), `._set()` to write locally |
| `useMuxObjectValue<T>(oref)` | SolidJS hook — returns `[valueAccessor, loadingAccessor]`, manages refCount |
| `setObjectValue<T>(value, pushToServer?)` | Write cache; if `pushToServer=true` calls `ObjectService.UpdateObject` |
| `updateMuxObject(update)` | Merge an inbound `waveobj:update` WS event; deduplicates on `version` (`mos.ts:358`) |
| `loadAndPinMuxObject<T>(oref)` | Pin (refCount++) + return the fetch promise |
| `reloadMuxObject<T>(oref)` | Force re-fetch from backend |

Cache eviction: `cleanMuxObjectCache()` runs every 30 s and removes entries with `refCount === 0` and `holdTime < now` (`mos.ts:427-437`).

### 5.3 How LayoutState is Persisted

The `LayoutModel` reads its row through `getLayoutStateAtomFromTab` (`layoutAtom.ts:13-19`), a plain accessor over the MOS entry:

```typescript
// layoutAtom.ts:13-19
export function getLayoutStateAtomFromTab(tabAccessor: () => Tab): () => LayoutState | undefined {
    return () => {
        const tabData = tabAccessor();
        if (!tabData) return undefined;
        return MOS.getMuxObjectAtom<LayoutState>(MOS.makeORef("layout", tabData.layoutstate))();
    };
}
```

It has no setter: the row changes only through srv. A layout edit travels the other way, as a *layout intent* (`frontend/layout/lib/layoutIntents.ts`, `specs/SPEC_STRONG_REDUCER_AUTHORITY_LAYOUT_2026_06_30.md` §4):

1. **Apply it here, queue an intent.** `treeReducer()` applies the action to the local tree at once, as a prediction of srv's result, and pushes the matching intent onto the model's `layoutOutbox` (`layoutModel.ts:629-635`). `intentForAction` maps each tree action to one intent: `move`, `swap`, `resize`, `insert`, `insertatindex`, `delete`, `replace`, `splithorizontal`, `splitvertical`, `minimize`, `restore` or `clear`. `FocusNode` and `MagnifyNodeToggle` become a `view` intent, which changes no tree (`frontend/layout/lib/layoutIntentActions.ts:76-134`).
2. **Send in order.** `flushLayoutOutbox` sends the outbox one item at a time (`layoutIntents.ts:51-69`). Each intent goes as `LayoutApplyIntentCommand` (`layout.applyIntent`), with the focused and magnified node as they are when it leaves. A failed send is tried up to three times, and a resend of the same action id is a no-op on srv (`layoutIntents.ts:71-96`). Pane-tab commands (activate, close or move a tab in a pane) go through the same queue with `queueLayoutCommand` (`layoutIntents.ts:41-44`, called by `sendStackCommand`, `layoutPersistence.ts:369-389`).
3. **srv applies and stores it.** `apply_layout_intent` (`crates/srv/src/server/service/layout_intents.rs:29-72`) dispatches `Command::LayoutApplyIntent` while it holds the reducer lock. The reducer arm (`crates/srv/src/reducer/layout/intent.rs:26-117`) applies the intent to a copy of the tab's tree, normalizes it, takes the focused and magnified node from the request, and emits `LayoutTreeReplaced`, `FocusedNodeChanged` and `MagnifiedNodeChanged` for what changed. `apply_layout_intent` writes those events to SQLite before it lets go of the lock, so rows are written in the order intents are applied. A failed write puts the tab back as the row has it (`layout_intents.rs:60-65`). A refused intent changes nothing and answers `applied: false`.
4. **Show what srv stored.** When the model is quiet (nothing queued or sending, no drag or resize preview) and the row includes every intent it sent (`layoutVersionFloor`), `reconcileWithStoredLayout` compares the stored tree with the local one. If they differ, srv refused an edit or computed it differently, and the stored tree replaces the local one. Focus stays the frontend's while its pane exists (`layoutIntents.ts:126-155`).

Edits srv makes on its own, such as placing a new block, a tear-off or a redock, go the other way round. srv applies them to its own tree first, then queues them in the row's `pendingbackendactions` for the window to mirror (`place_block`, `layout_intents.rs:136`). The window applies them locally and sends nothing back (`processPendingBackendActions`, `layoutPersistence.ts:82-113`). The queue keeps the latest 32 actions, and an action older than 10 minutes is dropped; a window that missed one shows srv's stored tree anyway (`crates/srv/src/persist_subscriber/layout_queue.rs:9-16`).

*Removed:* `LayoutModel.persistToBackend()` used to copy the whole tree back to the row with a debounced `UpdateObject`. It is gone, and srv now refuses a whole-row `UpdateObject` of a layout row (`crates/srv/src/server/service/object_helpers.rs:54-61`).

### 5.4 How Blocks and Tabs Are Persisted

**Blocks** are `MuxObj` objects of type `"block"`. They are loaded via `MOS.getMuxObjectAtom("block:<blockId>")`. The `block.meta` field is the primary store for per-block configuration:

- `meta.view` — the pane type (`"agent"`, `"browser"`, `"term"`, `"editor"`, etc.)
- `meta["cmd:env"]` — environment variables (used for agent color detection)
- `meta["pane-title"]` — user-set title
- `meta["pane-title:color"]` — user-set title color
- `meta["frame:title"]`, `meta["frame:icon"]`, `meta["frame:text"]` — frame overrides

Blocks are mutated via `RpcApi.SetMetaCommand(TabRpcClient, { oref, meta })`.

**Tabs** are `MuxObj` objects of type `"tab"`. Key meta fields:

- `tab.meta["tab:color"]` — tab bar color (string hex)
- `tab.layoutstate` — ID of the linked `LayoutState` object

**LayoutState** is a `MuxObj` of type `"layout"`. Persisted fields:
- `rootnode` — serialized layout tree
- `focusednodeid` — focused node ID
- `magnifiednodeid` — magnified node ID
- `leaforder` — ordered leaf list. Written only when a layout is seeded; the frontend computes its own and doesn't read this one.
- `pendingbackendactions` — queued backend→frontend mutations

Only srv writes these fields; §6 lists which code writes each.

---

## 6. SRV-02 Finding — One Writer for LayoutState

### 6.1 What It Was

When this page was first written, `LayoutState` had two writers that didn't coordinate:

- **The frontend**, through `LayoutModel.persistToBackend()`: a debounced (100 ms) write of the whole row (`rootnode`, `focusednodeid`, `magnifiednodeid`, `leaforder`, `pendingbackendactions`) with `ObjectService.UpdateObject`.
- **srv's persist subscriber**, through `apply_focused_node_changed`, which wrote only `focusednodeid` on `FocusedNodeChanged`.

A focus change could reach the row both ways, and a whole-row write could land against a version srv had already bumped.

### 6.2 One Writer Now

The dual path is gone. `persistToBackend()` no longer exists, srv refuses a whole-row `UpdateObject` of a layout row (`crates/srv/src/server/service/object_helpers.rs:54-61`), and every write to the row comes from srv:

| Writer | Fields | When |
|---|---|---|
| `apply_layout_tree_replaced` (`crates/srv/src/persist_subscriber.rs:699-767`) | `rootnode`. Also clears focus or magnify when the tree empties or a delete removed that node, and writes every column when a seeding `LayoutSetTree` carries them | `LayoutTreeReplaced`, `LayoutNodeDeleted` |
| `apply_focused_node_changed` (`crates/srv/src/persist_subscriber.rs:627-647`) | `focusednodeid` | `FocusedNodeChanged` |
| `apply_magnified_node_changed` (`crates/srv/src/persist_subscriber.rs:652-672`) | `magnifiednodeid` | `MagnifiedNodeChanged` |
| `apply_layout_backend_actions_queued` (`crates/srv/src/persist_subscriber/layout_queue.rs:51-84`) | `pendingbackendactions`, appended | `LayoutBackendActionsQueued` |
| `resync_tab` (`crates/srv/src/persist_subscriber/resync.rs:113-151`) | `rootnode`, focus and magnify, from the reducer's own state | The event bus lagged and dropped events |
| `write_default_three_pane_layout` (`crates/srv/src/backend/wcore/mod.rs:173-190`) | The whole row | A first launch, before the reducer has loaded |

`apply_focused_node_changed` is still how a focus change reaches `focusednodeid`, but it is now the only way. A click sends a `view` intent carrying the focused node; the reducer sets it on the tab and emits `FocusedNodeChanged`; the subscriber writes it. The function's doc comment (`persist_subscriber.rs:620-626`) still says the other fields "stay on their existing wcore-direct path until Option B lands". That is out of date: the tree arrives on `LayoutTreeReplaced`.

```
User clicks pane
  → LayoutModel.treeReducer(FocusNode)
  → localTreeStateAtom updated (frontend, at once)
  → layout.applyIntent { type: "view", focused_node_id }
    → srv reducer: tab.focused_node_id = …, emits FocusedNodeChanged
    → apply_focused_node_changed writes focusednodeid (once, in order)
    → MOS update reaches the window; nothing to correct
```

Each event is applied twice on the normal path: once right after dispatch, by the code that dispatched it, so a follow-up read sees the write, and again when the subscriber gets the broadcast. Every arm compares before it writes, so the second apply changes nothing and doesn't bump the version (`crates/srv/src/persist_subscriber.rs:4-19`, `persist_subscriber.rs:752-759`).

### 6.3 What Is Left of the Old Concerns

- **Version races:** gone with the second writer. The frontend still ignores an update older than the value it holds (`mos.ts:358`), and compares its tree with the stored one only once the row's version includes every intent it sent (`layoutVersionFloor`, `layoutIntents.ts:126-129`).
- **Two tree implementations:** the frontend predicts each edit with its own tree functions, and srv computes it with its Rust port. When they disagree, srv's tree wins at the next quiet moment (§5.3, step 4), and the console logs "the local layout differs from srv's stored one" (`layoutIntents.ts:141`).

---

## 7. Boundary Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ LAYOUT TREE (LayoutModel / layoutModel.ts)                                  │
│                                                                             │
│  Owns: tree topology, focused node, magnified node, leaf order, resize,    │
│         drag/drop, ephemeral nodes                                          │
│                                                                             │
│  Does NOT own: what a pane is doing, token counts, message content,        │
│               browser URL, editor file contents, agent streaming state      │
│                                                                             │
│  Focus signal path:                                                         │
│    user click → focusNode() → treeReducer(FocusNode)                       │
│              → localTreeStateAtom._set()                                    │
│              → "view" intent to srv (layoutIntents.ts)                      │
│              → NodeModel.isFocused() memo                                   │
│              → "block-focused" CSS class                                    │
│              → CSS border resolution (3-source color cascade)               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ PANE-STATE REDUCERS (agent-pane-state, browser-pane-state, etc.)           │
│                                                                             │
│  Owns: per-pane ephemeral runtime state                                     │
│    • agent-pane-state  : TurnPhase, streaming, tokens, pending msgs        │
│    • agent-document    : message node list, session phase                   │
│    • browser-pane-state: tab list, URL, load state                         │
│    • editor-pane-state : file tab list, dirty flags                        │
│                                                                             │
│  Does NOT own: focus, highlight, border color, position, size              │
│                                                                             │
│  Connection to layout: blockId is the join key; NodeModel.blockId links    │
│  the layout leaf to the pane-state slot                                     │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ MUXOBJECT STORE (MOS / mos.ts)                                              │
│                                                                             │
│  Owns: in-memory cache of all backend-persisted MuxObj records             │
│    • Blocks (type: "block") — pane configuration and meta                  │
│    • Tabs   (type: "tab")   — tab meta including tab:color                 │
│    • Layout (type: "layout") — layout tree snapshot                        │
│    • Workspace, Window, Agent, Identity, …                                 │
│                                                                             │
│  LayoutState writes: srv only (see §6)                                      │
│    window: treeReducer() → layout intent → layout.applyIntent               │
│    srv: reducer applies it → events written to SQLite → MOS update          │
│    window: shows srv's stored tree if it differs from its own               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key File Index

| Concern | Primary File | Location |
|---|---|---|
| LayoutModel class | `layoutModel.ts` | `frontend/layout/lib/layoutModel.ts` |
| localTreeStateAtom init | `layoutModel.ts:437` | line 437 |
| focusedNodeId getter | `layoutModel.ts:739` | line 739 |
| focusedNode memo | `layoutModel.ts:532` | line 532 |
| FocusNode reducer arm | `layoutModel.ts:636` | line 636 |
| validateFocusedNode (bootstrap + reconcile) | `layoutFocus.ts:34` | `frontend/layout/lib/layoutFocus.ts` |
| isFocused memo (per-node) | `layoutNodeModels.ts:131` | `frontend/layout/lib/layoutNodeModels.ts` |
| Tree action → layout intent | `frontend/layout/lib/layoutIntentActions.ts:76` | `frontend/layout/lib/layoutIntentActions.ts` |
| Intent outbox, send, compare with srv's tree | `frontend/layout/lib/layoutIntents.ts:51` | `frontend/layout/lib/layoutIntents.ts` |
| srv: apply and store an intent | `crates/srv/src/server/service/layout_intents.rs:29` | `crates/srv/src/server/service/layout_intents.rs` |
| srv: `LayoutApplyIntent` reducer arm | `crates/srv/src/reducer/layout/intent.rs:26` | `crates/srv/src/reducer/layout/intent.rs` |
| MOS getMuxObjectAtom | `mos.ts:253` | `frontend/app/store/mos.ts` |
| LayoutState atom from tab | `layoutAtom.ts:13` | `frontend/layout/lib/layoutAtom.ts` |
| AgentPaneState / TurnPhase types | `types.ts` | `frontend/app/store/agent-pane-state/types.ts` |
| AgentDocumentState types | `frontend/app/store/agent-document/types.ts` | `frontend/app/store/agent-document/types.ts` |
| BrowserPaneState types | `frontend/app/store/browser-pane-state/types.ts` | `frontend/app/store/browser-pane-state/types.ts` |
| EditorPaneState / reducer | `editor-pane-state-store.ts` | `frontend/app/store/editor-pane-state-store.ts` |
| blockAgentColor memo | `blockframe.tsx:1187` | `frontend/app/block/blockframe.tsx` |
| isUsableFocusRingColor | `autotitle.ts:170` | `frontend/app/block/autotitle.ts` |
| block-focused CSS (border) | `block.scss:271` | `frontend/app/block/block.scss` |
| Layout row writers (persist subscriber) | `crates/srv/src/persist_subscriber.rs:627` | `crates/srv/src/persist_subscriber.rs` |
| Strong layout authority (design, status) | `specs/SPEC_STRONG_REDUCER_AUTHORITY_LAYOUT_2026_06_30.md` | `docs/specs/` |
| Reducer-stack master status | `MASTER_REDUCER_STACK_STATUS_2026-05-05.md` | `docs/specs/` |
| Discussion #707 ref | `SPEC_OBJ_UPDATE_BRIDGE_2026-05-14.md:7` | `docs/specs/` |
| Border fix plan | `pane-highlight-fix-plan.md` | `docs/specs/` |
| Focus border tab-switch bug | `focus-border-tab-switch-bug.md` | `docs/specs/` |
| Agent-pane-layout reducer (Phase 0) | `SPEC_AGENT_PANE_LAYOUT_REDUCER_2026_06_02.md` | `docs/specs/` |
