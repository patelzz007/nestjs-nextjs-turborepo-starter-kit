// The one-off board conversion's decisions (`pnpm db:kanban-convert`), as pure
// functions over a snapshot of the board — the script reads the snapshot,
// writes what a plan says, and prints its report. Each stage is planned on the
// board as the previous stage left it, so a stage that already ran plans
// nothing (the conversion is idempotent), and a `--dry-run` shows exactly what
// a real run writes.
//
// The stages, in order (docs/technical/kanban.md → "Converting an older board"):
//   KEYS             every item gets its key, per level in creation order;
//   COLUMNS          each shared column becomes a planning or an execution column (same id);
//   PLANNING_TRIAGE  planning items in the retired "In progress" stage go to Refining
//                    (no breakdown yet) or Ready (already broken down);
//   CHECKLISTS       each task's subtask checklist becomes subtask items and their steps.

import { kanbanItemKey, type KanbanItemType, type KanbanPlanningStage, type KanbanTaskPriority, type KanbanTeam, type KanbanWorkState } from "@workspace/shared";

export type KanbanConversionStageName = "KEYS" | "COLUMNS" | "PLANNING_TRIAGE" | "CHECKLISTS";

/** The stages, in the order they run. */
export const KANBAN_CONVERSION_STAGES: readonly KanbanConversionStageName[] = ["KEYS", "COLUMNS", "PLANNING_TRIAGE", "CHECKLISTS"];

/** What a retired shared column stood for. */
export type LegacyColumnKind = "BACKLOG" | "REFINING" | "READY" | "PLANNED" | "IN_PROGRESS" | "REVIEW" | "DONE";

export interface LegacyColumn {
	readonly id: string;
	readonly board: "PLANNING" | "EXECUTION";
	readonly title: string;
	readonly kind: LegacyColumnKind;
	readonly position: number;
	readonly wipLimit: number | null;
}

export interface SnapshotPlanningColumn {
	readonly id: string;
	readonly title: string;
	readonly stage: KanbanPlanningStage;
	readonly position: number;
}

export interface SnapshotExecutionColumn {
	readonly id: string;
	readonly title: string;
	readonly state: KanbanWorkState;
	readonly position: number;
}

export interface SnapshotItem {
	readonly id: string;
	readonly type: KanbanItemType;
	readonly key: string | null;
	readonly createdAt: number;
	readonly parentId: string | null;
	readonly ownerId: string;
	readonly priority: KanbanTaskPriority;
	readonly team: KanbanTeam;
	readonly columnId: string | null;
	readonly planningColumnId: string | null;
	readonly executionColumnId: string | null;
	readonly position: number;
	readonly isDeleted: boolean;
}

/** A live row of a task's retired subtask checklist. */
export interface LegacySubtaskRow {
	readonly id: string;
	readonly taskId: string;
	readonly title: string;
	readonly depth: number;
	readonly isDone: boolean;
	readonly assigneeId: string | null;
	readonly position: number;
}

export interface BoardSnapshot {
	readonly legacyColumns: readonly LegacyColumn[];
	readonly planningColumns: readonly SnapshotPlanningColumn[];
	readonly executionColumns: readonly SnapshotExecutionColumn[];
	/** Every item, deleted ones too (they keep their key number). */
	readonly items: readonly SnapshotItem[];
	readonly counters: ReadonlyMap<KanbanItemType, number>;
	readonly legacySubtasks: readonly LegacySubtaskRow[];
}

/** Index of a list position that does not exist, as `findIndex` reports it. */
const NOT_FOUND = -1;

/** The levels, in the order they are reported. */
const LEVELS: readonly KanbanItemType[] = ["EPIC", "FEATURE", "STORY", "TASK", "SUBTASK"];

/** The number in a key (`STORY-142` → 142), or null for a malformed one. */
export function keyNumberOf(key: string): number | null {
	const match = /^(?:EPIC|FEATURE|STORY|TASK|SUBTASK)-(?<number>[1-9][0-9]*)$/u.exec(key);
	const digits = match?.groups?.number;
	return digits === undefined ? null : Number(digits);
}

/** The highest number already used by a level's keys (0 when none). */
function highestKeyNumber(items: readonly SnapshotItem[], level: KanbanItemType): number {
	return items.reduce((highest, item) => {
		const keyNumber = item.type === level && item.key !== null ? keyNumberOf(item.key) : null;
		return keyNumber === null ? highest : Math.max(highest, keyNumber);
	}, 0);
}

// ── KEYS ────────────────────────────────────────────────────────────────────

export interface KeyAssignment {
	readonly itemId: string;
	readonly key: string;
}

export interface KeysPlan {
	readonly assignments: readonly KeyAssignment[];
	/** Each level's counter after the stage: ahead of every key, existing or new. */
	readonly counters: ReadonlyMap<KanbanItemType, number>;
}

/** Older items first; `id` breaks a tie, so the numbering is the same on every run. */
function byCreation(left: SnapshotItem, right: SnapshotItem): number {
	return left.createdAt - right.createdAt || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
}

/**
 * Keys every item that has none — deleted ones too, so a number a deleted item
 * held is never handed out again — per level in creation order, continuing
 * after the highest number that level's counter or keys have reached.
 */
export function planKeys(snapshot: BoardSnapshot): KeysPlan {
	const assignments: KeyAssignment[] = [];
	const counters = new Map<KanbanItemType, number>();
	for (const level of LEVELS) {
		let last = Math.max(snapshot.counters.get(level) ?? 0, highestKeyNumber(snapshot.items, level));
		for (const item of snapshot.items.filter((candidate) => candidate.type === level && candidate.key === null).sort(byCreation)) {
			last += 1;
			assignments.push({ itemId: item.id, key: kanbanItemKey(level, last) });
		}
		counters.set(level, last);
	}
	return { assignments, counters };
}

// ── COLUMNS ─────────────────────────────────────────────────────────────────

/** The planning stage a retired planning column becomes; `null` for "In progress", whose items are triaged instead. */
export const PLANNING_STAGE_OF_KIND: Readonly<Record<LegacyColumnKind, KanbanPlanningStage | null>> = {
	BACKLOG: "BACKLOG",
	REFINING: "REFINING",
	READY: "READY",
	PLANNED: "PLANNED",
	IN_PROGRESS: null,
	REVIEW: "READY",
	DONE: "DELIVERED",
};

/** The work state a retired execution column becomes. */
export const WORK_STATE_OF_KIND: Readonly<Record<LegacyColumnKind, KanbanWorkState>> = {
	BACKLOG: "TODO",
	REFINING: "TODO",
	READY: "TODO",
	PLANNED: "TODO",
	IN_PROGRESS: "IN_PROGRESS",
	REVIEW: "REVIEW",
	DONE: "DONE",
};

/** The title a stage or state gets when the old board had no column for it. */
const STAGE_TITLE: Readonly<Record<KanbanPlanningStage, string>> = { BACKLOG: "Backlog", REFINING: "Refining", READY: "Ready", PLANNED: "Planned", DELIVERED: "Delivered" };
const STATE_TITLE: Readonly<Record<KanbanWorkState, string>> = { TODO: "To Do", IN_PROGRESS: "In Progress", REVIEW: "Review", DONE: "Done" };
const PLANNING_STAGES: readonly KanbanPlanningStage[] = ["BACKLOG", "REFINING", "READY", "PLANNED", "DELIVERED"];
const WORK_STATES: readonly KanbanWorkState[] = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"];

export interface NewPlanningColumn {
	readonly id: string;
	readonly title: string;
	readonly stage: KanbanPlanningStage;
	readonly position: number;
}

export interface NewExecutionColumn {
	readonly id: string;
	readonly title: string;
	readonly state: KanbanWorkState;
	readonly wipLimit: number | null;
	readonly position: number;
}

export interface ItemPlacement {
	readonly itemId: string;
	readonly board: "PLANNING" | "EXECUTION";
	readonly columnId: string;
	readonly position: number;
}

export interface ColumnsPlan {
	readonly planningColumns: readonly NewPlanningColumn[];
	readonly executionColumns: readonly NewExecutionColumn[];
	readonly placements: readonly ItemPlacement[];
	/** Items that cannot be placed safely (a level on the wrong board): the stage refuses to run while there are any. */
	readonly problems: readonly string[];
}

/**
 * Turns each retired column into a column of its board under the same id (so
 * links and bookmarks keep working), in the old order, and adds a column for
 * any stage or state the old board lacked. Live items move into the column that
 * replaces theirs at the same position; items in a planning "In progress"
 * column are left for the triage stage. Runs only before any new column exists.
 */
export function planColumns(snapshot: BoardSnapshot, newId: () => string): ColumnsPlan {
	if (snapshot.planningColumns.length > 0 || snapshot.executionColumns.length > 0 || snapshot.legacyColumns.length === 0) {
		return { planningColumns: [], executionColumns: [], placements: [], problems: [] };
	}
	const ordered = [...snapshot.legacyColumns].sort((left, right) => left.position - right.position);
	const planning: NewPlanningColumn[] = ordered.flatMap((column): NewPlanningColumn[] => {
		const stage = column.board === "PLANNING" ? PLANNING_STAGE_OF_KIND[column.kind] : null;
		return stage === null ? [] : [{ id: column.id, title: column.title, stage, position: 0 }];
	});
	const execution: NewExecutionColumn[] = ordered
		.filter((column) => column.board === "EXECUTION")
		.map((column): NewExecutionColumn => ({ id: column.id, title: column.title, state: WORK_STATE_OF_KIND[column.kind], wipLimit: column.wipLimit, position: 0 }));
	for (const stage of PLANNING_STAGES.filter((candidate) => !planning.some((column) => column.stage === candidate))) {
		const before = planning.findIndex((column) => PLANNING_STAGES.indexOf(column.stage) > PLANNING_STAGES.indexOf(stage));
		planning.splice(before === NOT_FOUND ? planning.length : before, 0, { id: newId(), title: STAGE_TITLE[stage], stage, position: 0 });
	}
	for (const state of WORK_STATES.filter((candidate) => !execution.some((column) => column.state === candidate))) {
		const before = execution.findIndex((column) => WORK_STATES.indexOf(column.state) > WORK_STATES.indexOf(state));
		execution.splice(before === NOT_FOUND ? execution.length : before, 0, { id: newId(), title: STATE_TITLE[state], state, wipLimit: null, position: 0 });
	}
	const planningColumns = planning.map((column, position): NewPlanningColumn => ({ ...column, position }));
	const executionColumns = execution.map((column, position): NewExecutionColumn => ({ ...column, position }));

	const placements: ItemPlacement[] = [];
	const problems: string[] = [];
	for (const item of snapshot.items.filter((candidate) => !candidate.isDeleted && candidate.columnId !== null)) {
		const legacy = snapshot.legacyColumns.find((column) => column.id === item.columnId);
		const onPlanning = item.type === "EPIC" || item.type === "FEATURE";
		if (legacy?.board !== (onPlanning ? "PLANNING" : "EXECUTION")) {
			problems.push(`${item.key ?? item.id}: a ${item.type.toLowerCase()} in a column of the other board`);
			continue;
		}
		if (onPlanning && PLANNING_STAGE_OF_KIND[legacy.kind] === null) {
			continue;
		}
		placements.push({ itemId: item.id, board: onPlanning ? "PLANNING" : "EXECUTION", columnId: legacy.id, position: item.position });
	}
	return { planningColumns, executionColumns, placements, problems };
}

// ── PLANNING_TRIAGE ─────────────────────────────────────────────────────────

export interface TriageMove {
	readonly itemId: string;
	readonly key: string | null;
	readonly stage: "REFINING" | "READY";
	readonly columnId: string;
	readonly position: number;
}

/**
 * Each live planning item still waiting in a retired "In progress" column goes
 * to the bottom of the first Refining column when nothing is broken down under
 * it yet, or of the first Ready column when it has live children — in the
 * order it stood.
 */
export function planPlanningTriage(snapshot: BoardSnapshot): readonly TriageMove[] {
	const refining = firstOf(snapshot.planningColumns, "REFINING");
	const ready = firstOf(snapshot.planningColumns, "READY");
	if (refining === null || ready === null) {
		return [];
	}
	const waiting = snapshot.items
		.filter((item) => !item.isDeleted && (item.type === "EPIC" || item.type === "FEATURE") && item.planningColumnId === null && item.columnId !== null)
		.sort((left, right) => left.position - right.position);
	const nextPosition = new Map<string, number>(
		[refining, ready].map((column): [string, number] => [column.id, snapshot.items.filter((item) => !item.isDeleted && item.planningColumnId === column.id).length]),
	);
	return waiting.map((item): TriageMove => {
		const hasBreakdown = snapshot.items.some((child) => !child.isDeleted && child.parentId === item.id);
		const column = hasBreakdown ? ready : refining;
		const position = nextPosition.get(column.id) ?? 0;
		nextPosition.set(column.id, position + 1);
		return { itemId: item.id, key: item.key, stage: hasBreakdown ? "READY" : "REFINING", columnId: column.id, position };
	});
}

function firstOf(columns: readonly SnapshotPlanningColumn[], stage: KanbanPlanningStage): SnapshotPlanningColumn | null {
	return [...columns].sort((left, right) => left.position - right.position).find((column) => column.stage === stage) ?? null;
}

// ── CHECKLISTS ──────────────────────────────────────────────────────────────

export interface NewSubtaskStep {
	readonly id: string;
	readonly title: string;
	/** One level up from the checklist row it came from: 0 = sub-subtask, 1 = sub-sub-subtask. */
	readonly depth: number;
	readonly isDone: boolean;
	readonly assigneeId: string | null;
	readonly position: number;
}

export interface NewSubtask {
	readonly id: string;
	readonly key: string;
	readonly taskId: string;
	/** The checklist row it was made from. */
	readonly fromRowId: string;
	readonly title: string;
	readonly ownerId: string;
	readonly assigneeId: string | null;
	readonly priority: KanbanTaskPriority;
	readonly team: KanbanTeam;
	readonly isDone: boolean;
	readonly columnId: string;
	readonly position: number;
	readonly steps: readonly NewSubtaskStep[];
}

export interface ChecklistsPlan {
	readonly subtasks: readonly NewSubtask[];
	/** Every retired row the stage retires (soft-deletes): each became a subtask or one of its steps. */
	readonly retiredRowIds: readonly string[];
	/** The subtask counter after the stage. */
	readonly subtaskCounter: number;
}

/**
 * Each live task's checklist, top to bottom: a top-level row becomes a subtask
 * item (done → the first Done column, otherwise the first To Do column, at the
 * bottom), and the rows nested under it become its steps one level up. Rows of
 * deleted tasks are left alone.
 */
export function planChecklists(snapshot: BoardSnapshot, newId: () => string): ChecklistsPlan {
	const done = firstState(snapshot.executionColumns, "DONE");
	const todo = firstState(snapshot.executionColumns, "TODO");
	let counter = Math.max(snapshot.counters.get("SUBTASK") ?? 0, highestKeyNumber(snapshot.items, "SUBTASK"));
	if (done === null || todo === null) {
		return { subtasks: [], retiredRowIds: [], subtaskCounter: counter };
	}
	const liveTasks = new Map(snapshot.items.filter((item) => item.type === "TASK" && !item.isDeleted).map((item): [string, SnapshotItem] => [item.id, item]));
	const nextPosition = new Map<string, number>(
		[todo, done].map((column): [string, number] => [column.id, snapshot.items.filter((item) => !item.isDeleted && item.executionColumnId === column.id).length]),
	);
	const subtasks: NewSubtask[] = [];
	const retired: string[] = [];
	const rowsByTask = new Map<string, LegacySubtaskRow[]>();
	for (const row of [...snapshot.legacySubtasks].sort((left, right) => left.position - right.position)) {
		if (liveTasks.has(row.taskId)) {
			rowsByTask.set(row.taskId, [...(rowsByTask.get(row.taskId) ?? []), row]);
		}
	}
	for (const [taskId, rows] of rowsByTask) {
		const task = liveTasks.get(taskId);
		if (task === undefined) {
			continue;
		}
		let current: { subtask: NewSubtask; steps: NewSubtaskStep[] } | null = null;
		const finish = (): void => {
			if (current !== null) {
				subtasks.push({ ...current.subtask, steps: current.steps });
			}
		};
		for (const row of rows) {
			retired.push(row.id);
			if (row.depth === 0 || current === null) {
				finish();
				const column = row.isDone ? done : todo;
				const position = nextPosition.get(column.id) ?? 0;
				nextPosition.set(column.id, position + 1);
				counter += 1;
				current = {
					subtask: {
						id: newId(),
						key: kanbanItemKey("SUBTASK", counter),
						taskId,
						fromRowId: row.id,
						title: row.title,
						ownerId: task.ownerId,
						assigneeId: row.assigneeId,
						priority: task.priority,
						team: task.team,
						isDone: row.isDone,
						columnId: column.id,
						position,
						steps: [],
					},
					steps: [],
				};
				continue;
			}
			current.steps.push({ id: newId(), title: row.title, depth: Math.max(0, row.depth - 1), isDone: row.isDone, assigneeId: row.assigneeId, position: current.steps.length });
		}
		finish();
	}
	return { subtasks, retiredRowIds: retired, subtaskCounter: counter };
}

function firstState(columns: readonly SnapshotExecutionColumn[], state: KanbanWorkState): SnapshotExecutionColumn | null {
	return [...columns].sort((left, right) => left.position - right.position).find((column) => column.state === state) ?? null;
}

// ── --verify ────────────────────────────────────────────────────────────────

/**
 * What still stands between the board and migration 2, one sentence each: an
 * item without a key or without a column of its board, a retired checklist row
 * not converted yet, a counter not ahead of its level's keys. Empty: migration
 * 2 can drop the retired column, table and enum value.
 */
export function verifyConversion(snapshot: BoardSnapshot): readonly string[] {
	const issues: string[] = [];
	const unkeyed = snapshot.items.filter((item) => item.key === null).length;
	if (unkeyed > 0) {
		issues.push(`${String(unkeyed)} item(s) have no key.`);
	}
	const unplaced = snapshot.items.filter((item) => !item.isDeleted && item.planningColumnId === null && item.executionColumnId === null).length;
	if (unplaced > 0) {
		issues.push(`${String(unplaced)} live item(s) sit in no planning or execution column.`);
	}
	if (snapshot.legacySubtasks.length > 0) {
		issues.push(`${String(snapshot.legacySubtasks.length)} task checklist row(s) are not subtasks yet.`);
	}
	for (const level of LEVELS) {
		const counter = snapshot.counters.get(level) ?? 0;
		const highest = highestKeyNumber(snapshot.items, level);
		if (counter < highest) {
			issues.push(`The ${level} counter (${String(counter)}) is behind its highest key (${kanbanItemKey(level, highest)}).`);
		}
	}
	return issues;
}
