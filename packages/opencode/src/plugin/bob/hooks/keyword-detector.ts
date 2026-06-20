import type { HiaiBobConfig, HookSet } from "../shared/types";

const MODE_KEYWORDS: Record<string, string> = {
  ultrawork: "[hiai-bob] Ultrawork mode detected. Work continuously until all tasks complete.",
  search: "[hiai-bob] Search mode. Focus on finding and reporting, not modifying.",
  analyze: "[hiai-bob] Analyze mode. Provide structured analysis, avoid implementation.",
};

export function createKeywordDetector(_config: HiaiBobConfig): HookSet {
  return {
    "chat.message": async (_input, output) => {
      if (!output?.parts) return;
      const text =
        (output.message as { content?: string })?.content ??
        (output.parts as Array<Record<string, unknown>>)
          .filter((p) => p.type === "text")
          .map((p) => p.text)
          .join(" ");
      const lower = (text as string)?.toLowerCase() ?? "";
      for (const [kw, prompt] of Object.entries(MODE_KEYWORDS)) {
        if (lower.includes(kw)) {
          output.parts.push({
            type: "text",
            text: prompt,
          } as never);
          break;
        }
      }
    },
  };
}
