---
title: "System Metrics"
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

The Sysinfo pane displays live system metrics as time-series line plots. It supports local and remote monitoring.

## Opening Sysinfo

- Click the **chart** icon in the top bar
- Right-click a pane header and select **Sysinfo**
- Use the launcher widget

## Available Metrics

### CPU

| Metric Key | Description |
|-----------|-------------|
| `cpu` | Overall CPU usage percentage (0–100%) |
| `cpu:0` – `cpu:31` | Per-core CPU usage (up to 32 cores) |

### Memory

| Metric Key | Description |
|-----------|-------------|
| `mem:used` | Memory in use (GB) |
| `mem:free` | Free memory (GB) |
| `mem:available` | Available memory (GB) |
| `mem:total` | Total system memory (GB, used for Y-axis scale) |

### Network

| Metric Key | Description |
|-----------|-------------|
| `net:bytessent` | Network bytes sent (MB/s) |
| `net:bytesrecv` | Network bytes received (MB/s) |
| `net:bytestotal` | Total network throughput (MB/s) |

### Disk

| Metric Key | Description |
|-----------|-------------|
| `disk:read` | Disk read throughput (MB/s) |
| `disk:write` | Disk write throughput (MB/s) |
| `disk:total` | Total disk I/O throughput (MB/s) |

## Plot Types

The Sysinfo pane supports preset plot configurations:

| Plot Type | Metrics Shown |
|-----------|--------------|
| **CPU** | Overall CPU % |
| **Mem** | Memory used |
| **CPU + Mem** | Both in one view |
| **Net** | Total network throughput |
| **Net (Sent/Recv)** | Sent and received separately |
| **CPU + Mem + Net** | All three combined |
| **Disk I/O** | Total disk throughput |
| **Disk I/O (R/W)** | Read and write separately |
| **All CPU** | Per-core usage (grid of plots, up to 32) |

When more than two metrics are displayed, plots arrange in a 2-column grid. Each plot auto-scales its Y-axis based on the metric type.

## Data Collection

- Data is collected by the backend at a configurable interval (default: 1 second)
- Points are streamed to the frontend via WebSocket events (`sysinfo` event type)
- The default display window is **120 data points** (2 minutes at 1s interval)
- Gap detection inserts blank segments when data is missing (e.g., after sleep/wake)

## Plot Colors

Each metric type has a distinct CSS variable for theming:

| Metric | CSS Variable |
|--------|-------------|
| CPU | `--sysinfo-cpu-color` |
| Memory | `--sysinfo-mem-color` |
| Network | `--sysinfo-net-color` |
| Disk | `--sysinfo-net-color` (shared with network) |

## Remote Monitoring

Sysinfo supports monitoring remote hosts connected via SSH. When you have an active SSH connection:

1. The `wsh` binary on the remote host collects system metrics
2. Metrics are streamed back through the SSH tunnel
3. The Sysinfo pane subscribes to events scoped to that connection

Remote and local metrics are kept separate — you can have multiple Sysinfo panes, each monitoring a different host.

## See Also

- [Pane Types](/pane-types) — Sysinfo pane overview
- [Configuration](/config) — Settings that affect sysinfo display
- [Interpane Communication](/interpane-comms) — Event system for metric streaming
