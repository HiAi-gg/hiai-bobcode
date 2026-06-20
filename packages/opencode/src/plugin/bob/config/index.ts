import { existsSync, readFileSync } from "node:fs";
import { join, isAbsolute } from "node:path";
import type { BobConfig } from "../shared/types";
import { resolveEnvVars } from "../shared/env";

export const DEFAULT_CONFIG: BobConfig = {
  // Per-agent models are NOT defined in code. They live ONLY in the `bob.json`
  // models file at the fork root (see loadConfig candidates below). Edit models
  // there. Model-PROVIDER credentials are never stored in any bob file — connect
  // providers via `/connect` in the TUI (writes ~/.local/share/hiai-bob/auth.json).
  models: {},
  mcp: {
    "sequential-thinking": { enabled: true },
    context7: { enabled: true },
    grep_app: { enabled: true },
  },
  lsp: {
    typescript: { enabled: true },
    svelte: { enabled: true },
    eslint: { enabled: true },
    pyright: { enabled: true },
  },
  agent_restrictions: {
    bob: {
      write: false,
      edit: false,
      bash: false,
      apply_patch: false,
      grep: false,
      glob: false,
    },
    strategist: {
      bash: false,
      grep: false,
      glob: false,
      webfetch: false,
    },
    critic: { write: false, edit: false },
    researcher: { write: false, edit: false },
    sub: { task: false },
  },
  hooks: { disabled: [] },
  tools: { disabled: [] },
  agent_overrides: {},
  auth: {},
  background_manager: {
    concurrency_limit: 5,
    stale_timeout_ms: 45 * 60 * 1000,
    circuit_breaker: {
      enabled: true,
      max_tool_calls: 4000,
      consecutive_threshold: 20,
    },
  },
  telemetry: {
    enabled: false,
    serviceName: "hiai-bob",
  },
  disabled_agents: [],
  disabled_hooks: [],
  completion: {
    enabled: true,
    max_auto_continues: 25,
    require_critic: true,
    ui_globs: [
      "**/*.svelte",
      "**/*.tsx",
      "**/*.jsx",
      "**/*.vue",
      "**/*.css",
      "**/*.scss",
      "**/*.html",
      "**/*.astro",
    ],
    reset_on_user_message: true,
  },
  // Memory-consolidation passes. Only `auto` + `interval_days` are user-facing
  // (bob.json). The model is NOT configurable here — these need a smart model and
  // run rarely, so the plugin pins Bob's own model (models.bob) automatically.
  dream: { auto: true, interval_days: 7 },
  distill: { auto: true, interval_days: 30 },
};

function stripJsonComments(json: string): string {
  return json.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\/\/.*$|\/\*[\s\S]*?\*\//gm, (_match, string) => {
    if (string) return string;
    return "";
  });
}

const REQUIRED_AGENT_KEYS = [
  "bob", "coder", "strategist", "manager", "critic",
  "designer", "researcher", "writer", "vision", "sub",
] as const;

// Validate per-agent model entries (they live in bob.json as "<provider>/<model>").
// The provider registry isn't reachable at config-load time, so this checks shape
// + completeness and warns loudly: a missing/malformed model silently degrades the
// agent to the session default, and an unknown key is almost always a typo. Provider
// credentials are NOT configured here — they come from /connect (auth.json).
function validateModels(models: BobConfig["models"]): void {
  const m = models ?? {};
  for (const key of REQUIRED_AGENT_KEYS) {
    const model = m[key]?.model;
    if (typeof model !== "string" || model.trim() === "") {
      console.warn(`[bob] config: agent "${key}" has no model — falls back to the session default. Set models.${key}.model in bob.json.`);
      continue;
    }
    const slash = model.trim().indexOf("/");
    if (slash <= 0 || slash === model.trim().length - 1)
      console.warn(`[bob] config: agent "${key}" model "${model}" is not "<provider>/<model>" — use a full id (e.g. opencode-go/mimo-v2.5) and connect the provider via /connect.`);
  }
  for (const key of Object.keys(m))
    if (!(REQUIRED_AGENT_KEYS as readonly string[]).includes(key))
      console.warn(`[bob] config: models.${key} is not a known agent (known: ${REQUIRED_AGENT_KEYS.join(", ")}) — ignored.`);
}

// hiai-bob's global config dir (where hiai-bob.json lives). Mirrors
// resolveHiaiBobHome() from packages/shared so a COMPILED binary — which can't
// walk up to the fork-root bob.json — still finds the models file here.
function globalConfigDir(): string {
  const home = process.env.HIAI_BOB_HOME;
  if (home && isAbsolute(home)) return join(home, "config");
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg && isAbsolute(xdg) ? xdg : join(process.env.HOME ?? process.env.USERPROFILE ?? "", ".config");
  return join(base, "hiai-bob");
}

export function loadConfig(projectDir: string): BobConfig {
  const cfgDir = globalConfigDir();
  const candidates = [
    join(projectDir, "bob.json"),
    join(projectDir, ".mimocode", "bob.json"),
    join(projectDir, ".opencode", "bob.json"),
    join(projectDir, "bob.jsonc"),
    join(projectDir, ".mimocode", "bob.jsonc"),
    join(projectDir, ".opencode", "bob.jsonc"),
    // Global config dir — works for both source runs and compiled binaries.
    join(cfgDir, "bob.json"),
    join(cfgDir, "bob.jsonc"),
    // Fork-root bob.json — the canonical models file shipped with the fork.
    // dirname = packages/opencode/src/plugin/bob/config → 6 levels up = fork root.
    join(import.meta.dirname, "..", "..", "..", "..", "..", "..", "bob.json"),
    join(import.meta.dirname, "..", "..", "..", "..", "..", "..", "bob.jsonc"),
    join(import.meta.dirname, "..", "..", "..", "bob.json"),
    join(import.meta.dirname, "..", "..", "..", "bob.jsonc"),
  ];

  let userConfig: Partial<BobConfig> = {};
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      try {
        const raw = readFileSync(candidate, "utf-8");
        const cleaned = stripJsonComments(raw);
        userConfig = JSON.parse(cleaned);
        break;
      } catch (err) {
        console.warn(`[bob] Failed to parse config: ${candidate} (${err instanceof Error ? err.message : String(err)})`);
      }
    }
  }

  const mergedModels = { ...DEFAULT_CONFIG.models, ...userConfig.models };
  validateModels(mergedModels);
  const mergedMcp = { ...DEFAULT_CONFIG.mcp, ...userConfig.mcp };
  const mergedLsp = { ...DEFAULT_CONFIG.lsp, ...userConfig.lsp };
  const mergedAgentRestrictions = {
    ...DEFAULT_CONFIG.agent_restrictions,
    ...userConfig.agent_restrictions,
  };
  const mergedAuth = { ...DEFAULT_CONFIG.auth, ...userConfig.auth };

  // dream/distill: users set only auto + interval_days; the model is pinned to
  // Bob's own model (smart, and these run rarely) — applied last so it wins.
  const bobModel = mergedModels.bob?.model;
  const pin = bobModel ? { model: bobModel } : {};
  const mergedDream = { ...DEFAULT_CONFIG.dream, ...userConfig.dream, ...pin };
  const mergedDistill = { ...DEFAULT_CONFIG.distill, ...userConfig.distill, ...pin };

  const defaultHooksDisabled = DEFAULT_CONFIG.hooks?.disabled ?? [];
  const userHooksDisabled = userConfig.hooks?.disabled ?? [];
  const legacyDisabledHooks = [
    ...(DEFAULT_CONFIG.disabled_hooks ?? []),
    ...(userConfig.disabled_hooks ?? []),
  ];
  const allHooksDisabled = [
    ...new Set([...defaultHooksDisabled, ...userHooksDisabled, ...legacyDisabledHooks]),
  ];

  const defaultToolsDisabled = DEFAULT_CONFIG.tools?.disabled ?? [];
  const userToolsDisabled = userConfig.tools?.disabled ?? [];

  const defaultAgentsDisabled = DEFAULT_CONFIG.disabled_agents ?? [];
  const userAgentsDisabled = userConfig.disabled_agents ?? [];
  const allAgentsDisabled = [
    ...new Set([...defaultAgentsDisabled, ...userAgentsDisabled]),
  ];

  return resolveEnvVars({
    ...DEFAULT_CONFIG,
    ...userConfig,
    models: mergedModels,
    mcp: mergedMcp,
    lsp: mergedLsp,
    agent_restrictions: mergedAgentRestrictions,
    auth: mergedAuth,
    background_manager: userConfig.background_manager ?? DEFAULT_CONFIG.background_manager,
    telemetry: userConfig.telemetry ?? DEFAULT_CONFIG.telemetry,
    hooks: { disabled: allHooksDisabled },
    tools: { disabled: [...new Set([...defaultToolsDisabled, ...userToolsDisabled])] },
    agent_overrides: {
      ...DEFAULT_CONFIG.agent_overrides,
      ...userConfig.agent_overrides,
    },
    completion: { ...DEFAULT_CONFIG.completion!, ...userConfig.completion },
    disabled_agents: allAgentsDisabled,
    disabled_hooks: allHooksDisabled,
    dream: mergedDream,
    distill: mergedDistill,
  });
}