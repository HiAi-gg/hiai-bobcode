import type { HiaiBobConfig, HookSet } from "../shared/types";

export function createCompactionContextInjector(_config: HiaiBobConfig): HookSet {
  return {
    "experimental.session.compacting": async (_input, output) => {
      if (!output?.context) return;
      output.context.push(
        "[hiai-bob] Preserve task IDs, progress markers, and agent names during compaction.",
      );
    },
  };
}
