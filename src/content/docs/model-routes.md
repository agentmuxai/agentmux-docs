---
title: Model routes
description: "Run an agent on another model through a model route: which models there are, how the key stays in the Vault, how to put an agent on one, and the daily spend caps that stop it."
---

:::caution[Alpha Software]
AgentMux is **alpha software** and under heavy active development. Many features described in these docs may be incomplete, unstable, or not yet implemented. Expect breaking changes between releases. We welcome bug reports and feedback on [GitHub Issues](https://github.com/agentmuxai/agentmux/issues).
:::

A **model route** lets a Claude Code agent run on a different model than your plan's, and pay for it with a key of yours instead of a plan. The agent is the same agent: same pane, same conversation, same tools. Only the model that answers, and who pays for it, change.

AgentMux offers one route today, **OpenRouter**. It serves Claude Code agents only.

## How it works

The agent's Claude Code never gets your key. AgentMux's server (srv) hands it a token of its own that only works for that agent on that route, and sends the agent's requests on to the route's provider with your key added there. The key stays in the [Vault](/vault/); each use shows in the entry's activity as **sent to a model route**, under the agent's name.

AgentMux counts what each agent uses, in dollars, and stops an agent that reaches its [daily cap](#spend-caps).

## The models

| Model | Context | Reads images |
|---|---|---|
| **DeepSeek V4.1 Flash** (the route's default) | 1M | yes |
| **DeepSeek V4 Pro** | 1M | no |
| **GLM 5.3** | 1M | no |
| **Qwen3.8 Max** | 1M | yes |
| **Kimi K3** | 1M | yes |
| **Kimi K3.1 Pro** | 1M | yes |

Every model on the route calls tools and thinks. A model that can't read images is refused for a conversation that already holds some. The prices AgentMux counts spend with are shown beside each model in the agent's **Model** popup, in dollars per million tokens in and out (`crates/srv/src/backend/model_gateway/catalog.rs`).

An agent on a 1M-token model compacts its conversation at 300K tokens rather than near the end of the window, so it doesn't re-read a million tokens on every turn. If you set a smaller `CLAUDE_CODE_AUTO_COMPACT_WINDOW` in the agent's environment in My Agents, that one is kept.

## Add the route's key

A route needs an **API key** entry in the Vault whose **Label** starts with **OpenRouter API key** (capitals don't matter, and a longer label such as `OpenRouter API key (work)` works). Add it in the Vault's **API keys** section; see [The Vault](/vault/#add-an-entry). Without it, the route's models in the **Model** popup are greyed with **key missing: add "OpenRouter API key" in the Vault**, and an agent that asks for the route is told to ask you for the entry.

## Put an agent on a route

- **In the agent's pane:** open the **Model** popup in the composer strip and pick a model under the route's name (see [Pane Types](/pane-types/#composer-strip)). The agent keeps its conversation and restarts after its turn. Your pick is your approval: that agent now spends your OpenRouter key. A **Back to *model*** row returns it to where it was.
- **By an agent:** a leader that spawns or creates an agent can name the route and model (`Agents` tool, `route` and `model`; see [the Agents tool](/internals/muxapi/#agents)). A worker spawned without one inherits its leader's route. AgentMux asks you first, and the prompt says where the agent's traffic goes and that it is billed to your key, not to a plan, for every turn until it is stopped.
- **Back to your plan:** pick a model under **Your plan** in the popup.

An agent may change its own model on its route up to six times an hour, since each change costs the prompt cache; your own changes in the popup aren't counted. Moving an agent to a different route is always yours to approve in the popup.

A change is kept only once the agent's first turn on the new place works. If the provider refuses the turn (for example a thinking block or an image the model can't take), the agent goes back to where it was and the pane says so.

The pane's header and footer show the model that really answers, and hovering the header's model badge reads `DeepSeek V4.1 Flash via OpenRouter`.

## Spend caps

A route agent has two caps, counted per UTC day. The day turns at UTC midnight, and a day's figures survive a restart of AgentMux.

| Cap | Default | Covers |
|---|---|---|
| **Per agent** | $20 a day | what that agent uses through its route |
| **Per route** | $100 a day | what every agent on the route uses together |

The figure is the provider's own charge for each response when it carries one, otherwise the model's price from the table above. An agent on your plan has no spend and no cap. An agent on the DeepSeek Harness uses its own key and reports no cost, so nothing is counted for it.

### What you see as an agent spends

| Used | What happens |
|---|---|
| **50%** of the agent's cap | its leader gets one note |
| **80%** | a line above the composer: **$16 of $20 used today: the agent stops at its cap.** The chip below turns to a warning tone. |
| **100%** | AgentMux refuses the agent's next request, ends the turn in flight, shows the card below, and tells the leader |

Each of these happens once per agent per UTC day. An agent whose cap is **none** has no 50% note, and the route's cap still applies.

**The chip.** An agent on a route shows what it used today on its card in the [Swarm](/pane-types/#swarm): **$4.20 of $20 today** (**$4.20 today** with no cap). It warns from 80% and turns to an error at the cap; hover for the explanation. An agent with no figure for today shows no chip. `Agents list` carries the same figures for a tool call.

**The card.** At its own cap the agent's pane shows **Stopped: this agent used $20 of its $20 today.** with *Its requests are refused until you raise the cap, or the UTC day ends.* and three buttons:

- **Raise to $40** doubles the cap (at least $5 more) and takes the stop off. The agent carries on when you next message it.
- **Reset today** sets today's figure to zero.
- **Dismiss** takes the card off the pane. The stop stays.

When the route's cap is the one used, the card reads **Stopped: the cap for OpenRouter (DeepSeek V4.1 Flash) is used today ($100 of $100).** and *Every agent on the route is stopped until the route's cap is raised in Settings or the UTC day ends.* It has only **Dismiss**. The stop also ends at the next UTC midnight, without anyone raising anything.

### Set a cap

- **An agent's cap:** use **Raise to** on the card, or ask its leader. A leader sets it with `Agents` `update` and `spend_cap_usd` (a number of dollars, at least $0.01; `0` or `none` for no cap) and zeroes today's figure with `reset_spend_today`. An agent may lower its own cap, never raise or lift it, and can't reset its figure.
- **The route's cap:** there is no field for it in the Settings pane. Open **Open raw settings.json** at the bottom of Settings and add `"model:spend_cap_usd:openrouter": 250` (dollars; `"none"` or `0` for no cap). AgentMux reads it at each request, so a raise lets the next one through.

## When the key itself runs out

AgentMux counts what agents use; it doesn't know your balance with the provider. When OpenRouter refuses a request because the key's credit or its own limit is used, the refusal reaches the agent as an error and its turn ends. Add credit at the provider, then send the agent a message. An agent whose key or entry is gone is told that the route has no usable key.

## See also

- [The Vault](/vault/): where the route's key lives, and its activity
- [Pane Types](/pane-types/#composer-strip): the **Model** popup in the agent pane
- [The `Agents` tool](/internals/muxapi/#agents): `routes`, `spawn`, `create`, `update` with `route`, `model` and `spend_cap_usd`
- `crates/srv/src/backend/model_gateway/cap.rs`: the caps, and `frontend/app/view/agent/spend-stopped.ts`: the card and the chip
