---
title: "Interpane Communication"
---

AgentMux panes communicate through a reactive event system. This enables real-time coordination between agents, terminals, and monitoring views.

## Architecture

Communication flows through the backend via WebSocket using JSON-RPC 2.0:

```
Pane A (Frontend)
    ↕  WebSocket / JSON-RPC 2.0
agentmuxsrv-rs (Backend)
    ↕  WebSocket / JSON-RPC 2.0
Pane B (Frontend)
```

The backend acts as a message broker. Panes publish events, and other panes subscribe to them. All communication is asynchronous and non-blocking.

## Event System

AgentMux uses a publish-subscribe event system. Panes subscribe to event types with optional scope filters.

### Publishing Events

Any pane can publish an event through the RPC API:

```typescript
RpcApi.EventPublishCommand(client, {
    eventType: "sysinfo",
    scope: "local",
    data: { cpu: 45.2, mem: 8192 }
});
```

### Subscribing to Events

Panes subscribe to events by type and scope:

```typescript
const unsub = waveEventSubscribe({
    eventType: "sysinfo",
    scope: connectionName,
    handler: (event) => {
        // Process incoming event
    }
});
```

Subscriptions return an unsubscribe function for cleanup.

### Event History

Read past events for a given type:

```typescript
const history = await RpcApi.EventReadHistoryCommand(client, {
    eventType: "sysinfo",
    maxItems: 120
});
```

## Use Cases

### Agent Output Streaming

When an agent produces output, it publishes events that the agent pane subscribes to. The Swarm view also subscribes to these events to track all agent activity in one place.

### System Metrics

The sysinfo backend collector publishes `sysinfo` events at a configurable interval. Any number of Sysinfo panes can subscribe — each renders its own plots from the same event stream.

### Subagent Tracking

When a parent agent spawns a sub-agent, the backend emits subagent lifecycle events. The Swarm pane picks these up to show active/completed sub-agents. Opening a Subagent pane subscribes to that specific agent's event stream.

### Block Lifecycle

Events are published when blocks (panes) are created, focused, resized, or closed. This enables features like focus tracking and layout persistence.

## Scoping

Events are scoped to control delivery:

- **Local** — Events from the local machine
- **Connection-scoped** — Events from a specific SSH connection (e.g., `ssh:myhost`)
- **Block-scoped** — Events targeted at a specific pane by block ID

## Remote Communication

For remote hosts connected via SSH, the `wsh` binary runs on the remote and communicates with the backend via WebSocket. Remote events (like sysinfo from a server) are scoped by connection name, so local and remote metrics don't collide.

```
Local Sysinfo Pane  ←  backend  ←  local sysinfo collector
Remote Sysinfo Pane ←  backend  ←  wsh (remote host) → remote sysinfo
```

## See Also

- [Agent App API](/agent-app-api) — Full RPC command reference
- [Subagent Watcher](/subagent-watcher) — Sub-agent monitoring
- [System Metrics](/system-metrics) — Sysinfo event details
