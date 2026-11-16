---
title: Headless server
description: "Run AgentMux as a server with no desktop app: install the server package, set it up, start it at login, and sign a browser in with the agentmux command."
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

The **server package** is AgentMux without the desktop app: your agents, tasks and memory run in a server on a machine, and the window is a browser on that machine's own loopback address. It is for a Linux or macOS machine that has no screen of its own, or where you want the agents to keep running with no window open. A release has the package for Linux (x86_64 and arm64) and macOS (Apple Silicon). Windows has none.

The server runs on its own **channel**, `headless`, with its own data folder, settings, ports and agents, so it can run beside a desktop AgentMux of the same person without sharing anything with it.

## Install

Install it from a terminal with the release's install script, which checks the download against the release's signed manifest and installs into `~/.agentmux/server`:

```bash
curl -fsSL https://agentmux.ai/install.sh | sh -s -- --server
```

Add `--setup` to also run `agentmux setup` with its defaults and a login service (see [setup](#setup)). The script links the command as `agentmux-server` in `~/.local/bin`, and as `agentmux` too when nothing of that name is there already. On a machine where `agentmux` is the desktop app's command, run this one as `agentmux-server`; the commands below are the same under either name.

## Commands

| Command | What it does |
|---|---|
| `agentmux setup` | The first-run choices, then starts the server and offers to sign a browser in. |
| `agentmux doctor` | Checks the machine for the server and says what to do about each problem. |
| `agentmux start` | Starts the server in the background and waits until it answers. |
| `agentmux stop` | Asks the server to shut down. `--force` ends it at once if it has not left after 30 seconds. |
| `agentmux restart` | Stops it, then starts it. Run it after an install to run the new version. |
| `agentmux status` | Says whether the server is running, its version, address, data folder and whether the login service is installed. |
| `agentmux open` | Signs a browser in (see [Sign a browser in](#sign-a-browser-in)). |
| `agentmux logout` | Signs every browser out. |
| `agentmux logs` | Shows the server's log. |
| `agentmux version` | Shows the version. |
| `agentmux run` | Runs the server in this terminal, which is what a service runs. |

`status`, `doctor` and `version` take `--json`. `--channel <name>` before or after any command works on another server channel. Exit codes are 0 for done, 1 when the thing asked is not so (the server is not running, a check failed), 2 for a command used wrongly and 3 when the command could not do it.

`start` and `run` take `--port` (1024 to 65534), `--secret-store`, `--public-origin`, `--srv-bin` and `--web-dir`; their defaults are what `setup` kept. When a login service is installed, `start` and `restart` refuse these flags, because the service starts the server from the saved settings: change them with `agentmux setup` instead.

`agentmux logs` shows the last 50 lines. `--lines <n>` changes how many, `--since <age>` shows only what was written in the last while (a number and `s`, `m`, `h` or `d`, such as `30m`), and `-f` keeps showing new lines until you interrupt it.

## setup

`agentmux setup` asks, in your terminal:

- **The web port** the browser opens (default 7380; the next port is used too).
- **Where secrets live**: `file` (owner-only files, for a server with no keychain; the default) or `keychain` (this machine's keychain, as the desktop app uses).
- **Whether to start AgentMux at every login**, as a user service (see [Start at login](#start-at-login)).
- **Whether to sign a browser in now.**

It runs the same checks as `doctor` first, and stops if one fails. Give each choice as a flag to skip its question: `--port`, `--secret-store file|keychain`, `--service` or `--no-service`, `--public-origin`. `--no-start` does not start the server and `--no-open` does not offer to sign a browser in. With no terminal (a script), `setup` asks nothing and needs `--yes` to take the current choices; for example:

```bash
agentmux setup --yes --port 7380 --secret-store file --service --no-open
```

A rerun changes only what it is told to. The choices are kept in the channel's folder, in `agentmux-server.json`, and the server reads them at each start. `--public-origin` is for a browser that reaches the server on another address, such as the end of an SSH tunnel; it must be `http://127.0.0.1:<port>`.

Models sign in where their command-line tools do: run the tool (for example `claude`) once in a terminal pane of the server.

## Start at login

With `--service`, `setup` installs a **user service**, one that needs no root: a systemd user unit on Linux (`agentmux.service` in `~/.config/systemd/user`) and a launchd agent on macOS (in `~/Library/LaunchAgents`). It starts the server at every login and starts it again if it stops with an error. A server on another channel gets a service of its own, with the channel in its name.

On Linux the service runs only while you are logged in. To keep it running with no one logged in, run `loginctl enable-linger $USER` once; `setup` prints the line. `agentmux setup --no-service` removes the service. With a service installed, `agentmux stop` stops the server through the service, and `agentmux status` shows `installed (starts at every login)`.

## Sign a browser in

The server serves its own web UI on `http://127.0.0.1:<port>`, and a browser must sign in before it shows anything. Run this in a terminal on the server's machine, as the same user:

```bash
agentmux open
```

It opens your browser at the server, which shows a short **check phrase**. The terminal then asks `A browser entered with "<phrase>". Is that the page you opened? [y/N]`. Answer `y` only when the browser shows that same phrase; any other answer discards the sign-in. Nothing answers for you: there is no flag for it, and `open` needs a terminal.

- The one-time code in the address works for 60 seconds and once.
- `--print` prints the address for you to open in your own browser instead of opening one.
- `--origin http://127.0.0.1:<port>` is for a browser that reaches the server on another address, such as the end of an SSH tunnel; it must match the server's `--public-origin`.
- Before it sends anything, `open` proves it holds the server's key file and the server proves itself to it; the key is never sent.

A signed-in browser stays signed in until it has had no request for 12 hours, and ends a week after you confirmed it whatever its use, when you sign in again with `agentmux open`. `agentmux logout` signs every browser out. In a signed-in browser, **Sign Out of This Browser** in the command palette ends that browser's own session.

## What doctor checks

`agentmux doctor` prints one line per check, `ok`, `warn` or `FAIL`, with what to do under each one that is not ok. It exits with 1 when any check fails.

- **platform**: Linux or macOS, on x86_64 or arm64.
- **install**: the server program and the web UI are where the command expects them.
- **folders**: the channel's folders are writable.
- **disk**: a failure under 200 MiB free, a warning under 1 GiB.
- **key file**: the server's key file is readable by its owner only.
- **port**: the server answers on its port, or the port and the next one are free to bind.
- **tools**: `node`, `npm` and `git` are on the PATH. Agents' command-line tools are installed through npm.
- **node version**: Node.js 20 or newer, which is the least any agent in the new-agent panel needs; some agents need a newer one.
- **certificates** (Linux): the system's certificates are found. Without them every https request the server makes (models, updates, connected accounts) fails. Install the `ca-certificates` package, or point `SSL_CERT_FILE` at a bundle, then restart the server.
- **libraries** (Linux): `libdbus-1.so.3` and `libxcb.so.1`, which the agent tools use.
- **shared folder**: another AgentMux of a different version holds the folder this version's data needs, so the server did not start. Close that AgentMux and run `agentmux start`, or update one of the two so both are the same version.
- **version**: the running server is not the installed version; `agentmux restart` runs the installed one.
- **service**: whether a login service is installed and runs this install of the command.

## Where things are

The server's data, settings and agents are in `~/.agentmux/channels/headless/` (another channel has its own folder there). `agentmux status` prints the exact data folder. The server's log is `server.log` in the channel's folder, which `agentmux logs` reads.

## See also

- [Installation](/installation/): the desktop app on Windows, macOS and Linux
- [Running multiple instances](/multi-instance/): channels and data folders
- [Environment variable contract](/internals/env-vars/)
