// ============================================
// contexts/kanban/lib/kanban-board-model.ts - the board as the UI arranges it
// ============================================
// Pure functions over the `GET /admin/kanban/board` answer: the drag-and-drop
// value (column id → its tasks), the search / filter / sort the URL asks for,
// and the anchor a finished drag sends to the API ("put it below this card").

import {
	KANBAN_WIP_TYPES,
	type KanbanAncestor,
	type KanbanBoardKind,
	type KanbanColumn,
	type KanbanItemRef,
	type KanbanItemType,
	type KanbanTask,
	type KanbanTaskPriority,
	type KanbanTeam,
} from "@workspace/shared";

import { effectiveSchedule, KANBAN_PRIORITY_RANK } from "./kanban-display";
import type { KanbanSort } from "../url-state/kanban-board";

/** Column id → its tasks top to bottom, keys in board order (the kit's `KanbanValue`). */
export type KanbanBoardValue = Record<string, KanbanTask[]>;

export interface KanbanTaskFilters {
	readonly search: string | undefined;
	readonly priority: KanbanTaskPriority | undefined;
	readonly team: KanbanTeam | undefined;
	readonly type: KanbanItemType | undefined;
	/** The feature the board is narrowed to: the feature itself and everything under it. */
	readonly feature?: string | undefined;
	/** `false` hides subtask cards (they stay counted on their task's badge). */
	readonly showSubtasks?: boolean | undefined;
}

export function toBoardValue(columns: readonly KanbanColumn[]): KanbanBoardValue {
	return Object.fromEntries(columns.map((column): [string, KanbanTask[]] => [column.id, [...column.tasks]]));
}

/** True when any filter is set (the board then shows a subset; hidden subtasks count, since a drag could not place them). */
export function hasActiveFilters(filters: KanbanTaskFilters): boolean {
	return (
		filters.search !== undefined ||
		filters.priority !== undefined ||
		filters.team !== undefined ||
		filters.type !== undefined ||
		filters.feature !== undefined ||
		filters.showSubtasks === false
	);
}

/**
 * A search matches the title, the description, a label, the reporter's or
 * assignee's name, or a parent's title (so a feature's name finds its stories), ignoring case.
 */
export function matchesFilters(task: KanbanTask, filters: KanbanTaskFilters): boolean {
	if (filters.priority !== undefined && task.priority !== filters.priority) {
		return false;
	}
	if (filters.team !== undefined && task.team !== filters.team) {
		return false;
	}
	if (filters.type !== undefined && task.type !== filters.type) {
		return false;
	}
	if (filters.showSubtasks === false && task.type === "SUBTASK") {
		return false;
	}
	if (filters.feature !== undefined && task.id !== filters.feature && !task.ancestors.some((ancestor) => ancestor.id === filters.feature)) {
		return false;
	}
	if (filters.search === undefined) {
		return true;
	}
	const needle = filters.search.toLowerCase();
	return [task.key ?? "", task.title, task.description, task.owner.name, task.assignee?.name ?? "", ...task.labels, ...task.ancestors.map((ancestor) => ancestor.title)].some(
		(text) => text.toLowerCase().includes(needle),
	);
}

/** By due date (a task by its story's), undated last. */
function compareDue(left: KanbanTask, right: KanbanTask): number {
	const leftDue = effectiveSchedule(left).dueAt;
	const rightDue = effectiveSchedule(right).dueAt;
	if (leftDue === rightDue) {
		return 0;
	}
	if (leftDue === null) {
		return 1;
	}
	if (rightDue === null) {
		return -1;
	}
	return leftDue - rightDue;
}

/** A column's tasks in the requested order; ties keep the board's own order (the sort is stable). */
export function sortTasks(tasks: readonly KanbanTask[], sort: KanbanSort): KanbanTask[] {
	switch (sort) {
		case "manual":
			return [...tasks];
		case "due":
			return [...tasks].sort(compareDue);
		case "priority":
			return [...tasks].sort((left, right) => KANBAN_PRIORITY_RANK[left.priority] - KANBAN_PRIORITY_RANK[right.priority]);
	}
}

/** The board as shown: every column kept (even when empty), its tasks filtered and ordered. */
export function arrangeBoardValue(value: KanbanBoardValue, filters: KanbanTaskFilters, sort: KanbanSort): KanbanBoardValue {
	return Object.fromEntries(
		Object.entries(value).map(([columnId, tasks]): [string, KanbanTask[]] => [
			columnId,
			sortTasks(
				tasks.filter((task) => matchesFilters(task, filters)),
				sort,
			),
		]),
	);
}

/** The id listed right before `id` in `ids`, or `null` when `id` is first (or absent). The API places a moved item below it. */
export function anchorBefore(ids: readonly string[], id: string): string | null {
	const index = ids.indexOf(id);
	return index > 0 ? (ids.at(index - 1) ?? null) : null;
}

/** Every task of the board, in board order. */
export function allTasks(columns: readonly KanbanColumn[]): KanbanTask[] {
	return columns.flatMap((column) => column.tasks);
}

/** The levels a board's swimlanes can group by, coarsest first: the planning board by epic; the execution board by epic, feature or story. */
export const KANBAN_LANE_TYPES: Readonly<Record<KanbanBoardKind, readonly KanbanItemType[]>> = { PLANNING: ["EPIC"], EXECUTION: ["EPIC", "FEATURE", "STORY"] };

/** The item a card's swimlane is named after (itself, when it is that level), or `null` when it has none. */
export function laneOwnerOf(task: KanbanTask, laneType: KanbanItemType): KanbanItemRef | null {
	if (task.type === laneType) {
		return { id: task.id, key: task.key, type: task.type, title: task.title };
	}
	const ancestor = task.ancestors.find((candidate) => candidate.type === laneType);
	return ancestor === undefined ? null : { id: ancestor.id, key: ancestor.key, type: ancestor.type, title: ancestor.title };
}

/** One swimlane: the item it groups by (`null`: the lane of cards without one) and its slice of the board. */
export interface KanbanLane {
	readonly key: string;
	readonly owner: KanbanItemRef | null;
	readonly value: KanbanBoardValue;
}

/** The lane of cards without an owner at the grouped level; it comes last. */
export const NO_LANE_KEY = "none";

function laneKeyOf(task: KanbanTask, laneType: KanbanItemType): string {
	return laneOwnerOf(task, laneType)?.id ?? NO_LANE_KEY;
}

/**
 * Splits an arranged board into swimlanes — every lane keeps every column, in
 * order — named by the first card that reaches each lane owner, the cards
 * without one last.
 */
export function groupIntoLanes(value: KanbanBoardValue, laneType: KanbanItemType): readonly KanbanLane[] {
	const owners = new Map<string, KanbanItemRef | null>();
	for (const task of Object.values(value).flat()) {
		const owner = laneOwnerOf(task, laneType);
		const key = owner?.id ?? NO_LANE_KEY;
		if (!owners.has(key)) {
			owners.set(key, owner);
		}
	}
	const keys = [...owners.keys()].sort((left, right) => Number(left === NO_LANE_KEY) - Number(right === NO_LANE_KEY));
	return keys.map((key): KanbanLane => ({
		key,
		owner: owners.get(key) ?? null,
		value: Object.fromEntries(Object.entries(value).map(([columnId, tasks]): [string, KanbanTask[]] => [columnId, tasks.filter((task) => laneKeyOf(task, laneType) === key)])),
	}));
}

/**
 * The whole board with one lane's cards replaced by `laneValue` (a drag inside
 * that lane): every other lane's cards stay where they were, the lane's cards
 * follow them in each column, in the lane's new order.
 */
export function replaceLane(value: KanbanBoardValue, laneKey: string, laneValue: KanbanBoardValue, laneType: KanbanItemType): KanbanBoardValue {
	return Object.fromEntries(
		Object.entries(value).map(([columnId, tasks]): [string, KanbanTask[]] => [
			columnId,
			[...tasks.filter((task) => laneKeyOf(task, laneType) !== laneKey), ...(laneValue[columnId] ?? [])],
		]),
	);
}

/**
 * What a column's WIP limit counts: its stories and tasks, whatever the filters
 * show. A subtask is part of its task's work, so it never counts and is never
 * held back by a full column; the header names how many there are beside the count.
 */
export interface KanbanWipCount {
	readonly counted: number;
	readonly subtasks: number;
}

export function wipCountOf(tasks: readonly Pick<KanbanTask, "type">[]): KanbanWipCount {
	return {
		counted: tasks.filter((task) => KANBAN_WIP_TYPES.includes(task.type)).length,
		subtasks: tasks.filter((task) => task.type === "SUBTASK").length,
	};
}

/** One row of the rollup strip: an active feature, its epic, how many of its stories are done, and its dates. */
export interface KanbanFeatureRollup {
	readonly feature: KanbanAncestor;
	readonly epic: KanbanItemRef | null;
	readonly done: number;
	readonly total: number;
}

/**
 * The execution board's active features — those with at least one story not
 * done — each with its stories counted (done of all) and its own dates, read
 * from the stories' parent chains. Features keep the order their first story
 * comes in on the board; a story with no feature is in no row.
 */
export function featureRollups(columns: readonly KanbanColumn[], isDoneColumn: (column: KanbanColumn) => boolean): readonly KanbanFeatureRollup[] {
	const rows = new Map<string, KanbanFeatureRollup>();
	for (const column of columns) {
		for (const story of column.tasks.filter((task) => task.type === "STORY")) {
			const feature = story.ancestors.find((ancestor) => ancestor.type === "FEATURE");
			if (feature === undefined) {
				continue;
			}
			const epic = story.ancestors.find((ancestor) => ancestor.type === "EPIC");
			const row: KanbanFeatureRollup = rows.get(feature.id) ?? {
				feature,
				epic: epic === undefined ? null : { id: epic.id, key: epic.key, type: epic.type, title: epic.title },
				done: 0,
				total: 0,
			};
			rows.set(feature.id, { ...row, done: row.done + (isDoneColumn(column) ? 1 : 0), total: row.total + 1 });
		}
	}
	return [...rows.values()].filter((row) => row.done < row.total);
}
