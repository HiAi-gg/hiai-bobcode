import type { HiaiBobConfig, HookSet } from "../shared/types";

export function createBackgroundNotificationHook(_config: HiaiBobConfig): HookSet {
  return {
    event: async ({ event }: { event: unknown }) => {
      const evt = event as { type?: string; properties?: Record<string, unknown> };
      if (evt?.type === "session.idle") {
        console.log("[hiai-bob] Background notification: checking completion");
      }
    },
  };
}
