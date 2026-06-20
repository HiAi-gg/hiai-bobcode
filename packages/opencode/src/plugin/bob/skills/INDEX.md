# Skills Index

Catalogue of every directory under `skills/`, grouped by lifecycle role. The
`name` column is the value agents pass to the `skill` tool; the description
column is the frontmatter `description:` line (truncated for the table). The
mode hint shows the dominant operating mode — **read** (read-only /
advisory), **build** (writes code or files), or **orchestrate** (dispatches
subagents / coordinates multi-step work).

For full authoring rules see [`docs/SKILLS.md`](../docs/SKILLS.md).

## Core workflow

| Skill | Description | Mode |
|-------|-------------|------|
| `spec-driven-development` | Use when starting a new project, feature, or significant change and no specification exists yet. | orchestrate |
| `planning-and-task-breakdown` | Use when a spec or requirements exist and need to be broken into verifiable tasks. | orchestrate |
| `writing-plans` | Use when you have a spec or requirements for a multi-step task, before touching code. | orchestrate |
| `executing-plans` | Use when you have a written implementation plan to execute in a separate session. | orchestrate |
| `subagent-driven-development` | Use when executing implementation plans with independent tasks in the current session. | orchestrate |
| `dispatching-parallel-agents` | Use when facing 2+ independent tasks that can be worked on without shared state. | orchestrate |
| `interview-me` | Use when requirements are underspecified or the user's stated goal differs from what they actually need. | read |
| `using-git-worktrees` | Use when starting feature work that needs isolation from current workspace. | orchestrate |
| `finishing-a-development-branch` | Use when implementation is complete, all tests pass, and you need to decide how to integrate the work. | orchestrate |
| `context-engineering` | Use when starting a new session, when agent output quality degrades, or when configuring rules files. | read |
| `verification-before-completion` | Use when about to claim work is complete, fixed, or passing — evidence before assertions. | read |

## Implementation

| Skill | Description | Mode |
|-------|-------------|------|
| `incremental-implementation` | Use when implementing any feature or change that touches more than one file. | build |
| `test-driven-development` | Use when implementing any logic, fixing any bug, or changing any behavior. | build |
| `source-driven-development` | Use when you want authoritative, source-cited code free from outdated patterns. | build |
| `api-and-interface-design` | Use when designing APIs, module boundaries, or any public interface. | build |
| `frontend-ui-engineering` | Use when building or modifying user-facing interfaces. | build |
| `shadcn-ui` | Expert guidance for integrating and building applications with shadcn/ui components. | build |
| `react-components` | Converts Stitch designs into modular Vite and React components with AST-based validation. | build |
| `browser-testing-with-devtools` | Use when building or debugging anything that runs in a browser, via Chrome DevTools MCP. | read |
| `full-page-screenshot` | Capture full-page screenshots of web pages via Chrome DevTools Protocol. | read |
| `firecrawl-cli` | Firecrawl handles all web operations: pages, search, research, docs, scraping. | read |
| `supabase-postgres` | Postgres performance optimization and best practices from Supabase. | read |
| `performance-optimization` | Use when performance requirements exist or Core Web Vitals need improvement. | build |
| `security-and-hardening` | Use when handling user input, authentication, data storage, or external integrations. | build |
| `ci-cd-and-automation` | Use when setting up or modifying build and deployment pipelines. | build |
| `shipping-and-launch` | Use when preparing to deploy to production — checklists, monitoring, rollback. | orchestrate |
| `deprecation-and-migration` | Use when removing old systems, APIs, or features, or migrating users. | orchestrate |
| `documentation-and-adrs` | Use when making architectural decisions, changing public APIs, or shipping features. | build |
| `git-workflow-and-versioning` | Use when making any code change — committing, branching, conflict resolution. | build |

## Quality

| Skill | Description | Mode |
|-------|-------------|------|
| `code-review-and-quality` | Use before merging any change; multi-axis code review (correctness, readability, architecture, security, performance). | read |
| `code-simplification` | Use when refactoring code for clarity without changing behavior. | build |
| `requesting-code-review` | Use when completing tasks, implementing major features, or before merging. | orchestrate |
| `receiving-code-review` | Use when receiving code review feedback, before implementing suggestions. | read |
| `systematic-debugging` | Use when encountering any bug, test failure, or unexpected behavior. | read |

## Design

| Skill | Description | Mode |
|-------|-------------|------|
| `stitch-design` | Unified entry point for Stitch design work: prompt enhancement, design-system synthesis, screen generation. | build |
| `stitch-loop` | Teaches agents to iteratively build websites using Stitch with an autonomous baton-passing loop. | build |
| `design-md` | Analyze Stitch projects and synthesize a semantic design system into DESIGN.md files. | build |
| `taste-design` | Semantic Design System Skill for Google Stitch — premium, anti-generic UI standards. | build |
| `enhance-prompt` | Transforms vague UI ideas into polished, Stitch-optimized prompts. | build |
| `open-design-landing` | Entry point for the 150+ bundled brand design systems to generate landing page HTML. | build |
| `open-design-landing-deck` | Entry point for the bundled brand design systems to generate slide deck HTML / PPT. | build |
| `web-design-guidelines` | Web design guidelines and standards by the Vercel engineering team. | read |
| `apple-hig` | Apple Human Interface Guidelines covering iOS, macOS, visionOS, watchOS, tvOS. | read |
| `canvas-design` | Create beautiful visual art in PNG and PDF for posters, illustrations, and static pieces. | build |
| `theme-factory` | Apply professional font and color themes to artifacts; ships 10 pre-set themes. | build |
| `article-magazine` | Huashu-inspired magazine article layout for turning Markdown into polished long-form HTML. | build |
| `design-templates` | Design template library (HTML/PPT/dashboard/blog/critique/...) — referenced by `open-design-landing`. | build |
| `figma-use` | Run Figma Plugin API scripts for canvas writes, inspections, variables, and design-system work. | build |
| `figma-generate-design` | Build or update screens in Figma from code or description using design-system components. | build |
| `figma-generate-library` | Build or update a professional-grade design-system library in Figma from a codebase. | build |
| `figma-implement-design` | Translate Figma designs into production-ready code with 1:1 visual fidelity. | build |
| `figma-code-connect-components` | Connect Figma design components to code components using Code Connect. | build |
| `figma-create-design-system-rules` | Generate project-specific design-system rules for Figma-to-code workflows. | build |
| `figma-create-new-file` | Create a new blank Figma Design or FigJam file. | build |
| `remotion` | Generate walkthrough videos from Stitch projects using Remotion. | build |

## Tooling

| Skill | Description | Mode |
|-------|-------------|------|
| `agent-browser` | Browser automation CLI for AI agents — navigate, click, screenshot, scrape, dogfood. | build |
| `find-skills` | Helps users discover and install agent skills from the open ecosystem. | read |

## Meta

| Skill | Description | Mode |
|-------|-------------|------|
| `using-superpowers` | Use when starting any conversation — establishes how to find and use skills. | orchestrate |
| `using-agent-skills` | Discovers and invokes agent skills; governs how all other skills are discovered and invoked. | orchestrate |
| `writing-skills` | Use when creating new skills, editing existing skills, or verifying skills work before deployment. | build |
