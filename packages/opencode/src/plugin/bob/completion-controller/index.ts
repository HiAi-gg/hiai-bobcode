import type {
  Hooks,
  PluginInput,
  ActorPostStopRegistration,
} from "@mimo-ai/plugin"
import type { BobConfig } from "../shared/types"
import { decide } from "./decide"
import * as st from "./state"
import { matchesAnyGlob, parseCriticVerdict } from "./signals"

let client: PluginInput["client"] | null = null

export function setCompletionClient(c: PluginInput["client"]) {
  client = c
}

export function createBobCompletionHook(
  config: BobConfig,
): Pick<Hooks, "tool.execute.after" | "actor.postStop" | "permission.ask"> {
  const cfg = config.completion ?? {
    enabled: true,
    max_auto_continues: 25,
    require_critic: true,
    ui_globs: [],
    reset_on_user_message: true,
  }
  if (!cfg.enabled) return {}

  async function readLastAssistantVerdict(
    sessionID: string,
  ): Promise<"approved" | "rejected" | null> {
    if (!client) return null
    try {
      const res = await client.session.messages({ path: { id: sessionID } })
      const msgs = (res.data ?? []) as Array<{
        info?: { role?: string }
        parts?: Array<{ type?: string; text?: string }>
      }>
      const lastAssistant = [...msgs].reverse().find((m) => m.info?.role === "assistant")
      const text = (lastAssistant?.parts ?? [])
        .filter((p) => p.type === "text")
        .map((p) => p.text ?? "")
        .join("")
      return parseCriticVerdict(text)
    } catch {
      return null
    }
  }

  return {
    "tool.execute.after": async (input, _output) => {
      const sid = input.sessionID
      if (!sid) return
      if (input.tool !== "write" && input.tool !== "edit" && input.tool !== "apply_patch")
        return
      const args = (input.args as Record<string, unknown> | undefined) ?? {}
      const fp = (args.filePath ?? args.path) as string | undefined
      if (!fp) return
      st.recordChangedFile(sid, fp, matchesAnyGlob(fp, cfg.ui_globs))
    },

    "permission.ask": async (input, output) => {
      if (cfg.reset_on_user_message) {
        const sid = (input as { sessionID?: string }).sessionID
        const role = (input as { role?: string }).role
        if (role === "user" && sid) st.resetForUser(sid)
      }
    },

    "actor.postStop": {
      matcher: { mode: "peer" },
      run: async (input, output) => {
        const sid = input.sessionID
        if (!sid) return

        if (input.agentType === "critic") {
          const verdict = await readLastAssistantVerdict(sid)
          if (verdict) {
            const parent = input.parentSessionID ?? sid
            st.recordCriticVerdict(parent, verdict)
          }
          return
        }

        if (input.parentSessionID) return

        const s = st.get(sid)
        const action = decide({
          autoContinues: s.autoContinues,
          maxAutoContinues: cfg.max_auto_continues,
          hasIncompleteTodos: s.hasIncompleteTodos,
          changedFiles: s.changedFiles,
          currentFingerprint: st.currentFingerprint(s),
          reviewedFingerprint: s.reviewedFingerprint,
          criticVerdict: s.criticVerdict,
          blockerFlagged: s.blockerFlagged,
          uiChanged: s.uiChangedSinceReview,
          requireCritic: cfg.require_critic,
        })

        if (action.kind === "stop") return
        s.autoContinues += 1
        output.continue = true
        output.reason = action.prompt
      },
    } as ActorPostStopRegistration,
  }
}
