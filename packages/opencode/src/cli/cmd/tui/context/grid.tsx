import { createStore, produce, reconcile } from "solid-js/store"
import { createEffect, createMemo, onCleanup } from "solid-js"
import { createSimpleContext } from "./helper"
import { defaultGridState, debouncedSave, type GridCell, type GridLayout, type GridState } from "./grid-persistence"

export type AddCellInput = Omit<GridCell, "id">

export const { use: useGrid, provider: GridProvider } = createSimpleContext({
  name: "Grid",
  init: (props: { initial?: GridState }) => {
    const [store, setStore] = createStore<GridState>(props.initial ?? defaultGridState())

    const persist = debouncedSave(250)
    createEffect(() => {
      // Touch every tracked field so Solid registers them, then snapshot.
      const snapshot: GridState = {
        cells: store.cells.map((c) => ({ ...c })),
        activeCellId: store.activeCellId,
        layout: store.layout,
      }
      persist(snapshot)
    })
    onCleanup(() => {
      // No-op: pending debounced save still fires for the latest snapshot.
    })

    return {
      get data() {
        return store
      },
      get cells() {
        return store.cells
      },
      get activeCellId() {
        return store.activeCellId
      },
      get layout() {
        return store.layout
      },
      activeCell: createMemo(() => store.cells.find((c) => c.id === store.activeCellId)),
      addCell(input: AddCellInput) {
        const id = crypto.randomUUID()
        const cell: GridCell = { ...input, id }
        setStore(
          produce((draft) => {
            draft.cells.push(cell)
            draft.activeCellId = id
          }),
        )
        return id
      },
      removeCell(id: string) {
        setStore(
          produce((draft) => {
            const idx = draft.cells.findIndex((c) => c.id === id)
            if (idx < 0) return
            draft.cells.splice(idx, 1)
            if (draft.activeCellId === id) {
              const next = draft.cells[Math.min(idx, draft.cells.length - 1)]
              draft.activeCellId = next ? next.id : ""
            }
          }),
        )
      },
      setActive(id: string) {
        if (!store.cells.some((c) => c.id === id)) return
        setStore("activeCellId", id)
      },
      setLayout(layout: GridLayout) {
        setStore("layout", layout)
      },
      toggleMode(id?: string) {
        const target = id ?? store.activeCellId
        if (!target) return
        const idx = store.cells.findIndex((c) => c.id === target)
        if (idx < 0) return
        const current = store.cells[idx]
        if (!current) return
        const next = current.mode === "full" ? "plan-only" : "full"
        setStore("cells", idx, reconcile({ ...current, mode: next }))
      },
      /**
       * Replace the entire state (e.g. after a successful load from disk).
       * Use sparingly — prefer the targeted mutators above.
       */
      hydrate(state: GridState) {
        setStore(reconcile(state))
      },
    }
  },
})

export type GridContext = ReturnType<typeof useGrid>

/**
 * Convenience namespace export for callers that prefer
 * `import { grid } from "@tui/context/grid"` over the hook form.
 */
export const grid = {
  addCell: (ctx: GridContext, input: AddCellInput) => ctx.addCell(input),
  removeCell: (ctx: GridContext, id: string) => ctx.removeCell(id),
  setActive: (ctx: GridContext, id: string) => ctx.setActive(id),
  toggleMode: (ctx: GridContext, id?: string) => ctx.toggleMode(id),
  setLayout: (ctx: GridContext, layout: GridLayout) => ctx.setLayout(layout),
}
