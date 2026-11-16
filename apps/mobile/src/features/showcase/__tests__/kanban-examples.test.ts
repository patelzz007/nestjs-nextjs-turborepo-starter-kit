import type { KanbanValue } from "@workspace/ui-kit-logic";

import { moveSummaryOf } from "../examples/kanban/kanban-6";
import type { Task } from "../examples/kanban/kanban-sample";

const BOARD: KanbanValue<Task> = {
	todo: [{ id: "1", title: "Write tests", priority: "high" }],
	done: [{ id: "2", title: "Setup project", priority: "low" }],
	archive: [],
};

describe("moveSummaryOf", () => {
	it("names the column a card landed in", () => {
		expect(moveSummaryOf(BOARD, { kind: "item", id: "2", overId: "1" })).toBe('Moved to "Done"');
	});

	it("names a reordered column by its title", () => {
		expect(moveSummaryOf(BOARD, { kind: "column", id: "todo", overId: "done" })).toBe('Reordered "To Do"');
	});

	it("falls back to the drop target, and to a column's key when it has no title", () => {
		expect(moveSummaryOf(BOARD, { kind: "item", id: "missing", overId: "archive" })).toBe('Moved to "archive"');
	});
});
