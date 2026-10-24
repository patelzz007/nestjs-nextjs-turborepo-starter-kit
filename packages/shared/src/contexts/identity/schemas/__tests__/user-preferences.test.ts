import { describe, expect, it } from "vitest";

import { parseUserPreferenceValue, SetUserPreferenceSchema, UserPreferencePathSchema, UserPreferencesSchema } from "../user-preferences";

describe("the preference registry", () => {
	it("accepts each key's own values only", () => {
		expect(parseUserPreferenceValue("board.execution.groupBy", "feature")).toBe("feature");
		expect(parseUserPreferenceValue("board.planning.groupBy", "epic")).toBe("epic");
		// The planning board holds epics and features: it never groups by feature or story.
		expect(parseUserPreferenceValue("board.planning.groupBy", "story")).toBeNull();
		expect(parseUserPreferenceValue("board.execution.showSubtasks", true)).toBe(true);
		expect(parseUserPreferenceValue("board.execution.showSubtasks", "none")).toBeNull();
		expect(parseUserPreferenceValue("board.execution.groupBy", false)).toBeNull();
	});

	it("refuses a write whose value its key does not accept, on the value", () => {
		expect(SetUserPreferenceSchema.parse({ key: "board.execution.groupBy", value: "story" })).toEqual({ key: "board.execution.groupBy", value: "story" });
		const refused = SetUserPreferenceSchema.safeParse({ key: "board.planning.groupBy", value: "feature" });
		expect(refused.success).toBe(false);
		expect(refused.error?.issues.map((issue) => issue.path.join("."))).toEqual(["value"]);
		expect(SetUserPreferenceSchema.safeParse({ key: "board.unknown", value: true }).success).toBe(false);
		expect(SetUserPreferenceSchema.safeParse({ key: "board.execution.showSubtasks", value: true, userId: "x" }).success).toBe(false);
	});

	it("names a key in the path and lists stored preferences with their version", () => {
		expect(UserPreferencePathSchema.parse({ key: "board.execution.showSubtasks" })).toEqual({ key: "board.execution.showSubtasks" });
		expect(UserPreferencePathSchema.safeParse({ key: "theme" }).success).toBe(false);
		expect(UserPreferencesSchema.parse({ preferences: [{ key: "board.execution.groupBy", value: "none", version: 2 }] }).preferences).toHaveLength(1);
	});
});
