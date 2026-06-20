# Анализ сервера opencode и фронта на http://localhost:4096

> Дата: 2026-06-14
> Цель: Изучить архитектуру сервера opencode, API endpoints, фронт на SolidJS.

---

## 1. Архитектура сервера

### 1.1 Стек

| Компонент | Технология |
|-----------|-----------|
| HTTP фреймворк | **Hono** (`hono`) |
| OpenAPI | `hono-openapi` с Zod-схемами |
| Адаптер | Bun (`hono/bun`) или Node (`@hono/node-server`) — выбирается автоматически |
| WebSocket | `hono/ws` через `createBunWebSocket()` или `@hono/node-ws` |
| Stream | SSE через `hono/streaming` |
| Effect | Effect-TS для бизнес-логики (все `jsonRequest` обёртки) |
| База данных | SQLite через Drizzle ORM |

### 1.2 Точка входа

**Файл:** `packages/opencode/src/index.ts`

CLI-утилита на yargs. Команда `serve` (из `packages/opencode/src/cli/cmd/serve.ts`):
- Запускает `Server.listen(opts)` где opts = `{ port, hostname, cors?, mdns?, mdnsDomain? }`
- По умолчанию порт **4096**

### 1.3 Инициализация сервера

**Файл:** `packages/opencode/src/server/server.ts`

```typescript
function create(opts: { cors?: string[] }) {
  const app = new Hono()
    .onError(ErrorMiddleware)
    .use(AuthMiddleware)
    .use(LoggerMiddleware)
    .use(CompressionMiddleware)
    .use(CorsMiddleware(opts))
    .route("/global", GlobalRoutes())

  // Если MIMOCODE_WORKSPACE_ID установлен — workspace-mode (изолированный instance)
  // Иначе — control-plane mode
}
```

Два режима:
- **Workspace mode** (`MIMOCODE_WORKSPACE_ID`): один instance с InstanceMiddleware + Fence
- **Control-plane mode** (по умолчанию): ControlPlaneRoutes + WorkspaceRouter + InstanceRoutes + UIRoutes

### 1.4 Адаптеры

**Файлы:** `adapter.ts`, `adapter.bun.ts`, `adapter.node.ts`

```typescript
// Bun-адаптер (adapter.bun.ts)
const ws = createBunWebSocket()
Bun.serve({ fetch: app.fetch, websocket: ws.websocket })

// Node-адаптер (adapter.node.ts)
const ws = createNodeWebSocket({ app })
createAdaptorServer({ fetch: app.fetch })
```

Оба адаптера поддерживают WebSocket через `upgradeWebSocket`.

### 1.5 Middleware

**Файл:** `packages/opencode/src/server/middleware.ts`

| Middleware | Описание |
|-----------|----------|
| `AuthMiddleware` | Basic Auth (если `MIMOCODE_SERVER_PASSWORD` установлен) |
| `CorsMiddleware` | Разрешает localhost, `*.opencode.ai`, и настраиваемые origins |
| `CompressionMiddleware` | gzip-сжатие (исключение: regex `/\/session\/[^/]+\/(message\|prompt_async)$/` — не сжимает streaming-ответы) |
| `LoggerMiddleware` | Логирование запросов |
| `ErrorMiddleware` | Обработка ошибок (NamedError → структурированный JSON) |
| `FenceMiddleware` | Синхронизация событий (только в workspace-mode) |
| `InstanceMiddleware` | Устанавливает рабочую директорию из `?directory=`, `x-mimocode-directory` или `process.cwd()` |

### 1.6 InstanceMiddleware — откуда берётся директория

**Файл:** `packages/opencode/src/server/routes/instance/middleware.ts`

```typescript
const raw = c.req.query("directory") || c.req.header("x-mimocode-directory") || process.cwd()
```

Приоритет:
1. Query-параметр `?directory=`
2. HTTP-заголовок `x-mimocode-directory`
3. `process.cwd()` — текущая рабочая директория процесса

---

## 2. Полный список API Endpoints

### 2.1 Global Routes (`/global/*`)

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/global/health` | GET | Health check (возвращает `{ healthy: true, version }`) |
| `/global/event` | GET | SSE-поток глобальных событий (heartbeat каждые 10с) |
| `/global/config` | GET | Получить глобальную конфигурацию |
| `/global/config` | PATCH | Обновить глобальную конфигурацию |
| `/global/dispose` | POST | Остановить все instance |
| `/global/upgrade` | POST | Обновить opencode |

### 2.2 Instance Routes (`/session/*`)

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/session` | GET | Список сессий (фильтры: directory, roots, start, search, limit) |
| `/session/status` | GET | Статусы всех сессий |
| `/session` | POST | Создать сессию |
| `/:sessionID` | GET | Получить сессию |
| `/:sessionID` | DELETE | Удалить сессию |
| `/:sessionID` | PATCH | Обновить сессию (title, permission, archived) |
| `/:sessionID/children` | GET | Дочерние сессии |
| `/:sessionID/todo` | GET | Todo-лист сессии |
| `/:sessionID/task` | GET | Задачи (work-item registry) |
| `/:sessionID/init` | POST | Инициализировать сессию (создать AGENTS.md) |
| `/:sessionID/fork` | POST | Форкнуть сессию |
| `/:sessionID/abort` | POST | Прервать сессию |
| `/:sessionID/share` | POST | Создать ссылку для шаринга |
| `/:sessionID/share` | DELETE | Убрать шаринг |
| `/:sessionID/diff` | GET | Получить diff'ы сессии |
| `/:sessionID/permissions/:permissionID` | POST | Ответ на permission (deprecated) |
| `/:sessionID/summarize` | POST | Суммаризировать сессию (compact) |
| `/:sessionID/message` | GET | Сообщения сессии (с пагинацией через cursor) |
| `/:sessionID/message/:messageID` | GET | Конкретное сообщение |
| `/:sessionID/message/:messageID` | DELETE | Удалить сообщение |
| `/:sessionID/message` | POST | Отправить сообщение (streaming) |
| `/:sessionID/prompt_async` | POST | Отправить сообщение асинхронно (accept 204) |
| `/:sessionID/command` | POST | Выполнить команду |
| `/:sessionID/predict` | POST | Предсказать следующий prompt |
| `/:sessionID/shell` | POST | Выполнить shell-команду |
| `/:sessionID/revert` | POST | Откатить сообщение |
| `/:sessionID/unrevert` | POST | Восстановить откат |
| `/:sessionID/actors` | GET | Список акторов сессии |
| `/:sessionID/message/:messageID/part/:partID` | DELETE | Удалить часть сообщения |
| `/:sessionID/message/:messageID/part/:partID` | PATCH | Обновить часть сообщения |

### 2.3 File / Search Routes

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/find?pattern=` | GET | Поиск текста (ripgrep, `Instance.directory`) |
| `/find/file?query=` | GET | Поиск файлов |
| `/find/symbol?query=` | GET | Поиск символов (LSP) |
| `/file?path=` | GET | Список файлов в директории (File.Service) |
| `/file/content?path=` | GET | Чтение содержимого файла |
| `/file/status` | GET | Git status файлов |
| `/path` | GET | Пути: home, state, config, worktree, directory |
| `/vcs` | GET | VCS информация (branch, default_branch) |
| `/vcs/diff?mode=` | GET | Git diff (mode: git/branch) |

### 2.4 Config Routes (`/config/*`)

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/config` | GET | Конфигурация instance |
| `/config` | PATCH | Обновить конфигурацию |
| `/config/providers` | GET | Список провайдеров |

### 2.5 Другие Routes

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/project` | GET | Информация о проекте |
| `/project/current` | GET | Текущий проект |
| `/agent` | GET | Список AI-агентов |
| `/skill` | GET | Список скиллов |
| `/command` | GET | Список команд |
| `/lsp` | GET | Статус LSP серверов |
| `/formatter` | GET | Статус форматтера |
| `/event` | GET | SSE-поток событий instance |
| `/pty` | (WebSocket) | PTY-терминал |
| `/bash-interactive` | (Hono) | Интерактивный bash |
| `/mcp` | (varies) | MCP routes |
| `/tui` | (varies) | TUI routes |
| `/sync` | (varies) | Sync routes |
| `/experimental` | (varies) | Experimental routes |
| `/question` | (varies) | Question routes |
| `/permission` | (varies) | Permission routes |
| `/workflows` | (varies) | Workflow routes |
| `/provider` | (varies) | Provider routes |
| `/auth/:providerID` | PUT | Установить auth credentials |
| `/auth/:providerID` | DELETE | Удалить auth credentials |
| `/doc` | GET | OpenAPI документация |
| `/log` | POST | Записать лог |
| `/instance/dispose` | POST | Остановить instance |

### 2.6 UI Routes (catch-all `/*`)

**Файл:** `packages/opencode/src/server/routes/ui.ts`

```
/* → встроенный web UI (из `opencode-web-ui.gen.ts`) или прокси на https://app.opencode.ai
```

- Если `MIMOCODE_DISABLE_EMBEDDED_WEB_UI` → прокси на `app.opencode.ai`
- Иначе → встроенный web UI (генерируется при билде)

---

## 3. Как запускаются сессии

### 3.1 Через HTTP API

**Создание сессии:**
```bash
curl -X POST 'http://localhost:4096/session?directory=/mnt/ai_data/projects/mimo-code-fork' \
  -H "Content-Type: application/json" \
  -d '{"title": "Моя сессия"}'
```

> **Примечание:** Параметр `directory` передаётся через query-параметр `?directory=` или HTTP-заголовок `x-mimocode-directory` (обрабатывается `InstanceMiddleware`). Параметр `model` не передаётся при создании сессии — он указывается при отправке сообщения (POST `/:sessionID/message`).

**Отправка сообщения (streaming):**
```bash
curl -X POST http://localhost:4096/session/SESSION_ID/message \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Привет, объясни этот код",
    "model": "providerID/modelID"
  }'
```

**Чтение событий (SSE):**
```bash
curl -N http://localhost:4096/event
```

### 3.2 Через WebSocket

WebSocket доступен через `/pty` и через `upgradeWebSocket` в адаптерах. PTY-терминал использует WebSocket для интерактивного ввода/вывода.

### 3.3 Механизм

1. **InstanceMiddleware** устанавливает `Instance.directory` для каждого запроса
2. **Session.Service** управляет CRUD сессий через SQLite (Drizzle ORM)
3. **SessionPrompt.Service** обрабатывает отправку сообщений и запускает AI-агент
4. **Bus** (Event Bus) используется для real-time событий
5. SSE (`/event`) позволяет фронту подписываться на события сессии

---

## 4. Что видит сервер (директории и файлы)

### 4.1 Текущие пути (из curl /path)

```json
{
  "home": "/home/vlgalib",
  "state": "/home/vlgalib/.local/state/mimocode",
  "config": "/home/vlgalib/.config/mimocode",
  "worktree": "/mnt/ai_data/projects/mimo-code-fork",
  "directory": "/mnt/ai_data/projects/mimo-code-fork/packages/opencode"
}
```

### 4.2 Зарегистрированные проекты (из curl /project)

Сервер знает о 6 проектах:
- `/mnt/ai_data`
- `/mnt/ai_data/projects/mimo-code-fork`
- `/tmp/bobtest`, `/tmp/bobtest2`, `/tmp/bobtest3`
- `/` (global)

### 4.3 Файлы и их API

- **Просмотр файлов:** `GET /file?path=/<directory>` — возвращает список файлов/директорий
- **Чтение файлов:** `GET /file/content?path=/<filepath>` — содержимое файла
- **Поиск текста:** `GET /find?pattern=<regex>` — ripgrep по проекту
- **Статус файлов:** `GET /file/status` — git status

### 4.4 Примечание

Сервер работает из `packages/opencode` как `directory`, но `worktree` указывает на корень проекта (`/mnt/ai_data/projects/mimo-code-fork`). Фронт использует `worktree` как корень проекта для навигации.

---

## 5. Фронт на http://localhost:4096

### 5.1 Технологический стек

| Компонент | Технология |
|-----------|-----------|
| Фреймворк | **SolidJS** (реактивный, без виртуального DOM) |
| Сборка | **Vite** |
| Роутер | `@solidjs/router` |
| Запросы | `@tanstack/solid-query` + самописный SDK |
| UI-Kit | `@mimo-ai/ui` (внутренняя библиотека компонентов) |
| Стили | CSS-in-JS / Tailwind-like (через `@mimo-ai/ui`) |
| Языки | **i18n**: английский (en), китайский (zh) |

### 5.2 Роутинг

**Файл:** `packages/app/src/app.tsx`

```tsx
<Route path="/" component={HomeRoute} />                    {/* Главная страница */}
<Route path="/:dir" component={DirectoryLayout}>            {/* Проект + сессии */}
  <Route path="/" component={SessionIndexRoute} />           {/* Редирект на /session */}
  <Route path="/session/:id?" component={SessionRoute} />    {/* Конкретная сессия */}
</Route>
```

То есть:
- `http://localhost:4096/` — домашняя страница
- `http://localhost:4096/<base64-encoded-directory>/` — страница проекта
- `http://localhost:4096/<base64-encoded-directory>/session/` — список сессий
- `http://localhost:4096/<base64-encoded-directory>/session/<sessionID>` — конкретная сессия

Директория передаётся в **base64-кодированном** виде (из `@mimo-ai/shared/util/encode`).

### 5.3 Страницы

- **Home** (`pages/home.tsx`): Показывает логотип OpenCode, список последних проектов, кнопку "Open project", статус подключения к серверу
- **Layout** (`pages/layout.tsx`): Основной layout с боковой панелью, списком проектов, сессиями
- **DirectoryLayout** (`pages/directory-layout.tsx`): Инициализация SDK для выбранной директории, создание SyncProvider
- **Session** (`pages/session.tsx`): Основная страница сессии — сообщения, review панель, файловый браузер, терминал
- **Session/** (директория): компоненты для страницы сессии (composer, message-timeline, review-tab, terminal-panel, session-side-panel)

### 5.4 Как фронт подключается к серверу

**Файл:** `packages/app/src/entry.tsx`

```typescript
const getCurrentUrl = () => {
  if (location.hostname.includes("opencode.ai")) return "http://localhost:4096"
  if (import.meta.env.DEV)
    return `http://${import.meta.env.VITE_OPENCODE_SERVER_HOST ?? "localhost"}:${import.meta.env.VITE_OPENCODE_SERVER_PORT ?? "4096"}`
  return location.origin
}
```

- **DEV режим:** используется `localhost:4096` (или из env VITE_OPENCODE_SERVER_HOST/PORT)
- **Production:** используется `location.origin`

Подключение к серверу:
1. `ServerProvider` (`context/server.tsx`) — управляет списком серверов, health check (каждые 10с), автовыбором
2. `GlobalSDKProvider` (`context/global-sdk.tsx`) — создаёт SDK-клиент (`@mimo-ai/sdk/v2`)
3. `GlobalSyncProvider` (`context/global-sync.tsx`) — подключается к SSE (`/global/event`), обрабатывает события, синхронизирует состояние
4. `SyncProvider` (`context/sync.tsx`) — синхронизация для конкретной директории

**Real-time коммуникация:**
- **SSE** (`/event` и `/global/event`) — основной канал для событий
- **HTTP API** — все CRUD операции (через SDK)
- **WebSocket** — для PTY/терминала

### 5.5 Провайдеры и контексты

```
AppBaseProviders
  ├── MetaProvider (<head> мета-теги)
  ├── Font (шрифты)
  ├── ThemeProvider (темы: темная/светлая/системная)
  ├── LanguageProvider + I18nBridge (i18n)
  ├── ErrorBoundary
  ├── DialogProvider
  ├── MarkedProvider + FileComponentProvider
  │
  └── AppInterface
       ├── ServerProvider (управление серверами)
       │   └── ConnectionGate (health check при старте)
       │       └── QueryProvider (@tanstack/solid-query)
       │           ├── GlobalSDKProvider (SDK клиент)
       │           │   └── GlobalSyncProvider (SSE + глобальное состояние)
       │           │       └── Router
       │           │           └── RouterRoot
       │           │               ├── SettingsProvider
       │           │               ├── PermissionProvider
       │           │               ├── LayoutProvider
       │           │               ├── NotificationProvider
       │           │               ├── ModelsProvider
       │           │               ├── CommandProvider
       │           │               └── HighlightsProvider
       │           │                   └── Layout (боковая панель + children)
       │           └── DirectoryLayout (на странице проекта)
       │               ├── SDKProvider (SDK для конкретной директории)
       │               └── SyncProvider + DirectoryDataProvider
       │                   ├── DataProvider
       │                   └── LocalProvider
       │                       └── SessionProviders (на странице сессии)
       │                           ├── TerminalProvider
       │                           ├── FileProvider
       │                           ├── PromptProvider
       │                           └── CommentsProvider
```

### 5.6 Состояние сессий

- **globalSync.data** — глобальное состояние: пути, проекты, конфиг, todos
- **sync.data** — состояние директории: сессии, сообщения, статусы, diffs
- **SSE-события** (`applyGlobalEvent`, `applyDirectoryEvent`) — обрабатывают изменения в реальном времени
- **Session status polling** — статусы сессий обновляются через SSE

---

## 6. Поток данных: от запроса до ответа

```
Фронт (SolidJS)                 Сервер (Hono)                    Effect-TS / SQLite
     │                              │                                 │
     ├── POST /session ─────────────► InstanceMiddleware ────────────► Session.Service.create()
     │   (создать сессию)           │  (устанавливает directory)     │
     │                              │                                 │
     ├── POST /session/:id/message ─► SessionRoutes.prompt ──────────► SessionPrompt.Service.prompt()
     │   (отправить сообщение)      │  (проверка not-busy)           │
     │                              │  (stream response)              │
     │                              │                                 │
     ├── SSE /event ◄───────────────┤ Bus (Event Bus) ◄──────────────┘
     │   (получать события)         │  (heartbeat 10с)
     │                              │
     ├── GET /file?path= ◄──────────► FileRoutes.list ───────────────► File.Service.list()
     │   (просмотр файлов)          │                                 │  (readdir)
     │                              │                                 │
```

---

## 7. Странности и риски

### 7.1 Замечания

1. **SSE без WebSocket**: Сервер использует SSE (Server-Sent Events) вместо WebSocket для основного потока событий. Это односторонний канал (сервер → клиент). Для двусторонней коммуникации используются HTTP запросы + WebSocket для PTY. Это необычный выбор, но рабочий.

2. **Два SSE endpoints**: `/event` (instance-level) и `/global/event` (global-level). Фронт подключается к обоим.

3. **Base64 в URL**: Путь к директории передаётся в base64 в URL (например, `/<base64>/session/...`). Это означает, что URL нечитаемы для человека, но зато безопасны для любых символов в пути.

4. **InstanceMiddleware на каждый запрос**: Каждый HTTP запрос проходит через `Instance.provide()` который (опционально) вызывает `InstanceBootstrap`. Это значит, что первый запрос к каждому новому directory будет медленнее (пока инициализируется instance).

5. **Фронт как embedded web UI**: Сервер может раздавать встроенный web UI (скомпилированный в `opencode-web-ui.gen.ts`) или проксировать на `app.opencode.ai`. Это значит, что локальный сервер может работать полностью офлайн с встроенным UI.

6. **No WebSocket in the main flow**: Вопреки ожиданиям, WebSocket не используется для основного потока сообщений — вместо этого используется HTTP POST + streaming-ответ. WebSocket задействован только для PTY (терминал).

### 7.2 Потенциальные риски

1. **No auth по умолчанию**: Если `MIMOCODE_SERVER_PASSWORD` не установлен, сервер работает без аутентификации (лог при запуске: "Warning: MIMOCODE_SERVER_PASSWORD is not set; server is unsecured.")

2. **Все endpoints доступны без CORS**: CORS разрешает `localhost:*`, `*.opencode.ai`, и любые origins, переданные через `--cors`

3. **SSH / remote server mode**: Фронт поддерживает SSH-серверы и WSL. Сложность в настройке безопасности.

4. **Health check спам**: Фронт делает health check каждые 10 секунд.

5. **process.cwd() как fallback**: Если ни `?directory=`, ни `x-mimocode-directory` не переданы, сервер использует `process.cwd()`. Это может привести к неожиданному поведению, если сервер запущен не из той директории.

---

## 8. Резюме

| Аспект | Детали |
|--------|--------|
| Сервер | Hono (+Effect-TS) на Bun/Node, порт 4096 |
| API | REST + SSE + WebSocket (для PTY) |
| База | SQLite (Drizzle ORM) |
| Фронт | SolidJS + Vite + @mimo-ai/ui |
| Роутинг | `@` → Home, `/:dir/session/:id?` → Session |
| Real-time | SSE (`/event`, `/global/event`) |
| Директория | Определяется из query/header/cwd |
| Файлы | File.Service через Node fs, ripgrep для поиска |
