---
title: Modal system (modal-v2)
description: How AgentMux renders dialogs — the universal `modal-v2` chrome classes plus the two rendering paths (top-level `<Modal>` and pane-scoped `TabModalLayer`).
---

AgentMux has **one** modal/dialog system. Don't invent ad-hoc `.foo-modal-header` / `.foo-modal-body` classes for new dialogs — reuse the universal chrome so every modal in the app looks and behaves the same.

## The system

All dialog chrome lives in [`frontend/app/element/modal-v2.scss`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/element/modal-v2.scss) and the matching components in [`frontend/app/element/modal-v2.tsx`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/element/modal-v2.tsx).

Chrome classes (apply directly via JSX):

| Slot | Class | Purpose |
|------|-------|---------|
| Title bar | `.modal-panel-header` | Top strip with bottom border |
| Title text | `.modal-panel-title` | Big bold title (h1/h2) |
| Subtitle | `.modal-panel-description` | One-line context under the title |
| Content | `.modal-panel-body` | Padded body region for fields, lists, terminals, whatever the modal needs |
| Actions | `.modal-panel-footer` | Right-aligned button row with top border + faint tinted background |

There are also Solid components in `modal-v2.tsx` that wrap these classes: `<Modal>`, `<ModalHeader>`, `<ModalBody>`, `<ModalFooter>`. Use the components if you want managed Portal mounting + ESC/backdrop close. Use the bare CSS classes if you're already inside a container that owns those (see *Rendering paths* below).

## Rendering paths

There are two places a modal can render:

### 1. Top-level (window-scoped, portal'd)

The modal floats above the entire window. Use the `<Modal>` JSX component, which handles its own Portal, backdrop, ESC, and focus management.

```tsx
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/element/modal-v2";

<Modal onClose={close}>
    <ModalHeader title="Confirm deletion" />
    <ModalBody>Are you sure?</ModalBody>
    <ModalFooter>
        <Button onClick={close}>Cancel</Button>
        <Button onClick={confirm} className="red solid">Delete</Button>
    </ModalFooter>
</Modal>
```

Examples in the codebase: `about.tsx`, `command-palette.tsx`, `messagemodal.tsx`, `userinputmodal.tsx`, `ImportPreviewModal.tsx`.

### 2. Pane-scoped (tab-modal layer)

The modal floats over the tab's content area only — the title bar and tab bar stay interactive. Used when the dialog is tightly coupled to a specific pane (e.g. Agent launch / install).

For this path, return a **fragment** of `<header>`, `<div class="modal-panel-body">`, `<footer>` directly. The `tab-modal-panel` wrapper, backdrop, animations, and ESC handling come from `TabModalLayer` automatically.

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

To trigger one, dispatch through the tab-modal context:

```tsx
const tabModal = useTabModal();
tabModal.open({
    kind: "launch-agent",
    agent,
    originBlockId,
    onSubmit: async (overrides) => { /* ... */ },
});
```

The `kind` field discriminates which panel to render; add new variants in [`frontend/app/tab/tab-modal.ts`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/tab/tab-modal.ts) and a matching `case` in `renderRequest()` of [`TabModalLayer.tsx`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/tab/TabModalLayer.tsx).

Examples in the codebase: `AgentLaunchModal.tsx`, `AgentInstallModal.tsx`.

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

## When to NOT use this system

Positioned popovers — cursor-anchored or element-anchored panels that follow a target, not a centered dialog. Examples: `typeaheadmodal.tsx`, `TokenBreakdownPopover.tsx`. These have their own positioning logic (`ResizeObserver` + manual coordinate math) and are intentionally outside `modal-v2`.

If you're building a centered dialog, you're in the system. If you're building a context popup that follows a target element, you're not.

## See also

- [Architecture overview](/internals/architecture/) — where the modal layer sits in the four-process topology.
- Source: [`frontend/app/element/modal-v2.scss`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/element/modal-v2.scss), [`frontend/app/element/modal-v2.tsx`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/element/modal-v2.tsx), [`frontend/app/tab/TabModalLayer.tsx`](https://github.com/agentmuxai/agentmux/blob/main/frontend/app/tab/TabModalLayer.tsx).
