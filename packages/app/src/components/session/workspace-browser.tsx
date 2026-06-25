import { createMemo, createResource, For, Show } from "solid-js"
import { Icon } from "@mimo-ai/ui/icon"
import { Tooltip } from "@mimo-ai/ui/tooltip"
import { useSDK } from "@/context/sdk"
import { useLayout } from "@/context/layout"
import { asWorkspaceID, type WorkspaceID } from "@/context/workspace-clients"

type WorkspaceOption = {
  id: WorkspaceID
  branch?: string
  type?: string
}

/**
 * Compact directory-level workspace browser. Fetches the list of workspaces
 * the server reports for `directory` and exposes a control that lets the
 * user pick one for the next session they create in this directory. The
 * selection is stored on the layout's primary grid cell so subsequent
 * "New session" actions target the chosen workspace via the
 * workspace-scoped SDK client.
 *
 * Mirrors the TUI's directory-level workspace switching: the browser is a
 * directory-scoped surface (lives outside the grid), while per-cell
 * workspace selection happens inside `CellSessionPicker` for already-empty
 * cells.
 */
export function WorkspaceBrowser(props: { directory: string }) {
  const sdk = useSDK()
  const layout = useLayout()

  const [workspaces] = createResource(
    () => props.directory,
    async (dir): Promise<WorkspaceOption[]> => {
      const result = await sdk.client.experimental.workspace.list({ directory: dir }).catch(() => undefined)
      const list = result?.data
      if (!Array.isArray(list)) return []
      const out: WorkspaceOption[] = []
      for (const w of list) {
        if (!w || typeof w !== "object") continue
        const id = (w as { id?: unknown }).id
        const branch = (w as { branch?: unknown }).branch
        const type = (w as { type?: unknown }).type
        if (typeof id !== "string" || !id) continue
        out.push({
          id: asWorkspaceID(id),
          branch: typeof branch === "string" ? branch : undefined,
          type: typeof type === "string" ? type : undefined,
        })
      }
      return out
    },
  )

  const active = createMemo<WorkspaceID>(() => asWorkspaceID(layout.grid.workspace(props.directory)()))

  const select = (next: WorkspaceID) => {
    layout.grid.setWorkspace(props.directory, next)
    const cells = layout.grid.cells(props.directory)()
    const primary = cells[0]
    if (primary) {
      layout.grid.updateCell(props.directory, primary.sessionID, { workspaceID: next })
    }
  }

  return (
    <div class="flex items-center gap-1.5 px-2 py-1 text-11-regular text-text-weak">
      <Tooltip placement="bottom" value="Workspace">
        <Icon name="branch" size="small" class="text-icon-weak" />
      </Tooltip>
      <span>Workspace:</span>
      <select
        class="rounded bg-transparent text-text-base outline-none focus:outline-none hover:text-text-strong"
        value={active()}
        onChange={(e) => select(asWorkspaceID(e.currentTarget.value))}
      >
        <option value="">Default</option>
        <Show when={(workspaces() ?? []).length > 0}>
          <For each={workspaces() ?? []}>{(opt) => <option value={opt.id}>{opt.branch || opt.id}</option>}</For>
        </Show>
      </select>
    </div>
  )
}
