import { For, Show, createMemo } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { useGrid } from "@tui/context/grid"
import { useSync } from "@tui/context/sync"
import type { GridLayout } from "@tui/context/grid-persistence"

/**
 * Grid management sidebar. Shows the cell list with workspace labels,
 * layout toggle buttons (single / split-h / split-v), and metadata for
 * the currently active cell (session title, workspace, agent).
 */
export function Sidebar() {
  const grid = useGrid()
  const { theme } = useTheme()
  const sync = useSync()
  const cells = () => grid.cells
  const activeId = () => grid.activeCellId
  const layout = () => grid.layout
  const activeCell = () => grid.activeCell()

  const layouts = createMemo<{ key: GridLayout; label: string }[]>(() => [
    { key: "single", label: "▢ Single" },
    { key: "split-h", label: "▣ Split H" },
    { key: "split-v", label: "▤ Split V" },
  ])

  return (
    <box
      width={28}
      height="100%"
      backgroundColor={theme.backgroundPanel}
      border={["left"]}
      borderColor={theme.border}
      flexDirection="column"
      paddingTop={1}
      paddingLeft={1}
      paddingRight={1}
    >
      {/* Cell list */}
      <text fg={theme.textMuted}>
        Cells ({cells().length})
      </text>
      <For each={cells()}>
        {(cell) => {
          const session = () => sync.session.get(cell.sessionID)
          const isActive = cell.id === activeId()
          return (
            <box
              flexDirection="row"
              alignItems="center"
              paddingLeft={1}
              backgroundColor={isActive ? theme.backgroundElement : undefined}
              onMouseUp={() => grid.setActive(cell.id)}
            >
              <text fg={isActive ? theme.text : theme.textMuted} wrapMode="none">
                {cell.label || session()?.title || "Untitled"}
              </text>
              <text fg={theme.textMuted}>{cell.mode === "plan-only" ? " 📋" : " 💬"}</text>
            </box>
          )
        }}
      </For>

      {/* Layout toggles */}
      <text fg={theme.textMuted} marginTop={2}>
        Layout
      </text>
      <box flexDirection="row" gap={1}>
        <For each={layouts()}>
          {(item) => (
            <box
              paddingLeft={1}
              paddingRight={1}
              backgroundColor={layout() === item.key ? theme.backgroundElement : undefined}
              border={["left", "right"]}
              borderColor={layout() === item.key ? theme.borderActive : theme.border}
              onMouseUp={() => grid.setLayout(item.key)}
            >
              <text fg={layout() === item.key ? theme.text : theme.textMuted}>
                {item.label}
              </text>
            </box>
          )}
        </For>
      </box>

      {/* Active cell metadata */}
      <Show when={activeCell()}>
        {(ac) => (
          <>
            <text fg={theme.textMuted} marginTop={2}>
              Active Cell
            </text>
            <text fg={theme.textMuted}>
              Session:{" "}
              <span style={{ fg: theme.text }}>
                {sync.session.get(ac().sessionID)?.title ?? "—"}
              </span>
            </text>
            <text fg={theme.textMuted}>
              Workspace:{" "}
              <span style={{ fg: theme.text }}>
                {ac().workspaceID || "default"}
              </span>
            </text>
            <Show when={ac().agentID}>
              {(agentId) => (
                <text fg={theme.textMuted}>
                  Agent: <span style={{ fg: theme.text }}>{agentId()}</span>
                </text>
              )}
            </Show>
          </>
        )}
      </Show>
    </box>
  )
}
