#!/usr/bin/env bash
# Launch the Bob fork (hiai-bob + bundled BobPlugin) from source.
#
#   ./run-bob.sh                 # real data dir ~/.local/share/mimocode (shared memory/tasks/auth)
#   ./run-bob.sh --isolated      # throwaway data dir $PWD/.dev-home     (clean room)
#   ./run-bob.sh --home <path>   # DEDICATED isolated data dir (own db/registry/memory/tasks).
#                                # Auto-seeds providers (auth.json) + models (bob.json) from your
#                                # real config so it's ready without re-/connect. USE THIS for
#                                # running many instances in parallel on different projects —
#                                # one --home per instance keeps memory/tasks/actors fully separate.
#   ./run-bob.sh -- <args>       # pass extra args straight to the bob CLI (e.g. -- run "fix the build")
#
# WHY --home for parallel runs: all instances on ONE data dir share a single mimocode.db +
# actor registry, and each startup's orphan-recovery marks EVERY pending/running actor (across all
# sessions) as orphaned — so a 2nd instance starting would kill the 1st's live subagents. A separate
# MIMOCODE_HOME per instance gives each its own db/registry/locks → no crosstalk, no contention.
#
# Secrets for the CLI skills (firecrawl-cli, context7) come from ./bob.env (gitignored).
# Model-provider creds come from the mimocode auth store (managed by `bob auth login`).
set -euo pipefail
cd "$(dirname "$0")"

ISOLATED=0
HOME_DIR=""
PASSTHRU=()
while [ $# -gt 0 ]; do
  case "$1" in
    --isolated) ISOLATED=1; shift ;;
    --home) HOME_DIR="$2"; shift 2 ;;
    --) shift; PASSTHRU=("$@"); break ;;
    *) PASSTHRU+=("$1"); shift ;;
  esac
done

# Two Bob files (both in this fork root):
#   bob.json — per-agent MODELS (tracked, editable, the only model source)
#   bob.env  — skill KEYS (firecrawl + context7; gitignored, secret)
# Model PROVIDERS are NOT configured in any file — connect them via /connect in
# the TUI (writes ~/.local/share/mimocode/auth.json).

# 1) Load skill secrets (firecrawl / context7) if present.
if [ -f bob.env ]; then
  # shellcheck disable=SC1091
  source bob.env
  echo "[run-bob] keys  (bob.env):  FIRECRAWL_API_KEY=${FIRECRAWL_API_KEY:+set} CONTEXT7_API_KEY=${CONTEXT7_API_KEY:+set}"
else
  echo "[run-bob] WARNING: bob.env not found — context7/firecrawl skills will run unauthenticated"
fi

# 1b) Models file sanity.
if [ -f bob.json ]; then
  echo "[run-bob] models (bob.json): $(python3 -c "import json;print(len(json.load(open('bob.json')).get('models',{})),'agents')" 2>/dev/null || echo '?')"
else
  echo "[run-bob] WARNING: bob.json not found — agents will fall back to the session default model"
fi

# 2) Pick data dir.
REAL_DATA="${XDG_DATA_HOME:-$HOME/.local/share}/mimocode"
REAL_CFG="${XDG_CONFIG_HOME:-$HOME/.config}/mimocode"
if [ -n "$HOME_DIR" ]; then
  # Dedicated isolated home; seed providers + models so it's usable without re-/connect.
  mkdir -p "$HOME_DIR/data" "$HOME_DIR/config"
  if [ ! -f "$HOME_DIR/data/auth.json" ] && [ -f "$REAL_DATA/auth.json" ]; then
    cp "$REAL_DATA/auth.json" "$HOME_DIR/data/auth.json"; chmod 600 "$HOME_DIR/data/auth.json"
    echo "[run-bob] seeded auth.json (providers) into $HOME_DIR/data"
  fi
  # Seed/refresh models from the canonical fork-root bob.json every launch so an
  # isolated --home picks up your latest model edits (falls back to the global copy).
  if [ -f bob.json ]; then cp bob.json "$HOME_DIR/config/bob.json"
  elif [ -f "$REAL_CFG/bob.json" ]; then cp "$REAL_CFG/bob.json" "$HOME_DIR/config/bob.json"; fi
  echo "[run-bob] seeded bob.json (models) into $HOME_DIR/config"
  export MIMOCODE_HOME="$HOME_DIR"
  echo "[run-bob] DEDICATED data dir: $MIMOCODE_HOME (isolated db/registry/memory/tasks)"
elif [ "$ISOLATED" -eq 1 ]; then
  export MIMOCODE_HOME="$PWD/.dev-home"
  echo "[run-bob] ISOLATED data dir: $MIMOCODE_HOME"
else
  unset MIMOCODE_HOME || true
  # Mirror the fork-root models file into the global config dir EVERY launch.
  # loadConfig() reads the global $REAL_CFG/bob.json before the fork-root one (the
  # source CWD is packages/opencode, so projectDir/bob.json doesn't exist) — without
  # this sync a stale global copy silently shadows your edits to ./bob.json.
  if [ -f bob.json ]; then
    mkdir -p "$REAL_CFG"
    cp bob.json "$REAL_CFG/bob.json"
    echo "[run-bob] synced models (bob.json) → $REAL_CFG/bob.json"
  fi
  echo "[run-bob] real data dir: $REAL_DATA (shared — do NOT run multiple instances here)"
fi

# 3) Sanity: list authed providers so a missing-model failure is obvious up front.
AUTH_JSON="${MIMOCODE_HOME:+$MIMOCODE_HOME/data}"
AUTH_JSON="${AUTH_JSON:-${XDG_DATA_HOME:-$HOME/.local/share}/mimocode}/auth.json"
if [ -f "$AUTH_JSON" ]; then
  echo "[run-bob] providers: $(python3 -c "import json;print(', '.join(json.load(open('$AUTH_JSON')).keys()))" 2>/dev/null || echo '?')"
else
  echo "[run-bob] NOTE: no auth.json at $AUTH_JSON — connect providers with /connect in the TUI (or \`bob auth login\`)"
fi

# 4) Boot from source (TUI unless passthru args run a subcommand).
echo "[run-bob] starting fork from source…"
exec bun run --cwd packages/opencode --conditions=browser src/index.ts "${PASSTHRU[@]}"
