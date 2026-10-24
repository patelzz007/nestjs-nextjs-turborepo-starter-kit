---
title: "Kanban board"
description: "The platform staff's two linked kanban boards: the epic → feature → story → task → subtask hierarchy with item keys, planning stages and work states, Move to…, ⌘K search, rollups, ordering under the board lock, optimistic locking, checklists, links, watchers, history, comments with files, CSV import and attachments through the files pipeline."
order: 13
author: "Platform Team"
lastUpdated: 1792886400000
coverImage: "https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=1200&h=630&fit=crop"
tags: ["kanban", "admin", "cqrs", "files", "concurrency"]
---

# Kanban boards

Two linked boards shared by the platform staff, at **Platform → Components → Kanban**
(`/components/kanban-board`, `?board=planning|execution`) in the admin panel. Code: the `kanban`
context (`apps/api/src/contexts/kanban`), its contract (`packages/shared/src/contexts/kanban`), and the
admin pages (`apps/admin/contexts/kanban`, `apps/admin/app/(panel)/components/kanban-board`).
API reference: [Kanban board](./api-reference/kanban.md). How operators use it:
[Platform administration](../user-guide/09-platform-administration.md#kanban-boards-components--kanban).

## The hierarchy

Work is broken down **EPIC → FEATURE → STORY → TASK → SUBTASK**, each item pointing at its parent
one level up (`KanbanTask.type` / `parentId`). Epics and features live on the **planning** board;
stories, tasks and subtasks on the **execution** board (`KANBAN_BOARD_OF_TYPE`). The two levels
below a subtask (sub-subtask, sub-sub-subtask) are not cards: they are the subtask's **steps**, a
checklist two levels deep, so the board shows flow, not every step.

The rules live once in the shared contract (`kanbanItemRuleIssues`) and are applied by the create
schema, the forms and the API (`assertKanbanItemRules`, under the board lock):

| Rule                                                                                                                          | Why                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| A task has a story and a subtask a task; an epic has no parent; a feature's or story's parent is optional ("No feature" lane) | The hierarchy stays strictly one level per step                                                                                 |
| A parent is a live item exactly one level up (`assertParentFits`)                                                             | Checked under the board lock, so a parent deleted at the same moment never gains a child                                        |
| Story points (1, 2, 3, 5, 8, 13, 21) on **stories only**                                                                      | Epics and features show the **rollup** (sum of their stories, done = stories in a done column); velocity is never counted twice |
| Tasks and subtasks have no dates of their own — they follow their story's                                                     | Dates flow down, points roll up                                                                                                 |
| Steps on subtasks only; acceptance criteria on features and stories                                                           |                                                                                                                                 |
| An item with live children is not deleted (`409 KANBAN_ITEM_HAS_CHILDREN`)                                                    | Nothing is orphaned                                                                                                             |
| An item changes parent only through **Move to…** (`POST …/tasks/:id/parent`); `PATCH` refuses `parentId`                      | A card never changes lane by being dragged, and every re-parent is one explicit, logged, undoable step                          |

### Keys

Every item has a key — its level and a number, `STORY-142` — shown on cards, breadcrumbs, search
results and the rollup strip. One counter per level (`KanbanLevelCounter`) is advanced in the same
transaction as the insert (`PrismaKanbanKeyRepository.next`, one `UPDATE … RETURNING` that row-locks
the counter until commit), so two creates never share a number; an import advances each level's
counter once for all its rows. Keys are never reused, not even after a soft delete (`KanbanTask.key`
is plainly unique).

### Columns: stages and states

The two boards have their own column tables. A **planning** column (`KanbanPlanningColumn`) stands
for a stage — Backlog → Refining → Ready → Planned → Delivered — and has no WIP limit. An
**execution** column (`KanbanExecutionColumn`) stands for a work state — To Do → In Progress → Review
→ Done — with an optional soft WIP limit. Renaming or reordering a column never changes its stage or
state. An item sits in `planningColumnId` or `executionColumnId`, and **`assertColumnForLevel`** —
one validator used by create, import, move and the conversion — keeps every level on its own board
(`400 KANBAN_BOARD_MISMATCH`).

**WIP** counts a column's stories and tasks (`KANBAN_WIP_TYPES`); a subtask is part of its task's
work, so it never counts and is never held back by a full column. The header reads `5/6 · +3
subtasks` (amber at the limit, red over it); a planning column refuses a limit
(`400 KANBAN_PLANNING_HAS_NO_WIP_LIMIT`). Moving an item into a done (or delivered) column while
children are still open asks first ("FEATURE-12 still has 2 open stories") — a warning, never a block.

## Data model

| Table                   | Holds                                                                                                                                                                                                                         | Notes                                                                                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `KanbanPlanningColumn`  | title, `stage` (`BACKLOG` · `REFINING` · `READY` · `PLANNED` · `DELIVERED`), `position`, `version`                                                                                                                            | No endpoint deletes a column.                                                                                                                                                |
| `KanbanExecutionColumn` | title, `state` (`TODO` · `IN_PROGRESS` · `REVIEW` · `DONE`), `position`, soft `wipLimit`, `version`                                                                                                                           | The WIP limit warns (amber at it, red over it); it never refuses a card.                                                                                                     |
| `KanbanTask`            | `key`, `type`, `parentId`, title, description, priority, team, `labels`, `startAt`, `dueAt`, `storyPoints`, progress, `ownerId` (the reporter), `assigneeId`, `planningColumnId` / `executionColumnId`, `position`, `version` | Soft-deleted. `columnId` is the retired shared column (see "Converting an older board").                                                                                     |
| `KanbanLevelCounter`    | `level`, `lastNumber`                                                                                                                                                                                                         | Only counts up.                                                                                                                                                              |
| `KanbanChecklistItem`   | `taskId`, `list` (`STEPS` · `ACCEPTANCE_CRITERIA`), `depth` (0–1 for steps), title, `isDone`, `assigneeId`, `position`                                                                                                        | Order alone draws the tree: a row is at most one level deeper than the row above. Removed rows are soft-deleted. `SUBTASKS` is the retired list the conversion reads.        |
| `KanbanTaskLink`        | `sourceTaskId`, `targetTaskId`, `kind` (`BLOCKS` · `RELATES_TO`)                                                                                                                                                              | Stored one way round ("blocked by X" is "X blocks this"); a pair is never linked twice, nor blocking both ways. A card is **blocked** while a live, not-done item blocks it. |
| `KanbanTaskWatcher`     | `taskId`, `userId`                                                                                                                                                                                                            | The reporter watches what they create. Unwatching soft-deletes.                                                                                                              |
| `KanbanTaskActivity`    | `taskId`, `actorId`, `kind`, `field`, `fromValue`, `toValue`                                                                                                                                                                  | The item's history, written in the transaction of the change it records; values kept as they read then (names, `FEATURE-12 Checkout` for a parent). Append-only.             |
| `KanbanTaskComment`     | `taskId`, `authorId`, body                                                                                                                                                                                                    | Never edited or deleted. A comment may carry files (`KanbanTaskAttachment.commentId`).                                                                                       |
| `KanbanTaskAttachment`  | `taskId`, `commentId` (nullable), `fileId`, `kind` (`ATTACHMENT` = image, `DOCUMENT` = PDF)                                                                                                                                   | One live row per file (partial unique index); released when the file is deleted, with a `DETACHED` history entry.                                                            |
| `UserPreference`        | `userId`, `key`, `value` (JSON), `version`                                                                                                                                                                                    | Identity context. One live row per key; "Reset to default" soft-deletes. See "Preferences".                                                                                  |

Bounds live once in the shared contract (`KANBAN_COLUMN_TASK_LIMIT` = 200 items per column,
`KANBAN_TASK_ATTACHMENT_LIMIT` = 20 files per item — comments' files included —, `KANBAN_COMMENT_FILE_LIMIT`
= 5, `KANBAN_STEP_LIMIT` = 50, `KANBAN_TASK_LABEL_LIMIT` = 8, `KANBAN_SEARCH_LIMIT` = 20, text lengths)
and size the database columns. Every kanban table is **bypass-only** under RLS (SELECT/INSERT/UPDATE
policies on `app_rls_bypass_on(<table>)`, no DELETE policy, and `app_runtime` holds no DELETE on them):
the routes run as `kanban.board.read` / `kanban.board.write` after the `KANBAN_TASK` permission check,
and the controller is admin-panel only (`@AdminAccessOnly`). `UserPreference` is an ownership table
(`app_owns("userId")`).

## Assignees

Anyone who can use the board can be assigned an item or a subtask: the active accounts holding
`READ` on `KANBAN_TASK` (SuperAdmins included). The authorization context answers it through its
public `PermissionHoldersReadPort` (`authorization.permission_holders.read`: role grants down the role
hierarchy, location roles, live direct overrides, a DENY beating any ALLOW) — the kanban context never
reads RBAC tables. `GET /admin/kanban/people` lists them for the pickers; a create or an edit is checked
against the same list, but only for people it **newly** assigns, so an item keeps an assignee who has
since lost access until someone reassigns it.

## Ordering and concurrency

Positions are contiguous from 0 among live rows: per column for items, per board for columns. Every
change that reorders a board or reshapes the hierarchy (create, import, move, edit, delete, column
move, link) runs in one transaction that first takes the **board lock**
(`pg_advisory_xact_lock(hashtextextended('kanban.board', 0))`), reads both boards' arrangement, applies
the change in the `KanbanBoardArrangement` aggregate (pure, unit tested) and writes every changed
position in **one** `UPDATE … FROM unnest(…)` statement.

Moves are **anchored**: `{ columnId, afterTaskId | null, version }` puts the item right below
`afterTaskId` (or at the top). A moved item or column consumes its `version`; an edit applies only at
the `version` the client read (`409 KANBAN_TASK_STALE`), and ticking a checklist row bumps it too, so an
edit page opened before is refused instead of writing the old state back. Checklist, watch and link
writes take the item's row lock.

All writes are commands, all reads queries (ADR 059). Reads issue a fixed number of statements whatever
the board's size: the parent chain, comment counts and a comment's files come back with the rows; file
counts, checklist tallies, "blocked" flags and the rollups (one read of the hierarchy across both boards,
`computeRollups`) are one statement each. The e2e suite checks it.

## Attachments

`KANBAN_TASK_ATTACHMENT` is a private file category (PDF, JPEG, PNG, WebP; 10 MB, the single-request
limit of `rules/20`). The kanban context owns its meaning (`KanbanFileRegistrations`):

1. The browser asks for an upload ticket for the caller, uploads, completes and waits for the scan
   verdict (`waitForFileReady`).
2. `POST …/tasks/:taskId/attachments { fileId }` — or `POST …/comments { body, fileIds }` to post files
   with a comment — locks the item row, then `attachUploadedFiles` locks the files
   (`FileReferencePort.lockForBinding`), checks each is the caller's own READY upload not attached
   anywhere, keeps the item within its limit, and records each as a document (PDF) or an attachment
   (image) from the **stored** type. A comment and its files land together or not at all.
3. Anyone who may read the item downloads a file through `GET …/attachments/:id/download`.
4. Removing an attachment deletes its file through `StoredFileAccess`; in that same transaction
   `ReleaseKanbanAttachmentsOnFileDeleted` soft-deletes the row and records `DETACHED` in the item's
   history (the deletion runs as `files.delete`), and the stored copy is purged after commit.

## Seed

`prisma/seed/kanban.ts` (development scenario) seeds both boards in the split model: planning
(Backlog · Refining · Ready · Planned · Delivered) and execution (To Do · In Progress · Review · Done,
two with WIP limits); four epics, twelve features, eleven stories, five tasks and seven subtasks, each
keyed in creation order with the level counters set to match; assignees, labels, dates, story points,
subtask steps (one removed), acceptance criteria, links (one blocking, one removed), watchers (one
unwatched), history, comments (one with a file) and real attachment files written through the
configured storage provider, plus one soft-deleted story and one removed attachment; and board
preferences for three staff members (one reset). A counter is never wound back, and a preference a
person set through the board is kept. The `KANBAN_TASK` grants come from the system role catalog
(`pnpm db:sync-reference-data`): Admin all six actions, Manager all but `DELETE` and `MANAGE`.

## Converting an older board

A board created before the split (one `KanbanColumn` table, a task's subtasks as its checklist) is
converted once, in three steps. Migration 1 (`kanban_split_columns_keys_subtasks`, folded into the
current baseline) only added things: the new tables and enums, nullable `planningColumnId`,
`executionColumnId` and `key`, the `STEPS` list and the `SUBTASK` level.

1. **Dry run.** `pnpm db:kanban-convert -- --dry-run` runs every stage in one transaction and rolls
   it back, printing what each stage would write (the key mapping, the new columns, the triage, the
   subtasks made from checklists). It refuses to run before migration 1.
2. **Convert.** `pnpm db:kanban-convert` runs the stages in order, each in its own transaction under
   the board lock and the `kanban.board.convert` operation, and records each one in
   `KanbanConversionStage` when it commits — an interrupted run resumes after the last finished stage:
   - **KEYS** — every item (deleted ones too) gets its key per level in creation order; each counter
     ends ahead of every key.
   - **COLUMNS** — each shared column becomes a planning or an execution column under the **same id**,
     its items placed where they stood; a stage or state the board lacked gets a column.
   - **PLANNING_TRIAGE** — planning items in the retired "In progress" stage go to Refining when
     nothing is broken down under them yet, otherwise to Ready.
   - **CHECKLISTS** — each live task's top-level checklist row becomes a subtask item (done → Done,
     otherwise To Do), and the rows nested under it become its steps one level up; the old rows are
     soft-deleted.
3. **Verify, then migration 2 (manual gate).** `pnpm db:kanban-convert -- --verify` fails while any
   item is unkeyed or on no board, any checklist row is unconverted, any counter is behind its keys,
   or any stage has not run. Only after it passes on **every** environment: remove `KanbanColumn`,
   `KanbanTask.columnId`, the `KanbanColumnKind` enum, the `SUBTASKS` list value and
   `KanbanConversionStage` (with its enum) from `schema.prisma`, make `KanbanTask.key` required,
   generate migration 2 (`pnpm db:migrate:create --name kanban_drop_shared_columns`), delete
   `scripts/db/kanban-convert.ts` and its planner, and drop their seed-coverage exemptions.

## Placement in the admin

The boards are in the sidebar's **Components** section, beside the UI kit gallery, so they follow that
section's `component-gallery` flag (`ADMIN_COMPONENT_GALLERY`: on in development and test, off in
production unless set; the CI browser job sets it, since its admin suite drives the board). To make them a product page everywhere, move the menu entry (and route folder)
out of the Components section and drop the flag from the item-page rules in
`apps/admin/lib/navigation/route-authorization.ts`.

## Views

The page's views live in the URL (`apps/admin/contexts/kanban/url-state/kanban-board.ts`):

- **Board** (`view=board`): columns of compact cards. A card's top row says what it is — the level's
  icon, its name in capitals in the level's tone and its key (`STORY STORY-142`) — beside its ⋯ menu
  (Open, **Move to…**, **Move to column**, the drag's single-pointer alternative). A card's last row
  opens what sits below it in place: an epic's features, a feature's stories, a story's tasks or a
  subtask's steps; a task shows "3 subtasks · 1 done" instead.
- **Group by** (`lanes=none|epic|feature|story`): collapsible swimlanes, each headed by its item's
  level chip, key and status. The execution board groups by **feature** until someone chooses
  otherwise; the planning board by nothing (or epic). A card moves within its own lane.
- **Show subtasks** (`subtasks=true|false`, execution board): subtask cards are hidden until shown —
  from the Group-by menu or by pressing a task's "3 subtasks · 1 done" badge.
- **Rollup strip** (`rollup=open|closed`, execution board): one row per feature with a story not done
  — its epic, its stories done of all as a bar, its own dates (or "—"). Picking a row narrows the
  board to that feature (`feature=<id>`), and picking it again shows every feature.
- **Hierarchy** (`view=hierarchy`): both boards as one tree — epic, feature, story, task, subtask, and
  a subtask's steps, which load when it is opened. A search or a filter keeps every match with the
  path down to it, fully opened. The tree is read-only; work moves on the boards.
- **List** and **Table**: one board's items by column.

**Preferences.** Group-by and Show subtasks resolve in one order: the URL (a shared link shows what
its sender saw), then the person's saved preference (`GET /auth/preferences`), then the board's
default. Choosing writes both the URL and the preference (`PUT /auth/preferences/:key`); "Reset to
default" in the Group-by menu forgets it (`DELETE …`). A board narrowed to one feature that would
group by feature groups by story instead. The keys and the values each accepts live once in the
shared `USER_PREFERENCE_REGISTRY`; the API checks a write against it and drops a stored value it no
longer accepts on read.

**Moving.** A card's status changes by dragging it (or Move to column). Its parent changes only
through **Move to…** — from the card's menu, the item page or ⌘K — which offers live items of the one
valid parent level, searched by key or title (`GET /admin/kanban/search?type=…`). The item keeps its
column and place; the history records both parents; a toast ("Moved to FEATURE-12") offers **Undo**
for ten seconds. When the board is narrowed to a feature the item left, it follows the item.

**⌘K.** The command palette searches items as well as pages: an exact key first, then keys that
start with the text, then titles (`GET /admin/kanban/search`, ranked by `rankSearchCandidates` from
three bounded statements). On an item's page it lists that item's actions first — Move to…, Change
status to each other column of its board, Edit (`lib/palette/focus-actions.ts`).

Columns and cards that can't be dragged (columns outside the full unfiltered board; cards in a sorted
view) are passed to the kit as `locked`: fixed in place but drawn as usual. `disabled` would dim them
as unavailable.

## The item page

`/components/kanban-board/tasks/[id]` is laid out as a document page in one centred column:

- a breadcrumb trail (board, then each ancestor with its level's icon and key) with Watch,
  **Move to…**, Edit and Delete;
- the level's icon, its chip and key, and the title;
- a property list: status, type, parent (chip and key), assignee, reporter, priority, team, dates,
  points, progress, the level's tallies, labels, watchers, created and last edited;
- the description;
- blocks for the checklist (a subtask's steps or the acceptance criteria, ticked in place), children
  (with **Add …**), linked items, files and comments;
- **History**, a folded toggle that loads the activity when opened.

The edit page (`/edit`) shows the parent read-only, with a pointer to Move to….

## Not built yet

- **Capture API samples** for the kanban endpoints (`apps/docs/scripts/capture-api-samples.mjs`).
- Notifications to watchers; editing or deleting comments; columns that can be created or deleted.
- Automations (the reference design's "Create automation").
