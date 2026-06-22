import { createSimpleContext } from "./helper"

export interface Args {
  model?: string
  agent?: string
  prompt?: string
  continue?: boolean
  sessionID?: string
  fork?: boolean
  neverAsk?: boolean
  /**
   * Phase 6: when true, the TUI launches straight into the grid view. The
   * grid's persisted layout (`~/.mimocode/grid-layout.json`) is restored by
   * default; combine with `--session`/`--continue` to seed a single cell.
   */
  grid?: boolean
}

export const { use: useArgs, provider: ArgsProvider } = createSimpleContext({
  name: "Args",
  init: (props: Args) => props,
})
