# hiai-bobcode

<p align="center"><strong>An AI coding agent that actually finishes what it starts. With memory, taste, and a 10-agent team.</strong></p>

<p align="center">
  <a href="https://github.com/HiAi-gg/hiai-bobcode/releases/latest"><img src="https://img.shields.io/github/v/release/HiAi-gg/hiai-bobcode?style=flat-square&logo=github" alt="Release"></a>
  <a href="LICENSE.md"><img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square" alt="License"></a>
  <a href="https://github.com/HiAi-gg/hiai-bobcode/stargazers"><img src="https://img.shields.io/github/stars/HiAi-gg/hiai-bobcode?style=flat-square" alt="GitHub stars"></a>
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/runtime-Bun-f9f1e1?style=flat-square&logo=bun" alt="Bun"></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://www.solidjs.com"><img src="https://img.shields.io/badge/SolidJS-1.9-2C4F7C?style=flat-square&logo=solid&logoColor=white" alt="SolidJS"></a>
</p>

---

## What's the deal?

`hiai-bobcode` is a fork of [MiMoCode](https://github.com/XiaomiMiMo/MiMo-Code), which is itself a fork of [OpenCode](https://github.com/opencode-ai/opencode). It's forks all the way down. Want to fork _this_ fork? Go ahead — that's literally the point.

We took MiMoCode (which already handles reasoning, compaction, fallback, and context management natively) and bundled a first-party plugin called **BobPlugin** on top. BobPlugin adds three things MiMoCode doesn't have:

- **Agent specialization** — a 10-agent team with clear roles. Bob is the boss.
- **Completion gating** — Bob won't stop until the work is actually done _and_ reviewed.
- **Parallelism orchestration** — independent work runs concurrently, not one-at-a-time.

Tech stack: **Bun** runtime, **TypeScript** 5.8, **SolidJS** frontend, **SQLite** (via Drizzle) for storage, **oxlint** + **Prettier** for linting.

---

## What's in the box

Beyond the 10-agent team, BobPlugin bundles:

- **56 skills** — code review, TDD, security audit, [Figma-to-code](https://github.com/figma/skills) (7 skills, loadable on demand), git workflows, systematic debugging, and more.
- **150 brand design systems** — every brand from Apple to Stripe to SpaceX, bundled as [open-design](https://github.com/vlgalib/open-design) tokens + components for Designer agents.
- **Browser automation** — `agent-browser` opens a real Chrome, takes screenshots, fills forms, verifies UI. No Playwright needed.
- **Web research** — `firecrawl-cli` scrapes, crawls, and searches the web.
- **Library docs lookup** — `context7` finds real API examples from official docs.
- **Native memory** — SQLite FTS5 over markdown. Session checkpoints, project memory, task progress — all indexed and searchable.
- **Session Grid** — run multiple AI sessions side-by-side in TUI or web UI. Independent cells, keyboard nav, plan-only mode.

---

## Quick Start

Copy this prompt to any AI agent (Bob, Claude, Cursor, Cody — whatever you use):

````text
Set up hiai-bobcode on this machine.

1. Check prerequisites: bun --version (>=1.3.14), git --version
   Install bun if missing: curl -fsSL https://bun.sh/install | bash

2. Clone and install:
   git clone https://github.com/HiAi-gg/hiai-bobcode.git
   cd hiai-bobcode
   bun install

3. Set up environment:
   cp bob.env.example bob.env
   # Add FIRECRAWL_API_KEY and CONTEXT7_API_KEY if you have them
   # (optional — Bob adapts without them)

4. Run backend (terminal 1):
   bun dev
   # API server starts on http://localhost:50900

5. Run Web UI (terminal 2):
   bun dev:web
   # UI starts on http://localhost:50901

6. Verify:
   curl -fsS http://localhost:50900/health
   # Should return: ok

7. Open http://localhost:50901 — you're in.

If anything fails, tell me the exact error and I'll read CONTRIBUTING.md for troubleshooting.
````

### Manual

| Step | Command |
|------|---------|
| Prerequisites | `bun --version` (≥1.3.14), `git --version` |
| Clone | `git clone https://github.com/HiAi-gg/hiai-bobcode.git && cd hiai-bobcode` |
| Install | `bun install` |
| Env | `cp bob.env.example bob.env` |
| Run backend | `bun dev` → :50900 |
| Run Web UI | `bun dev:web` → :50901 |
| Verify | `curl -fsS http://localhost:50900/health` |

### Next Steps

- [The Team](#the-team) — what each of the 10 agents does
- [Integrations](#integrations) — MCP, CLI, browser, design, LSP, memory
- [CONTRIBUTING.md](CONTRIBUTING.md) — dev setup, debugging, building for production
- [ARCHITECTURE.md](ARCHITECTURE.md) — system architecture and modification map

---

## The Team

BobPlugin registers 10 agents. Here's who does what:

| Agent          | Role         | The vibe                                              |
| -------------- | ------------ | ----------------------------------------------------- |
| **Bob**        | Orchestrator | The boss. Delegates, never implements.                |
| **Coder**      | Builder      | Writes the code. Deep, multi-file, gets it done.      |
| **Sub**        | Quick worker | Cheap, fast, 1-2 file fixes. The intern.              |
| **Strategist** | Planner      | Reads, thinks, writes a plan. Never touches code.     |
| **Manager**    | Coordinator  | Dispatches parallel waves. Keeps the trains running.  |
| **Critic**     | Reviewer     | Says "approved" or "try again." Mandatory gate.       |
| **Designer**   | UI/Visual    | Applies design tokens, builds taste-driven screens. Has taste. |
| **Researcher** | Discovery    | Greps code, searches docs, finds answers.             |
| **Writer**     | Copy         | Landing pages, CTAs, microcopy. Words person.         |
| **Vision**     | Browser      | Opens a real browser, takes screenshots, verifies UI. |

Bob delegates to the right agent for the job. Simple tasks go to Sub. Complex ones go to Coder. UI work goes to Designer. Everything gets reviewed by Critic before it's done.

---

## Session Grid

Why watch one AI session when you can watch four? The Session Grid lets you run multiple AI sessions simultaneously — side by side, stacked, or in a 2×2 layout — in both the **terminal** and the **web UI**.

| Surface | Modes | How |
|---------|-------|-----|
| **TUI** | single, split-h, split-v, 2×2 | `--grid` flag, `MIMOCODE_GRID` env, or "Grid Mode" on home screen |
| **Web** | 1, 2, 3, 4, 6, 8 cells | Dropdown toggle in session header |

Each cell is an independent session — its own chat, its own prompt, its own file tabs. Switch between them with keyboard shortcuts (`<leader>1..9`), drag the splitter to resize, or toggle any cell into **plan-only mode** (tasks, diffs, agent status — no chat).

Under the hood: viewport virtualization (only visible cells render), per-cell error boundaries (one cell crashes, the rest keep going), and layout persistence across restarts.

This is a **MiMoCode native feature** — we inherit it from upstream. BobPlugin doesn't touch it; it just works.

---

## Delegation

Bob uses the `actor()` tool (backed by MiMoCode's native task tree) to spawn subagents:

```
actor(subagent_type="coder", description="Build auth", prompt="...")
```

- `run_in_background=false` — Bob waits for the result (sync)
- `run_in_background=true` — Bob keeps working, result arrives later (async)

The native runtime handles the task tree, checkpoints, and progress tracking. BobPlugin just decides _who_ does _what_.

---

## Completion Controller

Bob won't stop until the work is done. The `actor.postStop` hook (the only substantial code in BobPlugin — ~260 lines) checks:

1. Are there incomplete todos? → Keep going.
2. Is the diff unreviewed? → Dispatch Critic.
3. Did Critic approve the current diff? → Done. Otherwise → Fix and re-review.
4. Did files change that affect the UI? → Force a Vision browser pass.

Capped at 25 auto-continues for safety. A user message resets the counter. Bob will never spin forever.

---

## Integrations

| What | How | Link |
|------|-----|------|
| **agent-browser** | 14 native CLI tools — navigate, snapshot, click, fill, screenshot, console | [github.com/vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) |
| **firecrawl-cli** | CLI skill — web scraping, crawling, search | [firecrawl.dev](https://firecrawl.dev) |
| **context7** | CLI skill — library/API docs lookup | [context7.com](https://context7.com) |
| **grep_app** | MCP server — GitHub/OSS code search | [mcp.grep.app](https://mcp.grep.app) |
| **sequential-thinking** | MCP server — deep reasoning for Strategist & Critic | [npm: @modelcontextprotocol/server-sequential-thinking](https://www.npmjs.com/package/@modelcontextprotocol/server-sequential-thinking) |
| **open-design** | 150 brand design systems (tokens + components) | [github.com/vlgalib/open-design](https://github.com/vlgalib/open-design) |
| **LSP** | 6 tools, 34 language servers (TS, Svelte, Python, Rust, Go, etc.) | built-in |
| **SQLite FTS5** | Native memory — cross-session checkpoints, task progress, BM25 search | built-in (MiMoCode runtime) |

BobPlugin keeps exactly **6 hooks** (~28 MiMo-duplicate hooks were deleted). The slim set: `completion-controller`, `closure-injector`, `quality-gate`, `keyword-detector`, `non-interactive-env`, `tool-output-truncator`.

---

## Configuration

All config lives in `bob.json` at the repo root. Three-layer merge: fork defaults → `bob.json` → env overrides. Model IDs are full `provider/model-id` strings — run `opencode models` to see what's available, then copy the exact ID.

---

## Documentation

| Document                                   | What's in it                                                      |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `README.md`                                | You are here. Overview + quick start.                             |
| [`ARCHITECTURE.md`](ARCHITECTURE.md)       | System architecture, repo layout, modification map.               |
| [`CHANGELOG.md`](CHANGELOG.md)             | Version history.                                                  |
| [`CONTRIBUTING.md`](CONTRIBUTING.md)       | Dev setup, debugging, building for production, how to contribute. |
| [`SECURITY.md`](SECURITY.md)               | Security policy.                                                  |
| [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) | Community standards.                                              |
| [`LICENSE.md`](LICENSE.md)                 | MIT license.                                                      |

---

## License

MIT — see [LICENSE.md](LICENSE.md). Fork it, build on it, ship it. That's the point.
