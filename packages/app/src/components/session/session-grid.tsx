import { createMemo, ErrorBoundary, For, Show } from "solid-js"
import { useLayout, type GridCell } from "@/context/layout"
import Page from "@/pages/session"
import { SessionProviders } from "@/components/session/session-providers"
import { CellSessionPicker } from "@/components/session/cell-session-picker"
import { SessionScopeProvider } from "@/context/session-scope"
import { base64Encode } from "@mimo-ai/shared/util/encode"

const GRID_COLS: Record<number, string> = {
  1: "1fr",
  2: "1fr 1fr",
  3: "1fr 1fr 1fr",
  4: "1fr 1fr",
  6: "1fr 1fr 1fr",
  8: "1fr 1fr 1fr 1fr",
}

const GRID_ROWS: Record<number, string> = {
  1: "1fr",
  2: "1fr",
  3: "1fr",
  4: "1fr 1fr",
  6: "1fr 1fr",
  8: "1fr 1fr",
}

// Each cell gets its own session context stack (Terminal/File/Prompt/Comments)
// so parallel sessions have independent state and useFile() etc. resolve.
// The cell record carries its `workspaceID` and `mode` so workspace-aware
// SDK clients can route calls to the right workspace instance.
function Cell(props: { dir: string; cell: GridCell; active: boolean; onActivate?: () => void; onRemove?: () => void }) {
  const cellDir = () => (props.cell.directory ? base64Encode(props.cell.directory) : props.dir)
  return (
    <div
      class="relative overflow-hidden rounded-md border bg-background-stronger"
      classList={{
        "border-border-base ring-1 ring-border-base": props.active,
        "border-border-weak-base": !props.active,
      }}
      onPointerDown={() => props.onActivate?.()}
    >
      {/* Bind this cell's whole subtree to its own session so the session
          contexts (prompt/comments/file/terminal) resolve to it, not the route.
          The cell's workspaceID flows through SessionScope so consumers can
          pick the right workspace-scoped SDK client without re-deriving it
          from the cell record. Only the ACTIVE cell renders "full" (its header
          chrome) — others render "cell" so the top controls aren't duplicated.

          ARCHITECTURAL LIMITATION: SessionScopeProvider sets the scope's `dir`
          per cell, but useSDK() returns the route-level SDK client (setup once
          in SDKProvider from the route param). This means all SDK API calls
          use the route directory, not the cell directory. Direct-ID lookups
          (get, messages) work fine without project context, but directory-scoped
          operations (sync.diff, sync.todo) may use the wrong project directory
          for cross-project cells. A proper fix would require an SDKProvider per
          cell, which is a significant refactor. */}
      <SessionScopeProvider dir={cellDir()} id={props.cell.sessionID} workspaceID={props.cell.workspaceID}>
        <SessionProviders>
          <ErrorBoundary
            fallback={(err: unknown) => (
              <div class="flex size-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border-weak-base bg-background-stronger p-3">
                <div class="text-12-regular text-text-weak">Session unreachable</div>
                <Show when={typeof (err as Error)?.message === "string"}>
                  <div class="max-w-[90%] truncate text-12-regular text-text-weaker">{(err as Error).message}</div>
                </Show>
                <button
                  type="button"
                  class="rounded-md px-1 py-0.5 text-10-regular text-text-weak transition-colors hover:bg-background-base hover:text-text-base"
                  onClick={() => props.onRemove?.()}
                >
                  Remove
                </button>
              </div>
            )}
          >
            <Page sessionID={props.cell.sessionID} mode={props.active ? "full" : "cell"} />
          </ErrorBoundary>
        </SessionProviders>
      </SessionScopeProvider>
    </div>
  )
}

export function SessionGrid(props: { dir: string; primaryId?: string }) {
  const layout = useLayout()
  const mode = createMemo(() => layout.grid.mode(props.dir)())
  const cells = createMemo(() => layout.grid.cells(props.dir)())
  // Cell 0 is always the primary (current route) session — Page handles the
  // new-session state when primaryId is undefined, and its header carries the
  // Grid toggle. Extra cells fill the remaining grid slots.
  const extraCells = createMemo(() => {
    const seen = new Set<string>()
    return cells()
      .filter((c) => c.sessionID !== props.primaryId)
      .filter((c) => {
        if (seen.has(c.sessionID)) return false
        seen.add(c.sessionID)
        return true
      })
      .slice(0, Math.max(0, mode() - 1))
  })
  const emptyCount = createMemo(() => Math.max(0, mode() - 1 - extraCells().length))
  // Primary cell carries the primary session. If the primary session isn't
  // in the grid yet, synthesize an ephemeral cell so the cell chrome still
  // works (it'll be persisted once the user adds the session via the picker).
  const primaryCell = createMemo<GridCell>(() => ({
    id: props.primaryId ?? "primary",
    sessionID: props.primaryId ?? "",
    workspaceID: layout.grid.workspace(props.dir)(),
    mode: "full",
    label: "",
  }))

  // Active cell (by last click) — defaults to the primary. Only it renders "full".
  const activeId = createMemo(() => layout.grid.active(props.dir)() ?? primaryCell().id)
  // SessionScope wants `dir` in the SAME form as the route param (base64). The
  // grid store keeps using the decoded props.dir for its keys.
  const scopeDir = createMemo(() => base64Encode(props.dir))

  return (
    <Show
      when={mode() > 1}
      fallback={
        // mode 1: plain single session (full page + header + Grid toggle).
        <SessionScopeProvider dir={scopeDir()} id={props.primaryId} workspaceID={layout.grid.workspace(props.dir)()}>
          <SessionProviders>
            <Page sessionID={props.primaryId} mode="full" />
          </SessionProviders>
        </SessionScopeProvider>
      }
    >
      <div
        class="size-full grid gap-1 p-1 bg-background-base"
        style={{
          "grid-template-columns": GRID_COLS[mode()],
          "grid-template-rows": GRID_ROWS[mode()],
        }}
      >
        {/* Primary cell keeps mode "full" so its header + Grid toggle stay
            reachable (you can change the grid mode from cell 0). */}
        <Cell
          dir={scopeDir()}
          cell={primaryCell()}
          active={activeId() === primaryCell().id}
          onActivate={() => layout.grid.setActive(props.dir, primaryCell().id)}
          onRemove={() => layout.grid.setMode(props.dir, 1)}
        />
        <For each={extraCells()}>
          {(cell) => (
            <Cell
              dir={scopeDir()}
              cell={cell}
              active={activeId() === cell.id}
              onActivate={() => layout.grid.setActive(props.dir, cell.id)}
              onRemove={() => layout.grid.removeCell(props.dir, cell.sessionID)}
            />
          )}
        </For>
        <For each={Array.from({ length: emptyCount() })}>
          {() => <CellSessionPicker dir={props.dir} primaryId={props.primaryId} />}
        </For>
      </div>
    </Show>
  )
}
