import type { GlobalEvent } from "@mimo-ai/sdk/v2"
import type { OpencodeClient } from "@mimo-ai/sdk/v2"
import type { Accessor } from "solid-js"
import { createContext, useContext } from "solid-js"
import { createSimpleContext } from "./helper"
import { useSDK } from "./sdk"

/**
 * Branded workspace identifier. Aliasing `string` keeps the call sites ergonomic
 * while preventing accidental cross-domain confusion (e.g. handing a sessionID
 * to a method that wants a workspaceID).
 */
export type WorkspaceID = string & { readonly __brand: "WorkspaceID" }

// The whole point of the brand: a runtime widening that turns an arbitrary
// string into the branded WorkspaceID type. Suppress the unsafe-assertion
// warning at the single site that performs the conversion.
// oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
export const asWorkspaceID = (value: string): WorkspaceID => value as WorkspaceID

/**
 * Per-workspace SDK client lifecycle owner. One pool is created per TUI session
 * and exposed via `WorkspaceClientsProvider`; cells and bootstrap routines call
 * `get(workspaceID)` to acquire a client and `release(workspaceID)` when they
 * no longer need it. The pool refcounts so the underlying `useSDK().getClient`
 * cache is only flushed after the last reference for a workspace drops —
 * multiple cells viewing the same workspace therefore share a single client
 * (and a single SSE stream — see `cell-event-bus.ts`).
 *
 * Lifecycle:
 *   1. `get(id)` — increment refcount, create the client on first access.
 *   2. `release(id)` — decrement refcount, evict when it reaches zero.
 *   3. `evict(id)` — forced teardown regardless of refcount.
 *   4. `destroy()` — flush every cached client. Called on TUI shutdown.
 */
export class WorkspaceClientPool {
  private readonly refs = new Map<WorkspaceID, number>()
  private readonly clients = new Map<WorkspaceID, OpencodeClient>()
  private readonly create: (workspaceID: string) => OpencodeClient
  private readonly cleanup: (workspaceID: string) => void

  constructor(input: { create: (workspaceID: string) => OpencodeClient; cleanup: (workspaceID: string) => void }) {
    this.create = input.create
    this.cleanup = input.cleanup
  }

  /** Acquire a client for the given workspace. Creates it on first access. */
  get(workspaceID: WorkspaceID): OpencodeClient {
    const existing = this.clients.get(workspaceID)
    if (existing) {
      this.refs.set(workspaceID, (this.refs.get(workspaceID) ?? 0) + 1)
      return existing
    }
    const client = this.create(workspaceID)
    this.clients.set(workspaceID, client)
    this.refs.set(workspaceID, 1)
    return client
  }

  /**
   * Release a previously-acquired client. When the refcount for a workspace
   * reaches zero the cached client is flushed via `cleanup` so we don't leak
   * file handles or signal listeners across long-running sessions.
   */
  release(workspaceID: WorkspaceID): void {
    const current = this.refs.get(workspaceID)
    if (!current) return
    const next = current - 1
    if (next > 0) {
      this.refs.set(workspaceID, next)
      return
    }
    this.refs.delete(workspaceID)
    const cached = this.clients.get(workspaceID)
    if (!cached) return
    this.clients.delete(workspaceID)
    this.cleanup(workspaceID)
  }

  /**
   * Force-evict a workspace regardless of refcount. Returns the entries that
   * were flushed so callers can null-check their stored references. Used by
   * workspace eviction flows (server-side removal, manual close) where we
   * don't want to wait for the last cell to release.
   */
  evict(workspaceID: WorkspaceID): { evicted: boolean } {
    const cached = this.clients.get(workspaceID)
    if (!cached) return { evicted: false }
    this.refs.delete(workspaceID)
    this.clients.delete(workspaceID)
    this.cleanup(workspaceID)
    return { evicted: true }
  }

  /** Reference count for a workspace. Returns 0 when uncached. */
  refcount(workspaceID: WorkspaceID): number {
    return this.refs.get(workspaceID) ?? 0
  }

  /** Currently-cached workspaces. Useful for tests and diagnostics. */
  cached(): WorkspaceID[] {
    return [...this.clients.keys()]
  }

  /** Flush every cached client. Idempotent. */
  destroy(): void {
    for (const [id, client] of this.clients) {
      this.cleanup(id)
      // touch to silence "declared but never read" if lint flags it
      void client
    }
    this.clients.clear()
    this.refs.clear()
  }
}

/**
 * Context API exposed to TUI consumers. Wraps the pool with convenience
 * helpers for the `createMemo`-based access pattern cells use to keep the
 * client reactive to workspaceID changes.
 */
export type WorkspaceClientsContext = {
  pool: WorkspaceClientPool
  /**
   * Reactive accessor: returns the cached client for `workspaceID`. Uses
   * `get()` + `release()` under the hood so refcounts track cell lifecycles
   * correctly across Solid re-renders.
   */
  clientFor: (workspaceID: WorkspaceID) => OpencodeClient
  /** Snapshot accessor — true when the pool currently holds a client for `id`. */
  has: (workspaceID: WorkspaceID) => boolean
}

export const { use: useWorkspaceClients, provider: WorkspaceClientsProvider } = createSimpleContext({
  name: "WorkspaceClients",
  init: (): WorkspaceClientsContext => {
    const sdk = useSDK()
    const pool = new WorkspaceClientPool({
      create: (id) => sdk.getClient(id),
      cleanup: (id) => sdk.cleanupClient(id),
    })

    const clientFor = (workspaceID: WorkspaceID) => pool.get(workspaceID)
    const has = (workspaceID: WorkspaceID) => pool.refcount(workspaceID) > 0

    return { pool, clientFor, has }
  },
})

// ---------------------------------------------------------------------------
// Solid wiring: the `clientFor` accessor above is intentionally non-reactive
// (it just hands out a stable client per workspace). Cells that want their
// `cellSDK` accessor to update when `cell.workspaceID` changes should compose
// `clientFor` inside a `createMemo`. The helper below is a convenience for
// that pattern — it returns an `Accessor<OpencodeClient>` that re-evaluates
// whenever `workspaceID()` changes and arranges release of the previous
// workspace's reference on cleanup.
// ---------------------------------------------------------------------------

export function createWorkspaceClientAccessor(input: { workspaceID: Accessor<WorkspaceID> }): Accessor<OpencodeClient> {
  const ctx = useWorkspaceClients()
  let last: WorkspaceID | undefined
  return () => {
    const next = input.workspaceID()
    if (last !== undefined && last !== next) ctx.pool.release(last)
    last = next
    return ctx.clientFor(next)
  }
}

// Re-export the Solid context pair so consumers can opt into the lower-level
// raw provider when they need to wrap a subtree (e.g. for tests).
export const WorkspaceClientsRawContext = createContext<WorkspaceClientsContext>()
export const useWorkspaceClientsRaw = () => {
  const value = useContext(WorkspaceClientsRawContext)
  if (!value) throw new Error("WorkspaceClients raw context must be used within a WorkspaceClientsRaw provider")
  return value
}

/**
 * Helper kept for the cell-event-bus — exposes the underlying `GlobalEvent`
 * envelope type so the bus can reuse the same payload shape without forcing
 * every consumer to re-import from the SDK.
 */
export type { GlobalEvent }
