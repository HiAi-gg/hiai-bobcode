import type { HiaiBobConfig, HookSet } from "../shared/types";
import { createClosureInjector } from "./closure-injector";

import { createTodoContinuationHook } from "./todo-continuation";
import { createQualityGate } from "./quality-gate";
import { createContextWindowMonitor } from "./context-window-monitor";
import { createToolOutputTruncator } from "./tool-output-truncator";
import { createToolPairValidator } from "./tool-pair-validator";
import { createThinkingBlockValidator } from "./thinking-block-validator";
import { createWriteExistingFileGuard } from "./write-existing-file-guard";
import { createJsonErrorRecovery } from "./json-error-recovery";
import { createEditErrorRecovery } from "./edit-error-recovery";
import { createNonInteractiveEnv } from "./non-interactive-env";
import { createModelFallbackHook } from "./model-fallback";
import { createRuntimeFallback } from "./runtime-fallback";
import { createPreemptiveCompaction } from "./preemptive-compaction";
import { createStopContinuationGuard } from "./stop-continuation-guard";
import { createRulesInjector } from "./rules-injector";

import { createDirectoryAgentsInjector } from "./directory-agents-injector";
import { createRalphLoopHook } from "./ralph-loop";
import { createManagerGuard } from "./manager-guard";
import { createCompactionContextInjector } from "./compaction-context-injector";
import { createSessionNotification } from "./session-notification";

import { createAgentUsageReminder } from "./agent-usage-reminder";
import { createSessionTodoStatus } from "./session-todo-status";
import { createSessionRecoveryHook } from "./session-recovery";
import { createSubAgentReceiptHook } from "./sub-agent-receipt";
import { createThinkModeHook } from "./think-mode";
import { createTokenBudgetHook } from "./token-budget";
import { createCompactionTodoPreserverHook } from "./compaction-todo-preserver";
import { createBackgroundNotificationHook } from "./background-notification";
import { createReasoningContentCacheHook } from "./reasoning-content-cache";
import { createStartWorkHook } from "./start-work";
import { createSubNotepadHook } from "./sub-notepad";
import { createUnstableAgentBabysitterHook } from "./unstable-agent-babysitter";
import { createContextWindowLimitRecoveryHook } from "./context-window-limit-recovery";

type HookFactory = (config: HiaiBobConfig) => HookSet;

interface NamedHookFactory {
  name: string;
  factory: HookFactory;
}

const HOOK_POINT_KEYS: (keyof HookSet)[] = [
  "experimental.chat.messages.transform",
  "experimental.chat.system.transform",
  "experimental.session.compacting",
  "experimental.compaction.autocontinue",
  "event",
  "chat.message",
  "chat.params",
  "tool.execute.before",
  "tool.execute.after",
  "command.execute.before",
];

function mergeHookSets(factories: HookFactory[], config: HiaiBobConfig): HookSet {
  const allSets = factories.map((f) => f(config));
  const merged: HookSet = {};

  for (const point of HOOK_POINT_KEYS) {
    const handlers = allSets
      .map((s) => s[point])
      .filter((h): h is NonNullable<typeof h> => h != null);
    if (handlers.length === 0) continue;

    if (handlers.length === 1) {
      (merged as Record<string, unknown>)[point] = handlers[0];
    } else {
      (merged as Record<string, unknown>)[point] = async (
        input: unknown,
        output: unknown,
      ) => {
        for (const handler of handlers) {
          try {
            await handler(input as never, output as never);
          } catch (err) {
            console.error(`[hiai-bob] Hook handler error in ${point}:`, err);
          }
        }
      };
    }
  }

  const disposeFns = allSets
    .map((s) => s.dispose)
    .filter((d): d is NonNullable<typeof d> => d != null);
  if (disposeFns.length > 0) {
    merged.dispose = async () => {
      for (const fn of disposeFns) await fn();
    };
  }

  return merged;
}

const ALL_NAMED_HOOK_FACTORIES: NamedHookFactory[] = [
  { name: "closure-injector", factory: createClosureInjector },

  { name: "todo-continuation", factory: createTodoContinuationHook },
  { name: "quality-gate", factory: createQualityGate },
  { name: "context-window-monitor", factory: createContextWindowMonitor },
  { name: "tool-output-truncator", factory: createToolOutputTruncator },
  { name: "tool-pair-validator", factory: createToolPairValidator },
  { name: "thinking-block-validator", factory: createThinkingBlockValidator },
  { name: "write-existing-file-guard", factory: createWriteExistingFileGuard },
  { name: "json-error-recovery", factory: createJsonErrorRecovery },
  { name: "edit-error-recovery", factory: createEditErrorRecovery },
  { name: "non-interactive-env", factory: createNonInteractiveEnv },
  { name: "model-fallback", factory: createModelFallbackHook },
  { name: "runtime-fallback", factory: createRuntimeFallback },
  { name: "preemptive-compaction", factory: createPreemptiveCompaction },
  { name: "stop-continuation-guard", factory: createStopContinuationGuard },
  { name: "rules-injector", factory: createRulesInjector },

  { name: "directory-agents-injector", factory: createDirectoryAgentsInjector },
  { name: "ralph-loop", factory: createRalphLoopHook },
  { name: "manager-guard", factory: createManagerGuard },
  { name: "compaction-context-injector", factory: createCompactionContextInjector },
  { name: "session-notification", factory: createSessionNotification },

  { name: "agent-usage-reminder", factory: createAgentUsageReminder },
  { name: "session-todo-status", factory: createSessionTodoStatus },
  { name: "session-recovery", factory: createSessionRecoveryHook },
  { name: "sub-agent-receipt", factory: createSubAgentReceiptHook },
  { name: "think-mode", factory: createThinkModeHook },
  { name: "token-budget", factory: createTokenBudgetHook },
  { name: "compaction-todo-preserver", factory: createCompactionTodoPreserverHook },
  { name: "background-notification", factory: createBackgroundNotificationHook },
  { name: "reasoning-content-cache", factory: createReasoningContentCacheHook },
  { name: "start-work", factory: createStartWorkHook },
  { name: "sub-notepad", factory: createSubNotepadHook },
  { name: "unstable-agent-babysitter", factory: createUnstableAgentBabysitterHook },
  { name: "context-window-limit-recovery", factory: createContextWindowLimitRecoveryHook },
];

export function createHooks(config: HiaiBobConfig): HookSet {
  const disabledSet = new Set(config.hooks?.disabled ?? []);

  const enabledFactories = ALL_NAMED_HOOK_FACTORIES
    .filter((h) => !disabledSet.has(h.name))
    .map((h) => h.factory);

  return mergeHookSets(enabledFactories, config);
}
