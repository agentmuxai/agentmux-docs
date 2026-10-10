---
title: "Widget API reference"
description: "The AgentMux widget API: the widget.json manifest, the widget SDK's methods and events, permissions, errors and limits."
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

Everything a sandboxed widget can use. For a first widget, start with [Build a widget](/build-a-widget/). The SDK's [`v1.d.ts`](https://github.com/agentmuxai/agentmux/blob/main/sdk/widget-sdk/v1.d.ts) has the same API as TypeScript types.

## The package

A widget is a folder named for its id, holding `widget.json` and the widget's files. At most 50 MB and 2,000 files, with no symbolic links.

### widget.json

```json
{
  "manifestVersion": 1,
  "id": "acme.pr-dashboard",
  "name": "PR Dashboard",
  "version": "1.2.0",
  "description": "Open pull requests across your repos",
  "author": "Acme",
  "homepage": "https://example.com/pr-dashboard",
  "icon": "code-pull-request",
  "defaultHue": 210,
  "kind": "sandboxed",
  "entry": "index.html",
  "permissions": ["storage", "net:https://api.github.com"],
  "contributes": {
    "panes": [{ "name": "main", "label": "PRs", "icon": "code-pull-request", "entry": "index.html" }]
  }
}
```

| Field | Required | Meaning |
|---|---|---|
| `manifestVersion` | yes | The package format: `1`. |
| `id` | yes | `<publisher>.<name>`: lowercase letters, digits and `-`, one dot, at most 64 characters. Must equal the folder name. |
| `name` | yes | Shown in the install prompt and Settings; at most 60 characters. |
| `version` | yes | Semver, e.g. `1.2.0`. |
| `description` | no | At most 300 characters. |
| `author`, `homepage` | no | Shown in the prompt. `homepage` must be an `https://` link. |
| `icon` | no | A [Font Awesome](https://fontawesome.com/icons) icon name. |
| `defaultHue` | no | The pane color's hue, 0 to 359. |
| `kind` | no | `sandboxed` (the default) or `trusted`. |
| `entry` | no | The page a pane loads when it names none: `index.html` by default. |
| `permissions` | no | What it asks for (below). An unknown permission makes the package invalid. |
| `contributes.panes` | yes | At least one. Each: `name` (lowercase letters, digits and `-`), `label`, and optionally `icon`, `entry`, and `defaultMeta` (a new pane's initial state, keys written `widget:<id>:<key>`). |

Each pane is a view named `ext:<id>/<name>`, for example `ext:acme.pr-dashboard/main`, and an entry in the widget bar's **more** menu.

### Permissions

| Permission | Lets the widget |
|---|---|
| `storage` | Keep its own data on this computer |
| `net:<origin>` | Make HTTP requests to that origin: `net:https://api.github.com` allows exactly that origin; `net:https://*.example.com` allows its subdomains (never the bare domain, never a lone `*`) |
| `files` | Open files the user picks, and save files where the user chooses |
| `clipboard:write` | Copy text to the clipboard |
| `panes` | Open views other than its own |
| `agents:read` | List the user's agents and whether they're working |
| `agents:send` | Send messages to the user's agents |

A **private or local address** (loopback, your network, link-local) is reachable only through a permission that names that address itself, port included: an IP address (`net:http://127.0.0.1:8188`) or `localhost` (`net:http://localhost:3000`). A public name that resolves to a private address is refused, and so is a wildcard.

## Connecting

```html
<link rel="stylesheet" href="/agentmux/widget-sdk/am-widget.css" />
<script type="module">
  import { connect } from "/agentmux/widget-sdk/v1.js";
  const am = await connect();
</script>
```

`connect({ applyTheme = true, timeoutMs = 10000 })` performs the handshake and resolves to the client. It applies the app's theme as CSS variables on the document and keeps them current. `am-widget.css` styles plain HTML with them. It rejects if the page isn't running inside AgentMux, or if AgentMux doesn't connect in time.

`am.info` holds what the handshake returned:

| Field | |
|---|---|
| `widget` | `{ id, version, pane }`: this widget, and which of its panes this is |
| `agentmux` | `{ version, host }` |
| `permissions` | The permissions the user granted |
| `theme` | The current theme (below) |
| `meta` | This pane's state |
| `visibility`, `focused` | Whether the pane is shown, and whether it has focus |

## Methods

Every method returns a promise. A refused call rejects with an `AgentMuxError` (see Errors). `am.call(method, params)` calls any method by name, including ones this SDK version has no wrapper for.

### The pane

| Method | Permission | |
|---|---|---|
| `am.meta.get()` | | This pane's own state, an object |
| `am.meta.set(patch)` | | Merges `patch` into it; a `null` value deletes a key. At most 64 KB per pane. It's kept with the pane: it survives restarts and moves with the pane, and each pane of the widget has its own |
| `am.ui.setTitle(text, icon?)` | | The pane's tab title (at most 200 characters) |
| `am.ui.setHeaderActions(actions)` | | Up to 4 buttons in the pane's header, `{ id, icon, title }`; a click is the `action` event |
| `am.ui.setContextMenu(items)` | | Up to 20 items in the pane's menu, `{ id, label, disabled? }` or `{ separator: true }`; a click is the `action` event |
| `am.ui.toast(text, kind?)` | | A notification under the widget's name; `kind` is `info`, `success`, `warning` or `error` |
| `am.ui.openUrl(url)` | | Opens an `http`/`https` link in a browser pane next to the widget |
| `am.theme.get()` | | The current theme |
| `am.panes.open(view, meta?, split?)` | `panes`, except for the widget's own views | Opens a pane; `split` is `right` (default), `down` or `tab` |

### Storage

Needs `storage`. Per widget (shared by all its panes, in every window), not per pane. Values are anything JSON can hold.

| Method | |
|---|---|
| `am.storage.get(key)` | The value, or `null` |
| `am.storage.set(key, value)` | Keys up to 256 bytes, values up to 1 MB, at most 5 MB per widget |
| `am.storage.delete(key)` | |
| `am.storage.list(prefix?)` | The keys, sorted, optionally only those starting with `prefix` |

Uninstalling a widget deletes its storage. A change from any pane sends every pane of the widget the `storage` event.

### Network

`am.net.fetch(url, { method, headers, body, timeoutMs })` needs a `net:` permission for the URL's origin. AgentMux makes the request, not the widget's page. That means no cookies, no browser session, and no proxy.

- Every redirect must also be to a granted origin (at most 5 redirects).
- The connection's own headers (`Host`, `Content-Length`, `Connection`, `Transfer-Encoding`, `Proxy-*` and the like) can't be set.
- `body` is a string, a `Uint8Array` or an `ArrayBuffer`.
- Request and response bodies are limited to 10 MB each. The timeout defaults to 30 seconds, at most 120.

The result has `status`, `statusText`, `headers`, `url` (after redirects), `ok`, and `text()`, `json()` and `bytes()`.

The widget's page itself can't make network requests: `fetch` and the like are blocked in it.

### Files and the clipboard

| Method | Permission | |
|---|---|---|
| `am.files.pick({ accept?, multiple? })` | `files` | Opens the file dialog. Resolves to the chosen files' `{ name, type, size, dataBase64, bytes() }`, never their paths, up to 25 MB in all. Rejects `cancelled` if the user cancels. Call it from a click (in the widget or on one of its header actions): a dialog doesn't open otherwise |
| `am.files.save(name, data, type?)` | `files` | Opens the save dialog with `data` (a string or bytes, up to 25 MB). Resolves `false` if the user cancels |
| `am.clipboard.writeText(text)` | `clipboard:write` | Up to 1 MB of text |

### Agents

| Method | Permission | |
|---|---|---|
| `am.agents.list()` | `agents:read` | The agents running on this computer: `{ id, name, state }`, `state` being `working`, `idle` or `stopped` |
| `am.agents.send(agent, text)` | `agents:send` | Delivers `text` to that agent, marked as sent by the widget (`widget:<id>`) and unverified, so the agent treats it like any message whose sender it can't check. At most 8 KB, 10 messages a minute. Resolves to the message id |

## Events

`am.on(event, callback)` returns a function that stops listening.

| Event | Params | When |
|---|---|---|
| `visibility` | `{ state }`: `active`, `dormant` or `windowHidden` | The pane is shown, hidden behind another tab, or its window is minimized |
| `focus` | `{ focused }` | The pane gains or loses focus |
| `theme` | the theme | The user changes the theme or the pane's color |
| `meta` | `{ meta }` | The pane's state changed from outside the widget (another window, an undo) |
| `action` | `{ id, source }`: `header` or `menu` | The user clicked one of its header actions or menu items |
| `storage` | `{ keys }` | The widget's storage changed, from any of its panes in any window |
| `dispose` | `{}` | The pane is closing or the widget reloading; the connection closes a second later |

A hidden pane keeps running, so pause timers and polling while it's dormant:

```js
import { useVisibility } from "/agentmux/widget-sdk/v1.js";
useVisibility(am, { onActive: startPolling, onDormant: stopPolling });
```

## The theme

`{ mode, vars }`: `mode` is `dark` or `light`. `vars` are CSS custom properties, set on the document by `connect()`:

`--am-bg`, `--am-fg`, `--am-muted`, `--am-accent`, `--am-border`, `--am-error`, `--am-warning`, `--am-success`, `--am-font`, `--am-font-mono`, `--am-radius`, and the pane's hue as `--am-pane-hue`.

## Errors

A refused call rejects with an `AgentMuxError`, which has a `code`, a `name`, a `message` and sometimes `data`:

| Code | Name | When |
|---|---|---|
| 1001 | `permission_denied` | The widget wasn't granted what the method needs; `data.permission` names it |
| 1002 | `limit_exceeded` | A size, count or rate limit; `data.limit` names it |
| 1003 | `not_found` | An unknown agent, view or key |
| 1004 | `network_error` | `net.fetch` failed before a response: DNS, refused, timeout, a redirect it may not follow |
| 1005 | `unavailable` | AgentMux can't do it here, or the widget changed or was turned off (reload it) |
| 1006 | `cancelled` | The user cancelled a dialog |
| 1007 | `not_ready` | A call before the handshake |
| 1099 | `internal` | AgentMux failed; `message` says how |
| -32601, -32602 | `method_not_found`, `invalid_params` | An unknown method, or wrong parameters |

## Versions

The protocol is version 1. Within it, AgentMux only adds: new methods, new optional parameters, new fields in results, new events. A widget should ignore fields it doesn't know. `am.info.agentmux.version` says which AgentMux it runs in, and an unknown method rejects with `method_not_found`.
