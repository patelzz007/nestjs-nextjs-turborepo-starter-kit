import type { UserPreference } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { DEFAULT_GROUP_BY, resolveGroupBy, resolveShowSubtasks } from "../kanban-board-preferences";

const SAVED: readonly UserPreference[] = [
	{ key: "board.execution.groupBy", value: "story", version: 1 },
	{ key: "board.execution.showSubtasks", value: true, version: 0 },
];

describe("resolveGroupBy", () => {
	it("takes the URL first, then the saved preference, then the board's default", () => {
		expect(resolveGroupBy("EXECUTION", "epic", SAVED, false)).toEqual({ value: "epic", source: "url" });
		expect(resolveGroupBy("EXECUTION", undefined, SAVED, false)).toEqual({ value: "story", source: "preference" });
		expect(resolveGroupBy("EXECUTION", undefined, [], false)).toEqual({ value: DEFAULT_GROUP_BY.EXECUTION, source: "default" });
		expect(resolveGroupBy("PLANNING", undefined, SAVED, false)).toEqual({ value: "none", source: "default" });
	});

	it("groups a board narrowed to one feature by story, unless the URL asked for feature lanes", () => {
		expect(resolveGroupBy("EXECUTION", undefined, [], true)).toEqual({ value: "story", source: "narrowed" });
		expect(resolveGroupBy("EXECUTION", "feature", [], true)).toEqual({ value: "feature", source: "url" });
	});

	it("ignores a saved value the registry no longer accepts for that board", () => {
		expect(resolveGroupBy("PLANNING", undefined, [{ key: "board.planning.groupBy", value: "story", version: 0 }], false)).toEqual({ value: "none", source: "default" });
	});
});

describe("resolveShowSubtasks", () => {
	it("takes the URL, then the saved choice, and hides subtask cards by default", () => {
		expect(resolveShowSubtasks(false, SAVED)).toEqual({ value: false, source: "url" });
		expect(resolveShowSubtasks(undefined, SAVED)).toEqual({ value: true, source: "preference" });
		expect(resolveShowSubtasks(undefined, [])).toEqual({ value: false, source: "default" });
	});
});
