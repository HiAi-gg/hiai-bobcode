# hiai-bob — AGENTS.md

> **Role:** orchestration agent (outside the plugin scheme) — orchestrator/runner based on a fork of XiaomiMiMo/MiMo-Code
> with first-party `BobPlugin` logic (see `docs/mimo-fork-integration.md`).
> **Status:** active
> **Ecosystem entry point:** Ecosystem documentation lives in the workspace root (`/home/hiai/Documents/` and `/home/hiai/AGENTS.md`).
> **Conventions:** Workspace-level conventions are defined in the root `AGENTS.md` and project-level `AGENTS.md` files.
> **Note:** This project lives independently (outside the plugin scheme). Rules §1–§7 are followed where possible, but it is not required to be plugin-compatible.

## Cheat-Sheet (conventions summary)

- **Runtime:** Bun 1.3.14+
- **Backend/Engine:** TypeScript + fork of opencode-ai@1.17.4 (MiMo-Code) with `BobPlugin`
- **Frontend:** SolidJS 1.9 + Vite (packages/app)
- **UI:** SolidJS (packages/ui)
- **ORM:** Drizzle ORM 0.45+ (in shared data models)
- **Auth:** Better Auth 1.6+ (via integrations, not embedded in bob)
- **DB:** PostgreSQL 18 + pgvector (for RAG/memory)
- **Cache:** Redis 8.6+
- **Lint:** oxlint + Prettier (this repo uses oxlint, not Biome)
- **Tests:** Bun test runner
- **Env only via `lib/config.ts` (Zod)** — never `process.env` directly
- **Branch:** `dev` by default (main may not exist locally)
- **Typecheck:** `bun typecheck` from the package directory (e.g. `packages/opencode`), not from root

## Canonical References

Ecosystem-wide documentation (conventions, architecture, ADRs) lives in the workspace root under `Documents/` and `AGENTS.md`. This project's documentation is self-contained within its own `docs/` directory. See the document index below.

## Project Document Index

| Document | Purpose |
|---|---|
| `README.md` | Project overview + full documentation |
| `AGENTS.md` (this file) | Agent rules |
| `ARCHITECTURE.md` | System architecture and repository layout |
| `CHANGELOG.md` | Version history |
| `CONTRIBUTING.md` | How to contribute |
| `SECURITY.md` | Security policy |
| `CODE_OF_CONDUCT.md` | Community standards |
| `LICENSE.md` | MIT license |
| `docs/mimo-fork-integration.md` | Integration map with MiMo-Code |
| `docs/development.md` | Developer setup guide |
| `docs/build-release.md` | Build and release instructions |
| `bob.env.example` | Environment variable template (distinct from the real `bob.env`) |

## Project Rules (legacy, preserved)

- Always use superpowers skill instead of builtin plan mode.
- To regenerate the JavaScript SDK, run `./packages/sdk/js/script/build.ts`.
- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.
- The default branch in this repo is `dev`.
- Local `main` ref may not exist; use `dev` or `origin/dev` for diffs.
- Prefer automation: execute requested actions without confirmation unless blocked by missing info or safety/irreversibility.

> **Note:** This file (`AGENTS.md`) is listed in `.gitignore` and is not committed.
> They contain operational instructions for agents and may change without review.

## Agent Tool Dependencies

Some agent tools require system binaries to be installed. If missing, the agent will skip the tool and continue.

| Tool | Binary | Install | Required? |
|------|--------|---------|-----------|
| Firecrawl (web search) | `firecrawl-cli` | `npm install -g firecrawl-cli` | No |
| Browser (visual testing) | `chromium-browser` | `apt install chromium-browser` | No |
| PostgreSQL (DB queries) | `psql` | `apt install postgresql-client` | No |
| Docker (infra) | `docker` | [docker.com](https://docker.com) | No — for infra only |

Agents check tool availability at runtime. Missing tools are silently skipped — the agent adapts.

## `memory` Tool (FTS5/BM25)

- Agents can use the built-in `memory` tool to search project memory.
- Search uses BM25 over SQLite FTS5 (full-text index of markdown files).
- Memory files live in `$HIAI_BOB_HOME/data/memory/` (or `$XDG_DATA_HOME/hiai-bob/memory/`).
- **Scope types:** `projects`, `sessions`, `global`, `cc` (optional).
- Queries: 1–3 rare keywords (function names, task IDs, exact phrases). Avoid generic words.
- `memory` is authoritative; if search returns a result, trust it.
- Details: [`docs/memory-system.md`](docs/memory-system.md).

## Style Guide

### General Principles

- Keep things in one function unless composable or reusable
- Avoid `try`/`catch` where possible
- Avoid using the `any` type
- Use Bun APIs when possible, like `Bun.file()`
- Rely on type inference when possible; avoid explicit type annotations or interfaces unless necessary for exports or clarity
- Prefer functional array methods (flatMap, filter, map) over for loops; use type guards on filter to maintain type inference downstream
- In `src/config`, follow the existing self-export pattern at the top of the file (for example `export * as ConfigAgent from "./agent"`) when adding a new config module.

Reduce total variable count by inlining when a value is only used once.

```ts
// Good
const journal = await Bun.file(path.join(dir, "journal.json")).json()

// Bad
const journalPath = path.join(dir, "journal.json")
const journal = await Bun.file(journalPath).json()
```

### Destructuring

Avoid unnecessary destructuring. Use dot notation to preserve context.

```ts
// Good
obj.a
obj.b

// Bad
const { a, b } = obj
```

### Variables

Prefer `const` over `let`. Use ternaries or early returns instead of reassignment.

```ts
// Good
const foo = condition ? 1 : 2

// Bad
let foo
if (condition) foo = 1
else foo = 2
```

### Control Flow

Avoid `else` statements. Prefer early returns.

```ts
// Good
function foo() {
  if (condition) return 1
  return 2
}

// Bad
function foo() {
  if (condition) return 1
  else return 2
}
```

### Schema Definitions (Drizzle)

Use snake_case for field names so column names don't need to be redefined as strings.

```ts
// Good
const table = sqliteTable("session", {
  id: text().primaryKey(),
  project_id: text().notNull(),
  created_at: integer().notNull(),
})

// Bad
const table = sqliteTable("session", {
  id: text("id").primaryKey(),
  projectID: text("project_id").notNull(),
  createdAt: integer("created_at").notNull(),
})
```

## Testing

- Avoid mocks as much as possible
- Test actual implementation, do not duplicate logic into tests
- Tests cannot run from repo root (guard: `do-not-run-tests-from-root`); run from package dirs like `packages/opencode`.

## Type Checking

- Always run `bun typecheck` from package directories (e.g., `packages/opencode`), never `tsc` directly.

## Self-Installation on Fresh Host

When running on a new machine, check tool availability before delegating:

**Development**: `./script/dev.sh` starts backend (:50900) and frontend (:50901) from source.

**Production**:
1. `cd packages/opencode && bun run build` — produces `hiai-bob` binary
2. `cd packages/app && bun run build` — produces `dist/` static frontend
3. `./hiai-bob serve --port 50900` — starts backend
4. `cd packages/app && bun run serve --port 50902` — starts frontend

**Tool discovery** (run at session start):
- `which firecrawl chromium-browser psql docker` — map available tools
- Missing tools are non-fatal: skip that capability, use alternatives
- Never fail because a tool is missing — route around the gap
