# hiai-bobcode

<p align="center">
  <img src="assets/readme/hiai-bob-banner.png" alt="hiai-bob" width="700">
</p>

<p align="center"><strong>An opinionated, terminal-native AI coding agent with cross-session memory and visual design skills.</strong></p>

<p align="center">
  <a href="https://github.com/HiAi-gg/hiai-bobcode/releases/latest"><img src="https://img.shields.io/github/v/release/HiAi-gg/hiai-bobcode?style=flat-square&logo=github" alt="Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square" alt="License"></a>
  <a href="https://github.com/HiAi-gg/hiai-bobcode/stargazers"><img src="https://img.shields.io/github/stars/HiAi-gg/hiai-bobcode?style=flat-square" alt="GitHub stars"></a>
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/runtime-Bun-f9f1e1?style=flat-square&logo=bun" alt="Bun"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%E2%89%A520-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node"></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://www.solidjs.com"><img src="https://img.shields.io/badge/SolidJS-1.9-2C4F7C?style=flat-square&logo=solid&logoColor=white" alt="SolidJS"></a>
  <a href="https://hono.dev"><img src="https://img.shields.io/badge/Hono-4.10-E36002?style=flat-square&logo=hono&logoColor=white" alt="Hono"></a>
  <a href="https://effect.website"><img src="https://img.shields.io/badge/Effect--TS-4.0-000000?style=flat-square" alt="Effect-TS"></a>
</p>

---

## What It Is

`hiai-bobcode` is a fork of [XiaomiMiMo/MiMo-Code](https://github.com/XiaomiMiMo/MiMo-Code) with bundled first-party **BobPlugin** — a thin value layer on top of MiMo's native runtime. MiMo handles reasoning, compaction, fallback, and context management natively; hiai-bob adds **agent specialization**, **completion gating**, and **parallelism orchestration**.

Tech stack: **Bun** runtime, **TypeScript** 5.8, **SolidJS** frontend, **Hono** API server, **Effect-TS** core logic, **SQLite** (via Drizzle) for memory, **PostgreSQL** for application data. Lint: **oxlint** + **Prettier** (not Biome).

---

## Agent Self-Install

When Bob (the orchestrator agent) starts on a fresh machine, it reads this section to self-configure:

1. **Check runtime**: verify `bun --version` >= 1.3.14. If missing: `curl -fsSL https://bun.sh/install | bash`
2. **Check optional tools**:
   - `which firecrawl` || `npm install -g firecrawl-cli`  (web research)
   - `which chromium-browser` || `apt install -y chromium-browser`  (visual testing)
   - `which psql` || `apt install -y postgresql-client`  (database queries)
3. **Setup env**: copy `bob.env.example` to `bob.env` if API keys are available
4. **Start infra** (optional): `cd infra && make db` for PostgreSQL + Redis
5. **Verify**: `./dev.sh` should start backend on :50900 and frontend on :50901

Missing tools are non-fatal — the agent adapts and skips unavailable capabilities.

## Quick Start

### Prerequisites

- **Bun** 1.3.14+ (`curl -fsSL https://bun.sh/install | bash`)
- **Git**
- **Docker** (optional, for PostgreSQL/Redis infra)

### Optional Agent Tools

- `firecrawl-cli` — web research (`npm install -g firecrawl-cli`)
- `chromium-browser` — visual testing (`apt install chromium-browser`)
- `psql` — database access (`apt install postgresql-client`)

### Install

```bash
git clone https://github.com/HiAi-gg/hiai-bobcode.git && cd hiai-bobcode && bun install
```

### API Keys

Copy `bob.env.example` to `bob.env` and add:

- `FIRECRAWL_API_KEY` — from [firecrawl.dev](https://firecrawl.dev)
- `CONTEXT7_API_KEY` — from [context7.com](https://context7.com) (optional, works without for low usage)

### Run

```bash
# Backend (API server)
cd packages/opencode && bun run --conditions=browser ./src/index.ts serve --port 50900

# Frontend (Web UI)
cd packages/app && bun dev -- --port 50901
```

```bash
# Launch backend + frontend for browser use:
./dev.sh
```

Docker: `docker-compose up --build` (backend at `:50900`, frontend at `:50902`).

---

## Production

Build the standalone binary and static frontend, then run:

```bash
# 1. Build backend binary
cd packages/opencode && bun run build
# Output: hiai-bob binary in packages/opencode/

# 2. Build frontend static files
cd packages/app && bun run build
# Output: packages/app/dist/

# 3. Run the binary (serves API on :50900, frontend on :50902)
cd packages/opencode
./hiai-bob serve --port 50900
```

The backend binary serves the API. For the frontend:
```bash
cd packages/app && bun run serve --port 50902
```

Or use Docker:
```bash
docker build -t hiai-bob .
docker run -p 50900:50900 -p 50902:50902 hiai-bob
```

---

## Project Structure

```
packages/opencode/   — Server + BobPlugin (agents, hooks, tools, MCP, config)
packages/app/        — SolidJS web UI (SessionGrid, TUI, design systems)
packages/sdk/        — TypeScript SDK (client for session/project APIs)
packages/ui/         — Shared UI components
docs/                — build-release.md (CI/CD instructions)
```

---

## 10-Agent Architecture

BobPlugin registers a 10-agent specialist team, replacing MiMo's stock `build/plan/compose/general/explore/translator` agents.

| Agent          | Role                                                  | Mode       | Model                                     |
| -------------- | ----------------------------------------------------- | ---------- | ----------------------------------------- |
| **Bob**        | Orchestrator — delegates, verifies, never works alone | `primary`  | `openrouter/xiaomi/mimo-v2.5-pro`         |
| **Coder**      | Builder — implements from plans                       | `subagent` | `minimax-coding-plan/MiniMax-M3`          |
| **Strategist** | Deep research, architecture planning                  | `all`      | `deepseek/deepseek-v4-pro`                |
| **Manager**    | Delegation coordination, parallel waves               | `subagent` | `opencode-go/deepseek-v4-flash`           |
| **Critic**     | Plan review, CLOSURE verification                     | `subagent` | `openrouter/xiaomi/mimo-v2.5-pro`         |
| **Researcher** | Code discovery (grep/glob patterns)                   | `subagent` | `opencode-go/deepseek-v4-flash`           |
| **Writer**     | Content, copy, documentation                          | `subagent` | `openrouter/mistralai/mistral-small-2603` |
| **Designer**   | UI/visual via design systems                          | `subagent` | `google/gemini-3.5-flash`                 |
| **Vision**     | Browser verification, image/PDF analysis              | `subagent` | `opencode-go/mimo-v2.5`                   |
| **Sub**        | Cheap executor, fallback for failures                 | `subagent` | `opencode-go/deepseek-v4-flash`           |

**Modes:** `primary` (user-selectable, not spawnable), `subagent` (spawnable only), `all` (both). Only Bob is `primary`; only Strategist is `all`.

**System-spawned agents:** `checkpoint-writer` (extracts session state), `dream` (7-day memory consolidation), `distill` (30-day session distillation). Not invoked via `actor()`.

---

## Delegation

Two distinct tools power the delegation system:

| Tool      | Purpose                                                           | Scope            |
| --------- | ----------------------------------------------------------------- | ---------------- |
| `actor()` | Spawn/manage subagents (run, spawn, wait, cancel, send)           | Execution        |
| `task()`  | Persistent work-item tree (T1, T2, T1.1, …) with status lifecycle | Planning & state |

**Flow:** Bob assesses → Strategist produces phased plan (3+ steps gate) → Manager dispatches parallel waves of subagents → Critic reviews → loop until approved.

**5-level failover:** Coder → Sub → Coder (retry) → Manager → Bob → User.

**Parallel waves:** Manager dispatches up to 5 concurrent subagents per wave. Steps are serialized only on file overlap or data dependency. Every plan ends with a Critic review wave; UI changes force a Vision browser pass.

**Plan-first gate:** Bob requires a Strategist plan for any task with 3+ steps, 2+ files, or architecture decisions.

---

## Completion Controller

The autonomy engine is an `actor.postStop` hook (~260 LOC) that decides after every subagent finishes whether the orchestrator should continue, stop, or dispatch a Critic review.

**Decision loop:**

- All TODOs done + Critic `accepted` → stop, return to user
- Critic `rejected` or incomplete TODOs → re-dispatch with error context
- Cap hit (default 25) → stop with warning, partial results

**Fingerprint tracking:** SHA1 hash of changed files detects stale reviews. Any file matching `ui_globs` (`.tsx`, `.svelte`, `.css`, etc.) forces a Vision browser screenshot pass.

**Configuration** in `bob.json`:

```jsonc
{
  "completion": {
    "enabled": true,
    "max_auto_continues": 25,
    "require_critic": true,
    "ui_globs": ["**/*.svelte", "**/*.tsx", "**/*.jsx", "**/*.vue", "**/*.css", "**/*.scss", "**/*.html", "**/*.astro"],
    "reset_on_user_message": true,
  },
}
```

---

## Grid System

SolidJS multi-pane **SessionGrid** — 1/2/3/4/6/8 panels. Each cell is an independent session with its own prompt, file viewer, terminal, and comments.

| Mode | Layout       | Panels | Use Case               |
| ---- | ------------ | ------ | ---------------------- |
| 1    | Full page    | 1      | Default single session |
| 2    | Side-by-side | 2      | Compare outputs        |
| 3    | Three-column | 3      | Primary + 2 aux        |
| 4    | 2×2          | 4      | Quadrant monitoring    |
| 6    | 3×2          | 6      | Agent swarm watch      |
| 8    | 4×2          | 8      | Full oversight panel   |

- **Cell 0** renders full (header, tabs, grid toggle). **Cells 1–7** render compact (sidebar panels with live status).
- **Cross-project routing:** cells can host sessions from different projects/directories.
- **Persistence:** layout state survives page reloads via `Persist.global()`.

---

## Memory System

Host-native **SQLite FTS5** over markdown — no external vector database. Four scopes:

| Scope      | File                                                  | Content                                                    |
| ---------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| `projects` | `MEMORY.md`                                           | Durable project rules, architecture decisions              |
| `sessions` | `checkpoint.md`, `notes.md`, `tasks/<id>/progress.md` | 11-section structured state, scratchpad, task narratives   |
| `global`   | `MEMORY.md`                                           | Cross-project preferences (read-only for agents)           |
| `cc`       | `~/.claude/projects/*/memory/*.md`                    | Claude Code memory (optional, read-only, `cc_index: true`) |

**BM25 search** via the `memory` tool: use 1–3 rare keywords. FTS5 tokenizer: `unicode61 remove_diacritics 1`. Results below 15% of top score are dropped.

**Checkpoint writer:** system-spawned subagent that writes `checkpoint.md` (11 sections) and `progress.md`. Agents must not write these files directly.

---

## Design Systems

**150 brand design systems** in `packages/opencode/src/plugin/bob/design-systems/`, derived from [open-design](https://github.com/nexu-io/open-design) (Apache 2.0). 22 categories: E-Commerce, SaaS, AI, Developer Tools, Themed, and more.

Each system = 3 files:

- `DESIGN.md` — visual theme, color palette, typography, spacing, component patterns (~250 lines)
- `tokens.css` — CSS custom properties (colors, spacing, radii, shadows, fonts)
- `components.html` — HTML/CSS component examples (buttons, cards, nav, forms)

**Brands include:** Apple, Airbnb, Stripe, Vercel, Linear, Notion, Discord, Figma, Shopify, Nike, Perplexity, OpenAI, Supabase, HashiCorp, Mintlify + 135 more.

The Designer agent checks the bundled `design-systems/` directory directly (see `designer.ts:23`). Index: `design-systems/INDEX.md`.

---

## Tools

18 tools across three layers:

### Core (MiMo runtime)

`bash`, `read`, `glob`, `grep`, `edit`, `write`, `task`

### BobPlugin custom

| Category                   | Tools                                                                                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Delegation                 | `actor` (run, spawn, status, wait, cancel, send), `memory`                                                                                                        |
| Browser (14)               | `agent_browser_navigate`, `_snapshot`, `_click`, `_fill`, `_type`, `_screenshot`, `_eval`, `_wait`, `_close`, `_console`, `_select`, `_hover`, `_press`, `_batch` |
| LSP (6)                    | `lsp_diagnostics`, `lsp_goto_definition`, `lsp_find_references`, `lsp_symbols`, `lsp_prepare_rename`, `lsp_rename`                                                |
| Session (4)                | `session_list`, `session_read`, `session_search`, `session_info`                                                                                                  |
| Skills                     | `skill` (load SKILL.md workflows on demand)                                                                                                                       |
| Background (2, deprecated) | `background_output`, `background_cancel`                                                                                                                          |

### Tool restrictions

| Agent      | write/edit | bash | actor | grep/glob | agent_browser |
| ---------- | :--------: | :--: | :---: | :-------: | :-----------: |
| Bob        |     ✗      |  ✗   |   ✓   |    ✓²     |       ✗       |
| Coder      |     ✓      |  ✓   |   ✓   |     ✓     |       ✗       |
| Strategist |     ✗      |  ✗   |   ✓   |    ✗¹     |       ✗       |
| Critic     |     ✗      |  ✗   |   ✓   |     ✓     |       ✗       |
| Researcher |     ✗      |  ✗   |   ✓   |     ✓     |       ✗       |
| Vision     |     ✗      |  ✗   |   ✗   |     ✗     |       ✓       |
| Sub        |     ✓      |  ✓   |   ✗   |     ✓     |      ✗³       |

¹ Strategist delegates grep/glob to Researcher. ² Bob's read-only tools are for inspection only. ³ Sub drives browser only as Vision fallback.

---

## Hooks

BobPlugin keeps 6 value-adding hooks (~28 MiMo-duplicate hooks deleted):

| Hook                      | Hook Point                                                      | Purpose                                                          |
| ------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Completion Controller** | `actor.postStop`, `tool.execute.after`, `chat.message`, `event` | Autonomy loop: auto-continue + Critic gate + UI-change detection |
| **Closure Injector**      | `experimental.chat.messages.transform`                          | Injects `<CLOSURE>` XML schema, validates existing blocks        |
| **Quality Gate**          | `tool.execute.after`                                            | Detects lint/typecheck failures in bash output                   |
| **Non-Interactive Env**   | `tool.execute.before`                                           | Rewrites `vim`, `ssh`, `less` to safe no-ops                     |
| **Keyword Detector**      | `chat.message` (planned)                                        | Injects mode prompts (ultrawork, search, analyze)                |
| **Tool Output Truncator** | `tool.execute.after` (planned)                                  | Caps tool output at MAX_LEN                                      |

---

## MCP Servers (2)

| MCP                   | Type   | Endpoint                                                  | Purpose                                                                     |
| --------------------- | ------ | --------------------------------------------------------- | --------------------------------------------------------------------------- |
| `grep_app`            | Remote | `https://mcp.grep.app`                                    | Literal code-pattern search across 1M+ GitHub repos                         |
| `sequential-thinking` | Local  | `npx -y @modelcontextprotocol/server-sequential-thinking` | Deep structured reasoning with revision, branching, hypothesis verification |

**Retired:** `context7` → migrated to CLI + skill pattern (see below). `MemPalace` → removed.

Enabled/disabled in `bob.json`:

```jsonc
{ "mcp": { "grep_app": { "enabled": true }, "sequential-thinking": { "enabled": true } } }
```

---

## CLI Integrations (2)

On-demand CLI tools invoked via `bash` — not always-on MCP servers:

| CLI                 | Invocation                              | Env Var             | Purpose                          |
| ------------------- | --------------------------------------- | ------------------- | -------------------------------- |
| `firecrawl-cli`     | `firecrawl-cli scrape <url>`            | `FIRECRAWL_API_KEY` | Web scraping, content extraction |
| `context7` (`ctx7`) | `npx -y ctx7 docs /org/project "query"` | `CONTEXT7_API_KEY`  | Library/API documentation lookup |

**context7 migration:** was an always-on MCP server → now a skill (on-demand `SKILL.md`) invoked via `ctx7` CLI or HTTP API. Agent prompts reference `context7` as a skill, not an MCP tool.

Keys live in `bob.env` (gitignored). Provider credentials are separate — managed via `/connect` in the TUI, stored in `~/.local/share/mimocode/auth.json`.

---

## PostgreSQL

A single PostgreSQL instance accessed via **direct `psql` commands only** — never `.sql` migration files for content edits.

| Database | Port | User | Connection                                |
| -------- | ---- | ---- | ----------------------------------------- |
| ai-core  | 5432 | bob  | `psql -h localhost -p 5432 -U bob -d aidb` |
| webs     | 5432 | bob  | `psql -h localhost -p 5432 -U bob -d aidb` |

**Rules:** `SELECT` must include `LIMIT`. No `INSERT`/`UPDATE`/`DELETE`/`DROP`/`TRUNCATE`/`ALTER` without explicit user approval. Runtime uses SQLite via Drizzle; PostgreSQL is for application data.

---

## Configuration

Two layers: `bob.json` (per-project, JSON/JSONC) + `bob.env` (environment variables).

**Config file discovery** (first found wins):

1. `<projectDir>/bob.json`
2. `<projectDir>/.mimocode/bob.json`
3. `~/.config/hiai-bob/bob.json` (global)
4. Fork-root `bob.json` (canonical models)

**Minimal `bob.json`:**

```jsonc
{
  "models": {
    "bob": { "model": "openrouter/xiaomi/mimo-v2.5-pro" },
    "coder": { "model": "minimax-coding-plan/MiniMax-M3" },
    "strategist": { "model": "deepseek/deepseek-v4-pro" },
    "manager": { "model": "opencode-go/deepseek-v4-flash" },
    "critic": { "model": "openrouter/xiaomi/mimo-v2.5-pro" },
    "designer": { "model": "google/gemini-3.5-flash" },
    "researcher": { "model": "opencode-go/deepseek-v4-flash" },
    "writer": { "model": "openrouter/mistralai/mistral-small-2603" },
    "vision": { "model": "opencode-go/mimo-v2.5" },
    "sub": { "model": "opencode-go/deepseek-v4-flash" },
  },
}
```

**Key config sections:**

| Section                             | Purpose                                                               |
| ----------------------------------- | --------------------------------------------------------------------- |
| `models`                            | Per-agent model mapping (`provider/model` format)                     |
| `completion`                        | Auto-continue budget, Critic gate, UI globs                           |
| `mcp`                               | Enable/disable MCP servers                                            |
| `lsp`                               | Enable/disable language servers (TypeScript, Svelte, ESLint, Pyright) |
| `agent_restrictions`                | Tool-level restrictions per agent                                     |
| `agent_overrides`                   | Override agent model or append prompt                                 |
| `disabled_agents`                   | Kill switch for agents                                                |
| `hooks.disabled` / `tools.disabled` | Disable specific hooks/tools                                          |
| `dream` / `distill`                 | Memory consolidation intervals (7/30 days)                            |
| `telemetry`                         | OTLP trace export (disabled by default)                               |
| `background_manager`                | Concurrency limit (5), stale timeout (45 min), circuit breaker        |

All string values support `{env:VAR_NAME}` interpolation. API keys live in `bob.env`, never in `bob.json`.

---

## License

Code: [MIT License](./LICENSE). Use: subject to [Use Restrictions](./USE_RESTRICTIONS.md). Hosted services: [Bob Terms of Service](https://platform.hiai-opencode.com/docs/terms/user-agreement).
