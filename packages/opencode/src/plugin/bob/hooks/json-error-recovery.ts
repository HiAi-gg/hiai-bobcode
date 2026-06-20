import type { HiaiBobConfig, HookSet } from "../shared/types";

export function createJsonErrorRecovery(_config: HiaiBobConfig): HookSet {
  return {
    "tool.execute.after": async (_input, output) => {
      if (
        output.output?.includes("JSON") &&
        (output.output.includes("parse error") ||
          output.output.includes("Unexpected token") ||
          output.output.includes("SyntaxError"))
      ) {
        output.output +=
          "\n\n[hiai-bob] JSON parse error detected. Re-read the file and ensure valid JSON before retrying.";
      }
    },
  };
}
