---
title: "Quickstart"
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

Get AgentMux running with your first agent in a few minutes.

## 1. Install AgentMux

Download it from [GitHub Releases](https://github.com/agentmuxai/agentmux/releases) (or the buttons on [agentmux.ai](https://agentmux.ai)):

- **Windows (x64):** the [Microsoft Store](https://apps.microsoft.com/detail/9p9qcxnncrk3), the `.exe` installer, or the portable `.zip`
- **macOS:** the `.dmg`, Apple Silicon only
- **Linux (x86_64):** AppImage, `.deb`, `.rpm` or portable `.tar.gz`

See [Installation](/installation/) for the steps on each platform.

## 2. Launch and orient

AgentMux opens a starter layout of three panes:

- **Agent** (left): the agent picker.
- **Sysinfo** (top right): live system metrics. Right-click it to choose what it plots.
- **Swarm** (bottom right): a live tree of your agent panes, with their subagents, todos and running tools.

Around the panes:

- **Title bar**: tabs, the widget bar (pinned **Agent**, **Swarm**, **Armory** and **Sysinfo**, with everything else under **more**), and the hamburger menu (**≡**).
- **Status bar** (bottom): backend status, CPU, GPU, memory, disk and network stats, token usage, and the AgentMux version. Click the version for instance details.

## 3. Create your first agent

In the Agent pane, under **New Agent**, click a harness card, for example **Claude**. Each card is a harness, the CLI that runs the agent.

1. **Install the CLI.** If the harness's CLI isn't installed yet, an install dialog opens. Click **Install now**, then **Continue to Launch**. It needs an internet connection, and Node.js and npm (Claude Code also needs Git). If they're missing, AgentMux lists them with an install option; click **Refresh** once they're installed.
2. **Fill in Create new agent.** Keep the suggested **Name**. For **Runtime**, choose **On this computer (host)**; the Claude template preselects the container runtime when Docker is running. If you have no account yet, leave **Identity** on **(ambient credentials)**. Set **Memory** to **(vanilla CLI)**; if you have any bundles, the first one is preselected. Click **Create**.
3. **Sign in.** Claude Code only starts with an Armory account bound to the agent. Without one, the pane shows **Not signed in** or **No account linked**. Click **Log in** and finish the login in your browser. For Claude Code, paste the authorization code back into the pane if it asks for one. AgentMux saves the login as an Armory account and binds it to the agent. See [Auth flows](/auth/).

The agent then starts in the pane. Type a message and press `Enter` to send it; `Shift + Enter` adds a new line. You'll see the agent's reply stream in, each tool call as it runs, and diffs of the files it edits. Press `Esc` in an empty message box to interrupt a running turn. Start a message with `!` to run a shell command in the agent's working directory instead. Type `/quit` (or `/exit`) to end the agent and close its tab; the conversation is kept.

See [First Agent Setup](/first-agent/) for the details of every step.

## 4. Add more panes

In the tables below, `Cmd` is ⌘ on macOS and Alt on Windows and Linux.

| Action | Keys |
|---|---|
| Split right (opens a terminal) | `Cmd + D` |
| Split below | `Cmd + Shift + D` |
| Move focus between panes | `Ctrl + Shift + Arrow` |
| Open the command palette | `Ctrl + P` |

To start a second agent, click **Agent** in the widget bar (or run **Open Agent** from the command palette). The new Agent pane shows the picker again: create another agent, or pick one from **My Agents**. Agent names must be unique, so give a second agent from the same template a new name.

Each agent is independent. Agents don't share context unless they message each other (see [Interagent Comms](/internals/interagent-comms/)).

## 5. Add instructions with a bundle (optional)

A bundle is a reusable set of instructions, MCP servers and skills. Create one from **≡ → Armory → Bundles → + New Bundle**. Enter a **Name** and pick a **Provider** that matches the harness you'll use (you can't change it later), add **Instructions**, then click **Save**. Choose the bundle as **Memory** when you create an agent. See [Memory bundles](/memory/).

## Next Steps

- [First Agent Setup](/first-agent/): every provider and option in detail
- [Auth flows](/auth/): how sign-in works per provider
- [Keybindings](/keybindings/): all keyboard shortcuts
- [Pane Types](/pane-types/): all available pane types
- [Configuration](/config/): customize settings
