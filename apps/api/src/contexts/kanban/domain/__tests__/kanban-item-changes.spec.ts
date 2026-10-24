import { KANBAN_ACTIVITY_VALUE_MAX_LENGTH } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { applyItemEdit, changedItemFields, type KanbanItemFields } from "../services/kanban-item-changes";

const BEFORE: KanbanItemFields = {
	title: "Ship it",
	description: "Notes",
	priority: "MEDIUM",
	team: "BACKEND",
	labels: ["api"],
	parentId: "feature-1",
	assigneeId: null,
	startAt: null,
	dueAt: 1_792_000_000_000,
	storyPoints: 3,
	progress: 10,
};

describe("applyItemEdit", () => {
	it("keeps every field the edit leaves out, and clears a field the edit sets to null", () => {
		expect(applyItemEdit(BEFORE, { version: 1, progress: 40, dueAt: null })).toEqual({ ...BEFORE, progress: 40, dueAt: null });
	});
});

describe("changedItemFields", () => {
	it("lists nothing for an edit that changes nothing", () => {
		expect(changedItemFields(BEFORE, applyItemEdit(BEFORE, { version: 1, title: "Ship it" }))).toEqual([]);
	});

	it("lists each changed field with its values as text, a description without its text", () => {
		const after = applyItemEdit(BEFORE, { version: 1, description: "New", priority: "HIGH", labels: ["api", "ui"], assigneeId: "u1", storyPoints: null });

		expect(changedItemFields(BEFORE, after)).toEqual([
			{ field: "DESCRIPTION", from: null, to: null },
			{ field: "PRIORITY", from: "MEDIUM", to: "HIGH" },
			{ field: "LABELS", from: "api", to: "api, ui" },
			{ field: "ASSIGNEE", from: null, to: "u1" },
			{ field: "STORY_POINTS", from: "3", to: null },
		]);
	});

	it("cuts a long value to what the history keeps", () => {
		const [change] = changedItemFields(BEFORE, { ...BEFORE, title: "x".repeat(KANBAN_ACTIVITY_VALUE_MAX_LENGTH + 20) });
		expect(change?.to).toHaveLength(KANBAN_ACTIVITY_VALUE_MAX_LENGTH);
	});
});
