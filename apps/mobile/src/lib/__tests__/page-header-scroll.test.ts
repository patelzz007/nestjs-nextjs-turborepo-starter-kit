import { headerProgressOf, headerScrollPositionOf, PAGE_HEADER_SYNC_TIMING } from "../page-header-scroll";

describe("headerProgressOf", () => {
	it("runs from expanded at the top to collapsed after the subtitle line's height", () => {
		expect(headerProgressOf(0, 36)).toBe(0);
		expect(headerProgressOf(18, 36)).toBe(0.5);
		expect(headerProgressOf(36, 36)).toBe(1);
		expect(headerProgressOf(400, 36)).toBe(1);
	});

	it("stays expanded above the top, and never divides by an unmeasured line", () => {
		expect(headerProgressOf(-40, 36)).toBe(0);
		expect(headerProgressOf(0, 0)).toBe(0);
		expect(headerProgressOf(5, 0)).toBe(1);
	});
});

describe("headerScrollPositionOf", () => {
	it("is the scroll offset, but never above the top (a pull to refresh keeps the header expanded)", () => {
		expect(headerScrollPositionOf(120)).toBe(120);
		expect(headerScrollPositionOf(-64)).toBe(0);
	});
});

describe("PAGE_HEADER_SYNC_TIMING", () => {
	it("catches the header up quickly with a newly focused page", () => {
		expect(PAGE_HEADER_SYNC_TIMING.duration).toBe(220);
	});
});
