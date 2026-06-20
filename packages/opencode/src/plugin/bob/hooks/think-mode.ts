import type { HiaiBobConfig, HookSet } from "../shared/types";

export function createThinkModeHook(_config: HiaiBobConfig): HookSet {
  return {
    "chat.params": async (
      _input: Parameters<NonNullable<HookSet["chat.params"]>>[0],
      output: Parameters<NonNullable<HookSet["chat.params"]>>[1],
    ) => {
      if (output?.options && !output.options.thinking) {
        output.options.thinking = { type: "enabled", budgetTokens: 10000 };
      }
    },
  };
}
