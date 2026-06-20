export type AgentMode = "primary" | "subagent" | "all";

export interface AgentConfig {
  name: string;
  description: string;
  mode: AgentMode;
  model?: string;
  prompt: string;
  hidden?: boolean;
  temperature?: number;
  thinking?: { type: string; budgetTokens?: number };
  delegate_to?: string[];
}

export interface AgentOverrides {
  model?: string;
  prompt_append?: string;
}

export interface CompletionConfig {
  enabled: boolean;
  /** Max times we'll ask Bob's ReAct loop to continue. (Bob's own MAX_POST_REACT
   *  is the primary cap; this is a secondary guard.) */
  max_auto_continues: number;
  /** Require the Critic's CLOSURE to APPROVE before stopping. */
  require_critic: boolean;
  /** Glob patterns that mark changed files as UI-touching (forces a Vision browser
   *  pass during review). */
  ui_globs: string[];
  /** When a new user message arrives, reset the autocontinue loop. */
  reset_on_user_message: boolean;
}

export interface LspServerConfig {
  enabled?: boolean;
  command?: string;
  args?: string[];
  initializationOptions?: Record<string, unknown>;
  env?: Record<string, string>;
}

export interface BobConfig {
  models?: Record<string, { model: string; recommended?: string }>;
  mcp?: Record<string, { enabled: boolean }>;
  lsp?: Record<string, LspServerConfig>;
  agent_restrictions?: Record<string, Record<string, boolean>>;
  hooks?: { disabled?: string[] };
  tools?: { disabled?: string[] };
  agent_overrides?: Record<string, AgentOverrides>;
  disabled_agents?: string[];
  disabled_hooks?: string[];
  auth?: Record<string, string>;
  background_manager?: {
    concurrency_limit?: number;
    stale_timeout_ms?: number;
    circuit_breaker?: {
      enabled?: boolean;
      max_tool_calls?: number;
      consecutive_threshold?: number;
    };
  };
  telemetry?: {
    enabled: boolean;
    endpoint?: string;
    serviceName?: string;
    sampleRate?: number;
  };
  completion?: CompletionConfig;
  // Native memory-consolidation passes (host runs `dream`/`distill` subagents on
  // an interval). User-facing knobs: `auto` + `interval_days`. `model` is set
  // automatically to Bob's model by loadConfig (not user-facing) and read by the
  // patched auto-dream trigger to pin the pass model instead of the active one.
  dream?: { auto?: boolean; interval_days?: number; model?: string };
  distill?: { auto?: boolean; interval_days?: number; model?: string };
}

// Backwards-compatible alias used by older code paths.
export type HiaiBobConfig = BobConfig;

export interface ClosureBlock {
  reasoning: string;
  evidence: string[];
  readiness: "accept" | "reject" | "done";
}

export interface HookSet {
  "experimental.chat.messages.transform"?: (
    input: Record<string, never>,
    output: { messages: Array<{ info: unknown; parts: unknown[] }> },
  ) => Promise<void>;
  "experimental.chat.system.transform"?: (
    input: { sessionID?: string; model: unknown },
    output: { system: string[] },
  ) => Promise<void>;
  "experimental.session.compacting"?: (
    input: { sessionID: string },
    output: { context: string[]; prompt?: string },
  ) => Promise<void>;
  "experimental.compaction.autocontinue"?: (
    input: {
      sessionID: string;
      agent: string;
      model: unknown;
      provider: unknown;
      message: unknown;
      overflow: boolean;
    },
    output: { enabled: boolean },
  ) => Promise<void>;
  event?: (input: { event: unknown }) => Promise<void>;
  "chat.message"?: (
    input: {
      sessionID: string;
      agent?: string;
      model?: { providerID: string; modelID: string };
      messageID?: string;
      variant?: string;
    },
    output: { message: unknown; parts: unknown[] },
  ) => Promise<void>;
  "chat.params"?: (
    input: {
      sessionID: string;
      agent: string;
      model: unknown;
      provider: unknown;
      message: unknown;
    },
    output: {
      temperature: number;
      topP: number;
      topK: number;
      maxOutputTokens: number | undefined;
      options: Record<string, unknown>;
    },
  ) => Promise<void>;
  "tool.execute.before"?: (
    input: { tool: string; sessionID: string; callID: string; agent?: string },
    output: { args: unknown },
  ) => Promise<void>;
  "tool.execute.after"?: (
    input: { tool: string; sessionID: string; callID: string; args: unknown },
    output: { title: string; output: string; metadata: unknown },
  ) => Promise<void>;
  "command.execute.before"?: (
    input: { command: string },
    output: Record<string, unknown>,
  ) => Promise<void>;
  dispose?: () => Promise<void>;
}