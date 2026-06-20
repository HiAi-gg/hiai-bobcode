import { tool } from "@mimo-ai/plugin"
import { exec } from "node:child_process"
import { promisify } from "node:util"
import { z } from "zod"

const execAsync = promisify(exec)

const NavigateArgs = z.object({
  url: z.string().describe("URL to navigate to"),
})
const SnapshotArgs = z.object({})
const ClickArgs = z.object({
  ref: z.string().describe("Element reference like @eN"),
})
const FillArgs = z.object({
  ref: z.string().describe("Element reference like @eN"),
  text: z.string().describe("Text to fill"),
})
const TypeArgs = z.object({
  ref: z.string().describe("Element reference like @eN"),
  text: z.string().describe("Text to type"),
})
const ScreenshotArgs = z.object({})
const EvalArgs = z.object({
  code: z.string().describe("JavaScript code to evaluate"),
})
const WaitArgs = z.object({
  ms: z.number().describe("Milliseconds to wait"),
})
const CloseArgs = z.object({})
const ConsoleArgs = z.object({})
const SelectArgs = z.object({
  ref: z.string().describe("Element reference like @eN"),
  value: z.string().describe("Option value to select"),
})
const HoverArgs = z.object({
  ref: z.string().describe("Element reference like @eN"),
})
const PressArgs = z.object({
  key: z.string().describe("Key to press (e.g. Enter, Tab, Escape)"),
})
const BatchArgs = z.object({
  commands: z.string().describe("Newline-separated agent-browser commands"),
})

function shellEscape(s: string): string {
  return s.replace(/'/g, "'\\''")
}

async function runAgentBrowser(args: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`agent-browser ${args}`, {
      encoding: "utf-8",
      timeout: 30000,
    })
    return stdout.trim()
  } catch (err) {
    // exec rejects on non-zero exit / timeout; surface stderr+message like before.
    const msg = err instanceof Error ? err.message : String(err)
    return `Error: ${msg}`
  }
}

export function createAgentBrowserTools() {
  return {
    agent_browser_navigate: tool({
      description: "Navigate to a URL in the browser.",
      args: NavigateArgs.shape,
      async execute(input) {
        const output = await runAgentBrowser(`navigate '${shellEscape(input.url)}'`)
        return { title: "Navigate", output }
      },
    }),

    agent_browser_snapshot: tool({
      description:
        "Take an accessibility snapshot of the current page (returns element references).",
      args: SnapshotArgs.shape,
      async execute() {
        const output = await runAgentBrowser("snapshot -i --json")
        return { title: "Snapshot", output }
      },
    }),

    agent_browser_click: tool({
      description: "Click an element by its reference (e.g. @e5).",
      args: ClickArgs.shape,
      async execute(input) {
        const output = await runAgentBrowser(`click '${shellEscape(input.ref)}'`)
        return { title: "Click", output }
      },
    }),

    agent_browser_fill: tool({
      description: "Fill an input element with text (replaces existing value).",
      args: FillArgs.shape,
      async execute(input) {
        const output = await runAgentBrowser(
          `fill ${input.ref} '${shellEscape(input.text)}'`,
        )
        return { title: "Fill", output }
      },
    }),

    agent_browser_type: tool({
      description: "Type text into an element (appends to existing value).",
      args: TypeArgs.shape,
      async execute(input) {
        const output = await runAgentBrowser(
          `type ${input.ref} '${shellEscape(input.text)}'`,
        )
        return { title: "Type", output }
      },
    }),

    agent_browser_screenshot: tool({
      description: "Take a screenshot of the current page.",
      args: ScreenshotArgs.shape,
      async execute() {
        const output = await runAgentBrowser("screenshot")
        return { title: "Screenshot", output }
      },
    }),

    agent_browser_eval: tool({
      description: "Evaluate JavaScript code in the browser context.",
      args: EvalArgs.shape,
      async execute(input) {
        const output = await runAgentBrowser(`eval '${shellEscape(input.code)}'`)
        return { title: "Eval", output }
      },
    }),

    agent_browser_wait: tool({
      description: "Wait for a specified number of milliseconds.",
      args: WaitArgs.shape,
      async execute(input) {
        const output = await runAgentBrowser(`wait ${input.ms}`)
        return { title: "Wait", output }
      },
    }),

    agent_browser_close: tool({
      description: "Close the browser session.",
      args: CloseArgs.shape,
      async execute() {
        const output = await runAgentBrowser("close")
        return { title: "Close", output }
      },
    }),

    agent_browser_console: tool({
      description: "Get browser console logs.",
      args: ConsoleArgs.shape,
      async execute() {
        const output = await runAgentBrowser("console")
        return { title: "Console", output }
      },
    }),

    agent_browser_select: tool({
      description: "Select an option in a <select> element.",
      args: SelectArgs.shape,
      async execute(input) {
        const output = await runAgentBrowser(
          `select ${input.ref} '${shellEscape(input.value)}'`,
        )
        return { title: "Select", output }
      },
    }),

    agent_browser_hover: tool({
      description: "Hover over an element.",
      args: HoverArgs.shape,
      async execute(input) {
        const output = await runAgentBrowser(`hover '${shellEscape(input.ref)}'`)
        return { title: "Hover", output }
      },
    }),

    agent_browser_press: tool({
      description: "Press a keyboard key.",
      args: PressArgs.shape,
      async execute(input) {
        const output = await runAgentBrowser(`press '${shellEscape(input.key)}'`)
        return { title: "Press", output }
      },
    }),

    agent_browser_batch: tool({
      description:
        "Execute multiple agent-browser commands in sequence (newline-separated).",
      args: BatchArgs.shape,
      async execute(input) {
        const output = await runAgentBrowser(
          `batch '${shellEscape(input.commands)}'`,
        )
        return { title: "Batch", output }
      },
    }),
  }
}

export type AgentBrowserTools = ReturnType<typeof createAgentBrowserTools>
