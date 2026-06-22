import { createContext, useContext, type ParentProps } from "solid-js"
import { useParams } from "@solidjs/router"

/**
 * The session a subtree is bound to. Defaults to the router params (the active
 * route session), but a grid cell overrides it via SessionScopeProvider so the
 * session contexts (prompt/comments/file/terminal) and useSessionLayout resolve
 * to THAT cell's session instead of the single global route session.
 *
 * Also carries the cell's `workspaceID` so workspace-scoped SDK clients can
 * resolve to the right workspace without forcing every consumer to look up
 * the cell record separately.
 *
 * Exposes `dir`/`id`/`workspaceID` as reactive getters so it's a drop-in
 * for `useParams()`.
 */
export type SessionScope = {
  readonly dir?: string
  readonly id?: string
  readonly workspaceID?: string
}

const Ctx = createContext<SessionScope>()

export function SessionScopeProvider(props: ParentProps<{ dir?: string; id?: string; workspaceID?: string }>) {
  const scope: SessionScope = {
    get dir() {
      return props.dir
    },
    get id() {
      return props.id
    },
    get workspaceID() {
      return props.workspaceID
    },
  }
  return <Ctx.Provider value={scope}>{props.children}</Ctx.Provider>
}

export function useSessionScope(): SessionScope {
  const override = useContext(Ctx)
  if (override) return override
  const params = useParams()
  return {
    get dir() {
      return params.dir
    },
    get id() {
      return params.id
    },
    get workspaceID() {
      // Routes don't carry a workspaceID in the URL — cells do. Default to
      // the empty workspace so legacy consumers (and the workspace pool)
      // see a stable value.
      return undefined
    },
  }
}
