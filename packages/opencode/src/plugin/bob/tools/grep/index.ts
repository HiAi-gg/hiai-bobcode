import { tool } from "@mimo-ai/plugin";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

function shellEscape(s: string): string {
  return s.replace(/'/g, "'\\''");
}

export const grepTool = tool({
  description: "Search file contents by pattern.",
  args: {
    pattern: tool.schema.string().describe("Regex pattern to search for"),
    path: tool.schema.string().optional().describe("Directory to search (default: current)"),
    include: tool.schema.string().optional().describe("File pattern to include (e.g. *.ts)"),
  },
  async execute(args) {
    const dir = args.path ? resolve(args.path) : process.cwd();
    const includeFlag = args.include ? `-g='${shellEscape(args.include)}'` : "";
    const pattern = shellEscape(args.pattern);
    const dirEsc = shellEscape(dir);
    try {
      const result = execSync(`rg --no-heading --line-number --color=never ${includeFlag} '${pattern}' '${dirEsc}' 2>/dev/null | head -200`, {
        encoding: "utf-8",
        timeout: 60000,
        maxBuffer: 10 * 1024 * 1024,
      }).trim();
      if (!result) return "No matches found.";
      const lines = result.split("\n").slice(0, 200);
      return `Found ${lines.length} match(es):\n${lines.join("\n")}`;
    } catch {
      return "No matches found.";
    }
  },
});
