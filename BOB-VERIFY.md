# Bob fork — run & verify

How to launch the fork from source and confirm every capability we designed actually works.

## 1. Launch

```bash
./run-bob.sh            # real data dir (all model providers + your memory/tasks)
./run-bob.sh --isolated # clean-room data dir ($PWD/.dev-home), no real auth/memory
```

On start the script prints which providers are authed. Expected (after the auth merge):
`opencode-go, minimax-coding-plan, kimi-for-coding, openrouter, deepseek, google, xiaomi-token-plan-sgp`.

If a provider is missing → `mimo auth login` (or `./run-bob.sh -- auth login`).

Skill secrets (firecrawl, context7) come from `bob.env` (gitignored). The launch banner shows
`FIRECRAWL_API_KEY=set CONTEXT7_API_KEY=set` when they loaded.

## 2. Smoke checks (no LLM spend)

```bash
# agents register under LOWERCASE keys; build/plan/compose hidden
curl -s localhost:PORT/config | jq '.agent | keys'   # while a `serve` is running
```
Expect the 10: `bob coder strategist manager critic designer researcher writer vision sub`
and NO `Bob/Coder/...` (capitalized). `build/plan/compose` carry `disable:true`.

## 3. Feature checklist (in the TUI)

| # | What we agreed | How to verify | Pass = |
|---|---|---|---|
| 1 | **Bob orchestrates, never edits** | Ask Bob to "fix X". Watch it `task()` a coder/sub, not write itself. | Bob has no write/edit/bash — delegates |
| 2 | **Lowercase delegation works** | Any multi-step request. | subagents spawn (no "invalid subagent_type"/"agent not found") |
| 3 | **Parallel waves** | Give a task with independent parts ("update header AND footer AND docs"). | Strategist annotates `parallel: yes / owner:`; Manager fires concurrent `task()` calls |
| 4 | **Hard Critic gate** | Make a code change, let Bob "finish". | Session does NOT end until a `critic` subagent returns APPROVED; a REJECTED verdict forces a fix loop |
| 5 | **Autonomy loop + cap** | Long task with a todo list. | `actor.postStop` keeps continuing until todos done or 25-continue cap |
| 6 | **UI → Vision pass** | Change a `.svelte`/`.tsx` file. | Critic wave includes a Vision/agent-browser check before done |
| 7 | **Native memory** | Tell Bob a project fact; new session; ask. | recalled via native `memory` tool (FTS), not MemPalace |
| 8 | **Native task tree** | Multi-step plan. | parent/child tasks via native task tool (`T1`, `T1.1`), `progress.md` updates |
| 9 | **context7 as skill** | Ask about a library API. | agent loads the `context7` skill → `npx @upstash/context7` / curl, NOT an MCP tool |
| 10 | **firecrawl CLI** | Ask for something from the web. | uses `firecrawl` CLI (authed via FIRECRAWL_API_KEY) |
| 11 | **grep_app + sequential-thinking MCP** | OSS code search / hard reasoning. | only these two MCP servers are live |
| 12 | **Postgres rules** | DB-related task. | Bob/agents follow POSTGRES_RULES from their prompt |

## 4. The two Bob config files (fork root)

You only ever touch two files:

| File | Holds | Tracked? |
|---|---|---|
| **`bob.json`** | per-agent **models** (`<provider>/<model>`) — the ONLY model source (no code defaults) | yes (not secret) |
| **`bob.env`** | skill **keys**: `FIRECRAWL_API_KEY`, `CONTEXT7_API_KEY` | no (gitignored, secret) |

**Model providers are NOT in any file.** Connect them inside the TUI with **`/connect`**
(pick provider + add API key → `~/.local/share/mimocode/auth.json`). `run-bob.sh` prints which
providers are connected on launch.

Current `bob.json` models: bob=kimi-for-coding/k2p7 · coder=minimax-coding-plan/MiniMax-M3 ·
strategist=deepseek/deepseek-v4-pro · manager=opencode-go/deepseek-v4-flash ·
critic=xiaomi-token-plan-sgp/mimo-v2.5-pro · designer=google/gemini-3.5-flash ·
researcher=opencode-go/deepseek-v4-flash · writer=openrouter/mistralai/mistral-small-2603 ·
vision=openrouter/google/gemma-3-12b-it · sub=opencode-go/mimo-v2.5

## Known non-issue
`mimo agent list` (the CLI subcommand) does NOT load plugins, so it shows only native agents.
The TUI/`serve` runtime loads BobPlugin fully (see `service=plugin.bob ... BobPlugin loaded agents=10`).
Use the TUI agent picker, not `agent list`, to see the Bob team.
