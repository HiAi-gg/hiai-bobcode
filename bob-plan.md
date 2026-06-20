# hiai-bob Revised-Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended)
> or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`)
> syntax for tracking. **Spec:** `bob-todo.md §R` (authoritative). This plan implements §R only.

**Goal:** Turn hiai-bob into a thin value layer on MiMo — one `completion-controller` hook (autonomy +
hard Critic gate), parallel-wave orchestration prompts, and removal of all mimo-native-duplicate /
dead code — while preserving every tool/MCP/asset in §R.4a.

**Architecture:** Keep the 10-agent team and real tools. Add one `session.idle` state machine that
re-prompts until todos are done AND Critic has APPROVED the current diff (forcing a Vision browser pass
on UI changes), capped for safety. Delete the dead `BackgroundManager` + ~28 redundant hooks. The
decision logic is a pure, unit-tested function; the hook is thin glue over verified runtime signals.

**Tech Stack:** TypeScript, Bun (`bun test`, `bun build --target bun`), `@opencode-ai/plugin@1.17.4`,
Biome. Hooks are `(config: HiaiBobConfig) => HookSet` factories registered in `src/hooks/index.ts`.

---

## §F. FORK PLAN — supersedes the external-plugin tasks below (2026-06-13)

> ### 📍 DOC MAP — which file drives development now
> - **`bob-plan.md §F` (THIS) = the ACTIVE development plan for the fork.** Execute from here.
>   (Old Tasks 1-11 below = reference/superseded by the external-plugin era.)
> - **`MIMO-FORK-INTEGRATION.md` = reference** — how MiMo works + integration seams (file:line).
> - **`bob-todo.md §R` = feature spec** — *what* to build (agents, autonomy, Critic gate, parallelism);
>   §0-§8 there are rationale/evidence only.
> Order of truth: §F (how/now) → MIMO-FORK-INTEGRATION (where) → bob-todo §R (what).

> **Direction changed:** hiai-bob becomes a **product = a fork of XiaomiMiMo/MiMo-Code** with our logic
> as a **bundled first-party plugin** (`BobPlugin`). See `MIMO-FORK-INTEGRATION.md` for the full map.
> The external-plugin tasks (Tasks 1-11 below) are kept for reference; the parts that carry over are
> noted per phase. **The biggest change: the `completion-controller` is no longer hand-rolled glue —
> it becomes a native `actor.postStop` hook** (MiMo owns the ReAct loop + safety cap).

**Carry-over from the old tasks:** the pure `decide()` function (old Task 3) + its tests, the `signals`
helpers (old Task 4), and the parallelism prompts (old Task 8) port **verbatim**. Obsoleted: old Tasks
5/6/7 (session.idle state machine, `client.session.prompt` glue, critic-parent attribution) and old
Task 9 BackgroundManager deletion (different codebase). Old Task 1 spike is replaced by F0.

### Phase F0 — Stand up the fork + dev loop
- [ ] Fork `github.com/XiaomiMiMo/MiMo-Code` → our org; clone; `bun install` (bun@1.3.11).
- [ ] Run from source: `MIMOCODE_HOME=$PWD/.dev-home bun run --cwd packages/opencode --conditions=browser src/index.ts` — confirm it boots.
- [ ] `bun turbo typecheck` + `bun test` green on a clean checkout (baseline).
- [ ] Set up a thin branch strategy: all our work under `packages/opencode/src/plugin/bob/` + one line
  in `plugin/index.ts`; weekly rebase onto upstream `main`.

### Phase F1 — Legal/branding gate (prereq for DISTRIBUTION, not for dev)
- [ ] Review `USE_RESTRICTIONS.md` — confirm the autonomy feature keeps **human oversight for high-risk
  actions** (writes/shell/deploys gated by permissions). No military / malicious-cyber / unlawful-data.
- [ ] Plan trademark strip (remove MiMo/Xiaomi marks) + product branding before any public build.

### Phase F2 — Port hiai-bob in as a builtin `BobPlugin`
- [ ] Create `packages/opencode/src/plugin/bob/` and move our agents (10), tools (agent-browser, LSP,
  glob/grep, session-manager, skill), MCP wiring, and KEEP-hooks into it, adapted to `@mimo-ai/plugin`
  `Hooks` types.
- [ ] **MCP slimming:** keep only **`grep_app`** + **`sequential-thinking`** as MCP servers. **Migrate
  `context7` from MCP → a CLI+skill** (same pattern as firecrawl): add a `context7` skill (`SKILL.md`)
  that tells agents to fetch library docs via the context7 CLI/API (`npx @upstash/context7` or a
  `curl` wrapper using `CONTEXT7_API_KEY`), and reference it from Researcher/Coder prompts instead of
  the `context7` MCP tool. Remove `context7` from the MCP registry. Rationale: fewer always-on MCP
  processes; docs-lookup is a pull, better as an on-demand skill.
- [ ] PRESERVE list (§R.4a, updated): **MCP** = grep_app + sequential-thinking; **CLI+skill** = context7
  + firecrawl; plus POSTGRES_RULES, agent-browser/LSP/glob/grep/session-manager, skills/, design-systems/.
- [ ] Register `BobPlugin` in `packages/opencode/src/plugin/index.ts` builtin array (~L125-138).
- [ ] Hide native `build/plan/compose` from the picker via the agent config layer (lowercase keys —
  carries over the §7.1 fix).
- [ ] DROP everything mimo-native (the §8 deletes are now "just don't port them"): reasoning-cache,
  thinking-validator, tool-pair, fallback, compaction/context hooks, token-budget, error-recovery, the
  pure stubs, and the dead BackgroundManager/background-task tools.

### Phase F3 — Completion gate as native `actor.postStop` (replaces old Tasks 5/6/7)
- [ ] Port `decide()` (old Task 3) + `signals` (old Task 4) verbatim into `src/plugin/bob/completion/`.
- [ ] Implement `BobCompletionHook` as `actor.postStop` (model after `subagent-progress-checker.ts`):
  matcher targets the orchestrator agentType; build the `CompletionState` from native signals
  (todos, `task_id`/progress, changed files via `tool.execute.after`, Critic CLOSURE); call `decide()`;
  map the action to `{ continue: true, reason }` (continue / fix / review+vision) or no-continue (stop).
  MiMo's `MAX_POST_REACT` cap + ReAct loop replace our `max_auto_continues` plumbing (keep our cap as a
  secondary guard).
- [ ] Tests: `decide.test.ts` + `signals.test.ts` run under `bun test` in the package.

### Phase F4 — Parallelism prompts (old Task 8 verbatim)
- [ ] Strategist annotates `wave/parallel/owner/deps`; Bob & Manager dispatch parallel waves via the
  native `task` tool (which already populates the persistent task tree).

### Phase F5 — Verify inheritance + prune
- [ ] Confirm native memory (`memory/service.ts` + `memory` tool), task tree, dream/distill, fallback,
  compaction, reasoning-repair all work for our agents — delete any of our logic they cover.
- [ ] Confirm PRESERVE list intact; `bun turbo typecheck` + `bun test` + run-from-source smoke green.

### Phase F6 — Build / release / branding
- [ ] `bun run script/build.ts` produces our branded binary; wire `script/release/` + `publish.ts`.
- [ ] Distribution channel decided (internal first); signing per platform.

**Smoke test (acceptance):** a multi-wave task on a mimo model runs parallel waves; the orchestrator
auto-continues via `actor.postStop` until todos done; it will not stop until Critic returns APPROVED,
forcing a Vision browser pass on a UI change; high-risk actions still prompt for permission.

---

## File Structure (what gets created / modified)  — ⚠️ describes the OLD external-plugin path; see §F

**Created**
- `src/hooks/completion-controller/decide.ts` — pure decision function (no I/O). The brain.
- `src/hooks/completion-controller/decide.test.ts` — unit tests for `decide()`.
- `src/hooks/completion-controller/state.ts` — per-session mutable state store + types + fingerprint.
- `src/hooks/completion-controller/signals.ts` — UI-glob match, changed-file fingerprint, critic-verdict parse.
- `src/hooks/completion-controller/signals.test.ts` — unit tests for the helpers.
- `src/hooks/completion-controller/index.ts` — the `createCompletionController` hook factory (glue).
- `docs/RUNTIME-SIGNALS.md` — findings from the Task 1 spike (kept for future maintainers).

**Modified**
- `src/shared/types.ts` — add `completion` config block to `HiaiBobConfig`.
- `src/config/index.ts` — `DEFAULT_CONFIG.completion` + merge.
- `hiai-bob.json` — `completion` block; relocate `auth` keys note.
- `src/hooks/index.ts` — register `completion-controller`; remove deleted hook imports/entries.
- `src/index.ts` — `setCompletionClient(ctx.client)`; remove BackgroundManager wiring.
- `src/agents/strategist.ts`, `manager.ts`, `bob.ts` — parallel-wave annotations + dispatch rules.
- `README.md` — hook list, parallelism, remove dead-feature claims.

**Deleted** (R-3): `src/features/background-manager/`, `src/tools/background-task/`, and the §8 hook files.

---

## Task 1: Runtime-signal spike (NO CODE — verify assumptions, write findings)

> The decision logic (Tasks 2-3) is pure and testable now. The hook GLUE (Task 6) depends on runtime
> signals that must be confirmed against `opencode-ai@1.17.4`, not assumed. Do this first.

**Files:** Create `docs/RUNTIME-SIGNALS.md`.

- [ ] **Step 1: Confirm whether MiMo already auto-continues on idle.**
  Inspect the runtime for an idle→continue behavior and the `experimental.compaction.autocontinue`
  hook point scope:
  ```bash
  BIN=$(readlink -f "$(which opencode)")
  grep -a -oE ".{0,40}(autocontinue|auto-continue|idle.{0,20}continue|session\.idle).{0,60}" "$BIN" | sort -u | head -30
  ```
  Record: does idle auto-continue happen natively? If yes, the controller must gate to avoid
  double-prompting (note the exact condition).

- [ ] **Step 2: Confirm the `session.idle` event payload shape.**
  Search the SDK event types for the idle payload (does it carry `sessionID`, `agent`, parent id?):
  ```bash
  cd /mnt/ai_data/projects/hiai-bob
  grep -n -A6 '"session.idle"' node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts | head -40
  grep -nE "parentID|parent_id|agent\??:" node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts | head
  ```
  Record the exact property path for: session id, agent name, parent session id (if any).

- [ ] **Step 3: Confirm how to read todos + their completion state.**
  ```bash
  grep -n -A10 '"todo.updated"' node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts | head
  grep -niE "todo" node_modules/@opencode-ai/sdk/dist/gen/sdk.gen.d.ts | head
  ```
  Record: the `todo.updated` payload (array of `{id,status,...}`?) and any client `session.todos`/
  `todos` read method. Determine the "incomplete" predicate (status !== "completed").

- [ ] **Step 4: Confirm critic-verdict attribution.**
  Determine how to know a critic SUBSESSION finished and map it to its parent (orchestrator) session:
  ```bash
  grep -niE "parentID|childID|children|subSession|parent" node_modules/@opencode-ai/sdk/dist/gen/sdk.gen.d.ts | head
  grep -n -A20 'session.*Info|sessionInfo|export type Session ' node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts | head -30
  ```
  Record: is `parentID` on the session object (via `client.session.get`)? If parent mapping is NOT
  exposed, document the fallback chosen in Task 6 (time-window attribution to the active root session).

- [ ] **Step 5: Write `docs/RUNTIME-SIGNALS.md`** with the confirmed property paths + decisions, and
  **commit**:
  ```bash
  git add docs/RUNTIME-SIGNALS.md && git commit -m "docs(bob): runtime-signal spike for completion-controller"
  ```

> Gate: if Step 1 shows MiMo fully auto-continues AND has a native review gate, STOP and re-scope with
> the user before building the controller. Otherwise proceed.

---

## Task 2: Config surface for `completion`

**Files:** Modify `src/shared/types.ts`, `src/config/index.ts`, `hiai-bob.json`.

- [ ] **Step 1: Add the config type.** In `src/shared/types.ts`, add to `HiaiBobConfig`:

```ts
export interface CompletionConfig {
  enabled: boolean;
  max_auto_continues: number;
  require_critic: boolean;
  ui_globs: string[];
  reset_on_user_message: boolean;
}
```
Add `completion?: CompletionConfig;` to the `HiaiBobConfig` interface.

- [ ] **Step 2: Add defaults.** In `src/config/index.ts` `DEFAULT_CONFIG`, add:

```ts
  completion: {
    enabled: true,
    max_auto_continues: 25,
    require_critic: true,
    ui_globs: [
      "**/*.svelte", "**/*.tsx", "**/*.jsx", "**/*.vue",
      "**/*.css", "**/*.scss", "**/*.html", "**/*.astro",
    ],
    reset_on_user_message: true,
  },
```
And in the returned merged object add: `completion: userConfig.completion ?? DEFAULT_CONFIG.completion,`.

- [ ] **Step 3: Expose in `hiai-bob.json`** (after the `background_manager` block is later removed,
  add a `completion` block mirroring the defaults so it's user-tunable).

- [ ] **Step 4: Typecheck + commit.**
  Run: `bun run typecheck` — Expected: exit 0.
  ```bash
  git add src/shared/types.ts src/config/index.ts hiai-bob.json
  git commit -m "feat(bob): completion config surface"
  ```

---

## Task 3: Pure decision function `decide()` (TDD)

**Files:** Create `src/hooks/completion-controller/decide.ts`, `src/hooks/completion-controller/decide.test.ts`.

- [ ] **Step 1: Write the failing tests.** Create `decide.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { decide, type CompletionState } from "./decide";

const base: CompletionState = {
  autoContinues: 0,
  maxAutoContinues: 25,
  hasIncompleteTodos: false,
  changedFiles: [],
  currentFingerprint: "",
  reviewedFingerprint: null,
  criticVerdict: null,
  blockerFlagged: false,
  uiChanged: false,
  requireCritic: true,
};

describe("decide", () => {
  test("blocker flagged -> stop(blocked)", () => {
    expect(decide({ ...base, blockerFlagged: true })).toEqual({ kind: "stop", reason: "blocked" });
  });

  test("incomplete todos under cap -> continue", () => {
    expect(decide({ ...base, hasIncompleteTodos: true }).kind).toBe("continue");
  });

  test("incomplete todos at cap -> stop(cap)", () => {
    expect(decide({ ...base, hasIncompleteTodos: true, autoContinues: 25 }))
      .toEqual({ kind: "stop", reason: "cap" });
  });

  test("todos done, no changes -> stop(done)", () => {
    expect(decide({ ...base }).kind).toBe("stop");
    expect(decide({ ...base }).reason).toBe("done");
  });

  test("todos done, require_critic=false -> stop(done) even with changes", () => {
    expect(decide({ ...base, requireCritic: false, changedFiles: ["a.ts"], currentFingerprint: "x" }))
      .toEqual({ kind: "stop", reason: "done" });
  });

  test("todos done, unreviewed changes -> review", () => {
    const a = decide({ ...base, changedFiles: ["a.ts"], currentFingerprint: "x" });
    expect(a.kind).toBe("review");
  });

  test("review forces vision when uiChanged", () => {
    const a = decide({ ...base, changedFiles: ["a.svelte"], currentFingerprint: "x", uiChanged: true });
    expect(a.kind).toBe("review");
    if (a.kind === "review") expect(a.prompt.toLowerCase()).toContain("browser");
  });

  test("critic approved current fingerprint -> stop(done)", () => {
    expect(decide({
      ...base, changedFiles: ["a.ts"], currentFingerprint: "x",
      criticVerdict: "approved", reviewedFingerprint: "x",
    })).toEqual({ kind: "stop", reason: "done" });
  });

  test("stale approval (fingerprint changed since review) -> review again", () => {
    expect(decide({
      ...base, changedFiles: ["a.ts","b.ts"], currentFingerprint: "y",
      criticVerdict: "approved", reviewedFingerprint: "x",
    }).kind).toBe("review");
  });

  test("critic rejected current fingerprint -> continue (fix)", () => {
    expect(decide({
      ...base, changedFiles: ["a.ts"], currentFingerprint: "x",
      criticVerdict: "rejected", reviewedFingerprint: "x",
    }).kind).toBe("continue");
  });

  test("review path respects cap -> stop(cap)", () => {
    expect(decide({
      ...base, changedFiles: ["a.ts"], currentFingerprint: "x", autoContinues: 25,
    })).toEqual({ kind: "stop", reason: "cap" });
  });
});
```

- [ ] **Step 2: Run to verify it fails.**
  Run: `cd /mnt/ai_data/projects/hiai-bob && bun test src/hooks/completion-controller/decide.test.ts`
  Expected: FAIL — `Cannot find module './decide'`.

- [ ] **Step 3: Implement `decide.ts`:**

```ts
export interface CompletionState {
  autoContinues: number;
  maxAutoContinues: number;
  hasIncompleteTodos: boolean;
  changedFiles: string[];
  currentFingerprint: string;
  reviewedFingerprint: string | null;
  criticVerdict: "approved" | "rejected" | null;
  blockerFlagged: boolean;
  uiChanged: boolean;
  requireCritic: boolean;
}

export type CompletionAction =
  | { kind: "stop"; reason: "blocked" | "done" | "cap" }
  | { kind: "continue"; prompt: string }
  | { kind: "review"; prompt: string };

const CONTINUE_PROMPT =
  "Continue with the remaining TODO items until all are complete. Do not stop early.";
const FIX_PROMPT =
  "The Critic REJECTED the current changes. Address every point it raised, then continue.";
const REVIEW_PROMPT =
  "All TODOs are done. Delegate to Critic (task subagent_type=\"critic\") to review the changes; " +
  "do not finish until Critic returns APPROVED.";
const REVIEW_VISION_PROMPT =
  REVIEW_PROMPT +
  " UI files changed — Critic MUST include a Vision browser pass (agent_browser_navigate + snapshot) " +
  "before approving.";

export function decide(s: CompletionState): CompletionAction {
  if (s.blockerFlagged) return { kind: "stop", reason: "blocked" };

  const atCap = s.autoContinues >= s.maxAutoContinues;

  if (s.hasIncompleteTodos) {
    return atCap ? { kind: "stop", reason: "cap" } : { kind: "continue", prompt: CONTINUE_PROMPT };
  }

  // TODOs complete.
  if (!s.requireCritic || s.changedFiles.length === 0) {
    return { kind: "stop", reason: "done" };
  }

  const verdictMatchesDiff = s.reviewedFingerprint === s.currentFingerprint;
  if (s.criticVerdict === "approved" && verdictMatchesDiff) {
    return { kind: "stop", reason: "done" };
  }
  if (s.criticVerdict === "rejected" && verdictMatchesDiff) {
    return atCap ? { kind: "stop", reason: "cap" } : { kind: "continue", prompt: FIX_PROMPT };
  }
  // Unreviewed or stale approval -> dispatch Critic.
  return atCap
    ? { kind: "stop", reason: "cap" }
    : { kind: "review", prompt: s.uiChanged ? REVIEW_VISION_PROMPT : REVIEW_PROMPT };
}
```

- [ ] **Step 4: Run to verify pass.**
  Run: `bun test src/hooks/completion-controller/decide.test.ts`
  Expected: PASS (11 tests).

- [ ] **Step 5: Commit.**
  ```bash
  git add src/hooks/completion-controller/decide.ts src/hooks/completion-controller/decide.test.ts
  git commit -m "feat(bob): completion-controller decision function (pure, TDD)"
  ```

---

## Task 4: Signal helpers (TDD)

**Files:** Create `src/hooks/completion-controller/signals.ts`, `signals.test.ts`.

- [ ] **Step 1: Write failing tests** (`signals.test.ts`):

```ts
import { describe, expect, test } from "bun:test";
import { fingerprint, matchesAnyGlob, parseCriticVerdict } from "./signals";

const UI = ["**/*.svelte", "**/*.css"];

describe("matchesAnyGlob", () => {
  test("matches ui file", () => expect(matchesAnyGlob("src/x.svelte", UI)).toBe(true));
  test("non-ui file", () => expect(matchesAnyGlob("src/x.ts", UI)).toBe(false));
});

describe("fingerprint", () => {
  test("order-independent + stable", () => {
    expect(fingerprint(["b.ts", "a.ts"])).toBe(fingerprint(["a.ts", "b.ts"]));
  });
  test("changes when set changes", () => {
    expect(fingerprint(["a.ts"])).not.toBe(fingerprint(["a.ts", "b.ts"]));
  });
  test("empty -> empty string", () => expect(fingerprint([])).toBe(""));
});

describe("parseCriticVerdict", () => {
  test("accept", () => {
    expect(parseCriticVerdict('<CLOSURE>{"readiness":"accept"}</CLOSURE>')).toBe("approved");
  });
  test("reject", () => {
    expect(parseCriticVerdict('<CLOSURE>{"readiness":"reject"}</CLOSURE>')).toBe("rejected");
  });
  test("no closure -> null", () => expect(parseCriticVerdict("just text")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify fail.**
  Run: `bun test src/hooks/completion-controller/signals.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement `signals.ts`:**

```ts
import { createHash } from "node:crypto";

/** Minimal glob match: supports ** and * over path segments; good enough for extension globs. */
export function matchesAnyGlob(path: string, globs: string[]): boolean {
  const norm = path.replace(/\\/g, "/");
  return globs.some((g) => globToRegExp(g).test(norm));
}

function globToRegExp(glob: string): RegExp {
  const re = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, " ")     // placeholder for **
    .replace(/\*/g, "[^/]*")
    .replace(/ /g, ".*");
  return new RegExp(`^${re}$`);
}

/** Order-independent, deduped fingerprint of the changed-file set. */
export function fingerprint(files: string[]): string {
  if (files.length === 0) return "";
  const uniq = [...new Set(files.map((f) => f.replace(/\\/g, "/")))].sort();
  return createHash("sha1").update(uniq.join("\n")).digest("hex");
}

/** Parse a Critic CLOSURE block -> verdict. accept/reject -> approved/rejected. */
export function parseCriticVerdict(text: string): "approved" | "rejected" | null {
  const m = text.match(/<CLOSURE>([\s\S]*?)<\/CLOSURE>/i);
  if (!m) return null;
  const body = m[1];
  if (/"readiness"\s*:\s*"accept"/i.test(body)) return "approved";
  if (/"readiness"\s*:\s*"reject"/i.test(body)) return "rejected";
  return null;
}
```

- [ ] **Step 4: Run to verify pass.**
  Run: `bun test src/hooks/completion-controller/signals.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/hooks/completion-controller/signals.ts src/hooks/completion-controller/signals.test.ts
  git commit -m "feat(bob): completion-controller signal helpers (TDD)"
  ```

---

## Task 5: Per-session state store

**Files:** Create `src/hooks/completion-controller/state.ts`.

- [ ] **Step 1: Implement `state.ts`:**

```ts
import { fingerprint } from "./signals";

export interface SessionRuntime {
  autoContinues: number;
  hasIncompleteTodos: boolean;
  changedFiles: string[];
  reviewedFingerprint: string | null;
  criticVerdict: "approved" | "rejected" | null;
  blockerFlagged: boolean;
  uiChangedSinceReview: boolean;
}

const store = new Map<string, SessionRuntime>();

export function get(sessionID: string): SessionRuntime {
  let s = store.get(sessionID);
  if (!s) {
    s = {
      autoContinues: 0,
      hasIncompleteTodos: false,
      changedFiles: [],
      reviewedFingerprint: null,
      criticVerdict: null,
      blockerFlagged: false,
      uiChangedSinceReview: false,
    };
    store.set(sessionID, s);
  }
  return s;
}

export function recordChangedFile(sessionID: string, path: string, isUi: boolean): void {
  const s = get(sessionID);
  if (!s.changedFiles.includes(path)) s.changedFiles.push(path);
  if (isUi) s.uiChangedSinceReview = true;
  // New edits invalidate any prior review.
  s.criticVerdict = null;
  s.reviewedFingerprint = null;
}

export function recordCriticVerdict(sessionID: string, verdict: "approved" | "rejected"): void {
  const s = get(sessionID);
  s.criticVerdict = verdict;
  s.reviewedFingerprint = fingerprint(s.changedFiles);
  if (verdict === "approved") s.uiChangedSinceReview = false;
}

export function resetForUser(sessionID: string): void {
  const s = get(sessionID);
  s.autoContinues = 0;
  s.blockerFlagged = false;
}

export function clear(sessionID: string): void {
  store.delete(sessionID);
}

export function currentFingerprint(s: SessionRuntime): string {
  return fingerprint(s.changedFiles);
}
```

- [ ] **Step 2: Typecheck + commit.**
  Run: `bun run typecheck` — Expected: exit 0.
  ```bash
  git add src/hooks/completion-controller/state.ts
  git commit -m "feat(bob): completion-controller session state store"
  ```

---

## Task 6: The hook factory (glue) — wire signals → decide → client

**Files:** Create `src/hooks/completion-controller/index.ts`. Uses Task-1 findings for exact event paths.

> NOTE: the exact `event.properties` paths (sessionID/agent/parent, todos shape) come from
> `docs/RUNTIME-SIGNALS.md`. The code below assumes the OpenCode-conventional shapes used by the
> existing stub hooks (`evt.properties.sessionID`, `evt.properties.agent`, `todo.updated` carrying a
> `todos` array). **Adjust to the spike's confirmed paths if they differ.**

- [ ] **Step 1: Implement `index.ts`:**

```ts
import type { HiaiBobConfig, HookSet } from "../../shared/types";
import type { PluginInput } from "@opencode-ai/plugin";
import { decide } from "./decide";
import { matchesAnyGlob, parseCriticVerdict } from "./signals";
import * as st from "./state";

let client: PluginInput["client"] | null = null;
export function setCompletionClient(c: PluginInput["client"]) {
  client = c;
}

export function createCompletionController(config: HiaiBobConfig): HookSet {
  const cfg = config.completion ?? {
    enabled: true, max_auto_continues: 25, require_critic: true,
    ui_globs: [], reset_on_user_message: true,
  };
  if (!cfg.enabled) return {};

  return {
    // Track file edits per session.
    "tool.execute.after": async (input, _output) => {
      const tool = (input as { tool?: string }).tool;
      const sid = (input as { sessionID?: string }).sessionID;
      if (!sid || !tool) return;
      if (tool !== "write" && tool !== "edit" && tool !== "apply_patch") return;
      const args = (input as { args?: Record<string, unknown> }).args ?? {};
      const fp = (args.filePath ?? args.path) as string | undefined;
      if (!fp) return;
      st.recordChangedFile(sid, fp, matchesAnyGlob(fp, cfg.ui_globs));
    },

    event: async ({ event }: { event: unknown }) => {
      if (!client) return;
      const evt = event as { type?: string; properties?: Record<string, unknown> };
      const props = evt.properties ?? {};
      const sid = props.sessionID as string | undefined;

      // 1) user message resets the loop
      if (cfg.reset_on_user_message && evt.type === "message.updated") {
        const role = (props.info as { role?: string } | undefined)?.role ?? props.role;
        if (role === "user" && sid) st.resetForUser(sid);
        return;
      }

      // 2) todos -> incomplete predicate
      if (evt.type === "todo.updated" && sid) {
        const todos = (props.todos as Array<{ status?: string }> | undefined) ?? [];
        st.get(sid).hasIncompleteTodos = todos.some((t) => t.status !== "completed");
        return;
      }

      if (evt.type !== "session.idle" || !sid) return;
      const agent = props.agent as string | undefined;

      // 3) a Critic subsession went idle -> capture its verdict for the PARENT (see spike for parent map)
      if (agent === "critic") {
        const parent = await resolveParent(sid);
        if (parent) {
          const verdict = await readCriticVerdict(sid);
          if (verdict) st.recordCriticVerdict(parent, verdict);
        }
        return;
      }

      // 4) only act on root/orchestrator sessions (no parent)
      const parentOfThis = await resolveParent(sid);
      if (parentOfThis) return;

      const s = st.get(sid);
      const action = decide({
        autoContinues: s.autoContinues,
        maxAutoContinues: cfg.max_auto_continues,
        hasIncompleteTodos: s.hasIncompleteTodos,
        changedFiles: s.changedFiles,
        currentFingerprint: st.currentFingerprint(s),
        reviewedFingerprint: s.reviewedFingerprint,
        criticVerdict: s.criticVerdict,
        blockerFlagged: s.blockerFlagged,
        uiChanged: s.uiChangedSinceReview,
        requireCritic: cfg.require_critic,
      });

      if (action.kind === "stop") return; // let the session end
      s.autoContinues += 1;
      await client.session.prompt({
        path: { id: sid },
        body: { parts: [{ type: "text", text: action.prompt }] } as never,
      });
    },

    dispose: async () => { /* state is in-memory; nothing persistent */ },
  };

  // --- helpers bound to client; implement per spike findings ---
  async function resolveParent(sessionID: string): Promise<string | null> {
    try {
      const res = await client!.session.get({ path: { id: sessionID } });
      const parent = (res.data as { parentID?: string } | undefined)?.parentID;
      return parent ?? null;
    } catch { return null; }
  }

  async function readCriticVerdict(sessionID: string): Promise<"approved" | "rejected" | null> {
    try {
      const res = await client!.session.messages({ path: { id: sessionID } });
      const msgs = (res.data ?? []) as Array<{ info?: { role?: string }; parts?: Array<{ type?: string; text?: string }> }>;
      const lastAssistant = [...msgs].reverse().find((m) => m.info?.role === "assistant");
      const text = (lastAssistant?.parts ?? []).filter((p) => p.type === "text").map((p) => p.text).join("");
      return parseCriticVerdict(text);
    } catch { return null; }
  }
}
```

- [ ] **Step 2: Typecheck.**
  Run: `bun run typecheck` — Expected: exit 0. Fix type mismatches against the real `client` surface
  (method names `session.get` / `session.messages` / `session.prompt` per `sdk.gen.d.ts`).

- [ ] **Step 3: Commit.**
  ```bash
  git add src/hooks/completion-controller/index.ts
  git commit -m "feat(bob): completion-controller hook glue"
  ```

---

## Task 7: Register the controller + wire the client

**Files:** Modify `src/hooks/index.ts`, `src/index.ts`.

- [ ] **Step 1:** In `src/hooks/index.ts` add the import + registry entry (top of `ALL_NAMED_HOOK_FACTORIES`):

```ts
import { createCompletionController } from "./completion-controller";
// ...
const ALL_NAMED_HOOK_FACTORIES: NamedHookFactory[] = [
  { name: "completion-controller", factory: createCompletionController },
  { name: "closure-injector", factory: createClosureInjector },
  // ... (remaining KEPT hooks only; deletions happen in Task 9)
];
```

- [ ] **Step 2:** In `src/index.ts`, import and call the client setter near `setSessionClient(ctx.client)`:

```ts
import { setCompletionClient } from "./hooks/completion-controller";
// after setSessionClient(ctx.client):
setCompletionClient(ctx.client);
```

- [ ] **Step 3: Build + typecheck + commit.**
  Run: `bun run typecheck && bun run build` — Expected: exit 0, bundle built.
  ```bash
  git add src/hooks/index.ts src/index.ts
  git commit -m "feat(bob): register completion-controller + wire client"
  ```

---

## Task 8: Parallelism prompts (Strategist annotations + Bob/Manager wave dispatch)

**Files:** Modify `src/agents/strategist.ts`, `src/agents/manager.ts`, `src/agents/bob.ts`.

- [ ] **Step 1: Strategist — annotation rule.** Replace the `## Plan Format` Steps block in
  `strategist.ts` with the annotated format (every step carries wave/parallel/owner/deps):

```ts
## Plan Format
\`\`\`markdown
# Plan: [Title]
## Steps
- [W1] [step] — owner: coder|sub|designer|writer|researcher|vision|critic — parallel: yes|no — deps: none — files: [list] — risk: low|med|high
- [W1] [step] — owner: ... — parallel: yes — deps: none — files: [...]
- [W2] [step] — owner: ... — parallel: no  — deps: W1 — files: [...]
- [W3] Review + visual check — owner: critic — parallel: no — deps: W2
\`\`\`
RULE: maximize \`parallel: yes\` within a wave; serialize only on real file overlap or data deps.
Every plan MUST end with a Critic review wave; if any step touches UI files, that review MUST include a Vision browser pass.
```

- [ ] **Step 2: Manager — wave dispatch rule.** Add to `manager.ts` Key Rules:

```ts
6. **Parallel Waves**: Execute waves in parallel whenever possible. For each wave, read the Strategist annotations and fire ALL \`parallel: yes\` steps as concurrent task() calls to their annotated \`owner\` (up to 5 at once). Collect ALL results before advancing to the next wave. Serialize only \`parallel: no\` or file-overlapping steps.
```

- [ ] **Step 3: Bob — same rule, lighter.** Add to `bob.ts` Key Rules:

```ts
7. **Parallel Waves**: When a plan has independent steps, dispatch them in parallel (concurrent task() calls to the annotated owners) rather than one at a time. Serialize only on dependencies or file overlap.
```

- [ ] **Step 4: Build + commit.**
  Run: `bun run build` — Expected: exit 0.
  ```bash
  git add src/agents/strategist.ts src/agents/manager.ts src/agents/bob.ts
  git commit -m "feat(bob): parallel-wave planning + dispatch prompts"
  ```

---

## Task 9: Deletions (R-3 + R-4) — INTEGRATOR ONLY

> Do this AFTER Tasks 1-8 are green so the controller replaces the deleted loop stubs. Honor §R.4a
> PRESERVE — touch ONLY the files below.

- [ ] **Step 1: Delete the dead BackgroundManager + tools + wiring.**
  ```bash
  cd /mnt/ai_data/projects/hiai-bob
  rm -rf src/features/background-manager src/tools/background-task
  ```
  In `src/index.ts` remove: the `BackgroundManager` import, `backgroundOutputTool`/`backgroundCancelTool`/
  `setBackgroundManager` imports, the `bgManager` construction + `setClient` + `setBackgroundManager`,
  the two tool entries in `allTools`, and `bgManager.dispose()`. In `src/config/index.ts` + `hiai-bob.json`
  remove the `background_manager` block.

- [ ] **Step 2: Delete redundant + stub hooks** (per `bob-todo.md §8` table). For EACH name: delete the
  file and remove its import + `ALL_NAMED_HOOK_FACTORIES` entry in `src/hooks/index.ts`:
  ```
  reasoning-content-cache thinking-block-validator tool-pair-validator model-fallback runtime-fallback
  session-recovery preemptive-compaction compaction-context-injector compaction-todo-preserver
  context-window-monitor context-window-limit-recovery token-budget edit-error-recovery json-error-recovery
  rules-injector directory-agents-injector think-mode background-notification sub-notepad
  unstable-agent-babysitter session-notification start-work stop-continuation-guard session-todo-status
  ralph-loop todo-continuation manager-guard sub-agent-receipt
  ```
  ```bash
  for h in reasoning-content-cache thinking-block-validator tool-pair-validator model-fallback runtime-fallback session-recovery preemptive-compaction compaction-context-injector compaction-todo-preserver context-window-monitor context-window-limit-recovery token-budget edit-error-recovery json-error-recovery rules-injector directory-agents-injector think-mode background-notification sub-notepad unstable-agent-babysitter session-notification start-work stop-continuation-guard session-todo-status ralph-loop todo-continuation manager-guard sub-agent-receipt; do rm -f "src/hooks/$h.ts"; done
  ```
  Then edit `src/hooks/index.ts` to remove all matching imports + entries (keep: completion-controller,
  closure-injector, quality-gate, keyword-detector, non-interactive-env, tool-output-truncator).

- [ ] **Step 3: Prune unused hook-point registrations** in `src/index.ts` if a point lost all handlers
  (compare the kept hooks' points against the `result` object's `"experimental.*"` keys).

- [ ] **Step 4: Typecheck + build — fix every dangling import.**
  Run: `bun run typecheck && bun run build` — Expected: exit 0. Resolve any references to deleted symbols.

- [ ] **Step 5: Commit.**
  ```bash
  git add -A
  git commit -m "refactor(bob): delete dead BackgroundManager + ~28 mimo-redundant/stub hooks"
  ```

---

## Task 10: Keep-list verification (R-5)

**Files:** read-only investigation; possibly delete 2 more hooks.

- [ ] **Step 1: Verify `non-interactive-env` vs mimo.**
  ```bash
  BIN=$(readlink -f "$(which opencode)")
  grep -a -oiE "(interactive|tty|stdin).{0,30}(command|bash|not? ?(a )?tty)" "$BIN" | sort -u | head
  ```
  If mimo already blocks interactive bash, delete `src/hooks/non-interactive-env.ts` + its registration.

- [ ] **Step 2: Verify `tool-output-truncator` vs mimo.**
  ```bash
  grep -a -oiE "(truncat|output.{0,8}(limit|cap|too large))" "$BIN" | sort -u | head
  ```
  If mimo truncates tool output natively, delete `src/hooks/tool-output-truncator.ts` + its registration.

- [ ] **Step 3: Confirm §R.4a PRESERVE list intact.**
  ```bash
  grep -nE "context7|grep_app|sequential-thinking" src/mcp/registry.ts
  grep -rn "firecrawl-cli" src/agents
  grep -rn "POSTGRES_RULES" src/agents
  ls src/tools  # agent-browser glob grep lsp session-manager (no background-task)
  ls skills | wc -l; ls design-systems | wc -l
  ```
  Expected: all present (background-task gone). Build green.

- [ ] **Step 4: Commit any deletions.**
  ```bash
  git add -A && git commit -m "chore(bob): keep-list verification + prune mimo-covered hooks"
  ```

---

## Task 11: README + final verification

**Files:** Modify `README.md`.

- [ ] **Step 1:** Update README: hook count (~5-6), describe the completion-controller (autonomy +
  Critic gate), parallel-wave model, native memory; remove any remaining stub-feature claims and the
  comparison table's stale rows.

- [ ] **Step 2: Full gate.**
  Run: `bun run typecheck && bun test && bun run build` — Expected: all green; `decide`/`signals` tests pass.

- [ ] **Step 3: Commit.**
  ```bash
  git add README.md && git commit -m "docs(bob): README reflects thin-layer architecture"
  ```

---

## Self-Review (spec coverage vs §R)

- §R.2 completion-controller → Tasks 2-7 (config, decide, signals, state, glue, register). ✓
- §R.3 parallelism prompts → Task 8 (strategist/manager/bob). ✓
- §R.4 deletions + cancellations → Task 9. ✓
- §R.4a PRESERVE guardrail → Task 10 Step 3 verification. ✓
- §R.5 keep-list verification → Task 10. ✓
- §R.6/R.7 DoD → Tasks 9-11 + the full gate in Task 11. ✓
- Open risk (flagged, not hidden): critic-parent attribution + idle-payload shape depend on Task 1
  spike; Task 6 notes the fallback. Do Task 1 before Task 6.

## Notes / known risks
- **Spike-gated glue:** if the spike (Task 1) finds MiMo auto-continues natively or doesn't expose
  `parentID`, adjust Task 6 (gate the loop / use time-window critic attribution) before proceeding.
- **`mergeHookSets` swallows throws** — the controller must never rely on throwing to block; it acts
  only by re-prompting via `client.session.prompt`. (Already the design.)
- **Security (separate, not in this plan):** move `firecrawl`/`context7` keys out of `hiai-bob.json`
  `auth` into env (§7.3) before any push.
