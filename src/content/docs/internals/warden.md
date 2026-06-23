---
title: Warden architecture
description: How the Warden widget is wired — view model, section data flow, polling cadence, and the three-layer mapping onto the existing jekt cascade.
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented.
:::

This page covers the Warden widget's internals: the file layout, the view model pattern, the section data sources, and the design constraint that drove the three-layer split. For what the user sees, see [Warden widget](/warden/).

## File layout

The Warden is unusually compact for a widget — most of its surface area is wiring to existing endpoints, not new backend code.

| File | What |
|---|---|
| `frontend/app/view/warden/warden.tsx` | `WardenViewModel` + `WardenView` (single file, ~400 lines) |
| `frontend/app/view/warden/warden.scss` | All Warden styling |
| `frontend/app/block/block.tsx` | `BlockRegistry.set("warden", WardenViewModel)` |
| `agentmux-srv/src/config/widgets.json` | `defwidget@warden` declaration |

There's no `warden-model.ts` or `warden-view.tsx` split — the widget is small enough that one file is clearer than three. The view model follows the **`HelpViewModel` pattern** (single class with `viewType`, `blockId`, and a `viewComponent` getter), not the `SwarmViewModel` / `DroneViewModel` multi-file pattern.

## The three layers

The Warden renders three sections — Host, LAN, Internet — that map **1:1 onto the existing jekt-delivery cascade** documented in [`specs/lan-awareness-and-embedded-jekt-api.md`](https://github.com/agentmuxai/agentmux/blob/main/specs/lan-awareness-and-embedded-jekt-api.md):

| Warden section | Jekt tier | Substrate | Status today |
|---|---|---|---|
| Host | Tiers 1 + 2 (intra-process + local WS) | `ReactiveHandler` + `MessageBus` | live |
| LAN | Tier 3 (mDNS peer forward) | `LanDiscoveryController` (mDNS only — forwarding TBD) | live (read-only) |
| Internet | Tier 4 (cloud relay) | MuxBus | disabled by default |

That's why the Warden was framed as "the operator-facing surface of the cascade" — not a new control plane, but a rendering of the layering that already exists in the backend.

Each section in `WardenView` carries a `status` field: `live`, `stub`, or `disabled`. The status chip in each section header reflects which substrate is wired through.

## Section data flow

### Host section

Source: two existing endpoints under the reactive routes (auth-gated by middleware):

| Endpoint | Returns | Cadence |
|---|---|---|
| `GET /agentmux/reactive/agents` | `Vec<AgentRegistration>` (agent_id, block_id, registered_at, last_seen) | 5 s |
| `GET /agentmux/reactive/audit?limit=50` | `Vec<AuditLogEntry>` (timestamp, source/target, success, message_length, error) | 5 s |

Both fetches run in parallel under `Promise.all` on the same refresh tick. A separate 1 s clock tick updates the relative "last seen" / "Xs ago" columns without re-fetching.

The `× ` per-row button calls `POST /agentmux/reactive/unregister` (also pre-existing, auth-gated). That endpoint just unregisters the agent from the `ReactiveHandler` — it does not touch the agent's PTY / pane. The confirmation dialog spells this out so the operator knows it's a soft action.

### LAN section

Source: `GET /api/lan-instances` (the public, no-auth route exposed by `LanDiscoveryController.get_instances()`).

Same 5 s + 1 s tick pattern. The LAN section's empty-state copy points the operator at the HostPopover toggle if [LAN discovery](/lan-discovery/) isn't on yet — most "no peers" situations are "you haven't enabled it."

### Internet section

Pure stub — renders a "closed by default" message. The substrate (MuxBus cloud relay forwarding through the controller) hasn't been wired.

## Authed vs public endpoints

The Warden talks to two flavors of endpoint:

```typescript
function authedHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (globalThis.window != null) {
        const authKey = getApi()?.getAuthKey?.();
        if (authKey) headers["X-AuthKey"] = authKey;
    }
    return headers;
}
```

`/agentmux/reactive/*` requires the `X-AuthKey` header (audit C1+C2 hardening). `/api/lan-instances` is a public route. The Warden uses the auth helper for reactive endpoints and bare `fetch()` for `/api/lan-instances`.

## Why polling, not WebSocket subscriptions

The backend does broadcast WS events for both data sources (`laninstances` and various reactive events). The Warden still polls. Three reasons:

1. **Cold-start clarity** — Polling on mount gives a deterministic first paint with the current state; a WS-only model would either render empty until the first event arrives, or duplicate state via a snapshot endpoint.
2. **Audit event semantics** — The audit log is append-only and has a *limit* on what's surfaced. Polling `/audit?limit=50` is the existing contract; reproducing that with a streaming feed adds complexity (catch-up logic, replay on reconnect).
3. **5 s cadence is fine for operator UI** — The Warden is not a real-time dashboard. Audit and agent state change on the order of seconds; sub-second updates would add noise without value.

If a future need (large agent fleets, dense audit traffic) makes 5 s feel laggy, a WS push channel can land alongside the polling without breaking the existing endpoints.

## Soft enforce: the deliberate scope

The only enforcement action the Warden ships today is **soft deregister**. The choice is intentional:

- The reactive registry is the **routing layer**, not the lifecycle layer
- An agent's PTY / pane is owned by the block controller, which knows nothing about the reactive registry
- Coupling Warden actions to PTY teardown would conflate two concerns and create surprising side effects (close pane to silence agent? wrong way around)

Hard kill, pause-host, kill-all, and a `governance.json` policy file are all planned, but each requires either backend work the Warden doesn't have yet (a `WardenAction` RPC; an enforcer hook in the `ReactiveHandler` `inject_message` path) or a destructive UI dialog with stronger guard rails. They're listed as follow-up phases in the spec and held back to keep each PR's blast radius small.

## ViewModel pattern: why HelpViewModel-style

The Warden inherits from the minimal interface:

```typescript
class WardenViewModel implements ViewModel {
    viewType: string;
    blockId: string;
    constructor(blockId: string) {
        this.viewType = "warden";
        this.blockId = blockId;
    }
    get viewComponent(): ViewComponent {
        return WardenView as unknown as ViewComponent;
    }
}
```

That's it. No reactive store, no per-pane settings persistence, no service binding at the model layer. The view component owns its own polling and state via SolidJS signals.

This matches `HelpViewModel` and contrasts with `SwarmViewModel` / `DroneViewModel`, which carry significant model-side state (run lists, draft graphs, in-flight saves). The Warden doesn't need any of that — the section data is fully derivable from the backend endpoints on every refresh.

## Section status chips: not just decoration

The `live` / `stub` / `disabled` chips drive a single-source-of-truth pattern: each section's chip *and* its actual content come from the same `LayerSection` entry in the `SECTIONS` array. When a future PR wires Internet (L3), it changes that section's status from `disabled` to `live` *and* swaps the render function to one that talks to the MuxBus cloud relay — both in one place.

This is the same reason `defwidget@warden` carries a single `description` field that mentions the spec — the Warden is a long-running multi-PR effort, and the navigation breadcrumb back to the spec (and the chip's status) is what ties it together as it grows.

## Source

- `frontend/app/view/warden/warden.tsx` — model + view + section data sources
- `frontend/app/view/warden/warden.scss` — section styling, audit feed, toggle switches
- `frontend/app/block/block.tsx` — view registration in `BlockRegistry`
- `agentmux-srv/src/config/widgets.json` — `defwidget@warden`
- `agentmux-srv/src/server/reactive.rs` — `/agentmux/reactive/agents`, `/audit`, `/unregister` handlers
- `agentmux-srv/src/server/mod.rs` — `/api/lan-instances` route
- `specs/SPEC_WARDEN_WIDGET_2026-05-25.md` — full design spec
- `specs/lan-awareness-and-embedded-jekt-api.md` — the cascade the layers map onto

## See also

- [Warden widget (user guide)](/warden/) — operator-facing intro
- [LAN discovery (internals)](/internals/lan-discovery/) — the substrate the LAN section reads from
- [Interagent event bus](/internals/interagent-comms/) — the reactive WS-event system
- [Architecture overview](/internals/architecture/) — broader system context
