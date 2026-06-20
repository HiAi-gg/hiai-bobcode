# MiMo-Code Fork — Integration Map & Report (2026-06-13)

> Decision basis for turning hiai-bob into a product by forking **XiaomiMiMo/MiMo-Code** and carrying
> our agent/orchestration logic as a **bundled first-party plugin** (the pattern MiMo already uses for
> its own features). Source studied from a shallow clone of `main` @ `42e7da3` (PR #252).

## 0. Verdict
**Fork MiMo-Code; ship our logic as a bundled first-party plugin (`BobPlugin`).** The investigation
found that MiMo already provides — *natively, for first-party plugins* — the exact primitives our plan
needed to hand-roll. The hardest piece (the autonomy + Critic completion loop) collapses into one
native hook. This is materially simpler and more reliable than the external-plugin approach, and far
cheaper than forking raw opencode (MiMo already did that work).

## 1. Repo facts
- **License:** MIT. **But** `USE_RESTRICTIONS.md` binds *derivatives* (see §9) — legal review required.
- **Stack:** TypeScript monorepo; **bun@1.3.11**; **turbo**; **tsgo** typecheck; **sst** (deploy infra);
  **nix** (flake); `effect` (Effect-TS) + an internal **Bus/BusEvent**. Packages: `opencode` (core
  runtime), `plugin` (`@mimo-ai/plugin` SDK), app/console/desktop/enterprise/extensions/identity.
- **Cadence:** very active — `main` pushed daily (HEAD 2026-06-11/PR #252); 533 forks, 6.7k stars.
- **Dev loop (cheap):** `bun run --cwd packages/opencode --conditions=browser src/index.ts`
  (with `MIMOCODE_HOME=$PWD/.dev-home`) — **runs from source, no 157 MB compile to iterate.**
- **Build binary:** `bun run script/build.ts` (or `build:dev --single`, `OPENCODE_CHANNEL=prod`).
- **Release tooling:** `script/release/`, `script/publish.ts`, `script/beta.ts`.

## 2. Where our code plugs in
- **Builtin plugin registry:** `packages/opencode/src/plugin/index.ts` (~L125-138) is a const array of
  first-party plugins (`MimoAuthPlugin`, `AnthropicProxyPlugin`, `CheckpointSplitoverPlugin`,
  `SubagentProgressCheckerPlugin`, …). **`BobPlugin` is added here** (import + array entry). It then
  loads like any builtin, with full `@mimo-ai/plugin` `Hooks` access.
- **Plugin SDK / hook surface:** `packages/plugin/src/index.ts` — the native `Hooks` interface, which
  is **richer than the published external API**. Hook points available to first-party plugins:
  `actor.preStop`, `actor.postStop`, `chat.headers`, `chat.message`, `chat.params`,
  `command.execute.before`, `experimental.chat.messages.transform`, `experimental.chat.system.transform`,
  `experimental.compaction.autocontinue`, `experimental.session.compacting`, `experimental.text.complete`,
  `permission.ask`, `shell.env`, `tool.definition`, `tool.execute.before`, `tool.execute.after`.
- **Templates to copy:** `plugin/subagent-progress-checker.ts` and `plugin/checkpoint-splitover.ts` —
  both are first-party plugins using `actor.postStop`/`preStop` with a matcher; near-exact shape for ours.

## 3. ⭐ The key enabler — native `actor.postStop` ReAct loop
This is the finding that rewrites the plan.

- Dispatched in **`packages/opencode/src/actor/spawn.ts`** with a built-in **ReAct re-entry loop** and
  **safety caps** (`MAX_PRE_REACT`, `MAX_POST_REACT`, ~L350/478/514). `session/prompt.ts:1870` is the
  **main-loop analogue** for the orchestrator.
- Hook contract (`packages/plugin/src/index.ts`):
  ```ts
  type ActorPostStopInput = ActorStopBaseInput & { canWrite?: boolean /* + sessionID, agentType, task_id */ }
  type ActorStopOutput   = { continue?: boolean; reason?: string }
  ```
- **Semantics:** when a hook returns `{ continue: true, reason }`, the actor **runs another turn** seeded
  with `reason`; when no hook asks to continue, the actor stops. Multiple plugins' decisions are
  aggregated (`plugin/index.ts` `aggregateDecision`, ~L463/469). Matchers can target by `agentType`
  (`excludeOnly` / include) — `plugin/matcher.ts`.
- **Therefore the autonomy loop and the Critic gate are not ours to build.** MiMo owns the loop + the
  cap. We only supply the *decision* inside `actor.postStop`. Our whole `session.idle` state machine,
  re-prompt-via-`session.prompt`, and critic-parent attribution glue from `bob-plan.md` **disappear**.

## 4. Feature → native seam (integration map)
| Our goal (§R) | Native seam in the fork | What we write |
|---|---|---|
| Autonomy: run until done | `actor.postStop` on orchestrator + native ReAct loop + `MAX_POST_REACT` cap | a decision fn: incomplete todos → `continue:true, reason:"continue"` |
| Hard Critic gate (code) | same `actor.postStop` | if diff unreviewed/critic≠approved → `continue:true, reason:"run Critic…"`; if rejected → continue to fix |
| Visual Critic (browser) | same hook + our `agent-browser` tool | `reason` requires a Vision pass when changed files match UI globs |
| Block "done" until approved | `continue:true` simply prevents stop — no fragile detection | parse Critic CLOSURE from session messages (or a `task_id` progress file) |
| Parallel waves / parallel Subs | native `task` tool + persistent task tree (`actor/spawn.ts`, `task_id`, progress.md) | prompt-level annotations (Strategist) + dispatch rules (Bob/Manager) |
| Memory | native `memory/` (FTS service, `memory/service.ts`, paths, reconcile) + native `memory` tool + `dream`/`distill` consolidation | nothing — agents use the native tool |
| Progress/checkpoints | native `session/checkpoint*.ts`, `progressPath(sessionID, taskId)`, `SubagentProgressCheckerPlugin` | optionally extend the existing checker |
| Model fallback / compaction / reasoning-repair / context limits | native | nothing |

## 5. Agents
- Native agents live in `packages/opencode/src/agent/agent.ts` (`build, plan, compose, general, explore,
  title, summary, compaction, checkpoint-writer, dream, distill`). `SYSTEM_SPAWNED_AGENT_TYPES`
  (`checkpoint-writer, dream, distill`) are runtime-spawned and skipped by prune/memory scans.
- **Our 10 agents:** start by registering them through the BobPlugin's config layer (same as the current
  plugin does) and hiding `build/plan/compose` from the picker. Later, promote any agent to a native
  definition in `agent.ts` if it needs deeper integration. **No rewrite needed up front** — the agent
  prompts/models port verbatim.

## 6. What we inherit for free (do NOT reimplement)
FTS memory + `dream`/`distill` consolidation; persistent parent/child **task tree** with `task_id` +
`progress.md`; checkpoints + splitover; subagent progress validation; model fallback/retry; auto
compaction; context-limit handling; reasoning-repair; the TUI task/todo/goal sidebar.

## 7. Build & dev workflow (for the fork)
- Iterate from source: `bun run --cwd packages/opencode src/index.ts` (no compile).
- `bun turbo typecheck` (tsgo) + `bun test` per package.
- Ship: `bun run script/build.ts`; release via `script/release/` + `publish.ts`.
- Keep ALL our changes inside `packages/opencode/src/plugin/bob/` + the single registry line in
  `plugin/index.ts` → rebases onto upstream `main` stay trivial.

## 8. Risks / caveats (accept consciously)
- **Rebase cadence:** upstream `main` is daily. Mitigation: isolate our code to `src/plugin/bob/`; carry
  a one-line registry diff; rebase weekly. Don't scatter edits across core files.
- ⚠️ **USE_RESTRICTIONS.md binds derivatives** — notably *"do not use … to autonomously execute
  high-risk actions without appropriate human oversight."* Directly constrains our autonomy feature:
  keep human-in-the-loop / permission gates for high-risk actions (writes, shell, deploys). Also: no
  military, no malicious-cyber, lawful-data only. **Legal review + trademark strip (remove MiMo/Xiaomi
  branding) before any product/distribution.**
- **Effect-TS + Bus:** core is Effect-based. BobPlugin can stay in the standard `@mimo-ai/plugin` Hooks
  surface and only touch Bus/Session where strictly needed. Budget a learning ramp.
- **tsgo / bun versions:** pin `bun@1.3.11`; typecheck is `tsgo`, not `tsc`.

## 9. Net effect on the plan
The fork makes the plan **smaller**, not bigger, for our features — because the loop/caps/memory/tasks
are native. The work becomes: (1) stand up the fork + dev loop, (2) port hiai-bob into
`src/plugin/bob/` as a builtin, (3) implement the completion decision as an `actor.postStop` hook
(replacing the entire external `completion-controller` glue), (4) the parallelism prompts (unchanged),
(5) branding/build/release + legal. See the revised plan in `bob-plan.md §F`.
