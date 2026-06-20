#!/usr/bin/env bun
// script/rebrand.ts
//
// Strips user-facing MiMo / Xiaomi product marks from this fork and writes
// a clean rebranded distribution tree under ./dist/rebrand/.
//
// SCOPE — every file touched is listed in FILE_MAP below. Everything else
// in the repository is left alone, including:
//   - @mimo-ai/* internal workspace package imports (kept verbatim so the
//     monorepo build keeps resolving)
//   - LICENSE  (upstream MIT copyright preserved verbatim)
//
// BRAND MAP — order matters, longest first to avoid partial overlaps:
//   XiaomiMiMo    → hiai-opencode
//   xiaomimimo    → hiai-opencode   (lowercase, appears in domain)
//   MiMoCode      → hiai-bob
//   "MiMo Code"   → hiai-bob
//   "MiMo Auto"   → "Bob Auto"
//   MiMo          → Bob
//   Xiaomi        → ""            (bare "Xiaomi" in splash wordmark)
//   mimocode (whole word) → hiai-bob
//   mimo     (whole word) → bob
//
// Whole-word boundaries preserve config-surface identifiers that share the
// same root (e.g. `.mimocode` cache dir, `MIMOCODE_BIN_PATH` env var,
// `mimocode.json` config filename).
//
// USAGE:
//   bun run script/rebrand.ts                 # default → ./dist/rebrand
//   bun run script/rebrand.ts --out ./rebrand # custom output dir
//   bun run script/rebrand.ts --check         # dry run, exit 1 if any diff

import path from "path"
import fs from "fs/promises"

const ROOT = path.resolve(import.meta.dirname, "..")
const OUT_DEFAULT = path.join(ROOT, "dist", "rebrand")

const argv = process.argv.slice(2)
const checkOnly = argv.includes("--check")
const outIdx = argv.findIndex((a) => a === "--out" || a.startsWith("--out="))
const OUT = outIdx === -1
  ? OUT_DEFAULT
  : path.resolve(argv[outIdx].startsWith("--out=") ? argv[outIdx].slice("--out=".length) : argv[outIdx + 1])

const FILE_MAP: Array<{ from: string; to: string; kind: "text" | "binary" }> = [
  { from: "README.md", to: "README.md", kind: "text" },
  { from: "README.zh.md", to: "README.zh.md", kind: "text" },
  { from: "package.json", to: "package.json", kind: "text" },
  { from: "USE_RESTRICTIONS.md", to: "USE_RESTRICTIONS.md", kind: "text" },
  { from: "packages/opencode/package.json", to: "packages/opencode/package.json", kind: "text" },
  { from: "packages/opencode/bin/mimo", to: "packages/opencode/bin/bob", kind: "text" },
  { from: "packages/opencode/src/cli/logo.ts", to: "packages/opencode/src/cli/logo.ts", kind: "text" },
  { from: "assets/readme/mimocode-banner.png", to: "assets/readme/bob-banner.png", kind: "binary" },
  { from: "assets/readme/community-qrcode-1.jpg", to: "assets/readme/community-qrcode-1.jpg", kind: "binary" },
  { from: "assets/readme/community-qrcode-2.jpg", to: "assets/readme/community-qrcode-2.jpg", kind: "binary" },
]

const SUBSTITUTIONS: Array<[string, string]> = [
  ["XiaomiMiMo", "hiai-opencode"],
  ["xiaomimimo", "hiai-opencode"],
  ["MiMoCode", "hiai-bob"],
  ["MiMo Code", "hiai-bob"],
  ["MiMo Auto", "Bob Auto"],
  ["MiMo", "Bob"],
  ["Xiaomi", ""],
]

function rewritePackageJson(input: unknown, isOpencode: boolean): unknown {
  if (!input || typeof input !== "object") return input
  const pkg = JSON.parse(JSON.stringify(input))
  if (isOpencode) {
    pkg.name = "@hiai-bob/cli"
    pkg.bin = { bob: "./bin/bob" }
    pkg.description = "Bob — autonomous AI coding agent (rebranded from MiMoCode)"
  } else {
    pkg.description = "Bob — autonomous AI coding agent monorepo (rebranded from MiMoCode)"
  }
  return pkg
}

// Config-surface identifiers that must NOT be rewritten, even when they
// would otherwise match a brand token. Listed with their placeholder, then
// the placeholder is restored verbatim after substitution.
const PRESERVE_TOKENS: Array<[string, string]> = [
  ["MIMOCODE_BIN_PATH", "\u0000PRESERVE_MIMOCODE_BIN_PATH\u0000"],
  ["MIMOCODE_HOME", "\u0000PRESERVE_MIMOCODE_HOME\u0000"],
  [".mimocode", "\u0000PRESERVE_DOT_MIMOCODE\u0000"],
  ["mimocode.json", "\u0000PRESERVE_MIMOCODE_JSON\u0000"],
]

function applyTextSubstitutions(input: string): string {
  let out = input
  for (const [token, placeholder] of PRESERVE_TOKENS) {
    out = out.split(token).join(placeholder)
  }
  for (const [from, to] of SUBSTITUTIONS) {
    out = out.split(from).join(to)
  }
  out = out.replace(/\bmimocode\b/g, "hiai-bob")
  out = out.replace(/\bmimo\b/g, "bob")
  for (const [token, placeholder] of PRESERVE_TOKENS) {
    out = out.split(placeholder).join(token)
  }
  return out
}

function processText(srcPath: string, original: string): string {
  if (srcPath === "packages/opencode/package.json" || srcPath === "package.json") {
    return JSON.stringify(rewritePackageJson(JSON.parse(original), srcPath === "packages/opencode/package.json"), null, 2) + "\n"
  }
  return applyTextSubstitutions(original)
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function main() {
  console.log(`[rebrand] root: ${ROOT}`)
  console.log(`[rebrand] out:  ${OUT}`)
  console.log(`[rebrand] mode: ${checkOnly ? "check (dry run)" : "write"}`)

  const missing = (
    await Promise.all(
      FILE_MAP.map(async (entry) => ((await exists(path.join(ROOT, entry.from))) ? null : entry.from)),
    )
  ).filter((x): x is string => x !== null)
  if (missing.length) {
    console.error(`[rebrand] missing source files:\n  - ${missing.join("\n  - ")}`)
    process.exit(1)
  }

  let totalBytes = 0
  let totalReplacements = 0
  const changes: Array<string> = []

  for (const entry of FILE_MAP) {
    const srcAbs = path.join(ROOT, entry.from)
    const dstAbs = path.join(OUT, entry.to)
    await fs.mkdir(path.dirname(dstAbs), { recursive: true })

    if (entry.kind === "binary") {
      const buf = await fs.readFile(srcAbs)
      await fs.writeFile(dstAbs, buf)
      totalBytes += buf.byteLength
      console.log(`[rebrand] copy   ${entry.from} → ${entry.to} (${buf.byteLength} bytes)`)
      continue
    }

    const original = await Bun.file(srcAbs).text()
    const updated = processText(entry.from, original)

    let count = 0
    for (const [from] of SUBSTITUTIONS) {
      count += original.split(from).length - 1
    }
    const lowercaseMatches = (original.match(/\bmimocode\b/g)?.length ?? 0) + (original.match(/\bmimo\b/g)?.length ?? 0)
    count += lowercaseMatches
    for (const [token] of PRESERVE_TOKENS) {
      count -= original.split(token).length - 1
    }
    totalReplacements += count

    if (updated !== original) changes.push(entry.to)
    if (!checkOnly) await fs.writeFile(dstAbs, updated, "utf8")

    totalBytes += updated.length
    console.log(`[rebrand] ${checkOnly ? "check" : "write"}  ${entry.from} → ${entry.to} (${count} brand hits)`)
  }

  console.log("")
  console.log(`[rebrand] summary:`)
  console.log(`  files processed: ${FILE_MAP.length}`)
  console.log(`  brand hits:      ${totalReplacements}`)
  console.log(`  total bytes:     ${totalBytes}`)
  console.log(`  changed files:   ${changes.length}`)
  for (const c of changes) console.log(`    - ${c}`)
  console.log(`[rebrand] done.${checkOnly ? " (dry run — no files written)" : ""}`)
}

await main()
