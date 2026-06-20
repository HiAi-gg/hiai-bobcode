import type { HiaiBobConfig, HookSet } from "../shared/types";

export function createSessionNotification(_config: HiaiBobConfig): HookSet {
  return {
    event: async ({ event }: { event: unknown }) => {
      const evt = event as { type?: string; properties?: Record<string, unknown> };
      if (evt?.type === "session.idle" || evt?.type === "session.question") {
        const sid = evt.properties?.sessionID as string | undefined;
        console.log(`[hiai-bob] Session event: ${evt?.type} (${sid})`);
      }
    },
  };
}
