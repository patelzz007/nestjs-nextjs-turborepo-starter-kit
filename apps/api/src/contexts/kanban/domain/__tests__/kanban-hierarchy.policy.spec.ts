import type { KanbanItemRuleFields } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { KanbanItemRuleViolatedError, KanbanParentInvalidError } from "../errors/kanban.errors";
import { assertKanbanItemRules, assertParentFits } from "../policies/kanban-hierarchy.policy";

const STORY_ID = "story-1";
const FEATURE_ID = "feature-1";

describe("assertParentFits", () => {
	it("accepts no parent, or a live item exactly one level up", () => {
		expect(() => {
			assertParentFits(null, "STORY", null, null);
		}).not.toThrow();
		expect(() => {
			assertParentFits(null, "STORY", FEATURE_ID, { id: FEATURE_ID, type: "FEATURE" });
		}).not.toThrow();
	});

	it("refuses a missing parent, the wrong level, and the item itself", () => {
		expect(() => {
			assertParentFits(null, "STORY", FEATURE_ID, null);
		}).toThrow(KanbanParentInvalidError);
		expect(() => {
			assertParentFits(null, "TASK", FEATURE_ID, { id: FEATURE_ID, type: "FEATURE" });
		}).toThrow(KanbanParentInvalidError);
		expect(() => {
			assertParentFits(STORY_ID, "STORY", STORY_ID, { id: STORY_ID, type: "FEATURE" });
		}).toThrow(KanbanParentInvalidError);
	});
});

describe("assertKanbanItemRules", () => {
	it("refuses an item that breaks a rule, naming the fields", () => {
		const fields: KanbanItemRuleFields = { type: "FEATURE", parentId: null, startAt: null, dueAt: null, storyPoints: 3, stepCount: 0, acceptanceCriterionCount: 0 };
		expect(() => {
			assertKanbanItemRules(fields);
		}).toThrow(KanbanItemRuleViolatedError);
		expect(() => {
			assertKanbanItemRules({ ...fields, storyPoints: null });
		}).not.toThrow();
	});
});
