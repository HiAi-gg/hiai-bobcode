# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.2] - 2026-06-25

### v0.0.2 — Full Integration Release

**Version bump** across all 7 monorepo packages: `0.0.1` → `0.0.2`.

**Session Grid Routing Fixes:**

- Cross-project navigation: session grid now correctly resolves routes across multiple projects
- Directory storage: session metadata storage aligned with filesystem layout
- Error boundaries: grid UI now handles missing/malformed session data gracefully

**Completion Controller:**

- Auto-continue: orchestrator now auto-resumes when work remains (configurable via `bob.json`)
- Critic gate: quality-gate hook integrated into completion flow via `require_critic` toggle
- File merge: subagent changed files propagate to parent session on completion

**MCP Slimming:**

- context7 migrated from MCP server to CLI + skill wrapper
- Reduced MCP overhead and startup latency

**Hook Deletions:**

- ~28 redundant/stub hooks removed from the plugin registry
- Prior cleanup (v0.0.1) already removed 31 hooks; this sweep removes remaining dead code

**Documentation Overhaul:**

- 14 new docs added to `docs/` covering architecture, conventions, runtime signals, and setup
- New: `docs/getting-started.md` for first-time developers
- New: `docs/hiai-ecosystem/` — ecosystem-wide conventions, architecture, and ADR
- Updated: `DEVELOPMENT.md` with corrected paths, port references, and infrastructure commands

**Grid Mode Improvements:**

- Cross-project picker: unified project selector across all grid views
- Workspace propagation: session workspace state persists across grid navigations
- Port scanner: improved instance detection for multi-port environments

## [Unreleased]

## [0.0.1] - 2026-06-21

### Production-Readiness Release

**Branding:**

- Complete rebranding from MiMo-Code/OpenCode to hiai-bob across all surfaces
- Agent identifies as "Bob, built by hiai" in all prompts; "You are Bob" in system prompt
- MIMOCODE*\* env vars renamed to BOB*\* throughout source
- README, CONTRIBUTING.md, SECURITY.md updated for fork attribution chain
- VS Code extension, Desktop app, Zed extension rebranded

**Hook System:**

- Reduced from 38 hooks to 7 (kept: closure-injector, quality-gate, keyword-detector, non-interactive-env, tool-output-truncator, legal-gate, completion-controller)
- Removed 31 dead/redundant/stub hooks (14 MiMo-native duplicates, 17 stubs)
- Removed BackgroundManager (dead code — launch() never called)
- Removed background-task tools

**Completion-Controller (Fixed):**

- Fixed matcher mode — now fires for root orchestrator (was incorrectly scoped to `{mode:"peer"}`)
- Wired todo.updated event handler for accurate hasIncompleteTodos tracking
- Fixed user-message reset: migrated from permission.ask to chat.message hook
- Added subagent file merging: changedFiles from subagents propagate to parent session
- Added completion config block to bob.json (enabled, max_auto_continues, require_critic, ui_globs)
- 26 completion-controller tests all passing

**Infrastructure:**

- Dockerfile: added non-root USER (bob), pinned Alpine 3.21, added .dockerignore
- CI workflow (typecheck + build + test + lint)
- Binary output renamed to hiai-bob-_ (was opencode-_/mimocode-\*)
- Release/publish scripts updated for @hiai-bob/\* namespace

**Package Namespace:**

- @hiai-bob/cli is the primary CLI package; remaining workspace packages retain @mimo-ai/\* scope for upstream compatibility
- @hiai-bob/cli is primary CLI package (was already correct)
- Version 0.0.1 unified across all 7 monorepo packages

**Security:**

- bob.env: rotated exposed Firecrawl and Context7 API keys to placeholder values
- source bob.env: no live keys in tracked files

**Misc:**

- docs/RUNTIME-SIGNALS.md created documenting completion-controller signals
- Parallelism annotations added to Strategist/Manager/Bob agent prompts
- context7 migrated from MCP to CLI+skill wrapper
- Model IDs preserved (xiaomi/mimo/opencode-go as LLM provider brand names)
