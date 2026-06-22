import { For, Match, Switch, Show, createMemo, onMount, ErrorBoundary } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { useRoute } from "@tui/context/route"
import { useKeybind } from "@tui/context/keybind"
import { useTheme } from "@tui/context/theme"
import { useToast } from "@tui/ui/toast"
import { GridProvider, useGrid } from "@tui/context/grid"
import { load, type GridCell } from "@tui/context/grid-persistence"
import { SessionCell } from "./session-cell"
import { PlanCell } from "./plan-cell"
import { GridToolbar } from "./toolbar"
import { Sidebar } from "./sidebar"
import { CellErrorOverlay } from "@tui/component/cell-error-overlay"

/**
 * GridView — root grid layout component for Phase 2.1.
 *
 * Wraps the session/plan cells in a GridProvider, renders a toolbar (cell
 * tabs), the active cell body, and a management sidebar. Layout modes —
 * single, split-h, split-v — control how cells are arranged. Each cell
 * is wrapped in its own ErrorBoundary.
 */
export function GridView() {
  return (
    <GridProvider>
      <GridInner />
    </GridProvider>
  )
}

function GridInner() {
  const grid = useGrid()
  const route = useRoute()
  const keybind = useKeybind()
  const { theme } = useTheme()
  const dimensions = useTerminalDimensions()
  const toast = useToast()

  // Load persisted grid state on mount so the layout survives restarts.
  onMount(async () => {
    const persisted = await load()
    if (persisted) grid.hydrate(persisted)
  })

  // Grid-level keyboard navigation
  useKeyboard((evt) => {
    const cells = grid.cells
    if (cells.length === 0) return

    if (keybind.match("grid_next", evt)) {
      evt.preventDefault()
      const activeIdx = cells.findIndex((c) => c.id === grid.activeCellId)
      grid.setActive(cells[(activeIdx + 1) % cells.length].id)
      return
    }

    if (keybind.match("grid_prev", evt)) {
      evt.preventDefault()
      const activeIdx = cells.findIndex((c) => c.id === grid.activeCellId)
      grid.setActive(cells[(activeIdx - 1 + cells.length) % cells.length].id)
      return
    }

    if (keybind.match("grid_close", evt)) {
      evt.preventDefault()
      if (grid.activeCellId) grid.removeCell(grid.activeCellId)
      return
    }

    if (keybind.match("grid_create", evt)) {
      evt.preventDefault()
      route.navigate({ type: "home" })
      toast.show({
        message: "Start a new session to add it to the grid",
        variant: "info",
      })
    }
  })

  const width = () => dimensions().width
  const sidebarWidth = 28
  const contentWidth = () => width() - sidebarWidth - 2
  // Reserve 4 lines for toolbar + border
  const cellAreaHeight = () => dimensions().height - 4
  const layout = () => grid.layout
  const empty = () => grid.cells.length === 0
  const activeCell = () => grid.activeCell()

  // Max 2 visible cells for split layouts
  const visibleCells = createMemo(() => grid.cells.slice(0, 2))
  const splitCellWidth = createMemo(() => {
    const count = Math.min(grid.cells.length, 2)
    return count > 0 ? contentWidth() / count : contentWidth()
  })

  return (
    <box
      flexDirection="row"
      width={width()}
      height={dimensions().height}
      backgroundColor={theme.background}
    >
      {/* Main area: toolbar + cells */}
      <box flexDirection="column" flexGrow={1} height="100%">
        <GridToolbar />
        <Show
          when={!empty()}
          fallback={<GridEmptyState />}
        >
          <box flexDirection="column" flexGrow={1} height={cellAreaHeight()}>
            <Switch>
              {/* Single: only the active cell, full width */}
              <Match when={layout() === "single"}>
                <Show when={activeCell()}>
                  {(cell) => (
                    <ErrorBoundary fallback={(err) => <CellError error={err} cell={cell()} />}>
                      <CellRenderer cell={cell()} active={true} width={contentWidth()} />
                    </ErrorBoundary>
                  )}
                </Show>
              </Match>

              {/* Split-h: up to 2 cells side by side */}
              <Match when={layout() === "split-h"}>
                <box flexDirection="row" flexGrow={1}>
                  <For each={visibleCells()}>
                    {(cell) => (
                      <ErrorBoundary fallback={(err) => <CellError error={err} cell={cell} />}>
                        <CellRenderer
                          cell={cell}
                          active={cell.id === grid.activeCellId}
                          width={splitCellWidth()}
                        />
                      </ErrorBoundary>
                    )}
                  </For>
                </box>
              </Match>

              {/* Split-v: up to 2 cells stacked */}
              <Match when={layout() === "split-v"}>
                <box flexDirection="column" flexGrow={1}>
                  <For each={visibleCells()}>
                    {(cell) => (
                      <ErrorBoundary fallback={(err) => <CellError error={err} cell={cell} />}>
                        <CellRenderer
                          cell={cell}
                          active={cell.id === grid.activeCellId}
                          width={contentWidth()}
                        />
                      </ErrorBoundary>
                    )}
                  </For>
                </box>
              </Match>
            </Switch>
          </box>
        </Show>
      </box>

      {/* Right sidebar */}
      <Sidebar />
    </box>
  )
}

/**
 * Dispatches to the correct cell component based on cell.mode.
 */
function CellRenderer(props: { cell: GridCell; active: boolean; width: number }) {
  return (
    <Switch>
      <Match when={props.cell.mode === "plan-only"}>
        <PlanCell cell={props.cell} />
      </Match>
      <Match when={true}>
        <SessionCell cell={props.cell} active={props.active} wide={props.width > 120} />
      </Match>
    </Switch>
  )
}

/**
 * Fallback UI when a cell's component throws. Delegates to the shared
 * `CellErrorOverlay` so the look and behaviour match the inline
 * error treatment used elsewhere; the only grid-specific twist is that
 * the cell label is included in the headline.
 */
function CellError(props: { error: unknown; cell: GridCell }) {
  return <CellErrorOverlay error={props.error} cellLabel={props.cell.label} />
}

/**
 * Minimal empty-state placeholder shown when the grid has no cells.
 */
function GridEmptyState() {
  const { theme } = useTheme()
  const keybind = useKeybind()
  return (
    <box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      flexGrow={1}
      gap={1}
    >
      <text fg={theme.text}>Grid View</text>
      <text fg={theme.textMuted}>
        {keybind.print("grid_create")} to add a session
      </text>
    </box>
  )
}
