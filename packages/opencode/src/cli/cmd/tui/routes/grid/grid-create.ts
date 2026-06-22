import type { GridContext } from "@tui/context/grid"
import { useSDK } from "@tui/context/sdk"
import { useProject } from "@tui/context/project"
import { useSync } from "@tui/context/sync"
import { useWorkspaceClients, asWorkspaceID } from "@tui/context/workspace-clients"
import type { ToastContext } from "@tui/ui/toast"

/**
 * Create a fresh session via the workspace-aware SDK and add it to the grid
 * as the new active cell. Used by both the `grid_create` keybind and the
 * toolbar "+" button. Replaces the old "navigate to home" behaviour so the
 * action actually opens a new grid cell instead of teleporting the user
 * out of the grid.
 *
 * Returns the new session id on success, or `undefined` when the server
 * call fails — callers can surface a toast on the latter.
 */
export async function createGridSession(input: {
  grid: GridContext
  sdk: ReturnType<typeof useSDK>
  project: ReturnType<typeof useProject>
  sync: ReturnType<typeof useSync>
  workspaceClients: ReturnType<typeof useWorkspaceClients>
  toast: ToastContext
}): Promise<string | undefined> {
  const workspaceID = input.project.workspace.current()
  const client = workspaceID ? input.workspaceClients.clientFor(asWorkspaceID(workspaceID)) : input.sdk.client
  const result = await client.session.create({ workspace: workspaceID }).catch(() => undefined)
  if (!result?.data) {
    input.toast.show({
      message: "Failed to create session",
      variant: "error",
    })
    return undefined
  }
  const sessionID = result.data.id
  input.grid.addCell({
    sessionID,
    workspaceID: workspaceID ?? "",
    mode: "full",
    label: "New Session",
  })
  void input.sync.session.sync(sessionID).catch(() => undefined)
  return sessionID
}
