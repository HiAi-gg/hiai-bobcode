# hiai-bob — AGENTS.md

> **Роль:** orchestrator agent (вне plugin-схемы) — оркестратор/раннер на базе форка XiaomiMiMo/MiMo-Code
> с первой партийной логикой `BobPlugin` (см. `MIMO-FORK-INTEGRATION.md`, `bob-plan.md §F`).
> **Статус:** активный
> **Точка входа экосистемы:** [`projects/INDEX.md`](../../INDEX.md)
> **Канонические правила:** [`docs/hiai-ecosystem/CONVENTIONS.md`](../../docs/hiai-ecosystem/CONVENTIONS.md)
> **Примечание:** Этот проект живёт самостоятельно (вне plugin-схемы). Правилам §1–§7 следует по возможности, но не обязан быть plugin-совместимым.

## Cheat-Sheet (краткая сводка конвенций)

- **Runtime:** Bun 1.3.14+
- **Backend/Engine:** TypeScript + fork of opencode-ai@1.17.4 (MiMo-Code) с `BobPlugin`
- **Frontend:** N/A (headless orchestrator)
- **UI:** N/A
- **ORM:** Drizzle ORM 0.45+ (в shared моделях данных)
- **Auth:** Better Auth 1.6+ (через интеграции, не встроено в bob)
- **DB:** PostgreSQL 18 + pgvector (для RAG/memory)
- **Cache:** Redis 8.6+
- **Lint:** oxlint + Prettier (этот репо использует oxlint, не Biome)
- **Tests:** Bun test runner
- **Env только через `lib/config.ts` (Zod)** — никогда `process.env` напрямую
- **Branch:** `dev` по умолчанию (main может не существовать локально)
- **Typecheck:** `bun typecheck` из директории пакета (например `packages/opencode`), не из корня

## Канонические ссылки

- [`docs/hiai-ecosystem/CONVENTIONS.md`](../../docs/hiai-ecosystem/CONVENTIONS.md) — правила экосистемы
- [`docs/hiai-ecosystem/ARCHITECTURE.md`](../../docs/hiai-ecosystem/ARCHITECTURE.md) — архитектура экосистемы
- [`docs/hiai-ecosystem/UNIFICATION_ADR.md`](../../docs/hiai-ecosystem/UNIFICATION_ADR.md) — ADR

## Индекс проектных документов

| Документ | Назначение |
|---|---|
| `README.md` | обзор проекта |
| `AGENTS.md` (этот файл) | правила для агентов |
| `todo.md` | живой статус задач (ранее `bob-todo.md`) |
| `bob-plan.md` | продуктовый план форка |
| `MIMO-FORK-INTEGRATION.md` | карта интеграции с MiMo-Code |
| `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE`, `USE_RESTRICTIONS.md` | стандартные |
| `bob.env.example` | шаблон переменных окружения (не путать с реальным `bob.env`) |
| `docs/build-release.md` | инструкции по сборке и релизу |

## Проектные правила (legacy, сохраняем)

- Always use superpowers skill instead of builtin plan mode.
- To regenerate the JavaScript SDK, run `./packages/sdk/js/script/build.ts`.
- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.
- The default branch in this repo is `dev`.
- Local `main` ref may not exist; use `dev` or `origin/dev` for diffs.
- Prefer automation: execute requested actions without confirmation unless blocked by missing info or safety/irreversibility.

> **Примечание:** Этот файл (`AGENTS.md`) и `todo.md` добавлены в `.gitignore` и не коммитятся.
> Они содержат оперативные инструкции для агентов и могут меняться без review.

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
