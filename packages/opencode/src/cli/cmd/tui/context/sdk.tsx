import { createOpencodeClient } from "@mimo-ai/sdk/v2"
import type { GlobalEvent } from "@mimo-ai/sdk/v2"
import { createSimpleContext } from "./helper"
import { createGlobalEmitter } from "@solid-primitives/event-bus"
import { Flag } from "@/flag/flag"
import { batch, onCleanup, onMount } from "solid-js"

export type EventSource = {
  subscribe: (handler: (event: GlobalEvent) => void) => Promise<() => void>
}

export const { use: useSDK, provider: SDKProvider } = createSimpleContext({
  name: "SDK",
  init: (props: {
    url: string
    directory?: string
    fetch?: typeof fetch
    headers?: RequestInit["headers"]
    events?: EventSource
  }) => {
    const abort = new AbortController()
    let sse: AbortController | undefined

    let currentDirectory = props.directory
    let currentWorkspace: string | undefined

    function createSDK(directory?: string, experimental_workspaceID?: string) {
      return createOpencodeClient({
        baseUrl: props.url,
        signal: abort.signal,
        directory,
        experimental_workspaceID,
        fetch: props.fetch,
        headers: props.headers,
      })
    }

    let sdk = createSDK(currentDirectory, currentWorkspace)

    // Per-workspace client cache. Workspace-aware SDK clients (Phase 1.3) carry the
    // `x-mimocode-workspace` header so the server routes traffic to the right bus.
    // The "default" client (no workspaceID) is keyed under `undefined` and is the
    // one returned by the existing `client` getter for backward compatibility.
    const clients = new Map<string | undefined, ReturnType<typeof createOpencodeClient>>()
    clients.set(currentWorkspace, sdk)

    const emitter = createGlobalEmitter<{
      event: GlobalEvent
    }>()

    let queue: GlobalEvent[] = []
    let timer: Timer | undefined
    let last = 0
    const retryDelay = 1000
    const maxRetryDelay = 30000

    const flush = () => {
      if (queue.length === 0) return
      const events = queue
      queue = []
      timer = undefined
      last = Date.now()
      // Batch all event emissions so all store updates result in a single render
      batch(() => {
        for (const event of events) {
          emitter.emit("event", event)
        }
      })
    }

    const handleEvent = (event: GlobalEvent) => {
      queue.push(event)
      const elapsed = Date.now() - last

      if (timer) return
      // If we just flushed recently (within 16ms), batch this with future events
      // Otherwise, process immediately to avoid latency
      if (elapsed < 16) {
        timer = setTimeout(flush, 16)
        return
      }
      flush()
    }

    function startSSE() {
      sse?.abort()
      const ctrl = new AbortController()
      sse = ctrl
      ;(async () => {
        let attempt = 0
        while (true) {
          if (abort.signal.aborted || ctrl.signal.aborted) break

          const events = await sdk.global.event({
            signal: ctrl.signal,
            sseMaxRetryAttempts: 0,
          })

          if (Flag.MIMOCODE_EXPERIMENTAL_WORKSPACES) {
            // Start syncing workspaces, it's important to do this after
            // we've started listening to events
            await sdk.sync.start().catch(() => {})
          }

          for await (const event of events.stream) {
            if (ctrl.signal.aborted) break
            handleEvent(event)
          }

          if (timer) clearTimeout(timer)
          if (queue.length > 0) flush()
          attempt += 1
          if (abort.signal.aborted || ctrl.signal.aborted) break

          // Exponential backoff
          const backoff = Math.min(retryDelay * 2 ** (attempt - 1), maxRetryDelay)
          await new Promise((resolve) => setTimeout(resolve, backoff))
        }
      })().catch(() => {})
    }

    onMount(async () => {
      if (props.events) {
        const unsub = await props.events.subscribe(handleEvent)
        onCleanup(unsub)

        if (Flag.MIMOCODE_EXPERIMENTAL_WORKSPACES) {
          // Start syncing workspaces, it's important to do this after
          // we've started listening to events
          await sdk.sync.start().catch(() => {})
        }
      } else {
        startSSE()
      }
    })

    onCleanup(() => {
      abort.abort()
      sse?.abort()
      if (timer) clearTimeout(timer)
    })

    return {
      get client() {
        return sdk
      },
      get directory() {
        return currentDirectory
      },
      switchDirectory(next: string) {
        currentDirectory = next
        const nextClient = createSDK(next, currentWorkspace)
        sdk = nextClient
        clients.set(currentWorkspace, nextClient)
      },
      // Return a SDK client scoped to a specific workspace. Cached per workspaceID
      // so repeat calls reuse the same client (and its underlying signal/fetch).
      // `undefined` workspaceID resolves to the default (current) client.
      getClient(workspaceID?: string) {
        const key = workspaceID
        const existing = clients.get(key)
        if (existing) return existing
        const next = createSDK(currentDirectory, key)
        clients.set(key, next)
        return next
      },
      // Drop a workspace's cached client. Called by sync.tsx when a workspace is
      // evicted so we don't leak file handles or signal listeners.
      cleanupClient(workspaceID?: string) {
        const key = workspaceID
        const cached = clients.get(key)
        if (!cached) return
        clients.delete(key)
        if (sdk === cached) {
          // If we just evicted the active client, fall back to the default (no workspace).
          const fallback = clients.get(undefined) ?? createSDK(currentDirectory)
          sdk = fallback
          clients.set(undefined, fallback)
        }
      },
      event: emitter,
      fetch: props.fetch ?? fetch,
      url: props.url,
    }
  },
})
