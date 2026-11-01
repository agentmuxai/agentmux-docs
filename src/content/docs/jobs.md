---
title: Jobs
description: "The Jobs pane: everything AgentMux runs by itself on a schedule, with each job's next run, history and cost, and Run now, Pause and a dry run."
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

The **Jobs** pane lists everything that runs by itself: scheduled jobs, and [Drone](/widget-gallery/#drone) graphs that have run. A job has a trigger (when it runs), an action (what it does), a policy (how) and caps. Each time a job was meant to run is a **run**, including the times it didn't (skipped or missed), each with its reason.

## Where to find it

Open it with **Open Jobs** in the command palette (`open:jobs`). The pane's title reads **Jobs**, and **Jobs · N failing** when N jobs are failing. Jobs was for a while a section of the Warden pane: see [Warden](/warden/).

An agent creates a job with the `Schedule` tool (action `create`, with `cron`), and you create one yourself with **New job**. A Drone graph appears in the list once it has run.

## The list

The pane refreshes while it is shown. A line at the top says "Everything that runs by itself", and **New job** and **Pause all jobs** are beside it. One row per job:

| Column | What |
|---|---|
| **Job** | The name, a **Drone** mark for a graph, and who made it: `by <agent>`, or `yours`. A job made from a template shows **Update available** or **Update to approve** when the template has a newer version |
| **Trigger** | When it runs, in words (for example "Mondays 06:00 UTC"), and when it runs next |
| **Last run** | How the last run ended, and how long ago |
| **Recent** | One mark per recent run; hollow marks are runs that were skipped |
| **Cost** | What its runs cost today, and over the last 7 days. A dash means no run reported a cost: the provider's own figure is the only source, and not every provider reports one |
| **State** | **Active**, **Paused**, **Paused by Pause all**, or **Ended** |

A run ends as **ok**, **findings** (it finished and reported something to look at), **failed**, or **unknown** (it finished without saying how it went: a finished turn isn't proof of success, so an agent reports with `Schedule` action `report`). A run that didn't happen shows **skipped**, **missed** or **lost**, with the reason, for example "AgentMux was off", "agent not running", "previous run still going", "job's daily cap reached" or "timed out".

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

## Creating and editing a job

**New job** opens the editor. **Start from** offers a template or a blank job. Ten starter templates ship with AgentMux: backup verification, a daily digest, a dependency scan, documentation drift, a nightly build, an event-triggered job, a PR review, a stale sweep, a weekly report and a weekly status. A template runs only once you have approved it (**Review and approve** in the template list; **Clone to a job** then starts a job from it). When the template has a newer version, a job made from it shows **Update available** (or **Update to approve**) in the list. Open the job and choose **Update to <version>**, or **Review <version>** if you haven't approved that version yet, to see what changes before you accept it. The editor asks for:

- **Name**, and **Owner**: its leader gets the failure alerts. **You (no agent)** keeps them with you.
- **Runs**: **On a schedule** (a cron expression, minute hour day-of-month month weekday, and an IANA **Time zone** such as Europe/Berlin; the days of the week are numbered as in standard cron: `0` and `7` are Sunday, `1` is Monday and `1-5` is Monday to Friday), **Every** (minutes; an agent job runs at most every 15 minutes), **Once** (at a time in your time zone) or **By hand**.
- **Does**: **Message an agent** (the message is another agent's words to it, not your instruction), **File a task** (a Kanban task, for an agent or for anyone), or **Start a worker** (a worker with a brief, reporting to a leader you choose; it starts for each run and spends until it stops).
- **Policy**: what to do **if the last run is still going** (skip the new run, buffer one, or cancel the other), **if a run was missed** (skip it, or run the latest one when the agent is back), a **Timeout**, **Retries** for infrastructure failures (at most 3), and a **Group**: runs of one group go one at a time. Retries wait 1, 5 and 15 minutes. At most three agent runs that nobody is watching go at once, across all jobs; the others wait for a place. A job that declares a `deploy` output runs in the group `deploy`, so deploys go one at a time.
- **Caps**, and **Enabled**: a disabled job doesn't run on its trigger.

## Caps

Every job has spending caps, on by default and low. The defaults are $5 per run, $20 per job per day and $50 per account per day, and 24 messages to other agents a day. A run starts only if the caps leave room for its whole per-run cap, and one that reaches its cap is stopped. You can raise a cap for one job in its editor, which says when you are above the default. The defaults themselves are `settings.json` keys, listed under [Job Caps](/settings/#job-caps).

## When a job fails

A failed run raises one alert per streak of failures, not one per run: a [Kanban](/kanban/) task for the job's owner's leader, and a note to that leader. Later failures of the same job add to the open task, and the job shows as recovered at its next success. The task's number is in the run's links. A failing job counts in the pane's title.

## See also

- [Audit](/audit/): messages between agents, including the messages a job sends
- [Kanban](/kanban/): where a failure's task goes
- [Swarm](/subagent-watcher/): cron jobs shown under each agent
- [Warden](/warden/): where this pane used to be a section
