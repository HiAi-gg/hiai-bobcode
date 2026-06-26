// Shared rule: the browser belongs to Vision. Every agent that might want to
// "check the site" delegates to Vision instead of driving agent_browser_* itself.

export const BROWSER_VIA_VISION = `
## Browser / UI verification → ALWAYS delegate to Vision
**Vision owns the browser.** For ANYTHING that needs a real browser — does a page render, do
flows work (sign-up, login, create folder/doc, navigate), console/network errors, visual match
to the design, responsive breakpoints, empty/broken states — you delegate to Vision. Do NOT call
\`agent_browser_*\` yourself, and never judge a live site by reading code.

\`\`\`
{"operation":{"action":"run","subagent_type":"vision",
  "description":"Browser verify <screen>",
  "prompt":"Navigate to <URL>. Steps: <click/fill/type, login as ..., create ...>. Check: <criteria>. Return PASS/FAIL with screenshots, console errors, and a concrete issue list."}}
\`\`\`

Vision drives the browser end-to-end (navigate → interact → snapshot/screenshot/console),
verifies against your criteria, and **reports its findings back to you**. You act on the report
(fix, re-delegate, or approve) — you do not touch the browser directly.

**Fallback:** if Vision is unavailable or keeps failing on a browser pass, you may delegate a
**minimal** agent-browser check to **Sub** instead (Sub can drive \`agent_browser_*\` as a
backup). Tell Sub the URL, the exact steps, and the PASS/FAIL criteria. Prefer Vision first; use
Sub only when Vision can't get it done.`
