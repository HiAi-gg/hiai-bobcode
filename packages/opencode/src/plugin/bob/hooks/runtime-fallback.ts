import type { HiaiBobConfig, HookSet } from "../shared/types";

export function createRuntimeFallback(_config: HiaiBobConfig): HookSet {
  return {
    "chat.params": async (_input, output) => {
      if (output.maxOutputTokens && output.maxOutputTokens > 32_000) {
        output.maxOutputTokens = 32_000;
      }
    },
  };
}
