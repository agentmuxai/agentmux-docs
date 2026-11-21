---
title: Drone
description: "The Drone pane and the drones it builds: a graph of blocks that runs by itself, with loops, branches, waits, error edges, checkpoints and templates."
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues) or [Discord](https://discord.com/invite/96erama9Ar).
:::

A **drone** is a saved graph of blocks. Each block does one thing: run an agent, send a message, file a task, call a web API, test a condition. Edges between blocks say what runs next, and a block reads what the blocks before it said. A drone runs without anyone at the keyboard, so it is built for unattended work: you set it on a [job](/jobs/) and it runs when the job fires.

## Where to find it

Open **Drone** from **more** at the end of the widget bar, or pin it there. The pane has a top bar and a canvas:

- **Untitled Drone**: the drone's name.
- One chip per block type: **Variables**, **Agent**, **Message**, **Task**, **Notify**, **App query**, **Spawn**, **API**, **Condition** and **Response**. Drag a chip onto the canvas, or click it to add the block at the centre. In a thin pane the chips collapse to icons.
- **Open…** lists your saved drones. **New** starts a blank one, and **Save** saves it.
- **▶ Run** saves the drone and runs it by hand. It is off until the drone has exactly one **Response** block, and its tooltip says what is missing. A run by hand has no dollar cap.

Drag from a block's output port to another block's input port to wire them. Click a block to edit its fields in place. A **Runs** panel at the bottom lists the drone's runs with their status, a short id and the output or the error; the zoom buttons zoom in, zoom out and fit the view.

The pane adds the ten blocks above. A saved graph can also hold **Transform**, **Wait**, **Join**, **For each**, **Drone** and **Run** blocks, [error edges](#errors-retries-and-timeouts) and [loops](#loops). The engine runs them; the pane has no chip for them, so they come in with a [template](#drone-templates) or a graph saved through the `upsertdrone` command.

## Blocks

A block's output is read by later blocks as `{{<block id>.<field>}}`. The pane's labels are in bold; fields only a saved graph can set are in code.

| Block | What it does | Output |
|---|---|---|
| **Variables** | Writes named values, read as `{{var.<name>}}`. Each entry has a name and a value, and a saved graph can give an entry a `reducer` (see [Variables and state](#variables-and-state)) | `vars`, what the block wrote |
| **Agent** | Runs one agent with a task and waits for its reply. **Bundle** picks a bundle (blank is a plain agent), **Instance** names an agent to continue (blank is a one-shot run), **Task** is the prompt, and **Reply fields** declares fields the reply must carry (see below). A saved graph can set `max_turns` | `response`, `tokens`, `cost_usd`, `status`, and `output` when **Reply fields** is set |
| **Message** | Sends a message to an agent: **To** (an agent's id) and **Message**. It goes the way an ordinary message does: to an agent here or in another instance, over the LAN or the relay, and held when the agent is out of quota or not running. A held message is not a failed run. `reply` set to `ok` lets the agent answer; the default is no answer | `delivered`, `held`, `to`, `id` |
| **Task** | Files a Kanban task: **Title**, **Text**, **For** (an agent's id; empty is the backlog) and **Key**. A second run with the same key adds a line to the open task instead of filing another; the key is kept per block and per target | `filed`, `task`, `work_id` |
| **Notify** | Tells you with an OS notification: **Title** and **Text**. The text is cut to 300 characters. Your notification settings still apply | `notified` |
| **App query** | Reads AgentMux's own state without starting an agent (see [App queries](#app-queries)) | By query |
| **Spawn** | Starts a worker of an agent: **Leader**, **Brief**, **Model** and **Account**. It takes the path an agent's own spawn takes: the leader must be running, and unless your settings let agents start agents, you are told first | `spawned`, `agent_id`, `name`, `message_to`, `block_id`, `asked_user` |
| **API** | Makes an HTTP request: **Method** (GET, POST, PUT, PATCH or DELETE), **URL**, **Body**, and optionally a **Vault entry** sent as `Authorization: Bearer` or as a named **Header** | `status`, `body`, `headers` |
| **Condition** | Tests an expression, **if**, and sends the run down its `true` or `false` edge (see [Conditions](#conditions)) | `result` |
| **Response** | Ends the run: its **Template** becomes the run's output | `value` |
| **Transform** | Shapes a list or an object with a chain of operations. No code runs (see [Transform](#transform)) | `value` |
| **Wait** | Stops the run for a time or an event (see [Waiting](#waiting)) | By kind of wait |
| **Join** | Brings branches that split back together (see [Branches and Join](#branches-and-join)) | `arrived`, `outputs`, `failed`, `errors`, `pruned` |
| **For each** | Runs one block once per item of a list (see [For each](#for-each)) | `results`, `errors`, `count`, `capped` |
| **Drone** | Calls another drone as a step (see [Calling another drone](#calling-another-drone)) | `value`, `run_id`, `version`, `cost_usd` |
| **Run** | Runs a fixed command in a container (see [Run](#run)) | `exit_code`, `stdout`, `stderr`, `duration_ms`, `truncated` |

**Reply fields** is a JSON object of `field: type`, up to 12 fields. A type is `string` (cut to 200 characters, or `{"type": "string", "max": N}` up to 500), `number`, `boolean`, or `{"enum": [...]}` with 1 to 20 values. The block adds the reply format to the prompt and takes the JSON object the agent ends its reply with. The next block reads each field as `{{<block id>.output.<field>}}`. Every declared field is required, a field you didn't declare is dropped, and a reply that doesn't fit fails the block. Branch on an `enum` field and not on prose.

The **API** block refuses a literal address that is loopback, private or link-local, and `localhost`. It reads at most 8 MB of a response, and a request times out after 30 seconds. A call that carries a Vault credential must name its `https` site in the graph, with no `{{reference}}` in the host, and follows no redirect. The first call asks you; an api-key entry's value or a login's password can be used. **GitHub repo** and **GitHub preset** fill the method, URL, headers and body of a common GitHub read or write, and a preset that changes something on GitHub says so.

### App queries

**Query** picks one of:

| **Query** | Reads | Output |
|---|---|---|
| **MuxBus** | Whether cloud messages reach this computer | `state`, `connected`, `signed_in`, `since_ms`, `last_ok_ms`, `last_error` |
| **All agents** | Every agent here, and which of those that should be running are not | `count`, `wanted_running`, `up`, `all_up`, `problem_count`, `problems`, `problem_names` |
| **One agent** | One agent's availability (**Agent**: its name) | `found`, `state`, and the availability fields |
| **Kanban tasks** | Tasks, filtered by **Holder**, **State** and **PR link**; each may be empty | `count`, `tasks` (default 50, at most 200) |
| **LAN peers** | The other AgentMux computers on the LAN, and whether each answered this computer's last polls | `count`, `answered`, `peers` |
| **Job runs** | Recent runs of one job (**Job**: a name or id), or the newest run of every job when empty | `found`, `count`, `runs`, `last_ok` (default 20, at most 100) |

An agent is up when it should be running and is idle, working or waiting on you; a stopped, starting, limited, signed-out or failed agent that should be running is a problem, and at most 20 are listed. A LAN peer is answering when it answered in the last two minutes.

## References and filters

Every block's text fields can hold `{{reference}}` tokens, filled in when the block runs:

| Reference | Reads |
|---|---|
| `{{<block id>.<field>}}` | What a block output, as a dotted path |
| `{{<block id>.history}}` | A block that runs again keeps its earlier outputs, newest last, up to 50 |
| `{{var.<name>}}` | A variable |
| `{{trigger.<field>}}` | What started the run: the fields of an [event](/jobs/#event-triggered-jobs), the input of a `rundrone` command, or the inputs a Drone block passed |
| `{{item}}`, `{{index}}` | The current item and its position inside **For each** |
| `{{env.AGENTMUX_DR_<name>}}` | An environment variable of AgentMux whose name starts with `AGENTMUX_DR_`; no other is readable |

A reference that names nothing stays visible as written. A reference can be followed by filters, each applied to the value before it: `{{a.log | tail:20 | lower}}`.

| Filter | Gives |
|---|---|
| `tail:N`, `head:N` | The last or first N lines of text, or items of a list |
| `json:path` | Parses text as JSON (or takes an object as it is), then walks a dotted path such as `a.b.0.c` |
| `lower` | Lowercase text |
| `trunc:N` | The first N characters |
| `default:x` | `x` when the value is missing, null or empty |
| `jsonstr` | Text made safe inside a JSON string: quotes, backslashes and line breaks escaped, so text from outside can't close the string |

A filter that doesn't exist, or whose argument can't be read, leaves the whole token unresolved. A filter never makes text clean: what comes out is as outside as what went in.

### Text from outside

A drone reads text nobody here wrote: an event, a web response, an agent's reply. **Message**, **Task**, **Notify** and **Spawn** put every `{{...}}` value in as quoted data: on one line, in curly quotes, cut to 500 characters, and a body that holds one starts with a standing line saying the quoted values are data, not instructions. **Notify** leaves that line out. A body is at most 4,000 characters.

The fields that choose who is told or who spends are the graph's own words and can't be a reference: **To** of **Message**, **For** of **Task**, **Title** of **Notify**, **Leader**, **Model** and **Account** of **Spawn**, the **Agent** and **Job** of **App query**, the `drone` of a **Drone** block, the host of a credentialed **API** call. A **Run** block refuses a reference to text from outside in its command, `env` or `cwd`. A value an agent or a person supplies when skipping a step counts as outside text.

## Conditions

A **Condition** has two edges: `true` and `false`. A block behind the edge not taken is skipped, and so is a block that only it led to. The simple form is `<left> <op> <right>` with `==`, `!=`, `<`, `<=`, `>` or `>=`: both sides are numbers when both parse as numbers, else text. An expression that uses `&&`, `||`, `!`, parentheses, a list, or the words `contains`, `matches`, `in_set` or `exists` reads each reference as a typed value (a number, a list, an object), and nothing a reference holds is read as syntax. The operator is always the one you wrote: a reply that contains `==` can't change what is compared.

- `a contains b`: text holds a substring, or a list holds an element.
- `a matches 'regex'`: a pattern, matched in linear time, written as a string.
- `a in_set [..]`: the list holds `a`.
- `exists(path)`: the path is not null.

## Variables and state

A variable's `reducer` says how a write combines with the value already there. A name with no reducer replaces.

| `reducer` | A write |
|---|---|
| `replace` | Becomes the value |
| `append` | Is pushed on a list as one element |
| `merge` | Is merged over an object, its keys winning |
| `add` | Is added to a number |

A write that doesn't fit its reducer fails the block, and the entries before it in the same block are put back as they were. Once a variable has a value its reducer can't change. A run's variables are at most 256 KB. A write never makes a tainted variable clean: a variable that ever held outside text stays outside text.

### Transform

**Transform** takes `input`, a template for what to shape (one `{{...}}` gives the value itself, a list or an object), and `ops`, a chain read top to bottom. Inside `map`, `filter` and the `by` expressions, `item` is the current element and `index` its position.

| Operation | Does |
|---|---|
| `map`, `filter` | `expr` per element; keep the elements where `expr` is true |
| `pick`, `omit` | Keep or drop top-level keys (`fields`) |
| `sort`, `group`, `unique` | Order by `by` (with `desc`), group by the key of `by`, drop repeats |
| `slice`, `first`, `last`, `flatten` | A range (`start`, `end`), the ends, one level flattened |
| `join`, `split`, `merge` | A list of text to one string (`sep`), a string to a list, an object merged over the input (`with`) |
| `count`, `sum`, `min`, `max`, `exists` | A number or a yes or no |

The expression language has numbers, text, `true`, `false`, `null`, lists, comparisons, `&&`, `||`, `!`, `+ - * / %`, and the functions `lower`, `trunc`, `default` and `exists`. A missing path is `null`. There is no other function, no variable, no loop and no network. An input is at most 10,000 items, an evaluation at most 100,000 operations, and the output at most 256 KB; past a limit the block fails and names it.

## Loops

A graph may hold a cycle, but every cycle must pass through a **Condition**, which is the loop's guard. A graph with a cycle that has none can't run and says which blocks loop. Each time the guard sends the run along an edge that stays inside the cycle, that is one more iteration. A guard takes:

| Field | Default | Meaning |
|---|---|---|
| `max_iterations` | 25 | 1 to 1,000 iterations |
| `on_cap` | `end_run` | `end_run` fails the run; `exit_loop` leaves the loop by the guard's other edges and sets `{{<guard id>.capped}}` |
| `max_cost_usd` | none | The most the loop's blocks may spend |
| `max_minutes` | none | How long the loop may run, counted from its first block |

When a limit is reached the run says which, in words. A block that runs again keeps its earlier outputs in `{{<block id>.history}}`.

### For each

**For each** runs the block named in `body` once per item of `items`, a reference to a list, one item at a time. The body block has no edges of its own and can't be another **For each** or a **Wait**. It reads `{{item}}` and `{{index}}`.

| Field | Default | Meaning |
|---|---|---|
| `max_items` | 100 | 1 to 1,000 items; past it the block stops |
| `on_item_error` | `stop` | `stop` fails the run; `continue` records the item in `errors` and goes on |
| `on_cap`, `max_cost_usd`, `max_minutes` | as a loop's | As in a loop |

## Branches and Join

Blocks that are ready together run together: up to four at once, and at most one of them starts an agent (an **Agent** or **Spawn** block), because a drone run counts as one unattended agent run. Blocks that read or send run in a batch; **Variables**, **Response**, **Wait**, **Drone**, **For each** and **Join**, and anything inside a loop, run alone. Each block of a batch reads the run as it was when the batch began, and their outputs are taken up in the order they became ready, so the result doesn't depend on which finished first. Two blocks that can run at the same time may write one variable only if its `reducer` is not `replace`; a graph that does otherwise is refused, naming both blocks and the variable.

A **Join** needs at least two edges into it. A branch arrives when its edge is taken; a branch whose source was skipped is pruned and counts for nothing.

| Field | Default | Meaning |
|---|---|---|
| `mode` | `all` | `all`: no branch failed. `any`: at least one arrived. `n_of_m`: at least `n` arrived |
| `n` | none | With `n_of_m`, how many must arrive; at most the number of branches |
| `on_branch_error` | `fail` | `fail`: a failed branch fails the run. `skip`: a failed branch is left out, and `mode` says whether the join still holds |

A **Join** doesn't stop slower branches: it runs once every branch is decided. What each branch said is `{{<join id>.outputs.<block id>}}`.

## Errors, retries and timeouts

By default a block that fails fails the run. Three things change that.

- **Error edges.** An edge from a block's `error` output is taken only when the block fails, and then no other edge is. The block's output is `{"error": ..., "failed": true}`, and the error text is outside text. The run goes on from there. A failure that every way out of the block leaves into a **Join** with `on_branch_error: skip` is handled too.
- **Retries.** A block with `retry` runs again when it failed for a reason that is the world's: an **API** request that didn't complete or whose body didn't arrive, an answer of 429 or 5xx, or an **Agent** that found memory full or was rate-limited. `retry` is a number, 1 to 3, or `{"max": 1 to 3, "backoff_seconds": 1 to 300}`. The wait doubles each time from `backoff_seconds` (2 when not set) and never passes five minutes. A block that ran and failed on its own terms (a refused URL, a timeout, an agent that said it failed) is never run again. A block that was retried says `tries` in its output, or `(after N tries)` in its error.
- **Timeouts.** A block's `timeout_seconds` is a whole number from 1 to 86,400. When it is not set, an **Agent** block gets 15 minutes, **Message**, **Task**, **Notify**, **App query**, **Spawn** and **Run** get 5 minutes, and the others have none of their own (an **API** request has its 30 seconds).

A run also ends when its **Agent** blocks have spent the run's dollar cap: "stopped: the run spent $X, its cap of $Y". A run started by a job has that job's per-run cap; a run started by hand has none.

## Cancelling a run

A run stops when its job's timeout passes, when the job's next run starts with overlap **cancel other**, or when a person or an agent answers `cancel` to a step that needs attention. The block in flight ends, an **Agent** block's process with it, the run ends **cancelled**, and the job's row says why. The Drone pane has no stop button.

## Waiting and restarts

After every block the run keeps a checkpoint: which blocks are done, what they said, the variables with their taint, what has been spent. A run has at most 1,000 checkpoints. Because of them a run left running when AgentMux restarts goes on from its last checkpoint instead of being marked interrupted. A run keeps the graph version it started on, so saving the drone meanwhile doesn't change it; each save makes a numbered version.

A block that only reads is simply run again after a restart. A block with effects is not, because it may already have done its work: **Agent**, **Message**, **Task**, **Notify**, **Spawn**, **Run** and **Drone**, an **API** block that writes (anything but GET, HEAD or OPTIONS) unless it sends an `Idempotency-Key` header, and a **For each** whose body is one of those. A run that finds such a block running waits, with the status `needs_attention`, for someone to say, once for each such block:

- **Run it again**, which may repeat what it did before the restart.
- **Skip it**, giving the output it is taken to have said (outside text, and its cost counts against the run's cap).
- **Cancel the run.**

The answer is the `resolvedronerun` command, with `run_again`, `skip` (and `output`) or `cancel`. A run that isn't answered waits; its job's timeout still stops it.

### Waiting

A **Wait** block stops the run and holds no process while it waits. It takes exactly one of:

| Field | Waits for |
|---|---|
| `for` | A length of time: `500ms`, `45s`, `30m`, `2h`, `1d`, or a number of seconds |
| `until` | A time, as `2026-12-01T09:00:00Z` |
| `on` | An event, named by a label. The run's `Waiting` event gives the key that ends it |

A wait is at most 30 days. The run's status reads `waiting`. A wait on an event ends when `resumedronewait` is called with that key, once, and what the event says (at most 64 KB) is `{{<block id>.payload}}`, outside text. The wait is kept in the checkpoint: after a restart it goes on where it was, a time that passed meanwhile ends it at once with `late` set, and an event that came while AgentMux was stopped is not remembered, so its source sends it again. A **Wait** with its own `timeout_seconds` keeps that limit across a restart rather than starting over, and an event wait whose limit already passed fails before it opens its key again.

### Calling another drone

A **Drone** block calls a saved drone as a step. `drone` is its id, written in the graph, `version` pins a saved version (otherwise the drone as saved now), and `inputs` is an object of names and values the callee reads as `{{trigger.<name>}}`, at most 64 KB. The callee runs on the caller's remaining cap and is stopped with the caller. What its **Response** says is `{{<block id>.value}}`, outside text. A drone can't call itself, directly or through the drones it calls, and calls nest at most 4 deep, the first drone counted. A callee keeps no checkpoints, so the block counts as a step with effects.

### Run

A **Run** block runs `command`, a list (the program, then its arguments, no shell), in a container with no network, no mounts, no secrets and a read-only root. `env` is an object of variables, `cwd` a directory inside the container, `image` a container image written in the graph (AgentMux's own base image when left out), and `ok_exit_codes` the exit codes that aren't a failure (`[0]` when left out). `timeout_seconds` is at most 3,600 and 300 when left out. `stdout` and `stderr` are cut at 64 KB and are outside text. A non-zero exit fails the block unless it is listed. If containers aren't available, the block fails and says why.

## Running a drone

- **By hand:** **▶ Run** in the pane, or the `rundrone` command with a `drone_id` and an optional `input` (at most 64 KB) that the drone reads as `{{trigger.<field>}}`.
- **From a job:** set the job's action to a drone. The trigger fires it, the job's [caps and policy](/jobs/#creating-and-editing-a-job) apply, and the run shows in the job's history with a **Drone run** link. A drone job can use a **Timeout** and overlap **cancel other**; it can't ask for retries. See [event-triggered jobs](/jobs/#event-triggered-jobs) for the triggers that start one from an event.
- **From another drone:** a **Drone** block.

A started run is replayed from a step with `replaydronerun`: a new run starts from a finished run's checkpoint on the same graph version, and a block with effects says what it said before instead of doing it again, unless the call asks `do_it_for_real`.

## Drone templates

AgentMux ships seven Drone templates. A template runs only once you approve it, and its prompt names its trigger, the size of its graph and how many blocks start an agent, every call that writes outside AgentMux, its outputs and secrets, and its default caps. Its graph is checked when it is read: at most 100 blocks and 300 edges, and no **Drone** or **Run** block. A template's text can hold `{{param.<name>}}` placeholders, filled from the parameters you give.

To use one, approve it, make its drone with `jobs.templates.make_drone` (the template's `id`, optional `version`, `params` and `name`; it saves an ordinary drone you can edit and starts nothing), then make a job whose action is that drone.

| Template | Trigger | Does |
|---|---|---|
| **Scheduled report** | Mondays 09:00 UTC | One agent answers **What to report on**, and the report is sent to **Who to tell** as a message. $2 per run |
| **Check and file a task** | Every 6 hours, UTC | An agent checks **What to check** and answers OK or describes the problem. Only a problem files a Kanban task for **Who gets the task** (empty is the backlog), and a problem still there on the next check adds a line to the same task. $1 per run |
| **Two-agent hand-off** | By hand | One agent does **First agent's work**, a second does **Second agent's work** from the first one's answer, and the result goes to **Who to tell** as a message. $3 per run |
| **After an upgrade: health check** | Five minutes after AgentMux starts on a new version | Checks that this computer's agents are running, that cloud messages reach it and that the LAN peers answer. All well: one line to **Who to tell**. Otherwise a Kanban task for **Who gets the task** that names what is not up, and a notification. A restart that is not an upgrade starts nothing. $1 per run |
| **Triage a failed nightly** | Every 15 minutes, polling GitHub | For each new failed scheduled workflow run of **Repository**, an agent reads the failed job's log and names the cause, the suspect commit and how sure it is. Unless it is unsure, a Kanban task goes to **Who gets the task** (one task per workflow, with a line for each red night) and **Who to tell** gets one line. Polling uses no agent tokens: the agent runs only on a failure. Needs a **Vault entry** with a GitHub token that can read the repository. $1 per run |
| **Flag a flaky job's first failure** | Every 10 minutes, polling GitHub | When the workflow you name (**The flaky workflow**) fails on its first attempt in a pull request, **Who to tell** gets one line with the run's link and a note to re-run it. It starts nothing itself, and a run is told once. Needs a **Vault entry** with a GitHub token. $1 per run |
| **A merged pull request whose task is still claimed** | Every 10 minutes, polling GitHub | Thirty minutes after a pull request merged, if a Kanban task with its link is still claimed, **Who to tell** gets one line naming the task and who holds it. Needs a **Vault entry** with a GitHub token. $1 per run |

## The `Drone` tool for agents

Agents have a `Drone` MCP tool: `list` (the drones, each with its id, name, block count and whether the agent may fire it), `get` (what one drone does, which blocks write outside AgentMux and which credentials it reads), `fire` (start a run with an `input` object as the run's payload; it is recorded as the agent) and `runs` (the latest runs, up to 50, with status and output). An agent can't fire a drone that writes outside AgentMux, reads a Vault credential, runs a command or calls another drone: a person runs those from the Drone pane, and `list` says which and why.

## See also

- [Jobs](/jobs/): triggers, caps, policy and the history of each run
- [Vault](/vault/): the entries an **API** block can send
- [Kanban](/kanban/): where a **Task** block files its task
