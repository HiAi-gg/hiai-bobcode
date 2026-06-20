import { tool } from "@mimo-ai/plugin";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

function shellEscape(s: string): string {
  return s.replace(/'/g, "'\\''");
}

export const globTool = tool({
  description: "Find files matching a pattern.",
  args: {
    pattern: tool.schema.string().describe("Glob pattern (e.g. **/*.ts, src/**/*.test.ts)"),
    path: tool.schema.string().optional().describe("Directory to search in (default: current)"),
  },
  async execute(args) {
    const dir = args.path ? resolve(args.path) : process.cwd();
    const pattern = shellEscape(args.pattern);
    const dirEsc = shellEscape(dir);
    try {
      const result = execSync(`rg --files --color=never --glob='${pattern}' '${dirEsc}' 2>/dev/null || find '${dirEsc}' -name '${pattern}' -type f 2>/dev/null | head -100`, {
        encoding: "utf-8",
        timeout: 60000,
        maxBuffer: 10 * 1024 * 1024,
      }).trim();
      if (!result) return "No files found.";
      const files = result.split("\n").slice(0, 100);
      return `Found ${files.length} file(s):\n${files.join("\n")}`;
    } catch {
      return "No files found.";
    }
  },
});
