# MiMoCode Fork — Analysis & Recommendations

> Generated: 2026-06-14 by Manager (T12)
> Based on full repo audit: 4 parallel research agents, 2 verification agents, 14 tool checks.

---

## 1. Executive Summary

**MiMoCode** is a Xiaomi MiMo Team fork of OpenCode — an AI coding assistant with cross-session memory, subagent orchestration, 18+ LLM providers, and a full TUI/web/desktop UI stack.

| Metric | Value |
|--------|-------|
| Workspace packages | 16 |
| Core source lines | 111,059 (in `packages/opencode/src/`) |
| Key technologies | Effect TS 4.0.0-beta.48, SolidJS 1.9.10, Hono 4.10.7, AI SDK 6.0.168, Drizzle ORM, Bun 1.3.11 |
 | Test files | 319 |
 | Typecheck | ✅ PASS (0 errors) |
 | Lint script | ❌ Not defined |
 | TODO/FIXME/HACK/XXX | 43 occurrences in 28 files |
 | `any` type usages | 155 occurrences (unique lines) |
| `makeRuntime` duplicates | 2 definitions in separate files |
| Model providers | 7 unique, all authenticated |
| Tools integrated | 9 (3 builtin, 2 MCP, 3 CLI skills, 1 Bob plugin wrapper) |

**Overall health:** Good. The codebase is actively developed (34 migrations, modern Effect TS pattern usage), passes typecheck, and has 319 tests. Key concerns: 2 `makeRuntime` definitions (legacy duplicate), 155 `any` types, and one missing startup validation for model providers.

---

## 2. 10 Models — Configuration & Verification

### 2.1 Configured Models (`bob.json`)

| Agent | Model | Provider | Recommended | Auth Status |
|-------|-------|----------|-------------|-------------|
| bob | `kimi-for-coding/k2p7` | kimi-for-coding | high | ✅ Authed |
| coder | `minimax-coding-plan/MiniMax-M3` | minimax-coding-plan | high | ✅ Authed |
| strategist | `deepseek/deepseek-v4-pro` | deepseek | xhigh | ✅ Authed |
| manager | `opencode-go/deepseek-v4-flash` | opencode-go | middle | ✅ Authed |
| critic | `xiaomi-token-plan-sgp/mimo-v2.5-pro` | xiaomi-token-plan-sgp | high | ✅ Authed |
| designer | `google/gemini-3.5-flash` | google | design | ✅ Authed |
| researcher | `opencode-go/deepseek-v4-flash` | opencode-go | fast | ✅ Authed |
| writer | `openrouter/mistralai/mistral-small-2603` | openrouter | writing | ✅ Authed |
| vision | `openrouter/google/gemma-3-12b-it` | openrouter | vision | ✅ Authed |
| sub | `opencode-go/mimo-v2.5` | opencode-go | fast | ✅ Authed |

### 2.2 Auth Status

**All 7 unique providers are authenticated** in `~/.local/share/mimocode/auth.json`:
- `deepseek`, `google`, `kimi-for-coding`, `minimax-coding-plan`, `opencode-go`, `openrouter`, `xiaomi-token-plan-sgp`

**Orphaned provider:** `xiaomi` (without suffix) is in auth.json but unused by any agent in bob.json. This is leftover config — can be cleaned up via `/disconnect` in the TUI.

**Auth mechanisms used:** All use API key (`api` type). `auth.json` also supports `oauth` and `wellknown` (key+token pair) but these are not used by the 10 Bob agents.

### 2.3 Code-Level Model Validation

**Finding: No validation exists at config load time.**

- `src/plugin/bob/config/index.ts` — merges models from bob.json into agent config with **no validation** of provider existence, model slug format, or `recommended` enum.
- `src/cli/cmd/github.ts:720` — validates `<provider>/<model>` format (regex), but only for a GitHub-related command, not globally.
- `src/plugin/bob/shared/types.ts:43` — `recommended` is typed as `string`, not constrained to an enum.

**Risk:** A typo in `bob.json` (e.g. `deeepseek/deepseek-v4-pro`) only surfaces as a runtime API error, not at startup. A missing provider key in auth.json produces a cryptic error when the agent first tries to call the LLM.

### 2.4 Recommended Fixes

1. Add a `loadConfig()` post-step that checks each model's provider exists in `auth.json` and warns on mismatch
2. Constrain `recommended` to a union type: `"high" | "middle" | "xhigh" | "fast" | "design" | "writing" | "vision"`
3. Validate model slug format (`<provider>/<model>`) at config load time

---

## 3. Tools — Integration & Verification

### 3.1 Tool Status Summary

| # | Tool | Type | Integration Method | Status | Notes |
|---|------|------|-------------------|--------|-------|
| 1 | **memory** | 🟢 Builtin Effect service | SQLite FTS5 via Effect Service (`src/tool/memory.ts`, `src/memory/service.ts`) | ✅ **Working** | BM25 ranking, 7 results for test query |
| 2 | **webfetch** | 🟢 Builtin Effect tool | `HttpClient.HttpClient` + TurndownService (`src/tool/webfetch.ts`) | ✅ **Working** | Registered in tool registry, permission-gated |
| 3 | **sequential-thinking** | 🟢 MCP (local) | `npx @modelcontextprotocol/server-sequential-thinking` via stdio (`bob/mcp/registry.ts:18-24`) | ✅ **Working** | Downloads on demand via npx |
| 4 | **grep_app** | 🟢 MCP (remote) | `https://mcp.grep.app` via StreamableHTTP (`bob/mcp/registry.ts:25-30`) | ✅ **Reachable** | HTTP 405 (expected without proper MCP request) |
| 5 | **agent-browser** | 🟢 Bob plugin | `execSync('agent-browser <cmd>')` in 14 tools (`bob/tools/agent-browser/index.ts`) | ✅ **Working** | v0.27.0 installed globally |
| 6 | **firecrawl** | 🟡 CLI skill | `firecrawl search/scrape/map` via bash (`bob/skills/firecrawl-cli/SKILL.md`) | ✅ **Working** | v1.16.2 installed, API key set |
| 7 | **context7** | 🟡 CLI/HTTP skill | `npx @upstash/context7` or `curl context7.com/api` (`bob/skills/context7/SKILL.md`) | ⚠️ **NPM 404** | Package name may differ; HTTP fallback works |
| 8 | **compression** | 🟢 Hono middleware | `compress()` from `hono/compress` (`src/server/middleware.ts:12,85`) | ✅ **Auto** | Standard HTTP gzip/br |
| 9 | **MCP framework** | 🟢 Core system | `@modelcontextprotocol/sdk` with 3 transports (`src/mcp/index.ts`, 944 lines) | ✅ **Full** | Stdio, HTTP, SSE + OAuth |

### 3.2 Tool Details

#### memory (builtin)
- **Location:** `src/tool/memory.ts` (81 lines), `src/memory/service.ts` (144 lines), `src/memory/fts.sql.ts` (19 lines)
- **How:** SQLite FTS5 virtual table (`memory_fts`) with BM25 ranking. Reads `.md` files from `~/.local/share/mimocode/memory/`. Supports 4 scopes: `global`, `projects`, `sessions`, `cc` (Claude Code).
- **Score floor:** 0.15 (filters noise)
- **CC integration:** `memory.cc_index` config flag (default false) — when enabled, indexes Claude Code memory files

#### webfetch (builtin)
- **Location:** `src/tool/webfetch.ts` (199 lines)
- **How:** Effect's `HttpClient.HttpClient` → HTML → TurndownService → Markdown. 5MB max, 30s timeout. Cloudflare bypass (retry with honest UA on 403). Permission-gated (ask/allow/deny per agent).
- **Config:** `tools.webfetch.permission` in bob.json

#### agent-browser (Bob plugin)
- **Location:** `src/plugin/bob/tools/agent-browser/index.ts` (198 lines), registered in `bob/index.ts:77`
- **How:** 14 tools wrapping `execSync('agent-browser <subcommand>')` with 30s timeout. Synchronous blocking call.
- **Installed version:** 0.27.0 (global npm)
- **Concern:** `execSync` blocks the Node.js event loop — could be a bottleneck during concurrent agent use

#### firecrawl (CLI skill)
- **Location:** `src/plugin/bob/skills/firecrawl-cli/SKILL.md`
- **How:** CLI commands (`firecrawl search`, `firecrawl scrape`, `firecrawl map`) invoked via bash tool
- **Installed version:** 1.16.2 (global npm)
- **Auth:** `FIRECRAWL_API_KEY` from `bob.env` (set: ✅)

#### context7 (CLI/HTTP skill)
- **Location:** `src/plugin/bob/skills/context7/SKILL.md`
- **How:** `npx @upstash/context7@latest resolve <library>` or `curl https://context7.com/api/v1/...` — deliberately **not** an MCP server anymore
- **NPM 404:** The package `@upstash/context7@latest` returned 404 on npm. May need a different package name or the HTTP fallback path. SKILL.md already documents the curl fallback.
- **Auth:** `CONTEXT7_API_KEY` from `bob.env` (set: ✅) — but tool works unauthenticated per the skill docs

#### sequential-thinking (MCP local)
- **Location:** `src/plugin/bob/mcp/registry.ts:18-24`, `bob/config/index.ts:13`
- **How:** Spawned as child process via `StdioClientTransport`. Command: `npx -y @modelcontextprotocol/server-sequential-thinking`. 120s timeout.
- **Not locally installed:** This is expected — it's fetched on demand by npx when the MCP server starts.

#### grep_app (MCP remote)
- **Location:** `src/plugin/bob/mcp/registry.ts:25-30`
- **How:** Remote MCP via `StreamableHTTPClientTransport` to `https://mcp.grep.app`. 60s timeout.
- **Reachable:** HTTP 405 returned (expected — MCP uses POST, not GET)

#### Compression
- **Location:** `src/server/middleware.ts` (lines 12, 85)
- **How:** Standard `compress()` middleware from `hono/compress`. Auto gzip/brotli/deflate for HTTP responses.

### 3.3 Recommended Tool Fixes

1. **context7 NPM package** — Investigate correct package name. The skill file references `@upstash/context7` which returns 404. If the package was renamed or is unpublished, update SKILL.md. The HTTP fallback (`curl context7.com`) still works.
2. **agent-browser blocking** — Consider replacing `execSync` with `exec` / `ChildProcess` from Effect to avoid event loop blocking during browser operations.
3. **grep_app MCP timeout** — 60s timeout may be tight for slow network. Consider making it configurable.

---

## 4. What Works Well

### Architecture
- **Effect TS v4 beta adoption** is thorough — 65+ services via `Layer.effect`, `Context.Service`, `Effect.fn`, `ScopedCache`, `InstanceState`
- **Subagent system** (`actor/`) with lifecycle tracking, inbox messaging, and return-header validation is well-designed
- **MCP framework** supports 3 transport types (stdio, HTTP, SSE) + OAuth — production-ready
- **Memory system** with SQLite FTS5, BM25 ranking, and multi-scope indexing is sophisticated
- **Conditional platform imports** (`#db`, `#pty`, `#hono`) via bun `imports` — clean platform abstraction

### Code Quality
- **Typecheck passes** with `tsgo --noEmit` — zero errors across 111K lines
- **319 test files** covering actor, tool, session, workflow, plugin, and other modules
- **Modern Effect patterns** — `Effect.fn`, `ScopedCache`, `Instance.bind`, `Effect.cached` — used consistently
- **Migration system** (34 migrations) with proper schema evolution tracking
- **Bun workspaces + catalog** for dependency version pinning

### Bob Fork Specific
- **BOB-VERIFY.md** is comprehensive and actionable (12-point checklist)
- **`bob.json` + `bob.env`** separation of model config vs. secrets is clean
- **`run-bob.sh`** with `--isolated` mode is useful for testing
- **`AGENTS.md`** (opencode) contains clear Effect coding guidelines
- **Tool registration** in Bob plugin is well-organized (tools/ dir with per-tool modules)

---

## 5. What Needs Fixing

### 🔴 Critical

| Issue | Location | Details |
|-------|----------|---------|
| **Duplicate `makeRuntime`** | `src/effect/runtime.ts:5` + `src/effect/run-service.ts:38` | Two separate `makeRuntime` definitions. `runtime.ts` appears to be legacy. 2 files import from the wrong one. |
| **No provider validation at startup** | `src/plugin/bob/config/index.ts` | A typo in bob.json model name only fails at runtime, not during config load |

### 🟡 High

| Issue | Location | Details |
|-------|----------|---------|
| **`any` type proliferation** | 155 occurrences across src/ | Top: `provider/provider.ts` (18), `util/log.ts` (11), `plugin/github-copilot/copilot.ts` (10), `provider/transform.ts` (8), `util/effect-zod.ts` (7) |
| **src/session/prompt.ts too large** | 3,355 lines | Largest file in the project. Candidate for modularization. |
| **agent-browser uses `execSync`** | `bob/tools/agent-browser/index.ts` | Blocks event loop during 30s timeout |
| **No lint script defined** | `package.json` | `oxlint` is configured (`.oxlintrc.json`) but no `lint` npm script |

### 🟢 Medium

| Issue | Location | Details |
|-------|----------|---------|
| **context7 NPM 404** | `bob/skills/context7/SKILL.md` | `@upstash/context7` package not found on npm |
| **43 TODO/FIXME/HACK/XXX occurrences in 28 files** | Various | 11 of them in `src/installation/index.ts` |
| **`recommended` field untyped** | `src/plugin/bob/shared/types.ts:43` | Should be a union type, not `string` |
| **Orphaned `xiaomi` provider** | `auth.json` | Authenticated but unused by any bob.json agent |
| **No barrel-file lint rule enforced** | `AGENTS.md` says no barrels but not lint-enforced | Multi-sibling dirs may accumulate `index.ts` |

---

## 6. What Could Be Better

### Performance
- **MemoMap** (`src/effect/memo-map.ts`) uses `Layer.makeMemoMapUnsafe()` with no size limit or TTL — unbounded growth risk
- **Session compaction** exists but isn't profiled — check if `session/compaction.ts` fires often enough
- **agent-browser `execSync`** blocks the event loop — consider async `ChildProcess` via Effect

### Developer Experience
- **No lint npm script** — `.oxlintrc.json` exists but there's no `bun lint` command
- **No `prepare` hooks beyond Effect language service** — consider pre-commit lint/typecheck
- **`src/session/` has 41 files** — largest module, but this is by design (multi-sibling no-barrel pattern)

### Architecture
- **Zod vs Effect Schema** — `zod` used extensively but Effect Schema is also available (`Schema.Class`). The `AGENTS.md` says to use Schema, but migration isn't complete. `src/util/effect-zod.ts` explicitly papered over a missing Effect Schema feature with a "TODO".
- **Config has 3 sources** — `Flag`, `Env`, `Config` modules. The `bob.json` adds a 4th. A single hierarchical config (defaults < env < config file < CLI) would reduce confusion.
- **Provider abstraction** — `src/provider/provider.ts` (1,787 lines) + `src/provider/transform.ts` (1,322 lines) are very large. The 18+ AI SDK providers create combinatorial complexity.

### Testing
- **No integration tests** for session lifecycle or checkpoint writer
- **319 test files** exist but they're unit tests — no e2e tests for the full agent loop
- **No CI integration** visible in the repo (`.github/` exists but wasn't profiled in detail)

### Bob-Fork Specific
- **Agent prompts** (`src/agent/prompt/`) list tools that don't all work by default (context7 NPM 404)
- **`run-bob.sh`** prints auth status but doesn't warn on missing providers — could be more proactive
- **No automated smoke test** that verifies all 10 agents can be created from config

---

## 7. Priority Actions

| Priority | Action | Effort | Impact | Details |
|----------|--------|--------|--------|---------|
| P1 | **Remove duplicate `makeRuntime`** | 1h | Medium | Consolidate into `run-service.ts`, update 2 imports from `runtime.ts` |
| P2 | **Add provider validation in `loadConfig()`** | 2h | High | Check each model's provider against `auth.json` at startup |
| P3 | **Type `recommended` as union** | 30m | Low | `"high" | "middle" | "xhigh" | "fast" | "design" | "writing" | "vision"` |
| P4 | **Fix context7 NPM package name** | 1h | Medium | Investigate correct package or remove npx path, keep curl fallback |
| P5 | **Convert agent-browser to async** | 4h | Medium | Replace `execSync` with Effect `ChildProcess` |
| P6 | **Decompose `session/prompt.ts`** | 8h | High | Split 3,355 lines into domain modules |
| P7 | **Reduce `any` types in top 5 files** | 4h | Medium | Replace with `unknown` + type guards per AGENTS.md guidance |
| P8 | **Add `bun lint` script** | 1h | Low | Wire up `.oxlintrc.json` as a runnable script |
| P9 | **Clean up orphaned `xiaomi` provider** | 10m | Low | `/disconnect` in TUI |
| P10 | **Address critical TODOs** | 2h | Medium | `tool.ts:13` hack, `effect-zod.ts` Schema feature gap |

---

## 8. Bob Fork — Specific Observations

### What's Unique About This Fork

1. **Bob orchestrator** — `packages/opencode/src/plugin/bob/` is the entire Bob plugin: config, tools, MCP registry, skills, and shared types. None of this exists in upstream OpenCode.
2. **10-agent team** — Specialized agents (bob, coder, strategist, manager, critic, designer, researcher, writer, vision, sub) with per-agent model config in `bob.json`
3. **CLI skills** — firecrawl and context7 as on-demand CLI/HTTP skills (not MCP servers) — deliberate architecture choice for reliability and cost
4. **`run-bob.sh`** entry point — sources `bob.env`, counts models from `bob.json`, checks auth before booting
5. **`BOB-VERIFY.md`** — 12-point verification checklist covering all Bob-specific features

### Architecture Decisions

- **context7 removed from MCP** — was an always-on MCP server; converted to on-demand CLI/HTTP. The comment in `mcp/registry.ts` says: "context7 was removed from MCP — it's now loaded as a skill on demand."
- **Only 2 MCP servers** — `sequential-thinking` (local) and `grep_app` (remote). This is deliberate minimalism.
- **firecrawl as CLI, not SDK** — Unlike webfetch which is a builtin tool, firecrawl goes through the bash tool → firecrawl CLI. This gives access to `firecrawl map` and `firecrawl scrape` which the SDK might not expose.
- **bob.json as single model source** — No code defaults for models. The config file is the ONLY source, preventing drift between config and actual models.

### Files That Are Bob-Fork Specific

| File | Purpose |
|------|---------|
| `bob.json` | Per-agent model definitions |
| `bob.env` | Skill API keys (gitignored) |
| `run-bob.sh` | Fork launcher with auth check |
| `BOB-VERIFY.md` | Verification checklist |
| `src/plugin/bob/` | Full Bob plugin (config, tools, MCP, skills) |
| `src/plugin/bob/config/index.ts` | Bob config loader |
| `src/plugin/bob/mcp/registry.ts` | MCP server registrations |
| `src/plugin/bob/tools/` | Bob-specific tools (agent-browser) |
| `src/plugin/bob/skills/` | CLI skills (firecrawl-cli, context7) |
| `src/plugin/bob/shared/` | Shared types for Bob plugin |

### Potential Bob-Specific Issues

1. **`bob.json` changes don't hot-reload** — if a user edits `bob.json` while the TUI is running, the agent config won't reflect the change until restart. Consider adding file watching.
2. **No `bob.json` schema validation** — a JSON Schema file (`bob.schema.json`) would give editor autocomplete and validation.
3. **Agent prompt quality varies by model** — the cheap models (`opencode-go/mimo-v2.5` for `sub`, `opencode-go/deepseek-v4-flash` for `manager`) may produce lower-quality tool calls. Consider adding per-agent model benchmarks.
4. **`CONTEXT7_API_KEY` is set in env but not always used** — the SKILL.md says the HTTP fallback works without auth, so the key may be unnecessary. Verify if it's still required.

---

## 9. Data Sources

All data collected on 2026-06-14 during parallel agent execution:

| Source | Agent | Method |
|--------|-------|--------|
| Repo structure | researcher-1 | Directory reads, package.json scan |
| Model config | sub-5 | `bob.json` + `auth.json` read |
| Tool integrations | sub-6 | Grep of entire `src/` for each tool name |
| Code quality metrics | sub-7 | `wc -l`, `rg`, `find`, `bun typecheck` |
| `any` count methodology | sub-7 | Union of `: any`, `as any`, `<any>`, `any[]` via `rg --vimgrep` + `sort | uniq` |
| Tool verification | sub-8 | Actual CLI invocation, curl, memory query |
| Extra context | Self | `AGENTS.md`, `package.json`, `bob.env` reads |

---

*Generated by Manager agent (T12) as part of full repo analysis. File: `ANALYSIS_RECOMMENDATIONS.md`*
