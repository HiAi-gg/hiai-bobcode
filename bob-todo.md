# hiai-bob — Hardening & Completion Plan (2026-06-12)

> ⚠️ **HISTORICAL.** This file documents the pre-fork investigation era. The fork has been completed; active development follows `bob-plan.md §F`. Package references to `@opencode-ai/plugin` throughout this file are stale — the fork uses `@mimo-ai/plugin` (workspace).
>
> ⚠️ **DIRECTION PIVOTED (2026-06-13): hiai-bob is becoming a PRODUCT — a fork of XiaomiMiMo/MiMo-Code
> with our logic as a bundled first-party `BobPlugin`.** Authoritative docs now:
> `MIMO-FORK-INTEGRATION.md` (integration map) + `bob-plan.md §F` (fork plan). §R below remains the
> agent/orchestration SPEC (what to build); only the *delivery vehicle* changed from external plugin to
> fork-bundled plugin — and the completion loop is now a native `actor.postStop` hook, not hand-rolled.
>
> §R is the APPROVED feature spec; it supersedes §3 (WS-A…WS-H) and folds in §7 + §8. Older sections are
> evidence/rationale only.

---

## §R. REVISED PLAN (approved 2026-06-12) — "thin team layer on mimo, one real engine"

### R.0 Premise (why this rewrite)
MiMo (`opencode-ai@1.17.4`, the installed runtime) already provides, natively, almost everything
hiai-bob's hook layer reimplemented: reasoning-repair, model fallback + retry, auto-compaction,
context-limit handling, tool-pair repair, a persistent parent/child **task tree** with
checkpoints/progress, and a model-facing **memory** tool (FTS-indexed markdown). The native task
tree and memory are **NOT exposed to plugins** (no `task.*`/`memory.*` events or client API at
1.17.4 — only `session.*`, `message.*`, `todo.updated`). So hiai-bob must stop compensating and
become a **thin value layer**. Decisions taken with the user:
- **Agents:** keep the full 10-agent team (full control); strip only dead plumbing.
- **Autonomy:** todo-driven auto-continue with a safety cap.
- **Critic gate:** hard gate enforced by the completion loop (don't finish until Critic APPROVED;
  UI changes require a Vision browser pass).
- **Parallelism:** prompt-level (Strategist annotates, Bob/Manager dispatch parallel waves) — no
  custom scheduler; native `task` tool runs subagents concurrently.

### R.1 What hiai-bob IS (3 thin layers)
1. **Agents (10, roster unchanged):** Bob, Coder, Strategist, Manager, Critic, Researcher, Writer,
   Designer, Vision, Sub. Prompts use native memory (done) + the parallelism + loop discipline below.
2. **Tools:** keep agent-browser (visual Critic), LSP, glob/grep, session-manager, skill.
   **DELETE** the `background-task` tools.
3. **Hooks (slim, ~6):** the new `completion-controller` + `closure-injector`, `quality-gate`,
   `keyword-detector`, `non-interactive-env`*, `tool-output-truncator`* (*verify vs mimo first).
   DELETE everything else (§8 table + §7.4).

### R.2 CORE ENGINE — `completion-controller` hook (the only substantial new code)
Autonomy and the Critic gate are the **same** decision made on `session.idle`. One hook, one
per-orchestrator-session state machine.

```
state per session: { autoContinues, changedFiles[], lastReviewedFingerprint,
                     criticVerdict, blockerFlagged }

on session.idle (orchestrator/root session only):
  blockerFlagged                              -> STOP (yield to user)
  incomplete todos AND autoContinues < cap    -> client.session.prompt("continue")  ; autoContinues++
  todos done AND changes UNreviewed
       -> dispatch Critic via client.session.prompt(...)
          (REQUIRE Vision browser pass if any changedFile matches UI globs) ; do NOT stop
  todos done AND criticVerdict==APPROVED for current fingerprint AND !blocker -> STOP (done)
  autoContinues >= cap                        -> STOP + post summary (safety)
```

**Signals (all from the verified 1.17.4 plugin surface):**
- todos: native `todo.updated` event + todos list.
- changedFiles: `tool.execute.after` records `write`/`edit`/`apply_patch` paths per session;
  `fingerprint` = hash of the sorted changed-file set (or `git diff --stat` when in a repo).
- criticVerdict: detect a child session with `agent=critic` whose final CLOSURE has
  `readiness=accept`/`reject` (parse via the existing closure validator); bind it to the current
  `fingerprint` so new edits invalidate a stale APPROVED.
- UI trigger globs (config): `**/*.{svelte,tsx,jsx,vue,css,scss,html,astro}`.
- blockerFlagged: orchestrator emitted an explicit "needs user" marker (define a sentinel, e.g.
  CLOSURE `readiness=blocked` or a `<NEEDS-USER>` tag).

**Config block** (`src/config` + `hiai-bob.json`):
`completion: { enabled: true, max_auto_continues: 25, require_critic: true,
  ui_globs: [...], reset_on_user_message: true }`

**Guards / correctness:**
- A user message **resets** `autoContinues` and clears `blockerFlagged` (no runaway after the user
  interjects). Track via `message.updated` role=user.
- Cap is hard; on cap, STOP with a one-paragraph status summary, never silently spin.
- **Pre-req check:** verify mimo does not already auto-continue on idle (it has an
  `experimental.compaction.autocontinue` hook point — confirm scope). If mimo auto-continues, gate
  this controller so the two don't double-prompt.
- Only acts on the **root/orchestrator** session, never on sub-agent child sessions (avoid loops).
- Idempotency: ignore repeated idle events for the same unchanged state.

**Owner:** Coder (deep). New file `src/hooks/completion-controller.ts` (+ small helpers for
diff-fingerprint and critic-verdict detection). Replaces the stub `ralph-loop` + `todo-continuation`
+ `stop-continuation-guard` (delete those). Est. ~200–300 LOC — the one real engineering piece.

### R.3 PARALLELISM — prompt-level (Strategist annotates; Bob & Manager dispatch waves)
No scheduler code. The discipline lives in prompts:

- **Strategist** (`src/agents/strategist.ts`) — every plan step MUST be annotated with:
  - `wave: N` and `parallel: yes|no` (steps in the same wave with `parallel: yes` run concurrently),
  - `owner:` the executor agent (`coder | sub | designer | writer | researcher | vision | critic`),
  - `deps:` prior wave/step ids, `files:`, `risk:`.
  Plan-format example to embed:
  ```
  ## Steps
  - [W1] Build header component — owner: designer — parallel: yes — deps: none — files: [...] — risk: low
  - [W1] Add API route        — owner: coder    — parallel: yes — deps: none — files: [...] — risk: med
  - [W2] Wire header to route  — owner: sub      — parallel: no  — deps: W1   — files: [...] — risk: low
  - [W3] Review + visual check — owner: critic   — parallel: no  — deps: W2
  ```
  Rule: maximize `parallel: yes` within a wave; only serialize on real file overlap or data deps.
- **Manager** (`src/agents/manager.ts`) & **Bob** (`src/agents/bob.ts`) — add an explicit rule:
  **"Execute waves in parallel whenever possible."** Read the Strategist annotations; for each wave,
  fire ALL `parallel: yes` steps as concurrent `task()` calls to their annotated `owner` (up to
  `max_parallel`, default 5), then collect ALL before advancing to the next wave. Serialize only
  `parallel: no` steps or file-overlapping steps. Subs run in parallel the same way.
- **Owner:** Writer/Coder (prompt edits to strategist.ts, manager.ts, bob.ts). Pure prompt work.

### R.4 DELETIONS (fold in §7.4 + §8)
- `src/features/background-manager/` + `src/tools/background-task/` + their wiring in `src/index.ts`
  (constructor, `setClient`, `setBackgroundManager`, `dispose` calls, the 2 tool registrations) +
  the `background_manager` config block + the `background-notification` hook. (Dead code — `launch()`
  never called.)
- All mimo-native-duplicate hooks + all pure stubs per the §8 table (~28 files), incl.
  `reasoning-content-cache`, `thinking-block-validator`, `tool-pair-validator`, `model-fallback`,
  `runtime-fallback`, `session-recovery`, all `compaction-*`/`context-*`, `token-budget`,
  `edit-error-recovery`, `json-error-recovery`, `rules-injector`, `directory-agents-injector`,
  `think-mode`, and the pure stubs.
- After deletion, prune unused hook-point registrations in `src/index.ts` and `mergeHookSets` if a
  whole point loses all handlers.
- **CANCELLED from the old plan:** WS-A1 (reasoning — mimo native), WS-A3 + WS-D (BackgroundManager
  is dead, nothing to harden).

### R.4a 🔒 PRESERVE — DO NOT LOSE during deletions (hard guardrail)
The purge in R.4 only removes hooks + the dead BackgroundManager/background-task tools. It must NOT
touch any of the following. Verify each still works after the purge (build + a smoke run).
- **MCP servers** — keep only **grep_app** + **sequential-thinking**. (UPDATED 2026-06-13: **context7
  moved off MCP** → a CLI+skill, see below.)
- **context7** — library-docs lookup, migrated from MCP to a **CLI+skill** (`npx @upstash/context7` or
  curl + `CONTEXT7_API_KEY`, driven by a `context7` skill). Keep the capability; drop the MCP server.
- **firecrawl** — web-research **CLI** (`firecrawl-cli`), invoked via bash by Researcher; referenced
  in `src/agents/researcher.ts`. Keep the capability + the prompt reference. (Move `FIRECRAWL_API_KEY`
  out of `hiai-bob.json` into env — security — but do NOT drop the integration.)
- **Postgres work rules** — `POSTGRES_RULES` (`src/agents/prompt-library/postgres-rules.ts`), embedded
  in `bob.ts` + `coder.ts`. Keep verbatim.
- **Tools to keep:** `agent-browser` (visual Critic), `lsp/*`, `glob`, `grep`, `session-manager`, `skill`.
- **Bundled assets:** `skills/` (62), `design-systems/` (154) — keep.
- **Kept hooks:** `closure-injector`, `quality-gate` (biome), `keyword-detector`, and (after R.5
  verification) `non-interactive-env`, `tool-output-truncator`.
- **Net rule:** when in doubt, a tool/MCP/prompt-asset is PRESERVED. Only hooks listed in §8 and the
  dead BackgroundManager/background-task path are deleted. If an MCP/CLI key currently lives in
  `hiai-bob.json` `auth`, relocate it to env rather than deleting the integration.

### R.5 KEEP-LIST verification (don't assume)
Before keeping `non-interactive-env` and `tool-output-truncator`, confirm mimo doesn't already do
bash-interactivity guarding / tool-output truncation. Keep only if mimo lacks it. `closure-injector`,
`quality-gate` (biome), `keyword-detector` are hiai-bob-specific — keep.

### R.6 Workstreams (revised) & parallelization
| WS | What | Owner | Parallel-safe? |
|----|------|-------|----------------|
| **R-1** | `completion-controller` hook + config + helpers | Coder | own files — yes |
| **R-2** | Parallelism prompts (strategist/manager/bob annotations + wave dispatch) | Writer/Coder | own files — yes |
| **R-3** | Deletions (BackgroundManager, background-task tools, §8 hooks) | Coder | touches `index.ts`/`hooks/index.ts` — **integrator only** |
| **R-4** | Keep-list verification (non-interactive-env, tool-output-truncator vs mimo) | Strategist→Coder | yes |
| **R-5** | Tests (completion-controller state machine) + README/config truth-up | Coder/Writer | yes |
- Serialize `src/index.ts` + `src/hooks/index.ts` + `README.md` through one integrator (R-3 owns the
  big deletions; R-1 adds one registration). Everything else is independent files.
- Order: R-1 + R-2 (parallel) → R-3 deletions → R-4 keep-check → R-5 tests/docs. Smoke test: a
  multi-wave task on a mimo model runs parallel waves, auto-continues until todos done, and will not
  finish until Critic APPROVED (with a forced Vision pass on a UI change).

### R.7 Definition of done (revised)
- [ ] One `completion-controller` delivers: todo-driven auto-continue (capped) + hard Critic gate
      (APPROVED-on-current-diff, forced Vision browser pass on UI changes) + user-message reset.
- [ ] Strategist plans carry `wave/parallel/owner/deps`; Bob & Manager dispatch parallel waves.
- [ ] BackgroundManager + background-task tools + ~28 redundant hooks deleted; hooks ≈6.
- [ ] Kept hooks verified as non-redundant vs mimo; typecheck + build green; README matches reality.
- [ ] §R.4a PRESERVE list intact: context7/grep_app/sequential-thinking MCP, firecrawl CLI,
      POSTGRES_RULES, agent-browser/LSP/glob/grep/session-manager, skills/ + design-systems/ — all
      still wired and working after the purge.

---

## 0. How to work in this repo (READ FIRST)

- **Plugin loads from `dist/index.js`** (`package.json#main`). After any `src/` change you must
  `bun run build` and restart OpenCode for it to take effect. There is no hot reload.
- **Commands** (from `projects/hiai-bob/`):
  - Build: `bun run build` (`bun build src/index.ts --outdir dist --target bun`) — **not minified**.
  - Typecheck: `bun run typecheck` (`bun x tsc --noEmit`).
  - Lint: `bun run lint` / `bun run lint:fix` (Biome).
  - Tests: `bun test` — **there is essentially no test suite yet** (1 file: `qa/lsp/server-definitions.test.ts`). See WS-E.
- **Hook contract**: every hook is a `(config: HiaiBobConfig) => HookSet` factory, registered by name
  in `src/hooks/index.ts` (`ALL_NAMED_HOOK_FACTORIES`). `mergeHookSets` fans multiple handlers per
  hook-point and **swallows their throws** (`console.error` only) — so a hook that needs to *block*
  by throwing will NOT block from inside the merged chain. Enforcement that must abort an action has
  to use the mechanism that actually stops it (native `permission`/`tools` via `config()`, or mutate
  `output.args` before execution). Keep this in mind for WS-C.
- **OpenCode part model** (critical, several current hooks get this wrong): assistant message parts
  use `type: "text" | "reasoning" | "tool"` (a `tool` part carries `state.status`). There is **no**
  `tool_use` / `tool_result` / `thinking`(unsigned) part type on the OpenAI-compatible path. The
  runtime builds outgoing `reasoning_content` **only** from a `{type:"reasoning"}` part — an
  `info.reasoning_content` field is ignored. (Verified against the runtime bundle; this is the root
  of the v0.2.9 fix.)
- **Landmines**:
  1. `projects/` is gitignored in the monorepo; hiai-bob is **not yet its own git repo** — `git`
     here resolves to the parent. Decide repo strategy before tagging anything (see WS-H).
  2. `@opencode-ai/plugin` is pinned `^1.14.46`; runtime is **1.17.1**. Align before relying on
     1.17-only fields (WS-H).
  3. `mergeHookSets` swallows hook errors — never rely on a thrown error propagating out of a hook.
  4. Many hooks today only `console.log` their intent. Don't trust a hook name; read its body.

---

## 1. Current state (snapshot)

- **4,327 LOC / 70 files.** Entry `src/index.ts` (180L), 10 agents, 36 hook factories, real tools
  (LSP, agent-browser, session-manager, glob/grep, background-task), single `BackgroundManager` (285L).
- **Genuinely good** (leave alone unless a task says otherwise):
  - `src/index.ts` DI/wiring; `config()` native agent `permission`/`tools` enforcement; hides
    built-in Build/Plan/Compose.
  - `src/features/background-manager/index.ts` — one completion path (poll → `session.status()` →
    fetch → notify), circuit breaker, concurrency, stale timeout, spawn budget.
  - Tools under `src/tools/**` — real implementations.
  - Agent prompts under `src/agents/**` (keys: `bob, coder, strategist, manager, critic,
    researcher, writer, designer, vision, sub`).
- **Not good** (this plan): ~half the hooks are placeholders; the three v0.2.9 fixes are absent;
  a couple of hooks are dead due to wrong part types; README overstates readiness.

---

## 2. Hook inventory — real / stub / dead (all 36)

Classification from reading every hook body. "STUB" = only `console.log`s its intent, no behavior.

| Hook file | Status | Note |
|---|---|---|
| `closure-injector.ts` | REAL | injects CLOSURE schema, validates via `shared/closure.ts` |
| `quality-gate.ts` | REAL (warn-only) | appends warning to bash output on lint/tsc errors; does not block |
| `keyword-detector.ts` | REAL | injects mode prompt for ultrawork/search/analyze |
| `non-interactive-env.ts` | REAL | rewrites interactive bash cmd → echo (actual enforcement via `output.args`) |
| `runtime-fallback.ts` | REAL (blunt) | caps `maxOutputTokens` to 32k |
| `think-mode.ts` | REAL (blunt) | force-enables thinking budget 10k always — no gating |
| `tool-output-truncator.ts` | REAL | truncates tool output > MAX_LEN |
| `compaction-context-injector.ts` | REAL (trivial) | pushes a context line on compact |
| `compaction-todo-preserver.ts` | REAL (trivial) | pushes "preserve TODO" line on compact |
| `context-window-monitor.ts` | REAL (trivial) | pushes system note when system text large |
| `edit-error-recovery.ts` | REAL | appends hint on "oldString not found" |
| `json-error-recovery.ts` | REAL | appends hint on JSON parse error |
| `rules-injector.ts` | REAL (trivial) | pushes "follow AGENTS.md" system line |
| `directory-agents-injector.ts` | REAL (trivial) | pushes a system line |
| `agent-usage-reminder.ts` | REAL (trivial) | appends reminder after non-task tools |
| `thinking-block-validator.ts` | PARTIAL | only patches empty `thinking` strings; lost the signed-thinking↔tool pairing logic |
| `write-existing-file-guard.ts` | PARTIAL | tracks reads but only `console.log`s on violation — does NOT block |
| `tool-pair-validator.ts` | **DEAD** | matches `tool_use`/`tool_result` — wrong types; OpenCode uses `tool`. Never fires |
| `reasoning-content-cache.ts` | **NO-OP** | only sets `_preserved=true`. The v0.2.9 crash is unfixed here |
| `model-fallback.ts` | STUB | logs "switching to fallback model"; does not switch |
| `session-recovery.ts` | STUB | logs "retrying"; does not retry |
| `mempalace-auto-save.ts` | STUB | logs "triggering persistence"; saves nothing |
| `token-budget.ts` | STUB | logs "high message count"; no budgeting |
| `sub-agent-receipt.ts` | STUB | logs "checking completion" |
| `manager-guard.ts` | STUB | logs subagent-idle |
| `todo-continuation.ts` | STUB | logs "checking incomplete tasks" (has cooldown map, no action) |
| `background-notification.ts` | STUB | logs |
| `sub-notepad.ts` | STUB | logs |
| `unstable-agent-babysitter.ts` | STUB | logs |
| `context-window-limit-recovery.ts` | STUB | logs |
| `start-work.ts` | STUB | logs |
| `stop-continuation-guard.ts` | STUB | logs; clears nothing real |
| `session-notification.ts` | STUB | logs every event |
| `ralph-loop.ts` | STUB | logs "checking for DONE" |
| `preemptive-compaction.ts` | STUB | logs over threshold |
| `session-todo-status.ts` | EMPTY | returns `{}` |

**Tally:** ~15 real (several trivial/warn-only), 2 broken (dead/no-op), ~18 stub/empty, plus
`reasoning-content-cache` no-op. Net: advertised feature set ≫ actual behavior.

---

## 3. Workstreams  — ⚠️ SUPERSEDED by §R (kept for rationale; WS-A1/A3/D are CANCELLED)

Priorities: 🔴 blocker (will crash / data-loss), 🟠 high (regression vs hiai-opencode), 🟡 medium
(quality/honesty), ⚪ low. Each task lists **Conflicts** = files multiple tasks touch (serialize those).

### WS-A 🔴 — Port the three proven crash fixes  *(agent: Coder — deep)*
Single owner; this is the gate before hiai-bob is safe to use with reasoning models + delegation.

- **A1 — reasoning_content tool-call guarantee.**
  - **Where:** replace `src/hooks/reasoning-content-cache.ts` (currently no-op).
  - **How:** PORT FROM `/mnt/ai_data/projects/hiai-opencode/src/hooks/reasoning-content-cache/hook.ts`
    (the v0.2.9 version). Operate at the **parts** layer: for every assistant message that has a
    `tool` part and no non-empty `{type:"reasoning"}` part, inject one (restored from a small
    session-scoped cache if available, else neutral placeholder). Gate to unsigned-reasoning
    sessions only; never touch Anthropic signed-thinking. hiai-bob has no `reasoningContentCache`
    singleton yet — either port a trimmed `src/shared/reasoning-content-cache.ts` (capture by
    id+index, TTL) or inline a per-session `Map`. Keep it self-contained.
  - **Acceptance:** unit test (WS-E) proving a tool-call assistant msg without reasoning gets a
    non-empty reasoning part; signed-thinking history untouched; non-reasoning session untouched.
    Manual: GLM/z.ai delegation no longer 400s with "reasoning_content is missing ... at index N".
  - **Conflicts:** `src/hooks/index.ts` is already wired for this name — no registry change needed.

- **A2 — runtime stream-teardown guard.**
  - **Where:** new `src/shared/runtime-stream-teardown-guard.ts` + one call at the top of the plugin
    factory in `src/index.ts`.
  - **How:** PORT FROM `/mnt/ai_data/projects/hiai-opencode/src/shared/runtime-stream-teardown-guard.ts`.
    `installRuntimeStreamTeardownGuard()` registers a `process.on("unhandledRejection")` that swallows
    only the benign `ERR_STREAM_DESTROYED` / "write after a stream was destroyed" race and re-throws
    everything else; idempotent via a `globalThis` flag. Call it as the first statement inside
    `HiaiBobPlugin`.
  - **Acceptance:** delegating to a sub-agent that ends/aborts no longer kills the parent with
    "Worker has been terminated". Guard logs (not throws) the benign case.
  - **Conflicts:** `src/index.ts` (also touched by A3, WS-D) → A-agent owns index.ts edits; others
    rebase onto it.

- **A3 — defer parent completion while descendants run.**
  - **Where:** `src/features/background-manager/index.ts`, `poll()` (the `idle/completed` branch,
    ~L210) and `notifyParent`.
  - **How:** before marking a task `completed` on idle, check whether this task's session still has
    **running descendants**. hiai-bob tracks `rootDescendantCounts` by parent session — add a guard:
    if `getRunningTasks().some(t => t.parentSessionID === task.sessionID)` (or a proper descendant
    walk), keep the task `running` and re-poll next tick instead of completing/aborting. Mirror
    hiai-opencode's `hasPendingDescendantTasks` deferral (PR #3). Ensure stale-timeout still breaks
    deadlocks.
  - **Acceptance:** Bob→Manager→children: Manager is not reported complete (and its session not
    aborted) until children finish; no deadlock when children error/timeout.
  - **Conflicts:** `background-manager/index.ts` (also WS-D). A owns it first; WS-D rebases.

### WS-B 🟡 — Hook triage: implement-or-delete the stubs  *(agent: Strategist plans → Coder/Sub execute)*
The 18 stubs make the plugin look done while doing nothing. For **each** stub decide: (a) implement
real behavior, (b) delete the file + its line in `ALL_NAMED_HOOK_FACTORIES` + the README row, or
(c) keep as intentional no-op with a `// INTENTIONAL NO-OP: <why>` comment. Output a decision table
first (Strategist), then execute (Coder/Sub).

- **B-plan (Strategist):** produce the per-stub decision table. Default recommendation:
  - **Delete** (no clear value as-is): `background-notification`, `sub-notepad`,
    `unstable-agent-babysitter`, `session-notification`, `start-work`, `session-todo-status`,
    `directory-agents-injector` (or merge into `rules-injector`).
  - **Implement** (real value, see WS-G): `model-fallback`, `session-recovery`, `token-budget`,
    `mempalace-auto-save`, `todo-continuation`, `ralph-loop`, `stop-continuation-guard`,
    `context-window-limit-recovery`, `preemptive-compaction`, `manager-guard`, `sub-agent-receipt`.
- **B-exec:** apply deletions. **Conflicts:** every deletion edits `src/hooks/index.ts` and
  `README.md` → route ALL registry/README edits through a single **integrator** (see §4) to avoid
  merge churn; implementation of the "keep" set is WS-G.

### WS-C 🟡 — Fix the broken/misleading real hooks  *(agent: Coder)*  — parallel-safe (distinct files)
- **C1 `tool-pair-validator.ts`** — replace `tool_use`/`tool_result` logic with OpenCode's real
  model: detect a `tool` part whose `state.status` is pending/incomplete with no following result,
  and repair per the runtime's expectations (PORT the orphaned-tool handling from hiai-opencode's
  `tool-pair-validator`). If repair isn't needed at the parts layer in 1.17, **delete it** (dead code).
- **C2 `write-existing-file-guard.ts`** — today warn-only. Decide: enforce (mutate/deny via the
  mechanism that actually blocks — note `mergeHookSets` swallows throws, so blocking must happen by
  returning a rejecting `output` per OpenCode's `tool.execute.before` contract, or drop the claim).
  Align README ("violations throw immediately" is currently false).
- **C3 `thinking-block-validator.ts`** — either restore the real signed-thinking↔tool pairing
  (PORT from hiai-opencode `src/hooks/thinking-block-validator/hook.ts`) or narrow its README claim
  to "patches empty thinking blocks".
- **C4 `think-mode.ts`** — it force-enables a 10k thinking budget unconditionally; gate by agent/model
  capability so non-reasoning models aren't sent a thinking param (can itself cause provider 400s).
  **Conflicts:** none between C1–C4 (separate files); none with WS-A except shared `index.ts`/README.

### WS-D 🟠 — Completion robustness  *(agent: Coder — must run AFTER WS-A3)*
- **Where:** `src/features/background-manager/index.ts`, `poll()`.
- **How:** completion currently trusts only `session.status() === "idle"|"completed"`. Add an
  `isSessionComplete(messages)` guard before finalizing (PORT the predicate from hiai-opencode
  `sync-session-poller.ts`): terminal finish reason not in `["tool-calls","unknown"]`, no pending
  tool parts, `lastUser.id < lastAssistant.id`. Avoids premature "completed" between tool steps.
- **Acceptance:** task not completed while last assistant turn ended on a tool-call or has pending
  tool parts. **Conflicts:** same file as A3 → strictly sequence after A3.

### WS-E 🔴(infra) — Test harness + tests for the fixes  *(agent: Coder — parallel with A, feeds it)*
- **Where:** new `src/**/**.test.ts` (Bun test). Repo has effectively zero tests.
- **How:** add `"test": "bun test"` usage to CI later (WS-H). Write unit tests for: A1 (reasoning
  guarantee — port the 6-case contract from hiai-opencode `hook.test.ts`), A3/D (completion
  deferral + isSessionComplete), C1 (tool-pair on real `tool` parts). Pure-function tests where
  possible (extract logic from hooks so it's testable without the OpenCode client).
- **Acceptance:** `bun test` green; the A1 contract test fails against the current no-op and passes
  after A1. **Conflicts:** none (new files), but coordinate symbol names with WS-A.

### WS-G 🟡 — Implement the high-value stubs for real  *(MANY parallel agents — one hook each)*
Each is an independent file → ideal fan-out. Assign one agent per hook. PORT the corresponding
hiai-opencode implementation, trimmed to hiai-bob's `HookSet`. Suggested owners in parens.
- `model-fallback.ts` (Coder) — real fallback chain on 429/503/rate_limit: pick next model, set
  pending fallback, auto-continue. PORT from hiai-opencode `model-fallback` + `message-updated`.
- `session-recovery.ts` (Coder) — actually retry empty/no-response turns (bounded).
- `token-budget.ts` (Sub) — track context size, trigger compaction/trim past threshold (not just log).
- `mempalace-auto-save.ts` (Coder) — persist memory on idle if MemPalace MCP enabled; **fail-loud**
  (log error, never silently drop) per the WS-4 lesson in hiai-opencode.
- `todo-continuation.ts` (Sub) — on idle with incomplete todos, actually re-prompt (respect cooldown).
- `ralph-loop.ts` / `stop-continuation-guard.ts` (Coder) — implement the DONE-sentinel loop + stop guard.
- `manager-guard.ts` / `sub-agent-receipt.ts` (Coder) — real delegation receipts (ties into A3).
- `context-window-limit-recovery.ts` / `preemptive-compaction.ts` (Sub) — real recovery/compaction.
**Conflicts:** each hook file is independent → safe in parallel. Shared touch points: none except
the registry (already wired) — no `index.ts` change needed since names exist. Do NOT let two agents
edit the same file.

### WS-F ⚪ — Truth-up README & docs  *(agent: Writer — LAST, after B/C/G land)*
- Fix the comparison table (don't imply parity), correct the "tool.execute.before throws" claim,
  list which hooks are real vs optional, drop rows for deleted hooks. Depends on final hook set.

### WS-H ⚪ — Repo & release hygiene  *(agent: Coder)*
- Decide git strategy (hiai-bob is currently inside gitignored `projects/`; either its own repo like
  `vlgalib/crypto`, or tracked). Add CI mirroring hiai-opencode (typecheck → test → build → bundle-size).
- Align `@opencode-ai/plugin` to `^1.17.x` to match runtime; rebuild; verify no API drift.
- Add a bundle-size guard if publishing.

---

## 4. Parallelization plan (who runs with whom)

**Dependency graph:**
```
WS-A (A1,A2,A3) ──┐
WS-E (tests)  ────┼─► WS-D (needs A3) ─► (merge)
WS-C (C1..C4) ────┤
WS-G (per-hook) ──┘
WS-B-plan ─► WS-B-exec ─► WS-F (README)   ─► WS-H
```

**Safe to run fully in parallel (distinct files, no shared writes):**
- A1 (`reasoning-content-cache.ts` + new shared cache)
- A2 (new `runtime-stream-teardown-guard.ts`; index.ts edit owned by A-agent)
- Each WS-G hook (one agent per file)
- Each WS-C hook (C1–C4 separate files)
- WS-E test files (new files)

**Must serialize (shared-file hotspots — assign a single integrator):**
- `src/hooks/index.ts` — only the **integrator** edits it (deletions from WS-B). All others leave it alone (names already registered).
- `src/index.ts` — owned by WS-A (A2 guard install). WS-H rebases onto it.
- `src/features/background-manager/index.ts` — A3 first, then WS-D. Never both at once.
- `README.md` — WS-F only, last.
- `src/shared/types.ts`, `src/config/index.ts` — if a WS-G hook needs new config keys, funnel through the integrator.

**Recommended worktree layout** (use `git worktree` / isolated copies so parallel agents don't
collide): one worktree per parallel agent; integrator merges in this order:
1. WS-A (blockers) → 2. WS-E tests green → 3. WS-D → 4. WS-C → 5. WS-G batch → 6. WS-B deletions
→ 7. WS-F README → 8. WS-H release.

**Concrete dispatch (first wave, all at once):**
- **Coder #1** → WS-A (A1+A2+A3) — the gate.
- **Coder #2** → WS-E (tests) — co-develops the A1 contract test.
- **Strategist** → WS-B-plan (decision table for the 18 stubs).
- **Coder #3** → WS-C (C1 tool-pair, C3 thinking-validator, C4 think-mode).
- **Sub ×N** → WS-G one hook each (token-budget, todo-continuation, context recovery…).
Integrator (Bob) merges per the order above; WS-D/F/H are second wave.

---

## 5. Port reference (exact sources in sibling repo)

| hiai-bob target | PORT FROM (hiai-opencode) |
|---|---|
| `src/hooks/reasoning-content-cache.ts` (A1) | `src/hooks/reasoning-content-cache/hook.ts` (v0.2.9) + trimmed `src/shared/reasoning-content-cache.ts` |
| `src/shared/runtime-stream-teardown-guard.ts` (A2) | `src/shared/runtime-stream-teardown-guard.ts` (verbatim) |
| `BackgroundManager` descendant deferral (A3) | `src/features/background-agent/manager.ts` → `hasPendingDescendantTasks` + `tryCompleteTask` guard |
| `isSessionComplete` predicate (D) | `src/tools/delegate-task/sync-session-poller.ts` |
| `tool-pair-validator` real logic (C1) | `src/hooks/tool-pair-validator/hook.ts` |
| `thinking-block-validator` pairing (C3) | `src/hooks/thinking-block-validator/hook.ts` |
| `model-fallback` (G) | `src/hooks/model-fallback/hook.ts` + `src/plugin/event-handlers/message-updated.ts` |
| A1 tests (E) | `src/hooks/reasoning-content-cache/hook.test.ts` (6-case contract) |

---

## 7. Three targeted decisions (investigated 2026-06-12)

### 7.1 🟠 Hide built-in agents — ROOT CAUSE FOUND + FIXED
- **Why it didn't work:** the MiMo/OpenCode runtime registers built-ins under **lowercase** keys —
  default is `r = { build: { name:"build", …, mode:"primary", native:true }, plan:{…}, compose:{…} }`
  (verified in the runtime bundle). hiai-bob overrode capitalized `"Build"/"Plan"/"Compose"`, which
  **created phantom agents** and left the real lowercase ones in the picker.
- **Fix (DONE in `src/index.ts`):** override lowercase `build`/`plan`/`compose`, merging over any
  existing definition and flipping `hidden:true` + `disable:true`:
  ```ts
  const builtInsToHide = ['build', 'plan', 'compose'];
  for (const key of builtInsToHide) {
    const existing = (input.agent[key] as Record<string, unknown>) ?? {};
    input.agent[key] = { ...existing, hidden: true, disable: true } as never;
  }
  ```
- **Verify at runtime:** restart MiMo; Build/Plan must be gone from the picker, Bob remains the
  default primary. **Caveat to test:** `disable:true` on `build` removes the stock default agent —
  confirm a fresh session still defaults to Bob. If MiMo complains, drop to `hidden:true` only
  (hides from picker, keeps it usable as implicit default). Make the field set config-driven
  (`config.hide_builtins?: "hidden" | "disable" | false`) so it's tunable without a rebuild.

### 7.2 🟠 MemPalace vs. native memory — REMOVE MemPalace; MiMo has a full native memory system
> CORRECTION (supersedes an earlier wrong note that claimed MiMo has no native memory — it does).
- **Finding (verified in `~/.local/share/mimocode/mimocode.db`):** MiMo ships a **complete native
  memory subsystem** — markdown files under `~/.local/share/mimocode/memory/`, indexed into SQLite
  **FTS5** (`memory_fts` + `memory_fts_idx`, `unicode61`):
  - `projects/<id>/MEMORY.md`, `MEMORY-roadmap.md`, `MEMORY-historical.md` — long-term project memory.
  - `sessions/<sid>/notes.md` (free), `checkpoint.md`, `checkpoint-completed-tasks.md`,
    `tasks/T*/progress.md` — working memory + checkpoints + per-task progress.
  - Schema `memory_fts(path, scope, scope_id, type, body, fingerprint, last_indexed_at)`; markdown is
    source-of-truth, SQLite is the search index (re-indexed on `fingerprint` change).
  - The runtime also exposes a model-facing `memory` tool. MiMo also reads `AGENTS.md`/`CLAUDE.md`.
- **Implication:** hiai-bob's MemPalace (external Python MCP + vector DB) is **pure duplication** and
  competes with the native system; `mempalace-auto-save` (a STUB) would only add a parallel,
  unindexed store.
- **Decision:**
  1. **Remove MemPalace from defaults.** Set `"mempalace": { enabled: false }` in `hiai-bob.json`
     (keep the registry entry only as an explicit opt-in for non-MiMo hosts).
  2. **Delete `src/hooks/mempalace-auto-save.ts`** + its line in `ALL_NAMED_HOOK_FACTORIES` + README
     row. Do **not** reimplement an own memory writer — defer to MiMo's native memory + `memory` tool.
  3. If a future non-MiMo host needs memory, write markdown into the host's memory dir convention so
     its indexer picks it up — never a second competing store.
- **Where:** `hiai-bob.json` (flip default), `src/mcp/registry.ts` (opt-in only),
  `src/hooks/mempalace-auto-save.ts` + `src/hooks/index.ts` (delete), README. Supersedes the WS-G
  mempalace line (which said "implement" — now "delete").

### 7.4 🟠 hiai-bob `BackgroundManager` likely duplicates MiMo's NATIVE durable task system
> New finding from the same DB inspection — affects WS-A3 / WS-D.
- **Finding:** `mimocode.db` has a native, persistent task tree: `task(id, session_id,
  parent_task_id, status, summary, owner, cleanup_after, created_at, last_event_at, ended_at)`
  (39 rows) + `task_event` log + `workflow_run` + `event`/`event_sequence` + checkpoint/resume.
  This is durable (survives restart) with native **parent/child** lineage and lifecycle/cleanup.
- **Implication:** hiai-bob's `src/features/background-manager/index.ts` reimplements this in-memory
  (`Map`, `session.status()` polling, `rootDescendantCounts`) — non-persistent and potentially
  racing/conflicting with MiMo's own task tracking. The **descendant-deferral I planned to port
  (WS-A3) and the completion robustness (WS-D) may already be handled natively** via `parent_task_id`
  + `status`.
- **INVESTIGATION DONE (2026-06-12, against `@opencode-ai/plugin@1.17.4` — now pinned to match the
  1.17.4 runtime; typecheck/build green):**
  1. **The native `task` tree is NOT exposed to plugins.** The plugin `event` hook union has no
     `task.*` (or `memory.*`) events — only `session.*` (created/idle/status/compacted/error/…),
     `message.*`, `permission.*`, and `todo.updated`. The SDK client has no `task`/`memory`
     namespace. So a plugin **cannot read or defer to** the native task tree; it can only observe
     `session.*`/`todo.updated` and call `client.session.{status,messages,prompt,abort}`.
  2. **The native `memory` tool is model-facing only** (the model invokes it); there is no plugin
     client API for memory either. Agents use it via prompts (done) — no code integration possible.
  3. **hiai-bob's `BackgroundManager` is DEAD CODE.** `launch()` and `recordToolCall()` have **zero
     callers** in `src/` — tasks are never created. The `background_output`/`background_cancel`
     tools only read/cancel via `getTask()`, so they can only ever return "Task not found". The
     manager just runs two empty `setInterval` timers (5s poll + 60s cleanup) over an empty map.
     All delegation goes through MiMo's **native `task` tool**, which hiai-bob does not wrap.
- **CONCLUSION / actions:**
  - **WS-A3 and WS-D are MOOT** — they hardened a manager that manages nothing. Remove them from the
    plan.
  - **DELETE `src/features/background-manager/` + `src/tools/background-task/` + their wiring in
    `src/index.ts`** (constructor, `setClient`, `setBackgroundManager`, `dispose`, the two tool
    registrations) and the `background-notification` hook. Drop the `background_manager` config block.
    Net: removes ~285 + ~110 LOC of dead code and two phantom tools from every agent's toolset.
  - If real background/parallel delegation is ever wanted, it must be built ON the native `task`
    tool (the only delegation primitive MiMo exposes) — not a parallel in-memory manager.
  - **Caveat:** re-verify after the 1.17.4 bump that nothing references the removed symbols
    (`bgManager`, `backgroundOutputTool`, `backgroundCancelTool`) before deleting.
- **Owner:** Coder (deletion is mechanical). Folds into §8's purge.

### 7.3 🟡 Integration with the MiMo fork (what I'm testing)
- **The installed runtime IS the fork:** `opencode-ai@1.17.4`, MiMo-branded (272 "mimo"/"MiMo"
  strings, "MiMo V[ersion]"/"MiMo M[odel]"). Config dir convention is **`.mimocode/`** (not
  `.opencode/`) — present at `/mnt/ai_data/.mimocode/` with `command/ plans/ skills/`.
- **Gaps to close for first-class MiMo integration:**
  1. **Config resolution misses `.mimocode/`.** `loadConfig` (`src/config/index.ts`) searches project
     root + `.opencode/` only. Add `.mimocode/hiai-bob.json` and `.mimocode/hiai-bob.jsonc` to the
     candidate list so users can colocate config with the host. *(Where: `src/config/index.ts`
     `candidates[]`.)*
  2. **Plugin API skew.** `@opencode-ai/plugin` pinned `^1.14.46` vs runtime **1.17.4**. Bump to
     `^1.17.x`, rebuild, verify no field drift (`hidden`/`disable`/`permission` shapes). *(WS-H.)*
  3. **MiMo models are reasoning models** (`mimo-v2.5-pro`, `deepseek-v4-pro` in defaults) → **WS-A1
     reasoning_content fix is REQUIRED** for MiMo, not optional. This is the highest-priority cross
     dependency: without it, delegation on MiMo defaults will 400.
  4. Skills/commands: MiMo loads `.mimocode/skills` + `.mimocode/command`; hiai-bob ships its own
     `skills/` (60). Confirm no name collisions and decide precedence.
- **Acceptance:** config picked up from `.mimocode/hiai-bob.json`; plugin API matches 1.17.x;
  delegation on default MiMo models runs clean (depends on WS-A1).

---

## 8. Redundancy audit vs mimo-native (2026-06-12) — "we over-built; subtract"

Evidence from the 1.17.4 runtime bundle shows MiMo natively handles most of what hiai-bob's hook
layer reimplements (usually as `console.log` stubs or dead code). **Direction: DELETE redundant
hooks and rely on mimo; keep only hooks that add value mimo lacks.** This supersedes/cancels parts
of WS-A, WS-D, WS-G.

**Runtime proof of native handling:**
- Reasoning: `"Ensure a reasoning…"`, `"missing reasoning"`, `"reasoning-delta/end for missing"` →
  mimo repairs missing reasoning itself. **The reasoning_content crash does not occur on mimo**
  (user-confirmed). → **WS-A1 CANCELLED; delete `reasoning-content-cache`.**
- Model fallback: native `fallbacks: [...]` + `retry policy(provider)`.
- Compaction/context: native `AUTOCOMPACT`, `Context Limit`, `Context overflow`, `context window`.
- Tool pairing: native `"orphaned interrupted tool"`, `"missing tool"`.
- Tasks: native persistent `task` tree, **not exposed to plugins** (no `task.*` events / client API —
  verified at 1.17.4, see §7.4). hiai-bob's `BackgroundManager` is **dead code** (`launch()` never
  called) → **WS-A3/WS-D MOOT; delete `BackgroundManager` + `background-task` tools** outright.

**Hook disposition (35 hooks):**

| KEEP (mimo lacks; genuine value) | DELETE — mimo-native | DELETE — stub (console.log only) |
|---|---|---|
| `closure-injector` (CLOSURE discipline) | `reasoning-content-cache` | `model-fallback` |
| `quality-gate` (biome/lint gate) | `thinking-block-validator` | `session-recovery` |
| `keyword-detector` (ultrawork/search modes) | `tool-pair-validator` (also dead types) | `token-budget` |
| `non-interactive-env` (rewrite interactive bash)* | `runtime-fallback` | `manager-guard` |
| `tool-output-truncator`* | `preemptive-compaction` | `sub-agent-receipt` |
| | `compaction-context-injector` | `background-notification` |
| | `compaction-todo-preserver` | `sub-notepad` |
| | `context-window-monitor` | `unstable-agent-babysitter` |
| | `context-window-limit-recovery` | `session-notification` |
| | `edit-error-recovery` | `start-work` |
| | `json-error-recovery` | `stop-continuation-guard` |
| | `rules-injector` (mimo reads AGENTS.md) | `session-todo-status` (empty) |
| | `directory-agents-injector` | `ralph-loop` |
| | `think-mode` (mimo: "thinking budget is required") | `todo-continuation` |

`*` verify against mimo before keeping — mimo may already cover bash-interactivity and tool-output
limits. Net: ~35 hooks → **~5 KEEP**. Removes the entire `mergeHookSets` overhead's reason to exist.

**Execution (after user greenlight):**
1. Delete the DELETE-column files + their lines in `ALL_NAMED_HOOK_FACTORIES`.
2. Delete unused hook-point plumbing in `src/index.ts` if a whole hook-point loses all handlers.
3. Re-audit `BackgroundManager` against native `task` tree (§7.4) — shrink or remove.
4. Rebuild + typecheck; smoke-test delegation + a reasoning model on mimo (expect no regressions).
5. Update README hook count + remove the "compensation layer" framing — there's nothing to compensate.

**Why this is safe:** every DELETE-native item is something mimo already does; every DELETE-stub
item does nothing today (only logs). Reversible via git.

---

## 6. Definition of done (whole effort)
- [ ] A1/A2/A3 landed; GLM/z.ai delegation runs without `reasoning_content is missing` or
      "Worker has been terminated"; nested delegators wait for children.
- [ ] `bun test` exists and is green; A1 contract covered.
- [ ] No hook claims behavior it doesn't have: every remaining stub is either implemented or
      deleted or commented `INTENTIONAL NO-OP`.
- [ ] `tool-pair-validator` fixed or removed; README claims match reality.
- [ ] `@opencode-ai/plugin` matches runtime 1.17.x; `bun run build` + typecheck clean.
- [ ] Repo/CI strategy decided (WS-H).
