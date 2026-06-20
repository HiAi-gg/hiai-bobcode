import type { HiaiBobConfig, HookSet } from "../shared/types";

export function createQualityGate(_config: HiaiBobConfig): HookSet {
  return {
    "tool.execute.after": async (input, output) => {
      if (input.tool === "bash") {
        const args = input.args as { command?: string };
        const cmd = args?.command ?? "";
        const isQuality =
          cmd.includes("bun run lint") ||
          cmd.includes("biome check") ||
          cmd.includes("bun run format") ||
          cmd.includes("bun run typecheck") ||
          cmd.includes("tsc");
        if (isQuality) {
          const hasErrors =
            output.output?.includes("error") ||
            output.output?.includes("Error") ||
            output.output?.includes("ERR") ||
            output.output?.includes("TS error");
          if (hasErrors) {
            console.log(`[hiai-bob] QUALITY GATE FAILED: ${cmd.split(" ")[0]}`);
            output.output += `\n\n[hiai-bob] QUALITY GATE: Errors detected. Fix before marking task complete.`;
          }
        }
      }
    },
  };
}
