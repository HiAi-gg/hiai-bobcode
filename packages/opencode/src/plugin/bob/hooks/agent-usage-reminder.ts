import type { HiaiBobConfig, HookSet } from "../shared/types";

export function createAgentUsageReminder(_config: HiaiBobConfig): HookSet {
  const callCounts = new Map<string, number>();
  return {
    "tool.execute.after": async (input, output) => {
      if (input.tool === "task") return;
      const sid = input.sessionID;
      const count = (callCounts.get(sid) ?? 0) + 1;
      callCounts.set(sid, count);
      if (count === 10 || (count > 10 && count % 20 === 0)) {
        output.output +=
          "\n\n[hiai-bob] Reminder: Use the task tool to track multi-step work for better continuity.";
      }
    },
    dispose: async () => {
      callCounts.clear();
    },
  };
}
