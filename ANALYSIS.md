Я изучил проект `mimo-code-fork`. Это форк OpenCode — AI coding assistant с кросс-сессионной памятью. Вот мой анализ и предложения по улучшению:

## Текущая архитектура

**Монорепозиторий** с 16+ пакетами:
- `packages/opencode` — ядро CLI (Effect TS, Hono сервер, TUI на SolidJS)
- `packages/app` — веб-UI компоненты (SolidJS + Vite)
- `packages/desktop` — десктоп приложение (Electron)
- `packages/sdk` — JavaScript SDK для API
- `packages/shared`, `packages/ui`, `packages/plugin` — shared код

**Ключевые технологии:**
- **Effect TS** (v4 beta) — функциональная обработка ошибок, сервисы через `Context.Service`
- **SolidJS** — реактивный UI для TUI (opentui) и веб
- **Hono** — HTTP сервер с WebSocket
- **Drizzle ORM** — SQLite для хранения сессий
- **Bun** — runtime и пакетный менеджер
- **Zod** — валидация схем

## Что хорошо

1. **Effect TS архитектура** — 65+ сервисов через `Layer.effect`, чистое разделение зависимостей
2. **Память** — FTS5 индекс, checkpoint writer, project memory — продвинутая система
3. **Subagent система** — spawn/wait/turn с lifecycle tracking
4. **Провайдеры** — 15+ LLM провайдеров через AI SDK
5. **TUI** — opentui с мышью, клавиатурой, плагинами

## Проблемы и улучшения

### 1. Размер файлов (критично)
- `session.ts` — 908 строк
- `checkpoint.ts` — 1478 строк  
- `app.tsx` — 1130 строк
- `provider.ts` — 1787 строк
- `llm.ts` — 735 строк

**Решение:** Разбить на модули. Например, `session.ts` → `session/create.ts`, `session/fork.ts`, `session/messages.ts`.

### 2. TODO/FIXME (42 штуки)
Критичные:
- `provider.ts:274` — `process.env` напрямую вместо `Env.set`
- `agent.ts:488` — провайдер-специфичная логика в агенте
- `tool.ts:13` — "TODO: remove this hack"
- `llm.ts:322` — "move this to a proper hook"

**Решение:** Приоритизировать и создать задачи на каждый TODO.

### 3. Дублирование runtime
Два файла `makeRuntime`:
- `src/effect/run-service.ts:38`
- `src/effect/runtime.ts:5`

**Решение:** Унифицировать в один модуль.

### 4. Zod vs Effect Schema
Используется Zod для валидации, но Effect TS имеет свой Schema. Несогласованность.

**Решение:** Мигрировать на Effect Schema для консистентности с экосистемой.

### 5. Типы `any`
- `session.ts:218` — `data: Record<string, any>`
- `tool.ts:10` — `Metadata = { [key: string]: any }`

**Решение:** Заменить на `unknown` + type guards.

### 6. Конфигурация разбросана
Флаги в `Flag`, env в `Env`, config в `Config` — три источника.

**Решение:** Единый конфиг с иерархией: defaults < env < config file < CLI args.

### 7. Тесты
`package.json`: `"test": "echo 'do not run tests from root' && exit 1"`

**Решение:** Добавить интеграционные тесты для критичных путей (session lifecycle, checkpoint writer).

### 8. Плагин система
`plugin/index.ts` — 504 строки, сложная загрузка.

**Решение:** Упростить API плагинов, добавить schema validation для plugin manifest.

### 9. Мемоизация
`memo-map.ts` — глобальный `Layer.makeMemoMapUnsafe()` без ограничений.

**Решение:** Добавить лимит размера и TTL.

### 10. Ошибки в TUI
`app.tsx` — 1130 строк с inline обработчиками событий.

**Решение:** Вынести обработчики в хуки/сторы, разбить на компоненты.

## Приоритеты

**Высокий:**
1. Разбить гигантские файлы (>500 строк)
2. Убрать `any` типы
3. Унифицировать runtime

**Средний:**
4. Закрыть критичные TODO
5. Миграция Zod → Effect Schema
6. Улучшить тесты

**Низкий:**
7. Оптимизировать memo-map
8. Рефакторинг TUI