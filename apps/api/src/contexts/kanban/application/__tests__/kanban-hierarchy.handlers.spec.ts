import type { CreateKanbanTaskInput, KanbanActivityListQuery, KanbanTaskDetail, UpdateKanbanTaskInput } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { FixedClock } from "../../../../platform/application/__tests__/fixed-clock";
import { InMemoryUnitOfWork } from "../../../../platform/application/__tests__/fakes/in-memory-unit-of-work";
import type { ActorContext } from "../../../../platform/application/actor-context";
import {
	KanbanAssigneeInvalidError,
	KanbanBoardMismatchError,
	KanbanChecklistItemNotFoundError,
	KanbanColumnStaleError,
	KanbanItemHasChildrenError,
	KanbanItemRuleViolatedError,
	KanbanLinkExistsError,
	KanbanLinkInvalidError,
	KanbanLinkNotFoundError,
	KanbanParentInvalidError,
	KanbanPlanningWipLimitError,
	KanbanTaskNotFoundError,
	KanbanTaskStaleError,
} from "../../domain/errors/kanban.errors";
import { AddKanbanLinkCommand } from "../commands/add-kanban-link/add-kanban-link.command";
import { AddKanbanLinkHandler } from "../commands/add-kanban-link/add-kanban-link.handler";
import { CreateKanbanTaskCommand } from "../commands/create-kanban-task/create-kanban-task.command";
import { CreateKanbanTaskHandler } from "../commands/create-kanban-task/create-kanban-task.handler";
import { DeleteKanbanTaskCommand } from "../commands/delete-kanban-task/delete-kanban-task.command";
import { DeleteKanbanTaskHandler } from "../commands/delete-kanban-task/delete-kanban-task.handler";
import { ImportKanbanTasksCommand } from "../commands/import-kanban-tasks/import-kanban-tasks.command";
import { ImportKanbanTasksHandler } from "../commands/import-kanban-tasks/import-kanban-tasks.handler";
import { MoveKanbanItemToParentCommand } from "../commands/move-kanban-item-to-parent/move-kanban-item-to-parent.command";
import { MoveKanbanItemToParentHandler } from "../commands/move-kanban-item-to-parent/move-kanban-item-to-parent.handler";
import { MoveKanbanTaskCommand } from "../commands/move-kanban-task/move-kanban-task.command";
import { MoveKanbanTaskHandler } from "../commands/move-kanban-task/move-kanban-task.handler";
import { RemoveKanbanLinkCommand } from "../commands/remove-kanban-link/remove-kanban-link.command";
import { RemoveKanbanLinkHandler } from "../commands/remove-kanban-link/remove-kanban-link.handler";
import { ReviseKanbanTaskCommand } from "../commands/revise-kanban-task/revise-kanban-task.command";
import { ReviseKanbanTaskHandler } from "../commands/revise-kanban-task/revise-kanban-task.handler";
import { SetKanbanChecklistItemCommand } from "../commands/set-kanban-checklist-item/set-kanban-checklist-item.command";
import { SetKanbanChecklistItemHandler } from "../commands/set-kanban-checklist-item/set-kanban-checklist-item.handler";
import { UpdateKanbanColumnCommand } from "../commands/update-kanban-column/update-kanban-column.command";
import { UpdateKanbanColumnHandler } from "../commands/update-kanban-column/update-kanban-column.handler";
import { WatchKanbanTaskCommand } from "../commands/watch-kanban-task/watch-kanban-task.command";
import { WatchKanbanTaskHandler } from "../commands/watch-kanban-task/watch-kanban-task.handler";
import type { KanbanScope } from "../kanban-scope";
import { ListKanbanActivityHandler } from "../queries/list-kanban-activity/list-kanban-activity.handler";
import { ListKanbanActivityQuery } from "../queries/list-kanban-activity/list-kanban-activity.query";
import { ListKanbanItemsHandler } from "../queries/list-kanban-items/list-kanban-items.handler";
import { ListKanbanItemsQuery } from "../queries/list-kanban-items/list-kanban-items.query";
import { ListKanbanPeopleHandler } from "../queries/list-kanban-people/list-kanban-people.handler";
import { ListKanbanPeopleQuery } from "../queries/list-kanban-people/list-kanban-people.query";
import { emptyPage, FakeKanbanReads, taskDetail } from "./fakes/kanban-read.fakes";
import {
	DOING_ID,
	FakeKanbanAssignees,
	fakeKanbanScope,
	InMemoryKanbanStore,
	NOW,
	OTHER_STAFF_ID,
	PLAN_ID,
	SequenceIdGenerator,
	STAFF_ID,
	TODO_ID,
} from "./fakes/kanban-scope.fakes";

const NEW_ID = "0199d0c0-0000-7000-8000-0000000000f1";
const OUTSIDER_ID = "0199d0c0-0000-7000-8000-000000000009";
const REQUEST = { requestId: "req-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null };

function staff(): ActorContext {
	return { kind: "user", userId: STAFF_ID, sessionId: "session-1", tenantId: null, isSuperAdmin: false, accessScope: "tenant", impersonatorUserId: null, request: REQUEST };
}

interface Setup {
	readonly store: InMemoryKanbanStore;
	readonly uow: InMemoryUnitOfWork<KanbanScope>;
	readonly reads: FakeKanbanReads;
	readonly ids: SequenceIdGenerator;
	readonly assignees: FakeKanbanAssignees;
}

/** A store with a planning epic and feature, and an execution story under the feature. */
function setup(): Setup {
	const store = new InMemoryKanbanStore();
	store.seedTask("epic", PLAN_ID, 0, "EPIC", { title: "Payments" });
	store.seedTask("feature", PLAN_ID, 0, "FEATURE", { title: "Refunds", parentId: "epic" });
	store.seedTask("story", TODO_ID, 0, "STORY", { title: "Refund a card", parentId: "feature" });
	const reads = new FakeKanbanReads();
	for (const id of ["epic", "feature", "story", NEW_ID]) {
		reads.tasks.set(id, taskDetail(id));
	}
	return { store, uow: new InMemoryUnitOfWork(fakeKanbanScope(store)), reads, ids: new SequenceIdGenerator([NEW_ID]), assignees: new FakeKanbanAssignees() };
}

function input(overrides: Partial<CreateKanbanTaskInput>): CreateKanbanTaskInput {
	return {
		columnId: TODO_ID,
		type: "STORY",
		title: "New item",
		description: "",
		priority: "MEDIUM",
		team: "BACKEND",
		labels: [],
		parentId: null,
		assigneeId: null,
		startAt: null,
		dueAt: null,
		storyPoints: null,
		progress: 0,
		...overrides,
	};
}

function create(context: Setup, overrides: Partial<CreateKanbanTaskInput>): Promise<KanbanTaskDetail> {
	return new CreateKanbanTaskHandler(context.uow, context.reads, context.ids, context.assignees).execute(new CreateKanbanTaskCommand(staff(), input(overrides)));
}

function moveTo(context: Setup, taskId: string, parentId: string | null, version = 0): Promise<KanbanTaskDetail> {
	return new MoveKanbanItemToParentHandler(context.uow, context.reads, context.ids).execute(new MoveKanbanItemToParentCommand(staff(), taskId, { parentId, version }));
}

function revise(context: Setup, taskId: string, edit: Omit<UpdateKanbanTaskInput, "version"> & { readonly version?: number }): Promise<KanbanTaskDetail> {
	return new ReviseKanbanTaskHandler(context.uow, context.reads, context.ids, context.assignees, new FixedClock(NOW)).execute(
		new ReviseKanbanTaskCommand(staff(), taskId, { version: 0, ...edit }),
	);
}

describe("creating items in the hierarchy", () => {
	it("puts a task under its story on the execution board, assigned to someone who may use the board", async () => {
		const context = setup();

		await create(context, { type: "TASK", parentId: "story", assigneeId: OTHER_STAFF_ID });

		expect(context.store.tasks.get(NEW_ID)).toMatchObject({ type: "TASK", key: "TASK-1", fields: { parentId: "story", assigneeId: OTHER_STAFF_ID } });
		expect(context.assignees.asked).toEqual([staff()]);
	});

	it("keys each item from its level's counter, never reusing a number", async () => {
		const context = setup();

		await create(context, {});

		// The seeded story took STORY-1; the counter hands the new one STORY-2.
		expect(context.store.tasks.get(NEW_ID)?.key).toBe("STORY-2");
		expect(context.store.counters.get("STORY")).toBe(2);
	});

	it("puts a subtask under its task on the execution board, never under a story", async () => {
		const context = setup();
		context.store.seedTask("task", TODO_ID, 0, "TASK", { parentId: "story" });

		await create(context, { type: "SUBTASK", parentId: "task" });
		expect(context.store.tasks.get(NEW_ID)).toMatchObject({ type: "SUBTASK", key: "SUBTASK-1", columnId: TODO_ID });

		await expect(create(context, { type: "SUBTASK", parentId: "story" })).rejects.toThrow(KanbanParentInvalidError);
		await expect(create(context, { type: "SUBTASK", parentId: "task", columnId: PLAN_ID })).rejects.toThrow(KanbanBoardMismatchError);
	});

	it("refuses an epic in an execution column, and a story in a planning one", async () => {
		const context = setup();

		await expect(create(context, { type: "EPIC" })).rejects.toThrow(KanbanBoardMismatchError);
		await expect(create(context, { columnId: PLAN_ID })).rejects.toThrow(KanbanBoardMismatchError);
		expect(context.store.tasks.has(NEW_ID)).toBe(false);
	});

	it("refuses a parent that is not one level up, and a task with no story before opening a transaction", async () => {
		const context = setup();

		await expect(create(context, { type: "TASK", parentId: "feature" })).rejects.toThrow(KanbanParentInvalidError);
		await expect(create(context, { parentId: "missing" })).rejects.toThrow(KanbanParentInvalidError);
		await expect(create(context, { type: "TASK" })).rejects.toThrow(KanbanItemRuleViolatedError);
		expect(context.uow.committed).toEqual([]);
	});

	it("refuses an assignee who may not use the board", async () => {
		const context = setup();

		await expect(create(context, { assigneeId: OUTSIDER_ID })).rejects.toThrow(KanbanAssigneeInvalidError);
	});

	it("refuses an import row meant for the other board", async () => {
		const context = setup();

		await expect(
			new ImportKanbanTasksHandler(context.uow, context.reads, context.ids, context.assignees).execute(
				new ImportKanbanTasksCommand(staff(), { board: "PLANNING", tasks: [input({ columnId: PLAN_ID })] }),
			),
		).rejects.toThrow(KanbanBoardMismatchError);
		expect(context.uow.committed).toEqual([]);
	});
});

describe("revising an item", () => {
	it("records each changed field and the assignee by name", async () => {
		const context = setup();

		await revise(context, "story", { title: "Refund a card fully", assigneeId: OTHER_STAFF_ID, storyPoints: 5 });

		expect(context.store.tasks.get("story")).toMatchObject({ version: 1, fields: { parentId: "feature", storyPoints: 5 } });
		expect(context.store.history()).toEqual([
			"story UPDATED:TITLE Refund a card→Refund a card fully",
			"story UPDATED:ASSIGNEE ∅→Carol White",
			"story UPDATED:STORY_POINTS ∅→5",
		]);
	});

	it("refuses a stale edit and a broken rule, writing nothing", async () => {
		const context = setup();

		await expect(revise(context, "story", { version: 3, title: "Mine" })).rejects.toThrow(KanbanTaskStaleError);
		await expect(revise(context, "feature", { storyPoints: 3 })).rejects.toThrow(KanbanItemRuleViolatedError);
		await expect(revise(context, "missing", { title: "Mine" })).rejects.toThrow(KanbanTaskNotFoundError);
		expect(context.store.activity).toEqual([]);
		expect(context.uow.committed).toEqual([]);
	});

	it("checks only a newly set assignee", async () => {
		const context = setup();
		context.store.seedTask("kept", TODO_ID, 0, "STORY", { assigneeId: OUTSIDER_ID });
		context.reads.tasks.set("kept", taskDetail("kept"));

		await revise(context, "kept", { title: "Still theirs", assigneeId: OUTSIDER_ID });
		await expect(revise(context, "kept", { version: 1, assigneeId: "0199d0c0-0000-7000-8000-00000000000a" })).rejects.toThrow(KanbanAssigneeInvalidError);
	});

	it("replaces a subtask's steps by id and records how many rows it holds", async () => {
		const context = setup();
		context.store.seedTask("task", TODO_ID, 0, "TASK", { parentId: "story" });
		context.store.seedTask("subtask", TODO_ID, 0, "SUBTASK", { parentId: "task" });
		context.reads.tasks.set("subtask", taskDetail("subtask"));
		context.store.seedChecklistRow({ id: "s1", taskId: "subtask", list: "STEPS", title: "Design", depth: 0, isDone: true, assigneeId: null });
		context.store.seedChecklistRow({ id: "s2", taskId: "subtask", list: "STEPS", title: "Old step", depth: 0, isDone: false, assigneeId: null });

		await revise(context, "subtask", {
			steps: [
				{ id: "s1", title: "Design", depth: 0, isDone: true, assigneeId: null },
				{ title: "Schema", depth: 1, isDone: false, assigneeId: OTHER_STAFF_ID },
				{ title: "Migration", depth: 0, isDone: false, assigneeId: null },
			],
		});

		expect(context.store.liveChecklist("subtask", "STEPS").map((row) => [row.title, row.depth, row.position])).toEqual([
			["Design", 0, 0],
			["Schema", 1, 1],
			["Migration", 0, 2],
		]);
		expect(context.store.history()).toEqual(["subtask UPDATED:STEPS 2→3"]);
	});

	it("refuses steps on a task and acceptance criteria on a subtask", async () => {
		const context = setup();
		context.store.seedTask("task", TODO_ID, 0, "TASK", { parentId: "story" });
		context.store.seedTask("subtask", TODO_ID, 0, "SUBTASK", { parentId: "task" });

		await expect(revise(context, "task", { steps: [{ title: "Step", depth: 0, isDone: false, assigneeId: null }] })).rejects.toThrow(KanbanItemRuleViolatedError);
		await expect(revise(context, "subtask", { acceptanceCriteria: [{ title: "Works", isDone: false }] })).rejects.toThrow(KanbanItemRuleViolatedError);
	});
});

describe("Move to… (changing an item's parent)", () => {
	it("puts a story under another feature, keeping its column, and records both parents by key", async () => {
		const context = setup();
		context.store.seedTask("feature-2", PLAN_ID, 0, "FEATURE", { title: "Chargebacks", parentId: "epic" });

		await moveTo(context, "story", "feature-2");

		expect(context.store.tasks.get("story")).toMatchObject({ version: 1, columnId: TODO_ID, fields: { parentId: "feature-2" } });
		expect(context.store.history()).toEqual(["story UPDATED:PARENT FEATURE-1 Refunds→FEATURE-2 Chargebacks"]);
	});

	it("undoes by moving back with the version it answered", async () => {
		const context = setup();
		context.store.seedTask("feature-2", PLAN_ID, 0, "FEATURE", { title: "Chargebacks", parentId: "epic" });

		await moveTo(context, "story", "feature-2");
		await moveTo(context, "story", "feature", 1);

		expect(context.store.tasks.get("story")).toMatchObject({ version: 2, fields: { parentId: "feature" } });
		expect(context.store.history()).toEqual(["story UPDATED:PARENT FEATURE-1 Refunds→FEATURE-2 Chargebacks", "story UPDATED:PARENT FEATURE-2 Chargebacks→FEATURE-1 Refunds"]);
	});

	it("refuses a parent at the wrong level, a stale version, and taking a task's story away, writing nothing", async () => {
		const context = setup();
		context.store.seedTask("task", TODO_ID, 0, "TASK", { parentId: "story" });

		await expect(moveTo(context, "story", "epic")).rejects.toThrow(KanbanParentInvalidError);
		await expect(moveTo(context, "story", "story")).rejects.toThrow(KanbanParentInvalidError);
		await expect(moveTo(context, "story", "feature", 4)).rejects.toThrow(KanbanTaskStaleError);
		await expect(moveTo(context, "task", null)).rejects.toThrow(KanbanItemRuleViolatedError);
		await expect(moveTo(context, "missing", "feature")).rejects.toThrow(KanbanTaskNotFoundError);
		expect(context.store.activity).toEqual([]);
	});

	it("leaves an item already under that parent alone", async () => {
		const context = setup();

		await moveTo(context, "story", "feature");

		expect(context.store.tasks.get("story")?.version).toBe(0);
		expect(context.store.activity).toEqual([]);
	});
});

describe("moving and deleting in the hierarchy", () => {
	it("records a move to another column, but not a reorder within one", async () => {
		const context = setup();
		context.store.seedTask("story-2", TODO_ID);
		const handler = new MoveKanbanTaskHandler(context.uow, context.reads, context.ids);

		await handler.execute(new MoveKanbanTaskCommand(staff(), "story", { columnId: TODO_ID, afterTaskId: "story-2", version: 0 }));
		await handler.execute(new MoveKanbanTaskCommand(staff(), "story", { columnId: DOING_ID, afterTaskId: null, version: 1 }));

		expect(context.store.history()).toEqual(["story MOVED To do→Doing"]);
		expect(context.reads.asked.map((ask) => ask.read)).toEqual(["board:EXECUTION", "board:EXECUTION"]);
	});

	it("never moves an item to the other board", async () => {
		const context = setup();

		await expect(
			new MoveKanbanTaskHandler(context.uow, context.reads, context.ids).execute(
				new MoveKanbanTaskCommand(staff(), "story", { columnId: PLAN_ID, afterTaskId: null, version: 0 }),
			),
		).rejects.toThrow(KanbanBoardMismatchError);
	});

	it("refuses to delete an item that still has children", async () => {
		const context = setup();

		await expect(new DeleteKanbanTaskHandler(context.uow, new FixedClock(NOW)).execute(new DeleteKanbanTaskCommand(staff(), "feature"))).rejects.toThrow(
			KanbanItemHasChildrenError,
		);
		expect(context.store.tasks.get("feature")?.isDeleted).toBe(false);
	});
});

describe("UpdateKanbanColumnHandler", () => {
	it("sets the WIP limit while the column is at the version read, and answers its board", async () => {
		const context = setup();
		const handler = new UpdateKanbanColumnHandler(context.uow, context.reads);

		await handler.execute(new UpdateKanbanColumnCommand(staff(), DOING_ID, { wipLimit: 3, version: 0 }));

		expect(context.store.columns.find((column) => column.id === DOING_ID)).toMatchObject({ wipLimit: 3, version: 1 });
		expect(context.reads.asked.map((ask) => ask.read)).toEqual(["board:EXECUTION"]);
		await expect(handler.execute(new UpdateKanbanColumnCommand(staff(), DOING_ID, { wipLimit: null, version: 0 }))).rejects.toThrow(KanbanColumnStaleError);
	});

	it("refuses a WIP limit on a planning column: only execution limits work in progress", async () => {
		const context = setup();

		await expect(
			new UpdateKanbanColumnHandler(context.uow, context.reads).execute(new UpdateKanbanColumnCommand(staff(), PLAN_ID, { wipLimit: 3, version: 0 })),
		).rejects.toThrow(KanbanPlanningWipLimitError);
	});
});

describe("links", () => {
	function link(context: Setup, targetTaskId: string, kind: "BLOCKS" | "BLOCKED_BY" | "RELATES_TO"): Promise<KanbanTaskDetail> {
		return new AddKanbanLinkHandler(context.uow, context.reads, context.ids).execute(new AddKanbanLinkCommand(staff(), "story", { targetTaskId, kind }));
	}

	it("stores 'blocked by' the other way round and records it in the item's history", async () => {
		const context = setup();

		await link(context, "feature", "BLOCKED_BY");

		expect(context.store.links).toEqual([{ id: NEW_ID, sourceTaskId: "feature", targetTaskId: "story", kind: "BLOCKS", isDeleted: false }]);
		expect(context.store.history()).toEqual(["story LINKED BLOCKED_BY→Refunds"]);
	});

	it("refuses a pair linked already, a link to itself and a missing item", async () => {
		const context = setup();
		await link(context, "feature", "BLOCKS");

		await expect(link(context, "feature", "BLOCKED_BY")).rejects.toThrow(KanbanLinkExistsError);
		await expect(link(context, "story", "RELATES_TO")).rejects.toThrow(KanbanLinkInvalidError);
		await expect(link(context, "missing", "RELATES_TO")).rejects.toThrow(KanbanLinkInvalidError);
	});

	it("removes a link from either end, and answers not found for one that is not the item's", async () => {
		const context = setup();
		context.store.links.push({ id: "l1", sourceTaskId: "epic", targetTaskId: "story", kind: "BLOCKS", isDeleted: false });
		const handler = new RemoveKanbanLinkHandler(context.uow, context.reads, context.ids, new FixedClock(NOW));

		await handler.execute(new RemoveKanbanLinkCommand(staff(), "story", "l1"));

		expect(context.store.links.at(0)?.isDeleted).toBe(true);
		expect(context.store.history()).toEqual(["story UNLINKED BLOCKED_BY→Payments"]);
		await expect(handler.execute(new RemoveKanbanLinkCommand(staff(), "story", "l1"))).rejects.toThrow(KanbanLinkNotFoundError);
	});
});

describe("SetKanbanChecklistItemHandler", () => {
	it("ticks a row off once, bumping the item's version, and treats a repeat as done", async () => {
		const context = setup();
		context.store.seedChecklistRow({
			id: "c1",
			taskId: "story",
			list: "ACCEPTANCE_CRITERIA",
			title: "Refund appears on the statement",
			depth: 0,
			isDone: false,
			assigneeId: null,
		});
		const handler = new SetKanbanChecklistItemHandler(context.uow, context.reads, context.ids);

		await handler.execute(new SetKanbanChecklistItemCommand(staff(), "story", "c1", { isDone: true }));
		await handler.execute(new SetKanbanChecklistItemCommand(staff(), "story", "c1", { isDone: true }));

		expect(context.store.liveChecklist("story", "ACCEPTANCE_CRITERIA").at(0)?.isDone).toBe(true);
		expect(context.store.tasks.get("story")?.version).toBe(1);
		expect(context.store.history()).toEqual(["story CHECKED:ACCEPTANCE_CRITERIA ∅→Refund appears on the statement"]);
	});

	it("answers not found for a row of another item", async () => {
		const context = setup();
		context.store.seedChecklistRow({ id: "c1", taskId: "feature", list: "ACCEPTANCE_CRITERIA", title: "Works", depth: 0, isDone: false, assigneeId: null });

		await expect(
			new SetKanbanChecklistItemHandler(context.uow, context.reads, context.ids).execute(new SetKanbanChecklistItemCommand(staff(), "story", "c1", { isDone: true })),
		).rejects.toThrow(KanbanChecklistItemNotFoundError);
	});
});

describe("WatchKanbanTaskHandler", () => {
	it("keeps one watch however often the caller watches, and stops on unwatch", async () => {
		const context = setup();
		const handler = new WatchKanbanTaskHandler(context.uow, context.reads, context.ids, new FixedClock(NOW));

		await handler.execute(new WatchKanbanTaskCommand(staff(), "story", true));
		await handler.execute(new WatchKanbanTaskCommand(staff(), "story", true));
		expect(context.store.watchers.filter((row) => !row.isDeleted)).toHaveLength(1);

		await handler.execute(new WatchKanbanTaskCommand(staff(), "story", false));
		await handler.execute(new WatchKanbanTaskCommand(staff(), "story", false));
		expect(context.store.watchers.filter((row) => !row.isDeleted)).toEqual([]);
		await expect(handler.execute(new WatchKanbanTaskCommand(staff(), "missing", true))).rejects.toThrow(KanbanTaskNotFoundError);
	});
});

describe("lookups", () => {
	it("lists the assignable people by name", async () => {
		const reads = new FakeKanbanReads();
		const assignees = new FakeKanbanAssignees([OTHER_STAFF_ID]);

		await expect(new ListKanbanPeopleHandler(reads, assignees).execute(new ListKanbanPeopleQuery(staff()))).resolves.toEqual({
			people: [{ id: OTHER_STAFF_ID, name: "Carol White" }],
		});
	});

	it("passes an item search through, and answers not found for a missing item's history", async () => {
		const reads = new FakeKanbanReads();
		const query: KanbanActivityListQuery = { page: 1, limit: 20 };

		await expect(new ListKanbanItemsHandler(reads).execute(new ListKanbanItemsQuery(staff(), { page: 1, limit: 20, search: "refund" }))).resolves.toBe(reads.itemsPage);
		reads.activityPages.set("story", emptyPage());
		await expect(new ListKanbanActivityHandler(reads).execute(new ListKanbanActivityQuery(staff(), "story", query))).resolves.toEqual(emptyPage());
		await expect(new ListKanbanActivityHandler(reads).execute(new ListKanbanActivityQuery(staff(), "missing", query))).rejects.toThrow(KanbanTaskNotFoundError);
		expect(reads.asked.map((ask) => ask.read)).toEqual(["items:refund", "activity:20", "activity:20"]);
	});
});
