import type { HiaiBobConfig, HookSet } from "../shared/types";

export function createEditErrorRecovery(_config: HiaiBobConfig): HookSet {
  return {
    "tool.execute.after": async (input, output) => {
      if (
        input.tool === "edit" &&
        (output.output?.includes("oldString not found") ||
          output.output?.includes("No match"))
      ) {
        output.output +=
          "\n\n[hiai-bob] Edit target not found. Re-read the file first, then retry with the exact current content.";
      }
    },
  };
}
