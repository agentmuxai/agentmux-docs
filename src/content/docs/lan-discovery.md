---
title: LAN discovery
description: How AgentMux instances on the same network discover each other via mDNS, how to enable it, and what to expect on Windows.
---

:::caution[Alpha Software]
AgentMux is in **early alpha** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

AgentMux instances can **discover each other on the local network** using [mDNS / DNS-SD](https://en.wikipedia.org/wiki/Multicast_DNS) — the same zero-config protocol Bonjour, AirPlay, and printer discovery use. Once enabled, every AgentMux running on your LAN appears in the [Warden widget](/warden/)'s LAN section and in the HostPopover, along with its hostname and version.

LAN discovery is opt-in, off by default, and live-toggleable from the status bar. As of v0.46, it enables both peer *visibility* (seeing what's on your LAN) and **LAN jekt forwarding** (routing `SendMessage` calls directly to agents on peer instances without going through the cloud relay).

## What it does

When enabled, your AgentMux instance:

- Advertises itself on the LAN under the mDNS service `_agentmux._tcp.local.` with TXT records containing the **hostname**, **version**, and a unique **instance ID**
- Continuously browses the LAN for peer instances of the same service
- Broadcasts the live peer list to the frontend so the Warden and HostPopover update within seconds of a peer appearing or leaving

What it does *not* do:

- Enforce any policy on peers
- Share workspace state across instances

## Enable it

The toggle lives in the **HostPopover** — click the hostname chip in the bottom-right status bar.

```
┌─ desk-mac.local ────────────────────────┐
│ OS    Windows 11                        │
│ IP    192.168.1.42                      │
│ ─────────────────────────────────────── │
│ Instance  a3f9-…                        │
│ ...                                     │
│ ─────────────────────────────────────── │
│ LAN discovery       [ on  🟢 ]          │
│ ◆ 2 peers                               │
│   pi-lab          v0.38.2               │
│   asaf-laptop     v0.38.4               │
│ ─────────────────────────────────────── │
│ ...                                     │
└─────────────────────────────────────────┘
```

Flipping the toggle writes `network:lan_discovery: true` to `settings.json` and starts the mDNS daemon **live** — no restart needed. Flipping it off stops the daemon and clears the peer list.

If you'd rather edit the file directly, set `"network:lan_discovery": true` in `~/.agentmux/config/settings.json`. The change picks up on the next AgentMux restart (the in-app toggle is the only path that takes effect immediately).

## Windows Firewall

On the first enable, **Windows Firewall will prompt** you to allow AgentMux on the network. This is expected — mDNS binds UDP port 5353 on `0.0.0.0` (all interfaces), which is a network-facing operation that Windows always asks about.

Click **Allow access** for both Private and Public networks (Public is what most home/office LANs are tagged as on Windows). If you click Block:

- The daemon fails to register
- The HostPopover shows `⚠ Blocked — check firewall settings`
- Flip the toggle off, fix the firewall rule in `wf.msc` (`Allow an app through firewall → Change settings → find AgentMux → tick both networks`), then flip the toggle back on

This prompt only fires on the first enable per Windows user profile. Subsequent toggles reuse the rule.

## Why it's opt-in

The mDNS daemon binds a socket on a network-facing interface, which is exactly the kind of thing Windows Firewall flags on first run. Shipping the feature **off by default** means a fresh install of AgentMux never surprises you with a firewall prompt during normal use. Power users who want the feature opt in once; everyone else never sees it.

This is a deliberate trade-off — see the [Network exposure](/security/network-exposure/) page for the full security framing.

## Privacy considerations

When enabled, your instance broadcasts on the LAN:

- **Hostname** (whatever your OS hostname is — `claudius`, `Macbook-Pro`, etc.)
- **AgentMux version** (e.g. `0.38.3`)
- **A random instance ID** (regenerated each launch, not a stable user identifier)

It does **not** broadcast:

- Agent IDs, working directories, files, or any in-app content
- Cookies, credentials, or auth state
- The list of running agents on this instance

If you're on a network where you'd rather not advertise even those three fields (a coffee-shop Wi-Fi, a conference network, a shared office VLAN you don't trust), leave the toggle off. mDNS broadcasts are limited to the local broadcast domain — they don't escape your subnet or reach the public internet.

## Multiple instances on the same host

mDNS also works over the **loopback interface**, so two AgentMux instances running on the *same* machine (e.g. a portable v0.38.3 alongside a `task dev` build) discover each other too. Both register their own service entries, both browse, both see the other in the peer list. The Warden's LAN section treats them as ordinary peers — same row schema, distinguished by their instance IDs and versions.

## Same-network setup

For the LAN section to populate, you need:

1. **mDNS toggle on** on both instances (see above)
2. **Same subnet / broadcast domain** — most home and office networks satisfy this by default
3. **mDNS not blocked at the network layer** — some corporate networks and many VPNs filter UDP:5353; if so, your instances bind locally but won't see each other across machines

When in doubt, check the HostPopover or Warden's LAN section. If a peer is missing, the most common causes are: firewall (yours or the peer's), VPN / VLAN isolation, or mDNS disabled on one side.

## What's next

LAN jekt forwarding shipped in v0.46. Future phases will:

- Wire the [Warden widget](/warden/) to issue cross-instance enforcement actions (quarantine, policy push)
- Add an embedded MCP server so agents talk to the local AgentMux directly, bypassing the Node-based `@a5af/agentbus-client` for local/LAN cases

For the design details, see [LAN discovery (internals)](/internals/lan-discovery/) and the [`SPEC_WARDEN_WIDGET_2026-05-25.md`](https://github.com/agentmuxai/agentmux/blob/main/specs/SPEC_WARDEN_WIDGET_2026-05-25.md) spec in the main repo.

## See also

- [Warden widget](/warden/) — the operator surface that renders the LAN peer list
- [Network exposure](/security/network-exposure/) — security framing
- [Running multiple instances](/multi-instance/) — multiple AgentMux processes side by side
- [LAN discovery (internals)](/internals/lan-discovery/) — mDNS module, controller, hostname normalization
