// ============================================
// contexts/kanban/lib/kanban-hierarchy.ts - both boards as one expandable tree
// ============================================
// Pure functions behind the Hierarchy view: the planning and execution boards'
// items folded into epic → feature → story → task → subtask, each with the column it sits
// in; the filters applied so a match keeps the path down to it; and the ids a
// person can expand.

import type { KanbanColumn, KanbanColumnSummary, KanbanTask } from "@workspace/shared";

import { matchesFilters, type KanbanTaskFilters } from "./kanban-board-model";
import { percentOf } from "./kanban-display";

/** The column a tree row shows as its status. */
export type KanbanTreeStatus = KanbanColumnSummary;

/** A board column as the status a row shows (its stage or state, by board). */
function statusOf(column: KanbanColumn): KanbanTreeStatus {
	return column.board === "PLANNING"
		? { id: column.id, board: column.board, title: column.title, stage: column.stage }
		: { id: column.id, board: column.board, title: column.title, state: column.state };
}

/** One item in the tree, with the items one level below it, in board order. */
export interface KanbanTreeNode {
	readonly task: KanbanTask;
	readonly status: KanbanTreeStatus;
	readonly children: readonly KanbanTreeNode[];
}

interface MutableNode {
	readonly task: KanbanTask;
	readonly status: KanbanTreeStatus;
	readonly children: MutableNode[];
}

function freeze(node: MutableNode): KanbanTreeNode {
	return { task: node.task, status: node.status, children: node.children.map(freeze) };
}

/**
 * Folds the boards' columns (planning first) into a forest: each item under
 * its parent, siblings in board order (column, then position), an item whose
 * parent is not on either board at the top. An item listed twice is kept once.
 */
export function buildHierarchy(columns: readonly KanbanColumn[]): readonly KanbanTreeNode[] {
	const nodes = new Map<string, MutableNode>();
	for (const column of columns) {
		const status = statusOf(column);
		for (const task of column.tasks) {
			if (!nodes.has(task.id)) {
				nodes.set(task.id, { task, status, children: [] });
			}
		}
	}
	const roots: MutableNode[] = [];
	for (const node of nodes.values()) {
		const parent = node.task.parentId === null ? undefined : nodes.get(node.task.parentId);
		if (parent === undefined) {
			roots.push(node);
		} else {
			parent.children.push(node);
		}
	}
	return roots.map(freeze);
}

/** The tree narrowed to the items that match, each kept with the path down to it; a match keeps its whole branch. */
export function filterHierarchy(nodes: readonly KanbanTreeNode[], filters: KanbanTaskFilters): readonly KanbanTreeNode[] {
	return nodes.flatMap((node): KanbanTreeNode[] => {
		if (matchesFilters(node.task, filters)) {
			return [node];
		}
		const children = filterHierarchy(node.children, filters);
		return children.length === 0 ? [] : [{ ...node, children }];
	});
}

/** True when the row has something below it to open: child items, or — for a subtask — its steps. */
export function isExpandable(node: KanbanTreeNode): boolean {
	return node.children.length > 0 || (node.task.type === "SUBTASK" && node.task.steps.total > 0);
}

/** Every row that can be opened, at any depth: what "Expand all" opens. */
export function expandableIds(nodes: readonly KanbanTreeNode[]): readonly string[] {
	return nodes.flatMap((node): string[] => [...(isExpandable(node) ? [node.task.id] : []), ...expandableIds(node.children)]);
}

/** How many items the tree holds, at any depth. */
export function countNodes(nodes: readonly KanbanTreeNode[]): number {
	return nodes.reduce((sum, node) => sum + 1 + countNodes(node.children), 0);
}

/**
 * How far an item has got, in the measure its level uses: an epic or a feature
 * by its stories' points done, a story by its tasks done, a task by its
 * subtasks done, a subtask by its steps.
 * `null` when there is nothing to count yet.
 */
export function treeProgress(task: KanbanTask): number | null {
	switch (task.type) {
		case "EPIC":
		case "FEATURE":
			return task.rollup.points.total === 0 ? null : percentOf(task.rollup.points.done, task.rollup.points.total);
		case "STORY":
		case "TASK":
			return task.rollup.children.total === 0 ? null : percentOf(task.rollup.children.done, task.rollup.children.total);
		case "SUBTASK":
			return task.steps.total === 0 ? null : percentOf(task.steps.done, task.steps.total);
	}
}
