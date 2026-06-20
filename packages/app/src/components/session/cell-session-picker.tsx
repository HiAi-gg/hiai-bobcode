import { createMemo, createSignal, For, Show } from "solid-js"
import { DropdownMenu } from "@mimo-ai/ui/dropdown-menu"
import { useGlobalSync } from "@/context/global-sync"
import { useLayout } from "@/context/layout"
import { sortedRootSessions } from "@/pages/layout/helpers"
import { sessionTitle } from "@/utils/session-title"

/**
 * Empty grid cell — click to open a project session in the slot. Lists the
 * directory's sessions (excluding the ones already shown) and adds the chosen
 * one via layout.grid.addCell. "New session" is wired in Phase 2.
 */
export function CellSessionPicker(props: { dir: string; primaryId?: string }) {
  const layout = useLayout()
  const globalSync = useGlobalSync()
  const [store] = globalSync.child(props.dir, { bootstrap: false })
  const [open, setOpen] = createSignal(false)

  const taken = createMemo(() => {
    const set = new Set(layout.grid.cells(props.dir)())
    if (props.primaryId) set.add(props.primaryId)
    return set
  })
  const sessions = createMemo(() => sortedRootSessions(store, Date.now()).filter((s) => !taken().has(s.id)))

  return (
    <div class="flex size-full items-center justify-center rounded-md border border-dashed border-border-weak-base bg-background-stronger">
      <DropdownMenu gutter={4} placement="bottom" open={open()} onOpenChange={setOpen}>
        <DropdownMenu.Trigger class="flex flex-col items-center justify-center gap-1 rounded-md px-4 py-3 text-text-weak transition-colors hover:bg-background-base hover:text-text-base">
          <span class="text-16-regular">+</span>
          <span class="text-12-regular">Open session</span>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
        <DropdownMenu.Content class="max-h-80 overflow-y-auto">
          <DropdownMenu.Group>
            <DropdownMenu.GroupLabel>New</DropdownMenu.GroupLabel>
            <DropdownMenu.Item disabled>
              <DropdownMenu.ItemLabel>New session (coming soon)</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
          </DropdownMenu.Group>
          <DropdownMenu.Group>
            <DropdownMenu.GroupLabel>Open existing</DropdownMenu.GroupLabel>
            <For each={sessions()}>
              {(s) => (
                <DropdownMenu.Item
                  onSelect={() => {
                    layout.grid.addCell(props.dir, s.id)
                    setOpen(false)
                  }}
                >
                  <DropdownMenu.ItemLabel>{sessionTitle(s.title)}</DropdownMenu.ItemLabel>
                </DropdownMenu.Item>
              )}
            </For>
            <Show when={sessions().length === 0}>
              <DropdownMenu.Item disabled>
                <DropdownMenu.ItemLabel>No other sessions</DropdownMenu.ItemLabel>
              </DropdownMenu.Item>
            </Show>
          </DropdownMenu.Group>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>
    </div>
  )
}
