import type { HiaiBobConfig, HookSet } from "../shared/types";

export function createContextWindowLimitRecoveryHook(_config: HiaiBobConfig): HookSet {
  return {
    event: async ({ event }: { event: unknown }) => {
      if (!event || typeof event !== "object" || !("type" in event)) return;
      const evt = event as { type?: string; properties?: Record<string, unknown> };
      if (evt?.type === "session.error") {
        const error = (evt.properties?.error as string) ?? "";
        if (error.includes("context_length_exceeded") || error.includes("max_tokens")) {
          console.log("[hiai-bob] Context window limit exceeded — recovery needed");
        }
      }
    },
  };
}
