import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { AccessibilityInfo, Text, type ViewInstance } from "react-native";

import { moveSortableItem, Sortable, SortableItem, SortableItemHandle, sortableTargetAt } from "../sortable";

interface Track {
	readonly id: string;
	readonly title: string;
}

const TRACKS: readonly Track[] = [
	{ id: "a", title: "Intro" },
	{ id: "b", title: "Verse" },
	{ id: "c", title: "Chorus" },
];

function getItemValue(track: Track): string {
	return track.id;
}

function Playlist({
	onCommit,
	strategy,
}: {
	readonly onCommit?: (value: readonly Track[]) => void;
	readonly strategy?: "vertical" | "horizontal" | "grid";
}): React.JSX.Element {
	const [tracks, setTracks] = React.useState<readonly Track[]>(TRACKS);
	return (
		<Sortable value={tracks} onValueChange={setTracks} onValueCommit={onCommit} getItemValue={getItemValue} strategy={strategy} testID="list">
			{tracks.map((track: Track): React.JSX.Element => (
				<SortableItem key={track.id} value={track.id} label={track.title} testID={`item-${track.id}`}>
					<SortableItemHandle testID={`handle-${track.id}`}>
						<Text>grip</Text>
					</SortableItemHandle>
					<Text>{track.title}</Text>
				</SortableItem>
			))}
		</Sortable>
	);
}

/** The titles in the order on screen. */
function order(): readonly string[] {
	return screen.getAllByText(/Intro|Verse|Chorus/u).map((node): string => String(node.props.children));
}

/** A responder event with the touch history PanResponder reads its gesture from. */
function touchAt(y: number, timestamp: number): object {
	const touch = {
		touchActive: true,
		startPageX: 0,
		startPageY: 0,
		startTimeStamp: 0,
		currentPageX: 0,
		currentPageY: y,
		currentTimeStamp: timestamp,
		previousPageX: 0,
		previousPageY: 0,
		previousTimeStamp: 0,
	};
	return {
		nativeEvent: { touches: [{ pageX: 0, pageY: y }], changedTouches: [], timestamp, pageX: 0, pageY: y },
		touchHistory: { indexOfSingleActiveTouch: 0, mostRecentTimeStamp: timestamp, numberActiveTouches: 1, touchBank: [touch] },
	};
}

const ROW_HEIGHT = 40;

function idOf(id: string): string {
	return id;
}

describe("moveSortableItem", () => {
	it("moves one item, and leaves the list as it was for no move or an index out of range", () => {
		expect(moveSortableItem(["a", "b", "c"], 0, 2)).toStrictEqual(["b", "c", "a"]);
		const same = ["a", "b"];
		expect(moveSortableItem(same, 1, 1)).toBe(same);
		expect(moveSortableItem(same, 0, 5)).toBe(same);
	});
});

describe("sortableTargetAt", () => {
	it("picks the box under the point, else the nearest centre", () => {
		const rects = new Map([
			["a", { x: 0, y: 0, width: 100, height: 40 }],
			["b", { x: 0, y: 40, width: 100, height: 40 }],
		]);
		expect(sortableTargetAt(rects, { x: 50, y: 60 })).toBe("b");
		expect(sortableTargetAt(rects, { x: 50, y: 200 })).toBe("b");
	});
});

describe("Sortable", () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("names each handle for its item, and moves an item with a screen reader's actions, announcing where it went", async () => {
		const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation((): void => undefined);
		const onCommit = jest.fn();
		await render(<Playlist onCommit={onCommit} />);
		const handle = screen.getByRole("adjustable", { name: "Reorder Intro" });
		await fireEvent(handle, "accessibilityAction", { nativeEvent: { actionName: "down" } });
		expect(order()).toStrictEqual(["Verse", "Intro", "Chorus"]);
		expect(announce).toHaveBeenCalledWith("Moved Intro to position 2 of 3");
		expect(onCommit).toHaveBeenCalledWith([TRACKS.at(1), TRACKS.at(0), TRACKS.at(2)], { id: "a", activeIndex: 0, overIndex: 1 });
		await fireEvent(screen.getByRole("adjustable", { name: "Reorder Chorus" }), "accessibilityAction", { nativeEvent: { actionName: "start" } });
		expect(order()).toStrictEqual(["Chorus", "Verse", "Intro"]);
		// Nothing above the first item: the order holds.
		await fireEvent(screen.getByRole("adjustable", { name: "Reorder Chorus" }), "accessibilityAction", { nativeEvent: { actionName: "up" } });
		expect(order()).toStrictEqual(["Chorus", "Verse", "Intro"]);
	});

	it("drags an item by its handle onto another's place, outlining the target on the way", async () => {
		await render(<Playlist />);
		for (const [index, track] of TRACKS.entries()) {
			await fireEvent(screen.getByTestId(`item-${track.id}`), "layout", { nativeEvent: { layout: { x: 0, y: index * ROW_HEIGHT, width: 300, height: ROW_HEIGHT } } });
		}
		const handle = screen.getByTestId("handle-a");
		await act(async (): Promise<void> => {
			await fireEvent(handle, "responderGrant", touchAt(0, 1));
			await fireEvent(handle, "responderMove", touchAt(ROW_HEIGHT * 2, 2));
		});
		expect(String(screen.getByTestId("item-c").props.className)).toContain("border-primary");
		await act(async (): Promise<void> => {
			await fireEvent(handle, "responderRelease", touchAt(ROW_HEIGHT * 2, 3));
		});
		expect(order()).toStrictEqual(["Verse", "Chorus", "Intro"]);
	});

	it("forwards its ref and merges className last", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(
			<Sortable ref={ref} value={["a"]} onValueChange={jest.fn()} getItemValue={idOf} className="gap-2" testID="list">
				<SortableItem value="a">
					<Text>A</Text>
				</SortableItem>
			</Sortable>,
		);
		expect(ref.current).not.toBeNull();
		expect(String(screen.getByTestId("list").props.className).split(" ").at(-1)).toBe("gap-2");
	});

	/** A touch `x` points to the right, as the responder system records it. */
	function touchAtX(x: number, timestamp: number): object {
		const touch = {
			touchActive: true,
			startPageX: 0,
			startPageY: 0,
			startTimeStamp: 0,
			currentPageX: x,
			currentPageY: 0,
			currentTimeStamp: timestamp,
			previousPageX: 0,
			previousPageY: 0,
			previousTimeStamp: 0,
		};
		return {
			nativeEvent: { touches: [{ pageX: x, pageY: 0 }], changedTouches: [], timestamp, pageX: x, pageY: 0 },
			touchHistory: { indexOfSingleActiveTouch: 0, mostRecentTimeStamp: timestamp, numberActiveTouches: 1, touchBank: [touch] },
		};
	}

	it("drags along a row with the horizontal strategy", async () => {
		const onCommit = jest.fn();
		await render(<Playlist onCommit={onCommit} strategy="horizontal" />);
		for (const [index, track] of TRACKS.entries()) {
			await fireEvent(screen.getByTestId(`item-${track.id}`), "layout", { nativeEvent: { layout: { x: index * 100, y: 0, width: 100, height: ROW_HEIGHT } } });
		}
		const handle = screen.getByRole("adjustable", { name: "Reorder Intro" });
		await act(async (): Promise<void> => {
			await fireEvent(handle, "responderGrant", touchAtX(0, 1));
			await fireEvent(handle, "responderMove", touchAtX(110, 2));
			await fireEvent(handle, "responderRelease", touchAtX(110, 3));
		});
		expect(order()).toStrictEqual(["Verse", "Intro", "Chorus"]);
		expect(onCommit).toHaveBeenCalledTimes(1);

		await fireEvent(handle, "accessibilityAction", { nativeEvent: { actionName: "up" } });
		expect(order()).toStrictEqual(["Intro", "Verse", "Chorus"]);
	});

	it("does nothing for a drag before layout, a drop in place, a move past the start, or an unknown action", async () => {
		const onCommit = jest.fn();
		await render(<Playlist onCommit={onCommit} strategy="grid" />);
		const handle = screen.getByTestId("handle-a");
		await act(async (): Promise<void> => {
			await fireEvent(handle, "responderGrant", touchAt(0, 1));
			await fireEvent(handle, "responderMove", touchAt(ROW_HEIGHT, 2));
			await fireEvent(handle, "responderRelease", touchAt(ROW_HEIGHT, 3));
		});
		await act(async (): Promise<void> => {
			await fireEvent(handle, "responderGrant", touchAt(0, 4));
			await fireEvent(handle, "responderTerminate", touchAt(0, 5));
		});
		await fireEvent(handle, "accessibilityAction", { nativeEvent: { actionName: "up" } });
		await fireEvent(handle, "accessibilityAction", { nativeEvent: { actionName: "start" } });
		await fireEvent(handle, "accessibilityAction", { nativeEvent: { actionName: "spin" } });
		expect(onCommit).not.toHaveBeenCalled();
		expect(order()).toStrictEqual(["Intro", "Verse", "Chorus"]);
	});

	it("keeps the first of two equally near boxes", () => {
		const rects = new Map([
			["left", { x: 0, y: 0, width: 10, height: 10 }],
			["right", { x: 30, y: 0, width: 10, height: 10 }],
		]);
		expect(sortableTargetAt(rects, { x: 20, y: 5 })).toBe("left");
	});

	it("refuses an item outside a Sortable and a handle outside an item", async () => {
		jest.spyOn(console, "error").mockImplementation((): void => undefined);
		await expect(render(<SortableItem value="a">{null}</SortableItem>)).rejects.toThrow("must be inside");
		await expect(
			render(
				<Sortable value={TRACKS} onValueChange={jest.fn()} getItemValue={getItemValue}>
					<SortableItemHandle>
						<Text>grip</Text>
					</SortableItemHandle>
				</Sortable>,
			),
		).rejects.toThrow("SortableItemHandle must be inside a SortableItem");
	});
});
