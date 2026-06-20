import type { HiaiBobConfig, HookSet } from "../shared/types";

export function createPreemptiveCompaction(_config: HiaiBobConfig): HookSet {
  return {
    "experimental.chat.messages.transform": async (
      _input: Parameters<NonNullable<HookSet["experimental.chat.messages.transform"]>>[0],
      output: Parameters<NonNullable<HookSet["experimental.chat.messages.transform"]>>[1],
    ) => {
      const totalParts = output.messages.reduce(
        (sum, m) => sum + ((m.parts as unknown[])?.length ?? 0),
        0,
      );
      if (totalParts > 200) {
        console.log(
          `[hiai-bob] High message count (${totalParts}) — consider compacting`,
        );
      }
    },
  };
}
