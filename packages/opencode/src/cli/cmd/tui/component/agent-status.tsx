import { For, Match, Show, Switch, createMemo } from "solid-js"
import type { ActorEntry } from "../context/sync"
import { useTheme } from "../context/theme"

export interface AgentStatusProps {
  /**
   * Actor rows for the session, as exposed by the sync bucket (`sync.data.actor[sessionID]`).
   * The component is purely presentational — no data fetching is duplicated here.
   */
  actors: ActorEntry[]
  /**
   * Optional "now" override (ms epoch). Tests pass a frozen clock; in production the
   * call site falls back to `Date.now()` so the duration readout stays live.
   */
  now?: () => number
}

const STATUS_LABEL: Record<ActorEntry["status"], string> = {
  pending: "pending",
  running: "working",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
  unknown: "unknown",
}

const STATUS_DOT: Record<ActorEntry["status"], "warning" | "success" | "error" | "textMuted"> = {
  pending: "warning",
  running: "warning",
  completed: "success",
  failed: "error",
  cancelled: "textMuted",
  unknown: "textMuted",
}

function formatDuration(ms: number): string {
  if (ms < 0 || !Number.isFinite(ms)) return "0s"
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remSec = seconds % 60
  if (minutes < 60) return remSec ? `${minutes}m ${remSec}s` : `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remMin = minutes % 60
  return remMin ? `${hours}h ${remMin}m` : `${hours}h`
}

/**
 * Compact card summarizing the actors registered against the current session.
 * One row per actor — the row only renders when there is at least one actor,
 * so empty sessions show nothing (the caller decides what "empty" means).
 */
export function AgentStatus(props: AgentStatusProps) {
  const { theme } = useTheme()

  const rows = createMemo(() =>
    [...props.actors].sort((a, b) => {
      // Running first, then pending, then terminal — gives an at-a-glance "what is
      // happening right now" without forcing the caller to pre-sort.
      const order: Record<ActorEntry["status"], number> = {
        running: 0,
        pending: 1,
        completed: 2,
        failed: 3,
        cancelled: 4,
        unknown: 5,
      }
      const diff = order[a.status] - order[b.status]
      if (diff !== 0) return diff
      return a.time_created - b.time_created
    }),
  )

  const live = () => (props.now ? props.now() : Date.now())

  return (
    <Show when={rows().length > 0}>
      <box gap={1} flexDirection="column">
        <text fg={theme.text}>
          <b>Agents</b>
        </text>
        <For each={rows()}>
          {(actor) => {
            const dot = () => STATUS_DOT[actor.status]
            const label = () => STATUS_LABEL[actor.status]
            // Duration: anchor at creation for pending; on the latest turn for
            // terminal states. Falls back to `time_updated` so completed rows
            // don't grow indefinitely.
            const durationMs = () => {
              const end = actor.status === "running" || actor.status === "pending" ? live() : actor.time_updated
              return Math.max(0, end - actor.time_created)
            }
            return (
              <box flexDirection="row" gap={1}>
                <text flexShrink={0} style={{ fg: theme[dot()] }}>
                  •
                </text>
                <box flexGrow={1} flexDirection="column">
                  <box flexDirection="row" gap={1} justifyContent="space-between">
                    <text fg={theme.text} wrapMode="none">
                      <b>{actor.agent || actor.actor_id}</b>
                    </text>
                    <text flexShrink={0} fg={theme[dot()]}>
                      {label()}
                    </text>
                  </box>
                  <Show when={actor.description}>
                    <text fg={theme.textMuted} wrapMode="word">
                      {actor.description}
                    </text>
                  </Show>
                  <box flexDirection="row" gap={1}>
                    <text fg={theme.textMuted}>
                      <Switch>
                        <Match when={actor.mode === "main"}>main</Match>
                        <Match when={actor.mode === "subagent"}>subagent</Match>
                        <Match when={actor.mode === "peer"}>peer</Match>
                      </Switch>
                    </text>
                    <text fg={theme.textMuted}>·</text>
                    <text fg={theme.textMuted}>{actor.turn_count} turns</text>
                    <text fg={theme.textMuted}>·</text>
                    <text fg={theme.textMuted}>{formatDuration(durationMs())}</text>
                  </box>
                </box>
              </box>
            )
          }}
        </For>
      </box>
    </Show>
  )
}
