import type { HiaiBobConfig, HookSet } from "../shared/types";

export function createCompactionTodoPreserverHook(_config: HiaiBobConfig): HookSet {
  return {
    "experimental.session.compacting": async (
      _input: Parameters<NonNullable<HookSet["experimental.session.compacting"]>>[0],
      output: Parameters<NonNullable<HookSet["experimental.session.compacting"]>>[1],
    ) => {
      if (output?.context) {
        output.context.push("[hiai-bob] Preserve all TODO items during compaction.");
      }
    },
  };
}
