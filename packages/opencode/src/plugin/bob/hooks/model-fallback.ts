import type { HiaiBobConfig } from "../shared/types";
import type { HookSet } from "../shared/types";

export function createModelFallbackHook(_config: HiaiBobConfig): HookSet {
  return {
    event: async ({ event }: { event: unknown }) => {
      const evt = event as { type?: string; properties?: Record<string, unknown> };
      if (evt?.type === "session.error") {
        const error = evt.properties?.error as string ?? "";
        if (error.includes("429") || error.includes("503") || error.includes("rate_limit")) {
          console.log("[hiai-bob] Model fallback: rate limit detected — switching to fallback model");
        }
      }
    },
  };
}
