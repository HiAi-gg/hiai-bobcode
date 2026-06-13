import type {
  Hooks,
  PluginInput,
  Plugin as PluginInstance,
  Config as PluginConfig,
} from "@mimo-ai/plugin"
import { join } from "node:path"
import { Log } from "@/util"
import { loadConfig } from "./config"
import { createAllAgents } from "./agents"
import {
  createAgentBrowserTools,
} from "./tools/agent-browser"
import { createSkillTool } from "./tools/skill"
import {
  lspDiagnosticsTool,
  lspGotoDefinitionTool,
  lspFindReferencesTool,
  lspSymbolsTool,
  lspPrepareRenameTool,
  lspRenameTool,
  disposeLSP,
  setLspConfig,
} from "./tools/lsp"
import {
  setSessionClient,
  sessionListTool,
  sessionReadTool,
  sessionSearchTool,
  sessionInfoTool,
} from "./tools/session-manager"
import { getMcpConfig } from "./mcp/registry"
import { createClosureInjector } from "./hooks/closure-injector"
import { createQualityGate } from "./hooks/quality-gate"
import { createNonInteractiveEnv } from "./hooks/non-interactive-env"
import { createLegalGate } from "./hooks/legal-gate"
import { createAgentUsageReminder } from "./hooks/agent-usage-reminder"
import { createBackgroundNotificationHook } from "./hooks/background-notification"
import { createCompactionContextInjector } from "./hooks/compaction-context-injector"
import { createCompactionTodoPreserverHook } from "./hooks/compaction-todo-preserver"
import { createContextWindowLimitRecoveryHook } from "./hooks/context-window-limit-recovery"
import { createContextWindowMonitor } from "./hooks/context-window-monitor"
import { createDirectoryAgentsInjector } from "./hooks/directory-agents-injector"
import { createEditErrorRecovery } from "./hooks/edit-error-recovery"
import { createJsonErrorRecovery } from "./hooks/json-error-recovery"

import { createManagerGuard } from "./hooks/manager-guard"
import { createModelFallbackHook } from "./hooks/model-fallback"
import { createPreemptiveCompaction } from "./hooks/preemptive-compaction"
import { createRalphLoopHook } from "./hooks/ralph-loop"
import { createReasoningContentCacheHook } from "./hooks/reasoning-content-cache"
import { createRulesInjector } from "./hooks/rules-injector"
import { createRuntimeFallback } from "./hooks/runtime-fallback"
import { createSessionNotification } from "./hooks/session-notification"
import { createSessionRecoveryHook } from "./hooks/session-recovery"
import { createSessionTodoStatus } from "./hooks/session-todo-status"
import { createStartWorkHook } from "./hooks/start-work"
import { createStopContinuationGuard } from "./hooks/stop-continuation-guard"
import { createSubAgentReceiptHook } from "./hooks/sub-agent-receipt"
import { createSubNotepadHook } from "./hooks/sub-notepad"
import { createThinkModeHook } from "./hooks/think-mode"
import { createThinkingBlockValidator } from "./hooks/thinking-block-validator"
import { createTodoContinuationHook } from "./hooks/todo-continuation"
import { createTokenBudgetHook } from "./hooks/token-budget"

import { createToolPairValidator } from "./hooks/tool-pair-validator"
import { createUnstableAgentBabysitterHook } from "./hooks/unstable-agent-babysitter"
import { createWriteExistingFileGuard } from "./hooks/write-existing-file-guard"
import {
  createBobCompletionHook,
  setCompletionClient,
} from "./completion-controller"
import { backgroundOutputTool, backgroundCancelTool, setBackgroundManager } from "./tools/background-task"

import { BackgroundManager } from "./features/background-manager"

const log = Log.create({ service: "plugin.bob" })
const PLUGIN_NAME = "BobPlugin"
// We hide the native hiai agents (build/plan/compose) by overriding their

// lowercase keys in the config merge (see §7.1 in bob-plan.md). hiai registers
// these as `build: { ... mode: "primary", native: true }` etc. — the LOWERCASE
// keys are the ones the picker uses, so we set hidden: true + disable: true
// on those entries. Overriding the capitalized name creates a phantom agent.
const BUILTINS_TO_HIDE = ["build", "plan", "compose"]

// Native catch-all SUBAGENTS that compete with our team in the delegation enum.
// The subagent_type enum is built from `agents.filter(a => a.mode === "subagent"
// && !a.hidden)`, so setting hidden:true drops them from Bob's choices — Bob then
// delegates only to our 9 specialists (which pin cheap models + carry our prompts/
// conventions; the native ones inherit the active/expensive model). We HIDE (not
// disable/delete) so any internal reference to them still resolves.
const SUBAGENTS_TO_HIDE = ["general", "explore", "translator"]

const BobPlugin: PluginInstance = async (input: PluginInput) => {
  log.info("loading BobPlugin", { directory: input.directory })

  const config = loadConfig(input.directory)
  setLspConfig(config.lsp ?? {})

  const agents = createAllAgents(config)
  const disabledHooks = new Set(config.hooks?.disabled ?? [])
  const hookBuilders: Record<string, () => Partial<Hooks>> = {
    closure_injector: () => createClosureInjector(config),
    quality_gate: () => createQualityGate(config),
    non_interactive_env: () => createNonInteractiveEnv(config),
    legal_gate: () => createLegalGate() as Partial<Hooks>,
    agent_usage_reminder: () => createAgentUsageReminder(config),
    background_notification: () => createBackgroundNotificationHook(config),
    compaction_context_injector: () => createCompactionContextInjector(config),
    compaction_todo_preserver: () => createCompactionTodoPreserverHook(config),
    context_window_limit_recovery: () => createContextWindowLimitRecoveryHook(config),
    context_window_monitor: () => createContextWindowMonitor(config),
    directory_agents_injector: () => createDirectoryAgentsInjector(config),
    edit_error_recovery: () => createEditErrorRecovery(config),
    json_error_recovery: () => createJsonErrorRecovery(config),
    manager_guard: () => createManagerGuard(config),
    model_fallback: () => createModelFallbackHook(config),
    preemptive_compaction: () => createPreemptiveCompaction(config),
    ralph_loop: () => createRalphLoopHook(config),
    reasoning_content_cache: () => createReasoningContentCacheHook(config),
    rules_injector: () => createRulesInjector(config),
    runtime_fallback: () => createRuntimeFallback(config),
    session_notification: () => createSessionNotification(config),
    session_recovery: () => createSessionRecoveryHook(config),
    session_todo_status: () => createSessionTodoStatus(config),
    start_work: () => createStartWorkHook(config),
    stop_continuation_guard: () => createStopContinuationGuard(config),
    sub_agent_receipt: () => createSubAgentReceiptHook(config),
    sub_notepad: () => createSubNotepadHook(config),
    think_mode: () => createThinkModeHook(config),
    thinking_block_validator: () => createThinkingBlockValidator(config),
    todo_continuation: () => createTodoContinuationHook(config),
    token_budget: () => createTokenBudgetHook(config),
    tool_pair_validator: () => createToolPairValidator(config),
    unstable_agent_babysitter: () => createUnstableAgentBabysitterHook(config),
    write_existing_file_guard: () => createWriteExistingFileGuard(config),
    bob_completion: () => createBobCompletionHook(config),
  }
  const hooks: Hooks = {}
  for (const [name, build] of Object.entries(hookBuilders)) {
    if (disabledHooks.has(name)) continue
    Object.assign(hooks, build())
  }

  const mcpConfig = getMcpConfig(config.mcp ?? {}, config.auth)

  // Initialize BackgroundManager and wire to the background_* tools.
  const backgroundManager = new BackgroundManager(config.background_manager)
  setBackgroundManager(backgroundManager)

  setSessionClient(input.client)
  setCompletionClient(input.client)

  const skillsDir = join(import.meta.dirname, "skills")

  const disabledTools = new Set(config.tools?.disabled ?? [])
  const allTools = {
    skill: createSkillTool(skillsDir),
    ...createAgentBrowserTools(),
    lsp_diagnostics: lspDiagnosticsTool,
    lsp_goto_definition: lspGotoDefinitionTool,
    lsp_find_references: lspFindReferencesTool,
    lsp_symbols: lspSymbolsTool,
    lsp_prepare_rename: lspPrepareRenameTool,
    lsp_rename: lspRenameTool,
    session_list: sessionListTool,
    session_read: sessionReadTool,
    session_search: sessionSearchTool,
    session_info: sessionInfoTool,
    background_output: backgroundOutputTool,
    background_cancel: backgroundCancelTool,
  }
  const toolEntries = Object.fromEntries(
    Object.entries(allTools).filter(([name]) => !disabledTools.has(name)),
  )

  log.info("BobPlugin loaded", {
    agents: agents.length,
    tools: Object.keys(toolEntries).length,
    mcp: Object.keys(mcpConfig),
  })

  return {
    name: PLUGIN_NAME,

    tool: toolEntries,

    config: async (cfg: PluginConfig) => {
      cfg.agent ??= {}

      // Hide native build/plan/compose (see BUILTINS_TO_HIDE comment above).
      for (const key of BUILTINS_TO_HIDE) {
        const existing = (cfg.agent as Record<string, unknown>)[key] as
          | Record<string, unknown>
          | undefined
        cfg.agent[key] = {
          ...existing,
          hidden: true,
          disable: true,
        }
      }

      // Hide native catch-all subagents from the delegation enum (hidden only,
      // not disabled — see SUBAGENTS_TO_HIDE comment above).
      for (const key of SUBAGENTS_TO_HIDE) {
        const existing = (cfg.agent as Record<string, unknown>)[key] as
          | Record<string, unknown>
          | undefined
        cfg.agent[key] = {
          ...existing,
          hidden: true,
        }
      }

      // Register our 10 agents.
      const permissionKeys = new Set(["edit", "bash", "webfetch", "doom_loop", "external_directory"])
      const toolsKeys = new Set(["write", "grep", "glob", "task", "apply_patch"])

      for (const agent of agents) {
        const agentKey = agent.key
        // Register under the LOWERCASE key (e.g. "coder"), not the display name
        // ("Coder"). hiai dispatches subagents via `agents[subagent_type]` (a
        // case-sensitive map lookup in actor.ts) and builds the model-facing
        // subagent_type enum from each agent's `.name`. Native hiai agents are
        // all lowercase (build/plan/general). Our agent prompts and
        // `agent_restrictions` keys are lowercase too, so the registration key,
        // the dispatch key, the enum value, and the prompt must all be the
        // lowercase `agentKey` or delegation silently breaks.
        const name = agentKey
        const existing = (cfg.agent[name] as Record<string, unknown>) ?? {}
        const restrictions = config.agent_restrictions?.[agentKey]

        const permission: Record<string, string> = {}
        const tools: Record<string, boolean> = {}
        if (restrictions) {
          for (const [key, value] of Object.entries(restrictions)) {
            if (value !== false) continue
            if (permissionKeys.has(key)) permission[key] = "deny"
            else if (toolsKeys.has(key)) tools[key] = false
          }
        }

        cfg.agent[name] = {
          ...existing,
          description: agent.config.description,
          mode: agent.config.mode,
          ...(agent.config.model ? { model: agent.config.model } : {}),
          prompt: agent.config.prompt,
          ...(agent.config.temperature !== undefined
            ? { temperature: agent.config.temperature }
            : {}),
          ...(agent.config.thinking ? { thinking: agent.config.thinking } : {}),
          ...(Object.keys(permission).length > 0 ? { permission } : {}),
          ...(Object.keys(tools).length > 0 ? { tools } : {}),
          ...(agent.config.hidden ? { hidden: true } : {}),
        }
      }

      if (Object.keys(mcpConfig).length > 0) {
        cfg.mcp ??= {}
        for (const [key, value] of Object.entries(mcpConfig)) {
          ;(cfg.mcp as Record<string, unknown>)[key] = value
        }
      }

      // Surface dream/distill control through Bob: the host natively reads
      // cfg.dream/cfg.distill {auto, interval_days}; we also inject {model} (Bob's
      // model) which the patched auto-dream trigger uses to pin the pass model.
      if (config.dream) (cfg as Record<string, unknown>).dream = { ...(cfg as any).dream, ...config.dream }
      if (config.distill) (cfg as Record<string, unknown>).distill = { ...(cfg as any).distill, ...config.distill }
    },

    // Pass the bob hooks through to the native hook system.
    "experimental.chat.messages.transform":
      hooks["experimental.chat.messages.transform"],
    "experimental.chat.system.transform":
      hooks["experimental.chat.system.transform"],
    "experimental.session.compacting":
      hooks["experimental.session.compacting"],
    "experimental.compaction.autocontinue":
      hooks["experimental.compaction.autocontinue"],
    event: hooks.event,
    "permission.ask": hooks["permission.ask"],
    "tool.execute.before": hooks["tool.execute.before"],
    "tool.execute.after": hooks["tool.execute.after"],
    "chat.message": hooks["chat.message"],
    "chat.params": hooks["chat.params"],
    "command.execute.before": hooks["command.execute.before"],
    "actor.postStop": hooks["actor.postStop"],

    dispose: async () => {
      log.info("BobPlugin disposing")
      await disposeLSP()
    },
  }
}

export { BobPlugin }
export default BobPlugin
