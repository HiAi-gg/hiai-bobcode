import { afterEach, beforeEach, describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import * as fs from "fs/promises"
import path from "path"
import { Bus } from "../../src/bus"
import { Config } from "../../src/config"
import { Global } from "../../src/global"
import { Memory } from "../../src/memory"
import { Session as SessionNs } from "../../src/session"
import { SessionCheckpoint } from "../../src/session/checkpoint"
import { SessionCompaction } from "../../src/session/compaction"
import { TaskRegistry } from "../../src/task/registry"
import { ActorRegistry } from "../../src/actor/registry"
import { MessageID, PartID, SessionID } from "../../src/session/schema"
import { ModelID, ProviderID } from "../../src/provider/schema"
import { Instance } from "../../src/project/instance"
import * as CrossSpawnSpawner from "../../src/effect/cross-spawn-spawner"
import { provideTmpdirInstance } from "../fixture/fixture"
import { testEffect } from "../lib/effect"
import { Log } from "../../src/util"

void Log.init({ print: false })

const ref = {
  providerID: ProviderID.make("test"),
  modelID: ModelID.make("test-model"),
}

// Wipe the cross-session memory pollution that sibling tests leave behind in
// `<XDG_DATA_HOME>/memory/` (resolveMimocodeHome sets `data` per-PID via
// test/preload.ts, but files written there persist within the same `bun test`
// process). Without this, renderRebuildContext's early-return check sees a
// non-empty `memoryText` (project MEMORY.md) or `globalText` (user-level
// MEMORY.md) and produces a real rebuild body — so `insertRebuildBoundary`
// returns true instead of false, breaking the "empty rebuild context" test
// below. Same reasoning and shape as `clearMemoryPollution` in
// test/session/checkpoint-rebuild-v3.test.ts.
async function clearMemoryPollution() {
  const root = path.join(Global.Path.data, "memory")
  const projectsDir = path.join(root, "projects")
  await fs.rm(projectsDir, { recursive: true, force: true }).catch(() => {})
  await fs.mkdir(projectsDir, { recursive: true }).catch(() => {})
  const globalDir = path.join(root, "global")
  await fs.rm(globalDir, { recursive: true, force: true }).catch(() => {})
  await fs.mkdir(globalDir, { recursive: true }).catch(() => {})
}

beforeEach(clearMemoryPollution)
afterEach(async () => {
  await Instance.disposeAll()
  await clearMemoryPollution()
})

const it = testEffect(
  Layer.mergeAll(
    CrossSpawnSpawner.defaultLayer,
    Bus.defaultLayer,
    Config.defaultLayer,
    Memory.defaultLayer,
    SessionNs.defaultLayer,
    TaskRegistry.defaultLayer,
    ActorRegistry.defaultLayer,
    SessionCheckpoint.defaultLayer,
  ),
)

async function seedUserMessage(sessionID: SessionID, text: string) {
  const ssn = await Effect.runPromise(
    SessionNs.Service.use((s) =>
      s.updateMessage({
        id: MessageID.ascending(),
        role: "user",
        sessionID,
        agent: "build",
        model: ref,
        time: { created: Date.now() },
      }),
    ).pipe(Effect.provide(SessionNs.defaultLayer)),
  )
  await Effect.runPromise(
    SessionNs.Service.use((s) =>
      s.updatePart({
        id: PartID.ascending(),
        messageID: ssn.id,
        sessionID,
        type: "text",
        text,
      }),
    ).pipe(Effect.provide(SessionNs.defaultLayer)),
  )
  return ssn
}

describe("SessionCheckpoint.insertRebuildBoundary", () => {
  it.live(
    "insertRebuildBoundary returns false and inserts nothing when rebuild context is empty",
    provideTmpdirInstance(() =>
      Effect.gen(function* () {
        const ssn = yield* SessionNs.Service
        const cp = yield* SessionCheckpoint.Service
        const info = yield* ssn.create({})

        const m1 = yield* Effect.promise(() => seedUserMessage(info.id, "turn one"))
        const _m2 = yield* Effect.promise(() => seedUserMessage(info.id, "turn two"))
        const m3 = yield* Effect.promise(() => seedUserMessage(info.id, "turn three"))

        // No checkpoint file → renderRebuildContext is empty → helper returns false, inserts nothing.
        const insertedNoCtx = yield* cp.insertRebuildBoundary({
          sessionID: info.id,
          boundary: m3.id,
          agent: "build",
          model: { providerID: "anthropic", modelID: "claude" },
        })
        expect(insertedNoCtx).toBe(false)

        const after = yield* ssn.messages({ sessionID: info.id })
        // Every original message still present — nothing deleted.
        expect(after.some((m) => m.info.id === m1.id)).toBe(true)
        expect(after.some((m) => m.info.id === m3.id)).toBe(true)
        expect(after.length).toBe(3)
      }),
    ),
  )
})

describe("SessionCompaction.create preserves messages", () => {
  // This is the exact call the restored POST /:sessionID/summarize route makes.
  // Unlike the deleted SessionTrim.trim (which physically deleted rows),
  // compaction only inserts a synthetic boundary message — it never deletes.
  it.live(
    "create inserts a compaction boundary and keeps every prior message",
    provideTmpdirInstance(() =>
      Effect.gen(function* () {
        const ssn = yield* SessionNs.Service
        const info = yield* ssn.create({})

        const seeded = yield* Effect.forEach(["turn one", "turn two", "turn three"], (text) =>
          Effect.promise(() => seedUserMessage(info.id, text)),
        )

        const before = yield* ssn.messages({ sessionID: info.id })
        expect(before.length).toBe(seeded.length)

        // Same call as the /summarize route: SessionCompaction.create runs purely
        // synthetically (no LLM) — it appends a boundary message + compaction part.
        yield* Effect.promise(() =>
          SessionCompaction.create({
            sessionID: info.id,
            agent: "build",
            model: ref,
            auto: false,
          }),
        )

        const after = yield* ssn.messages({ sessionID: info.id })
        // Compaction never deletes: all originals survive, plus one boundary message.
        for (const m of seeded) {
          expect(after.some((x) => x.info.id === m.id)).toBe(true)
        }
        expect(after.length).toBe(seeded.length + 1)
        // The appended boundary carries a compaction part.
        const boundary = after.at(-1)!
        expect(boundary.parts.some((p) => p.type === "compaction")).toBe(true)
      }),
    ),
  )
})
