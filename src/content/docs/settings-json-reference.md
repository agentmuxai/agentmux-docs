---
title: "settings.json reference"
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

Every key AgentMux reads from `settings.json`, in one place: its type, its default, the values it accepts, the platform it applies to and what it does. The tables are generated from the same settings list AgentMux builds its starting `settings.json` from, so a key here is a key the file can hold. For how each group of settings looks in the Settings pane, and the settings that have a longer story, see the [Settings Reference](/settings/).

## Opening the file

In the Settings pane, **Open raw settings.json** (at the bottom) opens the file in the Editor. The command palette has **Open Settings File**. Both open the file the running AgentMux reads, so use them rather than looking for it.

Where the file is depends on the channel the running AgentMux belongs to:

- The `stable` channel keeps one `settings.json` for every stable version: in the `channels` folder under AgentMux's data folder, beside the channel folders, not inside one.
- Every other channel, such as a `task dev` build or a locally built package, has a `settings.json` of its own in that channel's `config` folder, so changing it there does not change another build.
- `AGENTMUX_ISOLATED_SETTINGS=1` gives a channel a file of its own; any other value makes it share the one above the channel folders. `AGENTMUX_SETTINGS_DIR` names the folder outright.

## Reading the file

The file is JSON with `//` comments. A new install starts from a file that lists every key below, grouped, with its description and its default commented out: remove the leading `//` to set one. A key you leave out uses its default.

- **A wrong type or a value out of range** does not stop the file. That key uses its default and every other key applies. The Settings pane shows a message at the top for it, with the file and the line, and **Fix in editor** opens the file there.
- **A file that is not valid JSON** (a half-finished edit, a missing comma, a bad paste) is never overwritten. AgentMux runs on the last settings that read cleanly, or on the defaults when there are none, and keeps that copy as `settings.json.lastgood` beside the file. The message at the top gives the line. Fix the file and save, and the new settings apply at once.
- **A key that is not a setting** stays in the file and does nothing. Settings > Advanced lists it under **Unrecognized settings**, with the line it is on, what it holds, and **Did you mean** the key it is a few characters away from, when there is one. **Remove** takes it out of the file. AgentMux never removes one by itself.
- **A change that cannot be written** (a read-only file, a full disk) shows **Not saved: the setting could not be written**, and the file is left as it was.
- **Copy and paste work on the whole file.** Copy `settings.json` to keep your settings, paste it over the file on another machine or a later version, and save: it applies at once. Keys that do not belong are kept and flagged, a wrong value falls back key by key, and a paste that is not valid JSON changes nothing and says where it is broken.
- **A secret key** has no default here, and its value is hidden in logs, error messages and exports.
- **Platform:** a key marked for one platform applies there only. On another platform it stays in the file and is not flagged as unrecognized.

The families `app:*`, `term:*`, `window:*`, `widget:*`, `blockheader:*`, `telemetry:*`, `conn:*` and `notify:*` are also accepted, as booleans. Keys nothing reads are listed under [Keys AgentMux doesn't read](/settings/#keys-agentmux-doesnt-read), and are not repeated here.

"Unset" in the Default column means the key has no single default: when it is left out, what happens is in the description.

<!-- generated: node scripts/gen-settings-reference.mjs -->

## Terminal

| Key | Type | Default | Allowed values | Platform | Description |
|---|---|---|---|---|---|
| `term:fontsize` | number | `15` | — | All | Terminal font size in pixels (8 to 32). |
| `term:fontfamily` | string | `"Hack"` | — | All | Terminal fonts as a comma-separated list, tried in order. |
| `term:theme` | string | `"default-dark"` | — | All | Color theme of terminals, by theme name. Blank uses the default. |
| `term:disablewebgl` | boolean | `false` | — | All | Draw the terminal on a canvas instead of with WebGL. Takes effect after a restart. |
| `term:localshellpath` | string | Unset | — | All | The shell new local terminals open with. Agents' shells and SSH or WSL terminals keep their own. When left out: unset uses your shell. |
| `term:localshellopts` | list of strings | `[]` | — | All | Extra arguments for the shell a new local terminal starts, as a list of strings. A terminal's own value, even an empty list, wins. |
| `term:scrollback` | integer | `2000` | — | All | Lines a terminal keeps in its scrollback (1000 to 100000). |
| `term:durable` | boolean | Unset | — | All | Keep an SSH terminal's shell running on the host, in AgentMux's small helper there, so a dropped link, sleep or a restart reconnects instead of ending it. Unset (auto) lets AgentMux decide. On a host without the helper the first terminal asks before installing it, and is a plain terminal if it is not installed. Connectors &gt; Remotes can set it per host. When left out: unset (auto): AgentMux decides. |
| `term:copyonselect` | boolean | `false` | — | All | Copy selected text to the clipboard as you select it. |
| `term:transparency` | number | `0.5` | — | All | Terminal background transparency: 0 is opaque, 1 is fully transparent. |
| `term:scrollsensitivity` | number | `1` | 0.1 to 10 | All | Scroll wheel speed multiplier for terminal panes (xterm.js scrollSensitivity). Default 1 (unchanged from xterm.js's own default). Independent of the OS-level scroll-speed setting — AgentMux does not read or mirror it. |
| `term:allowbracketedpaste` | boolean | `true` | — | All | Let programs tell pasted text from typed text (bracketed paste). |
| `term:shiftenternewline` | boolean | `false` | — | All | In a terminal, Shift+Enter sends a newline instead of running the line. |
| `term:predictiveecho` | boolean | `true` | — | All | Show typed characters locally at once while waiting on a slow or remote shell. |
| `term:predictiveecho:thresholdms` | number | `0` | — | All | Round-trip latency, in milliseconds, above which predictive echo starts. 0 predicts all the time. |
| `term:showstatsbadge` | boolean | `true` | — | All | Show the live CPU%/memory usage badge in the top-right corner of terminal panes. |

## Drag and drop

| Key | Type | Default | Allowed values | Platform | Description |
|---|---|---|---|---|---|
| `dnd:enabled` | boolean | `true` | — | All | Enable dropping files onto agent and terminal panes. |
| `dnd:concurrency` | integer | Unset | 1 or more | All | Max number of files uploaded/attached concurrently on a multi-file drop. Absent means unlimited. When left out: unset means no limit. |
| `dnd:agentinserttoken` | boolean | `true` | — | All | Insert a file-reference token into the composer on drop (in addition to attaching the file). |

## Animations

| Key | Type | Default | Allowed values | Platform | Description |
|---|---|---|---|---|---|
| `layout:livereflow` | boolean | `true` | — | All | Live reflow while a pane is dragged: the other panes glide to where the drop leaves them, and close over the slot of a pane that is about to be torn off. Default true; set false for the landing rectangle. |
| `animation:preset` | string | `"smooth"` | `"system"`, `"off"`, `"quick"`, `"smooth"`, `"slow"`, `"custom"` | All | Animations: which choice Settings shows. smooth is the designed timing, quick and slow scale it, off turns animations off, system follows the computer's setting, custom uses the numbers below. |
| `animation:speed` | integer | `100` | — | All | Animation duration as a percent of the designed timing, with the custom choice: 0 (off), or 25 to 300 in steps of 5. |
| `animation:polish` | integer | `100` | — | All | Hover and fade polish as a percent, with the custom choice: 0, or 25 to 300 in steps of 5. |
| `animation:reducemovement` | boolean | `false` | — | All | With the custom choice, replace slides, zooms and bounces with fades. |

## Window

| Key | Type | Default | Allowed values | Platform | Description |
|---|---|---|---|---|---|
| `statusbar:showmuxbuscloud` | boolean | `true` | — | All | Show MuxBus Cloud in the status bar: the dot after the host name and the sign-in block in the host menu. Default true (absent means shown); set false to hide both. LAN discovery is unaffected. |
| `window:transparent` | boolean | `false` | — | All | Enable background transparency and blur. |
| `window:autorecycle` | boolean | `true` | — | All | Reload a window that has been idle for 10 minutes when its page uses much more memory than it did after loading (over 600 MB and twice its size after load), to give that memory back. Drafts, scroll positions and layout are kept, and it waits while anything would be lost. Default true; set false to only reload on request (Reload Window (Free Memory)). |
| `window:blur` | boolean | `false` | — | All | Blur the content behind the window. |
| `window:opacity` | number | `0.8` | — | All | Default window opacity (35 to 100 percent) for windows without one of their own; the menu sets one window's. |
| `window:bgcolor` | string | `""` | — | All | Window background color override, as a hex color. Blank uses the theme's. |
| `window:tilegapsize` | integer | `3` | — | All | Pixels between tiled panes (0 to 20). |
| `window:showstatusbar` | boolean | `true` | — | All | Show the status bar along the bottom of the window. Default true; set false to hide it. It comes back by itself while the backend is down. The "Toggle Status Bar" palette command flips it. |
| `window:magnifiedblockopacity` | number | `1` | — | All | Background opacity of a pane while it is magnified (0 to 1). |
| `window:magnifiedblocksize` | number | `0.9` | — | All | Size of a magnified pane as a fraction of its tab, held to the allowed range. |
| `window:magnifiedblockblurprimarypx` | integer | Unset | — | All | Backdrop blur, in pixels, applied to the magnified pane itself. When left out: unset applies no blur. |
| `window:magnifiedblockblursecondarypx` | integer | Unset | — | All | Backdrop blur, in pixels, applied to the other panes behind a magnified one. When left out: unset applies no blur. |
| `window:confirmcloseworking` | boolean | `true` | — | All | Ask before closing a window while an agent in it is mid-turn. Closing stops its agents; the window stays in the workspace, to reopen from the version panel. |
| `window:keepinactivetabslaidout` | boolean | `true` | — | All | Keep the tabs you are not looking at laid out, so switching back is fast. Off when false, which hides them with content-visibility: hidden instead. |
| `window:prewarmagenttabs` | boolean | `false` | — | All | Draw the agent transcripts of window tabs you have not opened yet while the window is idle, one pane at a time, so the first visit shows the whole tab at once. Uses more memory; pauses under memory pressure. |
| `window:theme` | string | `"default"` | `"default"`, `"midnight"`, `"high-contrast"`, `"monokai"`, `"nord"`, `"dracula"`, `"catppuccin"`, `"tokyo-night"`, `"gruvbox"`, `"light"`, `"catppuccin-latte"`, `"solarized-light"`, `"gruvbox-light"` | All | UI color theme. Options: default (dark grey + blue), midnight (deep navy), high-contrast (black + cyan), monokai (warm dark + green), nord (arctic blue-grey), dracula (purple dark), catppuccin (pastel dark + mauve), tokyo-night (blue-purple), gruvbox (retro warm + yellow), light (white + blue), catppuccin-latte (pastel light + blue), solarized-light (cream + cyan/blue), gruvbox-light (retro warm cream + orange). |

## Panes and tabs

| Key | Type | Default | Allowed values | Platform | Description |
|---|---|---|---|---|---|
| `pane:colors` | object | `{}` | — | All | Color per widget type, keyed by view ("term", "agent", "browser", ...): a palette color name ("azure", "amber", ...) replaces that widget's built-in color, null gives it none; a number 0-360 is an older hue, read as the palette color nearest it. A pane's own Pane Color pick and an agent's color still win. Remove a key to return to the built-in color. |
| `blockheader:showblockids` | boolean | `false` | — | All | Show each pane's internal block ID in its header (a debugging aid). |
| `tab:confirmclose` | boolean | `false` | — | All | Ask before closing a tab. Off by default: a tab closes at once. |
| `mouse:sidebuttons` | boolean | `true` | — | All | The mouse side buttons (Back / Forward) re-select the previous / next pane you selected, across tabs. Off leaves them to the page. |
| `widget:icononly` | boolean | `false` | — | All | Show icons without text labels on the widget bar. |
| `widget:pinned` | list of strings | Unset | — | All | The widget bar's pinned icons, in order: a built-in's short name ("agent" for defwidget@agent) or an installed package widget's full key ("ext@acme.board/main"). Absent means the fresh-install default. When left out: absent means the fresh-install default. |
| `widget:hidden` | list of strings | `[]` | — | All | Widget-bar entries hidden from the bar, More and the pane + picker, as full keys ("defwidget@drone"). Set in Settings &gt; Widgets. |
| `launcher:recent` | list of strings | Unset | — | All | The widget keys opened last, newest first (at most 12): the Shortcuts pane shows these tiles first. Kept by the app; empty until a widget is opened. |

## Keyboard

| Key | Type | Default | Allowed values | Platform | Description |
|---|---|---|---|---|---|
| `keybindings` | list of objects | `[]` | objects with `command` and optionally `key`, `when`, `platform` | All | Your own keyboard shortcuts, applied over the defaults. Each entry: {"key": "ctrl+shift+e", "command": "split:right"}. A command starting with - unbinds it: {"command": "-tab:new"} removes every key, or add "key" to remove one. Optional "when" (e.g. "!terminalFocus") and "platform" ("mac" or "other"). Command ids are listed in the keyboard shortcuts help. |

## Shell environment

| Key | Type | Default | Allowed values | Platform | Description |
|---|---|---|---|---|---|
| `cmd:env` | object | `{}` | — | All | Environment variables injected into every shell. |

## App

| Key | Type | Default | Allowed values | Platform | Description |
|---|---|---|---|---|---|
| `app:defaultnewblock` | string | Unset | — | All | View type opened by default for new tabs and panes (for example term, agent, shortcuts). Blank or unset opens a terminal. When left out: blank and unset both open a terminal. |
| `app:showoverlayblocknums` | boolean | `true` | — | All | Show numbered overlays on panes for the quick pane-jump shortcuts. |
| `update:auto` | boolean | `true` | — | All | Check for a newer AgentMux release in the background (a minute after start, then every few hours). Set false and AgentMux asks GitHub only when you or an agent does (Check for update). |
| `update:autodownload` | boolean | `true` | — | All | Download and verify a newer release in the background once one is found, so the status bar offers Restart to update. Nothing is installed until you restart. Set false to download only when you click Download. |
| `app:showtray` | boolean | `true` | — | All | Show an AgentMux icon in the system tray / menu bar while AgentMux is running. On by default. Always shown while app:runinbackground is on (a process that keeps running must show an icon). Read by agentmux-launcher at startup, so a change applies at the NEXT launch. |
| `app:runinbackground` | boolean | `false` | — | All | Keep AgentMux running with a system-tray / menu-bar icon when all windows are closed (background-service mode; implies the tray icon regardless of app:showtray). Off by default (opt-in); if the tray cannot be shown (e.g. Linux without a StatusNotifier host), closing the last window quits even when this is on. Read by agentmux-launcher at startup, so a change applies at the NEXT launch. Env AGENTMUX_BACKGROUND_SERVICE / AGENTMUX_TRAY and the --background flag also enable it. |
| `app:startatlogin` | boolean | `false` | — | All | Start AgentMux when you log in. Off by default. The Settings toggle and the tray menu's 'Start at login' item both set this; agentmux-launcher applies it to the OS login entry (XDG autostart / LaunchAgent / Scheduled Task). |
| `app:devmode` | boolean | Unset | — | All | Show the developer-only parts of the UI: DevTools in the menu, Inspect Element and View Page Source in right-click menus, the DevTools port in the host popover and the block ID option. Off by default in the installed app; when unset, a task dev or debug build has it on. Takes effect at once in every window (the macOS menu bar item at the next start). When left out: unset: on in a task dev or debug build, off in an installed app. |
| `app:locale` | string | `"system"` | — | All | The language of AgentMux's own screens: "system" (the default) follows the operating system's language list, or a BCP 47 tag such as "ja", "pt-BR" or "zh-Hans". A language with no dictionary, or only part of one, shows English for what is missing. It does not change what agents reply in, and the hosted CLIs' own terminal text stays in their language. A change applies at once in the app; native menus and dialogs follow at the next launch. |
| `splash:disabled` | boolean | `false` | — | All | Suppress the startup splash screen entirely (no window is created). Read by agentmux-launcher BEFORE the host and backend exist, so a change applies at the NEXT launch, not the current one. Env AGENTMUX_SPLASH=0 / AGENTMUX_NO_SPLASH=1 override this for a single run. |

## Telemetry

| Key | Type | Default | Allowed values | Platform | Description |
|---|---|---|---|---|---|
| `telemetry:interval` | number | `1` | — | All | Seconds between samples of the system-info widget. |
| `telemetry:numpoints` | integer | `120` | 30 to 1024 | All | How many system-info widget samples are kept (30 to 1024). |

## Connections

| Key | Type | Default | Allowed values | Platform | Description |
|---|---|---|---|---|---|
| `conn:helper` | string | `"ask"` | `"ask"`, `"always"`, `"never"` | All | Installing AgentMux's helper on an SSH host: ask first (the default), always, or never. |

## Notifications

| Key | Type | Default | Allowed values | Platform | Description |
|---|---|---|---|---|---|
| `notify:sounds:enabled` | boolean | `true` | — | All | Master enable for notification sounds. |
| `notify:sounds:volume` | number | `0.6` | 0 to 1 | All | Notification sound volume, 0.0 (silent) to 1.0 (full). Default 0.6. |
| `notify:sounds:suppresswhenfocused` | boolean | `true` | — | All | Suppress a pane's sound when that pane is focused AND the OS window is in foreground (the user can already see the visual signal). |
| `notify:sound:agent.turn.complete` | boolean | `true` | — | All | Play a sound when an agent turn completes normally. |
| `notify:sound:agent.turn.error` | boolean | `true` | — | All | Play a sound when an agent turn ends with an error (errored, submit-timed-out). |
| `notify:sound:agent.turn.interrupted` | boolean | `true` | — | All | Play a sound when an agent turn is stopped or interrupted. |
| `notify:sound:agent.message.accepted` | boolean | `true` | — | All | Play a sound when the backend accepts a queued pending message. |
| `notify:sound:agent.message.rejected` | boolean | `true` | — | All | Play a sound when the backend rejects a queued pending message. |
| `notify:sound:agent.waiting.for.input` | boolean | `true` | — | All | Play a looping tone while an agent waits for you: a question, a tool permission, a browser hand-off or approval, an SSH consent or a widget install. Quiet while you're looking at that pane. |
| `notify:waiting:browser` | boolean | `true` | — | All | Include browser hand-offs and approvals in the waiting tone, tab flash and notification. |
| `notify:waiting:toast` | boolean | `true` | — | All | Show a toast that names the agent waiting on you, with a link to it. Independent of the waiting tone. |
| `notify:sound:agent.shutdown.pending` | boolean | `true` | — | All | Play the falling shutdown chime when something other than you asked to shut an agent down and you have 15 seconds to keep it running. |
| `notify:sounds:waiting:volume` | number | `0.25` | 0 to 1 | All | Independent gain for the waiting-for-input sound, 0.0 (silent) to 1.0. Layered below the shared master gain. Default 0.25. |
| `notify:os:enabled` | boolean | `true` | — | All | Master switch for OS desktop notifications (native toasts) from agents. |
| `notify:os:when` | string | `"unfocused"` | `"unfocused"`, `"always"`, `"never"` | All | When to show OS notifications. unfocused: only when no AgentMux window is focused (an agent needing input still alerts if you're looking at a different pane). always: unless you're looking at that pane. never: off. |
| `notify:os:inputwaiting` | boolean | `true` | — | All | Notify when an agent asks a question and waits for your answer ("&lt;agent&gt; has a question"). |
| `notify:os:turncompleted` | boolean | `true` | — | All | Notify when an agent's turn completes. |
| `notify:os:turncompleted:external` | boolean | `false` | — | All | Also notify when a turn you didn't start finishes: one another agent's message, a service notice, a scheduled run or a finished background task started. Off: such a turn ends quietly unless it needs you. |
| `notify:os:turnerrored` | boolean | `true` | — | All | Notify when an agent's turn ends with an error. |
| `notify:os:agentcrashed` | boolean | `true` | — | All | Notify when an agent stops unexpectedly (auth expired, usage limit, crash). User stops are never notified. |
| `notify:os:messageneedsreview` | boolean | `true` | — | All | Notify when an agent receives a message that needs your review before it acts (ESCALATE=required). The notification never contains the message. |
| `notify:os:cloudsignedout` | boolean | `true` | — | All | Notify once when this AgentMux is signed out of MuxBus and agents stop getting messages from other computers and GitHub. |
| `notify:os:accountunavailable` | boolean | `true` | — | All | Notify once per account when its agents hit a weekly usage limit or need you to sign in again. A session limit shows only in the Kanban and Swarm strip. The notification never names the account. |
| `notify:os:jobfailed` | boolean | `true` | — | All | Notify once when a job starts failing (one notification per incident, not per run). Further failures of the same job add to its Kanban task instead. |
| `notify:os:vaultexpiring` | boolean | `true` | — | All | Notify when a Vault entry's expiry date is 14 days away, 3 days away and on the day, once each. The notification names the entry by its label, never its value. |
| `notify:pause:until` | integer | `0` | — | All | Epoch milliseconds until which OS notifications are paused (set from the tray's Pause notifications menu). 0 = not paused. |
| `notify:pause:allowattention` | boolean | `false` | — | All | While paused, still notify when an agent needs your input or review. |
| `notify:quiethours` | string | `""` | — | All | Daily quiet hours for OS notifications, local time, as "HH:MM-HH:MM" (may span midnight, e.g. "22:00-08:00"). Behaves like a pause; notify:pause:allowattention applies. Empty = off. |
| `notify:taskbar:attention` | boolean | `true` | — | Windows | Badge the AgentMux taskbar button (and flash it once) while an agent needs you. Windows only for now. |
| `notify:os:summary` | boolean | `true` | — | All | Show the agent's current session summary as a small line under its notifications. Left out when the agent has none. |
| `notify:os:preview` | string | `"redacted"` | `"redacted"`, `"full"`, `"none"` | All | How much of an agent's question appears in the notification body. Credential/destructive keywords always replace the body with a generic message. |
| `notify:tooltones:enabled` | boolean | `true` | — | All | Play a subliminal synth tone for every agent tool call. |
| `notify:tooltones:volume` | number | `0.25` | 0 to 1 | All | Independent gain for tool-call tones, 0.0 (silent) to 1.0. Layered below the shared master gain — turning the master off silences both. Default 0.25. |
| `notify:tooltones:scope` | string | `"all"` | `"all"`, `"focused"` | All | Which panes play tool-call tones. 'all' (default) plays for every pane in every window; 'focused' plays only for the focused pane in the focused OS window. |
| `notify:tooltones:flash` | boolean | `true` | — | All | Pair every sound from a pane (tool-call tones and the turn/message event sounds) with a flash on the source pane's pill in its pane header (a brightened version of the pane's color) and a subtler one on its window tab, so a sound from a pane you can't see can be traced. One pulse per strike of the sound, timed to the audible sound, brighter for louder sounds. Follows each sound's own enable/scope/focus gates. It covers all sounds. |

## Voice input

| Key | Type | Default | Allowed values | Platform | Description |
|---|---|---|---|---|---|
| `voice:enabled` | boolean | `true` | — | All | Globally controls whether the per-pane microphone button is rendered. Default true (absent means enabled) — set false to fully hide the buttons across all panes. |
| `voice:engine` | string | `"groq"` | `"groq"`, `"whisper-local"`, `"webspeech"` | All | Speech-to-text engine. 'groq' (the default, and what an absent key means) sends captured audio to the hosted Groq Whisper backend; 'whisper-local' uses a local whisper.cpp binary; 'webspeech' uses the browser API, which only development builds support. |
| `voice:groqApiKey` | string | — | — | All | The Groq API key for the hosted Whisper backend (voice:engine = 'groq', the default), kept in the Vault: this names the entry as vault:&lt;entry id&gt;, chosen in Settings &gt; Recording. Read server-side only, never sent to the renderer. The AGENTMUX_GROQ_API_KEY env var takes precedence. |
| `voice:groqApiKeyMoved` | boolean | Unset | — | All | Set when AgentMux moved a Groq key that sat in settings.json as plain text into the Vault, so Settings &gt; Recording can say so once. Dismissing the notice removes it. When left out: unset until a key is moved. |
| `voice:whisperCliPath` | string | Unset | — | All | Path to a local whisper.cpp CLI binary (voice:engine = 'whisper-local'). Env override: AGENTMUX_WHISPER_CLI. When left out: unset. |
| `voice:whisperModel` | string | `"base.en"` | — | All | GGML model name to auto-download on first use for the local whisper.cpp backend (default 'base.en'). Ignored when voice:whisperModelPath is set. Env override: AGENTMUX_WHISPER_MODEL. |
| `voice:whisperModelPath` | string | Unset | — | All | Explicit path to a GGML model file for the local whisper.cpp backend, skipping the auto-download. Env override: AGENTMUX_WHISPER_MODEL. When left out: explicit override; skips auto-download. |
| `voice:inputDeviceId` | string | Unset | — | All | Preferred microphone input device (from navigator.mediaDevices.enumerateDevices). Absent or 'default' means the OS default input. When left out: absent means the OS default input. |

## Attachments

| Key | Type | Default | Allowed values | Platform | Description |
|---|---|---|---|---|---|
| `attachments:enabled` | boolean | `true` | — | All | Paste or drop files (images and any other kind) into the agent composer as attachments, shown as tiles above the text. When false, pasted and dropped files are copied into the working folder. |
| `attachments:maxfiles` | integer | `128` | 1 or more | All | Most images one message can carry. Default 128. |
| `attachments:maxtotalmb` | number | `1024` | more than 0 | All | Most megabytes of images (original sizes) one message can carry. Default 1024 (1 GB). |
| `attachments:sendmaxedge` | integer | `2000` | 256 to 8000 | All | Long edge, in pixels, of the copy of each image the agent receives. Default 2000, the most Claude accepts once a request has more than 20 images. |
| `attachments:claudeinlinemax` | integer | `20` | 0 to 100 | All | Images Claude receives inline in one message; the rest are listed by path for it to open. 0 sends paths only. Default 20. |
| `attachments:claudesessioninlinemb` | number | `50` | 0 or more | All | Megabytes of inline images (base64) one Claude session may receive; after that images go by path only. Bounds the size of Claude Code's own transcript. Default 50. |
| `attachments:retentiondays` | number | `30` | more than 0 | All | Days an attachment's files are kept after last use. Images that were never sent are removed after 7 days (or this, if shorter). Default 30. |

## Agents

| Key | Type | Default | Allowed values | Platform | Description |
|---|---|---|---|---|---|
| `term:agentmaxruntimehours` | number | `0` | 0 or more | All | Maximum wall-clock runtime (hours) before the watchdog kills an agent pane. 0 (default) disables the limit. |
| `term:agentidletimeoutmins` | number | `0` | 0 or more | All | Minutes of PTY silence before the watchdog kills an idle agent pane. 0 (default) disables the limit. |
| `agent:inputhistory:max` | integer | `10000` | 0 or more | All | How many messages you sent each agent are kept for ArrowUp and Ctrl+R in its composer, newest first. Default 10000; 0 keeps none from now on (what is kept stays until cleared with Ctrl+R's Clear history). Kept on this computer only. |
| `agent:turnscopedtail` | boolean | `true` | — | All | Agent panes keep only the turn in flight (plus anything still running) always mounted; older messages are virtualized. When false, the last 50 messages stay mounted. Takes effect when a pane is next opened. |
| `agent:livefeed` | boolean | `true` | — | All | Agent panes keep the turn in flight plus about 1 MB of finished turns (and at most agent:livefeedturns turns, if set); older turns roll off into the History tab, which follows the conversation, so long conversations don't slow the pane down. Applies to Claude, Codex, Kimi and Gemini agents (not ACP). Set false to keep every turn in the pane and page older ones in by scrolling up. Takes effect when a pane is next opened. |
| `agent:livefeedturns` | integer | Unset | 1 or more | All | Optional cap on how many finished turns an agent pane keeps before older ones roll off into the History tab (with agent:livefeed on). Unset: no turn limit; the pane keeps about 1 MB of finished turns. Takes effect when a pane is next opened. When left out: unset: no turn limit. |
| `agent:previewskidnotches` | integer | `2` | 0 to 10 | All | How many wheel notches a tool preview or other capped box in an agent pane absorbs at its top or bottom edge, once the wheel has scrolled it there, before the scroll passes to the pane, so the end of a preview is felt and not overshot. A box the wheel only passes over hands the scroll straight on. 0 passes the scroll on at once, with no edge line. A change applies to open panes. |
| `agent:container_memory` | string or integer | `"auto"` | — | All | The memory limit, in MB, of every container agent that has none of its own: a number, 0 for no limit, or "auto" (half of what Docker has, at least 2 GB, never more than Docker has). A change reaches running containers the next time their agent starts a turn, without restarting them. |
| `agent:container_cpus` | string or number | `"auto"` | — | All | The CPU limit, in CPUs, of every container agent that has none of its own: a number (fractions allowed), 0 for no limit, or "auto" (all but a quarter of the CPUs Docker has, at least one). A change reaches running containers the next time their agent starts a turn, without restarting them. |
| `agent:view` | string or object | `"full"` | `full`, `standard`, `replies`, or an object (see the description) | All | What agent panes show: a preset name (full, standard or replies) or an object with the five switches. A view only changes what the pane lists; the rows, the history, search, copy and the agent's context stay complete. A pane can have its own view (View menu in the pane); one without follows this setting. Default: full. |
| `markdown:streamtailinplace` | boolean | `true` | — | All | While a message streams, update the still-open last block's text in place instead of rebuilding that block on every update (a growing code block, paragraph, list item or table cell). Set false to restore rebuilding it each time. Takes effect when a message is next rendered. |
| `agent:retryonreconnect` | boolean | `true` | — | All | When an agent's turn failed because its model API couldn't be reached, retry it once by itself when the API answers again, if no tool ran in it, you started it, and you haven't typed in that pane since. Set false to only offer a Retry button. |
| `agent:compactat` | integer | `600000` | 0 or more | All | The context size, in tokens, at which Claude agents compact automatically. AgentMux writes Claude Code's autoCompactWindow (this plus 33,000, between 100,000 and 1,000,000) into each Claude config dir it prepares, unless a person set their own value there; it takes effect when each agent next starts. 0 leaves Claude Code's own point, about 967,000 on a 1M window. |
| `cli:usepath` | list of strings | `[]` | — | All | Agent CLIs to run from your own copy on PATH instead of the one AgentMux installs and pins, by provider id (for example goose). Off for every CLI by default: AgentMux runs only its own copy and never touches yours. Set it from a CLI's row in Toolchain (Use the CLI on my PATH). |
| `agent:subagentmodel` | string | `"sonnet"` | — | All | The model Claude agents' general-purpose sub-agents run on: sonnet, haiku, opus, a model ID, or inherit to leave Claude Code's own (the agent's model). AgentMux sets CLAUDE_CODE_SUBAGENT_MODEL when an agent starts, so a sub-agent that names its own model, or a model the agent passes per call, still wins. A pane's block meta agent:subagentmodel overrides it for that agent. |
| `agent:exploremodel` | string | `"haiku"` | — | All | The model Claude agents' Explore sub-agents run on: haiku, sonnet, opus, a model ID, or inherit to remove AgentMux's Explore definition and leave Claude Code's built-in (the agent's model). AgentMux writes a user-level Explore agent into each Claude config dir it prepares, unless a person wrote one there. It takes effect when each agent next starts. |
| `agent:compacthints` | boolean | `true` | — | All | At the end of a turn whose context is at least agent:compacthintat tokens, give the agent one [AgentMux] note suggesting it compact itself (Agents compact, with what to keep) if its next work continues the task. Once per crossing: again only after the context has dropped below 250,000 tokens. Set false to turn the notes off. |
| `agent:usagenoticeat` | integer | `75` | 0 to 100 | All | The percent of an account's usage window (the 5-hour or the weekly one, as Claude Code reports it with every request) from which the leaders of the agents on that account get one [AgentMux] note, once per window. The note is held for the leader's next turn and never starts one. 0 turns it off. Identity accounts shows the same figures any time. |
| `agent:usagenoticehighat` | integer | `90` | 0 to 100 | All | The percent of an account's usage window from which the leaders of its agents get a second, stronger note (agent:usagenoticeat is the first), once per window. 0 turns it off. |
| `agent:freshhintat` | integer | `150000` | 0 or more | All | The context size, in tokens, from which a turn that finished a Kanban task (Tasks complete or submit) gets the agent:compacthints note suggesting a fresh session (Agents fresh, with a handoff) if its next work is unrelated. |
| `agent:compacthintat` | integer | `400000` | 0 or more | All | The context size, in tokens, from which the agent:compacthints note suggests compacting. Keep it below agent:compactat, so the agent can compact at the end of a turn before Claude Code compacts on its own mid-task. |
| `agent:compactbackstopat` | integer | `600000` | 0 or more | All | The context size, in tokens, over which AgentMux compacts a container agent itself, between turns, when the agent has not acted on the agent:compacthints note: at the head of the container's queue, ahead of the messages waiting. Two tries; if the context is still over after them, the agent's pane shows a warning and its leader is told. 0 turns it off. A route agent has its own limit, from its model's budget. |
| `agent:overlapnotes` | boolean | `true` | — | All | When an agent edits a file another agent on this computer has uncommitted or edited in the last two hours (same repository and path, in any clone), AgentMux sends the editing agent a short [AgentMux] note naming the other agent, so it can message them first. Rate-limited: one note per other agent and file every two hours, three per agent per ten minutes. Set false to turn the notes off. |
| `agent:mcpselfheal` | boolean | `true` | — | All | When an agent's AgentMux MCP server (its AgentMux tools) doesn't connect, AgentMux reconnects it twice, then restarts the agent once without the shell prefix (the conversation continues), and otherwise tells the agent and shows it in the pane. Set false to only show and tell, with no automatic repair. |
| `agent:outdatedidsnotice` | boolean | `true` | — | All | Tell you once, at startup, when some agents have an id an older build chained (loap-loap-2), pointing to Settings › Agents, where they can be updated. Turned off when the notice is dismissed. |
| `agent:maystartagents` | boolean | `false` | — | All | Let agents start other agents (workers, or a new agent in My Agents) without showing you a notice first. Off by default: the first time an agent starts one, its pane shows a card with a 30 second countdown that goes ahead on its own, with Stop it, Start now and Always allow this agent. Turn this on to skip the card for every agent. |
| `agent:transcriptsinglecopy` | boolean | `false` | — | All | Write a defined agent's transcript to the agent's own zone in the global transcript store only, not also to the block's own store. Halves what AgentMux writes to disk while agents run (measured: srv bytes written -50%, srv CPU -43%). Quick-launch panes and writers that have lost the agent lease keep their own copy. Off until it has been through a soak. |
| `agent:accountfailover` | boolean | `true` | — | All | On by default; set false to turn it off. When an agent hits its usage limit, AgentMux moves it, after its turn, to another signed-in account of the same provider that has quota, and tells the agent and its lead in one note. It never picks a signed-out account or one marked "never fail over to this" (right-click an account in Connectors). |
| `agent:transcriptframes` | boolean | `true` | — | All | On by default; set false to turn it off. Compress the finished parts of agent transcripts in the global transcript store, 1 MiB at a time (about 6x smaller). Only parts at least 8 MiB from a transcript's end and received over a day ago; nothing a reader sees changes. Waits while an AgentMux build that can't read compressed history runs on this machine. |
| `agent:transcriptdeltas` | boolean | `true` | — | All | With agent:transcriptframes on, also store each streamed reply's text once instead of once per streaming line (about 11% smaller again). Off: compression alone. |
| `agent:askquestiontimeoutms` | integer | `30000` | 1000 or more | All | How long an AskUserQuestion panel waits for a human before auto-selecting the recommended option(s) and submitting, in milliseconds. Default 30000 (30s). |
| `message:refuse_bare_acks` | boolean | `true` | — | All | Refuse a message that is only an acknowledgement ("ok", "thanks", "on it") to an agent that wrote to the sender in the last 30 minutes, since every message starts a turn that reads the recipient's whole context. |
| `agents:always_available` | any | `true` | — | All | Closing an agent's pane does not stop the agent: it keeps running and can still be messaged, until the idle and cap limits stop it. Off by false, "false", "off", "no", "0" or 0. |
| `agent:climessaging` | boolean | `false` | — | All | Leave the Claude CLI's own cross-session messaging on for Claude agents. Off, agents message each other through AgentMux only. |
| `agent:claudeaiconnectors` | boolean | `false` | — | All | Load the signed-in claude.ai account's connectors (Gmail, Calendar, Drive, Docs) into Claude agents. Off, agents use AgentMux's own Google tools, which the person turns on per agent in Connectors. Takes effect at an agent's next launch. |
| `jekt:cold_hold_minutes` | number | `55` | 0 or more | All | Minutes of quiet after which an agent's session counts as cold: a message that can wait is then held until the agent is next active, so it does not start a turn that pays for the whole context again. 0 turns the hold off. |
| `agent:belownormalpriority` | boolean | `true` | — | All | Run agents' process trees at below-normal CPU priority, so their builds and tests yield to AgentMux and your foreground apps. |
| `fleet:quota_mode` | string | `"off"` | — | All | While "tight" (any case, spaces ignored), a routine message to an idle agent is held and an unnamed task claim takes only tasks at or above fleet:quota_min_priority. Anything else is off. |
| `fleet:quota_min_priority` | integer | `1` | — | All | The lowest task priority an unnamed claim takes while fleet:quota_mode is "tight". |
| `agent:stopkeepsbackground` | boolean | `true` | — | All | Stopping an agent keeps its background tasks (dev servers) running when the caller does not say. |
| `agents:idle_stop_minutes` | number | `60` | 0 or more | All | Minutes an agent that is in no pane may sit idle before it is stopped (a message starts it again). 0 never stops it. |
| `agents:max_running` | integer | `24` | 0 or more | All | The most agent processes running at once. Over it, the agent idle longest with no pane is stopped to make room, or the start is refused. 0 means no cap. |
| `agents:commit_limit_pct` | number | `85` | 0 to 100 | Windows | Windows only: memory commit, as a percent of the limit, above which the agent idle longest with no pane is stopped to make room. 0 turns the check off. |
| `agents:defaultruntime` | string | `"container"` | — | All | Where a new agent runs when nothing else says: container, or native (host also means native). Applies to agents created after the change. |
| `agents:start_per_minute` | integer | `5` | 0 or more | All | The most agents one sender (an agent, a job) may start in a minute; a start over it is refused. 0 turns the limit off. |

## Swarm supervisor

| Key | Type | Default | Allowed values | Platform | Description |
|---|---|---|---|---|---|
| `supervisor:enabled` | boolean | `false` | — | All | The Swarm Supervisor's master switch. While off, nothing is judged or continued, a pane can't be set to Steady or Drive, and a mode set earlier is not read. |
| `supervisor:steady:continuations` | integer | `5` | 1 to 100 | All | Steady: how many continuations in a row the Supervisor sends before it stops and hands the agent back to you. Takes effect at the next decision. |
| `supervisor:steady:minutes` | integer | `0` | 0 to 1440 | All | Steady: stop after this many minutes from a run's first continuation. 0 is no time cap. |
| `supervisor:drive:continuations` | integer | `15` | 1 to 100 | All | Drive: how many continuations in a row the Supervisor sends before it stops and hands the agent back to you. Takes effect at the next decision. |
| `supervisor:drive:minutes` | integer | `120` | 0 to 1440 | All | Drive: stop after this many minutes from a run's first continuation. 0 is no time cap. |
| `supervisor:noprogress` | integer | `2` | 1 to 10 | All | Stop after this many continued turns in a row that used no tool, in either mode. |
| `supervisor:cooldown` | integer | `30` | 0 to 600 | All | Seconds the Supervisor waits between a turn's end and its continuation. A turn that starts in that time (your message, a jekt, a job, a Schedule injection, a Stop) cancels it. 0 sends at once. |
| `supervisor:hourly` | integer | `30` | 0 to 1000 | All | The most continuations the Supervisor sends across all panes in a rolling hour. At the cap it stops continuing until the hour rolls. 0 is no cap. |
| `supervisor:notify:needsyou` | boolean | `true` | — | All | Send an OS notice when the Supervisor stops because the agent needs you (a question, needs you, blocked). |
| `supervisor:notify:limit` | boolean | `true` | — | All | Send an OS notice when the Supervisor stops at a limit (continuations, time, no progress, the same reply twice, the fleet budget). |
| `supervisor:notify:failed` | boolean | `true` | — | All | Send an OS notice when the Supervisor couldn't continue (the message couldn't be delivered, the agent can't run). |
| `supervisor:notify:done` | boolean | `true` | — | All | Send an OS notice when the Supervisor finds the work done. |

## Kanban

| Key | Type | Default | Allowed values | Platform | Description |
|---|---|---|---|---|---|
| `kanban:reminders` | boolean | `false` | — | All | Remind an idle agent of the tasks waiting in its Kanban backlog: after two minutes idle, one short [AgentMux] note naming them, once each time it goes idle. Off by default; also switched in the Kanban's toolbar. |
| `kanban:closeonmerge` | boolean | `true` | — | All | A task is closed when its pull request merges. |
| `kanban:reviewlimit` | integer | `0` | 0 or more | All | How many tasks the board may hold in Review before its header says so. 0 means no limit. |

## Browser panes

| Key | Type | Default | Allowed values | Platform | Description |
|---|---|---|---|---|---|
| `browser:hibernate` | boolean | `true` | — | All | A browser pane out of sight for a while hibernates: its page closes to free its memory (often 100 to 200 MB) and loads again when you're about to look at it, with a note while it restores. Never a pane an agent is using, one playing or capturing media, one with something typed into it, or a local dev server. Off: browser panes keep running while hidden. |
| `browser:hibernateafter` | number | `30` | 1 or more | All | Minutes a browser pane is hidden before it hibernates. Sooner when the computer is low on memory: 5 minutes, then 1. |
| `browser:keepawakesites` | list of strings | `[]` | — | All | Sites whose browser panes never hibernate, by host (example.com) or origin (https://example.com). |
| `browser:searchsuggestions` | boolean | `true` | — | All | A browser pane's address bar also asks the default search engine for suggestions while you type, sending it each edit before you submit, as Chrome does. On by default. Incognito tabs never ask (Chrome refuses suggest requests from off-the-record profiles). Off: suggestions come only from this computer (history, typed addresses). |
| `browser:askdownloadlocation` | boolean | `true` | — | All | A download in a browser pane opens the system Save As dialog, so you choose where it goes. On by default. Off: a download saves into your Downloads folder, under a name that doesn't replace a file, and the strip under the address bar shows it. |

## Jobs

| Key | Type | Default | Allowed values | Platform | Description |
|---|---|---|---|---|---|
| `jobs:cap:runusd` | number | `5` | 0 or more | All | The most one job run may spend, in US dollars. A run that reaches it is stopped. A job can set a lower figure of its own; only you raise it. |
| `jobs:cap:jobdayusd` | number | `20` | 0 or more | All | The most one job may spend in a day, in US dollars. A day ends at your local midnight. A run starts only if the day's spend plus the run's cap still fits; later runs that day are skipped. |
| `jobs:cap:accountdayusd` | number | `50` | 0 or more | All | The most all job runs on one account may spend in a day, in US dollars. A day ends at your local midnight. Interactive work isn't counted. |
| `jobs:cap:messagesday` | integer | `24` | 0 or more | All | The most messages one job may send in a day to an agent other than its owner. Further fires that day are skipped. |

## Desktop control

| Key | Type | Default | Allowed values | Platform | Description |
|---|---|---|---|---|---|
| `desktop:enabled` | boolean | `false` | — | Windows | Let agents look at and control native desktop apps with the Desktop tool (Windows only for now). Off by default. Even when on, an agent can use an app only after you allow it, for a while or for its session, and you can stop it at any time; every action is logged. Web browsers, password managers and AgentMux itself are refused. |
| `desktop:blocklist` | list of strings | `[]` | — | All | App names the Desktop tool must never control, added to the built-in list. An entry matches an app's name exactly (notepad) or any part of a window's title (bank). |
| `desktop:allowlist` | list of strings | `[]` | — | All | App names to take off the built-in Desktop blocklist, for example a browser you want an agent to control. AgentMux itself can't be taken off. |
| `desktop:grantminutes` | integer | `30` | 1 to 1440 | All | How many minutes "Allow for a while" lasts when you allow an agent to control an app. |

## Files pane

| Key | Type | Default | Allowed values | Platform | Description |
|---|---|---|---|---|---|
| `files:icons` | string | `"system"` | `"system"`, `"app"` | All | Which icons the Files pane shows for files and folders: "system" is the picture the operating system shows for each type (the same as Windows Explorer), made by srv; "app" is AgentMux's own monochrome glyphs. Where the system has no source yet, or an icon can't be made, the glyph shows. |

## Editor

| Key | Type | Default | Allowed values | Platform | Description |
|---|---|---|---|---|---|
| `editor:lsp.enabled` | boolean | `true` | — | All | Language-server features in the Editor (diagnostics, hover, completion). false turns them off. |

## Network

| Key | Type | Default | Allowed values | Platform | Description |
|---|---|---|---|---|---|
| `network:lan_discovery` | boolean | `false` | — | All | Enable mDNS-based discovery of other AgentMux instances on the same host and LAN. Defaults to false to avoid the Windows Firewall prompt; toggle from the HostPopover panel. |
| `network:remote_ops` | boolean | `true` | — | All | Carry out typed requests from agents on other proven machines (account moves, version and health reads, and the operations that follow). Default true (absent means on); set false to refuse every one. |

## Cloud and sharing

| Key | Type | Default | Allowed values | Platform | Description |
|---|---|---|---|---|---|
| `viewer:shareterminals` | boolean | `false` | — | All | Share terminals with paired devices: a device paired with this computer can watch its terminals, read-only (GET /agentmux/viewer/terminals/:block_id/feed). Default false (absent means off), since terminal scrollback often holds secrets. The shell of an agent hidden from paired devices stays hidden. Turning it off closes feeds already open. |
| `cloud:publishpresence` | boolean | `true` | — | All | Publish this computer to my devices: while signed in to MuxBus Cloud, tell the cloud this computer is online so your signed-in devices can list it from anywhere. Default true; set false to stop, which also tells the cloud this computer went offline. Dev builds, headless installs, isolated homes and test harnesses never publish, whatever this says. |
| `swarm:sharesummaries` | boolean | `true` | — | All | Share what my agents are working on: other AgentMux instances on this computer and on the local network show each agent's summary line in their Swarm, from GET /agentmux/reactive/agent-names (readable with the LAN key). Default true (absent means on); set false to share status only. |
| `tower:sharewithpaired` | boolean | `false` | — | All | Let paired devices see this computer's processes in their Tower. |
| `audit:sharewithpaired` | boolean | `false` | — | All | Let paired computers on your network read this computer's Audit in theirs: which agents did what, never message text. |

## Messaging

| Key | Type | Default | Allowed values | Platform | Description |
|---|---|---|---|---|---|
| `messaging:discord:enabled` | boolean | `false` | — | All | Connect the Discord bridge at startup. |
| `messaging:discord:token` | string | — | — | All | Discord bot token (discord.com/developers/applications, Bot, Token). |
| `messaging:discord:channel` | string | `""` | — | All | Channel ID whose messages come in, and where sends go by default. |
| `messaging:discord:target` | string | Unset | — | All | Agent ID that receives Discord messages. Unset: they are logged, not forwarded. When left out: unset forwards to no agent. |
| `messaging:discord:guild` | string | Unset | — | All | Guild ID for guild-scoped slash commands. When left out: unset registers none. |
| `messaging:telegram:enabled` | boolean | `false` | — | All | Start the Telegram bridge (long polling) at startup. |
| `messaging:telegram:token` | string | — | — | All | Telegram bot token from @BotFather. |
| `messaging:telegram:allowed_chats` | string | `""` | — | All | Comma-separated chat IDs allowed to reach the bridge; updates from any other chat are dropped. |
| `messaging:telegram:default_chat` | string | Unset | — | All | Chat ID that outbound sends go to when a request names none. When left out: unset requires the request to name a chat. |
| `messaging:telegram:target` | string | Unset | — | All | Agent ID that receives Telegram messages. Unset: they are logged, not forwarded. When left out: unset forwards to no agent. |
| `messaging:slack:enabled` | boolean | `false` | — | All | Open the Slack Socket Mode connection at startup. |
| `messaging:slack:bot_token` | string | — | — | All | Slack bot token (xoxb-...) for Web API calls. |
| `messaging:slack:app_token` | string | — | — | All | Slack app-level token (xapp-...) for Socket Mode, scope connections:write. |
| `messaging:slack:channel` | string | `""` | — | All | Channel ID whose messages come in, and where sends go by default. |
| `messaging:slack:target` | string | Unset | — | All | Agent ID that receives Slack messages. Unset: they are logged, not forwarded. When left out: unset forwards to no agent. |
| `messaging:whatsapp:enabled` | boolean | `false` | — | All | Start the WhatsApp Cloud API bridge and its webhook routes. |
| `messaging:whatsapp:phone_number_id` | string | `""` | — | All | WhatsApp Business phone number ID (Meta App Dashboard, WhatsApp, API Setup). |
| `messaging:whatsapp:access_token` | string | — | — | All | System User access token (permanent). |
| `messaging:whatsapp:app_secret` | string | — | — | All | Meta App Secret, used to check the signature on inbound webhooks. |
| `messaging:whatsapp:webhook_verify_token` | string | — | — | All | Verify token for the webhook handshake; must match Meta App Dashboard, WhatsApp, Configuration. |
| `messaging:whatsapp:target` | string | Unset | — | All | Agent ID that receives WhatsApp messages. Unset: they are logged, not forwarded. When left out: unset forwards to no agent. |
| `messaging:whatsapp:fallback_template` | string | Unset | — | All | Template name for sends outside the 24 hour customer service window. Unset: such a send fails at once. When left out: unset fails sends outside the window. |
| `messaging:whatsapp:fallback_template_lang` | string | `"en_US"` | — | All | Language code (BCP-47) of that template. |
| `messaging:whatsapp:tunnel_domain` | string | `""` | — | All | Public origin of your tunnel (for example wa.example.com), printed in the startup log as the callback URL to register with Meta. AgentMux does not start the tunnel. |

<!-- end generated -->
