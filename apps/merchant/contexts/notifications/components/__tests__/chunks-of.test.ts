import { describe, expect, it } from "vitest";

import { chunksOf } from "../merchant-broadcast-editor-pages";

describe("chunksOf", () => {
	it("splits a list into runs of at most the size, in order", () => {
		expect(chunksOf(["a", "b", "c", "d", "e"], 2)).toStrictEqual([["a", "b"], ["c", "d"], ["e"]]);
		expect(chunksOf(["a", "b"], 2)).toStrictEqual([["a", "b"]]);
		expect(chunksOf([], 100)).toStrictEqual([]);
	});
});
