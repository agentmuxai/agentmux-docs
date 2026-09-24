---
title: LAN discovery
description: How AgentMux instances on the same network discover each other via mDNS, what turning it on exposes, how to enable it, and what to expect on Windows.
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

AgentMux instances can **discover each other on the local network** using [mDNS / DNS-SD](https://en.wikipedia.org/wiki/Multicast_DNS), the zero-configuration protocol behind Bonjour and printer discovery. With it on, every AgentMux on your LAN appears in the [Warden widget](/warden/)'s LAN section and in the host popover, with its hostname and version, and agents can send messages directly to agents on those machines.

LAN discovery is **off by default** and can be switched on and off live from the status bar.

## What turning it on does

While LAN discovery is on, your instance:

- **opens its API to the network.** The AgentMux server binds its two ports on every non-loopback address of the machine (IPv4, and IPv6 except link-local), in addition to loopback. These listeners serve the full server API, protected by the instance's keys;
- **advertises itself** as mDNS service `_agentmux._tcp.local.`. The record carries the hostname, the AgentMux version, an instance id (`v` plus the version), the server's port and IP addresses, and the instance's **`lan_key`**;
- **answers discovery probes** on UDP port 47891 from private and link-local addresses, replying with the same details and the same `lan_key`;
- **browses for peers** and keeps the peer list up to date in the Warden and the host popover;
- **asks every peer for its agent names** every 30 seconds, so you can see which agents live where;
- **forwards messages**: a `SendMessage` to an agent that isn't on this machine is tried on the LAN peers before MuxBus Cloud.

What it does not do: enforce any policy on peers, or share workspace state between instances.

## What the `lan_key` allows

The `lan_key` is sent in cleartext, so **treat it as known to every device on the network.** It is a separate key from the instance's full auth key and opens only three routes. With it, anyone on the LAN can:

- send a message into any of your agents' conversations. The message is marked `DELIVERY=lan` and, unless it carries a valid signature, `TRUST=network-claimed`; it is not flagged sensitive unless its content triggers that;
- list your agents' names, and look up one agent's registration details and public signing key.

It can't reach anything else in the API. The `lan_key` is regenerated each time AgentMux starts. See [Network exposure](/security/network-exposure/#lan-listeners) and [Reactive event bus](/security/reactive-event-bus/#who-may-call-the-bus) for the details.

## Enable it

Click the hostname in the status bar to open the host popover, and flip the **LAN discovery** toggle. The popover then shows the number of peers found and each peer's hostname and version, or `Searching for peers…`.

The toggle writes `"network:lan_discovery": true` to `settings.json` and starts discovery and the LAN listeners **immediately**, with no restart. Turning it off stops advertising, closes the LAN listeners and clears the peer list.

You can also set `"network:lan_discovery": true` in `settings.json` by hand (`~/.agentmux/channels/settings.json` on the stable channel). A hand edit takes effect at the next start of AgentMux; only the toggle applies immediately.

## Pairing the mobile app

With LAN discovery on, the host popover offers **Show QR code**, for pairing the AgentMux mobile app. The QR code contains this machine's LAN address, the server port, and **the instance's full auth key**, not the `lan_key`. Anyone who scans or photographs it can control this AgentMux instance over the network, with the same power as the app itself, until AgentMux restarts. Show it only to the device you are pairing.

## Windows Firewall

The first time you turn LAN discovery on, **Windows Firewall asks** whether to allow AgentMux on the network, because it opens network-facing sockets.

- Allow it on **Private** networks, and make sure your home or office network is classed as Private in Windows.
- Don't allow it on **Public** networks unless you want the LAN listeners reachable from coffee-shop and conference Wi-Fi.

If you block it, peers can't reach your instance. The host popover shows the error in the LAN section if discovery fails to start. To change your answer later: turn the toggle off, edit the rule in Windows Defender Firewall (`Allow an app through firewall`), then turn the toggle back on.

## Why it's off by default

Turning it on exposes the server to the network, broadcasts a key that lets anyone on the LAN message your agents, and triggers a firewall prompt on Windows. Leaving it off means a fresh install never does any of that. See [Network exposure](/security/network-exposure/) for the full picture.

## Privacy considerations

While it's on, anyone on your broadcast domain learns:

- your machine's **hostname** and IP addresses;
- the **AgentMux version** and the server's port;
- the **`lan_key`**, and through it the **names of your agents**.

The broadcast carries no conversation content, files, or credentials other than the `lan_key`.

mDNS and the UDP probe replies stay on your local network, but the LAN listeners bind every non-loopback address, including globally routable IPv6 addresses and VPN adapters. On a network you don't trust (public Wi-Fi, a conference network, a shared office VLAN), leave LAN discovery off.

## Multiple instances on the same machine

Two instances on the same machine that both have LAN discovery on see each other as LAN peers: they share addresses but not ports. They don't need it to message each other, though. Instances on the same machine reach each other's agents through a local registry, whether or not LAN discovery is on. See [Running multiple instances](/multi-instance/).

## Same-network setup

For peers to appear, you need:

1. **LAN discovery on** on both instances.
2. **The same subnet or broadcast domain.** Most home and office networks satisfy this.
3. **mDNS not blocked by the network.** Some corporate networks and many VPNs filter UDP 5353. The UDP probe on port 47891 is a fallback used by the mobile app.
4. **Each peer's firewall allowing the connection.**

If a peer is missing, the usual causes are a firewall (yours or the peer's), VPN or VLAN isolation, or LAN discovery being off on one side.

## See also

- [Network exposure](/security/network-exposure/): every listener and what it accepts
- [Warden widget](/warden/): the operator surface that shows LAN peers
- [Running multiple instances](/multi-instance/): multiple AgentMux processes side by side
- [LAN discovery (internals)](/internals/lan-discovery/): the mDNS module, listeners and live toggle
