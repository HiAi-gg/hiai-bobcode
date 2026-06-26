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

- **56 skills** — code review, TDD, security audit, Figma-to-code, git workflows, systematic debugging, and more.
- **154 design systems** — every brand from Apple to Stripe to SpaceX, ready for Stitch-powered UI generation.
- **Browser automation** — `agent-browser` opens a real Chrome, takes screenshots, fills forms, verifies UI. No Playwright needed.
- **Web research** — `firecrawl-cli` scrapes, crawls, and searches the web.
- **Library docs lookup** — `context7` finds real API examples from official docs.
- **Native memory** — SQLite FTS5 over markdown. Session checkpoints, project memory, task progress — all indexed and searchable.

---

## Quick Start

### Prerequisites

- **Bun** 1.3.14+ (`curl -fsSL https://bun.sh/install | bash`)
- **Git**

### Install

```bash
git clone https://github.com/HiAi-gg/hiai-bobcode.git
cd hiai-bobcode
bun install
```

### Run

```bash
# Backend (API server on :50900)
bun dev

# In another terminal — Web UI (on :50901)
bun dev:web
```

Open http://localhost:50901. That's it.

### Verify

```bash
curl -fsS http://localhost:50900/health
```

### Optional: API Keys

Copy `bob.env.example` to `bob.env` and add:

- `FIRECRAWL_API_KEY` — from [firecrawl.dev](https://firecrawl.dev) (web research)
- `CONTEXT7_API_KEY` — from [context7.com](https://context7.com) (docs lookup, works without for low usage)

Missing tools are non-fatal — Bob adapts and skips what's not available.

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
| **Designer**   | UI/Visual    | Generates screens via Stitch. Has taste.              |
| **Researcher** | Discovery    | Greps code, searches docs, finds answers.             |
| **Writer**     | Copy         | Landing pages, CTAs, microcopy. Words person.         |
| **Vision**     | Browser      | Opens a real browser, takes screenshots, verifies UI. |

Bob delegates to the right agent for the job. Simple tasks go to Sub. Complex ones go to Coder. UI work goes to Designer. Everything gets reviewed by Critic before it's done.

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

| Category    | What                              | Who uses it                                                   |
| ----------- | --------------------------------- | ------------------------------------------------------------- |
| **MCP**     | `grep_app`                        | Researcher — GitHub/OSS code search                           |
| **MCP**     | `sequential-thinking`             | Strategist, Critic — deep reasoning                           |
| **CLI**     | `firecrawl-cli`                   | Researcher — web scraping, crawling, search                   |
| **CLI**     | `context7`                        | Researcher, Coder — library/API docs lookup                   |
| **Browser** | `agent-browser`                   | Vision, Critic — UI verification, screenshots, form filling   |
| **Design**  | Stitch MCP + 154 design systems   | Designer — high-fidelity screen generation                    |
| **LSP**     | TypeScript, Svelte, Bash, Pyright | Coder — diagnostics after every edit                          |
| **Memory**  | SQLite FTS5 (native)              | All agents — cross-session memory, checkpoints, task progress |

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
