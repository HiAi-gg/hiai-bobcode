import type { Hooks } from "@mimo-ai/plugin"

// Legal gate — enforces USE_RESTRICTIONS.md on the autonomy feature.
//
// Two parts (per bob-plan.md §F.2 step 6 + F1 findings):
//   (a) hard deny-list: prohibit patterns the hiai USE_RESTRICTIONS.md forbids
//       (military, malicious cyber, unauthorized data exfiltration).
//   (b) ask-before-do: high-risk actions (writes, shell, deploys) require
//       human permission via the `permission.ask` hook. The native hiai
//       permission system is the source of truth — we set `status: "ask"`
//       to require explicit human approval.

// (a) Deny-list. Case-insensitive substring match against JSON.stringify(args).
//
// Split into two tiers so we block malicious *intent* without censoring the
// defensive security *vocabulary* that legit dev/delegation prompts use all the
// time ("test login for SQL injection", "patch the 0-day", "/security-review"):
//
//   HARD_DENY      — unambiguously malicious regardless of framing. Always blocks.
//   CONTEXTUAL_DENY — dual-use security terms. Only block when an offensive-intent
//                     verb (attack/compromise/weaponize/…) is also present.

// Offensive-intent context — gates the dual-use terms below.
const OFFENSIVE_INTENT =
  /\b(attack|compromis\w*|breach|weaponi[sz]e\w*|pwn|exploit\w*|backdoor|infiltrat\w*|deploy\s+against|launch\s+against|hack(?:ing)?\s+into|gain\s+(?:unauthori[sz]ed|illicit)\s+access|build\s+(?:a\s+)?(?:malware|botnet|c2|exploit))\b/i

const HARD_DENY: Array<{ pattern: RegExp; reason: string }> = [
  // Military
  {
    pattern: /\b(weapon|weapons|munitions|military[-_ ]?(target|grade|operation))\b/i,
    reason: "military use is prohibited by USE_RESTRICTIONS.md",
  },
  {
    pattern: /\b(drone|drone[-_ ]?strike|missile|ballistic)\b.*\b(target|launch|deploy|guidance)\b/i,
    reason: "military targeting / weapons guidance is prohibited",
  },
  // Malicious cyber — unambiguous
  {
    pattern: /\b(ransomware|ransom[-_ ]?note|encrypt.*victim.*files|locker[-_ ]?payload)\b/i,
    reason: "ransomware is prohibited (malicious cyber activity)",
  },
  {
    pattern: /\b(credential[-_ ]?harvest\w*|stealer[-_ ]?log|password[-_ ]?dump|lsass[-_ ]?dump)\b/i,
    reason: "credential theft is prohibited",
  },
  {
    pattern: /\b(cnc[-_ ]?server|botnet)\b/i,
    reason: "command-and-control infrastructure is prohibited",
  },
  // Unauthorized data exfiltration
  {
    pattern: /\b(exfiltrat\w*|smuggl\w*[-_ ]?data|covert[-_ ]?channel)\b/i,
    reason: "unauthorized data exfiltration is prohibited",
  },
  {
    pattern: /\b(scrap\w*|harvest\w*)\b.*\b(personal[-_ ]?data|pii|email[-_ ]?list|user[-_ ]?record)\b.*\b(without|no)\b.*\b(consent|authorization)\b/i,
    reason: "scraping/harvesting personal data without consent is prohibited",
  },
]

// Dual-use security vocabulary. Defensive use (fix/test/patch/audit) is legit and
// must pass; only blocked when OFFENSIVE_INTENT also appears in the same args.
const CONTEXTUAL_DENY: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\b(sql[-_ ]?injection|xss[-_ ]?payload|exploit[-_ ]?kit|0[-_ ]?day|zero[-_ ]?day|phishing)\b/i,
    reason: "exploit tooling for offensive use is prohibited (malicious cyber activity)",
  },
  {
    pattern: /\b(c2|command[-_ ]?and[-_ ]?control)\b/i,
    reason: "command-and-control infrastructure is prohibited",
  },
]

// (b) Ask-before-do — tools whose use triggers a human permission prompt.
// We do NOT replace the native permission system; we just ensure these tools
// always go through `permission.ask`. Native per-agent config can still allow
// or deny — BobPlugin only ensures no silent execution.
const ASK_BEFORE_TOOLS = new Set([
  "bash",
  "write",
  "edit",
  "patch",
  "apply_patch",
  "multiedit",
  "webfetch",
])

function findDenyMatch(args: unknown): { pattern: RegExp; reason: string } | null {
  if (args == null) return null
  const haystack = JSON.stringify(args)
  const hard = HARD_DENY.find((d) => d.pattern.test(haystack))
  if (hard) return hard
  // Dual-use terms only deny when paired with offensive intent — defensive
  // security work (test/fix/patch/audit) passes through.
  if (!OFFENSIVE_INTENT.test(haystack)) return null
  return CONTEXTUAL_DENY.find((d) => d.pattern.test(haystack)) ?? null
}

export function createLegalGate(): Pick<Hooks, "tool.execute.before" | "permission.ask"> {
  return {
    // (a) Hard deny-list — runs BEFORE native permission checks.
    "tool.execute.before": async (input, output) => {
      const hit = findDenyMatch(output.args)
      if (hit) {
        throw new Error(
          `[bob] LEGAL GATE: ${hit.reason}. Pattern matched in ${input.tool} args. ` +
            `This use is prohibited by USE_RESTRICTIONS.md and cannot be overridden.`,
        )
      }
    },

    // (b) Ask-before-do — high-risk tools always request human permission.
    "permission.ask": async (input, output) => {
      const toolName = (input as { tool?: string }).tool ?? ""
      if (ASK_BEFORE_TOOLS.has(toolName)) {
        output.status = "ask"
      }
    },
  }
}
