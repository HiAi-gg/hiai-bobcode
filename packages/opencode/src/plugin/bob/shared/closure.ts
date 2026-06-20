export const CLOSURE_SCHEMA_PROMPT = `
<CLOSURE_PROTOCOL>
## Mandatory Task Finalization

You MUST end your final response with a structured <CLOSURE> block. This block serves as your formal "end of contour" and provides evidence of task completion.

### Schema:
\`\`\`xml
<CLOSURE>
{
  "reasoning": "Concise summary of what was achieved and why it satisfies the request.",
  "evidence": ["Link to test results", "File path to changes", "Log snippets", "LSP diagnostics clean"],
  "readiness": "done" | "accept" | "reject"
}
</CLOSURE>
\`\`\`

### Readiness mapping:
- "done": Task completed successfully.
- "accept": (Reviewer mode) The proposed changes are approved.
- "reject": (Reviewer mode) The proposed changes are denied with feedback.

**WARNING**: Responses without a valid <CLOSURE> block will be automatically REJECTED.
</CLOSURE_PROTOCOL>
`

export function validateClosure(text: string): {
  isValid: boolean
  error?: string
  data?: { reasoning: string; evidence: string[]; readiness: string }
} {
  const match = text.match(/<CLOSURE>\s*([\s\S]*?)\s*<\/CLOSURE>/i)
  if (!match) {
    return { isValid: false, error: "Missing mandatory <CLOSURE> block." }
  }
  try {
    const data = JSON.parse(match[1])
    if (!data.reasoning || !data.evidence || !data.readiness) {
      return {
        isValid: false,
        error: "Invalid <CLOSURE> schema: missing required fields.",
      }
    }
    return { isValid: true, data }
  } catch {
    return {
      isValid: false,
      error: "Malformed <CLOSURE> block: must be valid JSON.",
    }
  }
}
