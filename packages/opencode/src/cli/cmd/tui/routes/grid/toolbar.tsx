import { For } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { useGrid } from "@tui/context/grid"
import { useSync } from "@tui/context/sync"
import { useRoute } from "@tui/context/route"

/**
 * Cell tab bar for the grid view. Renders one tab per cell with the session
 * label, a mode badge (plan-only vs full), and a close button ("×"). The
 * active cell is highlighted. A "+" button at the end navigates to home so
 * the user can start a new session for the grid.
 */
export function GridToolbar() {
  const grid = useGrid()
  const { theme } = useTheme()
  const sync = useSync()
  const route = useRoute()
  const cells = () => grid.cells
  const activeId = () => grid.activeCellId

  return (
    <box
      flexDirection="row"
      height={3}
      backgroundColor={theme.backgroundPanel}
      border={["bottom"]}
      borderColor={theme.border}
      alignItems="center"
      paddingLeft={1}
      paddingRight={1}
    >
      <For each={cells()}>
        {(cell) => {
          const isActive = cell.id === activeId()
          const session = () => sync.session.get(cell.sessionID)
          const label = () => cell.label || session()?.title || "cell"
          return (
            <box
              flexDirection="row"
              alignItems="center"
              paddingLeft={1}
              paddingRight={1}
              backgroundColor={isActive ? theme.background : theme.backgroundElement}
              border={["left", "right"]}
              borderColor={isActive ? theme.borderActive : theme.border}
              marginRight={1}
              onMouseUp={() => grid.setActive(cell.id)}
            >
              <text fg={theme.textMuted}>{cell.mode === "plan-only" ? "📋" : "💬"}</text>
              <text fg={isActive ? theme.text : theme.textMuted} marginLeft={1} wrapMode="none">
                {label()}
              </text>
              <box
                marginLeft={1}
                onMouseUp={(evt) => {
                  evt.stopPropagation()
                  grid.removeCell(cell.id)
                }}
              >
                <text fg={isActive ? theme.textMuted : theme.textMuted}>×</text>
              </box>
            </box>
          )
        }}
      </For>

      {/* "+" button to create a new cell — navigates to home session picker */}
      <box
        onMouseUp={() => route.navigate({ type: "home" })}
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={theme.textMuted}>+</text>
      </box>
    </box>
  )
}
