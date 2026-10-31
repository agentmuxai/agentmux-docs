---
title: The Vault
description: "The Vault pane: your secrets (ID numbers, cards and bank accounts, API keys, logins, notes), which agents use by name without ever seeing a value."
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

The **Vault** keeps your secrets: Social Security and other ID numbers, payment cards and bank accounts, API keys and tokens, site logins and secret notes. Agents use an entry by its name, to fill a web form field or to run a command, and never see its value. You decide where each entry may go.

Only you add, change, reveal, delete, import or export entries. No agent tool returns a value.

## Where to find it

The Vault is a pane of its own (icon: `lock`, view `vault`). It is **not pinned** to the widget bar by default. Open it in any of these ways:

- Click **more** at the end of the widget bar and choose **Vault**. Right-click it there and choose **Pin to bar** to keep it on the bar.
- **Open Vault** in the command palette (`open:vault`).
- **Fill it in** on an agent's request for an entry, or **Open the Vault** in the [Audit](/audit/) pane's Secrets block.

A tab holds one Vault: each of these brings back the Vault already open in the tab instead of opening a second. The pane's title reads **Vault · Cards and banks**, naming the Vault's own section.

The Vault was for a while a section of the Warden pane, which has been split up: see [Warden](/warden/). Saved panes, widget-bar pins, `widgets.json` entries and layout files that opened the Vault, or the Warden's Vault section, open the Vault pane the first time AgentMux starts after updating.

The Vault reads its entries only while it is shown. Opening the Audit or any other pane never reads them.

## What it holds

The Vault has its own row of sections:

| Section | Kinds | Secret parts | Plain details |
|---|---|---|---|
| **Personal data** | Social Security number, ITIN, Taxpayer ID, EIN, Date of birth, Passport, Driver's licence, Other ID number | The number or date | Whose; for an ID document also issued by and expiry; notes |
| **Cards and banks** | Payment card, Bank account | Card number, expiry, security code, name on card; account and routing numbers | Whose, bank, notes |
| **API keys** | API key or token | The key | Service, environment variable (`STRIPE_API_KEY`), expiry, notes |
| **Logins** | Login | Password, one-time code seed | Site, username, notes |
| **Notes** | Secret note | The text | |
| **Kept by AgentMux** | Read-only: secrets AgentMux keeps for itself in the same OS credential store (account keys, the MuxBus sign-in), with where each is managed | | |
| **Activity** | Every change to the Vault and every use of an entry: when, who, what, which entry, where. Never a value | | |

The list shows each entry's label, its id (for example `ssn-alex`), kind, plain details, the last few characters of its main value (`•••• 6789`; none for a short value, a password, a date of birth or a note) and when it last changed. It never shows a value.

## Add an entry

In a section, click **Add**, choose the **Kind**, give it a **Label** (how you and agents name it; agents see labels, never values), type the secret parts and any plain details, and **Save to Vault**. Secret parts are typed into hidden fields and never sent back to the pane.

An entry's id is made once from its kind and label and never changes, so an agent's reference survives a rename. **Change** (the pen) replaces only the parts you type; leave a part empty to keep it. **Delete** (the bin) deletes the entry, its value and its permissions.

An agent can ask you for an entry it needs. Every AgentMux window then shows its request, naming the agent, the kind, the label and why, with **Fill it in** and **Not now**, and the Vault lists it at the top with **Fill in** and **Dismiss**. **Fill it in** opens the Vault on a new entry of that kind. The agent gets the new entry's id, never its value.

## Reveal and Copy

The eye button on an entry opens **Show or copy**, with **Reveal** and **Copy** for each part that is set. Each one asks Windows Hello (your PIN, fingerprint or face) to confirm it's you, every time; nothing stays unlocked.

- **Reveal** shows the value for 15 seconds. It hides sooner on **Hide**, when the AgentMux window loses focus, when you close the dialog, and when you leave the Vault section.
- **Copy** puts the value on the clipboard without showing it, and clears it 30 seconds later if the clipboard still holds it. On Windows the copy is kept out of the clipboard history and the cloud clipboard.

On macOS and Linux, Reveal and Copy are disabled for now: Touch ID and the desktop's prompt aren't built yet.

The Vault opens with a note, **What the Vault may ask you**, listing what your OS may ask and when. Dismiss it with **Got it**; the ⓘ button in the Vault's header brings it back.

## How agents use entries

Agents have a `Vault` MCP tool with three actions: `list` (each entry's id, label, kind and section, no values), `request` (ask you for an entry, as above) and `generate` (make an entry, below). To use an entry they name its id:

- **In a web form:** the `Browser` tool's `fill` with `vault: "<id>"`, or `"<id>.<part>"` for one part (`card-company.cvc`). AgentMux types the value into the field itself; the agent gets back only that the field was filled. From then on the field reads as secret to the agent in snapshots, read-backs and screenshots. An agent never fills a password or a one-time code: you type those.
- **In a command:** the `Terminal` tool's `run` with `background: true` and `secrets: {"STRIPE_API_KEY": "<id>"}`. The value goes into that one process's environment, and the job's output is cleaned of it, shown as `[vault:<id>]`. Commands with secrets run only on this computer, not over WSL or SSH.
- **In a command, by another way in:** some tools won't read a key from the environment. `stdin_secret: "<id>"` writes the value to the command's standard input, then a newline, and closes it (for `docker login --password-stdin` or `gh auth login --with-token`). `secret_files: {"GOOGLE_APPLICATION_CREDENTIALS": "<id>"}` writes each value to a file only you can read, puts the file's path in that variable, and removes the file when the command ends. Both are asked about and cleaned like `secrets`, and run only on this computer.
- **A secret nobody has chosen yet:** the `Vault` tool's `generate` makes an API key, login or note whose value the Vault creates itself (a strong random value; for a login, its password), for example a webhook signing secret or the password of an account the agent is setting up. The agent gets the new entry's id and how it was made, never the value, and you aren't asked, since nobody has seen it: the entry appears in the Vault, where you can reveal it. The agent can ask for a value that follows a site's own rules (8 to 128 characters, required and allowed characters), or for 6 to 12 words when a person has to type it.
- **A value you don't have stored yet:** the `Browser` tool's `request_value` asks you to type one value for one field, in AgentMux's own prompt. **Save to the Vault** keeps it as a new entry. An agent that asks again for an entry (the `Vault` tool's `request`, for the same kind and label), for example after its session restarted while you were away, doesn't open a second form: it waits on the open one, or gets the entry you already saved.

The first time an agent uses an entry on a site, or in a command, every AgentMux window asks you. The prompt names the agent, the entry, and the site and field, or the command and where it runs, with **Deny**, **Allow once**, and **Always on &lt;site&gt;** or **Always for &lt;agent&gt;**. "Always" covers that one entry on that one site, or that one agent's commands, and nothing wider. Auto-approve never answers these prompts; only you do.

Cleaning a command's output is a guard, not a boundary: a command can transform a value and print it, or send it wherever the command line says. Read the command before you allow it, and prefer keys scoped to the task.

## Permissions and Activity

Each entry lists its standing permissions under its label: **Agents may fill it on** the sites you allowed always, and **Agents may run commands with it** for the agents you allowed always. The × next to one revokes it; the next use asks again.

The Vault's **Activity** records every change and every use: saving, revealing, copying, each fill and command with its outcome, imports and exports. **See agents' use in Audit** opens the [Audit](/audit/) pane, which ends with **Secrets**: the agents' uses of entries (not yours), and every standing permission with a way to stop it.

## Export and import

The Vault's import and export buttons are in the Vault's header.

**Export the Vault** saves a password-protected `.vault` file: choose the entries (all are selected), type a passphrase twice (at least 8 characters; **Suggest one** makes one from random words), then where to save it. It holds every value, label and detail, but not permissions or Activity. A `.vault` file is an [age](https://age-encryption.org) file encrypted to the passphrase, so you can open your own export without AgentMux with `age -d`. Anyone with the file and its passphrase can read every secret in it.

**Import into the Vault** reads a file and works out its format from its contents:

- an AgentMux `.vault` file, with its passphrase;
- a KeePass database (`.kdbx`, KDBX 3.1 and 4), with its master password (a key file isn't supported yet);
- LastPass's CSV export;
- 1Password's `.1pux` or CSV export;
- Bitwarden's unencrypted JSON export;
- a browser's password CSV: Chrome, Edge, Brave, Firefox, Safari or Apple Passwords;
- a `.env` file (each variable becomes an API key named for it);
- any other CSV, where you say which column is the label, the value, and for logins the site and username.

Nothing is added until you press **Import**: first a preview lists what will come in, what can't and why, and the entries you already have. For those you choose **Skip them**, **Replace mine** or **Keep both**. Folders and groups become tags, and notes and custom fields come in as secret notes. After importing a plaintext export, the Vault says the file holds every secret unencrypted and offers to delete it (not a secure erase).

## Where it is stored

- **One Vault key** in the OS credential store: Windows Credential Manager, the macOS Keychain, or your desktop's keyring. It is made with your first entry.
- **Each entry** is one row in `shared/identity-store.db`, with its secret parts encrypted together with that key (ChaCha20-Poly1305, tied to the entry's id). No column holds a value, and Activity never records one.

The Vault is shared by every AgentMux on this computer, installed and development builds alike, and an update keeps it. It is not synced anywhere: a `.vault` export is how it moves to another computer. On macOS, the keychain may ask whether AgentMux may use the Vault key; the note in the Vault says when. See [Identity & credential storage](/security/identity-credential-storage/#the-vault) for what protects it.

## Kept off agents' screens

- `UI` `screenshot` is clipped to the agent's own pane, and the Vault is blacked out in it even when it floats over that pane.
- `UI` `window` captures a whole OS window, so it can't black out one part. While the Vault is on screen in any AgentMux on this computer, it refuses to capture any AgentMux window. Hiding the pane or closing it ends that within seconds.
- `UI` `query` and `click` reach only the agent's own pane, and the Vault's forms and dialogs are drawn inside the Vault.

## See also

- [Audit](/audit/): what agents did with your entries, and where they may use them without asking
- [Warden](/warden/): where the Vault's old home went
- [Identity & credential storage](/security/identity-credential-storage/): every secret AgentMux keeps, and how
- [Identity & Accounts](/identity/): the accounts agents run as, which are not Vault entries
