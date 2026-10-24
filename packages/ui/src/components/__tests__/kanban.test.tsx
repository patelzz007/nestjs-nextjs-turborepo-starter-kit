// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import * as React from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_KIT_LABELS_EN } from "../../lib/labels/en";
import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";
import {
	findKanbanItem,
	Kanban,
	KanbanBoard,
	KanbanColumn,
	KanbanColumnContent,
	KanbanColumnHandle,
	KanbanItem,
	KanbanItemHandle,
	KanbanOverlay,
	moveKanbanItem,
	reorderKanbanColumns,
	type KanbanRootProps,
	type KanbanValue,
} from "../kanban";

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
const LABELS = UI_KIT_LABELS_EN.kanban;
/** Stubbed layout: items stacked in one column, this many px apart. */
const ROW_HEIGHT = 40;
const ROW_WIDTH = 200;

function getCardId(card: Card): string {
	return card.id;
}

function noop(): void {
	// a handler the test does not observe
}

function idsByColumn(value: KanbanValue<Card>): Record<string, string[]> {
	return Object.fromEntries(Object.entries(value).map(([key, cards]): [string, string[]] => [key, cards.map(getCardId)]));
}

function board(overrides: Partial<KanbanRootProps<Card>> = {}): React.JSX.Element {
	return (
		<Kanban<Card> value={BOARD} onValueChange={noop} getItemValue={getCardId} {...overrides}>
			<KanbanBoard>
				{Object.entries(BOARD).map(([columnId, cards]): React.JSX.Element => (
					<KanbanColumn key={columnId} value={columnId} disabled={columnId === "done"}>
						<KanbanColumnHandle aria-label={`Move column ${columnId}`}>{columnId}</KanbanColumnHandle>
						<KanbanColumnContent value={columnId}>
							{cards.map((card): React.JSX.Element => (
								<KanbanItem key={card.id} value={card.id}>
									<KanbanItemHandle aria-label={`Drag ${card.title}`}>{card.title}</KanbanItemHandle>
								</KanbanItem>
							))}
						</KanbanColumnContent>
					</KanbanColumn>
				))}
			</KanbanBoard>
			<KanbanOverlay />
		</Kanban>
	);
}

function renderBoard(overrides: Partial<KanbanRootProps<Card>> = {}): void {
	render(board(overrides), { wrapper: UiKitTestProviders });
}

/** jsdom has no layout: stack the `todo` items so the keyboard sensor can move between them. */
function stubTodoLayout(): void {
	const order = ["t1", "t2"];
	vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function stubRect(this: HTMLElement): DOMRect {
		const item = this.closest<HTMLElement>("[data-slot=kanban-item]");
		const index = item === null ? 0 : order.indexOf(item.dataset.value ?? "");
		return new DOMRect(0, Math.max(index, 0) * ROW_HEIGHT, ROW_WIDTH, ROW_HEIGHT);
	});
}

async function flushTasks(): Promise<void> {
	await act(async (): Promise<void> => {
		await new Promise<void>((resolve): void => {
			setTimeout(resolve, 0);
		});
	});
}

afterEach((): void => {
	cleanup();
	vi.restoreAllMocks();
});

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

describe("Kanban", () => {
	it("renders the board, columns, items and handles with their slots", (): void => {
		renderBoard();
		const item = screen.getByLabelText("Drag Build").closest<HTMLElement>("[data-slot=kanban-item]");
		expect(item?.dataset.value).toBe("d1");
		expect(item?.closest<HTMLElement>("[data-slot=kanban-column]")?.dataset.value).toBe("doing");
		expect(item?.closest("[data-slot=kanban-column-content]")).not.toBeNull();
		expect(item?.closest("[data-slot=kanban-board]")).not.toBeNull();
		expect(item?.closest("[data-slot=kanban]")).not.toBeNull();
		expect(screen.getByLabelText("Move column todo").getAttribute("aria-roledescription")).toBe("sortable");
	});

	it("tells screen-reader users how to drag, from the kit labels", (): void => {
		renderBoard();
		expect(screen.getByText(LABELS.instructions)).toBeTruthy();
	});

	it("marks a disabled column with the disabled state", (): void => {
		renderBoard();
		const column = screen.getByLabelText("Move column done").closest<HTMLElement>("[data-slot=kanban-column]");
		expect(column?.dataset.disabled).toBe("");
		expect(column?.className).toContain("opacity-50");
	});

	it("hydrates the server's markup without a mismatch", async (): Promise<void> => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(noop);
		const tree = <UiKitTestProviders>{board()}</UiKitTestProviders>;
		const container = document.createElement("div");
		container.innerHTML = renderToString(tree);
		document.body.append(container);

		const root = await act((): Root => hydrateRoot(container, tree));

		expect(consoleError).not.toHaveBeenCalled();
		act((): void => {
			root.unmount();
		});
		container.remove();
	});

	it("keeps a locked column and item live: fixed in place, but not drawn as disabled", (): void => {
		render(
			<Kanban<Card> value={BOARD} onValueChange={noop} getItemValue={getCardId}>
				<KanbanBoard>
					<KanbanColumn value="todo" locked>
						<KanbanColumnContent value="todo">
							<KanbanItem value="t1" locked>
								<KanbanItemHandle aria-label="Drag Write spec">Write spec</KanbanItemHandle>
							</KanbanItem>
						</KanbanColumnContent>
					</KanbanColumn>
				</KanbanBoard>
			</Kanban>,
			{ wrapper: UiKitTestProviders },
		);
		const column = screen.getByText("Write spec").closest<HTMLElement>("[data-slot=kanban-column]");
		const item = screen.getByText("Write spec").closest<HTMLElement>("[data-slot=kanban-item]");

		for (const part of [column, item]) {
			expect(part?.dataset.locked).toBe("");
			expect(part?.dataset.disabled).toBeUndefined();
			expect(part?.className).not.toContain("opacity-50");
		}
		expect(item?.getAttribute("aria-disabled")).toBe("true");
	});

	it("reorders a column's items with the keyboard sensor", async (): Promise<void> => {
		stubTodoLayout();
		const onValueChange = vi.fn<(value: KanbanValue<Card>) => void>();
		const onValueCommit = vi.fn<() => void>();
		renderBoard({ onValueChange, onValueCommit });

		fireEvent.keyDown(screen.getByLabelText("Drag Write spec"), { code: "Space", key: " " });
		await flushTasks();
		fireEvent.keyDown(document, { code: "ArrowDown", key: "ArrowDown" });
		await flushTasks();
		fireEvent.keyDown(document, { code: "Space", key: " " });
		await flushTasks();

		const next = onValueChange.mock.calls.at(-1)?.[LIST_SLOT_INDEX.first];
		expect(next === undefined ? null : idsByColumn(next).todo).toEqual(["t2", "t1"]);
		expect(onValueCommit).toHaveBeenCalledTimes(1);
	});

	it("throws a descriptive error for a column missing from the value", (): void => {
		vi.spyOn(console, "error").mockImplementation(noop);
		expect((): void => {
			render(
				<Kanban<Card> value={BOARD} onValueChange={noop} getItemValue={getCardId}>
					<KanbanColumnContent value="archived" />
				</Kanban>,
				{ wrapper: UiKitTestProviders },
			);
		}).toThrow(/column "archived" was not found/);
	});

	it("forwards refs and merges className last on every part", (): void => {
		const refs = {
			root: React.createRef<HTMLDivElement>(),
			board: React.createRef<HTMLDivElement>(),
			column: React.createRef<HTMLDivElement>(),
			columnHandle: React.createRef<HTMLDivElement>(),
			content: React.createRef<HTMLDivElement>(),
			item: React.createRef<HTMLDivElement>(),
			itemHandle: React.createRef<HTMLDivElement>(),
		};
		render(
			<Kanban<Card> ref={refs.root} value={BOARD} onValueChange={noop} getItemValue={getCardId} className="extra">
				<KanbanBoard ref={refs.board} className="extra">
					<KanbanColumn ref={refs.column} value="doing" className="extra">
						<KanbanColumnHandle ref={refs.columnHandle} className="extra" />
						<KanbanColumnContent ref={refs.content} value="doing" className="extra">
							<KanbanItem ref={refs.item} value="d1" className="extra">
								<KanbanItemHandle ref={refs.itemHandle} className="extra" />
							</KanbanItem>
						</KanbanColumnContent>
					</KanbanColumn>
				</KanbanBoard>
			</Kanban>,
			{ wrapper: UiKitTestProviders },
		);
		const all = Object.values(refs);
		expect(all.map((ref) => ref.current?.dataset.slot)).toEqual([
			"kanban",
			"kanban-board",
			"kanban-column",
			"kanban-column-handle",
			"kanban-column-content",
			"kanban-item",
			"kanban-item-handle",
		]);
		for (const ref of all) {
			expect(ref.current?.className).toMatch(/extra$/);
		}
	});
});
