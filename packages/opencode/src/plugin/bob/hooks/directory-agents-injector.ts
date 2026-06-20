import type { HiaiBobConfig, HookSet } from "../shared/types";

export function createDirectoryAgentsInjector(_config: HiaiBobConfig): HookSet {
  return {
    "experimental.chat.system.transform": async (_input, output) => {
      output.system.push(
        "[hiai-bob] When operating in project directories, check for AGENTS.md rules.",
      );
    },
  };
}
