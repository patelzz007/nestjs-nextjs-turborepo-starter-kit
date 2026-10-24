import { describe, expect, it } from "vitest";

import { matchOf, rankSearchCandidates } from "../services/kanban-search-ranking";

const STORY_14 = { id: "a", key: "STORY-14", title: "Refund a card" };
const STORY_142 = { id: "b", key: "STORY-142", title: "Export refunds" };
const FEATURE = { id: "c", key: "FEATURE-3", title: "Story points rollup" };
const UNKEYED = { id: "d", key: null, title: "Story map" };

describe("matchOf", () => {
	it("reads the exact key, a key prefix, then a title, ignoring case", () => {
		expect(matchOf(STORY_14, " story-14 ")).toBe("KEY");
		expect(matchOf(STORY_142, "STORY-14")).toBe("KEY_PREFIX");
		expect(matchOf(FEATURE, "story")).toBe("TITLE");
		expect(matchOf(UNKEYED, "map")).toBe("TITLE");
		expect(matchOf(UNKEYED, "STORY-1")).toBeNull();
	});
});

describe("rankSearchCandidates", () => {
	it("puts the exact key first, key prefixes next, titles last, each item once, at most the limit", () => {
		const ranked = rankSearchCandidates([FEATURE, STORY_142, STORY_14, STORY_142, UNKEYED], "story-14", 10);

		expect(ranked.map((entry) => [entry.candidate.id, entry.match])).toEqual([
			["a", "KEY"],
			["b", "KEY_PREFIX"],
		]);
		expect(rankSearchCandidates([UNKEYED, FEATURE, STORY_14], "story", 2).map((entry) => entry.candidate.id)).toEqual(["a", "d"]);
	});
});
