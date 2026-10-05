---
title: "Keybindings"
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

The same list is in the app: press F1, or open the Help pane. A terminal keeps every key for the shell except the window, tab and pane shortcuts below, and on Windows and Linux no global shortcut uses Alt+letter, so in a terminal those always reach the shell.

## General

| Action | macOS | Windows / Linux |
|---|---|---|
| Command palette | ⇧⌘P, ⌘P | Ctrl+Shift+P, Ctrl+P |
| Settings | ⌘, | Ctrl+, |
| Keyboard shortcuts | ⌘/, F1 | Ctrl+/, F1 |
| Voice input | ⌃⇧V | Ctrl+Shift+V |
| Close dialog or find bar | Esc | Esc |

## Tabs & windows

| Action | macOS | Windows / Linux |
|---|---|---|
| New window | ⇧⌘N | Ctrl+Shift+N |
| New tab | ⌘T | Ctrl+Shift+T |
| Close tab | ⇧⌘W | Ctrl+Alt+Shift+W, Ctrl+F4 |
| Next tab | ⌘], ⇧⌘], ⌃Tab | Ctrl+Shift+], Ctrl+Tab |
| Previous tab | ⌘[, ⇧⌘[, ⌃⇧Tab | Ctrl+Shift+[, Ctrl+Shift+Tab |
| Go to tab 1–8 | ⌘1–8 | Ctrl+1–8 |
| Go to last tab | ⌘9 | Ctrl+9 |
| Move tab left | ⇧⌘PgUp | Ctrl+Alt+Shift+PgUp |
| Move tab right | ⇧⌘PgDn | Ctrl+Alt+Shift+PgDn |
| Rename tab | F2 | F2 |

## Panes

| Action | macOS | Windows / Linux |
|---|---|---|
| New pane | ⌘N | Ctrl+Shift+` |
| New agent pane | ⇧⌘A | Ctrl+Shift+A |
| Split right | ⌘D | Ctrl+Shift+D |
| Split below | ⇧⌘D | Ctrl+Alt+Shift+D |
| Split in a direction | ⌃⇧S then ↑/↓/←/→ | Ctrl+Shift+S then ↑/↓/←/→ |
| Close pane | ⌘W | Ctrl+Shift+W |
| Maximize pane | ⌘M | Ctrl+Shift+M |
| Focus pane by direction | ⌃⇧↑/↓/←/→ | Ctrl+Shift+↑/↓/←/→ |
| Next pane | F6 | F6 |
| Previous pane | ⇧F6 | Shift+F6 |
| Focus pane 1–9 | ⌃⇧1–9 | Ctrl+Shift+1–9 |
| Swap pane with neighbour | ⌃⌥⇧↑/↓/←/→ | Ctrl+Alt+Shift+↑/↓/←/→ |
| Resize pane | ⌃⌥⌘↑/↓/←/→ | Alt+Shift+↑/↓/←/→ |
| Refocus pane | ⌘I | — |
| Focus the message box | ⌘L | Ctrl+L |
| Replace pane with launcher | ⌃⇧K | Ctrl+Shift+K |
| Change connection | ⇧⌘G | Ctrl+Shift+G |

## Find & zoom

| Action | macOS | Windows / Linux |
|---|---|---|
| Find in pane | ⌘F | Ctrl+F, Ctrl+Shift+F (in a terminal) |
| Zoom in | ⌘=, ⇧⌘= | Ctrl+=, Ctrl+Shift+= |
| Zoom out | ⌘-, ⌘Num- | Ctrl+-, Ctrl+Num- |
| Reset zoom | ⌘0, ⌘Num0 | Ctrl+0, Ctrl+Num0 |
| Reset zoom on all panes | ⇧⌘0 | Ctrl+Shift+0 |

## Terminal

| Action | macOS | Windows / Linux |
|---|---|---|
| Type into all terminals | ⇧⌘M | Ctrl+Alt+Shift+M |
| Clear | ⌘K | Ctrl+Shift+L |
| Copy | — | Ctrl+Shift+C |
| Paste | — | Ctrl+Shift+V |

## Documents

| Action | macOS | Windows / Linux |
|---|---|---|
| New document tab | ⌃T | Ctrl+T |
| Close document tab | ⌃W | Ctrl+W |
| Reopen closed document | ⌃⇧T | Ctrl+Shift+T |
| Next document | ⌃Tab, ⌃PgDn | Ctrl+Tab, Ctrl+PgDn |
| Previous document | ⌃⇧Tab, ⌃PgUp | Ctrl+Shift+Tab, Ctrl+PgUp |
| Move document right | ⌃⇧PgDn | Ctrl+Shift+PgDn |
| Move document left | ⌃⇧PgUp | Ctrl+Shift+PgUp |

## Editor

| Action | macOS | Windows / Linux |
|---|---|---|
| Save | ⌘S | Ctrl+S |
| Save as (scratch documents) | ⇧⌘S | Ctrl+Shift+S |
| Find and replace | ⌘F | Ctrl+F |
| Toggle markdown preview | ⇧⌘V | Ctrl+Shift+V |

## Files

| Action | macOS | Windows / Linux |
|---|---|---|
| Back | ⌥← | Alt+← |
| Forward | ⌥→ | Alt+→ |
| Up a folder | ⌥↑ | Alt+↑ |
| Open in new tab | ⌘Enter | Ctrl+Enter |
| New tab here | ⌘T | Ctrl+T |
| Close this tab | ⌘W | Ctrl+W |
| Type a path | ⌘L | Ctrl+L |
| Filter | ⌘F | Ctrl+F |
| New folder | ⇧⌘N | Ctrl+Shift+N |
| Rename | F2 | F2 |
| Refresh | F5 | F5 |
| Move to Trash | Delete | Delete |
| Delete permanently | ⇧Delete | Shift+Delete |
| Select all | ⌘A | Ctrl+A |
| Copy | ⌘C | Ctrl+C |
| Cut | ⌘X | Ctrl+X |
| Paste | ⌘V | Ctrl+V |
| Undo | ⌘Z | Ctrl+Z |
| Mention in agent | ⌥K | Alt+K |

## Your own shortcuts

Add a `keybindings` list to your settings file (command palette → Open Settings File). Your entries come before the defaults, so they win, and they apply as soon as you save.

```json
"keybindings": [
    { "key": "ctrl+shift+e", "command": "split:right" },
    { "command": "-tab:new" },
    { "key": "ctrl+Tab", "command": "-tab:next" },
    { "key": "meta+k", "command": "term:clear", "platform": "mac", "when": "terminalFocus" }
]
```

- `key`: modifiers `ctrl`, `shift`, `alt`, `meta` and `mod` (⌘ on macOS, Ctrl elsewhere), then a key: a letter, a digit, punctuation, or a name such as `Enter`, `Tab`, `ArrowLeft`, `F6`, `PageUp`. Two keys separated by a space make a chord.
- `command`: the command to run. Prefix it with `-` to unbind it: every key, or just the `key` you give.
- `when` (optional): `textInputFocus`, `terminalFocus`, `docTabsHost`, `viewType == <pane>` or `viewType != <pane>`, each optionally negated with `!`, joined with `&&`.
- `platform` (optional): `mac` or `other` (Windows and Linux). Both when omitted.

An entry that can't be used is skipped and the rest still apply.

## Terminal settings

`Shift+Enter` sends a newline instead of running the line when **Settings → Terminal → Shift+Enter → new line** is on.

## Agent panes

In the message box at the bottom of an Agent pane (`frontend/app/view/agent/components/AgentFooter.tsx`):

| Key | Action |
|---|---|
| `Enter` | Send |
| `Shift + Enter` | New line |
| `Esc` | Clear the draft. With an empty box, send any queued messages right away, or, if nothing is queued, interrupt the agent's running turn. |
| `Cmd + Z` (macOS), `Ctrl + Z` (Windows / Linux) | Bring back a draft cleared with `Esc` |
| `↑` / `↓` | Step through messages you sent before. On an empty box, `↑` first pulls back the most recently queued message. |
| `Tab` or `→` | Accept the suggested next prompt (empty box only) |
| `↑` / `↓`, `Tab`, `Enter`, `Esc` | In the `/` command list: move, fill in, run, dismiss |

Typing `/quit` (or `/exit`) and sending it ends the agent gracefully, showing what it stops, and closes its tab. Other tabs in the same pane keep running. The conversation is kept, so reopening the agent resumes it (`frontend/app/view/agent/commands/global/quit.ts`).

`Ctrl + F`, on every platform, opens or closes the search bar for the conversation. In the search bar, `Enter` goes to the next match, `Shift + Enter` to the previous one, and `Esc` closes it.

The Shell drawer at the bottom of an Agent pane is a terminal. There, `Ctrl + Shift + V` pastes and `Ctrl + Shift + C` copies the selected text, on every platform, as in a Terminal pane (`frontend/app/view/agent/components/shell-drawer-keys.ts`, `handleShellDrawerKeydown`).

## Browser panes

A Browser pane's web page has the keyboard while it has focus. AgentMux still takes its window, tab and pane shortcuts from the page, as listed above: new tab, close pane, split, the command palette, F6 to move to the next pane and so on. Find and zoom stay with the page, and so does any shortcut that only applies outside text fields, since AgentMux can't tell whether the page has a text field focused (`crates/cef/src/client/handlers.rs`, `app_shortcut_for`).

The pane also has these keys of its own (`browser_pane_shortcut_for`):

| Action | macOS | Windows / Linux |
|---|---|---|
| Focus the address bar | `⌘L` | `Ctrl+L` |
| Reload | `⌘R` | `Ctrl+R` |
| Back | `⌥←` | `Alt+←` |
| Forward | `⌥→` | `Alt+→` |

In the address bar, `Enter` opens the address. Text that isn't an address is searched on Google.

## macOS menu bar

The native macOS menu bar adds the standard system shortcuts: `⌘Q` (quit), `⌘H` (hide), `⌥⌘H` (hide others), and in the Edit menu `⌘Z`, `⇧⌘Z`, `⌘X`, `⌘C`, `⌘V` and `⌘A`. Its other items (New Tab, Zoom In and so on) show no shortcut in the menu, on purpose: a menu shortcut takes the key before the app sees it, which would override the rules above (for example ⌘W in the Files pane closes a folder tab, not the pane). The shortcuts in the tables above apply.

## Resizing panes

Pane resizing is mouse-driven, with `Shift` selecting the "surgical" variant of each gesture. The modifier is `Shift` on every platform, and it can be pressed or released **mid-drag**: the layout re-bases from wherever it is, with no jumps.

### Dragging a pane border

| Gesture | Effect |
|--------|--------|
| Drag a pane border | **Resize the whole row or column.** The border under the cursor tracks it exactly. The panes on each side of it grow or shrink in proportion to their size. |
| `Shift` + drag a pane border | **Resize a single border.** Only the two panes flanking the dragged border change size; everything else stays put. |

Panes have a 128 px minimum size while you drag. When a group resize runs out of room on one side, panes stop at the minimum and the drag caps at whatever space was actually available (`frontend/layout/lib/layoutResize.ts`, `computeGroupResizeSizes`).

### Dragging a window edge

| Gesture | Effect |
|--------|--------|
| Drag a window edge | **Proportional.** All panes scale with the window. |
| `Shift` + drag a window edge | **Only the edge pane resizes.** The pane(s) touching the dragged edge absorb the entire size change; every other pane keeps its exact size. Shrinking floors the edge pane at 128 px, then spills inward pane by pane. |

`Shift` + window-edge resizing is **Windows-only**; macOS and Linux always resize proportionally.

### Window snapping (Windows)

On Windows, AgentMux does its own window snapping (`crates/cef/src/client/window_snap.rs`):

- **Drag to the top to maximize.** Drag the title bar until the cursor is at the top edge of the screen (within 12 px). A preview appears; release to maximize. Floating pane windows are excluded.
- **Drag a maximized window to restore it.** Dragging the title bar of a maximized window restores it to its normal size, under the cursor.
- **Snap to full height.** Drag the window's top or bottom border to within 12 px of the screen edge and the window fills the screen's height; its width doesn't change. Drag back out of the zone to undo it.
- **Cancel a drag.** Press `Esc` while dragging the title bar to put the window back where it started.
