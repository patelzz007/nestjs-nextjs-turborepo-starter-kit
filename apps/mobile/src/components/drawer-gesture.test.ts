import { isHorizontalDrag, progressWhileClosing, progressWhileOpening, settlesOpen } from "./drawer-gesture";

const PANEL_WIDTH = 300;

describe("progressWhileOpening", () => {
	it.each([
		[0, 0],
		[150, 0.5],
		[300, 1],
		[450, 1],
		[-40, 0],
	])("dragging %i pt from the edge is %f open", (dx, expected) => {
		expect(progressWhileOpening(dx, PANEL_WIDTH)).toBe(expected);
	});
});

describe("progressWhileClosing", () => {
	it.each([
		[0, 1],
		[-150, 0.5],
		[-300, 0],
		[-500, 0],
		[60, 1],
	])("dragging the open panel %i pt is %f open", (dx, expected) => {
		expect(progressWhileClosing(dx, PANEL_WIDTH)).toBe(expected);
	});
});

describe("settlesOpen", () => {
	it("follows a flick whatever the position", () => {
		expect(settlesOpen(0.1, 0.8)).toBe(true);
		expect(settlesOpen(0.9, -0.8)).toBe(false);
	});

	it("otherwise settles on the side of halfway it was released on", () => {
		expect(settlesOpen(0.5, 0)).toBe(true);
		expect(settlesOpen(0.7, 0.2)).toBe(true);
		expect(settlesOpen(0.49, 0)).toBe(false);
		expect(settlesOpen(0.3, -0.2)).toBe(false);
	});
});

describe("isHorizontalDrag", () => {
	it("needs a few points of travel in the given direction, more across than down", () => {
		expect(isHorizontalDrag(12, 3, 1)).toBe(true);
		expect(isHorizontalDrag(-12, 3, -1)).toBe(true);
		expect(isHorizontalDrag(5, 0, 1)).toBe(false);
		expect(isHorizontalDrag(12, 20, 1)).toBe(false);
		expect(isHorizontalDrag(-12, 0, 1)).toBe(false);
	});
});
