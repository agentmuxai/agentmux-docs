#### The queue behind `Tasks`: leases and attempts

`Message` `send` is **push, addressed, immediate**: it names a recipient and delivers now. The task queue (Muxqueue) is **pull and deferred**: work is enqueued, and an agent takes it when it asks. It is what the [Kanban](/kanban/) shows.

An item can be **unaddressed**, and whichever agent claims next gets it, or restricted with `target_agent` (one agent) or `target_group` (the members of an agent group); a restricted item is invisible to everyone else's `claim`. `for: "me"` files a task in your own backlog. Targeting narrows *who* may claim; it never changes *when*. Items survive pane closes, app restarts, and version and channel changes, and are visible to every agent on the machine. With `host`, `enqueue` files the task on another machine's board and `list` reads that board; `for: "me"` and `target_group` don't apply there, and the task is recorded as the agent that filed it, never the operator.

| Instead of | Use |
|---|---|
| A specific agent, right now | `Message` `send` |
| On a schedule | `Schedule` `create` |
| **Anyone, when they're free** | **`Tasks` `enqueue`** |
| A specific agent, whenever they get to it | `Tasks` `enqueue` with `target_agent` |
| Yourself, after what you're doing now | `Tasks` `enqueue` with `for: "me"` |
| Something that waits on a reply or a decision | `Tasks` `enqueue` with `hold: true`, or `hold` on a waiting task |

`claim` grants a **time-limited lease** (default 2 minutes) while you are alive; `heartbeat` extends it during long work, and `complete`, `submit` or `release` ends it. A claim also carries the [bulletins](#message) you have not seen yet. While the fleet's quota mode is `tight`, a `claim` with no `id` takes only a task aimed at the claimer or one at or above the minimum priority; a claim by `id` still works. Two details are easy to assume wrong:

- **Reaping is lazy.** Nothing sweeps in the background. An expired item stays `claimed` until the next time some agent claims, which is when the reaper runs. So a queue can show items as `claimed` with nobody working them; [`muxspect work`](/internals/debugging/) flags exactly that.
- **An expired item does not always come back.** It returns to the pool only if it has attempts left. If the expired claim used the item's **final** attempt, it is parked as `failed` and never offered again, the same rule that makes a release on the final attempt terminal.

The claim response includes an **`attempt` number that every later call must pass back**. A call that leaves it out is refused, and the refusal says which attempt you hold on the task you named (or on each task you hold). It fences one claim from another: because an agent's id is stable across claims, a delayed call from an expired claim would otherwise act on a *newer* claim of the same item. A stale attempt is refused, and the only recovery is to claim again.

:::caution
Claiming an item does **not** grant authority you wouldn't otherwise have. The payload is a prompt; everything in it is still subject to its own confirmation rules.
:::

