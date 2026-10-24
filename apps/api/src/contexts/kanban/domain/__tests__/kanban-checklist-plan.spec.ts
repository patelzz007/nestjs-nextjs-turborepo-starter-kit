import { describe, expect, it } from "vitest";

import { KanbanChecklistItemNotFoundError } from "../errors/kanban.errors";
import { planChecklistReplacement, type KanbanChecklistRow } from "../services/kanban-checklist-plan";

const STORED: readonly KanbanChecklistRow[] = [
	{ id: "r1", title: "Design", depth: 0, isDone: true, assigneeId: null, position: 0 },
	{ id: "r2", title: "Schema", depth: 1, isDone: false, assigneeId: "u1", position: 1 },
	{ id: "r3", title: "Docs", depth: 0, isDone: false, assigneeId: null, position: 2 },
];

function idsFrom(...ids: string[]): () => string {
	let next = 0;
	return (): string => {
		const id = ids.at(next) ?? "unexpected";
		next += 1;
		return id;
	};
}

describe("planChecklistReplacement", () => {
	it("writes nothing when the edit sends the list back unchanged", () => {
		const plan = planChecklistReplacement(STORED, STORED, idsFrom());

		expect(plan).toEqual({ creates: [], updates: [], removals: [], changed: false });
	});

	it("keeps rows by id, creates rows without one, removes rows left out, and renumbers by the new order", () => {
		const plan = planChecklistReplacement(
			STORED,
			[
				{ id: "r3", title: "Docs", depth: 0, isDone: true, assigneeId: null },
				{ title: "Review", depth: 1, isDone: false, assigneeId: "u2" },
				{ id: "r1", title: "Design", depth: 0, isDone: true, assigneeId: null },
			],
			idsFrom("n1"),
		);

		expect(plan.creates).toEqual([{ id: "n1", title: "Review", depth: 1, isDone: false, assigneeId: "u2", position: 1 }]);
		expect(plan.updates).toEqual([
			{ id: "r3", title: "Docs", depth: 0, isDone: true, assigneeId: null, position: 0 },
			{ id: "r1", title: "Design", depth: 0, isDone: true, assigneeId: null, position: 2 },
		]);
		expect(plan.removals).toEqual(["r2"]);
		expect(plan.changed).toBe(true);
	});

	it("refuses a row naming an id the list does not hold", () => {
		expect(() => planChecklistReplacement(STORED, [{ id: "elsewhere", title: "X", depth: 0, isDone: false, assigneeId: null }], idsFrom())).toThrow(
			KanbanChecklistItemNotFoundError,
		);
	});
});
