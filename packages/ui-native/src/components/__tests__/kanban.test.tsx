import type { KanbanValue } from "@workspace/ui-kit-logic";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { AccessibilityInfo, Text, View, type ViewInstance } from "react-native";

import { Kanban, KanbanBoard, KanbanColumn, KanbanColumnContent, KanbanColumnHandle, kanbanDropTargetAt, KanbanItem, KanbanItemHandle } from "../kanban";

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
};

const COLUMN_NAMES: Readonly<Record<string, string>> = { todo: "To do", doing: "Doing" };

function getCardId(card: Card): string {
	return card.id;
}

function Board({ onCommit }: { readonly onCommit?: (value: KanbanValue<Card>) => void }): React.JSX.Element {
	const [board, setBoard] = React.useState<KanbanValue<Card>>(BOARD);
	return (
		<Kanban value={board} onValueChange={setBoard} onValueCommit={onCommit} getItemValue={getCardId}>
			<KanbanBoard>
				{Object.entries(board).map(([column, cards]: [string, Card[]]): React.JSX.Element => (
					<KanbanColumn key={column} value={column} label={COLUMN_NAMES[column]} testID={`column-${column}`}>
						<KanbanColumnHandle>
							<Text>{COLUMN_NAMES[column]}</Text>
						</KanbanColumnHandle>
						<KanbanColumnContent>
							{cards.map((card: Card): React.JSX.Element => (
								<KanbanItem key={card.id} value={card.id} label={card.title}>
									<KanbanItemHandle testID={`handle-${card.id}`}>
										<Text>{card.title}</Text>
									</KanbanItemHandle>
								</KanbanItem>
							))}
						</KanbanColumnContent>
					</KanbanColumn>
				))}
			</KanbanBoard>
		</Kanban>
	);
}

/** The card titles in a column, in order. */
function cardsIn(column: string): readonly string[] {
	return screen
		.getAllByLabelText(/^Move (Write spec|Review|Build)$/u)
		.filter((handle): boolean => {
			let node = handle.parent;
			while (node !== null && node.props.testID !== `column-${column}`) {
				node = node.parent;
			}
			return node !== null;
		})
		.map((handle): string => String(handle.props.accessibilityLabel).replace("Move ", ""));
}

/** A responder event with the touch history PanResponder reads its gesture from. */
function touchAt(timestamp: number): object {
	const touch = {
		touchActive: true,
		startPageX: 0,
		startPageY: 0,
		startTimeStamp: 0,
		currentPageX: 0,
		currentPageY: 0,
		currentTimeStamp: timestamp,
		previousPageX: 0,
		previousPageY: 0,
		previousTimeStamp: 0,
	};
	return {
		nativeEvent: { touches: [{ pageX: 0, pageY: 0 }], changedTouches: [], timestamp, pageX: 0, pageY: 0 },
		touchHistory: { indexOfSingleActiveTouch: 0, mostRecentTimeStamp: timestamp, numberActiveTouches: 1, touchBank: [touch] },
	};
}

describe("kanbanDropTargetAt", () => {
	it("lands on another card first, else a column, never on the card itself", () => {
		const items = new Map([
			["t1", { x: 0, y: 0, width: 100, height: 40 }],
			["t2", { x: 0, y: 40, width: 100, height: 40 }],
		]);
		const columns = new Map([
			["todo", { x: 0, y: 0, width: 100, height: 200 }],
			["doing", { x: 120, y: 0, width: 100, height: 200 }],
		]);
		expect(kanbanDropTargetAt(items, columns, "t1", { x: 50, y: 60 })).toBe("t2");
		expect(kanbanDropTargetAt(items, columns, "t1", { x: 50, y: 20 })).toBe("todo");
		expect(kanbanDropTargetAt(items, columns, "t1", { x: 150, y: 150 })).toBe("doing");
		expect(kanbanDropTargetAt(items, columns, "t1", { x: 500, y: 500 })).toBeNull();
	});
});

describe("Kanban", () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("moves a card to another column with a screen reader's action, and announces it", async () => {
		const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation((): void => undefined);
		const onCommit = jest.fn();
		await render(<Board onCommit={onCommit} />);
		await fireEvent(screen.getByRole("adjustable", { name: "Move Write spec" }), "accessibilityAction", { nativeEvent: { actionName: "column:doing" } });
		expect(cardsIn("doing")).toStrictEqual(["Build", "Write spec"]);
		expect(cardsIn("todo")).toStrictEqual(["Review"]);
		expect(announce).toHaveBeenCalledWith("Moved Write spec to Doing");
		expect(onCommit).toHaveBeenCalledTimes(1);
	});

	it("moves a card up and down within its column", async () => {
		jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation((): void => undefined);
		await render(<Board />);
		await fireEvent(screen.getByRole("adjustable", { name: "Move Review" }), "accessibilityAction", { nativeEvent: { actionName: "up" } });
		expect(cardsIn("todo")).toStrictEqual(["Review", "Write spec"]);
		// Nothing above the first card: the column holds.
		await fireEvent(screen.getByRole("adjustable", { name: "Move Review" }), "accessibilityAction", { nativeEvent: { actionName: "up" } });
		expect(cardsIn("todo")).toStrictEqual(["Review", "Write spec"]);
	});

	it("moves a column left and right, announcing its new place", async () => {
		const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation((): void => undefined);
		await render(<Board />);
		await fireEvent(screen.getByRole("adjustable", { name: "Move the Doing column" }), "accessibilityAction", { nativeEvent: { actionName: "left" } });
		expect(announce).toHaveBeenCalledWith("Moved the Doing column to position 1 of 2");
		expect(screen.getAllByRole("adjustable", { name: /column$/u }).map((handle): string => String(handle.props.accessibilityLabel))).toStrictEqual([
			"Move the Doing column",
			"Move the To do column",
		]);
	});

	it("leaves the board as it was when a drag is let go over nothing", async () => {
		await render(<Board />);
		const handle = screen.getByTestId("handle-t1");
		await act(async (): Promise<void> => {
			await fireEvent(handle, "responderGrant", touchAt(1));
			await fireEvent(handle, "responderRelease", touchAt(2));
		});
		expect(cardsIn("todo")).toStrictEqual(["Write spec", "Review"]);
	});

	it("forwards its ref", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(
			<Kanban ref={ref} value={BOARD} onValueChange={jest.fn()} getItemValue={getCardId}>
				<Text>board</Text>
			</Kanban>,
		);
		expect(ref.current).not.toBeNull();
	});

	describe("dragging by hand", () => {
		/** A touch at (x, y), as the responder system records it once the finger has moved there. */
		function touchAtPoint(x: number, y: number, timestamp: number): object {
			const touch = {
				touchActive: true,
				startPageX: 0,
				startPageY: 0,
				startTimeStamp: 0,
				currentPageX: x,
				currentPageY: y,
				currentTimeStamp: timestamp,
				previousPageX: 0,
				previousPageY: 0,
				previousTimeStamp: 0,
			};
			return {
				nativeEvent: { touches: [{ pageX: x, pageY: y }], changedTouches: [{ pageX: x, pageY: y }], timestamp, pageX: x, pageY: y },
				touchHistory: { indexOfSingleActiveTouch: 0, mostRecentTimeStamp: timestamp, numberActiveTouches: 1, touchBank: [touch] },
			};
		}

		/** Where layout puts the cards (t1, t2, d1) and then the columns (todo, doing), in the order the board measures them. */
		const BOXES: readonly (readonly [number, number, number, number])[] = [
			[0, 0, 100, 40],
			[0, 40, 100, 40],
			[120, 0, 100, 40],
			[0, 0, 100, 200],
			[120, 0, 100, 200],
		];

		/**
		 * Measures the board's views from BOXES, over and over (each drag start measures them all again). Jest's
		 * React Native mocks `measureInWindow` on the host View's prototype; a probe view reaches it. Call it before
		 * rendering the board: rendering the probe replaces whatever is on the screen.
		 */
		async function mockLayout(): Promise<void> {
			const probe = React.createRef<ViewInstance>();
			await render(<View ref={probe} />);
			const prototype = Reflect.getPrototypeOf(probe.current ?? {}) ?? {};
			const original = Reflect.getOwnPropertyDescriptor(prototype, "measureInWindow");
			let call = 0;
			Reflect.defineProperty(prototype, "measureInWindow", {
				configurable: true,
				writable: true,
				value: (callback: (x: number, y: number, width: number, height: number) => void): void => {
					const [x = 0, y = 0, width = 0, height = 0] = BOXES.at(call % BOXES.length) ?? [];
					call += 1;
					callback(x, y, width, height);
				},
			});
			restoreLayout = (): void => {
				if (original !== undefined) {
					Reflect.defineProperty(prototype, "measureInWindow", original);
				}
			};
		}

		/** Puts React Native's own `measureInWindow` back after each drag test. */
		let restoreLayout = (): void => undefined;

		afterEach((): void => {
			restoreLayout();
			restoreLayout = (): void => undefined;
		});

		it("drops a dragged card on the card it is over, in that card's column", async () => {
			const onCommit = jest.fn();
			await mockLayout();
			await render(<Board onCommit={onCommit} />);
			const handle = screen.getByTestId("handle-t1");

			await act(async (): Promise<void> => {
				await fireEvent(handle, "responderGrant", touchAtPoint(10, 10, 1));
			});
			await act(async (): Promise<void> => {
				await fireEvent(handle, "responderMove", touchAtPoint(170, 20, 2));
			});
			await act(async (): Promise<void> => {
				await fireEvent(handle, "responderRelease", touchAtPoint(170, 20, 3));
			});

			expect(onCommit).toHaveBeenCalledTimes(1);
			expect(cardsIn("doing")).toContain("Write spec");
		});

		it("drops a dragged column on the column it is over", async () => {
			const onCommit = jest.fn();
			await mockLayout();
			await render(<Board onCommit={onCommit} />);
			const handle = screen.getByRole("adjustable", { name: "Move the Doing column" });

			await act(async (): Promise<void> => {
				await fireEvent(handle, "responderGrant", touchAtPoint(170, 10, 1));
			});
			await act(async (): Promise<void> => {
				await fireEvent(handle, "responderMove", touchAtPoint(50, 150, 2));
			});
			await act(async (): Promise<void> => {
				await fireEvent(handle, "responderRelease", touchAtPoint(50, 150, 3));
			});

			expect(onCommit).toHaveBeenCalledWith(BOARD, { kind: "column", id: "doing", overId: "todo" });
			expect(screen.getAllByRole("adjustable", { name: /column$/u }).map((item): string => String(item.props.accessibilityLabel))).toStrictEqual([
				"Move the Doing column",
				"Move the To do column",
			]);
		});

		it("puts everything back when the system takes the gesture away", async () => {
			const onCommit = jest.fn();
			await mockLayout();
			await render(<Board onCommit={onCommit} />);
			const handle = screen.getByTestId("handle-t1");

			await act(async (): Promise<void> => {
				await fireEvent(handle, "responderGrant", touchAtPoint(10, 10, 1));
				await fireEvent(handle, "responderMove", touchAtPoint(170, 20, 2));
				await fireEvent(handle, "responderTerminate", touchAtPoint(170, 20, 3));
			});

			expect(onCommit).not.toHaveBeenCalled();
			expect(cardsIn("todo")).toStrictEqual(["Write spec", "Review"]);
		});
	});

	it("does nothing for a move past either end", async () => {
		const onCommit = jest.fn();
		await render(<Board onCommit={onCommit} />);
		await fireEvent(screen.getByRole("adjustable", { name: "Move the To do column" }), "accessibilityAction", { nativeEvent: { actionName: "left" } });
		await fireEvent(screen.getByRole("adjustable", { name: "Move the Doing column" }), "accessibilityAction", { nativeEvent: { actionName: "right" } });
		await fireEvent(screen.getByRole("adjustable", { name: "Move Write spec" }), "accessibilityAction", { nativeEvent: { actionName: "up" } });
		expect(onCommit).not.toHaveBeenCalled();
	});

	it("refuses its parts outside the board, a card or a column", async () => {
		const error = jest.spyOn(console, "error").mockImplementation((): void => undefined);
		await expect(render(<KanbanColumn value="todo">{null}</KanbanColumn>)).rejects.toThrow("must be inside a Kanban");
		await expect(
			render(
				<Kanban value={BOARD} onValueChange={jest.fn()} getItemValue={getCardId}>
					<KanbanItemHandle>
						<Text>Grip</Text>
					</KanbanItemHandle>
				</Kanban>,
			),
		).rejects.toThrow("KanbanItemHandle must be inside a KanbanItem");
		await expect(
			render(
				<Kanban value={BOARD} onValueChange={jest.fn()} getItemValue={getCardId}>
					<KanbanColumnHandle>
						<Text>Grip</Text>
					</KanbanColumnHandle>
				</Kanban>,
			),
		).rejects.toThrow("KanbanColumnHandle must be inside a KanbanColumn");
		error.mockRestore();
	});

	it("names unlabelled cards and columns by their ids", async () => {
		function idOf(id: string): string {
			return id;
		}
		const board: KanbanValue<string> = { todo: ["t1", "t2"], done: [] };
		await render(
			<Kanban value={board} onValueChange={jest.fn()} getItemValue={idOf}>
				<KanbanBoard>
					{Object.entries(board).map(([column, ids]: [string, string[]]): React.JSX.Element => (
						<KanbanColumn key={column} value={column}>
							<KanbanColumnHandle>
								<Text>{column}</Text>
							</KanbanColumnHandle>
							<KanbanColumnContent>
								{ids.map((id: string): React.JSX.Element => (
									<KanbanItem key={id} value={id}>
										<KanbanItemHandle>
											<Text>{id}</Text>
										</KanbanItemHandle>
									</KanbanItem>
								))}
							</KanbanColumnContent>
						</KanbanColumn>
					))}
				</KanbanBoard>
			</Kanban>,
		);
		expect(screen.getByRole("adjustable", { name: "Move t1" })).toBeOnTheScreen();
		expect(screen.getByRole("adjustable", { name: "Move the todo column" })).toBeOnTheScreen();
		await fireEvent(screen.getByRole("adjustable", { name: "Move t2" }), "accessibilityAction", { nativeEvent: { actionName: "down" } });
		expect(screen.getAllByRole("adjustable", { name: /^Move t\d$/u }).map((handle): string => String(handle.props.accessibilityLabel))).toStrictEqual(["Move t1", "Move t2"]);
	});
});
