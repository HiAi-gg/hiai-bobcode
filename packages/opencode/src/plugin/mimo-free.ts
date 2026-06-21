// =============================================================================
// DISABLED for hiai-bob standard-provider migration (2026-06-21).
//
// The Xiaomi MiMo free-channel overlay (api.xiaomimimo.com /api/free-ai) is no
// longer wired in. Bob now uses standard opencode providers via openrouter /
// opencode-go / google / deepseek / kimi-for-coding / etc., as configured in
// bob.json.
//
// The exported plugin is preserved so existing imports stay valid, but it now
// returns an empty Hooks object — no providers are registered, no JWT bootstrap
// is performed, no anonymous fetch wrapper is installed.
//
// To re-enable: restore the original body from git history and re-export the
// MimoFree object below.
// =============================================================================

import type { Hooks, PluginInput } from "@mimo-ai/plugin"

export const MimoFree = {
  // Stub object — preserves the shape other modules import, but every call is
  // a no-op so nothing accidentally dials api.xiaomimimo.com.
  baseUrl: "",
  bootstrapUrl: "",
  chatBaseUrl: "",
  fingerprint: () => "",
  async verify() {
    throw new Error(
      "MimoFree.verify() is disabled in hiai-bob. Use a standard opencode provider (openrouter, opencode-go, google, deepseek, kimi-for-coding, etc.) — see bob.json.",
    )
  },
}

export async function MimoFreeAuthPlugin(_input: PluginInput): Promise<Hooks> {
  // DISABLED: returns empty hooks — see file header.
  return {}
}
