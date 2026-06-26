# hiai-bob — DEVELOPMENT.md

> Developer guide for the **hiai-bob v0.0.2** monorepo (autonomous AI coding agent, built as a fork of Xiaomi's MiMo-Code, which is itself a fork of opencode-ai@1.17.4).

## Project Overview

**hiai-bob** is the orchestrator agent of the HiAi ecosystem. It is a rebrand of **MiMo-Code** that layers the `BobPlugin` workflow engine on top of the upstream **opencode-ai** (OpenCode) codebase. It inherits all core capabilities (multiple LLM providers, TUI, LSP, MCP, plugins, persistent memory, subagents) and exposes a Bun-native backend (REST + WebSocket on port `50900`) and a SolidJS/Vite web UI (port `50901`) optimized for managing agentic sessions, providers, session grids, completion controllers, and port-scanning.

- **Repo root:** `<project-root>` (or `$HIAI_BOB_HOME` if set)
- **Engine:** TypeScript + Bun (fork of MiMo-Code/opencode-ai@1.17.4 with `BobPlugin`)
- **Frontend (Web UI):** SolidJS 1.9 + Vite (`packages/app`)
- **Headless runtime:** Bun 1.3.14+ (Node.js is only needed for a handful of tooling scripts; primary runtime is Bun)
- **Default branch:** `dev` (local `main` may not exist)

## Prerequisites

| Tool | Version | Why |
|---|---|---|
| **Bun** | 1.3.14+ (project pins `1.3.11` in `packageManager`) | Primary runtime for backend, tests, lint, typecheck |
| **Node.js** | 20 LTS+ | Required by a few build tools (e.g. `node-pty` postinstall, SDK codegen) |
| **Git** | 2.30+ | Worktree support, submodules |
| **ripgrep** (`rg`) | latest | Code search, used by some BobPlugin tools |

Verify your toolchain:

```bash
bun --version    # >= 1.3.14
node --version   # >= 20
git --version
rg --version
```

## Quick Start

```bash
# 0. Start required infrastructure (PostgreSQL + Redis)
cd infra && make up

# 1. Install all workspace dependencies (Bun workspaces + turbo)
bun install

# 2. Start the backend server (REST + WebSocket)
cd packages/opencode && bun run --conditions=browser ./src/index.ts serve --port 50900

# 3. In a second terminal, start the Web UI dev server
cd packages/app && bun dev -- --port 50901

# 4. Open http://localhost:50901 in your browser
#    The UI expects the backend at http://localhost:50900
```

The `run-bob.sh` wrapper at the repo root handles env loading from `bob.env` and exposes the same commands.

## Main Commands

| Command | Description |
|---|---|
| `cd infra && make up` | Start infrastructure (PostgreSQL + Redis) |
| `cd packages/opencode && bun run --conditions=browser ./src/index.ts serve --port 50900` | Start backend server (REST API + WebSocket) |
| `cd packages/app && bun dev -- --port 50901` | Start Web UI dev server (Vite + HMR) |
| `bun run --filter '*' lint` | Lint all packages (oxlint) |
| `cd packages/opencode && bun run typecheck` | Typecheck opencode backend |
| `cd packages/opencode && bun test` | Run opencode backend tests |
| `cd packages/app && bun run test:unit` | Run app (Web UI) unit tests |
| `cd packages/sdk/js && ./script/build.ts` | Regenerate JavaScript SDK from OpenAPI spec |
| `bun install` | Install workspace dependencies |

### Useful aliases (root-level `package.json`)

| Command | Description |
|---|---|
| `bun dev` | Start headless orchestrator (`MIMOCODE_HOME=$PWD/.dev-home`) |
| `bun dev:web` | Start Web UI only (`packages/app`) |
| `bun dev:desktop` | Start desktop UI (`packages/desktop`) |
| `bun dev:console` | Start TUI console (`packages/console/app`) |
| `bun dev:storybook` | Start Storybook for `packages/storybook` |
| `bun typecheck` | Repo-wide typecheck via Turbo |
| `bun lint` | Repo-wide oxlint |

## Port Reference

| Service | Port |
|---|---|
| Backend API / WebSocket | `50900` |
| Web UI dev server | `50901` |
| Frontend docs dev | `50901` |

The BobPlugin port-scanner uses these ports to detect live instances. If any are taken, the scanner tries `5090x + N` until it finds a free slot.

## Workspace Tracking

- This monorepo uses **Bun workspaces** (`workspaces` field in root `package.json`) backed by **Turbo** for task orchestration.
- The three primary workspaces are `packages/opencode`, `packages/app`, `packages/sdk/js`. Auxiliary workspaces include `packages/desktop`, `packages/console`, `packages/storybook`, `packages/script`.
- `bun install` at the repo root installs all workspaces. Each workspace has its own `package.json` and `tsconfig.json`.
- Filter scripts target a workspace: `bun run --filter '<workspace>' <script>`.
- Lockfile is `bun.lock` (text format). Regenerate with `rm bun.lock && bun install` after large dep changes.

## Provider Selection

The backend resolves LLM providers from environment variables loaded via `lib/config.ts` (Zod-validated) — never read `process.env` directly.

Common providers used during development:

- **Anthropic:** `ANTHROPIC_API_KEY` → resolves to Claude models
- **OpenAI:** `OPENAI_API_KEY` → resolves to GPT models
- **Google:** `GOOGLE_API_KEY` / `GEMINI_API_KEY` → resolves to Gemini models
- **OpenRouter:** `OPENROUTER_API_KEY` → multi-provider gateway
- **Local (Ollama / LM Studio):** `OLLAMA_HOST` or `LMSTUDIO_HOST` → resolves via opencode-ai provider registry

Copy `bob.env.example` → `bob.env` and fill in the keys you need. The `run-bob.sh` script auto-sources `bob.env`.

## Troubleshooting

### `bun install` fails with `EACCES` on `node-pty`

The `packages/opencode` postinstall script compiles `node-pty` natively. Make sure you have:

```bash
# Debian/Ubuntu
sudo apt install -y python3 build-essential

# macOS
xcode-select --install
```

If the build still fails, run `bun run --cwd packages/opencode fix-node-pty` manually.

### Backend refuses to start on port `50900`

- Check who owns the port: `lsof -i :50900` (or `ss -tlnp | grep 50900`).
- The BobPlugin port-scanner should auto-shift to `5090N`. If it doesn't, pass `--port 50910` explicitly to `serve`.
- Kill stale processes: `pkill -f 'src/index.ts serve'`.

### Web UI loads but cannot reach the backend

- Confirm the backend is on `50900`: `curl -fsS http://localhost:50900/health`.
- CORS: the backend allows `http://localhost:50901` by default. If you started the UI on a different port, set `ALLOWED_ORIGINS` in `bob.env`.
- WebSocket upgrade fails? Check that no reverse proxy is stripping `Upgrade` / `Connection` headers.

### `bun run --filter '*' typecheck` is slow

Turbo caches task outputs. If the cache is stale:

```bash
bun turbo typecheck --force
```

### SDK clients are out of sync with the backend

After changing REST routes, regenerate:

```bash
cd packages/sdk/js && ./script/build.ts
```

Then restart both backend and Web UI.

### Tests fail with `Cannot find module 'bun:test'`

You are running tests outside the `packages/*` directories. Always `cd` into a package first, or use `bun test` from the repo root with an explicit path: `bun test packages/opencode/test/...`.

### Stale lockfile after dep changes

```bash
rm bun.lock && bun install
```

### Branch confusion (`master` vs `dev`)

The project default is `dev`. If you are on `master`, switch with:

```bash
git fetch origin
git checkout dev
```

Local `main` may not exist — always diff against `origin/dev`.

## Additional Resources

- `AGENTS.md` — operational rules for autonomous agents
- `CHANGELOG.md` — release history

## Building for Production

This project is developed on an internal GitLab; when pushed to GitHub (`https://github.com/HiAi-gg/hiai-bobcode`), the source is trimmed, so **build and release happen locally** — no GitHub Actions CI build is used.

### GitHub-Retained Files

The only GitHub-side automation that ships with the public mirror is `typecheck.yml`. Everything build/release-related runs locally.

```
.github/
├── actions/
│   └── setup-bun/action.yml          # bun install (used by typecheck)
├── workflows/
│   └── typecheck.yml                  # PR gate: type check
├── ISSUE_TEMPLATE/                    # Issue templates
└── pull_request_template.md           # PR template
```

Removed: publish/test workflows, `setup-git-committer`, GitHub bot, `CODEOWNERS`, `TEAM_MEMBERS`, etc.

### Local Release Flow

#### Prerequisites

| Env Var | Purpose | How to Get |
|---|---|---|
| `NPM_TOKEN` | npm publish (`@hiai-bob` scope) | npmjs.com → Access Tokens → Granular Token |
| `GH_TOKEN` | Create / upload GitHub Release | `gh auth token` or a GitHub PAT (`repo` scope) |
| `GH_REPO` | Target GitHub repository | `HiAi-gg/hiai-bobcode` |

Optional:

| Env Var | Purpose | Default Behavior |
|---|---|---|
| `OPENCODE_VERSION` | Override version | Reads `packages/opencode/package.json` |
| `OPENCODE_BUMP` | Auto-increment (`major` / `minor` / `patch`) | No bump — use as-is |
| `OPENCODE_RELEASE` | Create a GitHub Release | Auto-set by `script/version.ts` |
| `OPENCODE_CHANNEL` | Release channel (`latest` / `beta` / ...) | Inferred from the git branch; detached HEAD defaults to `latest` |

#### One-Shot Release

```bash
GH_REPO=HiAi-gg/hiai-bobcode \
NPM_TOKEN=npm_xxxxx \
GH_TOKEN=$(gh auth token) \
  ./script/release.ts
```

This executes in order:

1. **version** — compute version, create draft GitHub Release
2. **build** — compile cross-platform CLI binaries, upload to the draft Release
3. **publish npm** — publish `@hiai-bob/cli` + platform packages + SDK + plugin to npm
4. **finalize release** — flip the GitHub Release from draft to published

#### Step-by-Step

If you only need part of the flow:

```bash
# Build only (no publish)
OPENCODE_VERSION=1.2.3 ./packages/opencode/script/build.ts

# npm publish only (build first)
NPM_TOKEN=npm_xxxxx OPENCODE_VERSION=1.2.3 ./script/publish.ts

# GitHub Release only (no npm)
GH_TOKEN=$(gh auth token) GH_REPO=HiAi-gg/hiai-bobcode ./script/version.ts
# Then manually upload binaries:
gh release upload v1.2.3 packages/opencode/dist/*.zip packages/opencode/dist/*.tar.gz --repo HiAi-gg/hiai-bobcode
gh release edit v1.2.3 --draft=false --repo HiAi-gg/hiai-bobcode
```

### Version Number Logic

Version resolution in `packages/script/src/index.ts`:

| Priority | Condition | Result |
|---|---|---|
| 1 | `OPENCODE_VERSION` is set | Use directly |
| 2 | Preview channel (non-`latest`) | `0.0.0-{channel}-{timestamp}` |
| 3 | `OPENCODE_BUMP` is set | Read `package.json` and bump |
| 4 | No bump | Use `package.json` version as-is |

### First Release

1. Confirm the `@hiai-bob` org exists on npmjs.org.
2. Create a Granular Access Token (Packages: Read and write, scope: `@hiai-bob`).
3. Confirm `gh auth status` has `repo` permission for `HiAi-gg/hiai-bobcode`.
4. Set `package.json` version to `0.1.0`.
5. Run `./script/release.ts`.

### npm Package Structure

| Package | Contents |
|---|---|
| `@hiai-bob/cli` | Wrapper package (bin shim + postinstall) |
| `hiai-bob-darwin-arm64` | macOS ARM binary |
| `hiai-bob-darwin-x64` | macOS x64 binary |
| `hiai-bob-linux-arm64` | Linux ARM binary |
| `hiai-bob-linux-x64` | Linux x64 binary |
| `hiai-bob-win32-arm64` | Windows ARM binary |
| `hiai-bob-win32-x64` | Windows x64 binary |