import { epochMs, type KanbanAncestor, type KanbanExecutionColumn, type KanbanTask, type KanbanWorkState } from "@workspace/shared";

export const TODO_ID = "0199d0c0-0000-7000-8000-0000000000a1";
export const DOING_ID = "0199d0c0-0000-7000-8000-0000000000a2";
export const FEATURE_ID = "0199d0c0-0000-7000-8000-0000000000f1";
export const STORY_ID = "0199d0c0-0000-7000-8000-0000000000f2";

const NO_TALLY = { done: 0, total: 0 };

/** An ancestor as a card names it. */
export function ancestor(overrides: Partial<KanbanAncestor> & Pick<KanbanAncestor, "id" | "type">): KanbanAncestor {
	return { key: null, title: `${overrides.type} ${overrides.id}`, startAt: null, dueAt: null, ...overrides };
}

/** A story card with sensible defaults, overridden per test. */
export function task(overrides: Partial<KanbanTask> & Pick<KanbanTask, "id">): KanbanTask {
	return {
		key: null,
		columnId: TODO_ID,
		type: "STORY",
		title: `Task ${overrides.id}`,
		description: "",
		priority: "MEDIUM",
		team: "BACKEND",
		labels: [],
		parentId: null,
		ancestors: [],
		startAt: null,
		dueAt: null,
		storyPoints: null,
		progress: 0,
		owner: { id: "0199d0c0-0000-7000-8000-000000000001", name: "Admin User" },
		assignee: null,
		rollup: { children: NO_TALLY, points: NO_TALLY },
		steps: NO_TALLY,
		acceptanceCriteria: NO_TALLY,
		isBlocked: false,
		counts: { comments: 0, attachments: 0, documents: 0 },
		version: 0,
		createdAt: epochMs(1_792_000_000_000),
		updatedAt: epochMs(1_792_000_000_000),
		...overrides,
	};
}

export function column(id: string, title: string, tasks: readonly KanbanTask[], state: KanbanWorkState = "TODO"): KanbanExecutionColumn {
	return { id, board: "EXECUTION", title, state, wipLimit: null, version: 0, tasks: [...tasks] };
}
