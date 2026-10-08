# Widget screenshots

Every AgentMux widget, each in a pane of its own, at two sizes:

| Size | Window | File |
|---|---|---|
| small | 800×600 | `widget-<name>-small.png` |
| medium | 1280×800 | `widget-<name>-medium.png` |

Each size is the widget laid out at that window size, not a scaled copy. These are the sizes a pane usually has in a real AgentMux window; a widget maximized on a large screen is rare unless the pane is full of content.

**These show each widget's blank, fresh state:** how it looks when it first opens in a new install, with no agents, accounts, history or content. Use them to show what a widget is and where things are, not what it looks like in daily use. Shots with realistic mock data (a Swarm with many agents, an agent conversation, terminal history) are planned in #162.

`manifest.json` lists every image with its title, description, size and pixel dimensions.

Widgets: Agent, Swarm, Editor, Hangar (`files`), Remotes, Terminal, Sysinfo, Drone, Help, Warden, Media, Connectors, Memory and Settings. Not included: Browser (its web content can't be captured this way yet), Messengers (a group of third-party web apps) and Toolchain (it always shows the capturing machine's own installs).

## How they're made

With the screenshot tool in the agentmux repo, `scripts/ui-screenshots/` (spec: `docs/specs/SPEC_UI_MANUAL_SCREENSHOT_TOOLING_2026_09_19.md` §8):

1. Start an AgentMux build with an empty data folder (`AGENTMUX_HOME_OVERRIDE`) and a DevTools port (`AGENTMUX_CDP_PORT`).
2. `node scripts/ui-screenshots/demo-env.mjs --home <data folder> --demo <path>` writes the made-up `acme-web` project that Hangar, Terminal and Editor show. The path must not contain a user name.
3. `node scripts/ui-screenshots/capture.mjs --port <port> --suite widgets --sizes small,medium --out <dir>`.
4. Check every image for anything from the capturing machine before copying it here.

Re-running the tool after a UI change writes the same file names, so images can be replaced in place.

Captured from AgentMux 0.59.14 on 2026-10-08. Tracking: #162.
