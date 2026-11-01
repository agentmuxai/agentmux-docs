---
title: LAN discovery
description: How AgentMux instances on the same network discover each other via mDNS, what turning it on exposes, how to enable it, and what to expect on Windows.
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

AgentMux instances can **discover each other on the local network** using [mDNS / DNS-SD](https://en.wikipedia.org/wiki/Multicast_DNS), the zero-configuration protocol behind Bonjour and printer discovery. With it on, every AgentMux on your LAN appears in the status bar's network pill (the host popover), with its hostname and version, and agents can send messages directly to agents on those machines and, once the machines trust each other, [do things there](#remote-operations). Click a peer's row for its address and port, operating system and channel, its agents and when it was last seen: see [the network pill](#the-network-pill).

LAN discovery is **off by default** and can be switched on and off live from the status bar.

## What turning it on does

While LAN discovery is on, your instance:

- **opens its API to the network.** The AgentMux server binds its two ports on every non-loopback address of the machine (IPv4, and IPv6 except link-local), in addition to loopback. These listeners serve the full server API, protected by the instance's keys;
- **advertises itself** as mDNS service `_agentmux._tcp.local.`. The record carries the hostname, the AgentMux version, an instance id (`v` plus the version), the server's port and IP addresses, and the instance's **`lan_key`**;
- **answers discovery probes** on UDP port 47891 from private and link-local addresses, replying with the same details and the same `lan_key`;
- **browses for peers** and keeps the peer list up to date in the network pill;
- **asks every peer for its agent names** every 30 seconds, so you can see which agents live where;
- **checks that an agent isn't already running on another computer**: before an agent starts, and every 30 seconds while it runs, it asks each peer whether it is running that agent. If one is, the agent isn't started here, or, if both are running it, the later start is stopped. See [one live instance per agent](/security/trust-model/#one-live-instance-per-agent);
- **forwards messages**: a `Message` `send` to an agent that isn't on this machine is tried on the LAN peers before MuxBus Cloud;
- **carries out [remote operations](#remote-operations)**: signed, typed requests from agents on peers it has proven;
- **keeps fleet-scoped [Global Memory](/memory/#global-memory-across-machines) in step** with the peers it has proven: within about 15 seconds of a change, and again for a peer that comes back after being offline.

What it does not do: enforce any policy on peers, or share workspace state between instances beyond that.

## What the `lan_key` allows

The `lan_key` is sent in cleartext, so **treat it as known to every device on the network.** It is a separate key from the instance's full auth key and opens only a short list of routes. With it, anyone on the LAN can:

- send a message into any of your agents' conversations, with files if the message carries a valid signature. The message is marked `DELIVERY=lan` and, unless it carries a valid signature, `TRUST=network-claimed`; it is not flagged sensitive unless its content triggers that;
- list your agents' names, with each agent's state and, unless you turn that off (see [Swarm summary lines](#swarm-summary-lines)), its one-line summary of what it's working on, and look up one agent's registration details and public signing key;
- ask whether a given agent is running on this machine, and since when;
- send a request for a [remote operation](#remote-operations). The key only gets the request to the door: the operation runs only if the request is signed by an agent key this machine has pinned. A request with just the `lan_key` is refused.

Answers from peers aren't authenticated either: a device that pretends to be a peer and claims to be running one of your agents can keep that agent from starting here, or stop it.

It can't reach anything else in the API. The `lan_key` is regenerated each time AgentMux starts. See [Network exposure](/security/network-exposure/#lan-listeners) and [Reactive event bus](/security/reactive-event-bus/#who-may-call-the-bus) for the details.

## Enable it

Click the hostname in the status bar to open the host popover, and flip the **LAN discovery** toggle. The popover then lists the peers found (see [The network pill](#the-network-pill)), or says `Searching for peers…`.

![The host popover with LAN discovery switched off, and Pair a device](../../assets/screenshots/chrome/chrome-status-host.png)

The toggle writes `"network:lan_discovery": true` to `settings.json` and starts discovery and the LAN listeners **immediately**, with no restart. Turning it off stops advertising, closes the LAN listeners and clears the peer list.

You can also set `"network:lan_discovery": true` in `settings.json` by hand (`~/.agentmux/channels/settings.json` on the stable channel). A hand edit takes effect at the next start of AgentMux; only the toggle applies immediately.

## The network pill

The hostname in the status bar is the network pill: its glyph shows where LAN discovery stands, and its popover lists the peers. A filled ◆ means peers were found, and its tooltip reads "*n* on LAN". An empty ◇ means one of:

| Tooltip | Meaning |
|---|---|
| LAN discovery off | Click to enable it |
| LAN discovery on, no peers found | Nothing else is out there yet |
| LAN discovery failed | The discovery service could not start; the reason follows |
| Other machines can't see this one | This computer hears peers but is not announced on any address, often because another program holds the mDNS port (UDP 5353). AgentMux retries on its own; turning LAN off and on retries at once |
| Windows Firewall, or the network, blocks incoming connections | On Windows: a Block rule or "Block all incoming connections", no rule that lets other devices in (see [Windows Firewall](#windows-firewall)), a network marked Public, or a firewall your administrator manages. Peers may still show, but they can't reach this computer |

With discovery on, each AgentMux found on your network is a row in the popover. Click a row to expand it:

| Row | What |
|---|---|
| **Address** | The peer's IP address and port |
| **Runs** | Its operating system and channel |
| **Agents** | How many agents it has, with **Show in Swarm** |
| **Last seen** | How long ago the peer was last seen |

A peer whose agent sent a message that was refused because its key changed has a warning on its row, with **Review in Settings › Devices › Pinned senders**. Accepting a new key stays in Settings, beside its explanation. The pill doesn't change a peer's trust by itself, and has no control to send to or quarantine a peer: agents send with the `Message` tool.

## Pairing the mobile app

With LAN discovery on, the host popover has **Pair a device** (it is disabled while discovery is off). It shows a QR code for the AgentMux mobile app. The code holds a one-time pairing code and the fingerprint of this computer's certificate, never the instance's auth key or the `lan_key`. It works once, for two minutes (the popover counts it down); **New code** cancels it and shows another, **Copy link** copies the same pairing as a link for another AgentMux computer's Tower, and **Hide** removes it. A wrong code is refused: five wrong tries from one address in a minute lock that address out for the minute, and ten wrong in a row cancel every code on show.

Show the code only to your own devices: whoever redeems it watches this computer's agents, read-only (see below). When a device pairs, the popover says "Paired *name*. Settings › Paired devices lists it."

## What a paired device can see

A device paired with this computer (the AgentMux mobile app) watches it, read-only. Settings ▸ **Paired devices** lists the paired devices, and you can revoke each one there.

- **Its panes.** The device can list every pane on this computer, window by window and tab by tab: agents, by the name their live feed opens by; terminals, including each agent's shell, and whether they are running; and every other pane by name.
- **Agents' live feeds.** A feed keeps following an agent after it restarts in another pane, and shows lines that another pane or another AgentMux instance adds to the agent's conversation.
- **Terminals, only if you allow it.** Turn on **Share terminals with paired devices** (`viewer:shareterminals`) and a paired device can watch this computer's terminals, read-only and live. It's off by default, because terminals often show passwords and keys. Turning it off closes any terminal a device is watching.

An agent you hide from paired devices is left out of the list and can't be watched. Its shell stays hidden too, even with terminal sharing on. Hide an agent in **Settings ▸ Paired devices ▸ Hidden from devices**: choose it under **Choose an agent…** and click **Add agent**; **Remove** shows it again.

### Publish this computer to my devices

While you are signed in to MuxBus Cloud, this computer tells the cloud it is online, so your signed-in devices can list it from anywhere, not only on your network. The setting is **Settings ▸ Paired devices ▸ Publish this computer to my devices** (`cloud:publishpresence`), on by default.

Your devices see this computer go offline at once when you quit AgentMux, sign out of MuxBus Cloud or turn the setting off. Dev builds, headless installs and isolated homes never publish, whatever the setting says, and Settings says why.

### Swarm summary lines

The [Swarm](/subagent-watcher/) shows agents running in this computer's other AgentMux instances (other channels) and on LAN peers, each with its status. By default it also shows each agent's one-line summary of what it is working on. Your signed-in devices see the same lines, over the cloud and on the local network.

The summaries go out through the same route as your agents' names, so anyone on your network who has the `lan_key` can read them. To share status only, turn off **Settings ▸ Paired devices ▸ Share what my agents are working on** (`swarm:sharesummaries`).

## Remote operations

With LAN discovery on, an agent can do on another machine what it can do on its own, without a person's agent over there having to read a message and act. It names the machine in a `host` argument of the [`Agents`, `Tasks`, `Identity` and `App` tools](/internals/muxapi/#acting-on-another-machine): start, open or stop an agent there, set its seat or environment, file a task on its board or read it, list or switch its accounts and start a sign-in, read its version, health and logs, and ask it to reclaim its pane-history store.

Your AgentMux signs each request with the asking agent's own key, and the other machine carries the operation out itself. The other machine decides, with its own rules:

- **Who may ask.** Only an agent whose key this machine has pinned, on a request meant for this machine and sent within the last minute. The broadcast `lan_key` never authorizes one.
- **How far it is trusted.** Reading a version or the health report needs only the pinned key. Anything that changes something, or reads personal data (account emails, the task board, Global Memory entries, logs), also needs this machine to trust the install the agent runs on: it has pinned a key from that install for an agent, or both machines are signed in to the same MuxBus Cloud account and the account lists that install. A peer this machine has only seen for the first time is refused with a message that says to approve it.
- **The same rules as a local call.** What is sensitive on this machine goes through its super agent and its countdown, shown on this machine's screen. An agent stopped from afar gets the same keep-running window its user would get for a local stop.
- **A record on both machines.** Each machine writes an audit row under `agent@machine`, never the operator: `remote.request` on the asking machine, `remote.<operation>` here, with how the request was proven and how it ended. Requests refused before their signature checked out leave one row a minute per address. They show in the [Audit](/audit/) pane.
- **An off switch.** Set `"network:remote_ops": false` in `settings.json` and this machine refuses every typed request. It is on by default, and applies without a restart.

Remote operations travel over the LAN only: a peer has to be found by LAN discovery, on both machines.

## Messages between machines

A message sent to an agent on another machine on your network arrives as `DELIVERY=lan`, marked `TRUST=lan-verified` when the sender's signature checks out. A verified message can carry files (up to 50 MB each and 100 MB in all). If the agent it is for is signed out or out of quota, a verified message is held on the receiving machine for up to 24 hours, with its files, and delivered with its original trust when the agent can work, as a message from that machine's own agents would be; see [Durable hold](/internals/jekt-protocol/#44-durable-hold). A message that isn't verified is refused instead, with a reason the sender can read. The answer to `Message` `send` says which happened.

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
- the **`lan_key`**, and through it the **names of your agents**, which of them are running, and, unless you turn off `swarm:sharesummaries`, each agent's one-line summary.

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
- [Running multiple instances](/multi-instance/): multiple AgentMux processes side by side
- [LAN discovery (internals)](/internals/lan-discovery/): the mDNS module, listeners and live toggle
