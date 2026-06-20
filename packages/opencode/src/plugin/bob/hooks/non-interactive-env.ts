import type { HiaiBobConfig, HookSet } from "../shared/types";

const INTERACTIVE_CMDS = ["vim", "vi", "nano", "less", "more", "htop", "top", "man", "ssh"];

export function createNonInteractiveEnv(_config: HiaiBobConfig): HookSet {
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "bash") return;
      const args = output.args as { command?: string };
      const cmd = (args?.command ?? "").trim().split(/\s+/)[0]?.toLowerCase();
      if (cmd && INTERACTIVE_CMDS.includes(cmd)) {
        console.log(`[hiai-bob] Non-interactive command detected: ${cmd}`);
        output.args = {
          ...((output.args as Record<string, unknown>) ?? {}),
          command: `echo "[hiai-bob] '${cmd}' is interactive and cannot run in this environment. Use a non-interactive alternative."`,
        } as typeof output.args;
      }
    },
  };
}
