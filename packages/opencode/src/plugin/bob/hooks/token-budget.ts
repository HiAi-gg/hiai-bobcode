import type { HiaiBobConfig, HookSet } from "../shared/types";

export function createTokenBudgetHook(_config: HiaiBobConfig): HookSet {
  return {
    "experimental.chat.messages.transform": async (
      _input: Parameters<NonNullable<HookSet["experimental.chat.messages.transform"]>>[0],
      output: Parameters<NonNullable<HookSet["experimental.chat.messages.transform"]>>[1],
    ) => {
      if (output?.messages?.length > 100) {
        console.log("[hiai-bob] Token budget: high message count");
      }
    },
  };
}
