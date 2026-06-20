import { LSPClient } from "./lsp-client"
import { getServerDef } from "./server-definitions"

export class LSPManager {
  private clients = new Map<string, { client: LSPClient; refCount: number }>()
  private pending = new Map<string, Promise<LSPClient>>()

  async getClient(root: string, serverId: string): Promise<LSPClient> {
    const key = `${root}::${serverId}`
    const existing = this.clients.get(key)
    if (existing) {
      existing.refCount++
      return existing.client
    }
    const pending = this.pending.get(key)
    if (pending) return pending

    const promise = this.createClient(root, serverId, key)
    this.pending.set(key, promise)
    try {
      const client = await promise
      return client
    } finally {
      this.pending.delete(key)
    }
  }

  private async createClient(root: string, serverId: string, key: string): Promise<LSPClient> {
    const server = getServerDef(serverId)
    if (!server) throw new Error(`Unknown or disabled LSP server: ${serverId}`)
    const argv = [server.command, ...server.args]
    const client = new LSPClient(root, argv, {
      initializationOptions: server.initializationOptions,
      env: server.env,
    })
    await client.start()
    const existing = this.clients.get(key)
    if (existing) {
      existing.refCount++
      return existing.client
    }
    this.clients.set(key, { client, refCount: 1 })
    return client
  }

  async releaseClient(root: string, serverId: string) {
    const key = `${root}::${serverId}`
    const entry = this.clients.get(key)
    if (!entry) return
    entry.refCount--
    if (entry.refCount <= 0) {
      await entry.client.stop()
      this.clients.delete(key)
    }
  }

  async disposeAll() {
    for (const entry of this.clients.values()) {
      await entry.client.stop()
    }
    this.clients.clear()
  }
}
