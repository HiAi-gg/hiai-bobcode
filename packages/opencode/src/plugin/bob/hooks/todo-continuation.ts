import type { HiaiBobConfig, HookSet } from "../shared/types";

const COOLDOWN_MS = 30_000;
const lastContinuationTime = new Map<string, number>();

export function createTodoContinuationHook(_config: HiaiBobConfig): HookSet {
  return {
    dispose: async () => {
      lastContinuationTime.clear();
    },
    event: async ({ event }: { event: unknown }) => {
      const evt = event as { type?: string; properties?: Record<string, unknown> };
      if (evt?.type === "session.idle") {
        const sessionID = evt.properties?.sessionID as string | undefined;
        if (!sessionID) return;
        const now = Date.now();
        const lastTime = lastContinuationTime.get(sessionID) ?? 0;
        if (now - lastTime < COOLDOWN_MS) return;
        console.log(`[hiai-bob] Todo continuation: session ${sessionID} idle — checking incomplete tasks`);
        lastContinuationTime.set(sessionID, now);
      }
    },
  };
}
