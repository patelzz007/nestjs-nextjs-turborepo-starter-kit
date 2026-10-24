import { describe, expect, it } from "vitest";

import {
	dateInputToEpochMs,
	emptyTaskFormValues,
	epochMsToDateInput,
	KANBAN_TASK_TEMPLATES,
	KanbanTaskEditFormSchema,
	KanbanTaskFormSchema,
	labelsFromText,
	moveRow,
	normalizeStepDepths,
	templateFormValues,
	type KanbanStepRowValues,
	type KanbanTaskEditFormValues,
} from "../kanban-task-form";
import { STORY_ID, TODO_ID } from "./kanban-fixtures";

const PERSON_ID = "0199d0c0-0000-7000-8000-000000000001";

function step(key: string, depth: number, title = key): KanbanStepRowValues {
	return { key, id: "", title, depth, isDone: false, assigneeId: "" };
}

/** A story's edit form as loaded. */
const EDIT_VALUES: KanbanTaskEditFormValues = {
	type: "STORY",
	version: 4,
	title: "Refund a card",
	description: "",
	priority: "HIGH",
	team: "BACKEND",
	assigneeId: "",
	labels: "",
	startAt: "",
	dueAt: "",
	storyPoints: "5",
	progress: "10",
	steps: [],
	acceptanceCriteria: [],
};

describe("dates and labels", () => {
	it("round-trips a calendar date through local midnight", () => {
		const epochMs = dateInputToEpochMs("2026-06-14");
		expect(epochMs).toBe(new Date(2026, 5, 14).getTime());
		expect(epochMsToDateInput(epochMs)).toBe("2026-06-14");
	});

	it("reads a blank or malformed date as no date", () => {
		expect(dateInputToEpochMs("")).toBeNull();
		expect(dateInputToEpochMs("14/06/2026")).toBeNull();
		expect(epochMsToDateInput(null)).toBe("");
	});

	it("splits a comma-separated label line, skipping blanks", () => {
		expect(labelsFromText(" api, tech-debt ,, ")).toEqual(["api", "tech-debt"]);
		expect(labelsFromText("")).toEqual([]);
	});
});

describe("KanbanTaskFormSchema", () => {
	it("turns the form's text into the create contract", () => {
		const values = {
			...emptyTaskFormValues({ columnId: TODO_ID, type: "STORY" }),
			title: " Ship it ",
			progress: "40",
			dueAt: "2026-06-14",
			storyPoints: "5",
			labels: "Payments, q4",
			assigneeId: PERSON_ID,
		};

		expect(KanbanTaskFormSchema.parse(values)).toEqual({
			columnId: TODO_ID,
			type: "STORY",
			title: "Ship it",
			description: "",
			priority: "MEDIUM",
			team: "PRODUCT",
			labels: ["payments", "q4"],
			parentId: null,
			assigneeId: PERSON_ID,
			startAt: null,
			dueAt: new Date(2026, 5, 14).getTime(),
			storyPoints: 5,
			progress: 40,
		});
	});

	it("drops what the chosen type does not carry, and keeps a task's story", () => {
		const values = { ...emptyTaskFormValues({ columnId: TODO_ID, type: "TASK", parentId: STORY_ID }), title: "Step", dueAt: "2026-06-14", storyPoints: "5" };

		expect(KanbanTaskFormSchema.parse(values)).toMatchObject({ type: "TASK", parentId: STORY_ID, dueAt: null, storyPoints: null });
	});

	it("reports what the contract refuses, the hierarchy's rules included", () => {
		const blank = emptyTaskFormValues({ columnId: TODO_ID, type: "STORY" });
		expect(KanbanTaskFormSchema.safeParse(blank).success).toBe(false);
		expect(KanbanTaskFormSchema.safeParse({ ...blank, title: "Ok", progress: "120" }).success).toBe(false);
		expect(KanbanTaskFormSchema.safeParse({ ...blank, title: "Ok", storyPoints: "4" }).success).toBe(false);
		expect(KanbanTaskFormSchema.safeParse({ ...blank, title: "Ok", type: "TASK" }).success).toBe(false);
	});
});

describe("KanbanTaskEditFormSchema", () => {
	it("turns the edit form into the update contract with the version it was loaded at", () => {
		expect(KanbanTaskEditFormSchema.parse({ ...EDIT_VALUES, acceptanceCriteria: [{ key: "c", id: "", title: "Works offline", isDone: false }] })).toEqual({
			version: 4,
			title: "Refund a card",
			description: "",
			priority: "HIGH",
			team: "BACKEND",
			assigneeId: null,
			labels: [],
			startAt: null,
			dueAt: null,
			storyPoints: 5,
			progress: 10,
			acceptanceCriteria: [{ title: "Works offline", isDone: false }],
		});
	});

	it("sends a subtask's steps without blank rows, its tree kept valid, and never its parent", () => {
		const parsed = KanbanTaskEditFormSchema.parse({
			...EDIT_VALUES,
			type: "SUBTASK",
			storyPoints: "",
			steps: [step("a", 0, "Design"), step("b", 1, ""), step("c", 2, "Index"), { ...step("d", 0, "Ship"), id: STORY_ID, assigneeId: PERSON_ID }],
		});

		expect(parsed).not.toHaveProperty("parentId");
		expect(parsed.steps).toEqual([
			{ title: "Design", depth: 0, isDone: false, assigneeId: null },
			{ title: "Index", depth: 1, isDone: false, assigneeId: null },
			{ id: STORY_ID, title: "Ship", depth: 0, isDone: false, assigneeId: PERSON_ID },
		]);
		expect(parsed.acceptanceCriteria).toBeUndefined();
	});
});

describe("checklist editing", () => {
	it("keeps each row at most one level below the row above", () => {
		expect(normalizeStepDepths([step("a", 1), step("b", 2), step("c", 0), step("d", 2)]).map((row) => row.depth)).toEqual([0, 1, 0, 1]);
	});

	it("moves a row up or down, and leaves the list alone at either end", () => {
		expect(moveRow(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
		expect(moveRow(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
		expect(moveRow(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
	});
});

describe("templates", () => {
	it("prefill a new item in the chosen column", () => {
		const bug = KANBAN_TASK_TEMPLATES.find((template) => template.key === "bug");
		if (bug === undefined) {
			throw new Error("the bug template is missing");
		}
		expect(templateFormValues(bug, { columnId: TODO_ID, type: "STORY" })).toMatchObject({ columnId: TODO_ID, type: "STORY", priority: "HIGH", team: "QA", title: "Fix: " });
	});
});
