import { describe, expect, it } from "vitest";

import { CreateFileUploadUrlSchema, FILE_CATEGORY_POLICIES } from "../../../files/schemas/storage";
import {
	CreateKanbanCommentSchema,
	CreateKanbanLinkSchema,
	CreateKanbanTaskSchema,
	ImportKanbanTasksSchema,
	KANBAN_BOARD_OF_TYPE,
	KANBAN_COMMENT_BODY_MAX_LENGTH,
	KANBAN_COMMENT_FILE_LIMIT,
	KANBAN_STEP_LIMIT,
	KANBAN_TASK_LABEL_LIMIT,
	KANBAN_TASK_DESCRIPTION_MAX_LENGTH,
	KANBAN_TASK_TITLE_MAX_LENGTH,
	kanbanColumnIsDone,
	KanbanBoardQuerySchema,
	KanbanCommentListQuerySchema,
	KanbanItemKeySchema,
	kanbanItemKey,
	KanbanItemListQuerySchema,
	kanbanItemRuleIssues,
	KanbanLabelsSchema,
	KanbanSearchQuerySchema,
	KanbanTaskActivityQuerySchema,
	KanbanTaskCommentsQuerySchema,
	kanbanTypesOnBoard,
	MoveKanbanColumnSchema,
	MoveKanbanItemToParentSchema,
	MoveKanbanTaskSchema,
	UpdateKanbanColumnSchema,
	UpdateKanbanTaskSchema,
	type KanbanItemRuleFields,
} from "../kanban";

const COLUMN_ID = "0199d0c0-0000-7000-8000-0000000000a1";
const TASK_ID = "0199d0c0-0000-7000-8000-0000000000c1";
const PARENT_ID = "0199d0c0-0000-7000-8000-0000000000c2";
const PERSON_ID = "0199d0c0-0000-7000-8000-000000000001";
const VALID_TASK = { columnId: COLUMN_ID, type: "STORY", title: "Ship it", description: "", priority: "HIGH", team: "BACKEND", progress: 0 };
const JAN_1 = 1_792_000_000_000;
const JAN_9 = JAN_1 + 8 * 86_400_000;

/** A story with nothing set: every rule passes. */
const PLAIN_STORY: KanbanItemRuleFields = {
	type: "STORY",
	parentId: null,
	startAt: null,
	dueAt: null,
	storyPoints: null,
	stepCount: 0,
	acceptanceCriterionCount: 0,
};

function ruleFields(fields: Partial<KanbanItemRuleFields>): readonly string[] {
	return kanbanItemRuleIssues({ ...PLAIN_STORY, ...fields }).map((issue) => issue.field);
}

describe("the hierarchy", () => {
	it("puts epics and features on the planning board, stories, tasks and subtasks on the execution board", () => {
		expect(kanbanTypesOnBoard("PLANNING")).toEqual(["EPIC", "FEATURE"]);
		expect(kanbanTypesOnBoard("EXECUTION")).toEqual(["STORY", "TASK", "SUBTASK"]);
		expect(KANBAN_BOARD_OF_TYPE.SUBTASK).toBe("EXECUTION");
	});

	it("gives a task a story, a subtask a task and an epic no parent", () => {
		expect(ruleFields({ type: "TASK" })).toEqual(["parentId"]);
		expect(ruleFields({ type: "TASK", parentId: PARENT_ID })).toEqual([]);
		expect(ruleFields({ type: "SUBTASK" })).toEqual(["parentId"]);
		expect(ruleFields({ type: "SUBTASK", parentId: PARENT_ID })).toEqual([]);
		expect(ruleFields({ type: "EPIC", parentId: PARENT_ID })).toEqual(["parentId"]);
		expect(ruleFields({ type: "FEATURE" })).toEqual([]);
	});

	it("estimates stories only, keeps tasks and subtasks on their story's dates and never starts after the due date", () => {
		expect(ruleFields({ type: "FEATURE", storyPoints: 5 })).toEqual(["storyPoints"]);
		expect(ruleFields({ type: "SUBTASK", parentId: PARENT_ID, storyPoints: 1 })).toEqual(["storyPoints"]);
		expect(ruleFields({ storyPoints: 5 })).toEqual([]);
		expect(ruleFields({ type: "TASK", parentId: PARENT_ID, dueAt: JAN_9 })).toEqual(["dueAt"]);
		expect(ruleFields({ type: "SUBTASK", parentId: PARENT_ID, startAt: JAN_1 })).toEqual(["dueAt"]);
		expect(ruleFields({ startAt: JAN_9, dueAt: JAN_1 })).toEqual(["dueAt"]);
		expect(ruleFields({ startAt: JAN_1, dueAt: JAN_9 })).toEqual([]);
	});

	it("breaks only subtasks into steps, and gives only features and stories acceptance criteria", () => {
		expect(ruleFields({ stepCount: 1 })).toEqual(["steps"]);
		expect(ruleFields({ type: "TASK", parentId: PARENT_ID, stepCount: 1 })).toEqual(["steps"]);
		expect(ruleFields({ type: "SUBTASK", parentId: PARENT_ID, stepCount: 1 })).toEqual([]);
		expect(ruleFields({ type: "EPIC", acceptanceCriterionCount: 1 })).toEqual(["acceptanceCriteria"]);
		expect(ruleFields({ acceptanceCriterionCount: 2 })).toEqual([]);
	});
});

describe("keys", () => {
	it("name an item by its level and number, read in any case", () => {
		expect(kanbanItemKey("STORY", 142)).toBe("STORY-142");
		expect(KanbanItemKeySchema.parse(" story-142 ")).toBe("STORY-142");
		expect(KanbanItemKeySchema.safeParse("STORY-0").success).toBe(false);
		expect(KanbanItemKeySchema.safeParse("BUG-1").success).toBe(false);
	});
});

describe("columns", () => {
	it("read as done when delivered on the planning board or done on the execution board", () => {
		expect(kanbanColumnIsDone({ board: "PLANNING", stage: "DELIVERED" })).toBe(true);
		expect(kanbanColumnIsDone({ board: "PLANNING", stage: "PLANNED" })).toBe(false);
		expect(kanbanColumnIsDone({ board: "EXECUTION", state: "DONE" })).toBe(true);
		expect(kanbanColumnIsDone({ board: "EXECUTION", state: "REVIEW" })).toBe(false);
	});
});

describe("CreateKanbanTaskSchema", () => {
	it("accepts an item, trims its title and description, and defaults what is optional", () => {
		expect(CreateKanbanTaskSchema.parse({ ...VALID_TASK, title: "  Ship it  ", description: "  notes " })).toEqual({
			...VALID_TASK,
			title: "Ship it",
			description: "notes",
			labels: [],
			parentId: null,
			assigneeId: null,
			startAt: null,
			dueAt: null,
			storyPoints: null,
		});
	});

	it("applies the hierarchy's rules on the field they concern", () => {
		const result = CreateKanbanTaskSchema.safeParse({ ...VALID_TASK, type: "TASK", storyPoints: 3 });
		expect(result.success).toBe(false);
		expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual(["parentId", "storyPoints"]);
		expect(CreateKanbanTaskSchema.safeParse({ ...VALID_TASK, type: "TASK", parentId: PARENT_ID }).success).toBe(true);
	});

	it("takes story points from the scale only", () => {
		expect(CreateKanbanTaskSchema.parse({ ...VALID_TASK, storyPoints: 8 })).toMatchObject({ storyPoints: 8 });
		expect(CreateKanbanTaskSchema.safeParse({ ...VALID_TASK, storyPoints: 4 }).success).toBe(false);
	});

	it("rejects a blank or over-long title and an over-long description", () => {
		expect(CreateKanbanTaskSchema.safeParse({ ...VALID_TASK, title: "   " }).success).toBe(false);
		expect(CreateKanbanTaskSchema.safeParse({ ...VALID_TASK, title: "x".repeat(KANBAN_TASK_TITLE_MAX_LENGTH + 1) }).success).toBe(false);
		expect(CreateKanbanTaskSchema.safeParse({ ...VALID_TASK, description: "x".repeat(KANBAN_TASK_DESCRIPTION_MAX_LENGTH + 1) }).success).toBe(false);
	});

	it("bounds progress to a whole percentage and rejects unknown priorities, teams and keys", () => {
		expect(CreateKanbanTaskSchema.safeParse({ ...VALID_TASK, progress: 101 }).success).toBe(false);
		expect(CreateKanbanTaskSchema.safeParse({ ...VALID_TASK, progress: 12.5 }).success).toBe(false);
		expect(CreateKanbanTaskSchema.safeParse({ ...VALID_TASK, priority: "URGENT" }).success).toBe(false);
		expect(CreateKanbanTaskSchema.safeParse({ ...VALID_TASK, team: "MARKETING" }).success).toBe(false);
		expect(CreateKanbanTaskSchema.safeParse({ ...VALID_TASK, ownerId: TASK_ID }).success).toBe(false);
	});
});

describe("KanbanLabelsSchema", () => {
	it("lower-cases labels and takes each one once, up to the limit", () => {
		expect(KanbanLabelsSchema.parse([" Tech-Debt ", "q3"])).toEqual(["tech-debt", "q3"]);
		expect(KanbanLabelsSchema.safeParse(["a", "a"]).success).toBe(false);
		expect(KanbanLabelsSchema.safeParse(["two words"]).success).toBe(false);
		expect(KanbanLabelsSchema.safeParse(Array.from({ length: KANBAN_TASK_LABEL_LIMIT + 1 }, (_, index) => `l${String(index)}`)).success).toBe(false);
	});
});

describe("UpdateKanbanTaskSchema", () => {
	it("takes any subset of the fields with the version the client read", () => {
		expect(UpdateKanbanTaskSchema.parse({ version: 2, progress: 50 })).toEqual({ version: 2, progress: 50 });
	});

	it("requires the version and refuses to move an item, change its parent or change its type through an edit", () => {
		expect(UpdateKanbanTaskSchema.safeParse({ progress: 50 }).success).toBe(false);
		expect(UpdateKanbanTaskSchema.safeParse({ version: 2, columnId: COLUMN_ID }).success).toBe(false);
		expect(UpdateKanbanTaskSchema.safeParse({ version: 2, parentId: PARENT_ID }).success).toBe(false);
		expect(UpdateKanbanTaskSchema.safeParse({ version: 2, type: "EPIC" }).success).toBe(false);
	});

	it("takes a step tree in order: two levels, each row at most one level below the row above", () => {
		const row = { title: "Step", isDone: false, assigneeId: PERSON_ID };
		expect(
			UpdateKanbanTaskSchema.safeParse({
				version: 1,
				steps: [
					{ ...row, depth: 0 },
					{ ...row, depth: 1 },
					{ ...row, depth: 0 },
				],
			}).success,
		).toBe(true);
		expect(UpdateKanbanTaskSchema.safeParse({ version: 1, steps: [{ ...row, depth: 1 }] }).success).toBe(false);
		expect(
			UpdateKanbanTaskSchema.safeParse({
				version: 1,
				steps: [
					{ ...row, depth: 0 },
					{ ...row, depth: 1 },
					{ ...row, depth: 2 },
				],
			}).success,
		).toBe(false);
		expect(UpdateKanbanTaskSchema.safeParse({ version: 1, steps: Array.from({ length: KANBAN_STEP_LIMIT + 1 }, () => ({ ...row, depth: 0 })) }).success).toBe(false);
	});

	it("refuses a checklist that names one stored row twice", () => {
		const criterion = { id: PARENT_ID, title: "Works offline", isDone: false };
		expect(UpdateKanbanTaskSchema.safeParse({ version: 1, acceptanceCriteria: [criterion] }).success).toBe(true);
		expect(UpdateKanbanTaskSchema.safeParse({ version: 1, acceptanceCriteria: [criterion, criterion] }).success).toBe(false);
	});
});

describe("move schemas", () => {
	it("place a task below an anchor, or at the top with a null anchor", () => {
		expect(MoveKanbanTaskSchema.parse({ columnId: COLUMN_ID, afterTaskId: null, version: 0 })).toEqual({ columnId: COLUMN_ID, afterTaskId: null, version: 0 });
		expect(MoveKanbanTaskSchema.safeParse({ columnId: COLUMN_ID, afterTaskId: "not-a-uuid", version: 0 }).success).toBe(false);
		expect(MoveKanbanTaskSchema.safeParse({ columnId: COLUMN_ID, afterTaskId: null }).success).toBe(false);
	});

	it("put an item under a new parent, or under none, at the version the client read", () => {
		expect(MoveKanbanItemToParentSchema.parse({ parentId: PARENT_ID, version: 3 })).toEqual({ parentId: PARENT_ID, version: 3 });
		expect(MoveKanbanItemToParentSchema.parse({ parentId: null, version: 3 })).toEqual({ parentId: null, version: 3 });
		expect(MoveKanbanItemToParentSchema.safeParse({ parentId: PARENT_ID }).success).toBe(false);
	});

	it("place a column right of an anchor, or first", () => {
		expect(MoveKanbanColumnSchema.parse({ afterColumnId: null, version: 1 })).toEqual({ afterColumnId: null, version: 1 });
		expect(MoveKanbanColumnSchema.safeParse({ afterColumnId: null, version: -1 }).success).toBe(false);
	});
});

describe("column and link schemas", () => {
	it("set or clear a column's WIP limit within the column's capacity", () => {
		expect(UpdateKanbanColumnSchema.parse({ wipLimit: null, version: 0 })).toEqual({ wipLimit: null, version: 0 });
		expect(UpdateKanbanColumnSchema.safeParse({ wipLimit: 0, version: 0 }).success).toBe(false);
	});

	it("link an item as blocking, blocked by or related to another", () => {
		expect(CreateKanbanLinkSchema.parse({ targetTaskId: PARENT_ID, kind: "BLOCKED_BY" })).toEqual({ targetTaskId: PARENT_ID, kind: "BLOCKED_BY" });
		expect(CreateKanbanLinkSchema.safeParse({ targetTaskId: PARENT_ID, kind: "DUPLICATES" }).success).toBe(false);
	});
});

describe("board, import and lookup queries", () => {
	it("name the board to read or import onto", () => {
		expect(KanbanBoardQuerySchema.parse({ board: "PLANNING" })).toEqual({ board: "PLANNING" });
		expect(KanbanBoardQuerySchema.safeParse({}).success).toBe(false);
		expect(ImportKanbanTasksSchema.safeParse({ board: "EXECUTION", tasks: [VALID_TASK] }).success).toBe(true);
		expect(ImportKanbanTasksSchema.safeParse({ tasks: [VALID_TASK] }).success).toBe(false);
	});

	it("look items up by type and title, alphabetically by default", () => {
		expect(KanbanItemListQuerySchema.parse({ filter: { type: { eq: "FEATURE" } }, search: "audit" })).toMatchObject({ filter: { type: { eq: "FEATURE" } }, search: "audit" });
		expect(KanbanItemListQuerySchema.safeParse({ filter: { type: { eq: "BUG" } } }).success).toBe(false);
		expect(KanbanTaskActivityQuerySchema.parse({ taskId: TASK_ID })).toMatchObject({ taskId: TASK_ID, page: 1 });
	});
});

describe("KanbanSearchQuerySchema", () => {
	it("searches by text, optionally one level, at most the limit", () => {
		expect(KanbanSearchQuerySchema.parse({ q: " story-14 " })).toEqual({ q: "story-14", limit: 20 });
		expect(KanbanSearchQuerySchema.parse({ q: "checkout", type: "FEATURE", limit: "5" })).toEqual({ q: "checkout", type: "FEATURE", limit: 5 });
		expect(KanbanSearchQuerySchema.safeParse({ q: "  " }).success).toBe(false);
		expect(KanbanSearchQuerySchema.safeParse({ q: "x", limit: 21 }).success).toBe(false);
	});
});

describe("comment schemas", () => {
	it("take files with or without text, each once and at most the limit, but never nothing", () => {
		expect(CreateKanbanCommentSchema.parse({ body: "", fileIds: [TASK_ID] })).toEqual({ body: "", fileIds: [TASK_ID] });
		expect(CreateKanbanCommentSchema.safeParse({ body: "", fileIds: [] }).success).toBe(false);
		expect(CreateKanbanCommentSchema.safeParse({ body: "x", fileIds: [TASK_ID, TASK_ID] }).success).toBe(false);
		expect(
			CreateKanbanCommentSchema.safeParse({
				body: "x",
				fileIds: Array.from({ length: KANBAN_COMMENT_FILE_LIMIT + 1 }, (_, index) => `0199d0c0-0000-7000-8000-00000000010${String(index)}`),
			}).success,
		).toBe(false);
	});

	it("trim a comment and bound its length", () => {
		expect(CreateKanbanCommentSchema.parse({ body: " Looks good " })).toEqual({ body: "Looks good", fileIds: [] });
		expect(CreateKanbanCommentSchema.safeParse({ body: "  " }).success).toBe(false);
		expect(CreateKanbanCommentSchema.safeParse({ body: "x".repeat(KANBAN_COMMENT_BODY_MAX_LENGTH + 1) }).success).toBe(false);
	});

	it("list comments newest first by default, scoped to the path's task", () => {
		expect(KanbanCommentListQuerySchema.parse({})).toMatchObject({ page: 1 });
		expect(KanbanCommentListQuerySchema.safeParse({ sort: "body" }).success).toBe(false);
		expect(KanbanTaskCommentsQuerySchema.parse({ taskId: TASK_ID, limit: "10" })).toMatchObject({ taskId: TASK_ID, limit: 10 });
	});
});

describe("KANBAN_TASK_ATTACHMENT uploads", () => {
	it("are private PDFs and images within the single-request size, uploaded for the caller", () => {
		expect(FILE_CATEGORY_POLICIES.KANBAN_TASK_ATTACHMENT).toMatchObject({ visibility: "PRIVATE", maxBytes: 10_485_760, generatesVariants: false });
		const upload = { category: "KANBAN_TASK_ATTACHMENT", fileName: "plan.pdf", mimeType: "application/pdf", sizeBytes: 10, checksumSha256: "a".repeat(64) };
		expect(CreateFileUploadUrlSchema.safeParse(upload).success).toBe(false);
		expect(CreateFileUploadUrlSchema.safeParse({ ...upload, userId: TASK_ID }).success).toBe(true);
	});
});
