import type { HiaiBobConfig, HookSet } from "../shared/types";

export function createToolOutputTruncator(_config: HiaiBobConfig): HookSet {
  const MAX_LEN = 10_000;
  return {
    "tool.execute.after": async (_input, output) => {
      if (output.output && output.output.length > MAX_LEN) {
        const original = output.output.length;
        output.output =
          output.output.slice(0, MAX_LEN) +
          `\n\n[hiai-bob] Output truncated (${original} → ${MAX_LEN} chars)`;
      }
    },
  };
}
