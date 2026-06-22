import type { Todo } from "@mimo-ai/sdk/v2"
import { For, Index, Show, createMemo } from "solid-js"
import { useTheme } from "../context/theme"
import { TaskItem } from "./task-item"
import { TodoItem } from "./todo-item"
import type { Task } from "../context/sync"

export interface PlanSummaryProps {
  /**
   * Tasks fetched from the session sync bucket (`sync.data.task[sessionID]`).
   * Reuses the same data hooks the sidebar plugins consume — no extra fetches.
   */
  tasks: Task[]
  /**
   * Todos from the session sync bucket (`sync.data.todo[sessionID]`).
   * Optional because sessions can have tasks without todos and vice versa.
   */
  todos?: Todo[]
}

/**
 * Maps a dotted task id (e.g. `1.2.3`) to the visual nesting depth. Mirrors the
 * rule the sidebar task plugin uses so a tree shown here lines up with the same
 * tree in the regular sidebar.
 */
function depthOf(taskId: string): number {
  return taskId.match(/\./g)?.length ?? 0
}

const STATUS_ORDER: Record<string, number> = { in_progress: 0, open: 1, blocked: 2 }

const COMPLETED_LIMIT = 3

/**
 * Full-width plan tree for the grid plan-only mode.
 *
 * Layout: active work (in_progress → open → blocked) on top, a short recent-done
 * tail below, with the todo list shown when no tasks exist yet (matches the
 * rule in `feature-plugins/sidebar/todo.tsx`). Progress is rendered as a
 * task-ratio summary line so the cell works as a dashboard, not just a list.
 */
export function PlanSummary(props: PlanSummaryProps) {
  const { theme } = useTheme()

  // Sort identical to the sidebar — same status order, stable id tiebreak so
  // reorders don't visually jitter between sync ticks.
  const active = createMemo(() =>
    [...props.tasks]
      .filter((t) => t.status === "open" || t.status === "in_progress" || t.status === "blocked")
      .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || a.id.localeCompare(b.id)),
  )

  const done = createMemo(() =>
    [...props.tasks]
      .filter((t) => t.status === "done")
      .sort((a, b) => (b.ended_at ?? 0) - (a.ended_at ?? 0) || a.id.localeCompare(b.id)),
  )

  const recentDone = createMemo(() => done().slice(0, COMPLETED_LIMIT))

  // Aggregate counts drive the headline progress bar. Use `length` rather than
  // counting on every render so reactive reads stay cheap.
  const counts = createMemo(() => ({
    done: props.tasks.filter((t) => t.status === "done").length,
    total: props.tasks.length,
  }))

  const progressText = createMemo(() => {
    const c = counts()
    if (c.total === 0) return ""
    return `${c.done}/${c.total} done`
  })

  const progressPct = createMemo(() => {
    const c = counts()
    if (c.total === 0) return 0
    return Math.round((c.done / c.total) * 100)
  })

  // Fall back to the todo list when no tasks exist yet — same rule the
  // sidebar/todo plugin enforces, so plan-cell and the regular sidebar never
  // disagree about "what's currently visible".
  const todos = createMemo(() => props.todos ?? [])
  const todosVisible = createMemo(
    () => props.tasks.length === 0 && todos().length > 0 && todos().some((t) => t.status !== "completed"),
  )

  const empty = createMemo(() => props.tasks.length === 0 && todos().length === 0)

  return (
    <Show when={!empty()}>
      <box flexDirection="column" gap={1}>
        <box flexDirection="row" gap={1} justifyContent="space-between">
          <text fg={theme.text}>
            <b>Plan</b>
          </text>
          <Show when={progressText()}>
            <text fg={theme.textMuted}>
              {progressText()} · {progressPct()}%
            </text>
          </Show>
        </box>

        <Show when={progressText()}>
          <ProgressBar pct={progressPct()} />
        </Show>

        <Show when={active().length > 0}>
          <Index each={active()}>
            {(item) => (
              <TaskItem
                id={item().id}
                status={item().status}
                summary={item().summary}
                owner={item().owner ?? undefined}
                depth={depthOf(item().id)}
              />
            )}
          </Index>
        </Show>

        <Show when={recentDone().length > 0}>
          <text fg={theme.textMuted}>Recently completed</text>
          <For each={recentDone()}>
            {(task) => (
              <TaskItem
                id={task.id}
                status={task.status}
                summary={task.summary}
                owner={task.owner ?? undefined}
                depth={depthOf(task.id)}
              />
            )}
          </For>
        </Show>

        <Show when={todosVisible()}>
          <text fg={theme.text}>
            <b>Todo</b>
          </text>
          <For each={todos()}>{(item) => <TodoItem status={item.status} content={item.content} />}</For>
        </Show>
      </box>
    </Show>
  )
}

/**
 * Lightweight inline progress bar — full-width colored fill on a muted track.
 * Uses solid block glyphs so it stays readable on terminals without Unicode
 * block-drawing support.
 */
function ProgressBar(props: { pct: number }) {
  const { theme } = useTheme()
  // Cap at 0..100 so a stray upstream value can't break the math.
  const clamped = () => Math.max(0, Math.min(100, props.pct))
  // 20 cells of resolution — fine enough to feel like a bar, coarse enough to
  // look right at typical TUI widths.
  const cells = () => Math.round((clamped() / 100) * 20)
  return (
    <box flexDirection="row" gap={0}>
      <text flexShrink={0} fg={theme.success}>
        {"█".repeat(cells())}
      </text>
      <text flexShrink={0} fg={theme.textMuted}>
        {"░".repeat(20 - cells())}
      </text>
    </box>
  )
}
