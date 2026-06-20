import type { HiaiBobConfig, HookSet } from "../shared/types";

export function createStartWorkHook(_config: HiaiBobConfig): HookSet {
  return {
    "command.execute.before": async (
      input: Parameters<NonNullable<HookSet["command.execute.before"]>>[0],
      _output: Parameters<NonNullable<HookSet["command.execute.before"]>>[1],
    ) => {
      if (input?.command === "start-work") {
        console.log("[hiai-bob] Starting work session");
      }
    },
  };
}
