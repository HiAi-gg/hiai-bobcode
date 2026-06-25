import { createEffect, createMemo, createResource, createSignal, For, Show } from "solid-js"
import { getFilename } from "@mimo-ai/shared/util/path"
import { DropdownMenu } from "@mimo-ai/ui/dropdown-menu"
import { Icon } from "@mimo-ai/ui/icon"
import { showToast } from "@mimo-ai/ui/toast"
import { useGlobalSync } from "@/context/global-sync"
import { useLayout } from "@/context/layout"
import { sortedRootSessions } from "@/pages/layout/helpers"
import { sessionTitle } from "@/utils/session-title"
import { useWorkspaceClients, asWorkspaceID, type WorkspaceID } from "@/context/workspace-clients"
import { useSync } from "@/context/sync"
import { useLanguage } from "@/context/language"
import { useSessionScope } from "@/context/session-scope"
import { useSDK } from "@/context/sdk"

/**
 * Empty grid cell — click to open a project session in the slot. Lists the
 * directory's sessions (excluding the ones already shown) and adds the chosen
 * one via `layout.grid.addCell`. The "New session" entry calls the
 * workspace-aware SDK so the new session is bound to the cell's workspace
 * and added as a full grid cell. The workspace selector above the picker
 * lists workspaces known to the server for this directory; switching it
 * affects what the "New session" button binds the new cell to (and is the
 * hook for switching an existing cell's workspace once that flow lands).
 */
export function CellSessionPicker(props: { dir: string; primaryId?: string }) {
  const layout = useLayout()
  const globalSync = useGlobalSync()
  const sdk = useSDK()
  const sync = useSync()
  const workspaceClients = useWorkspaceClients()
  const language = useLanguage()
  const scope = useSessionScope()
  const [store] = globalSync.child(props.dir, { bootstrap: false })
  const [open, setOpen] = createSignal(false)
  const [busy, setBusy] = createSignal(false)

  // Fetch sessions across all known projects via the experimental endpoint.
  // This surfaces sessions from OTHER projects in the picker dropdown so users
  // can open sessions from any project in any cell slot.
  const [crossProjectRaw] = createResource(
    () => props.dir,
    async () => {
      const result = await sdk.client.experimental.session.list({ roots: true, limit: 30 }).catch(() => undefined)
      return result?.data ?? []
    },
  )

  const taken = createMemo(() => {
    const set = new Set(layout.grid.cellsByID(props.dir)())
    if (props.primaryId) set.add(props.primaryId)
    return set
  })
  const allSessions = createMemo(() => {
    const list: Array<{ project: string; directory: string; sessions: Array<{ id: string; title: string }> }> = []
    const currentSessions = sortedRootSessions(store, Date.now()).filter((s) => !taken().has(s.id))
    if (currentSessions.length > 0) {
      list.push({
        project: "Current Project",
        directory: props.dir,
        sessions: currentSessions,
      })
    }

    // Merge cross-project sessions grouped by project name.
    const cross = crossProjectRaw()
    if (cross && cross.length > 0) {
      const currentIds = new Set(currentSessions.map((s) => s.id))
      const byProjectKey = new Map<
        string,
        {
          name: string
          directory: string
          sessions: Array<{ id: string; title: string; time: { updated: number; created: number } }>
        }
      >()

      for (const s of cross) {
        if (taken().has(s.id) || currentIds.has(s.id)) continue
        if (!s.id || s.parentID || s.time?.archived) continue

        const pkey = s.project?.id ?? s.directory
        let group = byProjectKey.get(pkey)
        if (!group) {
          group = {
            name: s.project?.name ?? getFilename(s.directory),
            directory: s.directory,
            sessions: [],
          }
          byProjectKey.set(pkey, group)
        }
        group.sessions.push(s)
      }

      for (const group of byProjectKey.values()) {
        if (group.sessions.length === 0) continue
        group.sessions.sort((a, b) => {
          const aUpdated = a.time.updated ?? a.time.created
          const bUpdated = b.time.updated ?? b.time.created
          return bUpdated - aUpdated
        })
        list.push({
          project: group.name,
          directory: group.directory,
          sessions: group.sessions,
        })
      }
    }

    return list
  })

  // Maintain local workspace signal initialized to scope or active directory workspace
  const [cellWorkspaceID, setCellWorkspaceID] = createSignal<WorkspaceID>(
    asWorkspaceID(scope.workspaceID ?? layout.grid.workspace(props.dir)()),
  )

  createEffect(() => {
    setCellWorkspaceID(asWorkspaceID(scope.workspaceID ?? layout.grid.workspace(props.dir)()))
  })

  // Server-known workspaces for this directory. Used to populate the
  // workspace selector so users can target a specific workspace when
  // creating a new session in this slot. `null` while loading; empty list
  // when the server reports no workspaces (legacy / single-workspace dirs).
  const [workspaces] = createResource(
    () => props.dir,
    async (dir) => {
      const result = await sdk.client.experimental.workspace.list({ directory: dir }).catch(() => undefined)
      const list = result?.data
      if (!Array.isArray(list)) return []
      const out: Array<{ id: WorkspaceID; branch?: string; type?: string }> = []
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

  const switchWorkspace = (next: WorkspaceID) => {
    setCellWorkspaceID(next)
    if (scope.id) {
      layout.grid.updateCell(props.dir, scope.id, { workspaceID: next })
      return
    }
    showToast({
      title: "Workspace selection",
      description: `New sessions in this slot will open in workspace ${next || "(default)"}.`,
    })
  }

  const createSession = async () => {
    setBusy(true)
    try {
      const workspaceID = cellWorkspaceID()
      // Use route-scoped SDK when no explicit workspace selected (default = same project as sidebar)
      // This ensures session.created SSE event goes to the sidebar's directory store
      const useWorkspaceClient = workspaceID !== ""
      const client = useWorkspaceClient ? workspaceClients.clientFor(workspaceID) : sdk.client
      const result = await client.session
        .create(useWorkspaceClient ? { workspace: workspaceID } : undefined)
        .catch(() => undefined)
      const sessionID = result?.data?.id
      const directory = result?.data?.directory
      if (!sessionID) {
        showToast({
          variant: "error",
          title: language.t("common.requestFailed"),
          description: "Failed to create session",
        })
        return
      }
      layout.grid.addCell(props.dir, sessionID, {
        workspaceID,
        label: "New Session",
        directory,
      })
      // Make sure the new session's events flow into the sync store.
      void sync.session.sync(sessionID).catch(() => undefined)
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div class="flex size-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border-weak-base bg-background-stronger p-3">
      <WorkspaceSelector current={cellWorkspaceID()} options={workspaces() ?? []} onSelect={switchWorkspace} />
      <DropdownMenu gutter={4} placement="bottom" open={open()} onOpenChange={setOpen}>
        <DropdownMenu.Trigger class="flex flex-col items-center justify-center gap-1 rounded-md px-4 py-3 text-text-weak transition-colors hover:bg-background-base hover:text-text-base">
          <span class="text-16-regular">+</span>
          <span class="text-12-regular">Open session</span>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content class="max-h-80 overflow-y-auto">
            <DropdownMenu.Group>
              <DropdownMenu.GroupLabel>New</DropdownMenu.GroupLabel>
              <DropdownMenu.Item disabled={busy()} onSelect={() => void createSession()}>
                <DropdownMenu.ItemLabel>{busy() ? "Creating…" : "New session"}</DropdownMenu.ItemLabel>
              </DropdownMenu.Item>
            </DropdownMenu.Group>
            <For each={allSessions()}>
              {(group) => (
                <DropdownMenu.Group>
                  <DropdownMenu.GroupLabel>{group.project}</DropdownMenu.GroupLabel>
                  <For each={group.sessions}>
                    {(s) => (
                      <DropdownMenu.Item
                        onSelect={() => {
                          layout.grid.addCell(props.dir, s.id, {
                            directory: group.directory,
                          })
                          setOpen(false)
                        }}
                      >
                        <DropdownMenu.ItemLabel>{sessionTitle(s.title)}</DropdownMenu.ItemLabel>
                      </DropdownMenu.Item>
                    )}
                  </For>
                </DropdownMenu.Group>
              )}
            </For>
            <Show when={allSessions().length === 0}>
              <DropdownMenu.Group>
                <DropdownMenu.Item disabled>
                  <DropdownMenu.ItemLabel>No other sessions</DropdownMenu.ItemLabel>
                </DropdownMenu.Item>
              </DropdownMenu.Group>
            </Show>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>
    </div>
  )
}

/**
 * Inline dropdown listing the workspaces the server reports for the active
 * directory. Used inside the grid cell picker so users can target a
 * specific workspace when creating a new cell. Mirrors the TUI's
 * workspace selector per cell — switching one cell doesn't affect others
 * because the selection lives on the cell (or, for empty slots, on the
 * picker's local default).
 */
function WorkspaceSelector(props: {
  current: WorkspaceID
  options: Array<{ id: WorkspaceID; branch?: string; type?: string }>
  onSelect: (next: WorkspaceID) => void
}) {
  const [open, setOpen] = createSignal(false)
  const currentLabel = createMemo(() => {
    if (!props.current) return "Default workspace"
    const match = props.options.find((o) => o.id === props.current)
    return match?.branch || match?.id || props.current
  })
  return (
    <DropdownMenu gutter={4} placement="top" open={open()} onOpenChange={setOpen}>
      <DropdownMenu.Trigger class="flex items-center gap-1 rounded-md px-2 py-1 text-12-regular text-text-weak transition-colors hover:bg-background-base hover:text-text-base">
        <Icon name="branch" size="small" />
        <span class="truncate max-w-32">{currentLabel()}</span>
        <Icon name="chevron-down" size="small" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content>
          <DropdownMenu.Group>
            <DropdownMenu.GroupLabel>Workspace</DropdownMenu.GroupLabel>
            <DropdownMenu.Item
              onSelect={() => {
                props.onSelect(asWorkspaceID(""))
                setOpen(false)
              }}
            >
              <DropdownMenu.ItemLabel>Default workspace</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <For each={props.options}>
              {(opt) => (
                <DropdownMenu.Item
                  onSelect={() => {
                    props.onSelect(opt.id)
                    setOpen(false)
                  }}
                >
                  <DropdownMenu.ItemLabel>{opt.branch || opt.id}</DropdownMenu.ItemLabel>
                </DropdownMenu.Item>
              )}
            </For>
            <Show when={props.options.length === 0}>
              <DropdownMenu.Item disabled>
                <DropdownMenu.ItemLabel>No workspaces</DropdownMenu.ItemLabel>
              </DropdownMenu.Item>
            </Show>
          </DropdownMenu.Group>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu>
  )
}
