---
title: "Keybindings"
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

AgentMux's shortcuts use two modifiers:

- **`Cmd`** is the ⌘ Command key on macOS and the **Alt** key on Windows and Linux.
- **`Ctrl`** is the Control key on every platform, macOS included.

The app-wide bindings are defined in `frontend/app/store/keymodel.ts` (`registerGlobalKeys`), and the modifier mapping in `frontend/util/keyutil.ts` (`parseKeyDescription`).

On Windows and Linux, the Alt shortcuts below take priority over the same keys in a terminal pane. For example, Alt+D splits the pane instead of reaching your shell.

## Command palette

Press **`Ctrl + P`** on any platform to open the command palette, a searchable list of commands. While it's open, all other shortcuts are paused.

| Key | Action |
|---|---|
| `Ctrl + P` | Open the palette |
| Type | Filter the list (fuzzy match) |
| `↑` / `↓` | Move the highlight |
| `Enter` | Run the highlighted command |
| `Esc` | Close the palette |

Its commands (`frontend/app/store/command-registry.ts`, `registerDefaultCommands`):

| Category | Commands |
|---|---|
| **Open** | Open Terminal, Open Agent, Open System Info, Open Help, Open Swarm |
| **Split** | Split Right, Split Left, Split Down, Split Up (each opens a terminal) |
| **Window** | New Window, Close Window, Minimize Window, Toggle Maximize |
| **Tab** | New Tab, Close Tab, Next Tab, Previous Tab |
| **Pane** | Close Pane, Toggle Magnify, Focus Pane Right / Left / Up / Down |
| **Dev** | Toggle DevTools, Restart Backend, Open Settings File |
| **View** | Command Palette, Zoom In, Zoom Out, Actual Size |
| **App** | Identity & Memory (opens the Armory) |
| **Help** | Online Docs |

## Tabs and windows

| Action | macOS | Windows / Linux |
|---|---|---|
| New tab | `Cmd + T` | `Alt + T` |
| Close tab | `Cmd + Shift + W` | `Alt + Shift + W` |
| Next tab | `Cmd + ]` or `Cmd + Shift + ]` | `Alt + ]` or `Alt + Shift + ]` |
| Previous tab | `Cmd + [` or `Cmd + Shift + [` | `Alt + [` or `Alt + Shift + [` |
| Go to tab 1–9 | `Cmd + 1` … `Cmd + 9` | `Alt + 1` … `Alt + 9` |
| New window | `Ctrl + Shift + N` | `Ctrl + Shift + N` |

New tabs and windows open with the starter layout: Agent, Sysinfo and Swarm. Closing a tab asks for confirmation unless the `tab:skipcloseconfirm` setting is on, and the last tab in a window can't be closed.

## Panes

| Action | macOS | Windows / Linux |
|---|---|---|
| New pane | `Cmd + N` | `Alt + N` |
| Split right | `Cmd + D` | `Alt + D` |
| Split below | `Cmd + Shift + D` | `Alt + Shift + D` |
| Split in a direction | `Ctrl + Shift + S`, then an arrow key | `Ctrl + Shift + S`, then an arrow key |
| Close pane | `Cmd + W` | `Alt + W` |
| Magnify or restore the focused pane | `Cmd + M` | `Alt + M` |
| Move focus to the adjacent pane | `Ctrl + Shift + Arrow` | `Ctrl + Shift + Arrow` |
| Cycle focus forward / backward | `Ctrl + ]` / `Ctrl + [` | `Ctrl + ]` / `Ctrl + [` |
| Focus pane 1–9 (in layout order) | `Ctrl + Shift + 1` … `9` | `Ctrl + Shift + 1` … `9` |
| Return keyboard focus to the focused pane | `Cmd + I` | `Alt + I` |
| Replace the focused pane with the widget launcher | `Ctrl + Shift + K` | `Ctrl + Shift + K` |
| Change the connection of a Terminal or Sysinfo pane | `Cmd + G` | `Alt + G` |
| Search in a Terminal pane | `Cmd + F` | `Alt + F` |
| Close the open dialog or search bar | `Esc` | `Esc` |

New panes and splits open a terminal. A new terminal starts in the focused terminal's directory and connection. If the `app:defaultnewblock` setting is `launcher`, they open the widget launcher instead. After `Ctrl + Shift + S` you have 2 seconds to press the arrow key.

`Ctrl + Shift + M` toggles **multi-input**, which sends what you type in one terminal to every terminal pane. It only turns on when there are at least two terminals.

`Ctrl + Shift + V` toggles voice input in the focused Agent pane, when voice input is available. In a Terminal pane it pastes instead (see below).

## Zoom

| Action | macOS | Windows / Linux |
|---|---|---|
| Zoom the focused pane in | `Cmd + =` | `Ctrl + =` |
| Zoom the focused pane out | `Cmd + -` | `Ctrl + -` |
| Reset the focused pane's zoom | `Cmd + 0` | `Ctrl + 0` |

Both variants are bound on every platform: `Ctrl + =` also works on macOS, and `Alt + =` on Windows and Linux. The keyboard steps by 10%, within 50–200%. Zoom applies to Terminal, Agent, Swarm, Editor, Armory and Warden panes (`frontend/app/store/zoom.ts`).

With the mouse (`frontend/app/app.tsx`, `AppZoomHandler` and `AppAllPanesZoomHandler`):

| Gesture | Effect |
|---|---|
| `Ctrl` + scroll over a pane | Zoom that pane (if it's one of the types above), in 5% steps |
| `Ctrl` + scroll over the title bar, status bar or a pane header | Zoom the window chrome (title bar and status bar) |
| `Ctrl + Shift` + scroll | Zoom every zoomable pane in the window together, each from its own current level |

On macOS, `Cmd` works in place of `Ctrl` for these scroll gestures.

## Terminal panes

| Action | macOS | Windows / Linux |
|---|---|---|
| Copy the selection | `Ctrl + Shift + C` | `Ctrl + Shift + C` |
| Paste | `Ctrl + Shift + V` | `Ctrl + Shift + V` |
| Clear the terminal | `Cmd + K` | `Alt + K` |
| Insert a newline without running | `Shift + Enter` | `Shift + Enter` |
| Restart the shell after it exits | `Enter` | `Enter` |

`Shift + Enter` only inserts a newline when the `term:shiftenternewline` setting is on. These keys are handled in `frontend/app/view/term/termViewModel.ts` (`handleTerminalKeydown`).

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

`Ctrl + F`, on every platform, opens or closes the search bar for the conversation.

## Browser panes

A Browser pane's web page receives your keystrokes directly, so while the page has focus, AgentMux's other shortcuts don't reach the app. Click another pane first. These keys still work in the page (`agentmux-cef/src/client/handlers.rs`, `browser_pane_shortcut_for`):

| Action | macOS | Windows / Linux |
|---|---|---|
| Focus the address bar | `Cmd + L` | `Ctrl + L` |
| Reload | `Cmd + R` | `Ctrl + R` |
| Back | `Option + ←` | `Alt + ←` |
| Forward | `Option + →` | `Alt + →` |

## macOS menu bar

The native macOS menu bar adds the standard system shortcuts: `Cmd + Q` (quit), `Cmd + H` (hide), `Cmd + Option + H` (hide others), and in the Edit menu `Cmd + Z`, `Cmd + Shift + Z`, `Cmd + X`, `Cmd + C`, `Cmd + V` and `Cmd + A`. Its other items (New Tab, Zoom In and so on) have no shortcut of their own in the menu; the bindings above apply.

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

On Windows, AgentMux does its own window snapping (`agentmux-cef/src/client/window_snap.rs`):

- **Drag to the top to maximize.** Drag the title bar until the cursor is at the top edge of the screen (within 12 px). A preview appears; release to maximize. Floating pane windows are excluded.
- **Drag a maximized window to restore it.** Dragging the title bar of a maximized window restores it to its normal size, under the cursor.
- **Snap to full height.** Drag the window's top or bottom border to within 12 px of the screen edge and the window fills the screen's height; its width doesn't change. Drag back out of the zone to undo it.

## Customization

Keybindings can't be customized. They're fixed in `frontend/app/store/keymodel.ts`, and AgentMux doesn't read a keybindings file.
