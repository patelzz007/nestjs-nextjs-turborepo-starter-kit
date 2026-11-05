import { describe, expect, it } from "vitest";

import { readingState, type SectionMark } from "../reading-progress";

const SECTIONS: readonly SectionMark[] = [
	{ slug: "one", top: 1000, words: 200 },
	{ slug: "two", top: 2000, words: 100 },
	{ slug: "three", top: 2500, words: 50 },
];
const ARTICLE = { top: 500, bottom: 3500 };
const VIEWPORT = 1000;

describe("readingState", () => {
	it("should have no active section above the first heading, with everything still ahead", () => {
		expect(readingState(SECTIONS, ARTICLE, 600, VIEWPORT)).toEqual({ activeSlug: null, activeIndex: -1, withinActive: 0, percent: 5, wordsLeft: 350 });
	});

	it("should name the section the reading line is in and how far through it it is", () => {
		const state = readingState(SECTIONS, ARTICLE, 1500, VIEWPORT);
		expect(state.activeSlug).toBe("one");
		expect(state.withinActive).toBe(0.5);
		expect(state.wordsLeft).toBe(250);
		expect(state.percent).toBe(50);
	});

	it("should measure the last section to the article's end and stop at 100%", () => {
		const state = readingState(SECTIONS, ARTICLE, 4000, VIEWPORT);
		expect(state.activeSlug).toBe("three");
		expect(state.withinActive).toBe(1);
		expect(state.wordsLeft).toBe(0);
		expect(state.percent).toBe(100);
	});

	it("should cope with a page that has no sections, or one shorter than the window", () => {
		expect(readingState([], { top: 0, bottom: 500 }, 100, VIEWPORT)).toEqual({ activeSlug: null, activeIndex: -1, withinActive: 0, percent: 100, wordsLeft: 0 });
	});
});
