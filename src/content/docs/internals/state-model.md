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
6. [SRV-02 Finding — Dual Persistence Paths for LayoutState](#6-srv-02-finding--dual-persistence-paths-for-layoutstate)
7. [Boundary Summary](#7-boundary-summary)

---

## 1. Layout Tree

### 1.1 LayoutModel — Class Overview

`LayoutModel` (`frontend/layout/lib/layoutModel.ts:117`) is the per-tab class that owns the entire tile-layout state at runtime. One instance is created per tab and cached in `layoutModelMap`. The class holds both the runtime tree and all reactive accessors; the rendering component (`TileLayout`) is a pure consumer.

**Key invariant:** `LayoutModel` lives in its own `createRoot` scope (`layoutModel.ts:430`). All memos — including the `isFocused` memo on every `NodeModel` — are created under this root and survive component mount/unmount cycles during tab switching. Without this root, the `isFocused` memo dies when `TileLayout` unmounts and the focus border freezes. (Bug analysis: `docs/specs/focus-border-tab-switch-bug.md`.)

### 1.2 localTreeStateAtom

```typescript
// layoutModel.ts:449-455
this.localTreeStateAtom = createSignalAtom<LayoutTreeState>({
    rootNode: undefined,
    focusedNodeId: undefined,
    magnifiedNodeId: undefined,
    leafOrder: undefined,
    pendingBackendActions: undefined,
});
```

`localTreeStateAtom` is a SolidJS `SignalAtom<LayoutTreeState>` (`layoutModel.ts:122`). It is the **in-memory runtime source of truth** for the layout tree during a session. It is distinct from the persisted MuxObject (`muxObjectAtom`, which points at `LayoutState` in the backend store).

The shape of `LayoutTreeState` (`frontend/layout/lib/types.ts:270-276`):

| Field | Type | Description |
|---|---|---|
| `rootNode` | `LayoutNode` | Root of the binary layout tree |
| `focusedNodeId` | `string?` | ID of the currently focused leaf node |
| `magnifiedNodeId` | `string?` | ID of the magnified leaf node (if any) |
| `leafOrder` | `LeafOrderEntry[]?` | Ordered leaf list (top-left to bottom-right) |
| `pendingBackendActions` | `LayoutActionData[]` | Queued backend-to-frontend layout mutations |

**Write path:** all mutations flow through `treeReducer()` (`layoutModel.ts:625`), which calls one of the pure tree functions in `layoutTree.ts`, then calls `this.localTreeStateAtom._set({ ...this.treeState })` (`layoutModel.ts:732`).

**Persistence:** after every reducer dispatch, `persistToBackend()` is called (debounced 100 ms, `layoutPersistence.ts:452`). It copies `treeState` fields back onto the `muxObjectAtom` (the live MOS entry) and calls `setObjectValue(..., true)` which pushes the mutation to the backend via `ObjectService.UpdateObject`.

### 1.3 focusedNodeId and the Focus Stack

```
model.treeState.focusedNodeId   ← authoritative in LayoutTreeState
model.focusedNodeIdStack        ← ordered history stack (most recent first)
model.focusedNodeId (getter)    ← returns focusedNodeIdStack[0]
model.focusedNode (memo)        ← reactive accessor → LayoutNode
```

`focusedNodeIdStack` (`layoutModel.ts:289,555`) is a plain `string[]` on the model. It tracks focus history so that when the currently focused node is deleted, focus falls back to the previous node rather than going to `leafOrder[0]`.

The getter `focusedNodeId` (`layoutModel.ts:776-778`) simply returns `this.focusedNodeIdStack[0]`.

The reactive memo `focusedNode` (`layoutModel.ts:544-554`) re-derives from `localTreeStateAtom` on every change:

```typescript
// layoutModel.ts:544-554
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
  → focusManager.requestNodeFocus()    (only after state has committed)
  → focusedNode memo re-evaluates
  → NodeModel.isFocused() returns true for the new node
```

`FocusNode` is special: it skips `updateTree()` (no topology change) but it still updates `focusedNodeIdStack` inline (`layoutModel.ts:729-730`) and calls `persistToBackend()`.

### 1.5 validateFocusedNode — Bootstrap and Stack Reconciliation

`validateFocusedNode` (`layoutFocus.ts:34`) runs inside `updateTree()` on every leaf-order recompute. It has two jobs:

1. **Bootstrap** (`layoutFocus.ts:38-45`): if neither `treeState.focusedNodeId` nor `focusedNodeIdStack` has a value (fresh tab, never persisted focus), auto-focus the first leaf (`defaultFocusLeaf`, `layoutFocus.ts:24-26`: the first pane in `leafOrder` that isn't an agent picker, else `leafOrder[0]`). This is the fix shipped as part of the 2026-06-12 border fix (`docs/specs/pane-highlight-fix-plan.md`).

2. **Reconcile** (`layoutFocus.ts:46-65`): if `treeState.focusedNodeId` diverges from `focusedNodeId` (e.g. a node was deleted), prune stale IDs from the stack and promote the next viable entry.

### 1.6 isFocused — Per-Node Derivation

Every `NodeModel` carries an `isFocused` accessor (`frontend/layout/lib/types.ts:447`). It is created as a `createMemo` inside `model.runInModelRoot()` so it outlives component lifecycles:

```typescript
// layoutNodeModels.ts:130-133
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

<img src="/diagrams/state-model-layout.svg" alt="LayoutModel (purple) owns six children: localTreeStateAtom (steel-blue, holds focusedNodeId/magnifiedNodeId/rootNode/leafOrder), treeState (gray, mutable scratch), focusedNodeIdStack (gray), waveObjectAtom (steel-blue, persists with 100ms debounce), nodeModels (steel-blue, per-node isFocused/isMagnified), and treeReducer (purple, mutates state and triggers fan-out)." style="max-width:100%" />

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
| `lastContextTokens` | `number \| null` | Input fill at last `message_start`; survives TurnEnd |
| `pending` | `PendingMessage[]` | Messages queued but not yet acknowledged by backend |
| `detailsOpen` | `boolean` | Composer details panel open/closed state |
| `composerUnreadCount` | `number` | Log entries arrived while panel was closed |

#### TurnPhase discriminated union

<img src="/diagrams/state-model-turnphase.svg" alt="TurnPhase state machine: Idle → Submitting → Streaming → Interrupting, each with arrows to terminal Done (steel-blue) or Disconnected. Purple arrows show timeout/error transitions: SubmitTimeoutElapsed (30s), StreamStalled (60s), InterruptTimeoutElapsed (5s)." style="max-width:100%" />

**Selectors** (`types.ts:587-633`):

| Selector | Returns true when |
|---|---|
| `isWorking(state)` | `turnPhase.kind ∈ {Submitting, Streaming, Interrupting}` |
| `isDisconnected(state)` | `turnPhase.kind === "Disconnected"` |
| `isInitReady(state)` | `initPhase.kind === "InitReady"` |

**Watchdog constants** (`types.ts:1328-1383`):

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

### 3.4 SRV-Side Layout Reducer — Phases 5–7 Open

On the srv side, `E.4.B` layout reducer phases 5–7 are open per the master status (`MASTER_REDUCER_STACK_STATUS_2026-05-05.md §0`):

| Phase | What | Status |
|---|---|---|
| 5 | Reducer arms calling pure helpers | ✅ shipped (§0 code-verified 2026-05-29) |
| 6 | Persist subscriber arms for layout events | ❌ open |
| 7 | Migrate legacy `rootnode` writers off wcore-direct | ❌ open |

This is directly related to the SRV-02 finding (see §6 below).

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

The memo that performs the resolution is `blockAgentColor` in `BlockFrame_Default_Component` (`blockframe.tsx:1164-1173`):

```typescript
// blockframe.tsx:1164-1173
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

The result is injected as a CSS custom property (`blockframe.tsx:1349`):

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

The `has-agent-color` class is added when `blockAgentColor()` is truthy (`blockframe.tsx:1330`). `block-focused` comes from `NodeModel.isFocused()` which tracks `localTreeStateAtom().focusedNodeId` (see §1.6).

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

Tabs no longer get a color automatically at creation; a user picks one from the 14-color `TAB_COLORS` palette (`frontend/app/tab/tab.tsx:32-47`):

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

Tab color is stored in `tab.meta["tab:color"]` (a MuxObject meta field, `srv-types.d.ts:867`). The startup tab is intentionally left without a color (`tabbar.tsx:270-275`). Tab color feeds **the tab bar indicator**, not the pane border directly — tab colors are a separate visual affordance from the pane focus ring.

### 4.6 The 2026-06-12 Border Fix

The focus border was broken by two bugs addressed in `docs/specs/pane-highlight-fix-plan.md`:

1. **Wrong metric bug:** `numBlocks` read `atoms.tabAtom().blockids` (frozen at window-init, includes non-visible blocks) and when it reached 1 applied `block-no-highlight` with `!important`, suppressing the border. Fix: remove `block-no-highlight` entirely. Files: `blockframe.tsx`, `blocktypes.ts`, `block.scss`.

2. **No-bootstrap bug:** `validateFocusedNode` was a no-op when both `treeState.focusedNodeId` and `focusedNodeIdStack` were `undefined` (fresh tab). Fix: auto-focus `leafOrder[0]` in the bootstrap case (now the first non-picker leaf, via `defaultFocusLeaf`). File: `layoutFocus.ts:38-45` (code now present at this location).

3. **LayoutModel memory leak:** `deleteLayoutModelForTab` did not call `model.dispose()` on tab drag-out, leaving a live reactive root. Fix: call `model.dispose()` after `MoveTabToWorkspace`. Files: `frontend/layout/lib/layoutModelHooks.ts:91-97` (`deleteLayoutModelForTab` now calls `model.dispose()`), called on drag-out from `frontend/app/drag/CrossWindowDropOverlay.tsx:130`.

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
| `updateMuxObject(update)` | Merge an inbound `waveobj:update` WS event; deduplicates on `version` (`mos.ts:361`) |
| `loadAndPinMuxObject<T>(oref)` | Pin (refCount++) + return the fetch promise |
| `reloadMuxObject<T>(oref)` | Force re-fetch from backend |

Cache eviction: `cleanMuxObjectCache()` runs every 30 s and removes entries with `refCount === 0` and `holdTime < now` (`mos.ts:387-397`).

### 5.3 How LayoutState is Persisted

The `LayoutModel` gets its MOS entry via `getLayoutStateAtomFromTab` (`layoutAtom.ts:11`):

```typescript
// layoutAtom.ts:18-22
const atom = () => {
    const oref = getOref();  // "layout:<tab.layoutstate>"
    if (!oref) return undefined;
    return MOS.getMuxObjectAtom<LayoutState>(oref)();
};
```

The `_set` implementation on this atom calls `MOS.setObjectValue(nextValue, true)` — i.e. it pushes to the server immediately when written.

`persistToBackend` (`layoutPersistence.ts:447-478`) is the debounced write path that copies `treeState` back to the `muxObjectAtom`:

```typescript
// layoutPersistence.ts:457-475
muxObj.rootnode = model.treeState.rootNode;
muxObj.focusednodeid = model.treeState.focusedNodeId;
muxObj.magnifiednodeid = model.treeState.magnifiedNodeId;
muxObj.leaforder = model.treeState.leafOrder;
// pendingbackendactions: the live backend queue minus actions this model already processed
muxObj.pendingbackendactions = unprocessed?.length ? unprocessed : undefined;
model.setter(model.muxObjectAtom, muxObj);
```

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
- `leaforder` — ordered leaf list
- `pendingbackendactions` — queued backend→frontend mutations

Both the frontend (via `persistToBackend`) and the srv reducer (via `apply_focused_node_changed` in `persist_subscriber.rs:754`) can write `focusednodeid`. This is the SRV-02 dual-path conflict.

---

## 6. SRV-02 Finding — Dual Persistence Paths for LayoutState

### 6.1 Description

`LayoutState` is persisted via **two conflicting paths** that are not coordinated:

**Path A — Frontend reducer path** (`layoutPersistence.ts:447-478`):
- `LayoutModel.persistToBackend()` (debounced 100 ms)
- Writes `rootnode`, `focusednodeid`, `magnifiednodeid`, `leaforder`, `pendingbackendactions` onto the MOS atom
- Calls `MOS.setObjectValue(muxObj, true)` → `ObjectService.UpdateObject` → srv wcore direct

**Path B — Srv reducer path** (`crates/srv/src/persist_subscriber.rs:747-774`):
- `apply_focused_node_changed(mstore, tab_id, node_id)` (called by persist subscriber on `Event::Layout::FocusedNodeChanged`)
- Writes only `focusednodeid` to `LayoutState` in SQLite
- Bypasses `rootnode` and other fields; scoped to Phase E.4.A (Option A)

### 6.2 Conflict Scenario

```
User clicks pane
  → LayoutModel.treeReducer(FocusNode)
  → localTreeStateAtom updated (frontend)
  → persistToBackend() debounced 100ms
    → Path A writes full LayoutState to srv (including focusednodeid)

  Meanwhile:
  → The same FocusNode action also dispatches through srv reducer (if wired)
  → srv Event::Layout::FocusedNodeChanged fires
  → Path B writes focusednodeid to SQLite directly
    → version conflict if Path A arrives after Path B has already incremented version
```

**Status per `MASTER_REDUCER_STACK_STATUS_2026-05-05.md §0`:**
- Phase E.4.B Phase 6 (persist subscriber arms consuming `Event::Layout*`) is **open**.
- Phase E.4.B Phase 7 (migrate legacy `rootnode` writers off wcore-direct) is **open**.
- The comment in `persist_subscriber.rs:751-753` confirms: "Other `LayoutState` fields stay on their existing wcore-direct path until Option B lands."

### 6.3 Impact

- **Low-risk for focusednodeid:** Path A and Path B write the same value; the last write wins without data loss. Version deduplication at `mos.ts:361` prevents stale signals.
- **Medium-risk for rootnode:** `rootnode` is only written by Path A (frontend). Path B never touches it. This means if Path B writes `focusednodeid` and bumps the SQLite version, a concurrent Path A write of `rootnode` may arrive against a stale version number.
- **Resolution:** shipping Phase E.4.B Phase 6 (persist subscriber arms) will retire Path B for `focusednodeid` and make Path A the sole writer, eliminating the conflict.

### 6.4 Workaround in Place

The frontend `mos.ts:361` version guard (`if (curValue.value != null && curValue.value.version >= update.obj.version) return`) prevents a stale backend push from overwriting a newer local value. The srv `persist_subscriber`'s idempotency (INSERT OR REPLACE keyed on oid+version) prevents double-write corruption. The dual-path is operational but architecturally unclean.

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
│  LayoutState writes: two paths (SRV-02 — see §6)                          │
│    Path A: LayoutModel.persistToBackend() (100ms debounce, full write)     │
│    Path B: srv persist_subscriber apply_focused_node_changed (focusednodeid only, │
│             pending Phase E.4.B Phase 6 migration)                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key File Index

| Concern | Primary File | Location |
|---|---|---|
| LayoutModel class | `layoutModel.ts` | `frontend/layout/lib/layoutModel.ts` |
| localTreeStateAtom init | `layoutModel.ts:449` | line 449 |
| focusedNodeId getter | `layoutModel.ts:776` | line 776 |
| focusedNode memo | `layoutModel.ts:544` | line 544 |
| FocusNode reducer arm | `layoutModel.ts:692` | line 692 |
| validateFocusedNode (bootstrap + reconcile) | `layoutFocus.ts:34` | `frontend/layout/lib/layoutFocus.ts` |
| isFocused memo (per-node) | `layoutNodeModels.ts:130` | `frontend/layout/lib/layoutNodeModels.ts` |
| persistToBackend | `layoutPersistence.ts:447` | `frontend/layout/lib/layoutPersistence.ts` |
| MOS getMuxObjectAtom | `mos.ts:256` | `frontend/app/store/mos.ts` |
| LayoutState atom from tab | `layoutAtom.ts:11` | `frontend/layout/lib/layoutAtom.ts` |
| AgentPaneState / TurnPhase types | `types.ts` | `frontend/app/store/agent-pane-state/types.ts` |
| AgentDocumentState types | `frontend/app/store/agent-document/types.ts` | `frontend/app/store/agent-document/types.ts` |
| BrowserPaneState types | `frontend/app/store/browser-pane-state/types.ts` | `frontend/app/store/browser-pane-state/types.ts` |
| EditorPaneState / reducer | `editor-pane-state-store.ts` | `frontend/app/store/editor-pane-state-store.ts` |
| blockAgentColor memo | `blockframe.tsx:1164` | `frontend/app/block/blockframe.tsx` |
| isUsableFocusRingColor | `autotitle.ts:170` | `frontend/app/block/autotitle.ts` |
| block-focused CSS (border) | `block.scss:298` | `frontend/app/block/block.scss` |
| SRV-02 persist-subscriber (focusednodeid) | `persist_subscriber.rs:747` | `crates/srv/src/persist_subscriber.rs` |
| Reducer-stack master status | `MASTER_REDUCER_STACK_STATUS_2026-05-05.md` | `docs/specs/` |
| Discussion #707 ref | `SPEC_OBJ_UPDATE_BRIDGE_2026-05-14.md:7` | `docs/specs/` |
| Border fix plan | `pane-highlight-fix-plan.md` | `docs/specs/` |
| Focus border tab-switch bug | `focus-border-tab-switch-bug.md` | `docs/specs/` |
| Agent-pane-layout reducer (Phase 0) | `SPEC_AGENT_PANE_LAYOUT_REDUCER_2026_06_02.md` | `docs/specs/` |
