import { tool } from "@mimo-ai/plugin"
import { join, extname, resolve } from "node:path"
import { existsSync } from "node:fs"
import { LSPManager } from "./lsp-manager"
import { findServerForExtension } from "./server-definitions"
import type { LSPDiagnostic, LSPLocation, LSPSymbol } from "./lsp-client"

const manager = new LSPManager()

async function getClientForFile(filePath: string, directory: string) {
  const resolved = filePath.startsWith("/") ? filePath : join(directory, filePath)
  const ext = extname(resolved)
  const match = findServerForExtension(ext)
  if (!match) return { client: null, resolved, serverId: null }
  const client = await manager.getClient(directory, match.id)
  return { client, resolved, serverId: match.id }
}

function formatLocation(loc: LSPLocation, root: string): string {
  const uri = loc.uri.startsWith("file://") ? loc.uri.slice(7) : loc.uri
  const rel = uri.startsWith(root) ? uri.slice(root.length + 1) : uri
  return `${rel}:${loc.range.start.line + 1}:${loc.range.start.character}`
}

function formatDiagnostic(d: LSPDiagnostic, root: string): string {
  const sev =
    d.severity === 1
      ? "ERROR"
      : d.severity === 2
        ? "WARN"
        : d.severity === 3
          ? "INFO"
          : "HINT"
  const pos = `${d.range.start.line + 1}:${d.range.start.character}`
  return `[${sev}] ${pos} — ${d.message}`
}

function formatSymbol(s: LSPSymbol): string {
  const kinds = [
    "",
    "File",
    "Module",
    "Namespace",
    "Package",
    "Class",
    "Method",
    "Property",
    "Field",
    "Constructor",
    "Enum",
    "Interface",
    "Function",
    "Variable",
    "Constant",
    "String",
    "Number",
    "Boolean",
    "Array",
    "Object",
    "Key",
    "Null",
    "EnumMember",
    "Struct",
    "Event",
    "Operator",
    "TypeParameter",
  ]
  const kind = kinds[s.kind] ?? "Unknown"
  const line = s.range.start.line + 1
  return `[${kind}] ${s.name} (line ${line})`
}

export const lspDiagnosticsTool = tool({
  description:
    "Get language diagnostics (errors/warnings) for a file using LSP. Supports TypeScript, Svelte, Python, and more.",
  args: {
    filePath: tool.schema.string().describe("Path to the file to check"),
  },
  async execute(input, ctx) {
    const filePath = input.filePath.startsWith("/")
      ? input.filePath
      : join(ctx.directory, input.filePath)

    const realResolved = resolve(filePath)
    if (!realResolved.startsWith(resolve(ctx.directory))) {
      return {
        title: "Error",
        output: `Access denied: ${input.filePath} is outside the project directory`,
      }
    }

    if (!existsSync(filePath)) {
      return { title: "File not found", output: `File not found: ${filePath}` }
    }

    try {
      const { client, resolved, serverId } = await getClientForFile(filePath, ctx.directory)
      try {
        if (!client) {
          return {
            title: "Unsupported file type",
            output: `No LSP server available for: ${extname(resolved)} files`,
          }
        }

        const diagnostics = await client.diagnostics(resolved)

        if (diagnostics.length === 0) {
          return { title: "No diagnostics", output: "No errors or warnings found." }
        }

        const output = diagnostics
          .map((d) => formatDiagnostic(d, ctx.directory))
          .join("\n")

        return { title: `${diagnostics.length} diagnostic(s)`, output }
      } finally {
        if (serverId) {
          await manager.releaseClient(ctx.directory, serverId)
        }
      }
    } catch (err) {
      return {
        title: "Diagnostics failed",
        output: `Error: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  },
})

export const lspGotoDefinitionTool = tool({
  description: "Go to the definition of a symbol at a given position using LSP.",
  args: {
    filePath: tool.schema.string().describe("Path to the file"),
    line: tool.schema.number().describe("Line number (1-based)"),
    character: tool.schema.number().describe("Column number (0-based)"),
  },
  async execute(input, ctx) {
    const filePath = input.filePath.startsWith("/")
      ? input.filePath
      : join(ctx.directory, input.filePath)

    const realResolved = resolve(filePath)
    if (!realResolved.startsWith(resolve(ctx.directory))) {
      return { title: "Error", output: `Access denied: ${input.filePath} is outside the project directory` }
    }

    if (!existsSync(filePath)) {
      return { title: "File not found", output: `File not found: ${filePath}` }
    }

    try {
      const { client, resolved, serverId } = await getClientForFile(filePath, ctx.directory)
      try {
        if (!client) {
          return {
            title: "Unsupported",
            output: `No LSP server available for: ${extname(resolved)} files`,
          }
        }

        const result = await client.definition(resolved, input.line, input.character)

        if (!result) {
          return { title: "No definition", output: "No definition found at this position." }
        }

        const locations = Array.isArray(result) ? result : [result]
        if (locations.length === 0) {
          return { title: "No definition", output: "No definition found at this position." }
        }

        const output = locations.map((loc) => formatLocation(loc, ctx.directory)).join("\n")
        return { title: `${locations.length} definition(s)`, output }
      } finally {
        if (serverId) {
          await manager.releaseClient(ctx.directory, serverId)
        }
      }
    } catch (err) {
      return {
        title: "Definition lookup failed",
        output: `Error: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  },
})

export const lspFindReferencesTool = tool({
  description: "Find all references to a symbol at a given position using LSP.",
  args: {
    filePath: tool.schema.string().describe("Path to the file"),
    line: tool.schema.number().describe("Line number (1-based)"),
    character: tool.schema.number().describe("Column number (0-based)"),
  },
  async execute(input, ctx) {
    const filePath = input.filePath.startsWith("/")
      ? input.filePath
      : join(ctx.directory, input.filePath)

    const realResolved = resolve(filePath)
    if (!realResolved.startsWith(resolve(ctx.directory))) {
      return { title: "Error", output: `Access denied: ${input.filePath} is outside the project directory` }
    }

    if (!existsSync(filePath)) {
      return { title: "File not found", output: `File not found: ${filePath}` }
    }

    try {
      const { client, resolved, serverId } = await getClientForFile(filePath, ctx.directory)
      try {
        if (!client) {
          return {
            title: "Unsupported",
            output: `No LSP server available for: ${extname(resolved)} files`,
          }
        }

        const refs = await client.references(resolved, input.line, input.character)

        if (refs.length === 0) {
          return { title: "No references", output: "No references found." }
        }

        const output = refs.map((loc) => formatLocation(loc, ctx.directory)).join("\n")
        return { title: `${refs.length} reference(s)`, output }
      } finally {
        if (serverId) {
          await manager.releaseClient(ctx.directory, serverId)
        }
      }
    } catch (err) {
      return {
        title: "Reference lookup failed",
        output: `Error: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  },
})

export const lspSymbolsTool = tool({
  description: "List all symbols (functions, classes, variables, etc.) in a file using LSP.",
  args: {
    filePath: tool.schema.string().describe("Path to the file"),
  },
  async execute(input, ctx) {
    const filePath = input.filePath.startsWith("/")
      ? input.filePath
      : join(ctx.directory, input.filePath)

    const realResolved = resolve(filePath)
    if (!realResolved.startsWith(resolve(ctx.directory))) {
      return { title: "Error", output: `Access denied: ${input.filePath} is outside the project directory` }
    }

    if (!existsSync(filePath)) {
      return { title: "File not found", output: `File not found: ${filePath}` }
    }

    try {
      const { client, resolved, serverId } = await getClientForFile(filePath, ctx.directory)
      try {
        if (!client) {
          return {
            title: "Unsupported",
            output: `No LSP server available for: ${extname(resolved)} files`,
          }
        }

        const symbols = await client.symbols(resolved)

        if (symbols.length === 0) {
          return { title: "No symbols", output: "No symbols found in this file." }
        }

        const output = symbols.map((s) => formatSymbol(s)).join("\n")
        return { title: `${symbols.length} symbol(s)`, output }
      } finally {
        if (serverId) {
          await manager.releaseClient(ctx.directory, serverId)
        }
      }
    } catch (err) {
      return {
        title: "Symbol lookup failed",
        output: `Error: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  },
})

export const lspPrepareRenameTool = tool({
  description: "Prepare a rename operation — checks if the symbol at the position can be renamed.",
  args: {
    filePath: tool.schema.string().describe("Path to the file"),
    line: tool.schema.number().describe("Line number (1-based)"),
    character: tool.schema.number().describe("Column number (0-based)"),
  },
  async execute(input, ctx) {
    const filePath = input.filePath.startsWith("/")
      ? input.filePath
      : join(ctx.directory, input.filePath)

    const realResolved = resolve(filePath)
    if (!realResolved.startsWith(resolve(ctx.directory))) {
      return { title: "Error", output: `Access denied: ${input.filePath} is outside the project directory` }
    }

    if (!existsSync(filePath)) {
      return { title: "File not found", output: `File not found: ${filePath}` }
    }

    try {
      const { client, resolved, serverId } = await getClientForFile(filePath, ctx.directory)
      try {
        if (!client) {
          return {
            title: "Unsupported",
            output: `No LSP server available for: ${extname(resolved)} files`,
          }
        }

        const result = await client.prepareRename(resolved, input.line, input.character)

        if (!result) {
          return { title: "Cannot rename", output: "Symbol at this position cannot be renamed." }
        }

        return {
          title: "Rename ready",
          output: `Can rename. Placeholder: "${result.placeholder}"\nRange: ${result.range.start.line + 1}:${result.range.start.character} — ${result.range.end.line + 1}:${result.range.end.character}`,
        }
      } finally {
        if (serverId) {
          await manager.releaseClient(ctx.directory, serverId)
        }
      }
    } catch (err) {
      return {
        title: "Prepare rename failed",
        output: `Error: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  },
})

export const lspRenameTool = tool({
  description: "Rename a symbol across all files that reference it using LSP.",
  args: {
    filePath: tool.schema.string().describe("Path to the file"),
    line: tool.schema.number().describe("Line number (1-based)"),
    character: tool.schema.number().describe("Column number (0-based)"),
    newName: tool.schema.string().describe("New name for the symbol"),
  },
  async execute(input, ctx) {
    const filePath = input.filePath.startsWith("/")
      ? input.filePath
      : join(ctx.directory, input.filePath)

    const realResolved = resolve(filePath)
    if (!realResolved.startsWith(resolve(ctx.directory))) {
      return { title: "Error", output: `Access denied: ${input.filePath} is outside the project directory` }
    }

    if (!existsSync(filePath)) {
      return { title: "File not found", output: `File not found: ${filePath}` }
    }

    try {
      const { client, resolved, serverId } = await getClientForFile(filePath, ctx.directory)
      try {
        if (!client) {
          return {
            title: "Unsupported",
            output: `No LSP server available for: ${extname(resolved)} files`,
          }
        }

        const changes = await client.rename(resolved, input.line, input.character, input.newName)

        if (!changes) {
          return { title: "Rename failed", output: "Could not rename symbol. Server returned no changes." }
        }

        const totalEdits = Object.values(changes).reduce((sum, e) => sum + e.length, 0)
        const files = Object.keys(changes)
        const output = [
          `Renaming "${input.newName}" would affect ${totalEdits} edit(s) across ${files.length} file(s):`,
          "",
          ...files.map((f) => {
            const rel = f.startsWith("file://") ? f.slice(7) : f
            const short = rel.startsWith(ctx.directory) ? rel.slice(ctx.directory.length + 1) : rel
            const edits = changes[f]
            return `  ${short}:\n${edits.map((e) => `    L${e.range.start.line + 1}: ${e.newText}`).join("\n")}`
          }),
        ].join("\n")

        return { title: `Rename to "${input.newName}"`, output }
      } finally {
        if (serverId) {
          await manager.releaseClient(ctx.directory, serverId)
        }
      }
    } catch (err) {
      return {
        title: "Rename failed",
        output: `Error: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  },
})

export async function disposeLSP() {
  await manager.disposeAll()
}
