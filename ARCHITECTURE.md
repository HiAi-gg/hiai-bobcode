# hiai-bobcode Architecture

This document explains how the Bob monorepo is assembled, where each layer lives, and which files to change when you want to modify a given concern.

`hiai-bobcode` is an autonomous AI coding agent monorepo, forked from [`XiaomiMiMo/MiMo-Code`](https://github.com/XiaomiMiMo/MiMo-Code) (which itself tracks `opencode-ai/MiMo-Code`). The fork adds a first-party bundled plugin, **`BobPlugin`**, that ships the 10-agent orchestration model, the closure protocol, the skill loader, the hook system, the LSP and tool bridges, and the on-demand `grep_app` / `sequential-thinking` MCP wiring.

> **Companion docs**
>
> - [`README.md`](README.md) — overview, install, usage.
> - [`AGENTS.md`](AGENTS.md) — operational rules for agents and tooling.
> - [`.bob/docs/mimo-fork-integration.md`](.bob/docs/mimo-fork-integration.md) — fork-to-upstream integration map (archived, maintainer-only).
> - [`bob.json`](bob.json) — model slot switchboard.
> - [`bob.env.example`](bob.env.example) — secrets template (the real `bob.env` is gitignored).

## High-Level Structure

The repository is a Bun workspace with eleven top-level packages under `packages/` and a first-party plugin (`BobPlugin`) bundled into the engine. There are five architectural layers:

1. **Engine** — `packages/opencode` runs the forked CLI, HTTP/WS server, session/agent/task system, file and storage subsystems, and Effect-TS service runtime. The fork boundary ends here.
2. **Plugin** — `packages/opencode/src/plugin/bob/` is the **first-party bundled plugin** loaded by the engine at startup. It defines agents, prompts, hooks, MCP wiring, skills, tools, completion controller, and design systems.
3. **Frontend** — `packages/app` (SolidJS + Vite, primary UI), `packages/ui` (shared SolidJS component library), `packages/storybook` (component development).
4. **Surfaces and integrations** — `packages/desktop` (Electron), `packages/slack`, `packages/extensions` (Zed), `packages/script` (internal CLI helpers).
5. **Data and SDK** — `packages/shared` (Drizzle schemas, cross-package types), `packages/sdk` (TypeScript JS SDK and `openapi.json`).

## Request Flow

```
                  User input (TUI / web / desktop / IDE / Slack)
                                  │
                                  ▼
                       ┌──────────────────────┐
                       │      Bob (TUI)       │ ← orchestrator / router
                       │  SolidJS front-end   │
                       └──────────┬───────────┘
                                  │ Hono WS / HTTP
                                  ▼
                       ┌──────────────────────┐
                       │ Engine: opencode bin │ ← forked from MiMo-Code
                       │  Session + Agent     │
                       └──────────┬───────────┘
                                  │ load
                                  ▼
                       ┌──────────────────────┐
                       │     BobPlugin        │ ← first-party bundled plugin
                       │ (src/plugin/bob)     │
                       └──────────┬───────────┘
                                  │
   ┌──────────────────────────────┼───────────────────────────────┐
   │   routes by complexity       │                               │
   ▼                              ▼                               ▼
 Simple/short              Complex/wave                  Planning/architecture
   │                          │                               │
   ▼                          ▼                               ▼
 coder (deep/bounded)    manager ── wave ──► coder / sub   strategist ── plan
   └─► sub (cheap)                                                 │
                                                                   ▼
                                                              routed back

 Specialist tiers (always delegated, not routed):
   researcher  ◄── grep_app MCP, context7 skill, firecrawl CLI
   writer      ◄── copy / positioning / SEO
   designer    ◄── bundled design-systems/, figma/stitch skills
   critic      ◄── review gate (APPROVED/REJECTED)
   vision      ◄── image / PDF / diagram extraction

   Bob ── collects results, verifies (lsp_diagnostics, build, tests),
   Bob ── emits <CLOSURE>{readiness: done|accept|reject}</CLOSURE>
                                  │
                                  ▼
                          User response (TUI/web)
```

**Key wiring rules**

- `BobPlugin` is **bundled inside the engine** — it is not a separately installed OpenCode plugin. The fork ships it as part of `packages/opencode` so a single binary is self-contained.
- The fork still respects the upstream `Plugin` interface (`@mimo-ai/plugin`); `BobPlugin` is registered through the normal plugin loader.
- Model credentials flow through OpenCode Connect (writes `~/.local/share/mimocode/auth.json`); **never** embed keys in `bob.json` or `bob.env`.
- Service keys for skills/MCP (Firecrawl, Context7, etc.) live in `bob.env` with `{env:VAR}` placeholders.
- `bob.json` is the **only** place per-agent model IDs are defined. The runtime loader derives hidden agents and categories from those ten slots.

## Repository Layout

### Engine — `packages/opencode/`

The forked CLI engine. All paths below are relative to `packages/opencode/`.

- `src/index.ts` — Bun entry; dev mode runs `bun run --conditions=browser ./src/index.ts`.
- `src/agent/` — Upstream agent definitions and prompt files (`agent.ts`, `config.ts`, `generate.txt`, `prompt/`).
- `src/session/`, `src/task/`, `src/team/`, `src/workflow/` — conversation, delegation, and execution subsystems.
- `src/server/` — Hono HTTP + WebSocket server (Bun and Node adapters via `#hono` import condition).
- `src/cli/` — argv parsing, command surface, REPL.
- `src/plugin/` — Upstream plugin loader plus **`bob/`**, the first-party bundled plugin (see below).
- `src/skill/` — Skill composition (`compose/extract.ts`, `compose/bundle.macro.ts`) and discovery (`discovery.ts`).
- `src/mcp/` — MCP server lifecycle (auth, OAuth, OAuth callback, OAuth provider).
- `src/memory/` — Native FTS5-indexed persistent memory (`fts-query.ts`, `fts.sql.ts`, `reconcile.ts`, `service.ts`).
- `src/lsp/`, `src/tool/`, `src/permission/`, `src/bus/` — LSP integration, tool registry, permission gating, internal event bus.
- `src/effect/`, `src/util/` — Effect-TS service runtime and shared utilities.
- `src/storage/`, `src/sync/`, `src/history/`, `src/snapshot/`, `src/project/` — persistence, sync, history, snapshots, project bootstrap.
- `src/provider/` — AI SDK provider adapters (Anthropic, OpenAI, Google, OpenRouter, etc.).
- `src/auth/`, `src/account/`, `src/installation/` — auth flows and provider connections.
- `src/git/`, `src/worktree/`, `src/pty/`, `src/shell/` — repo, worktree, PTY, shell plumbing.
- `migration/` — Drizzle Kit output (`drizzle.config.ts` declares schema glob `./src/**/*.sql.ts`).
- `test/` — Bun test suites (do **not** run from repo root).
- `Dockerfile`, `bunfig.toml`, `tsconfig.json` — build, run, and typecheck config.
- `bin/bob` — compiled binary (also exposed as the root `bob` symlink).

### First-party plugin — `packages/opencode/src/plugin/bob/`

The bundled plugin that defines Bob's behavior. It is **not** a standalone package; it is a directory inside the engine and loaded via the upstream plugin loader.

- `index.ts` — Plugin entry. Registers agents, tools, hooks, MCP wiring, and the closure injector.
- `agents/` — One factory per agent: `bob.ts`, `coder.ts`, `critic.ts`, `designer.ts`, `manager.ts`, `researcher.ts`, `strategist.ts`, `sub.ts`, `vision.ts`, `writer.ts`. Re-exported through `agents/index.ts`.
- `agents/prompt-library/` — Shared prompt sections (`browser.ts`, `native-memory.ts`, `postgres-rules.ts`, etc.).
- `completion-controller/` — Auto-continue loop after subagent tasks.
- `config/` — `index.ts` config loader (defaults, schema).
- `design-systems/` — Bundled design system assets for `designer` (mirrors hiai-opencode's open-design drop).
- `features/background-manager/` — Background task runtime.
- `features/telemetry/` — Optional telemetry sink.
- `hooks/` — 30+ hooks registered with the engine (see [Hook Inventory](#hook-inventory) below).
- `mcp/registry.ts` — Default MCP wiring (only `sequential-thinking` and `grep_app` ship enabled; see [MCP](#mcp) below).
- `shared/` — Shared utilities (env resolver, migration helpers, closure protocol).
- `skills/` — ~50 skill definitions mounted into the engine's skill tree (see [Skills](#skills)).
- `tools/` — `agent-browser/`, `background-task/`, `lsp.ts`, `session-manager/`, `skill.ts`.
- `tools/agent-browser/` — Native Chrome CDP bridge (snapshot → `@eN` refs → click/fill).
- `tools/background-task/` — `background_output` and `background_cancel` tools plus the `BackgroundManager`.

### Frontend — `packages/app/`, `packages/ui/`, `packages/storybook/`

- `packages/app/` — **SolidJS 1.9 + Vite primary web frontend**. Has `src/`, `e2e/` (Playwright), `playwright.config.ts`, `vite.config.ts`, `happydom.ts` for unit tests. Talks to the engine over Hono WS/HTTP.
- `packages/ui/` — Shared SolidJS UI component library. Has its own `vite.config.ts` and `script/` for build helpers.
- `packages/storybook/` — Storybook for component-level development.

### Surfaces and integrations

- `packages/desktop/` — Electron desktop app. `electron.vite.config.ts`, `electron-builder.config.ts`, `icons/`, `resources/`, `scripts/`.
- `packages/slack/` — Slack integration. Standalone Node service.
- `packages/extensions/zed/` — Zed editor extension.
- `packages/script/` — Internal build/utility scripts (`@mimo-ai/script` workspace package).

### Data and SDK

- `packages/shared/` — Cross-package Drizzle schemas and shared types. Defines the persistence boundary used by the engine.
- `packages/sdk/js/` — Generated TypeScript SDK. **Regenerate with `./packages/sdk/js/script/build.ts`** — never hand-edit.
- `packages/sdk/openapi.json` — Source OpenAPI schema for SDK regeneration.

### Workspace root

- `bob` — symlink to `packages/opencode/bin/bob` (the compiled CLI).
- `bob.json` — model slots and completion-controller / dream / distill config (see [Models](#models)).
- `bob.env` (gitignored), `bob.env.example` — runtime secrets (Firecrawl key, Context7 key, etc.).
- `AGENTS.md`, `README.md`, `ARCHITECTURE.md` (this file), `LICENSE.md` — root docs.
- `.bob/docs/mimo-fork-integration.md` — fork integration map (archived, maintainer-only).
- `dev.sh` — convenience launcher for dev mode (engine + frontend).
- `.oxlintrc.json`, `prettier` config — linter (oxlint, **not** Biome) and formatter.

## Agent Model

The user-facing agent roster has **ten slots**, defined as keys under `bob.json > models`. `Sub` is technically a category executor but lives at the same layer for routing clarity.

### Visible primary agents

| Agent            | Role                                                               | When to use                                                 |
| ---------------- | ------------------------------------------------------------------ | ----------------------------------------------------------- |
| **`Bob`**        | Orchestrator. Routes work, verifies results, emits `<CLOSURE>`.    | Default user-facing agent. Must delegate, never implement.  |
| **`Coder`**      | Implementation. Has deep and bounded contours.                     | Any code change, bug fix, refactor.                         |
| **`Strategist`** | Deep research and planning. Read-only — never writes code.         | Multi-file plans, architecture decisions, ambiguous scopes. |
| **`Manager`**    | Delegation and memory stewardship.                                 | Wave dispatch, durable memory writes, TODO hygiene.         |
| **`Critic`**     | Review gate. Emits `APPROVED` / `REJECTED`.                        | Code review, spec verification, plan quality.               |
| **`Designer`**   | UI direction. Uses bundled design-systems and Stitch/Figma skills. | Frontend visuals, design system usage.                      |
| **`Researcher`** | Discovery. Uses `grep_app` MCP and context7/firecrawl CLI skills.  | Codebase search, library docs, web extraction.              |
| **`Writer`**     | Copy / positioning / SEO. Writes to copy files only.               | Landing pages, hero sections, microcopy.                    |
| **`Vision`**     | Image / PDF / diagram extraction.                                  | Visual content analysis when other agents need pixel truth. |
| **`Sub`**        | Cheap bounded executor.                                            | Small, well-scoped delegated tasks.                         |

### Routing rules

- Simple / small tasks (<5 todos, no parallelism) → `coder` (deep) or `sub` (cheap).
- Complex / wave-based tasks (5+ todos, 3+ parallel) → `manager` → wave-dispatch to `coder` / `sub`.
- Planning / architecture → `strategist` first, then route.
- Specialist tiers (`researcher`, `writer`, `designer`, `critic`, `vision`) are always delegated, never auto-routed.
- `Bob` and `Manager` are orchestration agents, **not** normal subagent routing targets.
- `Critic` is selected explicitly for review and verification passes.

### Canonical source files

- `bob.json` — per-agent model IDs (the **only** source of truth for user-facing models).
- `packages/opencode/src/plugin/bob/agents/index.ts` — `createAllAgents(...)` factory.
- `packages/opencode/src/plugin/bob/agents/<agent>.ts` — per-agent factory.
- `packages/opencode/src/plugin/bob/agents/prompt-library/` — shared prompt sections.

## Plugin Architecture

`BobPlugin` is a first-party bundled OpenCode plugin. It is **not** a separately installed package — it ships inside `packages/opencode` so a single binary is self-contained.

### Plugin shape

- Plugin type: `@mimo-ai/plugin > Plugin` (re-exported from `packages/plugin/src/index.ts`).
- Entry: `packages/opencode/src/plugin/bob/index.ts` exports a `PluginInstance` with:
  - `config(config)` — injects MCP defaults, LSP defaults, hidden-agent overrides.
  - `tool(registry)` — registers custom tools (LSP, background-task, skill, session-manager, agent-browser).
  - `hook(name, handler)` — registers the 30+ hooks (see [Hook Inventory](#hook-inventory)).
  - `auth(provider)` — provider auth hooks (currently a passthrough; OpenCode Connect owns auth).

### Configuration

- `bob.json` — **model slot switchboard**. Per-agent `model` strings, `recommended` effort, plus `completion` (auto-continue loop), `dream` (memory-consolidation interval), `distill` (memory distillation interval).
- `bob.env` (gitignored) — **secrets** (Firecrawl key, Context7 key, OpenRouter keys, etc.). `bob.env.example` lists the keys with `{env:VAR}` placeholders.
- `bob.json` `mcp` block — MCP enable/disable toggles.

### Skill discovery

- Project-local `.opencode/skills` is auto-included.
- Plugin-bundled skills in `packages/opencode/src/plugin/bob/skills/` are auto-included.
- Global OpenCode / Claude / Agents folders are **opt-in** (default: disabled).
- Skill materialization happens in `packages/opencode/src/skill/compose/` (`extract.ts`, `bundle.macro.ts`).

### MCP integration

Only `sequential-thinking` and `grep_app` are registered by default. Source of truth: `packages/opencode/src/plugin/bob/mcp/registry.ts`.

- **`sequential-thinking`** — local; `npx -y @modelcontextprotocol/server-sequential-thinking`. Used by `strategist` and `critic`.
- **`grep_app`** — remote; `https://mcp.grep.app`. Used by `researcher` for OSS code pattern search.

> **Deliberately removed from the MCP registry** (per the original fork plan):
>
> - `context7` — moved to on-demand CLI skill at `packages/opencode/src/plugin/bob/skills/context7/`.
> - `stitch` — design uses bundled `design-systems/` plus Figma/Stitch skills.
> - `mempalace` — host runtime provides the native `memory` tool (FTS5-indexed persistent files).

### Hook inventory

The plugin ships 30+ hooks organized by concern:

- **Identity and discipline**: `closure-injector`, `legal-gate`, `manager-guard`, `quality-gate`, `rules-injector`, `agent-usage-reminder`, `start-work`.
- **Context and memory**: `compaction-context-injector`, `compaction-todo-preserver`, `context-window-monitor`, `context-window-limit-recovery`, `preemptive-compaction`, `token-budget`, `reasoning-content-cache`, `sub-notepad`, `sub-agent-receipt`.
- **Continuation**: `ralph-loop`, `stop-continuation-guard`, `todo-continuation`, `session-todo-status`, `background-notification`, `session-notification`, `unstable-agent-babysitter`.
- **Recovery**: `session-recovery`, `edit-error-recovery`, `json-error-recovery`, `runtime-fallback`, `model-fallback`.
- **Output hygiene**: `thinking-block-validator`, `tool-pair-validator`, `write-existing-file-guard`, `directory-agents-injector`, `non-interactive-env`, `think-mode`.

Each hook is a factory `create<Name>(deps) → HookHandler` registered in `packages/opencode/src/plugin/bob/index.ts`.

## Tech Stack

| Layer              | Choice                                                                     | Notes                                                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Runtime            | **Bun 1.3.11+**                                                            | `bun@1.3.11` is pinned in `packageManager`.                                                                                                                  |
| Language           | **TypeScript 5.8.2**                                                       | Strict, ESM-only. `@typescript/native-preview` powers `bun typecheck`.                                                                                       |
| Effect runtime     | **Effect-TS 4.0.0-beta.48**                                                | Used pervasively in the engine.                                                                                                                              |
| AI SDK             | **AI SDK 6 (`ai` + `@ai-sdk/*` providers)**                                | OpenAI, Anthropic, Google, OpenRouter, Alibaba, Bedrock, Vertex, Groq, Mistral, xAI, Cohere, Together, Perplexity, Cerebras, DeepInfra, Vercel Gateway, etc. |
| Frontend           | **SolidJS 1.9.10 + Vite 7**                                                | Primary web UI. Svelte is **not** used here.                                                                                                                 |
| API framework      | **Hono 4**                                                                 | HTTP + WebSocket server (Bun and Node adapters via the `#hono` import condition).                                                                            |
| ORM                | **Drizzle ORM 0.45+** (catalog `1.0.0-beta.19`)                            | Drizzle Kit produces `migration/<ts>_<slug>/migration.sql`.                                                                                                  |
| Datastore          | **PostgreSQL 18 + pgvector 0.8.x**                                         | RAG, vector memory, semantic search.                                                                                                                         |
| Local cache        | **Redis 8.6+**                                                             | Session cache, queue.                                                                                                                                        |
| Local store        | **SQLite (via Drizzle)**                                                   | Local migrations, FTS5-indexed memory.                                                                                                                       |
| Auth               | **Better Auth 1.6+**                                                       | Used by integrations, not embedded in `bob`.                                                                                                                 |
| Auth flows         | **OpenAuth**                                                               | OAuth / OpenID Connect bridging.                                                                                                                             |
| Linter             | **oxlint 1.60**                                                            | **Not Biome** — Biome is not used in this repo.                                                                                                              |
| Formatter          | **Prettier 3.6**                                                           | `semi: false`, `printWidth: 120`.                                                                                                                            |
| Monorepo           | **Turbo 2.8**                                                              | Typecheck orchestration across packages.                                                                                                                     |
| Package manager    | **Bun workspaces**                                                         | `packages/*`, `packages/console/*`, `packages/sdk/js`, `packages/slack`.                                                                                     |
| Patches            | **patchedDependencies**                                                    | `@npmcli/agent`, `solid-js@1.9.10`, `gitlab-ai-provider`, `@standard-community/standard-openapi`.                                                            |
| Container          | **Docker** (`Dockerfile` in `packages/opencode/`)                          | Single-binary build.                                                                                                                                         |
| TUI runtime        | **OpenTUI 0.1.x** (`@opentui/core` + `@opentui/solid`)                     | The bundled TUI shell.                                                                                                                                       |
| IDE protocol       | **Agent Client Protocol (ACP) 0.16**                                       | External agent bridges.                                                                                                                                      |
| Browser automation | **agent-browser CLI** (Chrome via CDP)                                     | Snapshot → `@eN` refs → `click` / `fill`. No Playwright.                                                                                                     |
| Tests              | **Bun test** + **Playwright 1.59** (`e2e/`) + **Vitest** in `packages/ui/` | Do **not** run tests from repo root.                                                                                                                         |

## Skills

Skills are author-defined bundles of markdown instructions mounted into the engine's skill tree. Discovery is deterministic by default.

### Sources

- **Project-local** `.opencode/skills/` — always enabled.
- **Bundled plugin** `packages/opencode/src/plugin/bob/skills/` — always enabled.
- **Explicit `skills.sources`** — opt-in via `bob.json`.
- **Global OpenCode / Claude / Agents** folders — opt-in, **off by default**.

### Skill inventory (bundled)

The bundled skill tree covers ~50 skills. Highlights:

- **Browser**: `agent-browser`, `browser-testing-with-devtools`, `full-page-screenshot`.
- **Design**: `apple-hig`, `canvas-design`, `design-templates`, `figma-*`, `open-design-landing`, `theme-factory`, `web-design-guidelines`.
- **Engineering process**: `spec-driven-development`, `planning-and-task-breakdown`, `incremental-implementation`, `test-driven-development`, `subagent-driven-development`, `executing-plans`, `verification-before-completion`.
- **Review and quality**: `code-review-and-quality`, `code-simplification`, `systematic-debugging`, `receiving-code-review`, `requesting-code-review`, `security-and-hardening`, `performance-optimization`.
- **Workflow**: `dispatching-parallel-agents`, `using-agent-skills`, `using-git-worktrees`, `using-superpowers`, `find-skills`, `interview-me`, `finishing-a-development-branch`.
- **Documentation**: `documentation-and-adrs`, `writing-plans`, `writing-skills`.
- **External lookups**: `context7` (on-demand CLI), `firecrawl-cli`, `supabase-postgres`, `source-driven-development`, `shadcn-ui`.
- **Migration and lifecycle**: `deprecation-and-migration`, `shipping-and-launch`, `ci-cd-and-automation`, `git-workflow-and-versioning`.
- **Meta**: `context-engineering`, `api-and-interface-design`.

Full listing: `packages/opencode/src/plugin/bob/skills/INDEX.md` and `README.md`.

## MCP

Default MCP wiring lives in `packages/opencode/src/plugin/bob/mcp/registry.ts`.

| MCP                   | Type        | Purpose                        | Owner                  |
| --------------------- | ----------- | ------------------------------ | ---------------------- |
| `sequential-thinking` | local (npx) | Deep reasoning traces          | `strategist`, `critic` |
| `grep_app`            | remote      | GitHub/OSS code pattern search | `researcher`           |

> **Removed** (per the original fork plan): `context7`, `stitch`, `mempalace`. Replacement paths are documented in [Skills](#skills) and the AGENTS.md.

CLI skills (not MCP) include `firecrawl-cli` (web scraping, crawl, extract, search) and `agent-browser` (browser automation via Chrome CDP).

## LSP

LSP defaults are wired through the plugin's `lsp.ts` tool and the engine's `src/lsp/` subsystem. Default coverage:

- **TypeScript** — always on; `bun typecheck` from package dirs after edits.
- **Bash** — tree-sitter-bash + tree-sitter-powershell for shell tooling.
- **Python** — for orchestration scripts (where applicable).
- **Custom** — Svelte / Vue / Astro servers are not enabled in this fork; this fork is SolidJS-first.

The plugin exports the LSP tools: `lsp_diagnostics`, `lsp_goto_definition`, `lsp_find_references`, `lsp_symbols`, `lsp_prepare_rename`, `lsp_rename`, plus `disposeLSP` and `setLspConfig`.

> **Mandatory post-edit gate**: after every file edit, run `lsp_diagnostics` on the modified file. Errors must be zero before declaring a task done.

## Models

### Source of truth

`bob.json` is the **only** file where user-facing model IDs are declared. Each entry under `models` is `{ "model": "<provider>/<model-id>", "recommended": "<effort>" }`.

### Slots

`bob`, `coder`, `strategist`, `manager`, `critic`, `designer`, `researcher`, `writer`, `vision`, `sub`. Hidden agents and categories are derived internally.

### Runtime defaults

The TypeScript loader (`packages/opencode/src/plugin/bob/config/`) derives hidden-agent and category routing from the 10 model slots. Do not add a second model map.

### Change rules

- Change `bob.json` to switch any user-facing default model slot.
- Change the loader only to rewire **how** categories inherit those slots.
- Use fully qualified `provider/model-id` strings. Do not introduce local aliases.
- Tell users to connect providers in OpenCode (or the engine's `/connect` TUI command) and copy the exact strings — do not invent provider prefixes.

### Completion controller and memory passes

`bob.json` also configures:

- `dream.auto` + `dream.interval_days` — memory-consolidation pass.
- `distill.auto` + `distill.interval_days` — memory-distillation pass.
- `completion` — auto-continue loop after subagent tasks (tune `max_auto_continues` or set `enabled: false`).

The model used for `dream` / `distill` is pinned to Bob's model automatically — it is not configurable per-pass.

## Root Documentation Policy

The root documentation set should stay small and non-duplicative. Keep:

- `README.md` — project overview, install, usage, full doc index.
- `AGENTS.md` — operational rules for agents and tooling.
- `ARCHITECTURE.md` — this file; internals and modification map.
- `LICENSE.md` — MIT license and attribution (note: this repo uses `LICENSE.md`, **not** `LICENSE`).

Additional root docs are allowed only when they serve a genuinely new role. The fork keeps these by design:

- `.bob/docs/mimo-fork-integration.md` — fork ↔ upstream integration map (archived, maintainer-only).
- `bob.json`, `bob.env.example` — config and secret templates.
- `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md` — standard project files.

`AGENTS.md` is `.gitignore`d because it holds live operational state (previously `bob-todo.md` was also gitignored; that file has been removed).

## Open Source Maintenance Rules

When modifying the engine or the bundled plugin, preserve these invariants:

- `bob.json` is the **only** source of truth for user-facing model IDs and effort recommendations.
- `packages/opencode/src/plugin/bob/mcp/registry.ts` is the **only** source of truth for default MCP wiring.
- `packages/opencode/src/plugin/bob/config/` is a **loader**, not a second model map.
- Root docs use canonical runtime agent names — `Bob`, `Coder`, `Strategist`, `Manager`, `Critic`, `Designer`, `Researcher`, `Writer`, `Vision`, `Sub` — never internal or upstream aliases.
- User-facing docs describe visible primary agents first, hidden / system agents second.
- Third-party MCPs follow upstream install/launch conventions whenever possible.
- The native `memory` tool (FTS5-indexed persistent files) is the **canonical** memory path; do not reintroduce an MCP-based memory backend.
- Use `{env:VAR}` placeholders for secrets in `bob.env`; do not hardcode API keys in `bob.json`.
- Run `bun typecheck` from the package directory, never from repo root.
- Run tests from package directories (`packages/opencode`, `packages/app`, `packages/ui`); the root `bun test` is intentionally a guard that exits non-zero.
- Lint with `bun lint` (oxlint) and `prettier --check .` (or `prettier --write .` to auto-fix). **Do not** add Biome.
- Plugin hooks are added through `packages/opencode/src/plugin/bob/index.ts` and must use the `create<Name>(deps) → HookHandler` factory shape.
- Skill materialization goes through `packages/opencode/src/skill/compose/extract.ts`; do not introduce a parallel skill loader.

## Known Runtime Caveats

- **Branch**: `dev` is the default. Local `main` may not exist; diff against `origin/dev` or `dev`.
- **Typecheck**: `bun typecheck` runs from the package directory (e.g. `packages/opencode`), not the workspace root.
- **Tests**: the root `bun test` is a guard (`exit 1`) — never run tests from repo root.
- **Node fallback**: `#db`, `#pty`, `#hono` import conditions dispatch to Bun or Node adapters; Bun is the default and supported runtime.
- **MCP silent skips**: `sequential-thinking` requires `npx`; missing tools are non-fatal and the engine continues without that capability.
- **Reasoning content caching**: `reasoning-content-cache` hook re-injects `reasoning_content` on subsequent turns to work around OpenAI-compat SDK stripping it (DeepSeek / Kimi K2 / OpenCode Go quirks).
- **Memory is local-first**: the native `memory` tool writes to `$HIAI_BOB_HOME/data/memory/` (or `$XDG_DATA_HOME/hiai-bob/memory/`); BM25/FTS5 over markdown bodies.
- **Closure protocol**: every agent response must wrap a `<CLOSURE>` block. The plugin injects the schema via the `closure-injector` hook; responses without one are auto-rejected.

## Compatibility and Migration

The bundled plugin accepts older names and maps them to current runtime behavior. Notable mappings:

- `subagent` / `quick` / `writing` route to `coder` (bounded) or `sub`.
- `deep` / `ultrabrain` route to `coder` (deep contour).
- `quality-guardian` is folded into `critic`.
- `Agent Skills` is a hidden helper, not user-facing.

The compatibility boundary is handled in `packages/opencode/src/plugin/bob/shared/migration/`.
