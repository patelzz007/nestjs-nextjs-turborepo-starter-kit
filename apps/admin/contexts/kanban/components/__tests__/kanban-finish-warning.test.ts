import { describe, expect, it } from "vitest";

import { task } from "../../lib/__tests__/kanban-fixtures";
import { finishWarningFor } from "../kanban-finish-warning-dialog";

describe("finishWarningFor", () => {
	it("warns when work under the item is still open, and says how much", () => {
		const feature = task({ id: "f", type: "FEATURE", rollup: { children: { done: 1, total: 3 }, points: { done: 0, total: 0 } } });

		expect(finishWarningFor(feature, "Delivered")).toEqual({ task: feature, finish: "Delivered", open: 2 });
	});

	it("stays quiet when everything under it is done, or nothing is", () => {
		expect(finishWarningFor(task({ id: "t", type: "TASK", rollup: { children: { done: 2, total: 2 }, points: { done: 0, total: 0 } } }), "Done")).toBeNull();
		expect(finishWarningFor(task({ id: "s" }), "Done")).toBeNull();
	});
});
