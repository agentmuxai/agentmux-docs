#### Reading what each agent runs on

`Agents` `list` and `Agents` `status` answer "what is each agent actually running on, and in what state" from AgentMux's own runtime state, not from an agent's definition and not from what an agent says about itself. The answer covers every agent on the machine, container agents included.

**A call with no parameter returns each agent's usual row** plus two short fields: `model_label` (for example `Sonnet 5.5`) and `model_source`. Nothing more is added until you ask for it.

##### Where a model comes from

`model_source` says how well a model is known, so a value that was only asked for is never shown as one that is running:

| `model_source` | Meaning |
|---|---|
| `effective` | The agent's own CLI reported it, read when the agent starts and after every turn. |
| `observed` | The model of the last call the agent made. |
| `route` | The agent is on a model route, and the route's gateway sends its calls to this model. |
| `requested` | Only what the pane was started with, or last asked for, is known. Not yet confirmed. |
| `unknown` | Nothing says. The row says why, and no model is guessed. |

A model or effort change waits for the end of the turn. Until then the `model` facts (below) show the model the agent still runs, `pending_switch: true`, and, when the change is to another model, `pending_label`, the one it will switch to. A change of effort alone sets `pending_switch` and no `pending_label`. A call with no `fields` does not show a pending change.

##### Narrowing, paging and more facts

All of these are optional and combine with AND:

| Parameter | Effect |
|---|---|
| `state` | Only agents in this state (`idle`, `working`, `limited`, `stopped`, ...). |
| `model` | Only agents whose model id or short name contains this, ignoring case. A leading `!` means *not this one*, and also keeps the agents whose model is not known, because they are not shown to be on it. |
| `provider`, `runtime`, `account`, `seat` | Only that provider (`claude`, `codex`, ...); only `native` or `container` agents; only an account whose stable id or label contains the text; only a seat whose role, lead or area does. |
| `limit`, `offset` | One page. The answer says `total`, `returned` and whether it was cut. |
| `fields`, `detail` | Add a `facts` object to each row. `fields` is a comma list of groups, or `all`; `detail` is `basic`, `facts` (every group but `host`) or `full`. |

The groups are `model` (id, label, effort, source, and a pending change), `runtime` (harness, native or container, image, permission mode, whether its pane is shown), `turn` (active, since, duration, last activity), `context` (tokens, window, percent, the point it compacts at, how often it has compacted), `account` (its label), `usage` (how much of each usage window of its account is used), `spend`, `task` (the Kanban tasks it holds), `session` and `host` (this AgentMux's name and version). A fact nothing says is left out, never filled in. A reading that has gone stale is marked `stale: true`, not dropped.

"Which agents are not on Sonnet, and what are they doing" is one call: `Agents` `status` with `model: "!sonnet"`.

##### `Agents` `status`

The same agents, one compact line each, for a glance at a whole fleet:

```
Worker-1 | working (turn 4m) | Sonnet 5.5 high | ctx 62% | Work | 5h 60% 7d 44% | #1234
```

With the counts by state and by model, and with `group_by` (`model`, `state`, `host`, `account`, `provider` or `runtime`) the agents grouped. It takes the same filters and `limit` as `list`. A model that is only requested, or has a change waiting, ends in `?`.

##### Other machines

`host` on `list` and `status` asks another machine instead of this one: the name of a LAN peer as `list` shows it, or `all` for this machine and every peer at once, each asked in parallel with a 3 second wait. The peer answers a read-only operation, `agents.status`, so it must be a machine that has pinned your key and whose install this machine trusts, as for the other actions that take a `host`. Without `host` the answer is this machine only.

Every row then says which host it is from (in a `status` line, the host's name comes right after the agent's name), and a `hosts` block says for each machine whether it answered (`ok`, `unreachable`, `needs_upgrade` or `refused`), its version, and when its answer is from. A machine that does not answer, or runs a build too old to know the question, is listed by what the LAN poll already says of it (name, state, provider, kind) with `facts: "liveness_only"`: no model, never a guess. An agent that is reachable only through the cloud relay is not readable at the field level.

##### What is not in the answer

Message and prompt text, transcripts, tool arguments and results, credentials and tokens, environment values, file contents and account emails are never part of these facts. An account is named by its display name or name and a stable id, never by its email. A row that crosses the LAN also leaves out the agent's working folder and pane ids on the machine it runs on. These calls say what state an agent is in, not what it said or did.
