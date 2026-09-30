import { describe, expect, it } from "vitest";

import { buildToc, groupToc, topSections, type TocItem } from "./toc";

const HEADINGS = [
	{ depth: 1, slug: "title", text: "Title" },
	{ depth: 2, slug: "setup", text: "Setup#" },
	{ depth: 3, slug: "env", text: "Env" },
	{ depth: 4, slug: "deep", text: "Deep" },
	{ depth: 2, slug: "usage", text: "Usage" },
	{ depth: 2, slug: "faq", text: "FAQ" },
];

describe("buildToc", () => {
	it("keeps h2/h3 in order and strips the permalink marker", () => {
		expect(buildToc(HEADINGS)).toEqual([
			{ slug: "setup", text: "Setup", depth: 2 },
			{ slug: "env", text: "Env", depth: 3 },
			{ slug: "usage", text: "Usage", depth: 2 },
			{ slug: "faq", text: "FAQ", depth: 2 },
		]);
	});
});

describe("topSections", () => {
	it("returns the first h2 headings up to the limit", () => {
		expect(topSections(HEADINGS, 2).map((item) => item.slug)).toEqual(["setup", "usage"]);
		expect(topSections([], 3)).toEqual([]);
	});
});

describe("contents headings", () => {
	it("are left out of the rail and the quick links", () => {
		const headings = [
			{ depth: 2, slug: "table-of-contents", text: "Table of Contents" },
			{ depth: 2, slug: "contents", text: "Contents#" },
			{ depth: 2, slug: "intro", text: "Intro" },
		];
		expect(topSections(headings, 3).map((item) => item.slug)).toEqual(["intro"]);
		expect(buildToc(headings).map((item) => item.slug)).toEqual(["intro"]);
	});
});

describe("groupToc", () => {
	const item = (slug: string, depth: 2 | 3): TocItem => ({ slug, text: slug, depth });

	it("nests h3s under the preceding h2", () => {
		const groups = groupToc([item("a", 2), item("a1", 3), item("a2", 3), item("b", 2)]);
		expect(groups.map((group) => [group.item.slug, group.children.map((child) => child.slug)])).toEqual([
			["a", ["a1", "a2"]],
			["b", []],
		]);
	});

	it("keeps an h3 before the first h2 as its own entry", () => {
		const groups = groupToc([item("intro", 3), item("a", 2)]);
		expect(groups.map((group) => group.item.slug)).toEqual(["intro", "a"]);
		expect(groupToc([])).toEqual([]);
	});
});
