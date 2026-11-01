---
title: Warden architecture
description: How the Warden widget is wired — view model, section data flow, polling cadence, and the three-layer mapping onto the existing jekt cascade.
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented.
:::

The Warden pane has since been split up: its sections are now the Vault, [History](/history/), [Audit](/audit/) and [Jobs](/jobs/) panes, the Swarm, and the status bar's network and token pills (see [Warden](/warden/)). This page keeps the original design of the Warden widget and the jekt tiers it was built around.

This page covers the Warden widget's internals: the file layout, the view model pattern, the section data sources, and the design constraint that drove the three-layer split. For where each section went, see [Warden](/warden/).

## File layout

The Warden pane tab is now a thin shell: the Vault, History and Audit became panes of their own, and only Jobs is left under the `warden` view. Where the original single-file widget (`warden.tsx`, `WardenViewModel` and `WardenView` together) once held everything, the code is now:

| File | What |
|---|---|
| `frontend/app/view/warden/warden.tsx` | The pane tab manifest (`wardenPaneTab`, labelled **Jobs**), loaded lazily |
| `frontend/app/view/warden/warden-instance.tsx` | The code that loads with the first Warden pane |
| `frontend/app/view/warden/warden-model.ts`, `warden-view.tsx` | The view model and view |
| `frontend/app/view/warden/warden-sections.ts` | The section list, and how an old Warden section link maps to its new pane (`frontend/app/block/pane-sections.ts`) |
| `frontend/app/view/warden/warden-view.scss` | Warden styling |
| `frontend/app/block/block-registry.ts` | Registers `wardenPaneTab` with the other native pane tabs |

The Warden no longer has an entry in `crates/srv/src/config/widgets.json`. The original view model was a single class with a view type, a block id and a view component getter, a smaller shape than the Swarm's or the Drone's multi-file view models.

## The three layers

The Warden renders three sections — Host, LAN, Internet — that map onto the jekt delivery tiers specified in [Jekt protocol](/internals/jekt-protocol/#4-delivery):

| Warden section | Jekt tier | Substrate | Status today |
|---|---|---|---|
| Host | Host, and Channel (another instance on this machine, over loopback) | `ReactiveHandler` | live |
| LAN | LAN (mDNS-discovered peers; delivery works) | `LanDiscoveryController` | live (read-only view) |
| Internet | WAN (MuxBus Cloud) | MuxBus Cloud relay (works once signed in) | the Warden section is a stub |

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

Source: `GET /api/lan-instances` (a route behind srv's normal `X-AuthKey` check, served from `LanDiscoveryController.get_instances()`).

Same 5 s + 1 s tick pattern. The LAN section's empty-state copy points the operator at the HostPopover toggle if [LAN discovery](/lan-discovery/) isn't on yet — most "no peers" situations are "you haven't enabled it."

### Internet section

The section is a stub that renders a "closed by default" message. The tier itself works: jekts travel through MuxBus Cloud once you sign in; the Warden just doesn't show it yet.

## Endpoint authentication

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

`/agentmux/reactive/*` requires the `X-AuthKey` header (audit C1+C2 hardening). `/api/lan-instances` sits behind the same check (`auth_middleware`), so both calls go through the auth helper.

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

Hard kill, pause-host, kill-all, and a `governance.json` policy file are all planned, but each requires either backend work the Warden doesn't have yet (a Warden action RPC; an enforcer hook in the `ReactiveHandler` `inject_message` path) or a destructive UI dialog with stronger guard rails. They're listed as follow-up phases in the spec and held back to keep each PR's blast radius small.

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

This is a smaller shape than the Swarm's or the Drone's view models, which carry significant model-side state (run lists, draft graphs, in-flight saves). The Warden doesn't need any of that — the section data is fully derivable from the backend endpoints on every refresh.

## Section status chips: not just decoration

The `live` / `stub` / `disabled` chips drive a single-source-of-truth pattern: each section's chip *and* its actual content come from the same entry in the section list (`WARDEN_SECTIONS` in `frontend/app/view/warden/warden-sections.ts`). When a future PR wires Internet (L3), it changes that section's status from `disabled` to `live` *and* swaps the render function to one that talks to the MuxBus cloud relay — both in one place.

The Warden was a long-running multi-PR effort, and the chip's status tied it together as it grew.

## Source

- `frontend/app/view/warden/` — the Warden pane tab (see File layout above)
- `frontend/app/block/block-registry.ts` — registers the pane tab
- `crates/srv/src/server/pane_binding.rs` — `handle_unregister`, the `/agentmux/reactive/unregister` handler
- `crates/srv/src/server/routes.rs` — the `/api/lan-instances` route, in the authenticated router
- `docs/specs/SPEC_WARDEN_WIDGET_2026-05-25.md` — full design spec (in the main repo)
- [Jekt protocol](/internals/jekt-protocol/) — the delivery tiers the sections map onto

## See also

- [Warden](/warden/) — where the Warden's sections went
- [LAN discovery (internals)](/internals/lan-discovery/) — the substrate the LAN section reads from
- [Interagent event bus](/internals/interagent-comms/) — the reactive WS-event system
- [Architecture overview](/internals/architecture/) — broader system context
