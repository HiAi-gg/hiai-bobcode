import { tool } from "@mimo-ai/plugin"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

export function createSkillTool(skillsDir: string) {
  return tool({
    description: "Load and invoke a registered skill by name.",
    args: {
      name: tool.schema.string().describe("Skill name to invoke"),
      args: tool.schema.string().optional().describe("Arguments to pass to the skill"),
    },
    async execute(input) {
      if (!/^[a-zA-Z0-9_-]+$/.test(input.name)) {
        return `Invalid skill name "${input.name}". Only alphanumeric, hyphens, and underscores are allowed.`
      }
      const skillPath = join(skillsDir, input.name, "SKILL.md")
      if (!existsSync(skillPath)) {
        const available = existsSync(skillsDir) ? readdirSync(skillsDir).join(", ") : "(none)"
        return `Skill "${input.name}" not found. Available skills: ${available}`
      }
      try {
        const content = readFileSync(skillPath, "utf-8")
        return `Skill "${input.name}" loaded:\n\n${content.slice(0, 4000)}`
      } catch (err) {
        return `Failed to read skill "${input.name}": ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })
}
