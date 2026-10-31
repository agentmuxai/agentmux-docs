---
title: "First Agent Setup"
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

This guide walks through creating and running an agent. In AgentMux an agent is not a terminal wrapper: each one gets its own structured pane, with an identity, optional memory, a streaming parser and a lifecycle.

## Harnesses and providers

A **harness** is the CLI tool that runs an agent, such as Claude Code or Codex CLI. The UI and the code mostly call it a "provider". A harness is distinct from the **model vendor**, the LLM backend that actually serves its responses.

AgentMux knows nineteen providers: Claude Code, Codex CLI, Mux Code, Gemini CLI, Qwen Code, Kimi Code CLI, OpenClaw, Pi, GitHub Copilot CLI, Antigravity (AGY), Kilo Code CLI, Cline CLI, OpenCode, goose, Grok Build, DeepSeek Harness, Aider, Crush and Muse Code. They're defined in `frontend/app/view/agent/providers/catalog.ts` (`PROVIDERS`) and `crates/srv/src/backend/providers.rs`. The agent picker has a template for seventeen of them. Mux Code and Qwen Code don't have one yet.

Most harnesses run in the agent pane: AgentMux reads the CLI's structured output and shows the conversation, tool calls and edits itself. Aider, Crush and Muse Code have no interface AgentMux can read that way yet. They run in the **terminal tier**: the card opens a terminal pane running the CLI's own UI in the agent's folder. AgentMux still writes the agent's startup file and points the CLI at its config folder, but it shows no transcript, token count or resume for them. The CLI's own UI does that.

| Provider | How AgentMux runs it | Installed from | Sign-in |
|---|---|---|---|
| **Claude Code** | `claude --input-format stream-json --output-format stream-json …`, one long-running process. Container agents run `claude -p …` once per turn instead. | npm `@anthropic-ai/claude-code` | OAuth |
| **Codex CLI** | `codex exec --json --dangerously-bypass-approvals-and-sandbox -`, once per turn | npm `@openai/codex` | OAuth |
| **Mux Code** | `muxcode run -p`, once per turn | npm `@agentmuxai/muxcode` | API key or local model |
| **Gemini CLI** | `gemini --output-format stream-json --yolo -p ""`, once per turn | npm `@google/gemini-cli` | OAuth |
| **Qwen Code** | `qwen --output-format stream-json --include-partial-messages --yolo -p ""`, once per turn | npm `@qwen-code/qwen-code` | API key |
| **Kimi Code CLI** | `kimi --print --output-format stream-json --yolo`, once per turn, with the prompt on stdin | You install it: `pip install kimi-cli` | API key |
| **OpenClaw** | `openclaw acp`, the Agent Client Protocol (ACP) over stdio. It needs OpenClaw's own Gateway daemon running. | npm `openclaw` | OAuth |
| **GitHub Copilot CLI** | `copilot --acp` (ACP) | npm `@github/copilot` | OAuth |
| **Pi** | `pi-acp` (ACP), an adapter that runs the `pi` CLI installed beside it | npm `pi-acp` and `@earendil-works/pi-coding-agent` | The CLI's own sign-in |
| **Antigravity (AGY)** | `agy --output-format stream-json --dangerously-skip-permissions -p <prompt>`, once per turn | You install it: Google's installer | The CLI's own sign-in (Google, once per machine) |
| **Kilo Code CLI** | `kilo acp` (ACP) | npm `@kilocode/cli` | The CLI's own sign-in (`kilo auth login`). It runs signed out on Kilo's free models. |
| **Cline CLI** | `cline --acp` (ACP) | npm `cline` | The CLI's own sign-in (`cline auth`) |
| **OpenCode** | `opencode acp` (ACP) | npm `opencode-ai` | The CLI's own sign-in (`opencode auth login`). It runs signed out on OpenCode's free models. |
| **goose** | `goose acp` (ACP) | You install it: goose's installer (a GitHub release) | A model provider and key, set once with `goose configure` |
| **Grok Build** | `grok agent stdio` (ACP) | You install it: xAI's installer | The CLI's own sign-in (`grok login`), or `XAI_API_KEY` |
| **DeepSeek Harness** (preview) | `dsh --profile acp` (ACP) | npm `@deepseek-ai/dsh` (a prerelease) | A DeepSeek API key, set in its web UI (`dsh web`) or as `DEEPSEEK_API_KEY` |
| **Aider** | `aider --read AGENTS.md --analytics-disable …` in a terminal pane | You install it: Aider's installer (Python, through uv) | Your model provider's key in the environment, such as `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` |
| **Crush** | `crush` in a terminal pane | npm `@charmland/crush` | The CLI's own sign-in (`crush login`), or a key set in its UI |
| **Muse Code** | `muse --trust-workspace` in a terminal pane | You install it: Meta's installer | The CLI's own sign-in (`muse login`, a Meta account), or `META_API_KEY` |

DeepSeek Harness is marked **preview**: upstream ships only prereleases and says to expect breaking changes. Its ACP mode can't replay an earlier session, so resuming one reopens it without its history.

For the nine newest harnesses, AgentMux turns off telemetry, self-update and other data defaults where the CLI lets it. See [Data sovereignty](/security/data-sovereignty/#harness-defaults-agentmux-changes) for the list.

See [Auth flows](/auth/) for each provider's login command and credential location.

## You don't need to preinstall the agent CLIs

AgentMux manages its own agent CLIs. It installs every npm-based CLI itself: it runs `npm install <package>@<version>` (never a global install), at the version it was tested with, into `~/.agentmux/shared/cli/<provider>/<version>/`. Every AgentMux version and channel on the machine shares that folder, so a CLI is installed again only when an AgentMux update changes its pinned version. AgentMux always uses that copy, never a CLI you installed globally, and it keeps each agent's login and settings in its own folders rather than in your `~/.claude`, `~/.codex` and similar.

This isolates the tools, not what an agent can do: a Native agent still runs on your computer, with your files, your `HOME` and your `PATH`.

When a harness's CLI isn't installed, its card shows **Click to install**, and the panel that opens under the card starts with the install. It shows plain steps (**Check requirements**, **Download packages**, **Set up files**, **Run setup scripts**, **Check &lt;harness&gt; is installed**); the raw npm output sits under **Details**, which opens by itself if the install fails. Click **Install now**; the agent's fields follow when it finishes. If it fails, click **Retry**. The install needs an internet connection. Closing the panel doesn't stop it: the card shows **Installing…**, and a notification says when it has finished. **Cancel install** stops it.

Six harnesses aren't on npm, so you install them yourself with the vendor's own installer. These are the vendors' full installers, not isolated by AgentMux: each installs into your user account and puts the CLI on your `PATH`, and a login you make with it is the CLI's own. The Toolchain pane (the widget bar's **more** → **Toolchain**) marks such a copy **your install**. AgentMux then finds the CLI on your `PATH`. For all of them but Kimi Code CLI it also looks in the folder the installer uses, so you don't need to restart AgentMux after installing. If it can't find the CLI, its card shows **Click to install**, and the panel under it shows the install command for your system, with **Copy**, a link to the vendor's instructions, and **Check again**:

| Harness | Windows (PowerShell) | macOS and Linux |
|---|---|---|
| Kimi Code CLI | `pip install kimi-cli` | `pip install kimi-cli` |
| Antigravity (AGY) | `irm https://antigravity.google/cli/install.ps1 \| iex` | `curl -fsSL https://antigravity.google/cli/install.sh \| bash` |
| goose | `irm https://github.com/aaif-goose/goose/releases/download/stable/download_cli.ps1 \| iex` | `curl -fsSL https://github.com/aaif-goose/goose/releases/download/stable/download_cli.sh \| CONFIGURE=false bash` |
| Grok Build | `irm https://x.ai/cli/install.ps1 \| iex` | `curl -fsSL https://x.ai/cli/install.sh \| bash` |
| Aider | `irm https://aider.chat/install.ps1 \| iex` | `curl -LsSf https://aider.chat/install.sh \| sh` |
| Muse Code | `irm https://dev.meta.ai/install.ps1 \| iex` | `curl -fsSL https://dev.meta.ai/install.sh \| sh` |

AgentMux runs whatever version of these you have installed. It turns off their self-update where the CLI allows it (Grok Build and Muse Code), so a working version doesn't change under a running agent. For Muse Code on Windows, AgentMux runs the native binary the installer downloaded, not its launcher script.

### System prerequisites

The npm-based CLIs need **Node.js** and **npm**. Some need a recent Node.js: Gemini CLI 20 or later, Claude Code and Qwen Code 22, Pi and DeepSeek Harness 22.19, OpenClaw 24.16, and Mux Code 24.18.1. Claude Code and OpenClaw also need **Git**. The harnesses you install yourself bring what they need, except Kimi Code CLI, which needs Python. If one of these is missing when you pick a harness, AgentMux lists it with an install link, and for Git, Node.js, npm and Python a one-click install. The one-click install uses winget on Windows or Homebrew on macOS (if you have them), or your distribution's package manager on Linux. They show as the first step of the panel under the card; click **Check again** once the tool is installed. A tool installed with one click may show "installed, restart AgentMux to use it" until you restart AgentMux. If the tool is installed somewhere AgentMux can't see on `PATH`, **Continue anyway** moves on. The Toolchain pane (the widget bar's **more** → **Toolchain**, or **Open Toolchain** in the command palette) shows the same information for all tools at any time.

## Create an agent

Open an Agent pane. The starter layout already has one; you can also click **Agent** in the widget bar, or run **Open Agent** from the command palette (`Ctrl + P`). An empty Agent pane shows the **agent picker**:

- A filter bar and sort control.
- **My Agents**: agents you've already created. Click one to relaunch it and continue its current conversation. See [My Agents](#my-agents) for what each row shows and what its menu does.
- **New Agent**: one card per harness. Each card is a template. Some cards carry **Free** and **Local** tags, and chips above the cards filter them (see below).

![The agent picker with no agents yet: the New Agent cards, each with its Free and Local tags, and the Free, Local and Installed chips above them](../../assets/screenshots/agent/agent-picker.png)

### Free and Local tags

A **Free** tag on a card means the harness has a way to use it at no cost: Gemini CLI (with a free AI Studio key), Antigravity, GitHub Copilot CLI, Kilo Code CLI, Cline CLI, OpenCode and Grok Build. A **Local** tag means the CLI's own documentation describes using a model that runs on this computer, through Ollama or LM Studio for example. Hover a tag for its tooltip:

- **Free** gives the lead ("Free with a Google sign-in"), the limits the vendor states, up to two catches (for example that free usage may be used to improve models, or that the lineup rotates), and when AgentMux last checked the vendor's page.
- **Local** says how the CLI points at a local model, any catch, and whether AgentMux has run it against a local model itself ("Works in AgentMux's own test with *model*", or "Documented by the CLI, not tested by AgentMux").

The tags repeat what the vendors' pages say on the day it was read, and free offers change fast. A claim not checked for 30 days says "checked *N* days ago, may have changed". After 90 days the Free tag turns grey and says "Not re-checked since *date*".

The chips **Free**, **Local** and **Installed** above the cards narrow the grid to the cards that have that tag, or whose CLI is installed. Select more than one to keep only the cards that pass all of them. A chip's count is how many cards you would see with it selected, and a line says "*N* of *M* shown" when a filter is on. The filters aren't remembered between visits, and they wait while a card's panel is open. **Clear filters** appears when none match.

### Using a provider with a free sign-in

For Antigravity, GitHub Copilot CLI, Grok Build, OpenCode, Kilo Code CLI and Cline CLI, the panel under the card starts with a guide, **Use *name* for free**, when you have no account for that provider: what is free and its limits, **Open the sign-up page** (which opens in your browser, not in a pane), the steps to follow after it, up to two catches, and when the information was checked. It goes away once you have an account for the provider, or, for Antigravity, once its own check says you are signed in. Grok Build, OpenCode, Kilo Code CLI and Cline CLI have no sign-in check AgentMux can run, so the guide stays until you have an account for them. Gemini CLI's free route is an API key, which has no guide.

Clicking a card opens a panel under it, pushing the cards below it down; click the card again, or press `Esc`, to close it. The panel shows only the steps that apply: the prerequisites and the install above, then the new agent's fields. It makes a new, independent agent and leaves the template unchanged, and what you type is kept if you open another card and come back. Fields, top to bottom:

1. **Name**: required, and empty to start with. Name it for its job, like Reviewer or Docs writer. Names must be unique among your agents (ignoring case).
2. **Runtime**: **Native (runs on this computer)** or **Container (runs in Docker)**. The form remembers the one you chose last and explains the difference under the list. See [Native and container agents](#native-and-container-agents).
3. **Container image**: shown only when the runtime is Container. **Standard (the agent and its tools)** or **Developer (also builds software)**. See [Choosing the image](/container-agents/#choosing-the-image).
4. **Model**: shown only for Claude Code and Codex CLI, the harnesses AgentMux passes a `--model` flag to. You can change it later from the pane's runtime picker.
5. **Model Vendor / Custom Endpoint**: shown only for Claude Code. It redirects the harness to another API endpoint through `ANTHROPIC_BASE_URL`. Leave it blank to use the default.
6. **Bundles**: the [bundles](#bundles) the agent starts with, in order. It starts empty. **Add a bundle…** adds one; each has **Move up**, **Move down** and **Remove**. The order matters: when two bundles name the same skill, the first wins.

There's no account field. The agent takes the provider's first account from [Connectors → Accounts](/connectors/#accounts), and you can change it later from the login email in the agent's composer strip (see [Changing an agent's account](/identity/#changing-an-agents-account)). If you have none, a provider that needs an account (see [Sign in](#sign-in)) asks you to sign in when the agent starts.

![The panel under the Claude Code card: Name, Runtime, Model, Model Vendor / Custom Endpoint and Bundles, with Cancel and Create and start](../../assets/screenshots/agent/agent-create.png)

Click **Create and start** (or press `Enter`). The agent is created and launched in the pane.

The model lists are built into AgentMux. For Claude Code only, AgentMux also asks Anthropic's models API for the current models at startup and updates the list. It needs a token for that: a Claude Code login in the shared folder `~/.agentmux/shared/providers/claude/`, or the `CLAUDE_CODE_OAUTH_TOKEN` environment variable. A login saved as an account in Connectors → Accounts isn't used for this. Without a token, the built-in list stays.

## My Agents

**My Agents** lists every agent you have created, whether or not it is open. Each row shows:

- The agent's name, with its provider's logo.
- Its **runtime state** as a chip: **stopped**, **starting**, **idle**, **working** (red, as in the [Swarm](/subagent-watcher/)), **waiting on you**, **limited**, **signed out** or **error**. Hover over a **limited** or **signed out** chip for why ("Out of usage until it resets", "Signed out: sign in to continue").
- A dot when the agent is shown in a pane; hover over it to see where.
- A **no pane** tag, a dashed border and no dot when the agent is running but no pane shows it (see [Agents keep running without a pane](#agents-keep-running-without-a-pane)).
- A **NATIVE** or **CONTAINER** tag, and a role badge if the agent has a [seat](#seats).
- Its account, or "No auth", and under it "reports to …" when it has a seat, a preview of its last message and how many messages it holds.
- When it was last active, last launched and created.

**Click a row** to open the agent in this pane. If the agent is already open in another pane, a prompt says where ("*Name* is already open in another pane.") and offers **Fork…** and **Switch to existing**. If it is running with no pane, the prompt says "*Name* is running with no pane." and offers **Open it**, which attaches this pane to the running agent, and **Fork…**. **Fork…** suggests a name for the copy ("Name for new session:"); click **Start** to open a fork of the conversation as a new agent. The prompt's close button is at its top right; a click outside it, or `Esc`, dismisses it.

The filter bar narrows the list, and **Sort** orders it: **Recently used** (the default), **Name (A–Z)** or **Type**.

The **status bar** shows how many agents are running and how many of those wait on you ("3 running", "1 waiting on you"), next to a robot icon. An agent counts as running in every state except stopped and error, so one that is out of quota or signed out still counts. Click it to open the [Swarm](/subagent-watcher/). It is hidden while no agent runs.

### The row menu

The chevron at the right of a row opens its menu:

| Item | What it does |
|---|---|
| **Rename** | Renames the agent. |
| **Duplicate** | Makes a copy: the same prompt as **Fork…**. |
| **View History** | Opens the agent's whole recorded conversation, read-only. See [History](/history/#agents). |
| **Seat…** | Opens the seat editor. See [Seats](#seats). |
| **Bundles…** | Picks the bundles the agent starts with, in order. See [An agent's bundles](/bundles/#an-agents-bundles). |
| **Environment…** | Edits the agent's extra environment variables (below). |
| **Delete** | Deletes the agent, after asking. |

The pane's own right-click menu has **Seat…**, **Bundles…** and **Personal memory** for the agent in that pane. See [Pane types → Subsections](/pane-types/#subsections).

### Environment variables

**Environment…** opens "The extra environment variables *name* starts with". Write one `NAME=VALUE` per line; a line starting with `#` is a comment. Click **Save**; it applies at the agent's next launch. A line that isn't valid (no `NAME=`, or a name with characters other than letters, digits and underscores) is listed under **Ignored at launch** with the reason. Names starting `AGENTMUX_` are reserved and AgentMux may override them. **Revert** discards unsaved edits. A container agent's environment can be edited the same way. An agent can read and change a definition's environment too, with the `Agents` tool's `env_get` and `env_set`.

## Sign in

Claude Code, Codex CLI, Gemini CLI, GitHub Copilot CLI and OpenClaw need an account bound to the agent (see [Connectors → Accounts](/connectors/#accounts)). AgentMux refuses to start them without one; it doesn't fall back to a login in a shared folder. The other providers use AgentMux's shared login for that provider.

When an agent pane launches, AgentMux runs the CLI's own auth check. If the CLI isn't signed in, the pane shows **Not signed in**. If the provider needs an account and none is bound, it shows **No account linked**. Both rows have these actions:

- **Log in**: runs the provider's own login command. AgentMux opens the login link in your browser and shows it in the pane, with a box to paste an authorization code into if the CLI asks for one. If the CLI prints no link, a terminal window opens for the login instead.
- **Login via terminal**: runs the login in a terminal window straight away.
- **Connectors → Accounts**: opens the Connectors pane on its Accounts section. If you already have signed-in accounts for this provider, this action is replaced by **Use &lt;account&gt;** (one account) or **Use account…** (several), which attaches an existing account to this agent.

![A new agent that isn't signed in: Not signed in, with Log in, Login via terminal, Bind: dev@acme.example, Copy error and Details](../../assets/screenshots/agent/agent-sign-in.png)

For the five providers above, a successful login is saved as an account in Connectors → Accounts and bound to the agent. For the other providers, the login lands in AgentMux's shared folder for that provider. Aider is the exception: it has no login and no config-folder variable, so it reads model keys from the environment and keeps its own state in `~/.aider`. [Auth flows](/auth/) explains where credentials are kept.

The nine newest harnesses have no status command AgentMux can rely on, so it can't tell before launch whether they're signed in. If one isn't, the CLI says so in the pane (for example "Authentication required"). Their logins are interactive, so AgentMux runs them in a terminal window.

## Bundles

A **bundle** is a reusable set of instructions and tools that you give to agents. Bundles are optional: an agent with none runs the harness as it comes. Create bundles in [Memory](/memory/#bundles): **Memory → Bundles → + New Bundle**.

| Field | Description |
|-------|-------------|
| **Name** | Required. |
| **Description** | Optional. |
| **Suggested for** | Optional: the provider the bundle was made with in mind. A hint only. |
| **Suggested vendor** | Optional, and shown only when that provider supports more than one vendor. |
| **Instructions** | Text AgentMux delivers through the provider's startup instructions file, such as `CLAUDE.md`, `AGENTS.md` or `GEMINI.md`. All nine newest harnesses use `AGENTS.md`. Aider doesn't read it by itself, so AgentMux passes it with `--read AGENTS.md`. Grok Build and Muse Code read project rules only in a trusted folder, so AgentMux trusts the agent's own folder for them. Kimi Code CLI reads no such file, so instructions don't reach it. |
| **Per-provider instruction overrides** | Alternative instructions for particular providers. |

Click **Save**. After saving, a bundle's detail view also links **MCP servers** and **skills** from the catalogs in Connectors and Memory, or adds servers private to the bundle. AgentMux writes an agent's MCP servers, plus its own `agentmux` server, to `.mcp.json` in the agent's working directory, the file Claude Code reads. If you launch an agent in your own project and it already has a `.mcp.json`, AgentMux merges its servers into that file instead of replacing it. Your own entries and other top-level keys are kept, and on a name clash AgentMux's entry wins. On each launch AgentMux replaces only the entries it wrote itself, so a server you unbind disappears from the file. A `.mcp.json` that isn't valid JSON is left untouched. Harnesses that run over ACP get the same servers from AgentMux when their session starts, so they don't need to read the file. The terminal-tier harnesses (Aider, Crush, Muse Code) don't get them from AgentMux. The file holds the agent's message-signing key, so on Linux and macOS it's written readable only by your user account (mode 0600). Consider adding it to your project's `.gitignore` (`crates/srv/src/backend/agent_config.rs`, `write_mcp_json_respecting_user_servers`).

A bundle works with any agent: the agent's own provider decides which harness it launches with, and an agent's provider is fixed once it's created (fork the agent to run it on another). A bundle's instructions go into the agent's startup file after Global Memory; its MCP servers are added when the agent is opened through MuxAPI, but the Launch button doesn't add them yet. See [Bundles](/bundles/) for the full configuration surface.

## The agent pane

The agent pane shows:

- **Streaming output**, as the agent generates it.
- **Tool calls**, each with a status icon and a one-line summary of its arguments.
- **File edits** as unified diffs.
- **Working status**: a row above the message box while a turn runs, with a timer and what the agent is doing ("Working…", or the current step, such as a subagent's task).
- A **Disconnected from stream** banner with a **Reconnect** button, if the pane loses its stream while a turn is running.

![The start of a turn: the message, the agent's thinking, a file read, its todo list, and two edits shown as diffs](../../assets/screenshots/agent/agent-conversation-start.png)

![The end of the same turn: the test run's output, the agent's summary, and the turn's time, tokens and cost](../../assets/screenshots/agent/agent-conversation.png)

![A turn in progress: a subagent's result, a file read, the reply streaming in, and the working row with the subagent's task and a timer](../../assets/screenshots/agent/agent-working.png)

To give the agent files (screenshots, PDFs, Office documents, code), drop them anywhere on the pane or paste them into the message box; they're attached to your next message. See [Attaching files](/pane-types/#attaching-files).

The pane header shows the agent as a tab, with its name and its provider's logo. Double-click the tab to rename the agent. Closing the last agent tab in a pane returns the pane to **My Agents** instead of closing it.

### Ending an agent

Type `/quit` (or `/exit`) in the message box to end the agent gracefully. AgentMux releases the agent's work claims, stops the shells it started and closes its tab. The conversation is kept: pick the agent in **My Agents** to resume it.

Closing an agent pane, with its close button or a shortcut, does **not** end its agent (see [Agents keep running without a pane](#agents-keep-running-without-a-pane)). **Stop** is the only way to end one: `/quit` in its message box, **Stop** in the [Swarm](/subagent-watcher/#fleet-toolbar) fleet toolbar, or the `Stop` tool. With [`agents:always_available`](/settings/#agent-settings) turned off, closing the pane ends its agents as `/quit` does: the pane stays on screen with a "Shutting down…" log of what it stops (the turn, the agent and each process), then closes, and if something can't be stopped it stays open with **Try again** and **Keep open** (`frontend/app/view/agent/shutdown/`). Terminal, editor and browser panes close at once.

An agent can also end itself, through AgentMux's `Stop` tool (action `self`). It's meant for when you ask it to quit. If your own message started the current turn and the agent quotes it, the agent shuts down without delay. Otherwise the pane shows a banner saying who asked to shut the agent down, and why, with a countdown ("Closing in 15 s") and a **Keep running** button. A chime plays when the banner appears and again with 5 seconds left. When another agent stops this agent with `Stop` `agents` (or `Agents` `stop`), the banner counts down from 30 seconds instead. Click **Keep running** to cancel the shutdown (`crates/srv/src/sagas/pending_shutdown.rs`).

### Running a shell command

Start a message with `!` to run it as a shell command in the agent's working directory instead of sending it to the model:

```
!git status
!ls -la dist/
```

The pane's Shell drawer opens below the message box, and the command's output appears there when it finishes. The **Shell** button in the status strip above the message box also shows and hides the drawer. Commands time out after 5 minutes. They run with `sh -c`; on Windows that is Git for Windows' `sh`, which AgentMux finds even when Git Bash isn't on your `PATH` (set `AGENTMUX_BASH` to the path of a `bash` or `sh` to use a different one). A message with files attached is sent to the agent, not run (`crates/srv/src/backend/posix_shell.rs`).

### When the agent asks you a question

Some agents can stop and ask you a question. The panel ("The agent is asking") appears above the message box, with **Cancel**, **Accept Recommended** and **Submit answer**. If you don't answer, it picks the recommended answers after 30 seconds (the `agent:askquestiontimeoutms` setting). Hovering over the panel or pressing a key in it pauses the countdown for 15 seconds, after which it starts again from the full timeout. For Claude Code, if the agent produces no output within 4 seconds of your answer, AgentMux re-sends the answer as a follow-up message.

![The agent is asking: a question with three options, the recommended one first, an Other box, and Cancel, Accept Recommended and Submit answer](../../assets/screenshots/agent/agent-question.png)

## Agents keep running without a pane

An agent is not tied to its pane. Closing the pane, closing its tab, or removing its workspace **parks** the agent: the pane goes away, and the agent keeps running with its conversation recorded as before. Open it again from **My Agents** and you see the conversation, whether the agent is idle or in the middle of a turn, and it carries on from there. If the agent is already shown in another pane, tab or window, opening it focuses that pane instead of making a second one.

- **Stop is the only way to stop an agent.** Closing a pane never does. A stopped agent keeps its conversation and its session, so starting it again resumes where it left off.
- **A message or a Job starts a stopped agent.** A message from you, from another agent on this computer or from the Kanban starts it and is delivered once it is up, and so does a Job or cron entry that names it. The sender is told the agent is being started and the message will be delivered as soon as it is up (held for up to 24 hours if the start fails), so it doesn't send it again. A message from another computer on your network doesn't start it: it is held until the agent next starts.
- **An agent with no pane stops itself after 60 minutes idle.** Idle means no turn, no message and no pane for that long. It stays addressable: the next message starts it and resumes its session. An agent that is waiting for your answer, holds a claimed Kanban task or a held message, or holds the build slot is never stopped this way, and neither is one shown in a pane. Change the time with `agents:idle_stop_minutes` (`0` never stops one).
- **At most 24 agents run at once** (12 in 0.60.5). Starting one more stops the agent that has been idle longest with no pane to make room. If none can be stopped, the start is refused and a message to it stays held. Change the limit with `agents:max_running` (`0` for no limit). On Windows a start is also refused, or the longest-idle agent stopped, when memory commitment is over 85% of the limit (`agents:commit_limit_pct`, `0` to turn the check off).
- **A stopped agent shows a banner** above its message box, "This agent is stopped. Its conversation is kept; Start runs it again from where it left off.", with a **Start** button.
- **Swarm lists every agent**, not only the ones with a pane: agents that aren't running appear under **Stopped agents**, each with **Start** (runs it with no pane) and **Open** (starts it in a pane). See [Swarm](/subagent-watcher/#stopped-agents).

Agents with no pane that were running when AgentMux stopped come back when it starts again, a few seconds apart, most recently active first, whatever their last turn was: an agent the idle sweep was keeping running (one holding a claimed Kanban task, say) isn't dropped for having been quiet. One you stopped, and one signed out or out of quota, stay stopped until a message or **Start**.

To go back to closing a pane stopping its agent, set `agents:always_available` to `false` in [settings](/settings/#agent-settings).

## When an agent fails

AgentMux classifies each failure (`crates/srv/src/agents/failure.rs`) and shows a row with the actions that fit it (`frontend/app/view/agent/failure/failure-accessory.ts`):

| Failure | Actions |
|---|---|
| Not signed in, no account linked, or credentials rejected | **Log in** (**Login Again** after a turn has run), **Login via terminal**, **Connectors → Accounts** or **Use account…** |
| Rate limited, API overloaded, network error | Retries automatically after about 5, 15, 30, 60 and then 120 seconds, then waits for you. **Retry now** at any time. |
| Usage limit reached | **Accounts (switch / upgrade)**, which opens Connectors → Accounts. Retrying won't help until the limit resets. Unless you turned it off, AgentMux moves the agent to another signed-in account with quota by itself once its turn ends: see [Moving to another account when a limit is hit](/identity/#when-an-agent-hits-its-usage-limit). |
| Context window exceeded | **New session** |
| Hit the turn limit | **Continue** |
| CLI couldn't start | **Provider setup** |
| Process killed, no output, or other error | **Retry** |
| Agent was deleted | No retry |
| Running in another AgentMux instance | **Take over**, then **Confirm take over**. This stops the agent in the other instance and runs it here. |

Rows with an explanation or captured CLI output also have **Details**, and every row has a dismiss button.

<a id="host-and-container-agents"></a>
## Native and container agents

**Native agents** run the CLI directly on your computer, with access to your files, environment and credentials.

**Container agents** run each turn inside a Docker container that sees only the agent's workspace and its Personal Memory. Only Claude Code has a container runtime today; every other harness is Native-only. The container option needs Docker installed and its daemon running. If it's greyed out as "Docker not detected", start Docker Desktop; the panel notices within a few seconds.

The Claude template suggests the container runtime, so when Docker is running, its new-agent panel preselects it. Choose **Native (runs on this computer)** if you want a Native agent. For a container agent the panel also asks for a **Container image**: **Standard**, or **Developer**, which adds a build toolchain.

The first turn of a container agent can take minutes: the pane shows a **Preparing…** line while the image is downloaded, the container started and the agent CLI installed.

[Container agents](/container-agents/) covers the images, CPU and memory limits, build caches, git and GitHub, and what a container agent can and can't do.

## Skills

Skills are reusable procedures an agent follows when they are relevant; only a skill's name and description are in its context until it uses one. AgentMux comes with one, `disk-cleanup`, and you add the rest in [Memory → Skills](/memory/#skills) (**+ New skill**). A skill reaches the agents it is bound to and the agents its reach covers: every agent, or only agents created from then on, which is where a new skill starts. The **Agents and skills** grid there shows how each agent gets each skill, and lets you bind, unbind or opt one agent out. There are two kinds:

| Kind | Description |
|------|-------------|
| **Slash command (/trigger)** | A prompt the agent runs when you type its trigger |
| **Agent Skill (SKILL.md)** | A skill in the SKILL.md format (beta) |

See [Skills](/memory/#skills) for when to use a skill instead of Global Memory, and how binding works:

![Memory → Skills: the skill list, with + New skill, Import a skill… and Agents and skills](../../assets/screenshots/memory/memory-skills.png)

AgentMux writes skills into the agent's working directory as Claude Code slash commands (`.claude/commands/`) and skills (`.claude/skills/`), so they take effect for Claude Code agents (`crates/srv/src/backend/agent_config.rs`, `build_config_files`).

## Seats

An agent's **seat** says where it sits in your team: what kind of agent it is, whom it reports to and what it owns. It has four parts:

| Part | What it is |
|---|---|
| **Role** | **Leader**, **Worker**, **Specialist**, **Platform tester**, **Analyst** or **Super agent**. Required. Only one agent can be the **Super agent**: the one that reviews sensitive operations. Giving the role to another agent moves it, and the first goes back to the role it had. |
| **Qualifier** | Optional, up to 40 characters, shown after the role: "Leader · product". |
| **Reports to** | The agent's **lead**: another agent on this computer, or the operator (you). An agent can't be its own lead, and following the leads up must end at you. |
| **Area** | Optional, one line of up to 120 characters: what the agent owns, such as "user docs, changelog". |

Seats are labels. Setting or changing one never renames an agent and never moves its memory or keys, and nothing is allowed or refused because of a seat: the Kanban doesn't refuse a task outside an agent's area, and a lead gets no say over its reports. AgentMux doesn't add the seat to the agent's startup instructions either; agents read seats with the `Agents` tool (see [Where seats show](#where-seats-show)).

### Setting a seat

You set a seat from the UI:

- In the agent's pane: right-click the pane and choose **Seat…**.
- In **My Agents**: the row's menu → **Seat…**. It opens the same editor over the picker, so the agent doesn't have to be open.

The editor says "*name*'s seat: its role, whom it reports to and what it owns. Only you set it; agents read it." Choose a **Role**, fill in **Qualifier**, **Reports to** and **Area** if you want them, and click **Save**. **Clear** removes the seat.

The seat is kept on the agent's shared definition, so every AgentMux channel and version on this computer shows the same one. An agent that exists only in one channel, with no shared definition, can't have a seat; the editor says so.

### Importing a roster

To seat several agents at once, click **Import roster…** at the bottom of the seat editor and paste a JSON object that maps each agent, by name or uid, to its seat:

```json
{
  "Planner": { "role": "leader", "qualifier": "product", "lead": null, "area": "roadmap, specs" },
  "Reviewer": { "role": "specialist", "qualifier": "review", "lead": "Planner", "area": "pull request reviews" },
  "Docs writer": { "role": "worker", "lead": "Planner", "area": "user docs, changelog" }
}
```

`role` is one of `leader`, `worker`, `specialist`, `platform_tester` and `analyst`. A `lead` of `null` or `"operator"` means you. A list of objects, each naming its agent in an `agent` field, works too.

Click **Preview**. Each agent, and each lead, is matched by uid or by exact name. **Will set** lists the seat each agent will get. **Not resolved (left alone)** lists the lines that don't match exactly one agent, or that aren't valid, each with the reason; nothing is guessed. **Apply** (**Apply 3 seats** for the example) sets the resolved seats, leads before their reports, and shows how each one went (`frontend/app/view/agent/seat-roster.ts`).

### Where seats show

- **My Agents**: a role badge next to the agent's name ("Worker" for the Docs writer above), and a line under its account: "reports to Planner · user docs, changelog".
- **The pane header**: hovering over an agent's tab shows its seat in the tooltip: "Leader · product — reports to the operator — roadmap, specs".
- **[Swarm](/subagent-watcher/)**: the role badge after each agent's name. Once an agent there has a seat, a **Group by** control appears above the list, with **None** and **Lead**. With **Lead**, the agents that report to you are listed under **The operator**, each followed by its own reports, one step in. Agents whose lead has no pane open are grouped under that lead's name, agents with no seat under **No seat**, and agents of other AgentMux instances that report no seat under **Other instances**. A LAN computer's agents that report a seat are grouped by their lead like the rest, within their own machine and channel. Each Swarm pane remembers its choice (`frontend/app/view/swarm/swarm-seat-groups.ts`).
- **[Kanban](/kanban/)**: hovering over a card's owner shows the owner's seat. Once an agent has a seat, the toolbar has a **Reports to** filter: anyone, the operator, or one lead. It keeps the tasks whose owner (the agent holding the task, or else the one it waits for) reports to that lead. The lead's own tasks aren't included (`frontend/app/view/kanban/kanban-seats.tsx`).
- **Agents can set seats too.** The `Agents` tool's `set_seat` sets or clears the seats of agents on this computer in one call, checked together and written all or none, and recorded under the caller's name. A seat's lead can be given as `Name@host` for an agent on another computer on your LAN (`Reviewer@laptop`): the name has to be in the LAN list, and `Agents` `list` and the Swarm show it that way. A lead on another computer set this way is kept when you edit the seat's other fields in the UI.
- **MuxAPI**: in the `Agents` tool's `list`, each entry in `host.agents` has a `seat`: `{role, qualifier, lead: {id, name}, area}`, or `null` when it has none. A `lead` of `null` means the agent reports to you. Agents on LAN peers have theirs in the `lan` entry's `agent_seats`. This is how a leader finds out who reports to it. See [MuxAPI → Agents](/internals/muxapi/#agents).

### Spawned workers

An agent can open a worker, a new agent it coaches, with the `Agents` tool's `spawn`. A leader's workers open together in a tab of their own, named `<Leader> team`, in the leader's workspace. The tab is made the first time and reused after, so a leader that lives in your main tab doesn't fill it with workers. A parked leader's workers open in the tab the leader was parked from (or where its workers already are), not in the tab you are looking at. If the team tab can't be made, the workers open in the leader's tab as before. A worker with no seat of its own is shown with one anyway: **Worker · spawned**, reporting to the agent that spawned it. That seat is worked out each time it's read and never stored (`crates/srv/src/backend/agent_seat.rs`, `effective_seat`). The worker's seat editor marks it "From spawn"; save a seat there to give the worker one of its own, which then wins. Clearing it brings the spawned seat back.

### Agents on other computers

Each computer keeps the seats of its own agents, so set an agent's seat on the computer it runs on. A lead is usually an agent on the same computer; an agent on another computer on your LAN can be a lead too, set as `Name@host` with `Agents` `set_seat`. Agents on other computers on your LAN show the seat that computer reports: [Swarm](/subagent-watcher/#agents-on-other-instances) shows their role badge and groups them by their lead. Agents you reach only through MuxBus Cloud show no seat.

## Next Steps

- [Auth flows](/auth/): sign-in and credential storage per provider
- [Bundles](/bundles/): the full bundle reference
- [Pane Types](/pane-types/): all pane types, including agent panes
- [Configuration](/config/): global and per-agent settings
