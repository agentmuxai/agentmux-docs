---
title: Jobs
description: "The Jobs pane: everything AgentMux runs by itself on a schedule, with each job's next run, history and cost, and Run now, Pause and a dry run."
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

The **Jobs** pane lists everything that runs by itself: scheduled jobs, [Drone](/drone/) graphs that have run, and approved cloud jobs that report in. A job has a trigger (when it runs), an action (what it does), a policy (how) and caps. Each time a job was meant to run is a **run**, including the times it didn't (skipped or missed), each with its reason.

## Where to find it

Open it with **Open Jobs** in the command palette (`open:jobs`). The pane's title reads **Jobs**, and **Jobs · N failing** when N jobs are failing.

An agent creates a job with the `Schedule` tool (action `create`, with `cron`) and also lists, pauses, resumes, deletes, reads the history of and runs jobs once with it. You create one yourself with **New job**. A Drone graph appears in the list once it has run, and a cloud job once you approve its template.

## The list

The pane refreshes while it is shown. A line at the top says "Everything that runs by itself", and **New job** and **Pause all jobs** are beside it. One row per job:

| Column | What |
|---|---|
| **Job** | The name, a **Drone** mark for a graph, a **Cloud** mark for a cloud job, and who made it: `by <agent>`, or `yours`. A job made from a template shows **Update available** or **Update to approve** when the template has a newer version |
| **Trigger** | When it runs, in words (for example "Mondays 06:00 UTC"), and when it runs next. A cloud job with no schedule reads "when it reports" |
| **Last run** | How the last run ended, and how long ago |
| **Recent** | One mark per recent run; hollow marks are runs that were skipped |
| **Cost** | What its runs cost today, and over the last 7 days. A dash means no run reported a cost: the provider's own figure is the only source, and not every provider reports one |
| **State** | **Active**, **Paused**, **Paused by Pause all**, or **Ended** |

A line above the list says how many cloud events AgentMux has dropped since it started, and why (for example an unknown job or a bad signature). A dropped event is never shown as a run.

A run ends as **ok**, **findings** (it finished and reported something to look at), **failed**, or **unknown** (it finished without saying how it went: a finished turn isn't proof of success, so an agent reports with `Schedule` action `report`). A run that didn't happen shows **skipped**, **missed** or **lost**, with the reason, for example "AgentMux was off", "agent not running", "previous run still going", "job's daily cap reached", "too many events this hour", "waiting out its delay" or "timed out".

## One job

Click a row to open it. Its history lists each run with **When**, **Run**, **Took**, **Summary**, **Cost**, **Account** and **Links** (the agent that ran it, the Kanban task a failure went to, a Drone run), and **Older runs** pages back. The **Agent** button in a run's links goes to the agent that ran it. History is kept forever.

| Button | What it does |
|---|---|
| **Run now** | Runs the job once, at once, as a run of its own. Off while everything is paused |
| **Pause** / **Resume** | Stops or restarts its scheduled runs. A paused job's skipped runs are logged as one row with a count |
| **Delete** | Asks first, then removes the job. Its past runs stay in the history |
| **Edit** | Opens the job in the editor |
| **Clone** | Starts a new job from this one |
| **Dry run** | Shows what a run would do, and starts nothing: where it goes, the brief, the next fire times, the caps, and the outputs and Vault entries it names |
| **Open owner** | Goes to the agent that owns the job |

**Pause all jobs** pauses every job at once. A banner says so and since when, scheduled fires are skipped and **Run now** is off until you choose **Resume all jobs**.

## Cloud jobs

A cloud job runs somewhere else and reports each run to AgentMux as a signed event. AgentMux starts nothing for it. It appears in the list once you approve its template, with a **Cloud** mark and `reports as <reporter>` under its name. Its history shows the reporter, the **grace** period after an expected time before a missing report counts as **missed**, and how long a run may go without news before it is **lost**.

A cloud job's **Run now** opens the page its template names, or, when there is none, tells you what to ask its owner.

**Cloud reporters** opens a panel of the reporters whose keys you have pinned. Each row shows the reporter's name, the fingerprint of its key and the approved cloud jobs that report as it:

- **Pin reporter** adds one: a **Name** (lowercase letters, digits and dashes) and its **Public key** (an Ed25519 public key, base64). Approving a cloud template pins its reporter too.
- **Forget** removes a reporter, after a second question (**Forget it** or **Keep**). Its approved jobs stop receiving events.

Pinning a key lets no event in by itself: an event also has to match the key of an approved template. A job whose reporter isn't pinned shows **Reporter not pinned**, and its events are dropped. Agents can list, pin and forget reporters too (`jobs.reporters.list`, `jobs.reporters.add`, `jobs.reporters.forget`), and the list of jobs (`jobs.list`) includes the approved cloud jobs, with their reporter, and the dropped-event counts.

## Creating and editing a job

**New job** opens the editor. **Start from** offers a template or a blank job. Ten starter templates ship with AgentMux: backup verification, a daily digest, a dependency scan, documentation drift, a nightly build, an event-triggered job, a PR review, a stale sweep, a weekly report and a weekly status. Seven [Drone templates](/drone/#drone-templates) ship beside them. A template runs only once you have approved it (**Review and approve** in the template list; **Clone to a job** then starts a job from it). When the template has a newer version, a job made from it shows **Update available** (or **Update to approve**) in the list. Open the job and choose **Update to <version>**, or **Review <version>** if you haven't approved that version yet, to see what changes before you accept it. The editor asks for:

- **Name**, and **Owner**: its leader gets the failure alerts. **You (no agent)** keeps them with you.
- **Runs**: **On a schedule** (a cron expression, minute hour day-of-month month weekday, and an IANA **Time zone** such as Europe/Berlin; the days of the week are numbered as in standard cron: `0` and `7` are Sunday, `1` is Monday and `1-5` is Monday to Friday), **Every** (minutes; an agent job runs at most every 15 minutes), **Once** (at a time in your time zone) or **By hand**.
- **Does**: **Message an agent** (the message is another agent's words to it, not your instruction), **File a task** (a Kanban task, for an agent or for anyone), or **Start a worker** (a worker with a brief, reporting to a leader you choose; it starts for each run and spends until it stops).
- **Policy**: what to do **if the last run is still going** (skip the new run, buffer one, or cancel the other), **if a run was missed** (skip it, or run the latest one when the agent is back), a **Timeout**, **Retries** for infrastructure failures (at most 3), and a **Group**: runs of one group go one at a time. Retries wait 1, 5 and 15 minutes. A job whose action is a Drone can't ask for retries. At most three agent runs that nobody is watching go at once, across all jobs; the others wait for a place. A job that declares a `deploy` output runs in the group `deploy`, so deploys go one at a time.
- **Caps**, and **Enabled**: a disabled job doesn't run on its trigger.

## Event-triggered jobs

A job can start when something happens instead of on a clock. Its trigger is an **event** with a **source**, a small **filter** that says which events count, and the action is a [Drone](/drone/): the run reads what happened as `{{trigger.<field>}}`. The job editor doesn't offer event triggers, and the `Schedule` tool doesn't create them: they are part of a job definition, which `jobs.save` takes.

| Source | Starts a run when | The run reads |
|---|---|---|
| `app_event` | AgentMux reports an event named in the filter's `event` | The event's fields, below |
| `file_watch` | Files change in a folder | `root`, `paths`, `count`, `first`, `change` |
| `webhook_local` | A script on this computer POSTs to the job's address | `body`, `received_ms` |
| `poll` | AgentMux asks its own state a question every so often and an item is new | `query`, `key`, `item` |
| `expect` | A job you name has had no good run within a set time | `expected`, `within_minutes`, `last_ok_ms`, `job_found`, `last_seen` |

Every event trigger also takes:

- `delay`: minutes to wait between the event and the run, at most 10,080 (a week). The run waits as a scheduled row ("waiting out its delay") and starts when due; the event's data is kept with it, so a restart doesn't lose it. The job's policy and caps are checked when the run is due. Without a delay the run starts at once.
- `max_per_hour`: the most runs the trigger starts in any hour, 1 to 1,000, 30 when left out. The events beyond it are one collapsed **skipped** row with the reason "too many events this hour", and the first raises the usual cap alert.

A filter has at most 8 entries. Its keys and text values are at most 200 characters, and a value is plain text, a number, or true or false: never an expression. A job that already heard an event id starts nothing for it again, and an id is forgotten after a week.

### `app_event`

The filter names the event and may name any of its fields; an event matches when every entry equals its field.

| `event` | Fields | When |
|---|---|---|
| `agent.turn_ended` | `agent`, `outcome` (`completed` or `errored`), `cost_usd` | An agent's turn ends. AgentMux's own hidden turns don't count |
| `agent.crashed` | `agent`, `reason` | An agent's process fails (a limit, a sign-in, a crash) |
| `app.started` | `version`, `upgraded`, `upgraded_from` | AgentMux starts. `upgraded` is true when this start followed an upgrade, and `upgraded_from` is the version it came from |

### `file_watch`

The filter has `path`, the folder to watch, and optionally `glob` and `change`.

- `path` is an absolute folder at least three levels deep (a project, not a home folder or a drive), with no `..` in it.
- `glob` is a pattern relative to the folder, such as `**/*.rs`: `*` and `?` stay inside one folder level and `**` crosses levels.
- `change` is `created`, `modified` or `removed`.

Changes are debounced: the run starts once the folder has been quiet for two seconds, or the first change is thirty seconds old, with one event for the whole burst. The event carries names only, never contents: `paths` holds at most twenty names under the folder (each cut to 200 characters), `count` is how many files changed, `first` is the first name, and `change` is the kind of change, or `mixed`. Files under a `.git` folder never count.

### `webhook_local`

The filter has one key, `secret_sha256`: the SHA-256 of a secret, as 64 lowercase hex characters. The job keeps only the hash. A script starts a run with a POST to `http://127.0.0.1:<port>/agentmux/hook/<job id>`, where `<port>` is the port of AgentMux's local server, with:

- `Content-Type: application/json`, and a JSON object as the body, at most 64 KiB.
- The secret in the `x-agentmux-hook-secret` header.
- Optionally an `x-agentmux-hook-id` header (at most 200 characters), so a script that retries a call it didn't hear back from starts one run.

The answer is `202` with `{"ok": true, "status": ..., "run_id": ...}`, where `status` is `started`, `waiting` or `not_started`. A request is refused when it doesn't come from this computer, carries an `Origin` or `Sec-Fetch-*` header (a web page's), has another content type, or has no secret or the wrong one. A wrong secret, a job that doesn't exist and a disabled job all get the same answer. The run reads the body as `{{trigger.body}}` and the time as `{{trigger.received_ms}}`.

### `poll`

The filter says what to ask and how often. `query` is `tasks`, `jobs`, `agents`, `lan_peers` or `api`, and `every_minutes` is 1 to 1,440. Polling spends no agent tokens. Each new item starts one run, which reads `{{trigger.query}}`, `{{trigger.key}}` (the item's id) and `{{trigger.item}}`.

| `query` | An item is | Other filter keys |
|---|---|---|
| `tasks` | A Kanban task, by its number | `holder`, `state`, `pr`, `limit` (1 to 200) |
| `jobs` | A run of the job named in `job` (required), by its id | `job`, `limit` (1 to 200) |
| `agents` | An agent that should be running and isn't, by its name and state | None |
| `lan_peers` | A machine on the LAN, by its host name | None |
| `api` | An entry in a list at an address you give | `url`, `auth`, `headers`, `items`, `id`, `limit` |

The first poll of a job only takes note of what is already there, so turning a job on doesn't start a run for everything that happened before; `include_existing: true` runs those too. An item is never reported twice. A poll that finds more than 20 new items starts 20 and leaves the rest for the next look. A poll whose question fails is skipped and asked again at the next time.

A poll of `api` asks one `https` address, at most every 5 minutes, with no `{{reference}}` in its `url`, `headers` or `auth`. `items` is the dotted path to the list in the answer (empty when the answer is the list), `id` the path of an item's id inside each entry (`id` when left out), and `limit` keeps at most that many entries (100 when left out, at most 200). `auth` is `{"vault": "<entry>", "as": "bearer"}`: a poll never asks you, so it uses a Vault credential only when you already answered **Always** for that drone and site, which you do by running the drone by hand once.

### `expect`

A dead man's switch. The filter has `job`, the name or id of the job to watch, `within_minutes` (1 to 43,200, thirty days) and optionally `every_minutes` (how often to look, 1 to 1,440, 5 when left out). A good run is one that finished with the outcome **ok** or **findings**. While a run of the watched job is still going, nothing starts. When the last good run is older than `within_minutes`, or there has never been one, the job's run starts once for that gap; a good run followed by a new gap starts another. The check reads this computer's run history, so it can't fire while AgentMux is off.

## Caps

Every job has spending caps, on by default and low. The defaults are $5 per run, $20 per job per day and $50 per account per day, and 24 messages to other agents a day. A run starts only if the caps leave room for its whole per-run cap, and one that reaches its cap is stopped. You can raise a cap for one job in its editor, which says when you are above the default. The defaults themselves are `settings.json` keys, listed under [Job Caps](/settings/#job-caps).

## When a job fails

A failed run raises one alert per streak of failures, not one per run: a [Kanban](/kanban/) task for the job's owner's leader, and a note to that leader. Later failures of the same job add to the open task, and the job shows as recovered at its next success. The task's number is in the run's links. A failing job counts in the pane's title.

## See also

- [Audit](/audit/): messages between agents, including the messages a job sends
- [Kanban](/kanban/): where a failure's task goes
- [Swarm](/subagent-watcher/): cron jobs shown under each agent
