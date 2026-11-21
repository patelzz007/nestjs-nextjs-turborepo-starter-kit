import { describe, expect, it } from "vitest";

import { createDataTableEditHistory, pushDataTableEdit, redoDataTableEdit, undoDataTableEdit, type DataTableEditStep } from "../edit-history";

function step(rowId: string, previousValue: string, value: string): DataTableEditStep<string> {
	return { rowId, columnId: "name", previousValue, value };
}

describe("data table edit history", () => {
	it("has nothing to undo or redo when new", () => {
		const history = createDataTableEditHistory<string>();
		expect(undoDataTableEdit(history)).toBeNull();
		expect(redoDataTableEdit(history)).toBeNull();
	});

	it("undoes the last edit by writing its old value back, then redoes it", () => {
		const history = pushDataTableEdit(pushDataTableEdit(createDataTableEditHistory<string>(), step("r-1", "a", "b")), step("r-2", "x", "y"));

		const undone = undoDataTableEdit(history);
		expect(undone?.step).toEqual({ rowId: "r-2", columnId: "name", previousValue: "y", value: "x" });

		const redone = undone === null ? null : redoDataTableEdit(undone.history);
		expect(redone?.step).toEqual(step("r-2", "x", "y"));
		expect(redone?.history.past).toHaveLength(2);
		expect(redone?.history.future).toHaveLength(0);
	});

	it("walks back through several edits, newest first", () => {
		let history = pushDataTableEdit(createDataTableEditHistory<string>(), step("r-1", "a", "b"));
		history = pushDataTableEdit(history, step("r-1", "b", "c"));

		const first = undoDataTableEdit(history);
		const second = first === null ? null : undoDataTableEdit(first.history);

		expect(first?.step.value).toBe("b");
		expect(second?.step.value).toBe("a");
		expect(second === null ? null : undoDataTableEdit(second.history)).toBeNull();
	});

	it("forgets what was undone once a new edit is made", () => {
		const history = pushDataTableEdit(createDataTableEditHistory<string>(), step("r-1", "a", "b"));
		const undone = undoDataTableEdit(history);
		const afterNewEdit = undone === null ? history : pushDataTableEdit(undone.history, step("r-2", "x", "y"));
		expect(redoDataTableEdit(afterNewEdit)).toBeNull();
	});

	it("keeps only the newest edits past its limit", () => {
		const limit = 2;
		let history = createDataTableEditHistory<string>();
		for (const value of ["b", "c", "d"]) {
			history = pushDataTableEdit(history, step("r-1", "?", value), limit);
		}
		expect(history.past.map((entry) => entry.value)).toEqual(["c", "d"]);
	});
});
