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

Press **`Ctrl + P`** on any platform to open the command palette, a searchable list of commands. While it's open, all other app shortcuts are paused.

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
| Next tab | `Cmd + ]` | `Alt + ]` |
| Previous tab | `Cmd + [` | `Alt + [` |
| Go to tab 1–9 | `Cmd + 1` … `Cmd + 9` | `Alt + 1` … `Alt + 9` |
| New window | `Ctrl + Shift + N` | `Ctrl + Shift + N` |

New tabs and windows open with the starter layout: Agent, Sysinfo and Swarm. Closing a tab with `Cmd + Shift + W` asks for confirmation unless the `tab:skipcloseconfirm` setting is on, and the last tab in a window can't be closed.

Double-click a tab to rename it. `Enter` saves the name and `Esc` cancels.

While the window is still loading, `F5` or `Ctrl + R` (`Cmd + R` on macOS) reloads it. This only works during startup, for a window stuck on a startup error.

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
| Close the open dialog or search bar, or restore a magnified pane | `Esc` | `Esc` |

New panes and splits open a terminal. A new terminal starts in the focused terminal's directory and connection. If the `app:defaultnewblock` setting is `launcher`, they open the widget launcher instead. After `Ctrl + Shift + S` you have 2 seconds to press the arrow key. The digit keys for focusing a pane work on the top row or the numpad. Cycling focus moves through the panes in a clockwise spiral, starting at the top left.

Closing a pane whose agent is mid-turn or has processes running asks for confirmation first. A closing Agent pane stays on screen with a log of what it's stopping until the agent is down (see [Ending an agent](/first-agent/#ending-an-agent)).

`Ctrl + Shift + M` toggles **multi-input**, which sends what you type in one terminal to every other terminal pane. It only turns on when there are at least two terminals.

`Ctrl + Shift + V` starts or stops voice input in the focused Agent pane, when voice input is available. If dictation is already running in another pane, it moves to the focused one. In a Terminal pane, and in an Agent pane's Shell drawer, the same keys paste instead (see below).

In the widget launcher, type to filter the widgets, use the arrow keys to move the selection, and press `Enter` to open one. `Esc` clears the search, and with an empty search it goes back out of a widget group.

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
| `Ctrl` + scroll over a pane | Zoom that pane (if it's one of the types above). Steps are 10% over a Terminal, Editor, Swarm, Armory or Warden pane and 5% over an Agent pane. |
| `Ctrl` + scroll over the title bar, status bar or a pane header | Zoom the window chrome (title bar and status bar), in 5% steps within 50–200% |
| `Ctrl + Shift` + scroll | Zoom every zoomable pane in the window together, each from its own current level, in 5% steps. Over the title bar, status bar or a pane header it zooms the chrome instead. |

On macOS, `Cmd` also works in place of `Ctrl` for these scroll gestures, in 5% steps.

An Agent pane's Shell drawer zooms on its own: `Ctrl` + scroll over it changes only the drawer, in 10% steps. The Help pane also has its own zoom: `Ctrl` + scroll over it (5% steps), or `Ctrl + =`, `Ctrl + -` and `Ctrl + 0` while it has focus (`Cmd` works too on macOS).

## Terminal panes

| Action | macOS | Windows / Linux |
|---|---|---|
| Copy the selection | `Ctrl + Shift + C` | `Ctrl + Shift + C` |
| Paste | `Ctrl + Shift + V` | `Ctrl + Shift + V` |
| Clear the terminal | `Cmd + K` | `Alt + K` |
| Insert a newline without running | `Shift + Enter` | `Shift + Enter` |
| Restart the shell after it exits | `Enter` | `Enter` |
| In the search bar: next / previous match | `Enter` / `Shift + Enter` | `Enter` / `Shift + Enter` |

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

Typing `/quit` (or `/exit`) and sending it ends the agent gracefully, showing what it stops, and closes its tab. Other tabs in the same pane keep running. The conversation is kept, so reopening the agent resumes it (`frontend/app/view/agent/commands/global/quit.ts`).

`Ctrl + F`, on every platform, opens or closes the search bar for the conversation. In the search bar, `Enter` goes to the next match, `Shift + Enter` to the previous one, and `Esc` closes it.

The Shell drawer at the bottom of an Agent pane is a terminal. There, `Ctrl + Shift + V` pastes and `Ctrl + Shift + C` copies the selected text, on every platform, as in a Terminal pane (`frontend/app/view/agent/components/shell-drawer-keys.ts`, `handleShellDrawerKeydown`).

## Editor panes

These keys are handled in `frontend/app/view/editor/editor-view.tsx`:

| Action | macOS | Windows / Linux |
|---|---|---|
| Save the file | `Cmd + S` | `Ctrl + S` |
| Find and replace (source view only) | `Cmd + F` | `Ctrl + F` |
| Switch a Markdown file between preview and source | `Cmd + Shift + V` | `Ctrl + Shift + V` |

In the file tree, `F2` renames the selected file.

In the memory editors (Global Memory and an agent's native memory files), `Ctrl + S` or `Cmd + S` saves and `Esc` cancels. If there are unsaved changes, `Esc` asks first.

## Browser panes

A Browser pane's web page receives your keystrokes directly, so while the page has focus, AgentMux's other shortcuts don't reach the app. Click another pane first. These keys still work in the page (`agentmux-cef/src/client/handlers.rs`, `browser_pane_shortcut_for`):

| Action | macOS | Windows / Linux |
|---|---|---|
| Focus the address bar | `Cmd + L` | `Ctrl + L` |
| Reload | `Cmd + R` | `Ctrl + R` |
| Back | `Option + ←` | `Alt + ←` |
| Forward | `Option + →` | `Alt + →` |

In the address bar, `Enter` opens the address. Text that isn't an address is searched on Google.

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
- **Cancel a drag.** Press `Esc` while dragging the title bar to put the window back where it started.

## Customization

Keybindings can't be customized. They're fixed in `frontend/app/store/keymodel.ts`, and AgentMux doesn't read a keybindings file. A `keybindings.json` in the config folder has no effect.
