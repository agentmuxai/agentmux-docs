---
title: Modal system
description: How AgentMux renders dialogs — the canonical `<Modal>` primitive with scope axis (window / tab / pane), shared chrome classes, and chained-flow transitions.
---

AgentMux has **one** modal system. Don't invent ad-hoc `.foo-modal-header` / `.foo-modal-body` classes for new dialogs — reuse the canonical chrome so every modal in the app looks and behaves the same.

## The system

Source: [`frontend/app/element/modal.tsx`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/element/modal.tsx) + [`frontend/app/element/modal.scss`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/element/modal.scss). No `modal-v2`, no `modal-v3`, no namespacing — just `modal`.

### Chrome classes

Apply directly via JSX:

| Slot | Class | Purpose |
|------|-------|---------|
| Title bar | `.modal-panel-header` | Top strip with bottom border |
| Title text | `.modal-panel-title` | Big bold title (h1/h2) |
| Subtitle | `.modal-panel-description` | One-line context under the title |
| Content | `.modal-panel-body` | Padded body region for fields, lists, terminals, whatever the modal needs |
| Actions | `.modal-panel-footer` | Right-aligned button row with top border + faint tinted background |

There are also Solid components in `modal.tsx` that wrap these classes: `<Modal>`, `<ModalHeader>`, `<ModalBody>`, `<ModalFooter>`. Use the components if you want managed Portal mounting + ESC/backdrop close. Use the bare CSS classes if you're already inside a container that owns those (see *Scope* below).

## Scope — what the modal locks

The `scope` prop on `<Modal>` selects what region the modal locks. Mount point, backdrop extent, `inert` boundary, scroll lock, and the modal stack are all consequences of that scope.

| Scope | Mounts into | Inert region | Backdrop covers | Used for |
|---|---|---|---|---|
| `window` (default) | The current window's `document.body` (Portal'd) | The whole body | Full window | App-wide dialogs (Confirm, About, Command palette, Bundle manager, Message, User input) |
| `tab` | The active tab's content root (via `TabModalScope` context) | Just that tab's content | The tab's area only — title bar + tab bar stay live | Tab-coupled dialogs (Agent launch, Agent install, Create from template, OAuth pre-launch) |
| `pane` | A single pane's root (via `PaneModalScope` context) | Just that pane | The pane's area only — everything outside it stays live | Pane-scoped dialogs. Infrastructure exists; pane-scoped modals plug in by adding `<PaneModalScope.Provider>` at the pane root. |

Falls back to `window` (with a console.warn) when `scope="tab"` is used but no `TabModalScope` provider is present. Same for `pane`.

### Window-scope example

The modal floats above the entire window. Use the `<Modal>` JSX component:

```tsx
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/element/modal";

<Modal onClose={close}>  {/* scope="window" is the default */}
    <ModalHeader title="Confirm deletion" />
    <ModalBody>Are you sure?</ModalBody>
    <ModalFooter>
        <Button onClick={close}>Cancel</Button>
        <Button onClick={confirm} className="red solid">Delete</Button>
    </ModalFooter>
</Modal>
```

Examples in the codebase: `about.tsx`, `command-palette.tsx`, `messagemodal.tsx`, `userinputmodal.tsx`, `ImportPreviewModal.tsx`.

### Tab-scope example

The modal floats over the tab's content area only — the title bar and tab bar stay interactive. Used when the dialog is tightly coupled to a specific tab (e.g. Agent launch / install).

These modals run through `TabModalLayer`, which wraps every tab's tile layout, provides a `TabModalScope` for the mount point, and dispatches on a request kind. Triggering one:

```tsx
const tabModal = useTabModal();
tabModal.open({
    kind: "launch-agent",
    agent,
    originBlockId,
    onSubmit: async (overrides) => { /* ... */ },
});
```

The panel returns the chrome fragment directly — the layer renders it inside a `<Modal scope="tab">`:

```tsx
return (
    <>
        <header class="modal-panel-header">
            <h2 class="modal-panel-title">Launch {name}</h2>
            <p class="modal-panel-description">Pick a runtime and identity.</p>
        </header>
        <div class="modal-panel-body">
            {/* form fields */}
        </div>
        <footer class="modal-panel-footer">
            <Button onClick={onCancel}>Cancel</Button>
            <Button onClick={onSubmit} className="green solid">Launch</Button>
        </footer>
    </>
);
```

Add new request variants in [`frontend/app/tab/tab-modal.ts`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/tab/tab-modal.ts) and a matching `case` in `renderRequest()` of [`TabModalLayer.tsx`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/tab/TabModalLayer.tsx).

Examples: `AgentLaunchModal.tsx`, `AgentInstallModal.tsx`, `AgentCreateFromTemplateModal.tsx`.

### Pane-scope (when added)

Same pattern as tab-scope but narrower. A pane (e.g., an agent pane) renders a `<PaneModalScope.Provider value={mountAccessor}>` around its content; an in-pane `<Modal scope="pane">` resolves its mount + inert boundary from that. Visual: backdrop covers only the pane's bounds, every other pane in the tab stays interactive.

The infrastructure (context, mount resolution, inert region, stack accounting for non-overlapping pane locks) is in place; the first caller adds the provider and switches to `scope="pane"`.

## Modal stack — how nested modals behave

The stack records each open modal's `scope` and lock region. ESC and backdrop click target the "reachable topmost" — the highest-stacked modal that isn't contained by a higher one's lock region.

Concrete behavior:
- A `window` modal opened on top of a `tab` modal covers the whole window; ESC closes the window modal.
- A `pane` modal opened in pane A and another `pane` modal opened in pane B coexist independently — they don't share a lock region. ESC in pane A closes A's modal; ESC in pane B closes B's. Backdrop click is scoped to the clicked pane's modal.
- A `tab` modal opened with a `window` modal already on top: the tab modal stays inert until the window modal closes.

`closeOnBackdropClick={false}` doesn't silently swallow backdrop clicks — it triggers a "nudge" animation on the panel's `[data-modal-dismiss]` control, signaling the user to cancel explicitly.

## Chained flows — `tabModal.replace(next)`

When a modal completes and the natural next step is **another** modal in the same flow (install → launch, install → auth → launch, workflow setup → workflow run), use `tabModal.replace(next)` instead of `close()` followed by `open(next)`.

```tsx
const tabModal = useTabModal();

// First modal opens cold — full entrance animation:
tabModal.open({ kind: "install-agent", ... onInstalled: () => {
    // Crossfade into the launch modal — backdrop + outer panel stay
    // mounted; only the inner content remounts with a 140ms fade.
    tabModal.replace({ kind: "launch-agent", ... });
}});
```

What `replace` does differently from `open`:

| | `open` | `replace` |
|---|---|---|
| Backdrop | Mounts fresh (fades in 120ms) | Stays mounted from prior modal — no flicker |
| Outer panel | Mounts fresh (pops in 140ms) | Stays mounted — no entrance pop replay |
| Inner content | Mounts with content-fade 140ms | Re-mounts via keyed `<Show>`, plays content-fade 140ms |
| Panel size | Sized by new content immediately | Animated via `transition: min-height` 160ms |
| `submitting` flag | Reset to `false` | Reset to `false` |

If there's no current modal, `replace(next)` is equivalent to `open(next)` — the full entrance animation plays. So callers in chain-handoff code (like the install-modal's `onInstalled`) don't need to special-case "is anything open right now."

Use `open` for **cold starts** (user click on a card, command palette dispatch). Use `replace` for **continuations** of the same user-perceived task.

See [`SPEC_MODAL_TRANSITIONS_2026_05_18.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/SPEC_MODAL_TRANSITIONS_2026_05_18.md) for the full rationale and implementation notes.

### What about `close()`?

`tabModal.close()` is for **dismissal** — the user clicked Cancel, hit ESC, or clicked the backdrop. It tears down the modal instantly (no exit animation). Don't use `close()` as part of a chain — it leaves a gap where the backdrop disappears before the next modal opens, producing the visible jolt that `replace` was added to fix.

## Paint gate — wait for content to settle

The entrance animation doesn't fire until the modal subtree has painted once. `TabModalLayer` mounts the modal with `visibility: hidden` and animations suppressed, lets the browser run one full paint cycle (rAF×2 so `FitAddon`, autofocus, dropdown population, and any other synchronous-after-mount work finish their layout), then flips a `data-ready` attribute on the overlay → CSS reveals the modal and starts the entrance keyframes.

Why this exists: without the gate, the install modal's xterm container is still 0×0 during the 140ms pop-in animation. The user sees the entrance play over a half-laid-out terminal that pops to its real size mid-animation. Other modals show similar flicker as form fields autofocus or selects populate. The gate moves all that work into a hidden frame and reveals the result.

Two gates run in parallel:

- **`data-ready`** — gates the backdrop + outer panel. Fires once per `tabModal.open(...)` (the cold-open path); persists across `tabModal.replace()` swaps.
- **`data-content-ready`** — gates only the inner `.tab-modal-content`. Re-arms on every `replace()` so the swapped content also waits for paint before crossfading.

A 200ms `setTimeout` failsafe forces both gates open if `requestAnimationFrame` stays parked (background tab, suspended renderer). Reduced-motion still respected — the gate still applies but the keyframes are suppressed regardless.

Implementer's note: pane code that runs in `onMount` (xterm.open, FitAddon.fit, ResizeObserver, focus calls) doesn't need to do anything special. The gate handles the timing at the layer.

See [`SPEC_MODAL_PAINT_GATE_2026_05_18.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/SPEC_MODAL_PAINT_GATE_2026_05_18.md) for the rAF×2 rationale and the visibility-hidden trick.

## Modal-specific styles go in component-scoped classes

The CHROME stays universal. Modal-specific content (a form layout, an xterm container, a list of cards) uses its own component-scoped classes that DON'T duplicate header/title/body/footer.

For example, the install modal has:

```scss
.agent-install-modal-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 560px;
    max-width: 720px;
    min-height: 320px;
}

.agent-install-modal-term {
    flex: 1 1 auto;
    min-height: 240px;
    /* xterm.js container styling */
}
```

— but no `.agent-install-modal-header` or `.agent-install-modal-title`. Those would be ad-hoc duplicates.

## Browser-pane airspace clip

Native browser-pane HWNDs composite above the HTML renderer, so CSS `z-index` can't stack a modal over a visible pane on its own. `<Modal>` registers its open rect with the backend via `usePaneOverlay`, which subtracts that rect from every pane's Win32 region — the pane's HWND paints transparent where the modal is. The clip is bound to the modal's open/close lifecycle (via `<Show>` so it registers only while visible). Same primitive used by `TokenBreakdownPopover` and `MoreDropdown` for the same reason. Spec: [`SPEC_MODAL_PANE_CLIP_2026_04_24.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/SPEC_MODAL_PANE_CLIP_2026_04_24.md).

## When to NOT use this system

Positioned popovers — cursor-anchored or element-anchored panels that follow a target, not a centered dialog. Examples: `typeaheadmodal.tsx`, `TokenBreakdownPopover.tsx`. These have their own positioning logic (`ResizeObserver` + manual coordinate math) and are intentionally outside the modal system.

If you're building a centered dialog, you're in the system. If you're building a context popup that follows a target element, you're not.

## See also

- [Architecture overview](/internals/architecture/) — where the modal layer sits in the four-process topology.
- Source: [`frontend/app/element/modal.scss`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/element/modal.scss), [`frontend/app/element/modal.tsx`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/element/modal.tsx), [`frontend/app/tab/TabModalLayer.tsx`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/tab/TabModalLayer.tsx).
- Design spec for the scope axis: [`SPEC_UNIFIED_MODAL_SYSTEM_2026_05_21.md`](https://github.com/agentmuxai/agentmux/blob/main/docs/specs/SPEC_UNIFIED_MODAL_SYSTEM_2026_05_21.md).
