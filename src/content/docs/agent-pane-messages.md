---
title: What the agent pane shows
description: "Every kind of row an agent pane can show, with one name for each: where it comes from, what it looks like, whether it opens and closes, how much room it takes, and which providers produce it."
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

An [agent pane](/pane-types/#agent) shows a lot more than the conversation. This page names every kind of row it can show, so that "the explainer text", "the italic text" and "the grey line about the cloud" each have one name. The names here are the ones the other docs use. Each row also gives the name the code uses, for anyone reading the source or a bug report.

The pane has three places where things appear:

1. **The transcript**, the scrolling list in the middle. Everything in [the transcript table](#the-transcript) lives here, in the order it happened.
2. **The strip above the message box**: things waiting for you, running work, and status. See [Around the transcript](#around-the-transcript).
3. **Overlays**: a hover preview and the `/btw` side question.

By default AgentMux shows **everything** the agent does. The pane's **View** chooses how much of the routine work you see: see [Choosing what the pane shows](#choosing-what-the-pane-shows).

## How rows open and close

Most rows are one line that you can open. The same four rules apply to all of them (`frontend/app/view/agent/virtualization/disclosure.ts`):

- **Fixed**: always shown in full, with nothing to open. Replies, your own messages and most notes are fixed.
- **Open, you can close it**: shown in full; click the row's header (or press `e` with it focused) to fold it to one line.
- **Closed, you can pin it open**: one line; click the header (or press `e`) to pin it open, and again to close it.
- **Held open while it is on screen**: a row that arrives while you are looking at it, such as a tool call that finishes or a message from another agent, stays open until it scrolls off the top of the pane, and is a closed line from then on. Nothing is closed under your eyes, and nothing needs a timer.

Hovering over a row that has a time shows a small preview with the exact time, how long ago it was, and an estimate of its size in tokens.

Where a row's body is long, it is capped: a body inside a row scrolls within a box of about one sixth of the window height (about 13 lines on a tall window). The reply text itself is never capped.

## The transcript

| Name | What it is, and where it comes from | Looks like | Open or closed | Room |
|---|---|---|---|---|
| **Your message** (`user_message`) | What you typed, or a message AgentMux sent as you. | Inverted colours (your text colour as the background) with a thick bar on the left; long lines scroll sideways instead of wrapping. Images you attached show as thumbnails. | Fixed | A few lines |
| **Startup context** (`user_message`, startup) | The text AgentMux gives the agent when a session starts: the session context, [Global Memory](/memory/), the workspace rules. Recognised by its `# Session Context` heading. | One summary line in the same style as your message | Closed; hover to peek, click to pin | One line, or up to the whole text when pinned |
| **Broadcast message** (`user_message`, broadcast) | A message you sent to several agents at once from the [Swarm](/subagent-watcher/#fleet-toolbar). AgentMux strips the `[BROADCAST:…]` line it wrote and shows a badge in its place. | Your message, with a broadcast badge and the number of recipients | Fixed | A few lines |
| **Supervisor message** (`user_message`, supervisor) | The nudge the [Supervisor](/subagent-watcher/#supervisor) sends to keep an agent going. The `[SUPERVISOR:…]` line becomes a badge with the mode and the count. | Your message style, with a Supervisor badge (mode, `N/total`) | Fixed | A few lines |
| **Reply** (`markdown`) | The agent's own words: the explanation between tool calls and the final answer. Text from the model, streamed as it arrives. In bug reports this is "assistant text" or a markdown block. | Normal text with Markdown rendering and highlighted code | Fixed | As long as the answer: from a line to most of the pane |
| **Thinking** (`markdown`, thinking) | The model's reasoning, for providers that send it. | Italic, dimmed to about 60% opacity, with a thin bar on the left and a faint tint | Fixed (always shown) | A few lines to many; as long as the reasoning |
| **Canceled thought** (`markdown`, canceled) | A thought or reply that was cut off when the turn ended or the agent stopped. | Dimmed, headed "Canceled — partial thought" | Closed; click to open | One line |
| **Tool row** (`tool`) | One call the agent made to a tool: a command, a file read or edit, a search, an MCP tool. Created when the call starts and updated in place with its output and result. See [Tool rows](#tool-rows). | One line: status icon, tool name, the path or command, how long it took | Open while it runs; held open when it finishes on screen; then closed. Pin to keep open | One line; open: a box capped at about 13 lines that scrolls |
| **Question and answer** (`tool`, AskUserQuestion) | When an agent asked you something and you answered, the pair stays in the conversation. While it waits, see [Question panel](#around-the-transcript). | The question as a reply, then your answer as your message. A cancelled question says "Cancelled — no answer provided" | Fixed | A few lines |
| **Shell** (`shell`) | A persistent shell the agent keeps in the [details drawer](/pane-types/#persistent-shell): one row per shell. | One line: title, status (running, exited ok, exited with an error, stopped) and elapsed time or exit code | Closed even while running; pin to open | One line; open: the live log, capped |
| **Agent message** (`agent_message`) | A message sent between agents through the older `mux` or `ject` route, in either direction. | A thin bar on the left (bright for incoming, dim for outgoing), the two names and a ▸/▾ chevron | Open; you can close it | One line, then a few lines |
| **Jekt** (`jekt_message`) | A [jekt](/glossary/#jekt): a message from another agent, a person's device, a job or AgentMux. AgentMux reads the `[JEKT:…]` block the agent received and shows a bubble instead. See [Jekts](#jekts). | A bar on the left, an arrow for direction, the other agent's name, and two small badges: tier and delivery | Closed; held open when it arrives on screen; a `sensitive` jekt is open by default | One line; open: a few lines, with the details underneath |
| **System note** (`system_note`) | A note AgentMux added to a message, starting `[AgentMux] `. See [System notes](#system-notes). | Small muted text with a thin bar on the left | Fixed | One or two lines |
| **Ambient line** (`ambient_narration`) | A short line AgentMux wrote itself about something happening, such as a command moving to the background. It never reaches the agent's own history. | Like reply text, with a small `ambient` tag at the end | Fixed | One or two lines |
| **Error** (`agent_error`) | The provider's or the API's error when a turn ends (an HTTP code and the message). A **401** or **403** adds a **Login Again** button. | An error-coloured block | Fixed | One to three lines |
| **Compacting** (`compaction_started`) | A compaction of the agent's context is under way. | "Compacting conversation…" and why: "you ran /compact" or "context filled up" | Fixed | Two lines |
| **Context compacted** (`context_compacted`) | The compaction finished: where the context was cut. | A rule labelled "context compacted", with who asked, and "Earlier history summarized · 850→450 tok", plus how long it took | Fixed | Two lines |
| **Memory reinjected** (`memory_reinjection`) | After a compaction AgentMux sends the agent its memory again in a hidden message. This row replaces that message and says what was sent. | "Memory reinjected — N global, M personal (about X tokens)", coloured by size; hover for each entry | Fixed | One line |
| **Context delivered** (`context_delivery`) | A card for everything the agent was handed at one moment: the startup files and memory, a compaction summary, or the output of a slash command. | "Context delivered", the size and a chip for each item (memory entry, file, summary), with a "Partial" mark on an item that was cut | Closed; pin to read the items' text (fixed when no item has text) | One or two lines; pinned: each item in a capped box |
| **Session outcome** (`session_outcome`) | Whether the agent could pick up its earlier conversation when it started. | A rule: "Session continued", "Session continued · reconstructed context" or "New session started", and for a fresh start a line saying what the agent does not have | Fixed | One or two lines |
| **CLI notice** (`cli_notice`) | AgentMux's own report about the agent's program. See [CLI notices](#cli-notices). | A line, coloured by tone (information, success, warning or error), sometimes with a second line or a button | Fixed | One or two lines |
| **Resume check** (`resume_preflight`) | Before the first message of a resumed pane: whether the agent will continue its conversation or start a new one. Never saved; it comes and goes. | "Checking whether this conversation can resume…", then "This agent will reconnect to its conversation…" or "…start a new conversation — the history below isn't available to it." | Fixed | One line |
| **History link** (`history_link`) | A row at the top of the live transcript, and at gaps in it, that opens [Agent History](/pane-types/#agent-history). Not saved. | A row with an hourglass, "Earlier turns in the history" or a skipped-turns count, and "Open Agent History →" | Fixed | One line |
| **Day divider** (`day_divider`) | A date separator, shown in Agent History only. Not saved. | A rule with the date, like "Sun, Aug 10 2026" | Fixed | One line |

### Tool rows

A tool row has a status, and the status decides how it opens:

| Status | Icon | Meaning | Open? |
|---|---|---|---|
| running | ⏳ | The call is in progress. A live tail of the latest output shows in the row | Open |
| awaiting approval | ⚠ | The provider is asking whether it may run. The [approval panel](#around-the-transcript) appears above the message box | Open |
| awaiting answer | ❓ | The agent asked you a question. The [question panel](#around-the-transcript) appears above the message box | Not applicable |
| ok | ✓ | It finished | Held open while on screen, then closed |
| failed | ✗ | It finished with an error | Held open while on screen, then closed |
| denied | ⊘ | You refused it | Closed |
| canceled | ⏹ | The turn or the agent ended before it finished | Closed |

A tool whose answer is the point, such as a web search, is open and can be closed once it has finished, like a reply.

The one-line name and the body depend on the tool. AgentMux sorts the provider's tool names into the ones below; anything else, including every MCP tool, is shown as **Other**.

| Tool | Row's body when open |
|---|---|
| **Bash** (Codex and some others call it `Shell`) | The command and its output, highlighted, streaming while it runs; a long output keeps its end visible and says how many lines are hidden |
| **Read** | A preview of the file, as Markdown or highlighted code, with the range read; images and PDFs show their facts instead |
| **Write** | The file as written, as Markdown or highlighted code |
| **Edit** | A diff of the change |
| **Grep**, **Glob** | The matches or the files found, as a list |
| **Agent**, **Task**, **Workflow** | A card for the work handed to a subagent or a set of them, with its live status. The subagents also appear in the [activity dock](#around-the-transcript) and in the [Swarm](/subagent-watcher/) |
| **Other** | The result as plain text, a terminal-style output, or collapsible structured data |

The row's colour follows its status: a coloured bar on the left for running, ok, failed and canceled, and the tool's own colour for a finished tool. A pinned row has an accent bar.

### Jekts

A jekt is shown as a bubble, not as the raw message. Its header line shows the direction, the other party, and two badges:

- **Tier**: `info`, `coord` or `sensitive`. A `sensitive` jekt has an error-coloured bar and is open by default.
- **Delivery**: how it reached the agent: `host` (this computer), `channel` (another AgentMux on this computer), `lan` or `wan` (the cloud relay).

Open it for the message, its attachments, and the details: who it is from and to, its message id, how far the sender is trusted (`host-verified`, `channel-verified`, `lan-verified`, `wan-verified`, `self-declared`, `unverified` or `network-claimed`), its priority and time, and how long it was held if the agent could not take it (it was stopped, signed out, out of quota or idle). A jekt whose sender asked for no answer carries `REPLY=none` in its marker; a reply to it is refused. **Raw payload** shows the marker block exactly as the agent received it. See [Interagent communication](/internals/interagent-comms/) and the [trust model](/security/trust-model/).

### System notes

A system note starts with `[AgentMux] ` and states a fact about AgentMux itself. AgentMux's own notes do not start a turn: it holds them and attaches them after the next message the agent's pane receives (yours, a jekt, a broadcast or a scheduled prompt), or joins them to the turn in flight, and AgentMux splits them into their own rows. A pane holds at most eight at a time, the oldest dropped first. A note the agent must have at once, such as a worker's report to its lead, is delivered as input. The notes about cloud delivery are:

- **Paused**: "Cloud messages are paused since 14:22 (reason). Review and CI notices won't arrive; check your PRs directly until they resume."
- **Outage**: the same, once it is over: "Cloud messages were paused 14:22–16:31 …".
- **Resumed**: "Cloud messages resumed at 16:31: 3 delivered."
- **Expired**: "Cloud messages expired undelivered: …" with what was lost.
- **Late delivery**: a message that reached the agent more than two minutes after it was sent starts with "(sent 14:30, delivered 14:41)"; the row shows it as a small note on the message.

Notes about another agent working on the same file ("Agent4 also has uncommitted changes in …") use the same `[AgentMux]` marker and show as system notes too.

The turns Claude Code writes itself are shown as notes as well, not in your message style: a background command's or Monitor's notice, a system reminder, a local command's output and a hook's output. A turn counts only when it is nothing but those blocks; a message of yours that mentions one stays yours.

### CLI notices

A CLI notice is AgentMux talking about the agent's program, not the agent. One row is updated in place as a thing progresses. The kinds:

| Kind | What it says |
|---|---|
| Install | "Installing Claude Code 2.1.285…", then "Installed … (14 s)" or "Couldn't install …" |
| Version changed | "Claude Code updated: 2.1.218 → 2.1.285", with a warning when the running version isn't the one AgentMux pins |
| Compaction failed | "Claude Code couldn't compact the conversation", with the reason |
| AgentMux tools (MCP health) | "AgentMux tools didn't connect. Reconnecting (try 1 of 2)…", then "…are connected again" or "…couldn't repair them" |
| Container start | "Downloading the agent image… 42%", "Starting the container…", "Container ready (12 s)" or "Couldn't start the container" |
| Container image | "This container uses the 0.59.41 image" with an **Update container** button, then "Container removed. The next message starts it from the 0.60.2 image"; or, when AgentMux moved an idle agent's container itself, "Updated the container to the 0.60.2 image" |
| Container limits | "Container limits: Memory limit 16 GB, 6 CPUs, set by Agent1" when a limit changes, "Docker did not take the new container limits", or "A process in this container was stopped: it ran out of its 8 GB memory limit" with a **Raise the limit** button. See [CPU and memory limits](/container-agents/#cpu-and-memory-limits) |
| Container caches | "This agent's build caches hold 24.0 GB" with a **Container settings** button, once the agent's caches reach 20 GiB. See [Build caches](/container-agents/#build-caches) |
| Agent ready | "Ready: send a message to start", when a container agent is up and nothing is on its way |

## Around the transcript

These are not rows in the transcript. They sit above the message box, or float, and most go away when what they say is over.

| Name | What it is | Looks like | Dismissed by |
|---|---|---|---|
| **Approval panel** | The agent wants to run a tool that needs your permission (a tool row in *awaiting approval*). It shows the tool, its target and why, a preview (a diff, the command or text), and a scope: **Once**, **Session**, **Project** or **Global**. Buttons **Allow**, **Deny** (with feedback) and **Defer**. A risky request needs `Shift`-click or a double `Enter` to allow. More waiting show as "N more queued" | A panel above the message box. `Esc` or **Defer** folds it to a button, "Decision pending — <tool>" | You decide. It never times out |
| **Question panel** | The agent called AskUserQuestion. Questions with options (one or many) or a free-text **Other**; the agent's recommendation is marked "(Recommended)". Buttons **Cancel**, **Accept Recommended** and **Submit answer** | A panel headed "The agent is asking", with a countdown "Auto-selects recommended in 30s" | You answer, or the countdown ends (`agent:askquestiontimeoutms`, default 30 s; it waits while you move the mouse or type). It works in a background tab |
| **Queued messages** | Messages you sent while the agent was busy: "Queued — sends at the agent's next step; ↑ to edit, Esc to send now", then "Sending — reaching the agent any moment" | The message text in a box above the message box | It reaches the agent |
| **Activity dock** | Work that is still going: shells, subagents, long-running tool calls and cron jobs. Sorted running first, then newest | Up to three rows, each with a status icon, name, elapsed time and buttons; the rest fold into "▸ N more" | A finished row stays for a few seconds (8 s when done, 3 s when stopped, 15 s when it failed), then goes |
| **Retry row** | "Can't reach the API. Retrying: attempt 3 of 10, next in 18 s." with a **Stop** button | One line, counting down | It connects, or you stop it |
| **Preparing row** | A container agent is starting: **Preparing…** and the phase. Not a turn: it has no timer and what you type isn't queued behind it | A spinner line above the message box | The container is up |
| **While you were away** | A one-line digest of what happened while the pane was hidden: "3 turns · 2 jekts (Agent1, Agent2) · 1 finished task" | One line with a close button | You close it |
| **Session notices** (Claude Code) | "Session was interrupted by a restart. Your next message will resume it."; "Couldn't resume the previous conversation — started a new one." (goes after 15 s); "Session has X lines. Consider archiving…" with **Archive**; "Archived" with **Restore** and **Export** | Banners above the message box | You dismiss them or act |
| **Stopped banner** | "This agent is stopped. Its conversation is kept; Start runs it again from where it left off." with **Start** | A banner | You start the agent |
| **Disconnected banner** | "Disconnected from stream" and how long ago, with **Reconnect** | A banner | It reconnects |
| **History failed banner** | "Couldn't load this conversation's earlier messages …", or "Earlier history couldn't be loaded: the saved copy is damaged. The agent's own conversation is intact, and new messages are saved." | A banner | Close and reopen the pane |
| **Fork fallback banner** | "This provider doesn't support forking mid-conversation — started a fresh conversation instead of carrying history forward." | A banner | Stays |
| **Desktop driving bar** | "Driving <app>" or "May drive <app>", with **Stop**, when you have given the agent control of a native app | A bar | You stop it, or the grant ends |
| **Credentials revoked chip** | "Credentials revoked — this agent still holds tokens until restarted." | A chip with a close button | You dismiss it |
| **Failure row** | The agent's process ended and AgentMux knows why. See [Failure rows](#failure-rows) | A row with an icon, a title, a left bar in an error colour, and buttons | You act or dismiss it |
| **Side question** (`/btw`) | A floating panel for `/btw <question>`: the question and a streamed answer, which doesn't interrupt the agent's turn | An overlay with a close button | `Esc` |
| **Loading row** | "Loading conversation…" while the history loads | One line over the transcript | It loads |

### Failure rows

Each failure row has a title, a short explanation (with the exit code or signal, and "retryable" where it is), the buttons that fit, and on every row **Copy error** (**Copy details** when there is program output to copy), **Details** (the explanation and the end of the program's error output) and **×** to dismiss. A message the pane refused to send is not lost: the row quotes it ("not sent: …").

| Failure | Icon | Button |
|---|---|---|
| Sign-in rejected (401) | 🔐 | **Log in** or **Login Again**, **Login via terminal**, and **Use account…** (or **Use <name>** when one signed-in account fits; **Connectors → Accounts** when none does) |
| Rate limited (429) | ⏱ | **Retry now**, with a countdown: AgentMux retries by itself |
| Overloaded (529) | 🌀 | **Retry now**, with a countdown |
| Network | 🌐 | **Retry now**, with a countdown |
| Usage limit | 🚫 | **Accounts (switch / upgrade)**. AgentMux also moves the agent to an account with quota by itself when its turn ends (see [Identity & Accounts](/identity/#when-an-agent-hits-its-usage-limit)) |
| Context window full | 📏 | **New session**: resuming would fail again |
| Turn limit (`--max-turns`) reached | 🔁 | **Continue** |
| Killed (out of memory, or stopped from outside) | ⛔ | **Retry** |
| Couldn't start the program | 🧩 | **Provider setup** |
| Ended with no output | ❔ | **Retry** |
| Ended with an unrecognised error | ⚠ | **Retry** |
| The agent was deleted | 🗑 | none: Details and × only |
| Running in another AgentMux | ⇄ | **Take over**: click once to arm, **Confirm take over** to stop it there and run it here |
| Open in another pane | ⇄ | **Go there**, and **Move here**: click once to arm, **Confirm move here** |

## Providers

The agent pane reads each provider's output with a provider-specific reader in the frontend (`frontend/app/view/agent/providers/`, chosen from the provider's output format) that turns it into the same few events (text, thinking, tool call, tool result, the end of a turn, an error), so the rows above look the same whichever provider made them. This is separate from the Rust-side `Translator` trait that [Provider CLI integration](/internals/provider-cli-integration/) describes, which the drone runner uses. What differs is which events a provider sends.

| Provider (reader) | Reply | Thinking | Tool rows | Notes |
|---|---|---|---|---|
| **Claude Code**, **Mux Code** (Claude's stream) | Yes | Yes | Yes; names pass through: Read, Edit, Bash, Write, Grep, Glob, Task, Agent, Workflow, `mcp__<server>__<tool>` | The approval and question panels come from this stream, as do the session notices, and the subagent rows in the dock and the Swarm are tracked only for Claude Code |
| **Qwen Code** (Claude's stream, cache-aware) | Yes | Yes | Yes | Same shapes as Claude Code (it does not split cached tokens out) |
| **Codex CLI** | Yes | Yes (its reasoning, and its plan updates, shown as Thinking) | Yes: `Shell` (commands), `FileChange`, `WebSearch`, MCP tools | A command's output streams in the row |
| **Gemini CLI** | Yes | No | Yes (the tool's own name) | |
| **Kimi Code** | Yes | Yes | Yes | |
| **Antigravity** | Yes | No | Yes | |
| **OpenClaw**, **GitHub Copilot CLI**, **Pi**, **Kilo**, **Cline**, **Goose**, **Grok Build**, **DSH** (ACP) | Yes | Yes | Yes | |
| **OpenCode** (ACP) | Yes | Yes | Yes | Token use is read from the prompt's answer |
| **Muse Code** | Yes | Yes (reasoning appears once it completes, not while it streams) | Yes | |
| **Aider**, **Crush** | A terminal | No | No | No translator: the pane shows the program's own terminal output, and none of the rows above except the ones AgentMux adds itself (banners, notes) |

Tool names a provider uses that AgentMux doesn't recognise are shown as **Other** with the provider's own name.

## Choosing what the pane shows

A pane shows its whole conversation by default (the **Full** view). Its **View** hides the routine work that has finished, so a long run reads as the replies and what needs you. It changes only what the list shows: the rows, the pane's [History](/pane-types/#agent-history), search and copy stay complete (`frontend/app/view/agent/virtualization/verbosity.ts`).

Open the **View** popover from the view chip in the strip above the message box (beside **Shell**), from the pane's right-click menu, or with **Agent view…** in the command palette. It offers:

| Preset | What it does |
|---|---|
| **Full** | Everything, as the rows describe above. The default |
| **Standard** | Thinking, tool calls, jekts and messages between agents collapse to one line each; AgentMux notes stay; setup rows are hidden |
| **Replies** | Replies, your own messages and anything that needs you. Thinking, tool calls, jekts, messages between agents, AgentMux notes and setup rows are hidden |

Below the presets is one control per kind of row, so you can set a view of your own (the chip then reads **Custom**):

| Switch | Governs | Values |
|---|---|---|
| **Thinking** | The agent's reasoning, and a reply that was cancelled | Auto, Expanded, Collapsed, Hidden |
| **Tool calls** | Commands and their previews, reads, edits, searches, MCP calls and shells | Auto, Expanded, Collapsed, Hidden |
| **Jekts and agent messages** | Messages from other agents and jekts | Auto, Expanded, Collapsed, Hidden |
| **AgentMux notes** | The `[AgentMux]` notes (see [System notes](#system-notes)) | Shown, Hidden |
| **Context and setup** | Startup context, compaction progress, memory the agent was reminded of, context delivered, and informational CLI notices | Auto, Hidden |

**Auto** is the row's own behaviour from [How rows open and close](#how-rows-open-and-close). A run of hidden rows becomes one line, for example "12 tool calls, 3 thoughts hidden", with ", 2 failed" when some failed; click it to open the rows, and click again to close them. A row you pinned open stays visible in any view.

A switch only hides routine work that finished, or plumbing. Never hidden, whatever the view:

- a tool call that waits for your approval or your answer;
- a jekt that is sensitive, or whose sender nothing proved;
- a note that something was lost (a message that expired undelivered);
- errors, warnings, the outcome of a session, compaction having finished, and the date and history markers.

**Alt+V** cycles the focused pane through Full, Standard and Replies (a Custom view goes to Full first), and **Alt+Shift+V** gives the pane back to the default. The palette has **Agent view: Full**, **Standard**, **Replies** and **Follow default**.

A pane follows the default view until you change it, and then keeps its own, shown as **· this pane** on the chip. **Follow default** puts it back. **Make this the default** in the popover stores the view in the `agent:view` setting ([Agent settings](/settings/#agent-settings)): every pane that follows the default then shows it. Changing a switch also clears the folds and holds you made by hand on the rows it governs (pins are kept), so the switch does what it says.

## What else you can do with a row

- **Fold a row** you are done with: click its header or press `e`. This is per row and is remembered for the pane.
- **Pin a row open** to keep it out of the way of the auto-close, and visible in any view.
- **Hover** for a preview of a row's time and size.
- **Agent History** opens the recorded conversation in a separate tab ([Agent History](/pane-types/#agent-history)).

## See also

- [Agent pane](/pane-types/#agent): composer, drawers, the activity dock and the other parts of the pane
- [Windows, tabs, panes and renderers](/internals/renderers/): what runs where
- [Jekt protocol](/internals/jekt-protocol/) and [Interagent communication](/internals/interagent-comms/)
- [Swarm](/subagent-watcher/): subagents and agents at a glance
