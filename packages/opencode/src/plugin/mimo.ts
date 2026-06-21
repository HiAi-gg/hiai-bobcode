// =============================================================================
// hiai-bob: MimoAuthPlugin DISABLED for standard-provider migration (2026-06-21).
//
// The Xiaomi MiMo platform auth overlay (platform.xiaomimimo.com OAuth flow,
// X25519 + AES-256-GCM key agreement, X-Mimo-Source header injection, local
// callback server) is no longer wired in. Bob now uses standard opencode
// providers via openrouter / opencode-go / google / deepseek / etc.
//
// The exported MimoAuthPlugin is preserved so existing imports stay valid,
// but it now returns an empty Hooks object — no auth method is registered, no
// chat.headers hook is installed.
//
// AnthropicProxyPlugin remains ACTIVE — it is provider-agnostic and only
// touches the Anthropic provider's response stream (no xiaomi dependency).
// =============================================================================

import type { Hooks, PluginInput } from "@mimo-ai/plugin"

// DISABLED for hiai-bob — see file header.
export async function MimoAuthPlugin(_input: PluginInput): Promise<Hooks> {
  // DISABLED: returns empty hooks — see file header.
  return {}
}

export async function AnthropicProxyPlugin(_input: PluginInput): Promise<Hooks> {
  return {
    auth: {
      provider: "anthropic",
      async loader(_getAuth, provider) {
        if (!provider?.options?.baseURL) return {}
        return {
          async fetch(url: any, init: any) {
            if (init?.headers && typeof init.headers === "object" && !Array.isArray(init.headers)) {
              delete init.headers["anthropic-beta"]
            }
            const res = await fetch(url, init)
            if (!res.body || !res.headers.get("content-type")?.includes("text/event-stream")) return res
            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let done = false
            let buffer = ""
            const body = new ReadableStream<Uint8Array>({
              async pull(ctrl) {
                if (done) { ctrl.close(); return }
                const chunk = await reader.read()
                if (chunk.done) { ctrl.close(); return }
                ctrl.enqueue(chunk.value)
                buffer += decoder.decode(chunk.value, { stream: true })
                if (buffer.includes("\nevent: message_stop\n") || buffer.includes("\ndata: {\"type\":\"message_stop\"}")) {
                  done = true
                  void reader.cancel()
                  ctrl.close()
                }
                if (buffer.length > 512) buffer = buffer.slice(-256)
              },
              cancel() { reader.cancel() },
            })
            return new Response(body, { headers: res.headers, status: res.status })
          },
        }
      },
      methods: [],
    },
  }
}
