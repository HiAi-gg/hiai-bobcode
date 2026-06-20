# Bob fork — set up on a new machine

How to bring the whole fork (MiMoCode + bundled BobPlugin) up from scratch on a fresh box by
cloning this repo. Copy the **prompt at the bottom** into a Bob/agent session to have it do the
whole thing for you, or follow the steps by hand.

---

## What you're setting up

- **The fork from source** — `./run-bob.sh` runs the TUI directly from `packages/opencode/src`.
- **The web frontend (optional)** — Vite dev on `:4444` talking to the API server on `:4096`.
- **A standalone binary (optional)** — `dist/mimocode-linux-x64/bin/mimo`.

Three things are NOT in the repo and must be provided locally on each machine:

| Thing | Where it lives | How to get it |
|---|---|---|
| Skill secrets (firecrawl, context7) | `./bob.env` (gitignored) | copy `bob.env.example` → `bob.env`, fill keys |
| Model-provider creds | `~/.local/share/mimocode/auth.json` | `/connect` in the TUI (or `mimo auth login`) |
| Per-agent models | `./bob.json` (tracked — already in the repo) | nothing; it ships in the clone |

---

## Prerequisites

- **git**
- **Bun** ≥ `1.3.11` (repo pins `bun@1.3.11`; `1.3.14` works) — `curl -fsSL https://bun.sh/install | bash`
- **Node** ≥ 20 (24.x works) — only needed for some toolchain bits
- **python3** — used by `run-bob.sh` for startup sanity prints (optional; script degrades gracefully)
- A C toolchain (`build-essential` on Debian/Ubuntu) for native deps

---

## Steps

```bash
# 1. Clone
git clone https://github.com/vlgalib/hiai-bob.git
cd hiai-bob

# 2. Install deps (Bun workspaces)
bun install

# 3. Skill secrets — copy the template and fill in your keys
cp bob.env.example bob.env
$EDITOR bob.env          # set FIRECRAWL_API_KEY + CONTEXT7_API_KEY

# 4. First launch from source (TUI). Connects providers on first run.
./run-bob.sh
#   → in the TUI run  /connect  and add your model providers
#     (writes ~/.local/share/mimocode/auth.json — NOT in the repo).
#   The launch banner confirms: keys loaded, models count, authed providers.
```

That's it for the TUI. Models per agent are already defined in `bob.json` (tracked); edit that file
and relaunch — `run-bob.sh` mirrors it into the global config dir on every launch so your edits
always take effect.

### Optional — web frontend

```bash
# API server (from source) in one terminal:
./run-bob.sh -- serve          # API on :4096
# Frontend (Vite dev) in another:
bun run dev:web                # http://localhost:4444
```

### Optional — build the standalone binary

```bash
bun run --cwd packages/opencode build:dev
#   → dist/mimocode-linux-x64/bin/mimo   (smoke-tested with `mimo --version`)
```

### Verify

```bash
bun turbo typecheck            # full monorepo typecheck (must pass before pushing)
```

See `BOB-VERIFY.md` for the deeper "is every capability working" checklist.

---

## Gotchas

- **Never commit `bob.env`** (it's gitignored) or any `.txt`/`.csv`/DB-dump/`auth.json`/secret file.
- `loadConfig` reads the **global** `~/.config/mimocode/bob.json` before the fork-root one (the
  source CWD is `packages/opencode`). `run-bob.sh` syncs fork-root `bob.json` → global on every
  launch so a stale global copy can't shadow your model edits.
- For **parallel** instances on different projects, give each its own data dir:
  `./run-bob.sh --home /path/to/instance-home` — otherwise they share one db/actor registry and
  each startup's orphan-recovery would kill the other's live subagents.
- `projects/` is gitignored; each sub-project is its own repo.

---

## One-shot setup prompt (paste into a Bob/agent session)

```
Set this machine up to run the Bob fork from a fresh clone. Do it step by step, stop and tell me
if a step needs a secret or credential I haven't provided:

1. Verify prerequisites: git, bun >= 1.3.11, node >= 20, python3, a C toolchain. Report versions;
   if bun is missing, install it via https://bun.sh/install.
2. git clone https://github.com/vlgalib/hiai-bob.git and cd into it.
3. Run `bun install`.
4. If ./bob.env does not exist, copy bob.env.example → bob.env and STOP to ask me for the
   FIRECRAWL_API_KEY and CONTEXT7_API_KEY (never invent or commit them).
5. Run `bun turbo typecheck` and confirm it passes.
6. Launch `./run-bob.sh`; from the banner report which providers are authed. If none, tell me to
   run /connect in the TUI to add model providers (creds go to ~/.local/share/mimocode/auth.json,
   which is NOT in the repo).
7. (If I ask for the web UI) start `./run-bob.sh -- serve` (:4096) and `bun run dev:web` (:4444).
8. (If I ask for a binary) run `bun run --cwd packages/opencode build:dev` and report the smoke-
   test version.

Constraints: never commit or push bob.env or any secret/.txt/.csv/DB-dump/auth.json file; do not
push to origin unless I explicitly say so.
```
