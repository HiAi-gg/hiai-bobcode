import type { HiaiBobConfig, HookSet } from "../shared/types";

const COOLDOWN_MS = 15_000;
const lastLoopTime = new Map<string, number>();

export function createRalphLoopHook(_config: HiaiBobConfig): HookSet {
  return {
    dispose: async () => {
      lastLoopTime.clear();
    },
    event: async ({ event }: { event: unknown }) => {
      const evt = event as { type?: string; properties?: Record<string, unknown> };
      if (evt?.type === "session.idle") {
        const sessionID = evt.properties?.sessionID as string | undefined;
        if (!sessionID) return;
        const now = Date.now();
        const lastTime = lastLoopTime.get(sessionID) ?? 0;
        if (now - lastTime < COOLDOWN_MS) return;
        console.log(`[hiai-bob] Ralph-loop: session ${sessionID} idle — checking for <promise>DONE</promise>`);
        lastLoopTime.set(sessionID, now);
      }
    },
  };
}
