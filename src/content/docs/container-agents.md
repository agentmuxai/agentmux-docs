---
title: "Container agents"
description: "An agent that runs in a Docker container: how to make one, the Standard and Developer images, CPU and memory limits, build caches, git and GitHub, and what it can and cannot do."
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

A **container agent** runs each turn inside a Docker container. The container sees the agent's workspace folder and its Personal Memory, not the rest of your computer. A [Native agent](/first-agent/#native-and-container-agents) runs directly on your computer with your files, environment and credentials.

Both kinds get the same AgentMux tools (messaging, Kanban, Browser, the Vault and so on), with the exceptions listed in [What a container agent cannot do](#what-a-container-agent-cannot-do).

## Making a container agent

An agent is a container agent when you pick **Container (runs in Docker)** in the **Runtime** field of the new-agent panel (see [Create an agent](/first-agent/#create-an-agent)). The runtime is chosen when you create the agent.

- **A container runtime must be running.** AgentMux uses `DOCKER_HOST` when it is set (`unix://`, `tcp://`, `https://` or `npipe://`); a `tcp://` address to another computer is refused unless TLS is on (`DOCKER_TLS_VERIFY`) or you use `https://`. Otherwise it tries the usual sockets in order and uses the first that answers. On Linux that is rootless Docker, rootless Podman, Docker Desktop, the system Docker and the system Podman; on macOS Docker Desktop, OrbStack, Colima and Rancher Desktop; on Windows Docker Desktop. Without one the option is greyed out as "Docker not detected"; start your runtime and the panel notices within a few seconds. If a container agent can't start for want of a runtime, the pane says where AgentMux looked and what to do. For Podman, `systemctl --user enable --now podman.socket` starts its Docker-compatible socket.
- **Only Claude Code has a container runtime.** Every other harness is Native-only, and its panel says so.
- The Claude Code template preselects the container runtime when Docker is running and its image can be downloaded. If you picked a runtime yourself before, AgentMux keeps your last choice instead.
- The pane shows a **CONTAINER** tag next to the model selector.

An agent can also make one. `Agents` `create` (a named agent from a template) and `Agents` `spawn` (a worker) take `runtime: container`, plus `container_image`, `memory_mb` and `cpus`; they are refused, with the reason, when Docker isn't available. An agent that is itself a container agent can start only container agents, and can't set limits. A container leader's workers use the leader's image, each with its own container and workspace.

## Choosing the image

Under the **Runtime** field, a container agent's panel has a **Container image** field:

| Choice | What it is |
|---|---|
| **Standard (the agent and its tools)** | The smallest image: the agent's CLI (installed on first start), Node.js, git, the GitHub CLI (`gh`), Python with `pip` and `venv`, and ripgrep. |
| **Developer (also builds software)** | The standard image plus a build toolchain, about 660 MB more to download. |

The **Developer** image adds:

- the Rust toolchain, at the version AgentMux itself builds with, with `clippy` and `rustfmt`;
- a C toolchain (`build-essential`, `cmake`, `ninja`, `pkg-config`) and the development headers AgentMux's own Linux build needs;
- go-task and cargo-nextest;
- the AWS CLI v2, which gets its credentials from [AWS grants](#aws), not from a key in the container;
- a headless display (Xvfb, with `xdotool` and `scrot` for screenshots) and the libraries a Chromium-based window loads, plus an `agent-dev` command that runs a checkout's `task dev` on that display.

It builds for Linux only: Windows and macOS targets need toolchains that can't be shipped in a Linux image. Cargo's registry and build output live in [per-agent volumes](#build-caches), so a build isn't thrown away when the image updates.

If AgentMux can't download the developer image, the panel says why under the field: the registry refuses access, or the image isn't published for your version of AgentMux yet. Pick **Standard**, or update AgentMux.

Both images come in the version of the AgentMux that runs. The standard one is `ghcr.io/agentmuxai/agent-base:<version>`; the developer one is `ghcr.io/agentmuxai/agent-base:<version>-developer`, published for amd64 and arm64 after each release. An agent set to `ghcr.io/agentmuxai/agent-base:developer` follows each release, as the standard one does. An agent set to a version tag, a digest or its own image stays on it.

For the image of the AgentMux version you run (Standard or Developer), AgentMux starts the container from the image its own release's signed manifest names, by digest, so the image you run is the one the release built. If there is no manifest, it can't be fetched or it names no image, the version tag is used as before. If a manifest is there and doesn't verify, the image isn't downloaded, and the pane says "the signed manifest of this AgentMux release isn't trusted" and to update AgentMux.

## Starting and updating

The first turn of a container agent can take minutes: the image is downloaded, the container started and the agent CLI installed. The pane shows a **Preparing…** line above the message box while that happens, with the phase ("Downloading the agent image… 42%", "Starting the container…", then "Installing Claude Code …"). It isn't a turn: it has no timer, and what you type isn't queued behind it. The transcript keeps a **Container ready (12 s)** row, then "Ready: send a message to start" when nothing is on its way; a pane keeps one such pair per quiet stretch, not one per reopen. A failed start says **Couldn't start the container** with the reason. A download that gets no data for 60 seconds, or is still not finished after 10 minutes, ends with a message saying so ("the download of *image* stopped (no data for 60 s)", "was still not finished after 10 minutes") and what to check. Send your message again to retry.

A new container agent sends its starter prompt by itself once you sign in.

### The image follows AgentMux

A container keeps the image it was made from, so after you upgrade AgentMux it can run an older one. When it does, and the agent is idle, AgentMux removes the container and starts the next one from the current image, and the pane says "Updated the container to the 0.60.9 image". Your workspace and Personal Memory are kept. Tools you installed inside the container are installed again.

If a turn is running, or you want it now, the pane shows "This container uses the 0.59.41 image" with an **Update container** button (the same as `Agents` `update_container`). It refuses while a turn is running. It does nothing for an agent pinned to a version or running its own image, and says so.

## CPU and memory limits

Every container agent has a CPU and a memory limit, so a build can't take over the machine. A limit comes from the first of these that is set:

1. The agent's own limit.
2. The app-wide limit in **Settings → Advanced → Agent panes**: **Container agents' memory** (`agent:container_memory`, in MB) and **Container agents' CPUs** (`agent:container_cpus`).
3. The default: **half of the memory Docker has** (at least 2 GB, and never more than Docker has) and **all but a quarter of its cores** (at least one). The developer image asks for at least 16 GB of memory, still bounded by what Docker has. On Docker Desktop, "what Docker has" is the size of its virtual machine, not your computer; raise it in Docker Desktop's Resources settings.

A setting of `auto` is the default, and `0` is no limit.

To set an agent's own limits, right-click its pane and choose **Container limits…**. For **Memory** (in GB) and **CPUs**, choose **Automatic**, **Set a limit** (and type the number) or **No limit**, then **Save**. The panel shows what is in force now and what Docker has in total. A change reaches the running container at once: nothing restarts, and the pane records who changed it ("Container limits: Memory limit 16 GB, 6 CPUs, set by …").

An agent can read and change these with `Agents` `set_container_limits`: give `agent` and `memory_mb` and/or `cpus` (a number, `"auto"`, or `0` for no limit), or neither to read. The answer has what is set, what is in force (`effective_memory_mb`, `effective_cpus`) and what Docker has (`daemon_memory_mb`, `daemon_cpus`). A container agent can read its limits but not change them, its own included; it asks a Native agent or you.

When the kernel stops a process in the container for going over its memory limit, the pane says "A process in this container was stopped: it ran out of its 8 GB memory limit", with a **Raise the limit** button that opens the same panel.

## Build caches

Things an agent downloads for its work would be lost whenever its container is recreated (an image update, a limit that Docker can't apply in place). AgentMux keeps these directories in named Docker volumes made for that one agent:

| Image | Kept |
|---|---|
| Standard and Developer | Playwright's browsers, npm's cache, pip's cache |
| Developer, also | Cargo's home (registry and installed tools) and the build output directory (`CARGO_TARGET_DIR`) |

The volumes aren't shared between agents, on purpose: a volume every agent could write would let one agent leave another a changed browser or package. The price is one download per agent.

**Container limits…** also has a **Build cache** section, shown when the agent has cache volumes. It says how much they hold ("12.4 GB in 3 volumes"), with **Clear build cache**, then **Remove 12.4 GB and the container** to confirm. Clearing removes the volumes and the container, so the next message starts a new one with a cold first build. It waits for a running turn to finish.

`Agents` `container_caches` does the same: give `agent` for the sizes (`total_bytes`, `warn_bytes`), or add `clear: true` to clear. A container agent can read its caches but not clear them.

When an agent's caches reach **20 GiB**, its pane says so once per run of AgentMux ("This agent's build caches hold 24.0 GB") with a **Container settings** button that opens the panel. Clearing the caches lets it say so again.

## Deleting a container agent

Deleting a container agent from **My Agents** removes its container and every volume made for it: the caches above, and its agent CLI and Claude home volumes. Your workspace folder and Personal Memory are on your computer and stay.

## Git and GitHub

A container agent gets `git` and `gh` through AgentMux, and no token is written into the container.

- Each time `git` or `gh` needs GitHub, the container asks AgentMux for a short-lived token for the one repository it is working on. AgentMux gets it from the `gh-agent` command on your computer when it is installed, otherwise from the GitHub account you connected in [Connectors → Accounts](/connectors/#accounts).
- Pushes go through the same push scan a Native agent's do; the scan's hooks are mounted read-only.
- Commits end with `Agent: <name>@<host>`. The container's hostname is your machine's name (lower case, no domain), so a PR title's `<name>@<host>` says which machine the agent is on. Git trusts every clone in the container.
- If AgentMux can't get a token, the agent is told why. If `gh-agent` is slow to answer, it is told the token took too long and to try again, not that GitHub isn't connected.

See [Identity and credential storage](/security/identity-credential-storage/) for how Native agents' GitHub access differs.

## AWS

A container agent can use AWS without any key in its container. AgentMux hands out credentials one use at a time, from grants you write on the host. With no grants, a container agent has no AWS: running `aws` says so and says where the grants go.

- **The grants are a file on your computer,** `~/.agentmux/aws-grants.json`. It is read on each request, so an edit takes effect without a restart, and a container's AWS config is rebuilt the next time it starts. A file that doesn't parse is an error that names the line, and the last good version stays in force. A fresh install shares nothing.
- **A grant** has a name (the container's AWS profile is called the same), a `tier` of `read` or `write`, how AgentMux gets the credentials, which agents may use it (their lower-case names, or `*`), and limits. A write grant asks for a reason by default. The credentials come from your own AWS profile on the host (`host_profile`), or from any program you name that prints `credential_process` JSON (`command`). AgentMux never runs a shell for it, and refuses credentials that don't expire.
- **The container asks, AgentMux mints.** The container's AWS config calls `agentmux-bashwrap aws-credentials --profile <grant>`, which asks AgentMux on the host. AgentMux checks the grant, gets a short-lived session on the host, and answers with it. The agent's reason for a write grant goes in `AGENTMUX_AWS_REASON` in front of the command, and a shorter lifetime in `AGENTMUX_AWS_DURATION` (seconds, 900 to 3600).
- **Sessions are reused.** An agent gets the same session for a grant and reason while at least 10 minutes remain, then a new one: a 30-minute session serves about 20 minutes of work. A new reason is a new session. Each agent and grant is capped at 12 new sessions an hour unless the grant sets `max_mints_per_hour`, and refused tries count.
- **You are told, not asked.** There is no prompt on each use. Every new session and every refusal is a row in the [Audit](/audit/) under the agent, with the grant, tier, reason and lifetime, and never a credential.
- **A refusal says what to do:** the grant doesn't exist or isn't open to this agent, a reason is needed, the hourly cap was reached, the host's AWS login has lapsed (`aws sso login` on the computer), or the host has no AWS CLI v2. A Native agent that asks is told to use the host's own AWS setup.

The environment inside the container points the AWS tools at that config (`AWS_CONFIG_FILE`), ignores any `~/.aws/credentials` (`AWS_SHARED_CREDENTIALS_FILE=/dev/null`), turns off the instance metadata lookup, and sets `AWS_PROFILE` to the file's `default_grant`, so a bare `aws s3 ls` works for the free reads.

The developer image has the AWS CLI v2. For an agent that at least one grant is open to, AgentMux also copies the host's own AWS work command-line tools into a read-only folder the container has on its `PATH`, after the system's commands; no registry token enters the container. If the host has none installed, the command says so.

## Accounts and sign-in

A container agent keeps its account menu, so you can switch its account like a Native agent's, and the account chip shows even before an account is linked. An agent that hits its usage limit moves itself to an account with quota, and an account can be marked never to fail over to; `agent:accountfailover` turns the moving off.

Claude Code in a container signs in with the account bound to the agent. On a Mac, Claude Code keeps its login in the Keychain. AgentMux reads only that account's entry and stages it for the container, and writes a token the container refreshes back to the Keychain. If the account has no login there, the agent stops before the image download with a message saying to sign in under Connectors → Accounts, or to bind an account that uses an API key.

## What a container agent can do

Everything a Native agent can do with AgentMux's tools, except what is listed below. The differences that show:

- **Panes and files.**
  - A file it shows you in an Editor or Media pane opens as a read-only snapshot of the copy in its workspace; its title says `(read-only snapshot, <time>)`, and it doesn't change when the agent changes the file. A snapshot is capped (10 MB for an editor, 50 MB for a media file) and is removed when its pane closes. A folder, a terminal, a pane on another machine and a path outside the workspace can't be opened this way.
  - It can open a folder of its workspace in a [Files pane](/pane-types/#files). That pane is read-only and confined to the folder: it lists, navigates and previews files and opens them in the Editor, and a link that leads out of the folder is refused.
  - **Browser** `set_files` uploads files from its own `/workspace` (at most 10 files and 25 MB in all).
  - A browser pane it opens browses in a fresh Incognito jar by default, never your Personal profile, and the answer says which one the pane got. See [Profiles and Incognito](/browser-pane/#profiles-and-incognito).
- **Dev servers.** An agent that registers its dev server with the command that starts it (`RegisterDevServer` with `command`, and `dir` if it isn't `/workspace`) has AgentMux start the server and keep it up: when the container next runs a turn and nothing is listening, AgentMux runs the command again and registers the route with the container's new address, so `http://<project>-<agent>.localhost:8090` keeps working. A registration without a command lasts only as long as the container. See [`RegisterDevServer`](/internals/muxapi/#registerdevserver). Where the workspace is a file-sharing mount that sends no change events (Docker Desktop on Windows and macOS), AgentMux sets `CHOKIDAR_USEPOLLING`, `CHOKIDAR_INTERVAL` and `WATCHPACK_POLLING` so hot reload sees the agent's edits; a variable the agent's environment sets already is left alone.
- **Widgets.** It can install a widget it built under `/workspace`; each file is checked as it is copied out. The install is reviewed like any widget an agent installs. See [Widgets](/widgets/).
- **Seats and environment.** It can set seats (`Agents` `set_seat`) and read or change an agent's environment (`env_get`, `env_set`), its own or another agent's, under the same rules a Native agent meets. See [Seats](/first-agent/#seats).
- **Compaction.** The **Compact** button in a Claude container agent's message box compacts its conversation, and it gets the same running summary a Native agent does. Codex can't compact inside a container: `Agents` `compact` is refused for a Codex container agent ("a Codex agent in a container can't compact yet"). `Agents` `fresh` is refused for every container agent ("unsupported in containers").
- **Attachments.** Files dropped or pasted into the pane are copied into its working folder with an `@name` reference. See [Attaching files](/pane-types/#attaching-files).

## What a container agent cannot do

The rule is that a container agent can do what a Native agent can, except directly change or run things on your computer. AgentMux refuses these, with the reason and what to do instead in the answer:

- run commands on your computer: the `Terminal` tool and remote connections (it has its own shell in the container);
- drive your desktop (`Desktop`);
- read your files outside its mounts (it reads `/workspace` directly);
- write Global Memory (it can read it);
- upgrade AgentMux;
- set its own or any container's CPU and memory limits, or clear its caches (it can read both);
- use the app's own plumbing: approvals, the cloud relay, the WebSocket and the RPC gateway.

For the token behind this, see [Trust model → Container agents](/security/trust-model/#container-agents).
