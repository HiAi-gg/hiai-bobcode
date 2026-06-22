import path from "path"
import { mkdir } from "fs/promises"
import { Global } from "@/global"

export type GridCell = {
  id: string
  sessionID: string
  workspaceID: string
  agentID?: string
  mode: "full" | "plan-only"
  label: string
}

export type GridLayout = "single" | "split-h" | "split-v"

export type GridState = {
  cells: GridCell[]
  activeCellId: string
  layout: GridLayout
}

// Project-local mimocode dir under the user's home — explicit per spec.
// Resolved against HOME/USERPROFILE (matching Global.Path.home) so tests can
// isolate via env vars without touching XDG state paths.
export const gridLayoutPath = path.join(Global.Path.home, ".mimocode", "grid-layout.json")

export function defaultGridState(): GridState {
  return {
    cells: [],
    activeCellId: "",
    layout: "single",
  }
}

function isGridCell(value: unknown): value is GridCell {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === "string" &&
    typeof v.sessionID === "string" &&
    typeof v.workspaceID === "string" &&
    (v.agentID === undefined || typeof v.agentID === "string") &&
    (v.mode === "full" || v.mode === "plan-only") &&
    typeof v.label === "string"
  )
}

function isGridLayout(value: unknown): value is GridLayout {
  return value === "single" || value === "split-h" || value === "split-v"
}

export function isGridState(value: unknown): value is GridState {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  return (
    Array.isArray(v.cells) && v.cells.every(isGridCell) && typeof v.activeCellId === "string" && isGridLayout(v.layout)
  )
}

async function ensureParent(p: string): Promise<void> {
  await mkdir(path.dirname(p), { recursive: true })
}

export async function save(state: GridState): Promise<void> {
  await ensureParent(gridLayoutPath)
  await Bun.write(gridLayoutPath, JSON.stringify(state, null, 2))
}

export async function load(): Promise<GridState | null> {
  const handle = Bun.file(gridLayoutPath)
  if (!(await handle.exists())) return null
  try {
    const data = (await handle.json()) as unknown
    if (!isGridState(data)) return null
    return data
  } catch {
    return null
  }
}

/**
 * Returns a debounced saver that coalesces rapid grid-state changes into a
 * single write. The trailing call always fires so the final state is durable.
 */
export function debouncedSave(delayMs = 250): (state: GridState) => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: GridState | undefined
  return (state) => {
    pending = state
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      const snapshot = pending
      timer = undefined
      pending = undefined
      if (snapshot) save(snapshot).catch(() => undefined)
    }, delayMs)
  }
}
