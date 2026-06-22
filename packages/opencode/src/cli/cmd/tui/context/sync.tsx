import type {
  Message,
  Agent,
  Provider,
  Session,
  Part,
  Config,
  Todo,
  SessionTaskResponse,
  Command,
  PermissionRequest,
  QuestionRequest,
  LspStatus,
  McpStatus,
  McpResource,
  FormatterStatus,
  SessionStatus,
  ProviderListResponse,
  ProviderAuthMethod,
  VcsInfo,
} from "@mimo-ai/sdk/v2"
import { createStore, produce, reconcile, type SetStoreFunction } from "solid-js/store"
import { useProject } from "@tui/context/project"
import { useSDK } from "@tui/context/sdk"
import { useWorkspaceClients, asWorkspaceID } from "./workspace-clients"
import { Binary } from "@mimo-ai/shared/util/binary"
import { createSimpleContext } from "./helper"
import type { Snapshot } from "@/snapshot"
import { useExit } from "./exit"
import { useArgs } from "./args"
import { batch, onMount } from "solid-js"
import { Log } from "@/util"
import { emptyConsoleState, type ConsoleState } from "@/config/console-state"

/**
 * The SDK regenerated the task list as an inline anonymous array on
 * `SessionTaskResponse` rather than a named `Task` export (the zod schema is not
 * surfaced as a reusable component). Derive the element type so the store and
 * plugin API stay in lockstep with the server's `GET /:sessionID/task` shape.
 */
export type Task = SessionTaskResponse[number]

/**
 * TUI-side view of a dynamic-workflow run (server route `GET /workflows`, bus
 * events `workflow.started/phase/finished`). The list route serializes the
 * runtime's `RunSummary` but is described as `z.array(z.any())`, so the SDK gen
 * surfaces it as `Array<unknown>` rather than a named export — mirror the
 * server's `RunSummary` shape here so the store and the dialog stay in lockstep.
 */
export type WorkflowRun = {
  runID: string
  sessionID: string
  name: string
  status: string
  running: number
  succeeded: number
  failed: number
  currentPhase?: string
  parentActorID?: string
  args?: unknown
  error?: string
  createdAt?: number
  updatedAt?: number
}

/**
 * TUI-side view of a session's stop-condition goal (server event `session.goal`).
 * `condition` is the active goal (undefined once cleared/satisfied/impossible).
 * `verdicts` accumulates each judge verdict keyed by the assistant message it
 * evaluated, so a per-turn marker can be rendered against the right turn and the
 * user can trace back which turn failed the check. `lastMessageID` points at the
 * most recently judged turn.
 */
export type GoalVerdict = {
  ok: boolean
  impossible?: boolean
  reason: string
  attempt: number
  error?: boolean
}

export type SessionGoal = {
  condition?: string
  verdicts: { [messageID: string]: GoalVerdict }
  lastMessageID?: string
}

export type ActorEntry = {
  actor_id: string
  session_id: string
  mode: "subagent" | "peer" | "main"
  status: "pending" | "running" | "completed" | "failed" | "cancelled" | "unknown"
  agent: string
  description: string
  parent_actor_id: string | null
  time_created: number
  time_updated: number
  turn_count: number
  last_turn_time: number | null
}

function actorStatusFromEvent(
  s: "pending" | "running" | "idle",
  outcome: "success" | "failure" | "cancelled" | undefined,
): ActorEntry["status"] {
  if (s === "pending") return "pending"
  if (s === "running") return "running"
  if (outcome === "success") return "completed"
  if (outcome === "failure") return "failed"
  if (outcome === "cancelled") return "cancelled"
  return "unknown"
}

export function bucketMessages<M extends { agentID?: string | null }>(msgs: M[]): Record<string, M[]> {
  const out: Record<string, M[]> = {}
  for (const m of msgs) {
    const k = m.agentID ?? "main"
    if (!out[k]) out[k] = []
    out[k].push(m)
  }
  return out
}

/**
 * Per-workspace sync state. One bucket is created per workspaceID on first
 * access; the bucket's `status` field drives the overall `SyncProvider`
 * readiness. Mirrors the previous flat store so consumers (event handlers,
 * components) keep working on a single store keyed by the current workspace.
 */
type SyncState = {
  status: "loading" | "partial" | "complete"
  provider: Provider[]
  provider_default: Record<string, string>
  provider_next: ProviderListResponse
  console_state: ConsoleState
  provider_auth: Record<string, ProviderAuthMethod[]>
  agent: Agent[]
  command: Command[]
  permission: {
    [sessionID: string]: PermissionRequest[]
  }
  question: {
    [sessionID: string]: QuestionRequest[]
  }
  config: Config
  session: Session[]
  session_status: {
    [sessionID: string]: SessionStatus
  }
  session_goal: {
    [sessionID: string]: SessionGoal
  }
  session_diff: {
    [sessionID: string]: Snapshot.FileDiff[]
  }
  session_cwd: {
    [sessionID: string]: string
  }
  todo: {
    [sessionID: string]: Todo[]
  }
  task: {
    [sessionID: string]: Task[]
  }
  message: {
    [sessionID: string]: {
      [agentID: string]: Message[]
    }
  }
  part: {
    [messageID: string]: Part[]
  }
  lsp: LspStatus[]
  mcp: {
    [key: string]: McpStatus
  }
  mcp_resource: {
    [key: string]: McpResource
  }
  instructions: string[]
  formatter: FormatterStatus[]
  vcs: VcsInfo | undefined
  actor: {
    [sessionID: string]: ActorEntry[]
  }
  workflow: {
    [runID: string]: WorkflowRun
  }
}

function emptySyncState(): SyncState {
  return {
    provider_next: {
      all: [],
      default: {},
      connected: [],
    },
    console_state: emptyConsoleState,
    provider_auth: {},
    config: {},
    status: "loading",
    agent: [],
    permission: {},
    question: {},
    command: [],
    provider: [],
    provider_default: {},
    session: [],
    session_status: {},
    session_goal: {},
    session_diff: {},
    session_cwd: {},
    todo: {},
    task: {},
    message: {},
    part: {},
    lsp: [],
    mcp: {},
    mcp_resource: {},
    instructions: [],
    formatter: [],
    vcs: undefined,
    actor: {},
    workflow: {},
  }
}

export const { use: useSync, provider: SyncProvider } = createSimpleContext({
  name: "Sync",
  init: () => {
    // Per-workspace store buckets. Keyed by workspaceID; `undefined` holds the
    // "no current workspace" bucket (the bootstrap pre-workspace state).
    // Each entry is a [state, setStore] pair from `createStore`. Solid's
    // createStore returns a reactive proxy we expose through `getStore`.
    const buckets = new Map<string | undefined, { state: SyncState; set: SetStoreFunction<SyncState> }>()

    const ensureBucket = (workspaceID: string | undefined) => {
      const existing = buckets.get(workspaceID)
      if (existing) return existing
      const [state, set] = createStore<SyncState>(emptySyncState())
      const entry = { state, set }
      buckets.set(workspaceID, entry)
      return entry
    }

    // Active bucket = the one matching the current workspace (or `undefined`
    // before any workspace is selected). The legacy `store` / `setStore`
    // references in this module continue to read/write this active bucket so
    // existing event handlers and bootstrap logic don't need to thread a
    // workspaceID through every call.
    const project = useProject()
    const sdk = useSDK()
    const workspaceClients = useWorkspaceClients()

    const fullSyncedSessions = new Set<string>()
    let syncedWorkspace = project.workspace.current()

    // Subscribe directly to the SDK bus (envelope, not payload) so we can
    // route events to the right workspace bucket. `useEvent()` filters to
    // the current workspace only — fine for single-workspace views, but
    // Phase 1.3 needs the TUI to track every active workspace's events.
    sdk.event.on("event", (envelope) => {
      if (envelope.payload.type === "sync") return
      // Global envelope events (workspace:"", directory:"global") belong to
      // the no-workspace bucket — they affect all workspaces symmetrically.
      const workspaceID = envelope.workspace || undefined
      const bucket = ensureBucket(workspaceID)
      const store = bucket.state
      const setStore = bucket.set
      const event = envelope.payload

      switch (event.type) {
        case "server.instance.disposed":
          void bootstrap()
          break
        case "permission.replied": {
          const requests = store.permission[event.properties.sessionID]
          if (!requests) break
          const match = Binary.search(requests, event.properties.requestID, (r) => r.id)
          if (!match.found) break
          setStore(
            "permission",
            event.properties.sessionID,
            produce((draft) => {
              draft.splice(match.index, 1)
            }),
          )
          break
        }

        case "permission.asked": {
          const request = event.properties
          const requests = store.permission[request.sessionID]
          if (!requests) {
            setStore("permission", request.sessionID, [request])
            break
          }
          const match = Binary.search(requests, request.id, (r) => r.id)
          if (match.found) {
            setStore("permission", request.sessionID, match.index, reconcile(request))
            break
          }
          setStore(
            "permission",
            request.sessionID,
            produce((draft) => {
              draft.splice(match.index, 0, request)
            }),
          )
          break
        }

        case "question.replied":
        case "question.rejected": {
          const requests = store.question[event.properties.sessionID]
          if (!requests) break
          const match = Binary.search(requests, event.properties.requestID, (r) => r.id)
          if (!match.found) break
          setStore(
            "question",
            event.properties.sessionID,
            produce((draft) => {
              draft.splice(match.index, 1)
            }),
          )
          break
        }

        case "question.asked": {
          const request = event.properties
          const requests = store.question[request.sessionID]
          if (!requests) {
            setStore("question", request.sessionID, [request])
            break
          }
          const match = Binary.search(requests, request.id, (r) => r.id)
          if (match.found) {
            setStore("question", request.sessionID, match.index, reconcile(request))
            break
          }
          setStore(
            "question",
            request.sessionID,
            produce((draft) => {
              draft.splice(match.index, 0, request)
            }),
          )
          break
        }

        case "todo.updated":
          setStore("todo", event.properties.sessionID, event.properties.todos)
          break

        case "task.created": {
          const { sessionID, task } = event.properties
          const list = store.task[sessionID]
          if (!list) {
            setStore("task", sessionID, [task])
            break
          }
          const idx = list.findIndex((t) => t.id === task.id)
          setStore(
            "task",
            sessionID,
            produce((draft) => {
              if (idx >= 0) draft[idx] = task
              else draft.push(task)
            }),
          )
          break
        }

        case "task.updated": {
          const { sessionID, task } = event.properties
          const list = store.task[sessionID]
          if (!list) {
            setStore("task", sessionID, [task])
            break
          }
          const idx = list.findIndex((t) => t.id === task.id)
          if (idx < 0) {
            setStore(
              "task",
              sessionID,
              produce((draft) => {
                draft.push(task)
              }),
            )
            break
          }
          setStore("task", sessionID, idx, reconcile(task))
          break
        }

        case "session.diff":
          setStore("session_diff", event.properties.sessionID, event.properties.diff)
          break

        case "session.cwd":
          setStore("session_cwd", event.properties.sessionID, event.properties.cwd)
          break

        case "session.deleted": {
          const result = Binary.search(store.session, event.properties.info.id, (s) => s.id)
          if (result.found) {
            setStore(
              "session",
              produce((draft) => {
                draft.splice(result.index, 1)
              }),
            )
          }
          break
        }
        case "session.updated": {
          const result = Binary.search(store.session, event.properties.info.id, (s) => s.id)
          if (result.found) {
            setStore("session", result.index, reconcile(event.properties.info))
            break
          }
          setStore(
            "session",
            produce((draft) => {
              draft.splice(result.index, 0, event.properties.info)
            }),
          )
          break
        }

        case "session.status": {
          setStore("session_status", event.properties.sessionID, event.properties.status)
          break
        }

        case "session.goal": {
          // Merge: a clear event (goal:undefined) keeps the accumulated verdicts
          // (so per-turn markers persist for traceback); a verdict carrying a
          // messageID is recorded against that turn.
          setStore("session_goal", event.properties.sessionID, (prev) => {
            const verdicts = { ...(prev?.verdicts ?? {}) }
            const v = event.properties.lastVerdict
            let lastMessageID = prev?.lastMessageID
            if (v?.messageID) {
              verdicts[v.messageID] = {
                ok: v.ok,
                impossible: v.impossible,
                reason: v.reason,
                attempt: v.attempt,
                error: v.error,
              }
              lastMessageID = v.messageID
            }
            return {
              condition: event.properties.goal?.condition,
              verdicts,
              lastMessageID,
            }
          })
          break
        }

        case "message.updated": {
          // Bucket every message by agentID. Pre-rewire the TUI dropped non-main
          // messages here; now subagent slices are first-class buckets and the
          // session view renders whichever bucket matches route.agentID.
          const sid = event.properties.info.sessionID
          const aid = event.properties.info.agentID ?? "main"
          if (!store.message[sid]) {
            setStore("message", sid, { [aid]: [event.properties.info] })
            break
          }
          if (!store.message[sid][aid]) {
            setStore("message", sid, aid, [event.properties.info])
            break
          }
          const messages = store.message[sid][aid]
          const result = Binary.search(messages, event.properties.info.id, (m) => m.id)
          if (result.found) {
            setStore("message", sid, aid, result.index, reconcile(event.properties.info))
            break
          }
          setStore(
            "message",
            sid,
            aid,
            produce((draft) => {
              draft.splice(result.index, 0, event.properties.info)
            }),
          )
          const updated = store.message[sid][aid]
          if (updated.length > 100) {
            const oldest = updated[0]
            batch(() => {
              setStore(
                "message",
                sid,
                aid,
                produce((draft) => {
                  draft.shift()
                }),
              )
              setStore(
                "part",
                produce((draft) => {
                  delete draft[oldest.id]
                }),
              )
            })
          }
          break
        }
        case "message.removed": {
          const sid = event.properties.sessionID
          const buckets = store.message[sid]
          if (!buckets) break
          for (const aid of Object.keys(buckets)) {
            const messages = buckets[aid]
            const result = Binary.search(messages, event.properties.messageID, (m) => m.id)
            if (result.found) {
              setStore(
                "message",
                sid,
                aid,
                produce((draft) => {
                  draft.splice(result.index, 1)
                }),
              )
              break
            }
          }
          break
        }
        case "message.part.updated": {
          const parts = store.part[event.properties.part.messageID]
          if (!parts) {
            setStore("part", event.properties.part.messageID, [event.properties.part])
            break
          }
          const result = Binary.search(parts, event.properties.part.id, (p) => p.id)
          if (result.found) {
            setStore("part", event.properties.part.messageID, result.index, reconcile(event.properties.part))
            break
          }
          setStore(
            "part",
            event.properties.part.messageID,
            produce((draft) => {
              draft.splice(result.index, 0, event.properties.part)
            }),
          )
          break
        }

        case "message.part.delta": {
          const parts = store.part[event.properties.messageID]
          if (!parts) break
          const result = Binary.search(parts, event.properties.partID, (p) => p.id)
          if (!result.found) break
          setStore(
            "part",
            event.properties.messageID,
            produce((draft) => {
              const part = draft[result.index]
              const field = event.properties.field as keyof typeof part
              const existing = part[field] as string | undefined
              ;(part[field] as string) = (existing ?? "") + event.properties.delta
            }),
          )
          break
        }

        case "message.part.removed": {
          const parts = store.part[event.properties.messageID]
          const result = Binary.search(parts, event.properties.partID, (p) => p.id)
          if (result.found)
            setStore(
              "part",
              event.properties.messageID,
              produce((draft) => {
                draft.splice(result.index, 1)
              }),
            )
          break
        }

        case "tui.instructions.loaded": {
          setStore("instructions", reconcile(event.properties.files))
          break
        }

        case "lsp.updated": {
          const workspace = project.workspace.current()
          void sdk.client.lsp.status({ workspace }).then((x) => setStore("lsp", x.data ?? []))
          break
        }

        case "vcs.branch.updated": {
          setStore("vcs", { branch: event.properties.branch })
          break
        }

        case "actor.registered": {
          const sid = event.properties.sessionID
          const list = store.actor[sid] ?? []
          if (list.find((a) => a.actor_id === event.properties.actorID)) break
          const entry: ActorEntry = {
            actor_id: event.properties.actorID,
            session_id: event.properties.sessionID,
            mode: event.properties.mode as ActorEntry["mode"],
            status: "pending",
            agent: event.properties.agent,
            description: event.properties.description,
            parent_actor_id: event.properties.parentActorID ?? null,
            time_created: Date.now(),
            time_updated: Date.now(),
            turn_count: 0,
            last_turn_time: null,
          }
          setStore(
            "actor",
            sid,
            [...list, entry].toSorted((a, b) => a.time_created - b.time_created),
          )
          break
        }

        case "actor.status": {
          const sid = event.properties.sessionID
          const list = store.actor[sid] ?? []
          const idx = list.findIndex((a) => a.actor_id === event.properties.actorID)
          if (idx === -1) break
          setStore("actor", sid, idx, {
            status: actorStatusFromEvent(event.properties.status, event.properties.lastOutcome),
            turn_count: event.properties.turnCount,
            last_turn_time: event.properties.lastTurnTime,
            time_updated: Date.now(),
          })
          break
        }

        case "workflow.started": {
          // Upsert a fresh run row; counters stay zero until loadWorkflows /
          // the dialog's poll (T7) refreshes them from the list route.
          setStore("workflow", event.properties.runID, {
            runID: event.properties.runID,
            sessionID: event.properties.sessionID,
            name: event.properties.name,
            status: "running",
            running: 0,
            succeeded: 0,
            failed: 0,
          })
          break
        }

        case "workflow.phase": {
          if (!store.workflow[event.properties.runID]) break
          setStore("workflow", event.properties.runID, "currentPhase", event.properties.title)
          break
        }

        case "workflow.finished": {
          if (!store.workflow[event.properties.runID]) break
          setStore("workflow", event.properties.runID, "status", event.properties.status)
          break
        }
      }
    })

    const exit = useExit()
    const args = useArgs()

    /**
     * Bootstrap a single workspace's bucket from the server. Centralized so
     * the initial `current` bootstrap and any later `bootstrapWorkspace(id)`
     * call share the exact same wire contract.
     */
    async function bootstrapWorkspace(workspaceID: string | undefined, input: { fatal?: boolean } = {}) {
      const fatal = input.fatal ?? true
      const bucket = ensureBucket(workspaceID)
      const store = bucket.state
      const setStore = bucket.set
      // Per-workspace SDK client carries the `x-mimocode-workspace` header so
      // the server routes calls to the right bus. Acquired through the
      // refcounted pool so cells that share a workspace hit a single cached
      // client (and a single SSE subscription), and so the underlying handle
      // is released when the last consumer drops its reference. The
      // `undefined` workspaceID falls back to the SDK's default client.
      const client = workspaceID ? workspaceClients.clientFor(asWorkspaceID(workspaceID)) : sdk.client

      const start = Date.now() - 30 * 24 * 60 * 60 * 1000
      const sessionListPromise = client.session
        .list({ start: start })
        .then((x) => (x.data ?? []).toSorted((a, b) => a.id.localeCompare(b.id)))

      // blocking - include session.list when continuing a session
      const providersPromise = client.config.providers({ workspace: workspaceID }, { throwOnError: true })
      const providerListPromise = client.provider.list({ workspace: workspaceID }, { throwOnError: true })
      const consoleStatePromise = client.experimental.console
        .get({ workspace: workspaceID }, { throwOnError: true })
        .then((x) => x.data)
        .catch(() => emptyConsoleState)
      const agentsPromise = client.app.agents({ workspace: workspaceID }, { throwOnError: true })
      const configPromise = client.config.get({ workspace: workspaceID }, { throwOnError: true })
      const projectPromise = project.sync()
      const blockingRequests: Promise<unknown>[] = [
        providersPromise,
        providerListPromise,
        agentsPromise,
        configPromise,
        projectPromise,
        ...(args.continue ? [sessionListPromise] : []),
      ]

      await Promise.all(blockingRequests)
        .then(async () => {
          const providersResponse = providersPromise.then((x) => x.data!)
          const providerListResponse = providerListPromise.then((x) => x.data!)
          const consoleStateResponse = consoleStatePromise
          const agentsResponse = agentsPromise.then((x) => x.data ?? [])
          const configResponse = configPromise.then((x) => x.data!)
          const sessionListResponse = args.continue ? sessionListPromise : undefined

          return Promise.all([
            providersResponse,
            providerListResponse,
            consoleStateResponse,
            agentsResponse,
            configResponse,
            ...(sessionListResponse ? [sessionListResponse] : []),
          ]).then((responses) => {
            const providers = responses[0]
            const providerList = responses[1]
            const consoleState = responses[2]
            const agents = responses[3]
            const config = responses[4]
            const sessions = responses[5]

            batch(() => {
              setStore("provider", reconcile(providers.providers))
              setStore("provider_default", reconcile(providers.default))
              setStore("provider_next", reconcile(providerList))
              setStore("console_state", reconcile(consoleState))
              setStore("agent", reconcile(agents))
              setStore("config", reconcile(config))
              if (sessions !== undefined) setStore("session", reconcile(sessions))
            })
          })
        })
        .then(() => {
          if (store.status !== "complete") setStore("status", "partial")
          // non-blocking
          void Promise.all([
            ...(args.continue ? [] : [sessionListPromise.then((sessions) => setStore("session", reconcile(sessions)))]),
            consoleStatePromise.then((consoleState) => setStore("console_state", reconcile(consoleState))),
            client.command.list({ workspace: workspaceID }).then((x) => setStore("command", reconcile(x.data ?? []))),
            client.lsp.status({ workspace: workspaceID }).then((x) => setStore("lsp", reconcile(x.data ?? []))),
            client.mcp.status({ workspace: workspaceID }).then((x) => setStore("mcp", reconcile(x.data ?? {}))),
            client.experimental.resource
              .list({ workspace: workspaceID })
              .then((x) => setStore("mcp_resource", reconcile(x.data ?? {}))),
            client.formatter
              .status({ workspace: workspaceID })
              .then((x) => setStore("formatter", reconcile(x.data ?? []))),
            client.session.status({ workspace: workspaceID }).then((x) => {
              setStore("session_status", reconcile(x.data ?? {}))
            }),
            client.provider
              .auth({ workspace: workspaceID })
              .then((x) => setStore("provider_auth", reconcile(x.data ?? {}))),
            client.vcs.get({ workspace: workspaceID }).then((x) => setStore("vcs", reconcile(x.data))),
            project.workspace.sync(),
          ]).then(() => {
            setStore("status", "complete")
          })
        })
        .catch(async (e) => {
          Log.Default.error("tui bootstrap failed", {
            error: e instanceof Error ? e.message : String(e),
            name: e instanceof Error ? e.name : undefined,
            stack: e instanceof Error ? e.stack : undefined,
            workspace: workspaceID,
          })
          if (fatal) {
            await exit(e)
          } else {
            throw e
          }
        })
    }

    /**
     * Bootstrap the current workspace. Kept on the public API (was the only
     * entry point pre-Phase-1.3) so existing callers don't need to track
     * workspace IDs.
     */
    async function bootstrap(input: { fatal?: boolean } = {}) {
      const fatal = input.fatal ?? true
      const workspace = project.workspace.current()
      if (workspace !== syncedWorkspace) {
        fullSyncedSessions.clear()
        syncedWorkspace = workspace
      }
      return bootstrapWorkspace(workspace, { fatal })
    }

    onMount(() => {
      void bootstrap()
    })

    // Read the active bucket's reactive store. Backward-compatible: returns
    // the *current* workspace's store when called without arguments.
    const getStore = (workspaceID?: string): SyncState => ensureBucket(workspaceID ?? project.workspace.current()).state
    const setStoreFor = (workspaceID: string | undefined) =>
      ensureBucket(workspaceID ?? project.workspace.current()).set

    const result = {
      // Legacy single-store view: keeps the current workspace's reactive state.
      // New code should prefer `getStore(workspaceID)` for explicit scoping.
      get data() {
        return getStore()
      },
      // Legacy setStore: targets the current workspace's bucket. Forwards
      // arguments through to Solid's typed setter; consumers can keep using
      // `setStore("path", value)` or `setStore(produce(...))` unchanged.
      set: ((...args: unknown[]) =>
        (setStoreFor(project.workspace.current()) as (...a: unknown[]) => void)(
          ...args,
        )) as SetStoreFunction<SyncState>,
      // Return the reactive state proxy for a specific workspace. Useful for
      // components that need to render data from a non-active workspace.
      getStore,
      // Tear down a workspace's bucket and its cached SDK client. Called by
      // workspace eviction flows so the TUI doesn't leak file handles /
      // signal listeners. Goes through the pool's evict so the refcount is
      // cleared even when cells still hold a reference — callers must reset
      // their cached clients after invoking this.
      evictWorkspace(workspaceID: string) {
        buckets.delete(workspaceID)
        workspaceClients.pool.evict(asWorkspaceID(workspaceID))
      },
      get status() {
        return getStore().status
      },
      get ready() {
        if (process.env.MIMOCODE_FAST_BOOT) return true
        return getStore().status !== "loading"
      },
      get path() {
        return project.instance.path()
      },
      session: {
        get(sessionID: string) {
          const match = Binary.search(getStore().session, sessionID, (s) => s.id)
          if (match.found) return getStore().session[match.index]
          return undefined
        },
        async refresh() {
          const start = Date.now() - 30 * 24 * 60 * 60 * 1000
          const list = await sdk.client.session
            .list({ start })
            .then((x) => (x.data ?? []).toSorted((a, b) => a.id.localeCompare(b.id)))
          setStoreFor(undefined)("session", reconcile(list))
        },
        status(sessionID: string) {
          const session = result.session.get(sessionID)
          if (!session) return "idle"
          if (session.time.compacting) return "compacting"
          const messages = getStore().message[sessionID]?.["main"] ?? []
          const last = messages.at(-1)
          if (!last) return "idle"
          if (last.role === "user") return "working"
          return last.time.completed ? "idle" : "working"
        },
        async sync(sessionID: string) {
          if (fullSyncedSessions.has(sessionID)) return
          const [session, messages, todo, diff, actors, task] = await Promise.all([
            sdk.client.session.get({ sessionID }, { throwOnError: true }),
            sdk.client.session.messages({ sessionID, limit: 100, agent_id: "*" }),
            sdk.client.session.todo({ sessionID }),
            sdk.client.session.diff({ sessionID }),
            sdk.client.session.actors({ sessionID }),
            sdk.client.session.task({ sessionID }),
          ])
          setStoreFor(undefined)(
            produce((draft) => {
              const match = Binary.search(draft.session, sessionID, (s) => s.id)
              if (match.found) draft.session[match.index] = session.data!
              if (!match.found) draft.session.splice(match.index, 0, session.data!)
              draft.todo[sessionID] = todo.data ?? []
              draft.task[sessionID] = task.data ?? []
              const flat = (messages.data ?? []).map((x) => x.info)
              draft.message[sessionID] = bucketMessages(flat)
              for (const message of messages.data ?? []) {
                draft.part[message.info.id] = message.parts
              }
              draft.session_diff[sessionID] = diff.data ?? []
              draft.actor[sessionID] = ((actors.data ?? []) as any[]).map(
                (row): ActorEntry => ({
                  actor_id: row.actorID,
                  session_id: row.sessionID,
                  mode: row.mode,
                  status: actorStatusFromEvent(row.status, row.lastOutcome),
                  agent: row.agent,
                  description: row.description,
                  parent_actor_id: row.parentActorID ?? null,
                  time_created: row.time?.created ?? Date.now(),
                  time_updated: row.time?.updated ?? Date.now(),
                  turn_count: row.turnCount ?? 0,
                  last_turn_time: row.lastTurnTime ?? null,
                }),
              )
            }),
          )
          fullSyncedSessions.add(sessionID)
        },
      },
      bootstrap,
      bootstrapWorkspace,
      loadWorkflows(sessionID: string) {
        void sdk.client.workflow.list({ sessionID }).then((res) => {
          for (const run of (res.data ?? []) as WorkflowRun[])
            setStoreFor(undefined)("workflow", run.runID, reconcile(run))
        })
      },
      resumeWorkflow(runID: string) {
        return sdk.client.workflow.resume({ runID })
      },
    }
    return result
  },
})
