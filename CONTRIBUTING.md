# Contributing to hiai-bob

> This project is a fork of [XiaomiMiMo/MiMo-Code](https://github.com/XiaomiMiMo/MiMo-Code) (which is itself a fork of opencode-ai). The core engine retains opencode architecture.

We want to make it easy for you to contribute to hiai-bob. Here are the most common type of changes that get merged:

- Bug fixes
- Additional LSPs / Formatters
- Improvements to LLM performance
- Support for new providers
- Fixes for environment-specific quirks
- Missing standard behavior
- Documentation improvements

However, any UI or core product feature must go through a design review with the core team before implementation.

If you are unsure if a PR would be accepted, feel free to ask a maintainer or look for issues with any of the following labels:

- [`help wanted`](https://github.com/HiAi-gg/hiai-bobcode/issues?q=is%3Aissue%20state%3Aopen%20label%3Ahelp-wanted)
- [`good first issue`](https://github.com/HiAi-gg/hiai-bobcode/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22good%20first%20issue%22)
- [`bug`](https://github.com/HiAi-gg/hiai-bobcode/issues?q=is%3Aissue%20state%3Aopen%20label%3Abug)
- [`perf`](https://github.com/HiAi-gg/hiai-bobcode/issues?q=is%3Aopen%20is%3Aissue%20label%3A%22perf%22)

> [!NOTE]
> PRs that ignore these guardrails will likely be closed.

Want to take on an issue? Leave a comment and a maintainer may assign it to you unless it is something we are already working on.

## Adding New Providers

New providers shouldn't require many if ANY code changes, but if you want to add support for a new provider first make a PR to:
https://github.com/anomalyco/models.dev

## Developing hiai-bob

- Requirements: Bun 1.3+
- Install dependencies and start the dev server from the repo root:

  ```bash
  bun install
  bun dev
  ```

### Running against a different directory

By default, `bun dev` runs OpenCode in the `packages/opencode` directory. To run it against a different directory or repository:

```bash
bun dev <directory>
```

To run OpenCode in the root of the opencode repo itself:

```bash
bun dev .
```

### Building a "localcode"

To compile a standalone executable:

```bash
./packages/opencode/script/build.ts --single
```

Then run it with:

```bash
./packages/opencode/dist/hiai-bob-<platform>/bin/hiai-bob
```

Replace `<platform>` with your platform (e.g., `darwin-arm64`, `linux-x64`).

- Core pieces:
  - `packages/opencode`: OpenCode core business logic & server.
  - `packages/opencode/src/cli/cmd/tui/`: The TUI code, written in SolidJS with [opentui](https://github.com/sst/opentui)
  - `packages/app`: The shared web UI components, written in SolidJS
  - `packages/desktop`: The native desktop app, built with Electron (wraps `packages/app`)
  - `packages/plugin`: Source for `@mimo-ai/plugin`

### Understanding bun dev vs opencode

During development, `bun dev` is the local equivalent of the built `opencode` command. Both run the same CLI interface:

```bash
# Development (from project root)
bun dev --help           # Show all available commands
bun dev serve            # Start headless API server
bun dev web              # Start server + open web interface
bun dev <directory>      # Start TUI in specific directory

# Production
opencode --help          # Show all available commands
opencode serve           # Start headless API server
opencode web             # Start server + open web interface
opencode <directory>     # Start TUI in specific directory
```

### Running the API Server

To start the OpenCode headless API server:

```bash
bun dev serve
```

This starts the headless server on port 50900 by default. You can specify a different port:

```bash
bun dev serve --port 8080
```

### Running the Web App

To test UI changes during development:

1. **First, start the OpenCode server** (see [Running the API Server](#running-the-api-server) section above)
2. **Then run the web app:**

```bash
bun run --cwd packages/app dev
```

This starts a local dev server at http://localhost:5173 (or similar port shown in output). Most UI changes can be tested here, but the server must be running for full functionality.

### Running the Desktop App

The desktop app is a native Electron application that wraps the web UI.

To run the native desktop app:

```bash
bun run --cwd packages/desktop dev
```

This starts the web dev server on http://localhost:1420 and opens the native window.

If you only want the web dev server (no native shell):

```bash
bun run --cwd packages/desktop dev
```

To create a production `dist/` and build the native app bundle:

```bash
bun run --cwd packages/desktop build
```

This runs `bun run --cwd packages/desktop build` automatically via Electron’s `beforeBuildCommand`.

> [!NOTE]
> Running the desktop app requires additional Electron dependencies (Node.js toolchain, platform-specific libraries). See the [Electron prerequisites](https://www.electronjs.org/docs/latest/development/build-instructions) for setup instructions.

> [!NOTE]
> If you make changes to the API or SDK (e.g. `packages/opencode/src/server/server.ts`), run `./script/generate.ts` to regenerate the SDK and related files.

Please try to follow the [style guide](./AGENTS.md)

### Setting up a Debugger

Bun debugging is currently rough around the edges. We hope this guide helps you get set up and avoid some pain points.

The most reliable way to debug OpenCode is to run it manually in a terminal via `bun run --inspect=<url> dev ...` and attach
your debugger via that URL. Other methods can result in breakpoints being mapped incorrectly, at least in VSCode (YMMV).

Caveats:

- If you want to run the OpenCode TUI and have breakpoints triggered in the server code, you might need to run `bun dev spawn` instead of
  the usual `bun dev`. This is because `bun dev` runs the server in a worker thread and breakpoints might not work there.
- If `spawn` does not work for you, you can debug the server separately:
  - Debug server: `bun run --inspect=ws://localhost:6499/ --cwd packages/opencode ./src/index.ts serve --port 50900`,
    then attach TUI with `opencode attach http://localhost:50900`
  - Debug TUI: `bun run --inspect=ws://localhost:6499/ --cwd packages/opencode --conditions=browser ./src/index.ts`

Other tips and tricks:

- You might want to use `--inspect-wait` or `--inspect-brk` instead of `--inspect`, depending on your workflow
- Specifying `--inspect=ws://localhost:6499/` on every invocation can be tiresome, you may want to `export BUN_OPTIONS=--inspect=ws://localhost:6499/` instead

#### VSCode Setup

If you use VSCode, you can use our example configurations [.vscode/settings.example.json](.vscode/settings.example.json) and [.vscode/launch.example.json](.vscode/launch.example.json).

Some debug methods that can be problematic:

- Debug configurations with `"request": "launch"` can have breakpoints incorrectly mapped and thus unusable
- The same problem arises when running OpenCode in the VSCode `JavaScript Debug Terminal`

With that said, you may want to try these methods, as they might work for you.

## Toolchain Prerequisites

| Tool               | Version                                             | Why                                                                      |
| ------------------ | --------------------------------------------------- | ------------------------------------------------------------------------ |
| **Bun**            | 1.3.14+ (project pins `1.3.11` in `packageManager`) | Primary runtime for backend, tests, lint, typecheck                      |
| **Node.js**        | 20 LTS+                                             | Required by a few build tools (e.g. `node-pty` postinstall, SDK codegen) |
| **Git**            | 2.30+                                               | Worktree support, submodules                                             |
| **ripgrep** (`rg`) | latest                                              | Code search, used by some BobPlugin tools                                |

Verify your toolchain:

```bash
bun --version    # >= 1.3.14
node --version   # >= 20
git --version
rg --version
```

## Development Quick Start

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

| Command                                                                                  | Description                                 |
| ---------------------------------------------------------------------------------------- | ------------------------------------------- |
| `cd infra && make up`                                                                    | Start infrastructure (PostgreSQL + Redis)   |
| `cd packages/opencode && bun run --conditions=browser ./src/index.ts serve --port 50900` | Start backend server (REST API + WebSocket) |
| `cd packages/app && bun dev -- --port 50901`                                             | Start Web UI dev server (Vite + HMR)        |
| `bun run --filter '*' lint`                                                              | Lint all packages (oxlint)                  |
| `cd packages/opencode && bun run typecheck`                                              | Typecheck opencode backend                  |
| `cd packages/opencode && bun test`                                                       | Run opencode backend tests                  |
| `cd packages/app && bun run test:unit`                                                   | Run app (Web UI) unit tests                 |
| `cd packages/sdk/js && ./script/build.ts`                                                | Regenerate JavaScript SDK from OpenAPI spec |
| `bun install`                                                                            | Install workspace dependencies              |

### Useful aliases (root-level `package.json`)

| Command             | Description                                                  |
| ------------------- | ------------------------------------------------------------ |
| `bun dev`           | Start headless orchestrator (`MIMOCODE_HOME=$PWD/.dev-home`) |
| `bun dev:web`       | Start Web UI only (`packages/app`)                           |
| `bun dev:desktop`   | Start desktop UI (`packages/desktop`)                        |
| `bun dev:console`   | Start TUI console (`packages/console/app`)                   |
| `bun dev:storybook` | Start Storybook for `packages/storybook`                     |
| `bun typecheck`     | Repo-wide typecheck via Turbo                                |
| `bun lint`          | Repo-wide oxlint                                             |

## Port Reference

| Service                 | Port    |
| ----------------------- | ------- |
| Backend API / WebSocket | `50900` |
| Web UI dev server       | `50901` |
| Frontend docs dev       | `50901` |

The BobPlugin port-scanner uses these ports to detect live instances. If any are taken, the scanner tries `5090x + N` until it finds a free slot.

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

| Env Var     | Purpose                         | How to Get                                     |
| ----------- | ------------------------------- | ---------------------------------------------- |
| `NPM_TOKEN` | npm publish (`@hiai-bob` scope) | npmjs.com → Access Tokens → Granular Token     |
| `GH_TOKEN`  | Create / upload GitHub Release  | `gh auth token` or a GitHub PAT (`repo` scope) |
| `GH_REPO`   | Target GitHub repository        | `HiAi-gg/hiai-bobcode`                         |

Optional:

| Env Var            | Purpose                                      | Default Behavior                                                 |
| ------------------ | -------------------------------------------- | ---------------------------------------------------------------- |
| `OPENCODE_VERSION` | Override version                             | Reads `packages/opencode/package.json`                           |
| `OPENCODE_BUMP`    | Auto-increment (`major` / `minor` / `patch`) | No bump — use as-is                                              |
| `OPENCODE_RELEASE` | Create a GitHub Release                      | Auto-set by `script/version.ts`                                  |
| `OPENCODE_CHANNEL` | Release channel (`latest` / `beta` / ...)    | Inferred from the git branch; detached HEAD defaults to `latest` |

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

| Priority | Condition                      | Result                           |
| -------- | ------------------------------ | -------------------------------- |
| 1        | `OPENCODE_VERSION` is set      | Use directly                     |
| 2        | Preview channel (non-`latest`) | `0.0.0-{channel}-{timestamp}`    |
| 3        | `OPENCODE_BUMP` is set         | Read `package.json` and bump     |
| 4        | No bump                        | Use `package.json` version as-is |

### First Release

1. Confirm the `@hiai-bob` org exists on npmjs.org.
2. Create a Granular Access Token (Packages: Read and write, scope: `@hiai-bob`).
3. Confirm `gh auth status` has `repo` permission for `HiAi-gg/hiai-bobcode`.
4. Set `package.json` version to `0.1.0`.
5. Run `./script/release.ts`.

### npm Package Structure

| Package                 | Contents                                 |
| ----------------------- | ---------------------------------------- |
| `@hiai-bob/cli`         | Wrapper package (bin shim + postinstall) |
| `hiai-bob-darwin-arm64` | macOS ARM binary                         |
| `hiai-bob-darwin-x64`   | macOS x64 binary                         |
| `hiai-bob-linux-arm64`  | Linux ARM binary                         |
| `hiai-bob-linux-x64`    | Linux x64 binary                         |
| `hiai-bob-win32-arm64`  | Windows ARM binary                       |
| `hiai-bob-win32-x64`    | Windows x64 binary                       |

## Pull Request Expectations

### Issue First Policy

**All PRs must reference an existing issue.** Before opening a PR, open an issue describing the bug or feature. This helps maintainers triage and prevents duplicate work. PRs without a linked issue may be closed without review.

- Use `Fixes #123` or `Closes #123` in your PR description to link the issue
- For small fixes, a brief issue is fine - just enough context for maintainers to understand the problem

### General Requirements

- Keep pull requests small and focused
- Explain the issue and why your change fixes it
- Before adding new functionality, ensure it doesn't already exist elsewhere in the codebase

### UI Changes

If your PR includes UI changes, please include screenshots or videos showing the before and after. This helps maintainers review faster and gives you quicker feedback.

### Logic Changes

For non-UI changes (bug fixes, new features, refactors), explain **how you verified it works**:

- What did you test?
- How can a reviewer reproduce/confirm the fix?

### No AI-Generated Walls of Text

Long, AI-generated PR descriptions and issues are not acceptable and may be ignored. Respect the maintainers' time:

- Write short, focused descriptions
- Explain what changed and why in your own words
- If you can't explain it briefly, your PR might be too large

### PR Titles

PR titles should follow conventional commit standards:

- `feat:` new feature or functionality
- `fix:` bug fix
- `docs:` documentation or README changes
- `chore:` maintenance tasks, dependency updates, etc.
- `refactor:` code refactoring without changing behavior
- `test:` adding or updating tests

You can optionally include a scope to indicate which package is affected:

- `feat(app):` feature in the app package
- `fix(desktop):` bug fix in the desktop package
- `chore(opencode):` maintenance in the opencode package

Examples:

- `docs: update contributing guidelines`
- `fix: resolve crash on startup`
- `feat: add dark mode support`
- `feat(app): add dark mode support`
- `fix(desktop): resolve crash on startup`
- `chore: bump dependency versions`

### Style Preferences

These are not strictly enforced, they are just general guidelines:

- **Functions:** Keep logic within a single function unless breaking it out adds clear reuse or composition benefits.
- **Destructuring:** Do not do unnecessary destructuring of variables.
- **Control flow:** Avoid `else` statements.
- **Error handling:** Prefer `.catch(...)` instead of `try`/`catch` when possible.
- **Types:** Reach for precise types and avoid `any`.
- **Variables:** Stick to immutable patterns and avoid `let`.
- **Naming:** Choose concise single-word identifiers when they remain descriptive.
- **Runtime APIs:** Use Bun helpers such as `Bun.file()` when they fit the use case.

## Feature Requests

For net-new functionality, start with a design conversation. Open an issue describing the problem, your proposed approach (optional), and why it belongs in OpenCode. The core team will help decide whether it should move forward; please wait for that approval instead of opening a feature PR directly.

## Trust & Vouch System

This project uses [vouch](https://github.com/mitchellh/vouch) to manage contributor trust. The vouch list is maintained in [`.github/VOUCHED.td`](.github/VOUCHED.td).

### How it works

- **Vouched users** are explicitly trusted contributors.
- **Denounced users** are explicitly blocked. Issues and pull requests from denounced users are automatically closed. If you have been denounced, you can request to be unvouched by reaching out to a maintainer on <!-- TODO: update Discord link -->Discord
- **Everyone else** can participate normally — you don't need to be vouched to open issues or PRs.

### For maintainers

Collaborators with write access can manage the vouch list by commenting on any issue:

- `vouch` — vouch for the issue author
- `vouch @username` — vouch for a specific user
- `denounce` — denounce the issue author
- `denounce @username` — denounce a specific user
- `denounce @username <reason>` — denounce with a reason
- `unvouch` / `unvouch @username` — remove someone from the list

Changes are committed automatically to `.github/VOUCHED.td`.

### Denouncement policy

Denouncement is reserved for users who repeatedly submit low-quality AI-generated contributions, spam, or otherwise act in bad faith. It is not used for disagreements or honest mistakes.

## Issue Requirements

All issues **must** use one of our issue templates:

- **Bug report** — for reporting bugs (requires a description)
- **Feature request** — for suggesting enhancements (requires verification checkbox and description)
- **Question** — for asking questions (requires the question)

Blank issues are not allowed. When a new issue is opened, an automated check verifies that it follows a template and meets our contributing guidelines. If an issue doesn't meet the requirements, you'll receive a comment explaining what needs to be fixed and have **2 hours** to edit the issue. After that, it will be automatically closed.

Issues may be flagged for:

- Not using a template
- Required fields left empty or filled with placeholder text
- AI-generated walls of text
- Missing meaningful content

If you believe your issue was incorrectly flagged, let a maintainer know.
