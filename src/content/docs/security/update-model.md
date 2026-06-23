---
title: "Update model"
description: "AgentMux does not auto-update. This is a deliberate security posture, not a missing feature. Here's how updates actually work."
---

AgentMux is intentionally manual-update. There is no auto-updater, no background download, no version check, no notification system. This page explains why, how to actually stay current, and how tool downloads (a related but separate flow) work.

## Why manual

A typical desktop app's auto-updater is a privileged service that fetches and runs arbitrary code from the developer's update server. That's a powerful attack surface: a compromise of the update endpoint (or its TLS cert, or its DNS, or a developer's signing key) is a remote-code-execution channel to every installed copy.

AgentMux opts out. The trade-off is on the user — you check for updates and run the installer yourself — in exchange for removing an entire class of supply-chain attack from the threat model. The same reasoning informs how [Tool downloads](#tool-downloads) work (SHA-pinned, catalog-driven).

This is consistent with the rest of the [trust model](/security/trust-model/): AgentMux trusts the user, and the user trusts what the user chooses to install.

## How updates actually work

1. We publish a release on GitHub (`https://github.com/agentmuxai/agentmux/releases`). Each release has signed/notarized binaries for macOS, NSIS installer + portable ZIP for Windows, AppImage + .deb for Linux.
2. The release manifest (`https://agentmux.ai/release.json`) is updated with the new version, the URL of each binary, and its SHA-256.
3. You can:
   - Watch the GitHub releases atom feed: `https://github.com/agentmuxai/agentmux/releases.atom`.
   - Or check `https://agentmux.ai/download` periodically.
4. You download the binary, verify the SHA-256 (optional but easy — see below), and run the installer.

There is no in-app notification when a new release lands. You will not see a "new version available" banner. If you want notifications, subscribe to the atom feed or follow the project on social.

## Verifying a download (optional)

If you want to verify a download's SHA-256 against the manifest:

```bash
# Get the expected hash from the manifest
curl -s https://agentmux.ai/release.json | jq '.assets.macos.arm64.sha256'

# Compute the hash of your downloaded file
shasum -a 256 ~/Downloads/AgentMux_aarch64.dmg
```

The strings should match. If they don't, the download is corrupt or tampered — re-download or report.

On Windows, the equivalent is `Get-FileHash -Algorithm SHA256 path\to\installer.exe`.

## Tool downloads

Separate from app updates: when you install an agent CLI or other tool through AgentMux's tool catalog, AgentMux downloads the binary on your behalf. This flow has the same security model as the app update — and a stronger guarantee because AgentMux is the one driving it:

- Every entry in the tool catalog includes a SHA-256.
- AgentMux downloads the binary, computes the SHA-256, and compares.
- A mismatch aborts the install with an error. The binary is not run.

The catalog itself ships with AgentMux — updates to the catalog come with app updates. Adding a new tool entry is a source-code change, reviewed in a PR. There is no runtime "update the catalog from the internet" path.

## Air-gapped operation

AgentMux runs without internet. The only network-dependent features are:

- **Agent CLIs** — they need to reach their LLM provider. If your agent is air-gapped (an on-prem model, a local mock), the agent doesn't need internet.
- **MCP servers** — those that fetch from external services need internet; local MCPs don't.
- **Tool downloads** — needed only at install time. Once tools are installed, AgentMux doesn't re-fetch them.

To operate AgentMux fully offline:

1. Install AgentMux and any tools you need on a connected machine.
2. Copy the install directory (and `~/.agentmux/` if you want to bring sessions) to the air-gapped machine.
3. Configure agents to point at on-prem or local model endpoints.
4. Disable mDNS discovery and cloud MuxBus poller in settings (both are off by default; nothing to do).

## What we don't promise

- **No security-update auto-deployment.** A critical CVE in a dependency means we publish a release; you update on your own schedule.
- **No telemetry-driven rollback.** If a release breaks something for you, we won't know unless you tell us. Report breakage on GitHub Issues.
- **No staged rollouts.** Everyone who downloads gets the same binary.

These are conscious trade-offs of the manual-update posture. If your organization needs managed updates (auto-deployment, staged rollouts, telemetry-driven rollback), the answer today is to roll your own with your existing software-delivery infrastructure (Jamf, Intune, Chef, Ansible, etc.) — drop the AgentMux binary into your normal package pipeline.

---

**Source-of-truth references**:
- `agentmux-landing/public/release.json` — release manifest
- `agentmux-srv/src/backend/tool_store.rs` — SHA-pinned tool downloads
- (No update endpoint exists in the launcher or sidecar; this is verifiable by code search.)
