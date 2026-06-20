// Shared prompt fragments for the HOST-NATIVE memory + task systems.
//
// The hiai host ships a built-in `memory` tool (Anthropic `memory_20250818`
// spec) backed by persistent, FTS5-indexed markdown files under the host's data
// dir (long-term project memory + per-session checkpoints and task progress).
// It also tracks delegation as a persistent parent/child `task` tree that
// survives restarts.
//
// BobPlugin therefore does NOT ship its own memory store and must not maintain
// a shadow task list — agents use these native systems directly.

export const NATIVE_MEMORY_PROMPT = `
## Memory (host-native)
This host provides a built-in \`memory\` tool backed by persistent, full-text-indexed files
(long-term project memory + per-session checkpoints and task progress). Use it directly —
there is NO external memory MCP.
- Before non-trivial work: recall relevant prior context (decisions, patterns, plans, open threads).
- After significant work: persist durable facts — decisions, patterns, and task progress — concisely.
- Keep entries short and factual; the host indexes and searches them automatically.`

export const NATIVE_TASKS_PROMPT = `
## Tasks & delegation tree (host-native)
Delegation via \`actor(subagent_type=...)\` is recorded by the host as a persistent parent/child
task tree (status, progress, checkpoints) that survives restarts. Do NOT keep a separate shadow
task list — rely on the native tree and write progress/decisions to native memory.`
