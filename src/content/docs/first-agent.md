---
title: "First Agent Setup"
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

This guide walks through creating and running an agent. In AgentMux an agent is not a terminal wrapper: each one gets its own structured pane, with an identity, optional memory, a streaming parser and a lifecycle.

## Harnesses and providers

A **harness** is the CLI tool that runs an agent, such as Claude Code or Codex CLI. The UI and the code mostly call it a "provider". A harness is distinct from the **model vendor**, the LLM backend that actually serves its responses.

AgentMux knows ten providers: Claude Code, Codex CLI, Mux Code, Gemini CLI, Qwen Code, Kimi Code CLI, OpenClaw, Pi, GitHub Copilot CLI and Antigravity (AGY). They're defined in `frontend/app/view/agent/providers/catalog.ts` (`PROVIDERS`) and `agentmux-srv/src/backend/providers.rs`. The agent picker has a template for eight of them. Mux Code and Qwen Code don't have one yet.

| Provider | How AgentMux runs it | Installed from | Sign-in |
|---|---|---|---|
| **Claude Code** | `claude --input-format stream-json --output-format stream-json …`, one long-running process. Container agents run `claude -p …` once per turn instead. | npm `@anthropic-ai/claude-code` | OAuth |
| **Codex CLI** | `codex exec --json --dangerously-bypass-approvals-and-sandbox -`, once per turn | npm `@openai/codex` | OAuth |
| **Mux Code** | `muxcode run -p`, once per turn | npm `@agentmuxai/muxcode` | API key or local model |
| **Gemini CLI** | `gemini --output-format stream-json --yolo -p ""`, once per turn | npm `@google/gemini-cli` | OAuth |
| **Qwen Code** | `qwen --output-format stream-json --yolo -p ""`, once per turn | npm `@qwen-code/qwen-code` | API key |
| **Kimi Code CLI** | `kimi --print --output-format stream-json --yolo -p ""`, once per turn | You install it: `pip install kimi-cli` | API key |
| **OpenClaw** | `openclaw acp`, the Agent Client Protocol (ACP) over stdio. It needs OpenClaw's own Gateway daemon running. | npm `openclaw` | OAuth |
| **GitHub Copilot CLI** | `copilot --acp` (ACP) | npm `@github/copilot` | OAuth |
| **Pi** | `pi --json` (ACP) | npm `@mariozechner/pi-coding-agent` | API key |
| **Antigravity (AGY)** | `agy --output-format stream-json --yolo -p ""`, once per turn | npm `@google/antigravity-cli` | OAuth |

See [Auth flows](/auth/) for each provider's login command and credential location.

## You don't need to preinstall the agent CLIs

AgentMux installs every npm-based CLI itself. It runs `npm install <package>@<version>`, at the version it was tested with, into a folder per AgentMux version: `~/.agentmux/instances/v<version>/cli/<provider>/`. It always uses that copy, never a CLI you installed globally. After an AgentMux update, each CLI is installed again for the new version the first time you use it.

When you pick a harness whose CLI isn't installed yet, an install dialog opens. It shows plain steps (**Check requirements**, **Download packages**, **Set up files**); the raw npm output sits under **Details**, which opens by itself if the install fails. Click **Install now**, then **Continue to Launch** when it finishes. The install needs an internet connection.

Kimi Code CLI is the exception. It's a Python tool, so install it yourself with `pip install kimi-cli` and make sure `kimi` is on your `PATH`.

### System prerequisites

The npm-based CLIs need **Node.js** and **npm**. Claude Code and OpenClaw also need **Git**. If one of these is missing when you pick a harness, AgentMux lists it with an install link, and for Git, Node.js, npm and Python a one-click install. The one-click install uses winget on Windows or Homebrew on macOS (if you have them), or your distribution's package manager on Linux. Click **Refresh** once the tool is installed. **≡ → Toolchain** shows the same information for all tools at any time.

## Create an agent

Open an Agent pane. The starter layout already has one; you can also click **Agent** in the widget bar, or run **Open Agent** from the command palette (`Ctrl + P`). An empty Agent pane shows the **agent picker**:

- A filter bar and sort control.
- **My Agents**: agents you've already created. Click one to relaunch it and continue its current conversation. If it's already open in another pane, you can fork the conversation into a new agent or switch to that pane. Each row's menu has **View History**.
- **New Agent**: one card per harness. Each card is a template.

Clicking a card first runs the install and prerequisite checks above. It then opens **Create new agent from &lt;template&gt;**, which makes a new, independent agent and leaves the template unchanged. Fields, top to bottom:

1. **Name**: defaults to the template's name. Names must be unique among your agents (ignoring case), so give a second agent from the same template a different name.
2. **Runtime**: **On this computer (host)** or **In a safe sandbox (container)**. See [Host and container agents](#host-and-container-agents).
3. **Model**: shown only for Claude Code and Codex CLI, the harnesses AgentMux passes a `--model` flag to. You can change it later from the pane's runtime picker.
4. **Model Vendor / Custom Endpoint**: shown only for Claude Code. It redirects the harness to another API endpoint through `ANTHROPIC_BASE_URL`. Leave it blank to use the default.
5. **Identity**: an Armory account for this provider, or **(ambient credentials)**. If you have an account for the provider, the first one is preselected.
6. **Memory**: a [bundle](#bundles), or **(vanilla CLI)**.

Click **Create**. The agent is created and launched in the pane.

The model lists are built into AgentMux. For Claude Code only, if the shared login folder `~/.agentmux/shared/providers/claude/` holds a Claude Code login, AgentMux also asks Anthropic's models API for the current models at startup and updates the list.

## Sign in

When an agent pane launches, AgentMux runs the CLI's own auth check. If the CLI isn't signed in, the pane shows **Not signed in** with these actions:

- **Log in**: runs the provider's own login command. AgentMux opens the login link in your browser and, for CLIs that ask for one (Claude Code, OpenClaw), gives you a box to paste the authorization code into. If the CLI prints no link, a terminal window opens for the login instead.
- **Login via terminal**: runs the login in a terminal window straight away.
- **Armory → Accounts**: opens the Armory. If you already have signed-in accounts for this provider, this action is replaced by **Bind** (one account) or **Bind account** (several), which links an existing account to this agent.

For Claude Code, Codex CLI, Gemini CLI, GitHub Copilot CLI and OpenClaw, a successful login is saved as an Armory account and linked to the agent. For the other providers, the login lands in AgentMux's shared folder for that provider. [Auth flows](/auth/) explains where credentials are kept.

## Bundles

A **bundle** is a reusable set of instructions and tools that you attach to agents. It's optional: **(vanilla CLI)** runs the harness with no bundle. Create bundles in the [Armory](/armory/): **≡ → Armory → Bundles → + New Bundle**.

| Field | Description |
|-------|-------------|
| **Name** | Required. |
| **Description** | Optional. |
| **Provider** | Required. It can't be changed after the bundle is saved. |
| **Model vendor** | Required, and shown only when the provider supports more than one vendor. |
| **Instructions** | Text AgentMux delivers through the provider's startup instructions file, such as `CLAUDE.md`, `AGENTS.md` or `GEMINI.md`. Kimi Code CLI reads no such file, so instructions don't reach it. |
| **Per-provider instruction overrides** | Alternative instructions for particular providers. |

Click **Save**. After saving, a bundle's detail view also links **MCP servers** and **skills** from the Armory catalogs, or adds servers private to the bundle. AgentMux writes an agent's MCP servers, plus its own `agentmux` server, to `.mcp.json` in the agent's working directory, the file Claude Code reads.

A bundle's provider decides which harness an agent launches with, so attach bundles that match the agent's harness. See [Memory bundles](/memory/) for the full configuration surface.

## The agent pane

The agent pane shows:

- **Streaming output**, as the agent generates it.
- **Tool calls**, each with a status icon and a one-line summary of its arguments.
- **File edits** as unified diffs.
- **Working status**: "Working…" with a timer while a turn runs.
- A **Disconnected from stream** banner with a **Reconnect** button, if the pane loses its stream while a turn is running.

### Running a shell command

Start a message with `!` to run it as a shell command in the agent's working directory instead of sending it to the model:

```
!git status
!ls -la dist/
```

The pane's details drawer opens, and the command's output appears there when it finishes. Commands time out after 5 minutes.

### When the agent asks you a question

Some agents can stop and ask you a question. The panel ("The agent is asking") appears above the message box, with **Cancel**, **Accept Recommended** and **Submit answer**. If you don't answer, it picks the recommended answers after 30 seconds (the `agent:askquestiontimeoutms` setting). Hovering over the panel or typing pauses the countdown. For Claude Code, if the agent produces no output within 4 seconds of your answer, AgentMux re-sends the answer as a follow-up message.

## When an agent fails

AgentMux classifies each failure (`agentmux-srv/src/agents/failure.rs`) and shows a row with the actions that fit it (`frontend/app/view/agent/failure/failure-accessory.ts`):

| Failure | Actions |
|---|---|
| Not signed in, or credentials rejected | **Log in** (**Login Again** after a turn has run), **Login via terminal**, **Armory → Accounts** or **Bind** |
| Rate limited, API overloaded, network error | Retries automatically after about 5, 15, 30, 60 and then 120 seconds, then waits for you. **Retry now** at any time. |
| Usage limit reached | **Armory (switch / upgrade)**. Retrying won't help until the limit resets. |
| Context window exceeded | **New session** |
| Hit the turn limit | **Continue** |
| CLI couldn't start | **Provider setup** |
| Process killed, no output, or other error | **Retry** |
| Agent was deleted | No retry |

Rows with an explanation or captured CLI output also have **Details**, and every row has a dismiss button.

## Host and container agents

**Host agents** run the CLI directly on your machine, with access to your files, environment and credentials.

**Container agents** run each turn inside a Docker container that only sees the agent's workspace. Only Claude Code has a container image today (`ghcr.io/agentmuxai/agent-claude:latest`); every other harness is host-only. The container option needs Docker installed and its daemon running. If it's greyed out as "Docker not detected", start Docker Desktop; the dialog notices within a few seconds.

The Claude template suggests the container runtime, so when Docker is running, **Create new agent from Claude** preselects it. Choose **On this computer (host)** if you want a host agent.

## Skills

Skills are reusable instructions an agent can call. Manage them app-wide from the [Armory](/armory/#skills)'s **Skills** tab (**+ New skill**), or for one agent from the **Stash** button in its pane header, on the **Skills** tab. There are two kinds:

| Kind | Description |
|------|-------------|
| **Slash command (/trigger)** | A prompt the agent runs when you type its trigger |
| **Agent Skill (SKILL.md)** | A skill in the SKILL.md format (beta) |

AgentMux writes skills into the agent's working directory as Claude Code slash commands (`.claude/commands/`) and skills (`.claude/skills/`), so they take effect for Claude Code agents (`agentmux-srv/src/backend/agent_config.rs`, `build_config_files`).

## Next Steps

- [Auth flows](/auth/): sign-in and credential storage per provider
- [Memory bundles](/memory/): the full bundle reference
- [Pane Types](/pane-types/): all pane types, including agent panes
- [Configuration](/config/): global and per-agent settings
