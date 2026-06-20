import type { AgentConfig, BobConfig } from "../shared/types"
import { BOB_PROMPT } from "./bob"
import { CODER_PROMPT } from "./coder"
import { STRATEGIST_PROMPT } from "./strategist"
import { CRITIC_PROMPT } from "./critic"
import { RESEARCHER_PROMPT } from "./researcher"
import { MANAGER_PROMPT } from "./manager"
import { WRITER_PROMPT } from "./writer"
import { DESIGNER_PROMPT } from "./designer"
import { VISION_PROMPT } from "./vision"
import { SUB_PROMPT } from "./sub"

export interface AgentDefinition {
  key: string
  config: AgentConfig
}

function resolveModel(agentKey: string, config: BobConfig): string | undefined {
  return config.models?.[agentKey]?.model
}

export function createAllAgents(config: BobConfig): AgentDefinition[] {
  const disabled = new Set(config.disabled_agents ?? [])

  const agents: { key: string; config: AgentConfig }[] = [
    {
      key: "bob",
      config: {
        name: "Bob",
        description:
          "Orchestrator — research, delegate, verify. Primary agent for all tasks.",
        mode: "primary",
        model: resolveModel("bob", config),
        prompt: BOB_PROMPT,
        temperature: 0.3,
      },
    },
    {
      key: "coder",
      config: {
        name: "Coder",
        description: "Builder — implements from plans with deep code analysis.",
        mode: "subagent",
        model: resolveModel("coder", config),
        prompt: CODER_PROMPT,
        temperature: 0.2,
        thinking: { type: "enabled", budgetTokens: 16000 },
      },
    },
    {
      key: "strategist",
      config: {
        // mode "all" → selectable in the agent picker AND delegatable by Bob
        // (the spawnable enum includes "all"; see tool/actor.ts).
        name: "Strategist",
        description:
          "Deep research — complex exploration, multi-signal investigation, architecture planning.",
        mode: "all",
        model: resolveModel("strategist", config),
        prompt: STRATEGIST_PROMPT,
        temperature: 0.1,
        thinking: { type: "enabled", budgetTokens: 16000 },
      },
    },
    {
      key: "manager",
      config: {
        name: "Manager",
        description:
          "Architecture — systems, boundaries, integration, delegation coordination.",
        mode: "subagent",
        model: resolveModel("manager", config),
        prompt: MANAGER_PROMPT,
        temperature: 0.2,
      },
    },
    {
      key: "critic",
      config: {
        name: "Critic",
        description:
          "Plan critic — reviewing plans for clarity, verifiability, and quality.",
        mode: "subagent",
        model: resolveModel("critic", config),
        prompt: CRITIC_PROMPT,
        temperature: 0.1,
      },
    },
    {
      key: "researcher",
      config: {
        name: "Researcher",
        description:
          "Contextual grep — finding code, patterns, structure in the codebase.",
        mode: "subagent",
        model: resolveModel("researcher", config),
        prompt: RESEARCHER_PROMPT,
        temperature: 0.1,
      },
    },
    {
      key: "writer",
      config: {
        name: "Writer",
        description:
          "Content, copy, positioning, SEO. Website/product copy specialist.",
        mode: "subagent",
        model: resolveModel("writer", config),
        prompt: WRITER_PROMPT,
        temperature: 0.5,
      },
    },
    {
      key: "designer",
      config: {
        name: "Designer",
        description:
          "UI/visual direction via design systems and component specifications.",
        mode: "subagent",
        model: resolveModel("designer", config),
        prompt: DESIGNER_PROMPT,
        temperature: 0.4,
      },
    },
    {
      key: "vision",
      config: {
        name: "Vision",
        description:
          "Analyze images, PDFs, diagrams. Visual content extraction and verification.",
        mode: "subagent",
        model: resolveModel("vision", config),
        prompt: VISION_PROMPT,
        temperature: 0.2,
      },
    },
    {
      key: "sub",
      config: {
        name: "Sub",
        description:
          "Cheap bounded executor — fast, simple tasks, fallback for failed agents.",
        mode: "subagent",
        model: resolveModel("sub", config) ?? resolveModel("manager", config),
        prompt: SUB_PROMPT,
        temperature: 0.1,
        // NOTE: must NOT be hidden — the spawnable subagent enum filters
        // `mode === "subagent" && !hidden`, so `hidden: true` would make `sub`
        // impossible to delegate to (the prompts route cheap/fallback work to
        // it). As a subagent it already stays out of the primary picker.
      },
    },
  ]

  return agents
    .filter((a) => !disabled.has(a.key))
    .map((a) => ({
      key: a.key,
      config: {
        ...a.config,
        ...(config.agent_overrides?.[a.key] ?? {}),
      },
    }))
}
