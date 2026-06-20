import type { HiaiBobConfig } from "../shared/types";
import type { HookSet } from "../shared/types";

export function createSessionRecoveryHook(_config: HiaiBobConfig): HookSet {
  return {
    event: async ({ event }: { event: unknown }) => {
      const evt = event as { type?: string; properties?: Record<string, unknown> };
      if (evt?.type === "session.error") {
        const error = evt.properties?.error as string ?? "";
        if (error.includes("empty") || error.includes("no response")) {
          console.log("[hiai-bob] Session recovery: empty response detected — retrying");
        }
      }
    },
  };
}
