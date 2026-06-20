import type { HiaiBobConfig, HookSet } from "../shared/types";

export function createStopContinuationGuard(_config: HiaiBobConfig): HookSet {
  return {
    event: async ({ event }) => {
      const evt = event as { type?: string; properties?: Record<string, unknown> };
      if (evt?.type === "user.message") {
        const sid = evt.properties?.sessionID as string | undefined;
        if (sid) {
          console.log(`[hiai-bob] User message — cleared continuation state for ${sid}`);
        }
      }
    },
  };
}
