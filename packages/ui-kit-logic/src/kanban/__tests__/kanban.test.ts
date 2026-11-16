import { describe, expect, it } from "vitest";

import { findKanbanItem, moveKanbanItem, reorderKanbanColumns, type KanbanValue } from "../kanban";

interface Card {
	readonly id: string;
	readonly title: string;
}

const BOARD: KanbanValue<Card> = {
	todo: [
		{ id: "t1", title: "Write spec" },
		{ id: "t2", title: "Review" },
	],
	doing: [{ id: "d1", title: "Build" }],
	done: [],
};

function getCardId(card: Card): string {
	return card.id;
}

/** The board as card ids per column. */
function idsByColumn(value: KanbanValue<Card>): Record<string, string[]> {
	return Object.fromEntries(Object.entries(value).map(([key, cards]): [string, string[]] => [key, cards.map(getCardId)]));
}

describe("Kanban move logic", () => {
	it("finds an item's column and index", (): void => {
		expect(findKanbanItem(BOARD, getCardId, "t2")).toEqual({ container: "todo", index: 1 });
		expect(findKanbanItem(BOARD, getCardId, "missing")).toBeUndefined();
	});

	it("moves an item onto another column's item, taking its place", (): void => {
		const next = moveKanbanItem(BOARD, getCardId, "t1", "d1");
		expect(next === null ? null : idsByColumn(next)).toEqual({ todo: ["t2"], doing: ["t1", "d1"], done: [] });
	});

	it("appends an item dropped on a column's empty space", (): void => {
		const next = moveKanbanItem(BOARD, getCardId, "t1", "done");
		expect(next === null ? null : idsByColumn(next)).toEqual({ todo: ["t2"], doing: ["d1"], done: ["t1"] });
	});

	it("reorders within a column, and is a no-op on itself", (): void => {
		const next = moveKanbanItem(BOARD, getCardId, "t1", "t2");
		expect(next === null ? null : idsByColumn(next).todo).toEqual(["t2", "t1"]);
		expect(moveKanbanItem(BOARD, getCardId, "t1", "t1")).toBeNull();
		expect(moveKanbanItem(BOARD, getCardId, "missing", "t1")).toBeNull();
	});

	it("reorders columns and keeps their items", (): void => {
		const next = reorderKanbanColumns(BOARD, "done", "todo");
		expect(next === null ? null : Object.keys(next)).toEqual(["done", "todo", "doing"]);
		expect(next?.todo).toBe(BOARD.todo);
		expect(reorderKanbanColumns(BOARD, "todo", "todo")).toBeNull();
	});

	it("never mutates the input board", (): void => {
		const before = idsByColumn(BOARD);
		moveKanbanItem(BOARD, getCardId, "t1", "d1");
		reorderKanbanColumns(BOARD, "done", "todo");
		expect(idsByColumn(BOARD)).toEqual(before);
	});
});
