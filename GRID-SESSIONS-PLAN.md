# Grid sessions + tasks-view + completion-report — implementation plan

> Frontend = `packages/app` (SolidJS). Bob plugin = `packages/opencode/src/plugin/bob`.
> The grid scaffold already exists; this plan fills the cells, adds a task-dashboard
> view, and an auto-generated completion report.

**Goal:** make each grid cell usable — open new/existing sessions in it, optionally
drag sessions in; add a per-cell mode that shows the session's PLAN/TASKS instead of
the chat; and on Critic-approved completion auto-generate a pretty HTML report with a
link, emitted when the task closes.

---

## Current state (foundation — already done)
- `layout.grid`: `mode/setMode`, `cells(dir)→string[]`, `setCells`, `addCell(dir,id)`,
  `removeCell(dir,id)`. Cells are an array of session IDs; cell 0 = primary route
  session, `cells[]` = extra cells (append, left-to-right).
- `SessionGrid` renders cell 0 = primary (`mode:"full"`), extras = `mode:"cell"`,
  remaining = "Empty cell". Each cell wrapped in its own `SessionProviders`.
- Grid toggle button works (`dot-grid` icon, keyed by decoded dir).
- Project session list: `sortedRootSessions(store, sortNow)` (`sidebar-workspace.tsx`).
- DnD already in repo: `@thisbeyond/solid-dnd` (`createSortable/createDroppable/
  createDraggable`, `DragDropProvider`, `DragOverlay`).
- New session = navigate `/{slug}/session` (no id) → `NewSessionView`; real session is
  created on first message.
- Native task tree + actor registry in `mimocode.db` (`actor_registry`: session_id,
  agent, status, parent_actor_id) and `memory/sessions/<id>/tasks/T*/progress.md`.
- Completion hard-gate: Bob `completion-controller` (`actor.postStop`) stops only when
  Critic returns APPROVED.

---

## Simplicity ranking (do in this order)

| Phase | What | Difficulty |
|---|---|---|
| 1 | Click empty cell → open **existing** session (picker) | 🟢 simplest |
| 2 | Open **new** session in a cell | 🟡 medium |
| 3 | **Drag** a session into a cell | 🟡–🔴 medium-high |
| 4 | Per-cell **tasks/plan view** (instead of chat) | 🟡 medium |
| 5 | Auto **HTML completion report** + link on Critic-approved close | 🔴 highest |

Start at Phase 1; each phase is independently shippable.

---

## Phase 1 — click-picker for existing sessions 🟢
**Files:** `components/session/session-grid.tsx`, new `components/session/cell-session-picker.tsx`.

- [ ] Replace the "Empty cell" placeholder with a button that opens a `DropdownMenu`/popover:
  - item **"New session"** (Phase 2 wires the action; show disabled/“coming” until then),
  - scrollable **list of project sessions** from `sortedRootSessions`, filtered to exclude
    already-shown ones (`primaryId` + `cells()`).
- [ ] Selecting an existing session → `layout.grid.addCell(dir, sessionID)`. The cell then
  renders `<Cell sessionID={id} mode="cell">` (mechanism already exists).
- [ ] On a filled non-primary cell, add a small **✕** → `layout.grid.removeCell(dir, id)`.
- [ ] No API/model change needed.

**Effort:** ~half a day. **Risk:** none.

---

## Phase 2 — new session in a cell 🟡
**Files:** `session-grid.tsx`, `pages/session.tsx` (or the new-session flow), `cell-session-picker.tsx`.

- [ ] When "New session" is chosen for a slot, render `<Page mode="cell">` with **no**
  `sessionID` in that slot → `NewSessionView`.
- [ ] Decouple session creation from routing: the new-session flow currently navigates the
  URL. Add an `onSessionCreated(id)` callback path so in **cell mode** it does NOT change the
  global route — instead calls `layout.grid.addCell(dir, newId)` (and replaces the slot's
  pending marker with the real id).
- [ ] Track the "pending new" slot locally until the id arrives.

**Effort:** ~1 day. **Risk:** untangling create-vs-route; verify the primary route session
isn't disturbed.

---

## Phase 3 — drag-and-drop into cells 🟡–🔴
**Files:** `pages/layout.tsx` or `directory-layout.tsx` (shared DnD scope), `session-grid.tsx`,
sidebar session item, `context/layout.tsx` (model upgrade).

- [ ] **Model upgrade first:** move `gridCells[dir]` from an append-array to a **sparse slot
  array** `(string | null)[]` (index = slot, `null` = empty). Update `cells/addCell/removeCell`
  + add `setCellAt(dir, slot, id|null)`. Lets a drop target a specific slot and enables reorder.
  (Phases 1–2 don't need this — do it here.)
- [ ] Wrap the sidebar session list **and** the grid in a shared `DragDropProvider`.
- [ ] Sidebar session item → `createDraggable(sessionID)`; each cell → `createDroppable(slot)`;
  `DragOverlay` for the drag preview.
- [ ] `onDragEnd`: drop on a cell → `setCellAt(dir, slot, draggedId)`. Cell→cell drag = reorder.

**Effort:** 1–2 days. **Risk:** cross-container DnD is finicky; infra exists but scoping the
provider across sidebar+grid needs care.

---

## Phase 4 — per-cell "plan / tasks" view (no chat) 🟡
Show, instead of the chat, the session's **plan/tasks dashboard**: which tasks exist, which are
**in progress and by which agent**, **% of the current task/plan done**, what remains.

**Backend (data source).**
- [ ] Expose per-session task state to the frontend. Source = native task tree + `actor_registry`:
  for each task (`T1`, `T1.1`, …): `summary`, `status` (open/in_progress/blocked/done/abandoned),
  `owner agent` (from the actor that owns it), and progress note (`progress.md`).
- [ ] Add/locate a server route (e.g. `GET /session/:id/tasks`) returning that list, and a sync
  channel so the dashboard updates live (reuse the existing sync event bus the TUI uses).
- [ ] **% complete:** compute `done / total` over the tree (and per top-level task); optionally
  enrich with the completion-controller signals (`hasIncompleteTodos`, `autoContinues` vs cap).

**Frontend.**
- [ ] New `components/session/session-tasks-view.tsx`: renders the task tree as a dashboard —
  status chips, **agent badges** (who's working it), per-task + overall **progress bars**,
  "in progress / remaining" counts. Read-only.
- [ ] Per-cell **view toggle** `chat | tasks`: add `gridCellView[dir][slot]` to the layout store
  + a small switch in the cell header. In `tasks` mode the cell renders `SessionTasksView`
  instead of `<Page>` (no chat, no terminal — lightweight).

**Effort:** ~1–2 days (mostly the task API + live updates). **Risk:** task-tree → API shape;
making progress % meaningful.

---

## Phase 5 — auto HTML completion report + link 🔴
On the Critic's **final APPROVED** verification of a delegated task, a sub-agent generates a
**pretty HTML report** and the task closes **with a link** to open it.

**Report contents (the prompt spec):**
- What was **done** (summary of changes, files, verifications).
- What is **still planned** for the current project (remaining tasks from the plan/tree).
- **Where services run** (if started during the work): backends / APIs / frontends — their
  URLs/ports and how to reach them.
- **How the project works** (brief architecture / run instructions).

**Trigger & wiring.**
- [ ] Hook the Bob `completion-controller` (`actor.postStop`): when `decide()` returns
  `stop / reason:"done"` **after** a Critic APPROVED verdict (the existing hard gate), fire a
  **report step** before final close.
- [ ] Spawn a **reporter** sub-agent (new role, or reuse `writer`+`designer`) with a fixed prompt
  that takes: the task tree state, the diff/work summary, and the running-services list, and
  emits a self-contained HTML (inline CSS, one file).
- [ ] **Running-services capture (the hard sub-problem):** we must know which backends/APIs/
  frontends were started. Options, pick during impl:
  - a small registry of dev servers the agent launched (record `name → url/port/cmd` when a
    long-running `serve`/`dev` is started), or
  - scan listening ports opened under the session's process tree at report time.
  Flag explicitly: this needs a capture mechanism; without it the report omits live URLs.
- [ ] **Storage + link:** write to a known dir (`~/.local/share/mimocode/reports/<session>/<task>.html`
  or project `.mimocode/reports/`). On task close, surface a clickable link:
  - TUI: print the path / a `file://` (or open via the server),
  - Web app: a route that serves/renders the HTML (the mimo server already serves; add a
    `GET /report/:id` or static mount).
- [ ] Emit the link **together with** the task-close event (so closing the task shows "Report →").

**Effort:** 2–4 days. **Risks:** (1) running-services capture is the crux — needs a deliberate
mechanism; (2) report serving/linking in both TUI and web; (3) keep it off the hot path
(fire-and-forget, don't block completion).

---

## Phase 6 — per-active-cell side panels (review + file tree) 🟡
The header (with the **review/diff** and **file-tree** toggles) now renders only on the ACTIVE
cell, but the panels they open are still global/route-scoped and open as a fixed right-side panel.
Scope them to the active cell.

- [ ] **Review (VCS diff) toggle → active cell only.** Opening review should show the diff for the
  **active cell's** session, not the route/primary. Ideally render it as a **floating overlay /
  popover anchored to the active cell** (over that cell) instead of the fixed right-side panel —
  so in a grid it doesn't hijack the whole right edge. Fallback: a panel docked inside the active
  cell. State already flows through `SessionScope`; the work is the panel's mount/layout (today it
  uses the shared side-panel slot / `layout.*` toggle).
- [ ] **File tree toggle → active cell only.** `layout.fileTree.opened()` and the tree panel must
  key off the active cell's session/dir, and render within (or as an overlay on) the active cell —
  not as a global side panel affecting the primary.
- [ ] Make both toggles' open-state **per-cell** (e.g. `layout.grid`-scoped or keyed by the active
  session) so switching the active cell shows that cell's panel state.

**Effort:** ~1–2 days. **Risk:** these panels currently assume a single full-width session layout
(shared right slot); re-anchoring them to a cell / as overlays is the main work. Pure frontend
(`packages/app`).

---

## Recommended path
1. **Phase 1** (existing-session picker) — 80% of the value, minimal risk. Ship first.
2. **Phase 2** (new session in cell).
3. **Phase 4** (tasks view) — high value, independent of DnD; can come before Phase 3.
4. **Phase 6** (per-active-cell review/file-tree panels) — grid UX polish; pure frontend.
5. **Phase 3** (drag) — polish; do the slot-array model migration here.
6. **Phase 5** (completion report) — most involved; tackle running-services capture as its own
   sub-task first.

> All `packages/app` changes are frontend (your WIP). Phases 4–5 also touch
> `packages/opencode` (task API, completion-controller, report serving) — keep Bob-side
> changes inside `src/plugin/bob/` where possible; the task API + report route are the only
> likely upstream touches (flag for rebase).
