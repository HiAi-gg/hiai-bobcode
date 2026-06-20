import type { HiaiBobConfig, HookSet } from "../shared/types";

export function createRulesInjector(_config: HiaiBobConfig): HookSet {
  return {
    "experimental.chat.system.transform": async (_input, output) => {
      output.system.push("[hiai-bob] Follow AGENTS.md rules in all file operations.");
    },
  };
}
