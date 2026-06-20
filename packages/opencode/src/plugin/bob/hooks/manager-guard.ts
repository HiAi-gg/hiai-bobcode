import type { HiaiBobConfig, HookSet } from "../shared/types";

export function createManagerGuard(_config: HiaiBobConfig): HookSet {
  return {
    event: async ({ event }: { event: unknown }) => {
      const evt = event as { type?: string; properties?: Record<string, unknown> };
      if (evt?.type === "session.idle") {
        const sid = evt.properties?.sessionID as string | undefined;
        const agent = evt.properties?.agent as string | undefined;
        if (sid && agent && agent !== "bob") {
          console.log(
            `[hiai-bob] Manager guard: subagent ${agent} idle in session ${sid}`,
          );
        }
      }
    },
  };
}
