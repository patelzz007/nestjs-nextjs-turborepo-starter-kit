import {
	anchorOffset,
	anchorSpacer,
	currentAnchor,
	isNearEnd,
	maxScrollOffset,
	openingOffset,
	readingPosition,
	readingShift,
	scrollableFrom,
	visibilityOf,
	visibleMessages,
	type MessageLayout,
} from "../message-scroller";

const LAYOUTS: readonly MessageLayout[] = [
	{ id: "q1", y: 0, height: 100, anchor: true },
	{ id: "a1", y: 132, height: 300, anchor: false },
	{ id: "q2", y: 464, height: 100, anchor: true },
	{ id: "a2", y: 596, height: 200, anchor: false },
];
const METRICS = { offset: 0, viewport: 400, content: 796 };

describe("the MessageScroller's scroll maths", () => {
	it("knows the furthest offset and whether the reader is at either edge", () => {
		expect(maxScrollOffset(METRICS)).toBe(396);
		expect(maxScrollOffset({ ...METRICS, content: 100 })).toBe(0);
		expect(isNearEnd({ ...METRICS, offset: 380 }, 24)).toBe(true);
		expect(isNearEnd(METRICS, 24)).toBe(false);
		expect(scrollableFrom(METRICS, 24)).toEqual({ start: false, end: true });
		expect(scrollableFrom({ ...METRICS, offset: 396 }, 24)).toEqual({ start: true, end: false });
	});

	it("lifts a turn to the top under a peek of the one before, within range", () => {
		const [, , q2] = LAYOUTS;
		if (q2 === undefined) {
			throw new Error("The sample has a second question.");
		}
		expect(anchorOffset(q2, METRICS, 64)).toBe(396);
		expect(anchorOffset(q2, { ...METRICS, content: 2000 }, 64)).toBe(400);
		expect(anchorOffset({ id: "top", y: 10, height: 10, anchor: true }, METRICS, 64)).toBe(0);
	});

	it("makes room below the last anchored turn, and none without one", () => {
		expect(anchorSpacer(LAYOUTS, 800, 64)).toBe(800 - 64 - (796 - 464));
		expect(anchorSpacer(LAYOUTS, 300, 64)).toBe(0);
		expect(anchorSpacer([{ id: "a", y: 0, height: 10, anchor: false }], 800, 64)).toBe(0);
		expect(anchorSpacer([], 800, 64)).toBe(0);
	});

	it("lists the messages on screen and the turn the reader is in", () => {
		expect(visibleMessages(LAYOUTS, METRICS)).toEqual(["q1", "a1"]);
		expect(currentAnchor(LAYOUTS, METRICS, 64)).toBe("q1");
		expect(currentAnchor(LAYOUTS, { ...METRICS, offset: 400 }, 64)).toBe("q2");
		expect(currentAnchor([{ id: "a", y: 0, height: 10, anchor: false }], METRICS, 64)).toBeNull();
		expect(visibilityOf(LAYOUTS, { ...METRICS, offset: 420 }, 64)).toEqual({ currentAnchorId: "q2", visibleMessageIds: ["a1", "q2", "a2"] });
	});

	it("remembers the message the reader is on, and measures how far it has moved", () => {
		const reading = readingPosition(LAYOUTS, { ...METRICS, offset: 140 });
		expect(reading).toEqual({ id: "a1", y: 132 });
		const after = [{ id: "old", y: 0, height: 150, anchor: false }, ...LAYOUTS.map((layout) => ({ ...layout, y: layout.y + 182 }))];
		expect(readingShift(reading, after)).toBe(182);
		expect(readingShift(reading, LAYOUTS)).toBe(0);
		expect(readingShift(reading, [])).toBe(0);
		expect(readingShift(null, LAYOUTS)).toBe(0);
		expect(readingPosition([], METRICS)).toBeNull();
	});

	it("opens at the start, the end, or the last anchored turn", () => {
		expect(openingOffset("start", LAYOUTS, METRICS, 64)).toBe(0);
		expect(openingOffset("end", LAYOUTS, METRICS, 64)).toBe(396);
		expect(openingOffset("last-anchor", LAYOUTS, { ...METRICS, content: 2000 }, 64)).toBe(400);
		expect(openingOffset("last-anchor", [{ id: "a", y: 0, height: 10, anchor: false }], METRICS, 64)).toBe(396);
	});
});
